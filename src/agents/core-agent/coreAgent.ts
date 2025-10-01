import {
  Annotation,
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { QueryAgentSummarySchema } from '@lib/annotation';
import { openai } from '@llms';
import { z } from 'zod';
import { queryAgent, searchAgent } from '..';
import { getPackage } from '@lib/data-gov';
import {
  DATA_GOV_FINAL_EVALUATION_PROMPT,
  DATA_GOV_USER_QUERY_FORMATTING_PROMPT,
} from './prompts';
import { DatasetWithEvaluation } from '@agents/search-agent/searchAgent';

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
  dataset: Annotation<DatasetWithEvaluation | null>(),
  userQuery: Annotation<string>(),
  summary: Annotation<z.infer<typeof QueryAgentSummarySchema>>(),
  output: Annotation<string>(),
});

/* MODELS */

const formattingStructuredModel = openai.withStructuredOutput(
  z.object({
    query: z.string(),
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

  const { selectedDataset } = await searchAgent.invoke({
    userQuery,
  });

  return {
    dataset: selectedDataset,
  };
}

async function queryNode(state: typeof GovResearcherAnnotation.State) {
  const { dataset, userQuery } = state;

  if (!dataset) {
    // This should never happen, but for typecheck we handle it.
    throw new Error('[CORE] No dataset selected at querying node');
  }

  const { summary } = await queryAgent.invoke({
    dataset,
    userQuery,
  });

  console.log('🔍 [CORE] Exiting workflow');
  return {
    summary,
  };
}

async function emitFinalEvaluationNode(
  state: typeof GovResearcherAnnotation.State
) {
  const { summary, dataset, userQuery } = state;

  if (!dataset) {
    // Again, this should never happen, but for typecheck we handle it.
    throw new Error('No final dataset selected');
  }

  const fullPackage = await getPackage(dataset.id);

  const prompt = await DATA_GOV_FINAL_EVALUATION_PROMPT.formatMessages({
    userQuery,
    summary: JSON.stringify(summary),
    dataset: JSON.stringify(dataset),
    fullPackage: JSON.stringify(fullPackage),
  });

  const response = await openai.invoke(prompt);

  return {
    output: response.content,
  };
}

/* EDGES */

async function shouldContinueToQuery(
  state: typeof GovResearcherAnnotation.State
) {
  const { dataset } = state;
  // If no dataset is selected, we end early.
  if (dataset) {
    return 'query';
  }

  console.log('🔍 [CORE] No dataset selected, exiting workflow');
  return END;
}

// Build the gov researcher agent workflow
const graph = new StateGraph(GovResearcherAnnotation)
  .addNode('format', userQueryFormattingNode)
  .addNode('search', searchNode)
  .addNode('query', queryNode)
  .addNode('emitOutput', emitFinalEvaluationNode)

  .addEdge(START, 'format')
  .addEdge('format', 'search')
  .addConditionalEdges('search', shouldContinueToQuery, ['query', END])
  .addEdge('query', 'emitOutput')
  .addEdge('emitOutput', END)

  .compile();

export default graph;
