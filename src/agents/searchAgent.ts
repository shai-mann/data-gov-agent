import {
  Annotation,
  END,
  MessagesAnnotation,
  Send,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { packageSearch, packageNameSearch, packageShow } from '../tools';
import { openai } from '../llms';
import {
  DATA_GOV_REMINDER_PROMPT,
  DATA_GOV_SEARCH_PROMPT,
} from '../lib/prompts';
import { DatasetSelection } from '../lib/annotation';
import { getLastAiMessageIndex, getToolMessages } from '../lib/utils';
import { z } from 'zod';
import shallowEvalAgent from './shallowEvalAgent';

// It can return with fewer than this (it's asked for 10-15), but this is a backstop to prevent recursion caps from being hit.
const MAX_REQUESTED_DATASETS = 20;

// State annotation for the dataset selection workflow
const DatasetSearchAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  datasets: Annotation<DatasetSelection[]>({
    reducer: (cur, val) => cur.concat(val),
    default: () => [],
  }),
  pendingDatasets: Annotation<string[]>(),
  userQuery: Annotation<string>(),
});

/**
 * Simple annotation for a shallow evaluation of a dataset. Used in fan-out for shallowly evaluating datasets.
 */
const EvalDatasetAnnotation = Annotation.Root({
  datasetId: Annotation<string>(),
});

const tools = [packageSearch, packageNameSearch];

const model = openai.bindTools(tools);

async function setupNode(state: typeof DatasetSearchAnnotation.State) {
  const { userQuery } = state;

  if (!userQuery) {
    throw new Error('Must provide a user query');
  }

  console.log('🔍 Initializing dataset searching agent');

  const prompt = await DATA_GOV_SEARCH_PROMPT.formatMessages({
    query: userQuery,
  });

  return {
    messages: prompt,
  };
}

async function modelNode(state: typeof DatasetSearchAnnotation.State) {
  console.log(
    '🔍 Calling model... currently has',
    state.datasets.length,
    'dataset selections'
  );

  const reminderPrompt = await DATA_GOV_REMINDER_PROMPT.formatMessages({
    query: state.userQuery,
    datasetCount: state.datasets.length,
    datasetIds: state.datasets.map(d => d.id).join(', '),
  });

  const result = await model.invoke([...state.messages, ...reminderPrompt]);

  return {
    messages: result,
  };
}

// Middle node to process calls from tools and perform additional post-processing
async function postToolsNode(state: typeof DatasetSearchAnnotation.State) {
  console.log('⚖️ Tool post-processing Node - Processing tool results...');
  const { messages } = state;

  // Since it could be a batch of tool calls, we need to find all tool calls since the last AI message
  const lastAiMessageIndex = getLastAiMessageIndex(messages);

  // Find all packageSearch tool calls
  const packageSearchToolMessages = getToolMessages(
    messages,
    'package_search',
    lastAiMessageIndex + 1
  );

  // Extract IDs of the datasets that were found in the packageSearch tool calls
  const packageSearchDatasetIds = packageSearchToolMessages
    .map(p => z.array(z.object({ id: z.string() })).parse(p.results))
    .map(m => m.map(r => r.id))
    .flat();

  return { pendingDatasets: packageSearchDatasetIds };
}

async function shallowEvalNode(state: typeof EvalDatasetAnnotation.State) {
  const { datasetId } = state;

  const dataset = await packageShow.invoke({
    packageId: datasetId,
  });

  const { evaluation } = await shallowEvalAgent.invoke({
    dataset,
  });

  // If the dataset is not compatible, don't add it to the state.
  if (!evaluation.isCompatible) {
    return {};
  }

  // Uses state key for outer state, so it will automatically go there.
  return { datasets: dataset };
}

function shouldContinueToTools(state: typeof DatasetSearchAnnotation.State) {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];

  // If the LLM makes a tool call, go to tool node
  if (
    'tool_calls' in lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls?.length
  ) {
    return 'tools';
  }

  // If no tools were called, the AI is presumed to have found all the datasets it needed to find
  console.log('🔍 Exiting search workflow');
  return END;
}

// Conditional edge to route from post-tools node either to the model or to the end, depending on whether the AI has found enough datasets
function shouldContinueToModel(state: typeof DatasetSearchAnnotation.State) {
  const { datasets } = state;
  if (datasets.length >= MAX_REQUESTED_DATASETS) {
    console.log('🔍 Exiting search workflow - reached max requested datasets');
    return END;
  }

  return 'model';
}

function shouldContinueToEval(state: typeof DatasetSearchAnnotation.State) {
  const { pendingDatasets } = state;
  if (pendingDatasets.length === 0) {
    console.log('🔍 No pending datasets, skipping shallowEval');
    return 'model';
  }

  console.log('🔍 Shallow evaluating', pendingDatasets.length, 'datasets');
  return pendingDatasets.map(id => new Send('shallowEval', { datasetId: id }));
}

// Build the data-gov agent workflow
const graph = new StateGraph(DatasetSearchAnnotation)
  .addNode('setup', setupNode)
  .addNode('model', modelNode)
  .addNode('tools', new ToolNode(tools))
  .addNode('postTools', postToolsNode)
  .addNode('shallowEval', shallowEvalNode)

  .addEdge(START, 'setup')
  .addEdge('setup', 'model')
  .addConditionalEdges('model', shouldContinueToTools, ['tools', END])
  .addEdge('tools', 'postTools')
  .addConditionalEdges('postTools', shouldContinueToEval, [
    'shallowEval',
    'model',
  ])
  .addConditionalEdges('shallowEval', shouldContinueToModel, ['model', END])

  .compile();

export default graph;
