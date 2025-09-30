import {
  Annotation,
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph';
import {
  QUERY_AGENT_EVALUATE_QUERY_PROMPT,
  QUERY_AGENT_SQL_QUERY_OUTPUT_PROMPT,
  QUERY_AGENT_SQL_QUERY_PROMPT,
  QUERY_AGENT_SQL_REMINDER_PROMPT,
  QUERY_AGENT_TABLE_NAME_PROMPT,
} from '../lib/prompts';
import {
  DatasetWithEvaluation,
  QueryAgentSummarySchema,
} from '../lib/annotation';
import { openai } from '../llms';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { AIMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { DuckDBInstance } from '@duckdb/node-api';
import {
  datasetDownload,
  workingDatasetMemory,
} from '../tools/datasetDownload';
import path from 'path';
import fs from 'fs';
import os from 'os';
import contextAgent from './contextAgent';
import { getLastAiMessageIndex, getToolMessages } from '../lib/utils';

// Create a persistent DuckDB connection in memory
const instance = await DuckDBInstance.create(':memory:');
const conn = await instance.connect();

/* Inline tools - since they need the db connection */
const sqlQueryTool = tool(
  async ({ query, limit = 10 }) => {
    try {
      console.log(
        '🔍 [QUERY] Executing query: "',
        query,
        '" with limit ',
        limit
      );
      const result = await conn.runAndReadAll(query);

      // Create column metadata
      const columns = result.columnNames().map((c, i) => {
        return {
          name: c,
          type: result.columnType(i),
        };
      });

      const output = JSON.stringify({
        rows: result.getRowObjectsJson().slice(0, limit),
        columns,
      });

      console.log('🎉 [QUERY] Returned ', output.length, ' characters');

      return { success: true, output };
    } catch (err) {
      console.error('🔍 [QUERY] Error executing query: ', err);
      return `Error executing query: ${err instanceof Error ? err.message : 'Unknown'}`;
    }
  },
  {
    name: 'sqlQuery',
    description: `Execute a SQL query against the loaded DuckDB tables. Input should be a SQL string.`,
    schema: z.object({
      query: z.string().describe('The SQL query to execute'),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe(
          'The number of rows to limit the output of the query to. Default is 10. Use a limit like 10 or 20 for all queries except the final query.'
        ),
    }),
  }
);

const MAX_QUERY_COUNT = 10;

// State annotation for the dataset evaluation workflow
const DatasetEvalAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  dataset: Annotation<DatasetWithEvaluation>,
  queryCount: Annotation<number>({
    default: () => 0,
    reducer: (cur, val) => cur + val,
  }),
  tableName: Annotation<string>,
  preview: Annotation<string[]>,
  userQuery: Annotation<string>,
  sqlQuery: Annotation<string>,
  summary: Annotation<z.infer<typeof QueryAgentSummarySchema>>,
});

const tools = [sqlQueryTool];

const model = openai.bindTools(tools);
const structuredModel = openai.withStructuredOutput(QueryAgentSummarySchema);

const tableNameStructuredModel = openai.withStructuredOutput(
  z.object({
    table: z
      .string()
      .describe(
        'The name of the SQL table to create and load the dataset into'
      ),
  })
);

/* QUERYING WORKFLOW */

async function setupNode(state: typeof DatasetEvalAnnotation.State) {
  const { dataset } = state;

  console.log('🔍 [QUERY] Initializing...');

  if (dataset.evaluation === undefined || dataset.evaluation.usable === false) {
    throw new Error('Dataset is not usable');
  }

  // Get a name for the table
  const { table } = await tableNameStructuredModel.invoke(
    await QUERY_AGENT_TABLE_NAME_PROMPT.formatMessages({
      dataset: dataset.title,
    })
  );

  // Fetch the dataset (re-using the tool will result in using the cached data, since it must have been checked already)
  const csvDataset =
    workingDatasetMemory[dataset.evaluation.bestResource].join('\n');

  // Write to a temp file
  const tmpPath = path.join(os.tmpdir(), `tmp_${Date.now()}.csv`);
  fs.writeFileSync(tmpPath, csvDataset, 'utf8');

  // Construct the table in DuckDB and load the dataset into it
  try {
    console.log('🔍 [QUERY] Creating table:', table);
    await conn.run(
      `CREATE TABLE ${table} AS SELECT * FROM read_csv_auto('${tmpPath}')`
    );
  } catch (err: unknown) {
    throw new Error(
      `Error loading CSV ${err instanceof Error ? err.message : 'Unknown'}`
    );
  }

  const { preview } = await datasetDownload.invoke({
    resourceUrl: dataset.evaluation.bestResource,
    limit: 20,
    offset: 0,
  });

  return {
    tableName: table,
    preview,
  };
}

async function contextNode(state: typeof DatasetEvalAnnotation.State) {
  const { dataset, preview, tableName, userQuery } = state;

  // Call the context agent
  const { summary } = await contextAgent.invoke({
    dataset,
  });

  // Construct the prompt for the model, including the context from the context agent
  const prompt = await QUERY_AGENT_SQL_QUERY_PROMPT.formatMessages({
    tableName,
    query: userQuery,
    context: summary,
    preview: preview.join('\n'),
  });

  return {
    messages: prompt,
  };
}

// Core evaluation prompt (evaluates a single dataset in the context of the user query)
async function modelNode(state: typeof DatasetEvalAnnotation.State) {
  console.log('🔍 [QUERY] Evaluating...');

  if (state.queryCount >= MAX_QUERY_COUNT) {
    console.log(
      '🔍 [QUERY] Exiting workflow (model) - query count is at: ',
      state.queryCount
    );
    return {}; // Skip this model call, so the workflow will exit.
  }

  const prompt = await QUERY_AGENT_SQL_REMINDER_PROMPT.formatMessages({
    executedCount: state.queryCount,
    remainingCount: MAX_QUERY_COUNT - state.queryCount,
  });

  const result = await model.invoke([...state.messages, ...prompt]);

  return {
    messages: result,
  };
}

async function postToolNode(state: typeof DatasetEvalAnnotation.State) {
  const { messages, queryCount } = state;

  const sqlQueryToolMessages = getToolMessages(
    messages,
    'sqlQuery',
    getLastAiMessageIndex(messages) + 1
  );

  console.log(
    '🔍 [QUERY] Post-tool node, query count is now at: ',
    queryCount + sqlQueryToolMessages.length
  );

  return {
    // Because of the reducer, this is additive
    queryCount: sqlQueryToolMessages.length,
  };
}

async function evaluateQueryNode(state: typeof DatasetEvalAnnotation.State) {
  const { messages, userQuery, tableName, preview, queryCount } = state;
  const lastMessageIndex = getLastAiMessageIndex(messages);

  const history = messages.slice(lastMessageIndex);

  const prompt = await QUERY_AGENT_EVALUATE_QUERY_PROMPT.formatMessages({
    userQuery,
    tableName,
    preview: preview.join('\n'),
    remainingQueryCount: MAX_QUERY_COUNT - queryCount,
  });

  console.log('🔍 [QUERY] Evaluating last query...');

  // Not using the model with tools here because it shouldn't use any tools.
  const result = await openai.invoke([...history, ...prompt]);

  console.log('🔍 [QUERY] Evaluated query: ', result.content);

  return {
    messages: result,
  };
}

async function outputNode(state: typeof DatasetEvalAnnotation.State) {
  console.log('🔍 [EVAL] Structuring output...');

  const { messages, userQuery } = state;
  const lastMessage = messages.at(-1) as AIMessage;

  const prompt = await QUERY_AGENT_SQL_QUERY_OUTPUT_PROMPT.formatMessages({
    userQuery,
    results: lastMessage.content as string,
  });

  const summary = await structuredModel.invoke(prompt);

  return {
    summary,
  };
}

function shouldContinue(state: typeof DatasetEvalAnnotation.State) {
  const messages = state.messages;
  const lastMessage = messages.at(-1) as AIMessage;

  if (
    'tool_calls' in lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls?.length
  ) {
    return 'toolNode';
  }

  console.log('🔍 [QUERY] Exiting workflow');
  return 'output';
}

const graph = new StateGraph(DatasetEvalAnnotation)
  .addNode('setup', setupNode)
  .addNode('context', contextNode)
  .addNode('model', modelNode)
  .addNode('toolNode', new ToolNode(tools))
  .addNode('postTool', postToolNode)
  .addNode('evaluateQuery', evaluateQueryNode)
  .addNode('output', outputNode)

  .addEdge(START, 'setup')
  .addEdge('setup', 'context')
  .addEdge('context', 'model')
  .addConditionalEdges('model', shouldContinue, ['toolNode', 'output'])
  .addEdge('toolNode', 'postTool')
  .addEdge('postTool', 'evaluateQuery')
  .addEdge('evaluateQuery', 'model')
  .addEdge('output', END)
  .compile();

export default graph;
