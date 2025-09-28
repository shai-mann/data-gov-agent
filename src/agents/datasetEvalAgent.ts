import {
  Annotation,
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { DATA_GOV_EVALUATE_DATASET_PROMPT } from '../lib/prompts';
import { DatasetSelection } from '../lib/annotation';
import { openai } from '../llms';
import { datasetDownload, doiView, packageShow } from '../tools';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { AIMessage } from '@langchain/core/messages';
import { WebBrowser } from 'langchain/tools/webbrowser';
import { OpenAIEmbeddings } from '@langchain/openai';
import { tool } from 'langchain';
import { z } from 'zod';

// State annotation for the dataset evaluation workflow
const DatasetEvalAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  dataset: Annotation<DatasetSelection>,
  userQuery: Annotation<string>,
});

const tools = [packageShow, datasetDownload, doiView];

const model = openai.bindTools(tools);
const embeddings = new OpenAIEmbeddings();
const webBrowser = new WebBrowser({ model: openai, embeddings });

/* DATASET EVALUATION WORKFLOW */

async function setupNode(state: typeof DatasetEvalAnnotation.State) {
  const { dataset, userQuery } = state;

  console.log('🔍 Setting up initial state...');

  const prompt = await DATA_GOV_EVALUATE_DATASET_PROMPT.formatMessages({
    query: userQuery,
    datasetId: dataset.id,
    datasetTitle: dataset.title,
    datasetReason: dataset.reason,
  });

  return {
    messages: prompt,
  };
}

// Core evaluation prompt (evaluates a single dataset in the context of the user query)
async function modelNode(state: typeof DatasetEvalAnnotation.State) {
  console.log('🔍 Calling model...');

  const result = await model.invoke([...state.messages]);

  return {
    messages: result,
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

  console.log('🔍 Exiting workflow');
  return END;
}

// TODO: temporary tool to have logging for when searching the web
const webSearchTool = tool(
  async ({ query }) => {
    console.log('🔍 Searching the web for:', query);
    const result = await webBrowser.invoke({ query });
    return result;
  },
  {
    name: 'webSearch',
    description: 'Search the web for information about the dataset',
    schema: z.object({
      query: z.string().describe('The query to search the web for'),
    }),
  }
);

const graph = new StateGraph(DatasetEvalAnnotation)
  .addNode('setup', setupNode)
  .addNode('model', modelNode)
  .addNode('toolNode', new ToolNode([...tools, webSearchTool]))

  .addEdge(START, 'setup')
  .addEdge('setup', 'model')
  .addConditionalEdges('model', shouldContinue, ['toolNode', END])
  .addEdge('toolNode', 'model')
  .compile();

export default graph;
