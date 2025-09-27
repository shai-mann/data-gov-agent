import {
  Annotation,
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph';
import {
  HumanMessage,
  isAIMessage,
  isToolMessage,
} from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { packageSearch, packageNameSearch, selectDataset } from '../tools';
import { openai } from '../llms';
import {
  DATA_GOV_REMINDER_PROMPT,
  DATA_GOV_SEARCH_PROMPT,
} from '../lib/prompts';
import { DatasetSelection } from '../lib/annotation';

// State annotation for the dataset selection workflow
const DataGovAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  datasetSelections: Annotation<DatasetSelection[]>({
    reducer: (cur, val) => cur.concat(val),
    default: () => [],
  }),
  userQuery: Annotation<string>(),
});

const searchTools = [packageSearch, packageNameSearch, selectDataset];

const searchModel = openai.bindTools(searchTools);

/* DATASET SELECTION WORKFLOW */

// Entry node - extracts user query before calling the model
async function setupNode(state: typeof DataGovAnnotation.State) {
  const messages = state.messages;
  const lastMessage = messages.at(-1);

  if (!lastMessage || !(lastMessage instanceof HumanMessage)) {
    throw new Error('No user message found for dataset finding');
  }

  const prompt = await DATA_GOV_SEARCH_PROMPT.formatMessages({
    query: lastMessage.content as string,
  });

  return {
    messages: prompt,
    userQuery: lastMessage.content as string,
  };
}

// An LLM node with access to tools to search for datasets by query (including or excluding metadata)
async function searchModelNode(state: typeof DataGovAnnotation.State) {
  console.log(
    '🔍 Calling model... currently has',
    state.datasetSelections.length,
    'dataset selections'
  );

  const reminderPrompt = await DATA_GOV_REMINDER_PROMPT.formatMessages({
    query: state.userQuery,
    datasetCount: state.datasetSelections.length,
  });

  const result = await searchModel.invoke([
    ...state.messages,
    ...reminderPrompt,
  ]);

  return {
    messages: result,
  };
}

// Middle node to process dataset evaluation results
async function processDatasetSelectionNode(
  state: typeof DataGovAnnotation.State
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
    .map(m => JSON.parse(m.content as string));

  if (toolMessages.length === 0) {
    console.log('🔍 No selectDataset tool calls found');
    return {};
  }

  console.log(`🔍 Adding ${toolMessages.length} new selections`);

  // Add new selections to the state
  return {
    // TODO: can I just return the toolMessages, since I have a reducer to concat?
    datasetSelections: [...state.datasetSelections, ...toolMessages],
  };
}

// Conditional edge function to route to tools, parsing, or continue LLM loop
function shouldContinue(state: typeof DataGovAnnotation.State) {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];

  // If the LLM makes a tool call, go to tool node
  if (
    'tool_calls' in lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls?.length
  ) {
    return 'searchTools';
  }

  // If no tools were called, the AI is presumed to have found all the datasets it needed to find
  console.log('🔍 Exiting workflow');
  return END;
}

// Build the data-gov agent workflow
const dataGovAgent = new StateGraph(DataGovAnnotation)
  .addNode('setup', setupNode)
  .addNode('searchNode', searchModelNode)
  .addNode('searchTools', new ToolNode(searchTools))
  .addNode('processDatasetSelection', processDatasetSelectionNode)

  .addEdge(START, 'setup')
  .addEdge('setup', 'searchNode')
  .addEdge('searchTools', 'processDatasetSelection')
  .addEdge('processDatasetSelection', 'searchNode')
  .addConditionalEdges('searchNode', shouldContinue, ['searchTools', END])

  .compile();

export default dataGovAgent;
