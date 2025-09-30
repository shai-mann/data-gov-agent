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
} from '../../lib/annotation';
import { Send } from '@langchain/langgraph';
import searchAgent from '../search-agent/searchAgent';
import evalAgent from '../evalAgent';
import { openai } from '../../llms';
import { z } from 'zod';
import queryAgent from '../queryAgent';
import { getPackage } from '../../lib/data-gov';
import {
  DATA_GOV_FINAL_EVALUATION_PROMPT,
  DATA_GOV_FINAL_SELECTION_PROMPT,
  DATA_GOV_USER_QUERY_FORMATTING_PROMPT,
} from './prompts';

/*
NOTE: This **was** a core agent (running exactly as you see below), but due to token limitations (20k tokens/min for my account),
I'm submitting the separate agents for search, eval, and query, rather than this full combined agent.

This code still exists so you can see how it would all get stitched together, but the project itself lives in the other agent files.
*/

/* ANNOTATIONS */

/**
 * Main annotation for the gov researcher agent.
 */
const GovResearcherAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  datasets: Annotation<DatasetSelection[]>({
    reducer: (cur, val) => cur.concat(val),
    default: () => [],
  }),
  evaluatedDatasets: Annotation<DatasetWithEvaluation[]>({
    reducer: (cur, val) => cur.concat(val),
    default: () => [],
  }),
  finalDataset: Annotation<DatasetWithEvaluation | null>(),
  userQuery: Annotation<string>(),
  summary: Annotation<z.infer<typeof QueryAgentSummarySchema>>(),
  output: Annotation<string>(),
});

/**
 * Simple annotation for a single dataset. Used in fan-out for evaluating datasets.
 */
const EvalDatasetAnnotation = Annotation.Root({
  dataset: Annotation<DatasetSelection>(),
  userQuery: Annotation<string>(),
});

/* MODELS */

const formattingStructuredModel = openai.withStructuredOutput(
  z.object({
    query: z.string(),
  })
);

const structuredModel = openai.withStructuredOutput(
  z.object({
    type: z.literal('dataset').or(z.literal('none')),
    id: z.string().optional().nullable(),
  })
);

/* NODES */

async function userQueryFormattingNode(
  state: typeof GovResearcherAnnotation.State
) {
  const { userQuery } = state;
  const prompt = await DATA_GOV_USER_QUERY_FORMATTING_PROMPT.formatMessages({
    query: userQuery,
  });

  console.log('🔍 [CORE] Formatting user query...');

  const result = await formattingStructuredModel.invoke(prompt);

  console.log('🔍 [CORE] Constructed more specific user query: ', result.query);

  return { userQuery: result.query };
}

async function searchNode(state: typeof GovResearcherAnnotation.State) {
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

  return {
    userQuery,
    datasets,
  };
}

/**
 * Conditional edge function to construct the fan-out for evaluating datasets.
 */
function continueToEval(state: typeof GovResearcherAnnotation.State) {
  const { datasets, userQuery } = state;

  console.log(
    '🔍 [CORE] Kicking off evaluation for',
    datasets.length,
    'datasets'
  );
  return datasets.map(dataset => new Send('eval', { dataset, userQuery }));
}

async function evalNode(state: typeof EvalDatasetAnnotation.State) {
  const { dataset, userQuery } = state;

  const { dataset: evaluatedDataset } = await evalAgent.invoke({
    dataset,
    userQuery,
  });

  // If the dataset is not usable, don't add it to the state.
  if (evaluatedDataset.evaluation?.usable === false) {
    return {};
  }

  return {
    // Uses state key for outer state, so it will automatically go there.
    evaluatedDatasets: evaluatedDataset,
  };
}

async function datasetFinalSelectionNode(
  state: typeof GovResearcherAnnotation.State
) {
  const { evaluatedDatasets, userQuery } = state;

  const prompt = await DATA_GOV_FINAL_SELECTION_PROMPT.formatMessages({
    datasets: JSON.stringify(evaluatedDatasets),
    query: userQuery,
  });

  console.log('🔍 [CORE] Selecting final dataset...');

  const result = await structuredModel.invoke(prompt);

  if (result.type === 'none' || !result.id) {
    console.log('🔍 [CORE] No dataset selected. Repeating process...');

    // Exit early.
    return {};
  }

  const evaluatedDataset = evaluatedDatasets.find(d => d.id === result.id);

  if (!evaluatedDataset) {
    console.log(
      '🔍 [CORE] No dataset found in evaluated datasets. Repeating process...'
    );

    // Exit early.
    return {};
  }

  console.log('🔍 [CORE] Final dataset selected: ', evaluatedDataset);

  return {
    finalDataset: evaluatedDataset,
  };
}

async function queryNode(state: typeof GovResearcherAnnotation.State) {
  const { finalDataset, userQuery } = state;

  if (!finalDataset) {
    // This should never happen, but for typecheck we handle it.
    throw new Error('[CORE] No dataset selected at querying node');
  }

  const { summary } = await queryAgent.invoke(
    {
      dataset: finalDataset,
      userQuery,
    },
    {
      recursionLimit: 50, // This limit is high, but there's a lower limit in the query agent itself, to force it to exit.
    }
  );

  console.log('🔍 [CORE] Exiting workflow');
  return {
    summary,
  };
}

async function emitFinalEvaluationNode(
  state: typeof GovResearcherAnnotation.State
) {
  const { summary, finalDataset, userQuery } = state;

  if (!finalDataset) {
    throw new Error('No final dataset selected');
  }

  const fullPackage = await getPackage(finalDataset.id);

  const prompt = await DATA_GOV_FINAL_EVALUATION_PROMPT.formatMessages({
    userQuery,
    summary: JSON.stringify(summary),
    finalDataset: JSON.stringify(finalDataset),
    fullPackage: JSON.stringify(fullPackage),
  });

  const response = await openai.invoke(prompt);

  return {
    output: response.content,
  };
}

/* EDGES */

async function shouldContinueWithSelection(
  state: typeof GovResearcherAnnotation.State
) {
  const { finalDataset } = state;
  // If no dataset is selected, we end early.
  return finalDataset ? 'query' : END;
}

// Build the gov researcher agent workflow
const graph = new StateGraph(GovResearcherAnnotation)
  .addNode('format', userQueryFormattingNode)
  .addNode('search', searchNode)
  .addNode('eval', evalNode)
  // Defer the selection node, so all evaluation nodes complete before it runs.
  .addNode('select', datasetFinalSelectionNode, { defer: true })
  .addNode('query', queryNode)
  .addNode('emitOutput', emitFinalEvaluationNode)

  .addEdge(START, 'format')
  .addEdge('format', 'search')
  .addConditionalEdges('search', continueToEval)
  .addEdge('eval', 'select')
  .addConditionalEdges('select', shouldContinueWithSelection, [END, 'query'])
  .addEdge('query', 'emitOutput')
  .addEdge('emitOutput', END)

  .compile();

export default graph;
