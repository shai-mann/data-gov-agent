import {
  Annotation,
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { isAIMessage, isToolMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { packageSearch, packageNameSearch, selectDataset } from '../tools';
import { openai } from '../llms';
import {
  DATA_GOV_REMINDER_PROMPT,
  DATA_GOV_SEARCH_PROMPT,
} from '../lib/prompts';
import { DatasetSelection } from '../lib/annotation';

// It can return with fewer than this (it's asked for 10), but this is a backstop to prevent recursion caps from being hit.
const MAX_REQUESTED_DATASETS = 15;

// State annotation for the dataset selection workflow
const DatasetSearchAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  datasets: Annotation<DatasetSelection[]>({
    reducer: (cur, val) => cur.concat(val),
    default: () => [],
  }),
  userQuery: Annotation<string>(),
});

const tools = [packageSearch, packageNameSearch, selectDataset];

const model = openai.bindTools(tools);

// Entry node - extracts user query before calling the model
async function setupNode(state: typeof DatasetSearchAnnotation.State) {
  const { userQuery } = state;

  if (!userQuery) {
    throw new Error('Must provide a user query');
  }

  console.log('🔍 Initializing dataset searching agent');

  const prompt = await DATA_GOV_SEARCH_PROMPT.formatMessages({
    query: userQuery,
  });

  return {
    messages: prompt,
  };
}

// An LLM node with access to tools to search for datasets by query (including or excluding metadata)
async function modelNode(state: typeof DatasetSearchAnnotation.State) {
  console.log(
    '🔍 Calling model... currently has',
    state.datasets.length,
    'dataset selections'
  );

  const reminderPrompt = await DATA_GOV_REMINDER_PROMPT.formatMessages({
    query: state.userQuery,
    datasetCount: state.datasets.length,
    datasetIds: state.datasets.map(d => d.id).join(', '),
  });

  const result = await model.invoke([...state.messages, ...reminderPrompt]);

  return {
    messages: result,
  };
}

// Middle node to process dataset evaluation results
async function processDatasetSelectionNode(
  state: typeof DatasetSearchAnnotation.State
) {
  console.log('⚖️ Tool post-processing Node - Processing tool results...');
  const { messages } = state;

  // Since it could be a batch of tool calls, we need to find all tool calls since the last AI message
  const lastAiMessageIndex =
    messages
      // find index of last AIMessage
      .map((m, i) => [m, i] as const)
      .filter(([m]) => isAIMessage(m))
      .map(([, i]) => i)
      .pop() ?? -1;

  const toolMessages = messages
    .slice(lastAiMessageIndex + 1)
    .filter(m => isToolMessage(m))
    .filter(m => m.name === 'selectDataset')
    .filter(m => m.content && typeof m.content === 'string')
    .map(m => JSON.parse(m.content as string))
    // Filter out any datasets that already exist in the state
    .filter(m => !state.datasets.some(d => d.id === m.id));

  if (toolMessages.length === 0) {
    console.log('🔍 No selectDataset tool calls found');
    return {};
  }

  console.log(`🔍 Adding ${toolMessages.length} new selections`);

  // Add new selections to the state
  return {
    datasets: toolMessages,
  };
}

// Conditional edge function to route to tools, or exit the search workflow
function shouldContinueToTools(state: typeof DatasetSearchAnnotation.State) {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];

  // If the LLM makes a tool call, go to tool node
  if (
    'tool_calls' in lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls?.length
  ) {
    return 'tools';
  }

  // If no tools were called, the AI is presumed to have found all the datasets it needed to find
  console.log('🔍 Exiting search workflow');
  return END;
}

// Conditional edge to route from post-tools node either to the model or to the end, depending on whether the AI has found enough datasets
function shouldContinueFromPostTools(
  state: typeof DatasetSearchAnnotation.State
) {
  const { datasets } = state;
  if (datasets.length >= MAX_REQUESTED_DATASETS) {
    console.log('🔍 Exiting search workflow - reached max requested datasets');
    return END;
  }
  return 'model';
}

// Build the data-gov agent workflow
const graph = new StateGraph(DatasetSearchAnnotation)
  .addNode('setup', setupNode)
  .addNode('model', modelNode)
  .addNode('tools', new ToolNode(tools))
  .addNode('postTools', processDatasetSelectionNode)

  .addEdge(START, 'setup')
  .addEdge('setup', 'model')
  .addEdge('tools', 'postTools')
  .addConditionalEdges('postTools', shouldContinueFromPostTools, ['model', END])
  .addConditionalEdges('model', shouldContinueToTools, ['tools', END])

  .compile();

export default graph;
