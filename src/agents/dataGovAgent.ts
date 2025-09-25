import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { ToolNode } from 'langchain';
import { packageSearch, packageShow, doiView, datasetDownload } from '../tools';
import { openai } from '../llms';
import { DatasetSelection, DatasetSelectionSchema } from '../lib/annotation';
import { DATA_GOV_PROMPT, PARSE_DATASET_PROMPT } from '../lib/prompts';

// Define the state annotation of this agent's graph
const DataGovAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (cur, val) => cur.concat(val),
    default: () => [],
  }),
  selectedDataset: Annotation<DatasetSelection>(),
  userQuery: Annotation<string>(),
});

// Set up tool calling
const tools = [packageSearch, packageShow, doiView, datasetDownload];

const llmWithTools = openai.bindTools(tools);

// Create structured output LLM for parsing node
const llmWithStructuredOutput = openai.withStructuredOutput(
  DatasetSelectionSchema
);

// Entry node - extracts user query before calling the model
async function setupNode(state: typeof DataGovAnnotation.State) {
  const messages = state.messages;
  const lastMessage = messages.at(-1);

  if (!lastMessage || !(lastMessage instanceof HumanMessage)) {
    throw new Error('No user message found for dataset finding');
  }

  return {
    ...state,
    userQuery: lastMessage.content as string,
  };
}

// Main LLM node that performs the dataset-finding workflow
async function callModel(state: typeof DataGovAnnotation.State) {
  console.log('🔍 Calling model...', state.userQuery);
  const result = await llmWithTools.invoke([
    ...(await DATA_GOV_PROMPT.formatMessages({ input: state.userQuery })),
    ...state.messages,
  ]);

  return {
    messages: [result],
  };
}

// Structured parsing node - extracts dataset info using structured output
async function parseDatasetNode(state: typeof DataGovAnnotation.State) {
  console.log('📋 Parse Dataset Node - Extracting structured dataset info...');

  const summaryMessage = state.messages.at(-1)?.content as string;

  const result = await llmWithStructuredOutput.invoke([
    ...(await PARSE_DATASET_PROMPT.formatMessages({ summaryMessage })),
  ]);

  console.log('📋 Parsed dataset:', result);

  return {
    selectedDataset: result,
  };
}

// Conditional edge function to route to tools, parsing, or continue LLM loop
function shouldContinue(state: typeof DataGovAnnotation.State) {
  const messages = state.messages;
  const lastMessage = messages.at(-1) as AIMessage;

  // If the LLM makes a tool call, go to tool node
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return 'toolNode';
  }

  // If no tools were called, the AI is presumed to have found a dataset
  return 'parseDataset';
}

// Build the data-gov agent workflow
const dataGovAgent = new StateGraph(DataGovAnnotation)
  .addNode('setup', setupNode)
  .addNode('callModel', callModel)
  .addNode('toolNode', new ToolNode(tools))
  .addNode('parseDataset', parseDatasetNode)

  .addEdge(START, 'setup')
  .addEdge('setup', 'callModel')
  .addEdge('toolNode', 'callModel')
  .addConditionalEdges('callModel', shouldContinue, [
    'toolNode',
    'parseDataset',
  ])
  .addEdge('parseDataset', END)

  .compile();

export default dataGovAgent;
