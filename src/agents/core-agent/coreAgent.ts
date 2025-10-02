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
import { logStateTransition, logSubState } from '@lib/ws-logger';

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
  connectionId: Annotation<string | undefined>(),
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
  const { userQuery, connectionId } = state;

  logStateTransition(connectionId, 'START', 'QueryFormatting');

  const prompt = await DATA_GOV_USER_QUERY_FORMATTING_PROMPT.formatMessages({
    query: userQuery,
  });

  logSubState(connectionId, 'QueryFormatting', 'Analyzing and refining query');

  const result = await formattingStructuredModel.invoke(prompt);

  logSubState(connectionId, 'QueryFormatting', 'Query formatted successfully', {
    formattedQuery: result.query,
  });

  console.log('🔍 [CORE] Formatted query:', result.query);

  return { userQuery: result.query };
}

async function searchNode(state: typeof GovResearcherAnnotation.State) {
  const { userQuery, connectionId } = state;

  logStateTransition(connectionId, 'QueryFormatting', 'DatasetSearch');

  const { selectedDataset } = await searchAgent.invoke({
    userQuery,
    connectionId,
  });

  return {
    dataset: selectedDataset,
  };
}

async function queryNode(state: typeof GovResearcherAnnotation.State) {
  const { dataset, userQuery, connectionId } = state;

  if (!dataset) {
    // This should never happen, but for typecheck we handle it.
    throw new Error('[CORE] No dataset selected at querying node');
  }

  logStateTransition(connectionId, 'DatasetSearch', 'DatasetQuery');

  const { summary } = await queryAgent.invoke(
    {
      dataset,
      userQuery,
      connectionId,
    },
    {
      // Query agent often needs some extra iterations
      // It also has it's own internal recursion limit, which doesn't error out, but returns a message indicating that it couldn't complete.
      recursionLimit: 50,
    }
  );

  return {
    summary,
  };
}

async function emitFinalEvaluationNode(
  state: typeof GovResearcherAnnotation.State
) {
  const { summary, dataset, userQuery, connectionId } = state;

  if (!dataset) {
    // Again, this should never happen, but for typecheck we handle it.
    throw new Error('No final dataset selected');
  }

  logStateTransition(connectionId, 'DatasetQuery', 'FinalEvaluation');

  logSubState(connectionId, 'FinalEvaluation', 'Fetching full dataset package');
  const fullPackage = await getPackage(dataset.id);

  logSubState(connectionId, 'FinalEvaluation', 'Generating final response');
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
