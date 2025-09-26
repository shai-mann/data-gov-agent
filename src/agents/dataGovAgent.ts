import {
  Annotation,
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import {
  packageSearch,
  packageShow,
  doiView,
  datasetDownload,
  packageNameSearch,
} from '../tools';
import { openai } from '../llms';
import { DatasetSelections, DatasetSelectionSchema } from '../lib/annotation';
import {
  DATA_GOV_REMINDER_PROMPT,
  DATA_GOV_SEARCH_PROMPT,
  PARSE_DATASET_PROMPT,
} from '../lib/prompts';

// Define the state annotation of this agent's graph
const DataGovAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  datasetSelections: Annotation<DatasetSelections['datasets']>({
    reducer: (cur, val) => cur.concat(val),
    default: () => [],
  }),
  userQuery: Annotation<string>(),
});

// Set up tool calling
const searchTools = [packageSearch, packageNameSearch];
const evaluateTools = [packageShow, doiView, datasetDownload];

const searchModel = openai.bindTools(searchTools);
const evaluateModel = openai.bindTools(evaluateTools);

// Create structured output LLM for parsing node
const parserModel = openai.withStructuredOutput(DatasetSelectionSchema);

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
  console.log('🔍 Calling model...');

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

// Structured parsing node - extracts dataset info using structured output
async function parseDatasetNode(state: typeof DataGovAnnotation.State) {
  console.log('📋 Parse Dataset Node - Extracting structured dataset info...');

  const result = await parserModel.invoke([
    ...(await PARSE_DATASET_PROMPT.formatMessages({})),
    ...state.messages,
  ]);

  console.log('🔍 Parse Dataset Node - Result:', result);

  return {
    datasetSelections: result.datasets satisfies DatasetSelections['datasets'],
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
  return 'parseDataset';
}

// Build the data-gov agent workflow
const dataGovAgent = new StateGraph(DataGovAnnotation)
  .addNode('setup', setupNode)
  .addNode('searchNode', searchModelNode)
  .addNode('searchTools', new ToolNode(searchTools))
  .addNode('parseDataset', parseDatasetNode)

  .addEdge(START, 'setup')
  .addEdge('setup', 'searchNode')
  .addEdge('searchTools', 'searchNode')
  .addConditionalEdges('searchNode', shouldContinue, [
    'searchTools',
    'parseDataset',
  ])
  .addEdge('parseDataset', END)

  .compile();

export default dataGovAgent;
