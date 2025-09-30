import {
  Annotation,
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { openai } from '../llms';
import { z } from 'zod';
import { CONTEXT_AGENT_INITIAL_PROMPT } from '../lib/prompts';
import { DatasetWithEvaluation } from '../lib/annotation';
import { getPackage } from '../lib/data-gov';
import { doiView } from '../tools/doiView';
import { datasetDownload } from '../tools/datasetDownload';

const URL_REGEX = /(https?:\/\/[^\s"']+)/g;

const ContextAgentAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  dataset: Annotation<DatasetWithEvaluation>, // The dataset being analyzed
  context: Annotation<string[]>, // All context messages for the dataset, set up in the setup node
  summary: Annotation<string>, // Raw text summary output from the model
});

const structuredModel = openai.withStructuredOutput(
  z.object({ summary: z.string() })
);

async function setupNode(state: typeof ContextAgentAnnotation.State) {
  const { dataset } = state;

  if (!dataset.evaluation || !dataset.evaluation.usable === true) {
    throw new Error('[CONTEXT] Dataset is not usable');
  }

  // Typing is being annoying, so I'm doing this to get the type inference to work
  const datasetEvaluation = dataset.evaluation satisfies {
    usable: true;
    bestResource: string;
  };

  console.log('🔍 [CONTEXT] Initializing...');

  // Fetch FULL package metadata
  const { result: packageMetadata, success } = await getPackage(
    state.dataset.id
  );

  if (!success) {
    throw new Error('[CONTEXT] Failed to fetch package metadata');
  }

  // Extract all context links from the package metadata using regex
  const matches = JSON.stringify(packageMetadata).match(URL_REGEX);
  const contextLinks = (matches ? [...new Set(matches)] : []).filter(
    // Filter out the resource we are already using for dataset preview
    link => link !== datasetEvaluation.bestResource
  );

  // Download all context links using doiView tool (to use timeout mechanism in doiView tool)
  const contextLinksInfo = (
    await Promise.allSettled(
      contextLinks.map(link => doiView.invoke({ doi: link }))
    )
  )
    // Filter out any failed results
    .filter(result => result.status === 'fulfilled' && result.value.success)
    .map(
      result =>
        // This is a safe cast because we filtered out any failed results
        (
          result as PromiseFulfilledResult<{
            success: boolean;
            doi_info: string;
          }>
        ).value.doi_info
    );

  // Fetch sample dataset rows
  const { preview: sampleRows, success: sampleRowsSuccess } =
    await datasetDownload.invoke({
      resourceUrl: datasetEvaluation.bestResource,
      limit: 20,
      offset: 0,
    });

  if (!sampleRowsSuccess || !sampleRows) {
    throw new Error('[CONTEXT] Failed to fetch sample dataset rows');
  }

  // Construct the prompt for the model
  const prompt = await CONTEXT_AGENT_INITIAL_PROMPT.formatMessages({
    packageMetadata: JSON.stringify(packageMetadata),
    sampleRows: sampleRows.join('\n'),
    resourceText: contextLinksInfo.join('\n\n'),
  });

  return {
    messages: prompt,
  };
}

// Core evaluation prompt (evaluates a single dataset in the context of the user query)
async function modelNode(state: typeof ContextAgentAnnotation.State) {
  console.log('🔍 [CONTEXT] Providing context...');

  const { summary } = await structuredModel.invoke(state.messages);

  return {
    summary,
  };
}

const graph = new StateGraph(ContextAgentAnnotation)
  .addNode('setup', setupNode)
  .addNode('model', modelNode)

  .addEdge(START, 'setup')
  .addEdge('setup', 'model')
  .addEdge('model', END)

  .compile();

export default graph;
