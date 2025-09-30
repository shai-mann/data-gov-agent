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
} from './prompts';
import {
  DatasetWithEvaluation,
  QueryAgentSummarySchema,
} from '@lib/annotation';
import { openai } from '@llms';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { AIMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { datasetDownload } from '@tools/datasetDownload';
import path from 'path';
import fs from 'fs';
import os from 'os';
import contextAgent from '@agents/context-agent/contextAgent';
import { getLastAiMessageIndex, getToolMessages } from '@lib/utils';
import { conn, workingDatasetMemory } from '@lib/database';
import { sqlQueryTool } from '@tools';

const MAX_QUERY_COUNT = 10;

/* ANNOTATIONS */

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

/* MODELS */

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

/* NODES */

/**
 * Handles initializing the "database" (with DuckDB, in-mem), creating the table and populating it, and providing a preview of the dataset.
 */
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

/**
 * Invokes the context agent to generate a context prompt for the model before it iterates.
 */
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

/**
 * Updates the query count after the SQL query tool is used.
 */
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

/**
 * Evaluates the last query and provides feedback on what could be improved for the next query.
 * Splitting this apart from the generation model allows a much stronger plan-then-execute approach for the agent.
 */
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

/**
 * Formulate a structured output including summary, table, and queries.
 */
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

/* EDGES */

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
