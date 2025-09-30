// This agent is a shallow evaluation helper agent for the core Search Agent.
// It's used to shallowly evaluate a single dataset that the search agent finds, and determine if it's likely to answer the user's question.

import {
  Annotation,
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { openai } from '../llms';
import { ShallowEvaluationSchema } from '../lib/annotation';
import { z } from 'zod';
import { PackageShowResponse } from '../lib/data-gov.schemas';

const ShallowSearchAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  dataset: Annotation<PackageShowResponse>,
  userQuery: Annotation<string>(),
  evaluation: Annotation<z.infer<typeof ShallowEvaluationSchema>>,
});

// Structured model to evaluate a single resource in the dataset
const structuredModel = openai.withStructuredOutput(
  z.object({
    mimeType: z.string().describe('The MIME type of the resource'),
    isCompatible: z
      .boolean()
      .describe(
        'Whether the resource is compatible with the dataset tools we have access to'
      ),
    link: z
      .string()
      .describe(
        'The link to the resource, PRECISELY as it appears in the dataset'
      )
      .optional()
      .nullable(),
    reasoning: z.string(),
  })
);

async function setupNode(state: typeof ShallowSearchAnnotation.State) {
  return {
    evaluation: {
      isCompatible: true,
      link: 'https://data.gov/dataset/1234567890',
      reasoning: 'All resources are compatible',
      mimeType: 'text/csv',
    },
  };
}

async function evaluateResourcesNode(
  state: typeof ShallowSearchAnnotation.State
) {}

const graph = new StateGraph(ShallowSearchAnnotation)
  .addNode('setup', setupNode)

  .addEdge(START, 'setup')
  .addEdge('setup', END)

  .compile();

export default graph;
