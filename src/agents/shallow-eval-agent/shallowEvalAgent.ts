import {
  Annotation,
  END,
  MessagesAnnotation,
  Send,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { openai } from '../../llms';
import { ShallowEvaluationSchema } from '../../lib/annotation';
import { z } from 'zod';
import { PackageShowResponse } from '../../lib/data-gov.schemas';
import {
  DATA_GOV_SHALLOW_EVAL_SINGLE_RESOURCE_PROMPT,
  DATA_GOV_SHALLOW_EVAL_SUMMATIVE_PROMPT,
} from './prompts';

/**
 * This agent is a shallow evaluation helper agent for the core Search Agent.
 * It's used to shallowly evaluate a single dataset that the search agent finds, and determine if it's likely to answer the user's question.
 */

/* ANNOTATIONS */

const ShallowSearchAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  dataset: Annotation<PackageShowResponse>,
  resourceEvaluations: Annotation<z.infer<typeof ShallowEvaluationSchema>[]>({
    reducer: (cur, val) => cur.concat(val),
    default: () => [],
  }),
  userQuery: Annotation<string>(),
  evaluation: Annotation<z.infer<typeof ShallowEvaluationSchema>>,
});

const ResourceEvaluationAnnotation = Annotation.Root({
  resource: Annotation<PackageShowResponse['resources'][number]>,
  userQuery: Annotation<string>(),
});

/* MODELS */

// Structured model to evaluate a single resource in the dataset
const structuredModel = openai.withStructuredOutput(ShallowEvaluationSchema);

const structuredSummativeModel = openai.withStructuredOutput(
  ShallowEvaluationSchema
);

/* NODES */

async function setupNode() {
  // We only need a node here so we can fan-out in the edge.
  return {};
}

/**
 * Evaluates a single resource in the dataset, extracting metadata and determining if it's compatible with the tools we have access to.
 */
async function evaluateResourceNode(
  state: typeof ResourceEvaluationAnnotation.State
) {
  const { resource, userQuery } = state;

  console.log('🔍 [SHALLOW EVAL] Evaluating resource...', resource.name);

  const prompt =
    await DATA_GOV_SHALLOW_EVAL_SINGLE_RESOURCE_PROMPT.formatMessages({
      resource: JSON.stringify(resource),
      userQuery,
    });

  const evaluation = await structuredModel.invoke(prompt);

  // Use the key of the outer graph to add to the core state.
  return { resourceEvaluations: evaluation };
}

async function summativeEvaluationNode(
  state: typeof ShallowSearchAnnotation.State
) {
  const { resourceEvaluations, userQuery } = state;

  const prompt = await DATA_GOV_SHALLOW_EVAL_SUMMATIVE_PROMPT.formatMessages({
    resourceEvaluations: JSON.stringify(resourceEvaluations),
    userQuery,
  });

  const evaluation = await structuredSummativeModel.invoke(prompt);

  console.log('🔍 [SHALLOW EVAL] Exiting workflow');
  return { evaluation };
}

/* EDGES */

async function fanOutEdge(state: typeof ShallowSearchAnnotation.State) {
  const {
    dataset: { resources },
  } = state;

  if (!resources) {
    console.log('🔍 [SHALLOW EVAL] No resources found - exiting workflow');
    return END;
  }

  return resources.map(
    resource => new Send('eval', { resource, userQuery: state.userQuery })
  );
}

const graph = new StateGraph(ShallowSearchAnnotation)
  .addNode('setup', setupNode)
  .addNode('eval', evaluateResourceNode)
  .addNode('summary', summativeEvaluationNode)

  .addEdge(START, 'setup')
  .addConditionalEdges('setup', fanOutEdge, ['eval', END])
  .addEdge('eval', 'summary')
  .addEdge('summary', END)

  .compile();

export default graph;
