import {
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
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
  selectedDataset?: {
    id: string;
    title: string;
    reason: string;
    organization?: string;
    lastModified?: string;
    resourceCount?: number;
    downloadUrl?: string;
  };
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
async function setupNode(state: DataGovState) {
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
6. If suitable, finalize your choice and end the process
7. If not suitable, search for alternatives or explain why

IMPORTANT: When you find a suitable dataset, provide some explanation of why it's suitable for the user's query.

Be thorough in your evaluation and helpful in your explanations.`,
    },
    ...state.messages,
  ]);

  return {
    ...state,
    messages: [result],
  };
}

// Final result node - returns the selected dataset
async function finalResultNode(state: DataGovState) {
  const messages = state.messages;
  const selectedDataset = state.selectedDataset;

  console.log('🎯 Final Result Node - Processing final result...');

  if (!selectedDataset) {
    return {
      ...state,
      messages: [
        ...messages,
        {
          role: 'assistant',
          content:
            "No suitable dataset was found for your query. Please try a different search term or be more specific about what you're looking for.",
        },
      ],
    };
  }

  const finalMessage = `✅ **Selected Dataset: ${selectedDataset.title}**

📊 **Organization:** ${selectedDataset.organization || 'Unknown'}
📅 **Last Modified:** ${selectedDataset.lastModified || 'Unknown'}
📋 **Resources:** ${selectedDataset.resourceCount || 0} available
🔗 **Download:** ${selectedDataset.downloadUrl || 'No URL available'}

**Why this dataset is suitable for your query:**
${selectedDataset.reason}

You can access this dataset and start using it for your analysis.`;

  return {
    ...state,
    messages: [
      ...messages,
      {
        role: 'assistant',
        content: finalMessage,
      },
    ],
  };
}

// Simple conditional edge function
function shouldContinue(state: DataGovState) {
  // If we have a selected dataset in state, move to final result
  if (state.selectedDataset) {
    return 'finalResult';
  }

  // Otherwise, return to the LLM
  return 'llmNode';
}

// Build the data-gov agent workflow
const dataGovAgent = new StateGraph(MessagesAnnotation)
  .addNode('setup', setupNode)
  .addNode('llmNode', datasetFindingNode)
  .addNode('finalResult', finalResultNode)

  // Add edges
  .addEdge(START, 'setup')
  .addEdge('setup', 'llmNode')
  .addConditionalEdges('llmNode', shouldContinue, ['finalResult', 'llmNode'])
  .addEdge('finalResult', END)

  .compile();

export default dataGovAgent;
