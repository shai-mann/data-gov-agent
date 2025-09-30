import {
  Annotation,
  END,
  MessagesAnnotation,
  Send,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { packageSearch, packageNameSearch, packageShow } from '@tools';
import { openai } from '@llms';
import { DATA_GOV_REMINDER_PROMPT, DATA_GOV_SEARCH_PROMPT } from './prompts';
import { DatasetSelection } from '@lib/annotation';
import { getLastAiMessageIndex, getToolMessages } from '@lib/utils';
import { z } from 'zod';
import shallowEvalAgent from '@agents/shallow-eval-agent/shallowEvalAgent';

// It can return with fewer than this (it's asked for 4-5), but this is a backstop to prevent recursion caps from being hit.
const MAX_REQUESTED_DATASETS = 5;

// State annotation for the dataset searching workflow
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
  userQuery: Annotation<string>(),
  datasets: Annotation<DatasetSelection[]>(),
});

/* MODELS */

const tools = [packageSearch, packageNameSearch];

const model = openai.bindTools(tools);

/* NODES */

/**
 * Node to setup the dataset searching agent.
 */
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

/**
 * Node to call the model to search for datasets.
 */
async function modelNode(state: typeof DatasetSearchAnnotation.State) {
  const { datasets, userQuery, messages } = state;

  if (datasets.length >= MAX_REQUESTED_DATASETS) {
    console.log(
      `🔍 [SEARCH] Found ${datasets.length} datasets, exiting search workflow`
    );
    return {}; // Skip this model call, so the workflow will exit.
  }

  console.log(
    `🔍 [SEARCH] Calling model... currently has ${datasets.length} dataset selections`
  );

  const reminderPrompt = await DATA_GOV_REMINDER_PROMPT.formatMessages({
    query: userQuery,
    remainingCount: MAX_REQUESTED_DATASETS - datasets.length,
    datasetIds: datasets.map(d => d.id).join(', '),
  });

  const result = await model.invoke([...messages, ...reminderPrompt]);

  return {
    messages: result,
    // Clear the pending datasets, as they have been processed.
    pendingDatasets: [],
  };
}

/**
 * Node to process calls from tools and perform additional post-processing.
 */
async function postToolsNode(state: typeof DatasetSearchAnnotation.State) {
  console.log('⚖️ [SEARCH] Tool post-processing Node');
  const { messages, datasets } = state;

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
    .flat()
    // Filter out the datasets that have already been selected.
    .filter(id => !datasets.some(d => d.id === id));

  return { pendingDatasets: packageSearchDatasetIds };
}

/**
 * Node to shallowly evaluate a dataset.
 */
async function shallowEvalNode(state: typeof EvalDatasetAnnotation.State) {
  const { datasetId, userQuery } = state;

  const dataset = await packageShow.invoke({
    packageId: datasetId,
  });

  const { evaluation } = await shallowEvalAgent.invoke({
    dataset,
    userQuery,
  });

  // If the dataset is not compatible, don't add it to the state.
  if (!evaluation || !evaluation.isCompatible) {
    return {};
  }

  const datasetSelection: DatasetSelection = {
    id: datasetId,
    title: dataset.title,
    reason: evaluation.reasoning,
  };

  // Uses state key for outer state, so it will automatically go there.
  return { datasets: datasetSelection };
}

/* EDGES */

/**
 * Conditional edge to route from post-tools node either to the model or to the end,
 * depending on whether the AI has found enough datasets
 */
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
  console.log('🔍 [SEARCH] Exiting search workflow');
  return END;
}

/**
 * Conditional edge to route from post-tools node either to the model or to the end,
 * depending on whether the AI has found enough datasets
 */
function shouldContinueToModel(state: typeof DatasetSearchAnnotation.State) {
  const { datasets } = state;

  if (datasets.length >= MAX_REQUESTED_DATASETS) {
    console.log('🔍 Exiting search workflow - reached max requested datasets');
    return END;
  }

  return 'model';
}

/**
 * Conditional edge to route from post-tools node either to the shallow eval (as fan-out) or to the model,
 * depending on whether there are any pending datasets
 */
function shouldContinueToEval(state: typeof DatasetSearchAnnotation.State) {
  const { pendingDatasets, userQuery, datasets } = state;
  if (pendingDatasets.length === 0) {
    console.log('🔍 [SEARCH] No pending datasets, skipping shallowEval');
    return 'model';
  }

  console.log(
    '🔍 [SEARCH] Shallow evaluating',
    pendingDatasets.length,
    'datasets'
  );
  return pendingDatasets.map(
    id => new Send('shallowEval', { datasetId: id, userQuery, datasets })
  );
}

const graph = new StateGraph(DatasetSearchAnnotation)
  .addNode('setup', setupNode)
  // Defer the model node, so the shallow eval nodes are forced to fan-in before it runs.
  .addNode('model', modelNode, { defer: true })
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
