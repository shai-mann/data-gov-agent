import {
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { ToolNode } from 'langchain';
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
const toolNode = new ToolNode(tools);

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
async function llmNode(state: DataGovState) {
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
6. If suitable, respond with "DATASET_SELECTED:" followed by the dataset details in this exact format:
   DATASET_SELECTED: {
     "id": "dataset_id",
     "title": "Dataset Title",
     "reason": "Explanation of why this dataset is suitable",
     "organization": "Organization Name",
     "lastModified": "2024-01-01",
     "resourceCount": 5,
     "downloadUrl": "https://example.com/download"
   }
7. If not suitable, search for alternatives or explain why

IMPORTANT: Only use the DATASET_SELECTED format when you are confident the dataset meets the user's needs.

Be thorough in your evaluation and helpful in your explanations.`,
    },
    ...state.messages,
  ]);

  return {
    messages: [result],
  };
}

// Final result node - parses the selected dataset from the LLM response
async function finalResultNode(state: DataGovState) {
  const messages = state.messages;
  const lastMessage = messages.at(-1) as AIMessage;

  console.log('🎯 Final Result Node - Processing final result...');

  // Parse the dataset selection from the LLM response
  let selectedDataset = null;
  if (lastMessage.content && typeof lastMessage.content === 'string') {
    const content = lastMessage.content;
    const datasetMatch = content.match(/DATASET_SELECTED:\s*({[\s\S]*?})/);
    if (datasetMatch) {
      try {
        selectedDataset = JSON.parse(datasetMatch[1]);
        console.log('🎯 Parsed selected dataset:', selectedDataset);
      } catch (error) {
        console.error('❌ Failed to parse dataset JSON:', error);
      }
    }
  }

  if (!selectedDataset) {
    return {
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
    messages: [
      ...messages,
      {
        role: 'assistant',
        content: finalMessage,
      },
    ],
    selectedDataset,
  };
}

// Conditional edge function to route to tools, final result, or continue LLM loop
function shouldContinue(state: DataGovState) {
  const messages = state.messages;
  const lastMessage = messages.at(-1) as AIMessage;

  // If the LLM makes a tool call, go to tool node
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return 'toolNode';
  }

  // Check if the LLM has selected a dataset
  if (lastMessage.content && typeof lastMessage.content === 'string') {
    if (lastMessage.content.includes('DATASET_SELECTED:')) {
      return 'finalResult';
    }
  }

  // Otherwise, continue the LLM loop
  return 'llmNode';
}

// Build the data-gov agent workflow
const dataGovAgent = new StateGraph(MessagesAnnotation)
  .addNode('setup', setupNode)
  .addNode('llmNode', llmNode)
  .addNode('toolNode', toolNode)
  .addNode('finalResult', finalResultNode)

  // Add edges
  .addEdge(START, 'setup')
  .addEdge('setup', 'llmNode')
  .addConditionalEdges('llmNode', shouldContinue, [
    'toolNode',
    'llmNode',
    'finalResult',
  ])
  .addEdge('toolNode', 'llmNode')
  .addEdge('finalResult', END)

  .compile();

export default dataGovAgent;
