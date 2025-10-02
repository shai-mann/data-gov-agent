import { Annotation, END, Send, START, StateGraph } from '@langchain/langgraph';
import { openai } from '@llms';
import { PendingResource, DatasetSummary, SummarySchema } from './annotations';
import { PackageShowResponse } from '@lib/data-gov.schemas';
import {
  DATA_GOV_SHALLOW_EVAL_SUMMATIVE_PROMPT,
  EVAL_DATASET_PROMPT,
} from './prompts';
import { VALID_DATASET_FORMATS } from '@tools/datasetDownload';
import { ResourceEvaluationAnnotation } from '../resource-eval-agent/resourceEvalAgent';
import { resourceEvalAgent } from '..';
import { ResourceEvaluation } from '../resource-eval-agent/annotations';
import { z } from 'zod';

/**
 * This agent is a evaluation helper agent for the core Search Agent.
 * It's used to evaluate a single dataset that the search agent finds, and determine if it's likely to answer the user's question.
 */

// Simple type to join the resource evaluation with the resource itself
type ResourceWithEvaluation = ResourceEvaluation & PendingResource;

/* ANNOTATIONS */

const DatasetEvalAnnotation = Annotation.Root({
  userQuery: Annotation<string>(),
  dataset: Annotation<PackageShowResponse>,

  shouldInvestigateResources: Annotation<boolean>(),
  pendingResources: Annotation<PendingResource[]>,
  evaluations: Annotation<ResourceWithEvaluation[]>({
    reducer: (cur, val) => cur.concat(val),
    default: () => [],
  }),
  summary: Annotation<DatasetSummary>,
  connectionId: Annotation<string | undefined>(),
});

/* MODELS */

const structuredModel = openai.withStructuredOutput(
  z.object({
    relevant: z
      .boolean()
      .describe("Whether the dataset is relevant to the user's question"),
  })
);

const structuredSummativeModel = openai.withStructuredOutput(SummarySchema);

/* UTILS */

function getFormat(resource: { format: string; mimetype: string | null }) {
  // If both are empty (or null), format is invalid.
  if (!resource.format && !resource.mimetype) {
    return 'INVALID';
  }

  // Construct an uppercase list of types, excluding nulls and empty strings
  const types = (
    [resource.format, resource.mimetype].filter(Boolean) as string[]
  ).map(t => t.toUpperCase());

  return (
    VALID_DATASET_FORMATS.find(f => types.some(t => f.includes(t))) ?? 'INVALID'
  );
}

/* NODES */

async function setupNode(state: typeof DatasetEvalAnnotation.State) {
  const { dataset } = state;

  // Extract all VALID resources, including their format, name, and URL
  const resources = dataset.resources
    .map(resource => ({
      url: resource.url,
      name: resource.name,
      description: resource.description,
      format: getFormat(resource),
    }))
    // Filter out resources that are not in the valid formats
    .filter(r => r.format !== 'INVALID');

  // Regardless of if there are extras, if no resources are valid, we can't use this dataset.
  // Extras will never be datasets, so there must be at least one valid resource to warrant further investigation.
  if (resources.length === 0) {
    return {
      pendingResources: [],
    };
  }

  // Extract any VALID extra links
  const extras = dataset.extras
    // Filter out non-string values
    .filter(extra => typeof extra.value === 'string')
    // Filter to links
    .filter(extra => (extra.value as string).includes('http'))
    // Map to pending resources format
    .map(extra => ({
      url: extra.value,
      name: extra.key,
      description: null,
      format:
        VALID_DATASET_FORMATS.find(f =>
          extra.value.toLowerCase().includes(f.toLowerCase())
        ) ?? 'INVALID',
    }))
    // Filter out invalid formats
    .filter(r => r.format !== 'INVALID');

  const pendingResources = [...resources, ...extras];

  return { pendingResources };
}

async function datasetEvalNode(state: typeof DatasetEvalAnnotation.State) {
  const { dataset, userQuery } = state;

  const prompt = await EVAL_DATASET_PROMPT.formatMessages({
    userQuery,
    datasetMetadata: JSON.stringify({
      name: dataset.name,
      description: dataset.notes,
      title: dataset.title,
      type: dataset.type,
      state: dataset.state,
      // Skip resources, as they will be evaluated individually
    }),
  });

  const { relevant } = await structuredModel.invoke(prompt);

  if (!relevant) {
    console.log(
      "🔍 [DATASET EVAL] Dataset is not relevant to the user's question",
      dataset.name
    );
  }

  return { shouldInvestigateResources: relevant };
}

async function resourceEvalNode(
  state: typeof ResourceEvaluationAnnotation.State
) {
  const { resource, userQuery, datasetName } = state;

  // Call the per-resource eval-agent
  const { evaluation } = await resourceEvalAgent.invoke({
    datasetName,
    resource,
    userQuery,
  });

  if (!evaluation.usable) {
    // If it is unusable, don't add it to the evaluations state. It will not be used from there.
    return {};
  }

  // Knit resource together with evaluation and add it to the (outer) state.
  return {
    evaluations: { ...evaluation, ...resource },
  };
}

async function summativeEvaluationNode(
  state: typeof DatasetEvalAnnotation.State
) {
  const { evaluations, userQuery } = state;

  if (evaluations.length === 0) {
    return {};
  }

  const prompt = await DATA_GOV_SHALLOW_EVAL_SUMMATIVE_PROMPT.formatMessages({
    resourceEvaluations: evaluations.map(e => JSON.stringify(e)).join('\n\n'),
    userQuery,
  });

  const summary = await structuredSummativeModel.invoke(prompt);

  return { summary };
}

/* EDGES */

function shouldContinueToResourceEval(
  state: typeof DatasetEvalAnnotation.State
) {
  const {
    shouldInvestigateResources,
    pendingResources: resources,
    userQuery,
    dataset,
  } = state;

  if (!shouldInvestigateResources || resources.length === 0) {
    return END;
  }

  return resources.map(
    resource =>
      new Send('resourceEval', {
        resource,
        userQuery,
        datasetName: dataset.name,
      })
  );
}

const graph = new StateGraph(DatasetEvalAnnotation)
  .addNode('setup', setupNode)
  .addNode('datasetEval', datasetEvalNode)
  .addNode('resourceEval', resourceEvalNode)
  .addNode('formatEval', summativeEvaluationNode, { defer: true })

  .addEdge(START, 'setup')
  .addEdge('setup', 'datasetEval')
  .addConditionalEdges('datasetEval', shouldContinueToResourceEval, [
    'resourceEval',
    END,
  ])
  .addEdge('resourceEval', 'formatEval')
  .addEdge('formatEval', END)

  .compile();

export default graph;
