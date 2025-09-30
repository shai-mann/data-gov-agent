import {
  Annotation,
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph';
import {
  DATA_GOV_EVALUATE_DATASET_PROMPT,
  DATA_GOV_EVALUATE_OUTPUT_PROMPT,
  DATA_GOV_EVALUATE_REMINDER_PROMPT,
} from '../lib/prompts';
import {
  DatasetWithEvaluation,
  DatasetWithEvaluationSchema,
} from '../lib/annotation';
import { openai } from '../llms';
import { datasetDownload, doiView, packageShow } from '../tools';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { AIMessage } from '@langchain/core/messages';

// State annotation for the dataset evaluation workflow
const DatasetEvalAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  dataset: Annotation<DatasetWithEvaluation>,
  userQuery: Annotation<string>,
});

const tools = [packageShow, datasetDownload, doiView];

const model = openai.bindTools(tools);
const structuredModel = openai.withStructuredOutput(
  DatasetWithEvaluationSchema
);

/* DATASET EVALUATION WORKFLOW */

async function setupNode(state: typeof DatasetEvalAnnotation.State) {
  const { dataset, userQuery } = state;

  console.log('🔍 [EVAL] Initializing...');

  const prompt = await DATA_GOV_EVALUATE_DATASET_PROMPT.formatMessages({
    query: userQuery,
    datasetId: dataset.id,
    datasetTitle: dataset.title,
    datasetReason: dataset.reason,
  });

  return {
    messages: prompt,
  };
}

// Core evaluation prompt (evaluates a single dataset in the context of the user query)
async function modelNode(state: typeof DatasetEvalAnnotation.State) {
  console.log('🔍 [EVAL] Evaluating...');

  const reminderPrompt = await DATA_GOV_EVALUATE_REMINDER_PROMPT.formatMessages(
    {}
  );

  const result = await model.invoke([...state.messages, ...reminderPrompt]);

  return {
    messages: result,
  };
}

async function outputNode(state: typeof DatasetEvalAnnotation.State) {
  console.log('🔍 [EVAL] Structuring output...');

  const { messages, dataset } = state;
  const lastMessage = messages.at(-1) as AIMessage;

  const prompt = await DATA_GOV_EVALUATE_OUTPUT_PROMPT.formatMessages({
    datasetId: dataset.id,
    datasetTitle: dataset.title,
    datasetReason: dataset.reason,
    evaluation: lastMessage.content as string,
  });

  const response = await structuredModel.invoke(prompt);

  if (!response.evaluation?.usable) {
    return {
      dataset: response,
    };
  }

  let cleanedBestResource = response.evaluation?.bestResource;

  // Check and see if it was returned in MD format: [Title](link)
  if (cleanedBestResource.includes('(')) {
    cleanedBestResource = cleanedBestResource.split('(')[1];
  }

  const massagedEvaluation = {
    ...response,
    evaluation: {
      ...response.evaluation,
      bestResource: cleanedBestResource,
    },
  };

  return {
    dataset: massagedEvaluation,
  };
}

function shouldContinue(state: typeof DatasetEvalAnnotation.State) {
  const messages = state.messages;
  const lastMessage = messages.at(-1) as AIMessage;

  if (
    'tool_calls' in lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls?.length
  ) {
    return 'toolNode';
  }

  console.log('🔍 [EVAL] Exiting workflow');
  return 'output';
}

const graph = new StateGraph(DatasetEvalAnnotation)
  .addNode('setup', setupNode)
  .addNode('model', modelNode)
  .addNode('toolNode', new ToolNode(tools))
  .addNode('output', outputNode)

  .addEdge(START, 'setup')
  .addEdge('setup', 'model')
  .addConditionalEdges('model', shouldContinue, ['toolNode', 'output'])
  .addEdge('toolNode', 'model')
  .addEdge('output', END)
  .compile();

export default graph;
