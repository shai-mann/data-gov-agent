import {
  Annotation,
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph';
import {
  QUERY_AGENT_SQL_QUERY_OUTPUT_PROMPT,
  QUERY_AGENT_SQL_QUERY_PROMPT,
  QUERY_AGENT_TABLE_NAME_PROMPT,
} from '../lib/prompts';
import {
  DatasetWithEvaluation,
  QueryAgentSummarySchema,
} from '../lib/annotation';
import { openai } from '../llms';
import { datasetDownload, doiView, packageShow } from '../tools';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { AIMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { DuckDBInstance } from '@duckdb/node-api';

// Create a persistent DuckDB connection in memory
const instance = await DuckDBInstance.create(':memory:');
const conn = await instance.connect();

/* Inline tools - since they need the db connection */
const sqlQueryTool = tool(
  async ({ query }) => {
    try {
      const rows = await conn.run(query);
      return JSON.stringify(rows, null, 2);
    } catch (err) {
      return `Error executing query: ${err instanceof Error ? err.message : 'Unknown'}`;
    }
  },
  {
    name: 'sqlQuery',
    description: `Execute a SQL query against the loaded DuckDB tables. Input should be a SQL string.`,
    schema: z.object({
      query: z.string().describe('The SQL query to execute'),
    }),
  }
);

// State annotation for the dataset evaluation workflow
const DatasetEvalAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  dataset: Annotation<DatasetWithEvaluation>,
  userQuery: Annotation<string>,
  sqlQuery: Annotation<string>,
  summary: Annotation<z.infer<typeof QueryAgentSummarySchema>>,
});

const tools = [packageShow, datasetDownload, doiView, sqlQueryTool];

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
  const { dataset, userQuery } = state;

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

  // Construct the table in DuckDB and load the dataset into it
  try {
    await conn.run(
      `CREATE OR REPLACE TABLE ${table} AS SELECT * FROM read_csv_auto('${dataset.evaluation.bestResource}')`
    );
  } catch (err: unknown) {
    throw new Error(
      `Error loading CSV ${err instanceof Error ? err.message : 'Unknown'}`
    );
  }

  // Construct the prompt for the model
  const prompt = await QUERY_AGENT_SQL_QUERY_PROMPT.formatMessages({
    tableName: table,
    query: userQuery,
  });

  return {
    messages: prompt,
  };
}

// Core evaluation prompt (evaluates a single dataset in the context of the user query)
async function modelNode(state: typeof DatasetEvalAnnotation.State) {
  console.log('🔍 [QUERY] Evaluating...');

  const result = await model.invoke(state.messages);

  return {
    messages: result,
  };
}

async function outputNode(state: typeof DatasetEvalAnnotation.State) {
  console.log('🔍 [EVAL] Structuring output...');

  const { messages, sqlQuery, userQuery } = state;
  const lastMessage = messages.at(-1) as AIMessage;

  const prompt = await QUERY_AGENT_SQL_QUERY_OUTPUT_PROMPT.formatMessages({
    sqlQuery,
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
  .addNode('model', modelNode)
  .addNode('toolNode', new ToolNode(tools))
  .addNode('output', outputNode)

  .addEdge(START, 'setup')
  .addEdge('setup', 'model')
  .addConditionalEdges('model', shouldContinue, ['toolNode', 'output'])
  .addEdge('toolNode', 'model')
  .addEdge('output', END)
  .compile();

export default graph;
