import { MessagesAnnotation, StateGraph } from '@langchain/langgraph';
import { ToolNode } from 'langchain';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import {
  packageSearch,
  packageShow,
  doiView,
  datasetDownload,
  datasetEvaluation,
} from '../tools';
import { openai } from '../llms';

// Extended state to track data-gov specific information
type DataGovState = typeof MessagesAnnotation.State & {
  selectedDataset?: unknown;
  userQuery?: string;
};

// Set up tool calling
const tools = [
  packageSearch,
  packageShow,
  doiView,
  datasetDownload,
  datasetEvaluation,
];

const llmWithTools = openai.bindTools(tools);

// Entry node - extracts user query once
async function extractUserQueryNode(state: DataGovState) {
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

// Main LLM node that can access all dataset-finding tools
async function datasetFindingNode(state: DataGovState) {
  const result = await llmWithTools.invoke([
    {
      role: 'system',
      content: `You are a data.gov assistant that helps users find and evaluate datasets from the U.S. government's open data portal.

Available tools:
- packageSearch: Search for datasets using keywords
- packageShow: Get detailed metadata for a specific dataset
- doiView: View DOI information if available
- datasetDownload: Download and preview dataset (first 100 rows)
- datasetEvaluation: Evaluate if a dataset is suitable for the user's query

Your workflow:
1. Search for datasets matching the user's query using packageSearch
2. Get detailed information about promising candidates using packageShow
3. View DOI information if available using doiView
4. Download and preview the dataset using datasetDownload
5. Evaluate if it's suitable for the user's needs using datasetEvaluation
6. If suitable, provide a clear summary and mark it as selected
7. If not suitable, search for alternatives or explain why

When you find a suitable dataset, provide a clear summary with:
- Dataset title and description
- Organization that published it
- Last modified date
- Available resources and download links
- Why it's suitable for the user's query

Be thorough in your evaluation and helpful in your explanations.`,
    },
    ...state.messages,
  ]);

  return {
    ...state,
    messages: [result],
  };
}

// Tool node for executing tool calls
const toolNode = new ToolNode(tools);

// Final result node (for now, just returns the selected dataset)
async function finalResultNode(state: DataGovState) {
  const messages = state.messages;
  const lastMessage = messages.at(-1);

  return {
    ...state,
    selectedDataset: lastMessage?.content || null,
    messages: [
      ...messages,
      {
        role: 'assistant',
        content:
          'Dataset selection complete. Here are the results from your search.',
      },
    ],
  };
}

// Simple conditional edge function
function shouldContinue(state: DataGovState) {
  const messages = state.messages;
  const lastMessage = messages.at(-1) as AIMessage;

  // If the LLM makes a tool call, execute the tool
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return 'toolNode';
  }

  // If the LLM has finished and provided a result, move to final result
  if (
    lastMessage.content &&
    typeof lastMessage.content === 'string' &&
    lastMessage.content.includes('✅ Selected dataset:')
  ) {
    return 'finalResult';
  }

  // Otherwise, return to the LLM
  return 'llmNode';
}

// Build the data-gov agent workflow
const dataGovAgent = new StateGraph(MessagesAnnotation)
  .addNode('extractQuery', extractUserQueryNode)
  .addNode('llmNode', datasetFindingNode)
  .addNode('toolNode', toolNode)
  .addNode('finalResult', finalResultNode)

  // Add edges
  .addEdge('__start__', 'extractQuery')
  .addEdge('extractQuery', 'llmNode')
  .addConditionalEdges('llmNode', shouldContinue, [
    'toolNode',
    'finalResult',
    'llmNode',
  ])
  .addEdge('toolNode', 'llmNode')
  .addEdge('finalResult', '__end__')

  .compile();

export default dataGovAgent;
