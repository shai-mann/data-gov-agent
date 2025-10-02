import {
  Annotation,
  END,
  MessagesAnnotation,
  Send,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { packageSearch, packageShow } from '@tools';
import { openai } from '@llms';
import {
  DATA_GOV_SEARCH_PROMPT,
  DATA_GOV_SEARCH_SELECTION_PROMPT,
} from './prompts';
import { getLastAiMessageIndex, getToolMessages } from '@lib/utils';
import { z } from 'zod';
import shallowEvalAgent from '@agents/eval-agent/evalAgent';
import { DatasetSummary } from '../eval-agent/annotations';
import { ResourceEvaluation } from '../resource-eval-agent/annotations';
import { logSubState } from '@lib/ws-logger';

// TODO: replace the type in lib/annotations with this one, and move ancillary types there as well.
export type DatasetWithEvaluation = DatasetSummary & {
  id: string;
  evaluations: ResourceEvaluation[];
};

// State annotation for the dataset searching workflow
const DatasetSearchAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  datasets: Annotation<DatasetWithEvaluation[]>({
    reducer: (cur, val) => cur.concat(val),
    default: () => [],
  }),
  pastQueries: Annotation<string[]>({
    reducer: (cur, val) => cur.concat(val),
    default: () => [],
  }),
  pendingDatasets: Annotation<string[]>(),
  userQuery: Annotation<string>(),
  selectedDataset: Annotation<DatasetWithEvaluation | null>(),
  connectionId: Annotation<string | undefined>(),
});

/**
 * Simple annotation for a shallow evaluation of a dataset. Used in fan-out for shallowly evaluating datasets.
 */
const EvalDatasetAnnotation = Annotation.Root({
  datasetId: Annotation<string>(),
  userQuery: Annotation<string>(),
  connectionId: Annotation<string | undefined>(),
});

/* MODELS */

const tools = [packageSearch];

const model = openai.bindTools(tools);

const structuredModel = openai.withStructuredOutput(
  z.object({
    id: z
      .union([z.null(), z.string()])
      .describe(
        'The ID of the dataset to select, or null if no dataset is a good fit'
      ),
  })
);

/* NODES */

/**
 * Node to call the model to search for datasets.
 */
async function modelNode(state: typeof DatasetSearchAnnotation.State) {
  const { pastQueries, userQuery } = state;

  const prompt = await DATA_GOV_SEARCH_PROMPT.formatMessages({
    query: userQuery,
    pastQueries: pastQueries.length > 0 ? pastQueries.join('\n') : 'None',
  });

  const result = await model.invoke(prompt);

  return {
    messages: result,
  };
}

/**
 * Node to process calls from tools and perform additional post-processing.
 */
async function postToolsNode(state: typeof DatasetSearchAnnotation.State) {
  const { messages, datasets, connectionId } = state;

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

  logSubState(
    connectionId,
    'DatasetSearch',
    `Found ${packageSearchDatasetIds.length} new datasets to evaluate`
  );

  return { pendingDatasets: packageSearchDatasetIds };
}

/**
 * Node to evaluate a dataset.
 */
async function shallowEvalNode(state: typeof EvalDatasetAnnotation.State) {
  const { datasetId, userQuery, connectionId } = state;

  const dataset = await packageShow.invoke({
    packageId: datasetId,
  });

  logSubState(
    connectionId,
    'DatasetSearch',
    `Evaluating dataset: ${dataset.name}`
  );

  const { summary, evaluations } = await shallowEvalAgent.invoke({
    dataset,
    userQuery,
    connectionId,
  });

  // If the dataset is not compatible, don't add it to the state.
  if (!summary) {
    logSubState(
      connectionId,
      'DatasetSearch',
      `Dataset ${dataset.name} not compatible`
    );
    return {};
  }

  const datasetSelection: DatasetWithEvaluation = {
    ...summary,
    id: datasetId,
    evaluations,
  };

  logSubState(
    connectionId,
    'DatasetSearch',
    `Dataset ${dataset.name} evaluation complete`,
    {
      bestResource: datasetSelection.bestResource,
    }
  );

  // Uses state key for outer state, so it will automatically roll up there.
  // Also needs the reducer for that state to use concatenation.
  return { datasets: datasetSelection };
}

async function trySelectNode(state: typeof DatasetSearchAnnotation.State) {
  const { datasets, pendingDatasets, userQuery, connectionId } = state;

  // Since we just evaluated all pending datasets (and are about to wipe the IDs from state after this node),
  // we can re-use the list to find all the new evaluations, to provide to the model.
  const newDatasets = datasets.filter(d => pendingDatasets.includes(d.id));

  if (newDatasets.length === 0) {
    return {
      selectedDataset: null,
      pendingDatasets: [],
    };
  }

  logSubState(
    connectionId,
    'DatasetSearch',
    `Selecting best dataset from ${newDatasets.length} candidates`
  );

  const selectionPrompt = await DATA_GOV_SEARCH_SELECTION_PROMPT.formatMessages(
    {
      evaluations: newDatasets.map(d => JSON.stringify(d)).join('\n-----\n'),
      query: userQuery,
    }
  );

  const result = await structuredModel.invoke(selectionPrompt);

  const selectedDataset = result.id
    ? datasets.find(d => d.id === result.id)
    : null;

  if (selectedDataset) {
    logSubState(
      connectionId,
      'DatasetSearch',
      `Selected dataset: ${selectedDataset.id}`
    );
  }

  return {
    selectedDataset,
    // Clear the pending datasets, as they have been processed.
    pendingDatasets: [],
  };
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

  return 'model';
}

/**
 * Conditional edge to route from post-tools node either to the shallow eval (as fan-out) or to the model,
 * depending on whether there are any pending datasets
 */
function shouldContinueToEval(state: typeof DatasetSearchAnnotation.State) {
  const { pendingDatasets, userQuery, datasets, connectionId } = state;

  if (pendingDatasets.length === 0) {
    return 'model';
  }

  return pendingDatasets.map(
    id =>
      new Send('shallowEval', {
        datasetId: id,
        userQuery,
        datasets,
        connectionId,
      })
  );
}

function shouldContinueToModel(state: typeof DatasetSearchAnnotation.State) {
  const { selectedDataset } = state;

  if (selectedDataset) {
    return END;
  }

  return 'model';
}

const graph = new StateGraph(DatasetSearchAnnotation)
  .addNode('model', modelNode)
  .addNode('tools', new ToolNode(tools))
  .addNode('postTools', postToolsNode)
  .addNode('shallowEval', shallowEvalNode)
  // Defer the try select node, so the shallow eval nodes are forced to fan-in before it runs.
  .addNode('trySelect', trySelectNode, { defer: true })

  .addEdge(START, 'model')
  .addConditionalEdges('model', shouldContinueToTools, ['tools', 'model'])
  .addEdge('tools', 'postTools')
  .addConditionalEdges('postTools', shouldContinueToEval, [
    'shallowEval',
    'model',
  ])
  .addEdge('shallowEval', 'trySelect')
  .addConditionalEdges('trySelect', shouldContinueToModel, ['model', END])

  .compile();

export default graph;
