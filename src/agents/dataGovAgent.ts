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
import { MOCK_DATASETS } from './helpers/mock-datasets';

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

  console.log('🔍 [MOCK] Returning mock evaluated dataset', evaluatedDataset);

  return {
    // Uses state key for outer state, so it will automatically go there.
    evaluatedDatasets: evaluatedDataset,
  };
}

// Build the data-gov agent workflow
const graph = new StateGraph(DataGovAnnotation)
  .addNode('search', searchNode)
  .addNode('eval', evalNode)

  .addEdge(START, 'search')
  .addConditionalEdges('search', continueToEval)
  .addEdge('eval', END)

  .compile();

export default graph;
