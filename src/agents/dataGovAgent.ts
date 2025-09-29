import {
  Annotation,
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph';
import {
  DatasetSelection,
  DatasetWithEvaluation,
  QueryAgentSummarySchema,
} from '../lib/annotation';
import { Send } from '@langchain/langgraph';
import searchAgent from './datasetSearchAgent';
import evalAgent from './datasetEvalAgent';
import {
  MOCK_DATASETS,
  MOCK_EVALUATED_DATASETS,
  MOCK_FINAL_SELECTION,
  MOCK_USER_QUERY,
} from './helpers/mock-datasets';
import { openai } from '../llms';
import { z } from 'zod';
import {
  DATA_GOV_FINAL_SELECTION_PROMPT,
  DATA_GOV_USER_QUERY_FORMATTING_PROMPT,
} from '../lib/prompts';
import queryAgent from './queryAgent';

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
  summary: Annotation<z.infer<typeof QueryAgentSummarySchema>>(),
});

/**
 * Simple annotation for a single dataset. Used in fan-out for evaluating datasets.
 */
const EvalDatasetAnnotation = Annotation.Root({
  dataset: Annotation<DatasetSelection>(),
  userQuery: Annotation<string>(),
});

const formattingStructuredModel = openai.withStructuredOutput(
  z.object({
    query: z.string(),
  })
);

async function userQueryFormattingNode(state: typeof DataGovAnnotation.State) {
  const { userQuery } = state;
  const prompt = await DATA_GOV_USER_QUERY_FORMATTING_PROMPT.formatMessages({
    query: userQuery,
  });

  console.log('🔍 [CORE] Formatting user query...');

  const result = await formattingStructuredModel.invoke(prompt);

  // const result = MOCK_USER_QUERY;

  return { userQuery: result.query };
}

async function searchNode(state: typeof DataGovAnnotation.State) {
  const { userQuery } = state;

  const { datasets } = await searchAgent.invoke(
    {
      userQuery,
    },
    {
      // slightly above the default of 20, to allow more iteration as it finds datasets.
      recursionLimit: 30,
    }
  );

  // const datasets = MOCK_DATASETS;

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

  console.log('🔍 [CORE] Selecting final dataset...');

  const result = await structuredModel.invoke(prompt);
  // const result = MOCK_FINAL_SELECTION;

  if (result.type === 'none') {
    console.log('🔍 [CORE] No dataset selected. Repeating process...');

    // Clear the state so we can start over.
    // TODO: Clear the state, but add the datasets we evaluated to a blacklist for next time.
    return {};
  }

  return {
    finalDataset: result,
  };
}

async function queryNode(state: typeof DataGovAnnotation.State) {
  const { finalDataset, userQuery } = state;

  if (!finalDataset) {
    // This should never happen, but for typecheck we handle it.
    throw new Error('[CORE] No dataset selected at querying node');
  }

  const summary = await queryAgent.invoke({
    dataset: finalDataset,
    userQuery,
  });

  return {
    summary,
  };
}

async function shouldContinueWithSelection(
  state: typeof DataGovAnnotation.State
) {
  const { finalDataset } = state;
  // If no dataset is selected, we need to repeat the process.
  // Otherwise, move on to querying the dataset.
  return finalDataset ? 'query' : 'search';
}

// Build the data-gov agent workflow
const graph = new StateGraph(DataGovAnnotation)
  .addNode('format', userQueryFormattingNode)
  .addNode('search', searchNode)
  .addNode('eval', evalNode)
  .addNode('select', datasetFinalSelectionNode)
  .addNode('query', queryNode)

  .addEdge(START, 'format')
  .addEdge('format', 'search')
  .addConditionalEdges('search', continueToEval)
  .addEdge('eval', 'select')
  .addConditionalEdges('select', shouldContinueWithSelection, [
    'search',
    'query',
  ])
  .addEdge('query', END)

  .compile();

export default graph;
