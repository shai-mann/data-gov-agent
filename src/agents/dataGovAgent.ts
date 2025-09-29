import {
  Annotation,
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { DatasetSelection, DatasetWithEvaluation } from '../lib/annotation';
import { Send } from '@langchain/langgraph';
import searchAgent from './datasetSearchAgent';
import evalAgent from './datasetEvalAgent';
import {
  MOCK_DATASETS,
  MOCK_EVALUATED_DATASETS,
} from './helpers/mock-datasets';
import { openai } from '../llms';
import { z } from 'zod';
import { DATA_GOV_FINAL_SELECTION_PROMPT } from '../lib/prompts';

/**
 * Main annotation for the data-gov agent.
 */
const DataGovAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  datasets: Annotation<DatasetWithEvaluation[]>({
    // NOT CONCATENATION, because we need to be able to override old datasets when the search returns new ones.
    reducer: (_, val) => val,
    default: () => [],
  }),
  evaluatedDatasets: Annotation<DatasetWithEvaluation[]>({
    // YES CONCATENATION, because we need to accumulate the evaluated datasets from fan-in and fan-out.
    reducer: (cur, val) => cur.concat(val),
    default: () => [],
  }),
  finalDataset: Annotation<DatasetWithEvaluation | null>(),
  userQuery: Annotation<string>(),
});

/**
 * Simple annotation for a single dataset. Used in fan-out for evaluating datasets.
 */
const EvalDatasetAnnotation = Annotation.Root({
  dataset: Annotation<DatasetSelection>(),
  userQuery: Annotation<string>(),
});

async function searchNode(state: typeof DataGovAnnotation.State) {
  const { userQuery } = state;

  // const { datasets } = await searchAgent.invoke(
  //   {
  //     userQuery,
  //   },
  //   {
  //     // slightly above the default of 20, to allow more iteration as it finds datasets.
  //     recursionLimit: 30,
  //   }
  // );

  const datasets = MOCK_DATASETS;

  return {
    userQuery,
    datasets,
  };
}

/**
 * Conditional edge function to construct the fan-out for evaluating datasets.
 */
function continueToEval(state: typeof DataGovAnnotation.State) {
  const { datasets, userQuery } = state;

  return datasets.map(dataset => new Send('eval', { dataset, userQuery }));
}

async function evalNode(state: typeof EvalDatasetAnnotation.State) {
  const { dataset, userQuery } = state;

  const { dataset: evaluatedDataset } = await evalAgent.invoke({
    dataset,
    userQuery,
  });

  // const evaluatedDataset = MOCK_EVALUATED_DATASETS.find(
  //   d => d.id === dataset.id
  // )!;

  // If the dataset is not relevant, don't add it to the state.
  if (evaluatedDataset.evaluation?.usable === false) {
    return {};
  }

  return {
    // Uses state key for outer state, so it will automatically go there.
    evaluatedDatasets: evaluatedDataset,
  };
}

const structuredModel = openai.withStructuredOutput(
  z.object({
    type: z.literal('dataset').or(z.literal('none')),
    id: z.string().optional().nullable(),
  })
);

async function datasetFinalSelectionNode(
  state: typeof DataGovAnnotation.State
) {
  const { evaluatedDatasets, userQuery } = state;

  const prompt = await DATA_GOV_FINAL_SELECTION_PROMPT.formatMessages({
    datasets: JSON.stringify(evaluatedDatasets),
    query: userQuery,
  });

  console.log('🔍 [FINAL SELECTION] Selecting final dataset...');

  const result = await structuredModel.invoke(prompt);

  if (result.type === 'none') {
    console.log(
      '🔍 [FINAL SELECTION] No dataset selected. Repeating process...'
    );

    // Clear the state so we can start over.
    // TODO: Clear the state, but add the datasets we evaluated to a blacklist for next time.
    return {};
  }

  return {
    finalDataset: result,
  };
}

async function shouldContinueWithSelection(
  state: typeof DataGovAnnotation.State
) {
  const { finalDataset } = state;
  // If no dataset is selected, we need to repeat the process.
  return finalDataset ? END : 'search';
}

// Build the data-gov agent workflow
const graph = new StateGraph(DataGovAnnotation)
  .addNode('search', searchNode)
  .addNode('eval', evalNode)
  .addNode('select', datasetFinalSelectionNode)

  .addEdge(START, 'search')
  .addConditionalEdges('search', continueToEval)
  .addEdge('eval', 'select')
  .addConditionalEdges('select', shouldContinueWithSelection, ['search', END])

  .compile();

export default graph;
