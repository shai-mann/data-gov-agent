import {
  Annotation,
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph';
import {
  DATA_GOV_EVALUATE_DATASET_PROMPT,
  DATA_GOV_EVALUATE_REMINDER_PROMPT,
} from '../lib/prompts';
import { DatasetSelection } from '../lib/annotation';
import { openai } from '../llms';
import { datasetDownload, doiView, packageShow } from '../tools';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { AIMessage } from '@langchain/core/messages';

// State annotation for the dataset evaluation workflow
const DatasetEvalAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  dataset: Annotation<DatasetSelection>,
  userQuery: Annotation<string>,
});

const tools = [packageShow, datasetDownload, doiView];

const model = openai.bindTools(tools);

/* DATASET EVALUATION WORKFLOW */

async function setupNode(state: typeof DatasetEvalAnnotation.State) {
  const { dataset, userQuery } = state;

  console.log('🔍 Setting up initial state...');

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
  console.log('🔍 Calling model...');

  const reminderPrompt = await DATA_GOV_EVALUATE_REMINDER_PROMPT.formatMessages(
    {}
  );

  const result = await model.invoke([...state.messages, ...reminderPrompt]);

  return {
    messages: result,
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

  console.log('🔍 Exiting workflow');
  return END;
}

const graph = new StateGraph(DatasetEvalAnnotation)
  .addNode('setup', setupNode)
  .addNode('model', modelNode)
  .addNode('toolNode', new ToolNode(tools))

  .addEdge(START, 'setup')
  .addEdge('setup', 'model')
  .addConditionalEdges('model', shouldContinue, ['toolNode', END])
  .addEdge('toolNode', 'model')
  .compile();

export default graph;
