import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { PendingResource } from '@agents/eval-agent/annotations';
import { openai } from '@llms';
import { z } from 'zod';
import {
  DATA_GOV_DEEP_EVAL_SINGLE_RESOURCE_PROMPT,
  DATA_GOV_SHALLOW_EVAL_SINGLE_RESOURCE_PROMPT,
} from './prompts';
import { datasetDownload, doiView } from '@tools';
import { ResourceEvaluationSchema, ResourceEvaluation } from './annotations';

/* ANNOTATIONS */

export const ResourceEvaluationAnnotation = Annotation.Root({
  resource: Annotation<PendingResource>,
  userQuery: Annotation<string>(),

  shouldPerformDeepEval: Annotation<boolean>(),
  evaluation: Annotation<ResourceEvaluation>,
});

/* MODELS */

const structuredModel = openai.withStructuredOutput(
  z.object({
    worthInvestigating: z.boolean(),
    reasoning: z.string(),
  })
);

const structuredDeepEvalModel = openai.withStructuredOutput(
  ResourceEvaluationSchema
);

/* NODES */

/**
 * Performs a very shallow evaluation of a single resource:
 * "Based on the title of the resource, is it worth investigating this resource further?"
 */
async function evaluateResourceNode(
  state: typeof ResourceEvaluationAnnotation.State
) {
  const { resource, userQuery } = state;

  const prompt =
    await DATA_GOV_SHALLOW_EVAL_SINGLE_RESOURCE_PROMPT.formatMessages({
      resourceMetadata: JSON.stringify({
        url: resource.url,
        name: resource.name,
        description: resource.description,
      }),
      userQuery,
    });

  const { worthInvestigating, reasoning } =
    await structuredModel.invoke(prompt);

  console.log(
    '🔍 [RESOURCE EVAL] Worth investigating',
    resource.name,
    ': ',
    worthInvestigating,
    reasoning
  );

  // Note in the state if this resource is worth investigating further
  return {
    shouldPerformDeepEval: worthInvestigating,
    // If the resource is not worth investigating, it is not usable
    evaluation: {
      url: resource.url,
      name: resource.name,
      description: resource.description,
      summary: reasoning,
      usable: !worthInvestigating ? false : undefined,
      usability_reason: reasoning,
      columns: [],
    },
  };
}

/**
 * Performs a deeper evaluation of a single resource:
 * "Given a peek at the dataset, is this resource likely to contain a factual, concrete answer to the user's question?"
 *
 * "If so, what drawbacks might it have? If so, what added context about the columns might be needed, or useful?"
 * "If so, what reasons might it have for being a good fit?"
 *
 * "If no, return no."
 */
async function deepEvalNode(state: typeof ResourceEvaluationAnnotation.State) {
  const { resource, userQuery } = state;

  // Extract preview of resource
  let preview = null;
  if (resource.format === 'CSV') {
    const { preview: datasetPreview } = await datasetDownload.invoke({
      resourceUrl: resource.url,
      limit: 5,
      offset: 0,
    });
    preview = datasetPreview?.join('\n') ?? null;
  } else if (resource.format === 'DOI') {
    const {
      doi_info: doiPreview,
      success,
      error,
    } = await doiView.invoke({
      doi: resource.url,
    });
    if (success && doiPreview) {
      preview = doiPreview;
    } else {
      throw new Error(`[DEEP EVAL] Failed to fetch DOI info: ${error}`);
    }
  }

  preview = preview?.slice(0, 1000); // safety: prevent token explosion

  const prompt = await DATA_GOV_DEEP_EVAL_SINGLE_RESOURCE_PROMPT.formatMessages(
    {
      userQuery,
      resourceDescription: resource.description,
      resourceName: resource.name,
      resourcePreview: resource.format === 'CSV' ? null : preview,
      datasetNotes: resource.description,
      rowPreview: resource.format === 'CSV' ? preview : null,
    }
  );

  console.log('🔍 [DEEP EVAL] Performing deep evaluation on', resource.name);

  const deidentifiedEvaluation = await structuredDeepEvalModel.invoke(prompt);

  const evaluation = {
    url: resource.url,
    name: resource.name,
    description: resource.description,
    ...deidentifiedEvaluation,
  };

  return { evaluation };
}

/* EDGES */

async function shouldPerformDeepEvalEdge(
  state: typeof ResourceEvaluationAnnotation.State
) {
  const { shouldPerformDeepEval } = state;
  return shouldPerformDeepEval ? 'deepEval' : END;
}

/* GRAPH */

const graph = new StateGraph(ResourceEvaluationAnnotation)
  .addNode('evaluateResource', evaluateResourceNode)
  .addNode('deepEval', deepEvalNode)

  .addEdge(START, 'evaluateResource')
  .addConditionalEdges('evaluateResource', shouldPerformDeepEvalEdge, [
    'deepEval',
    END,
  ])
  .addEdge('deepEval', END)

  .compile();

export default graph;
