import {
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { ToolNode } from 'langchain';
import { z } from 'zod';
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

// Schema for structured dataset selection
const DatasetSelectionSchema = z.object({
  id: z.string().describe('The ID of the selected dataset'),
  title: z.string().describe('The title of the selected dataset'),
  reason: z
    .string()
    .describe(
      "Explanation of why this dataset is suitable for the user's query"
    ),
  organization: z
    .string()
    .describe('The organization that published the dataset'),
  lastModified: z.string().describe('When the dataset was last modified'),
  resourceCount: z.number().describe('Number of resources in the dataset'),
  downloadUrl: z.string().describe('URL to download the dataset'),
});

const llmWithStructuredOutput = openai.withStructuredOutput(
  DatasetSelectionSchema
);

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
6. If suitable, respond with EXACTLY the text "READY_TO_SELECT_DATASET" and nothing else
7. If not suitable, search for alternatives or explain why

IMPORTANT: When you find a suitable dataset, respond with EXACTLY the text "READY_TO_SELECT_DATASET" and nothing else. This will trigger the dataset selection process.

Be thorough in your evaluation and helpful in your explanations.`,
    },
    ...state.messages,
  ]);

  return {
    messages: [result],
  };
}

// Structured parsing node - extracts dataset info using structured output
async function parseDatasetNode(state: DataGovState) {
  console.log('📋 Parse Dataset Node - Extracting structured dataset info...');

  const messages = state.messages;

  // Create a summary of the conversation for the parsing LLM
  const conversationSummary = messages
    .slice(1) // Skip system message
    .map(
      msg =>
        `${msg.type === 'human' ? 'User' : 'Assistant'}: ${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}`
    )
    .join('\n\n');

  const result = await llmWithStructuredOutput.invoke([
    {
      role: 'system',
      content: `You are a data extraction assistant. Based on the conversation below where a data.gov assistant found and evaluated datasets, extract the information about the FINAL selected dataset that the assistant determined was suitable for the user's query.

Look through the conversation and identify:
- Which dataset was ultimately selected as suitable
- The dataset's metadata (ID, title, organization, etc.)
- The reasoning for why it was selected
- Any download or access information

Extract this into the structured format requested.`,
    },
    {
      role: 'user',
      content: `Here is the conversation:\n\n${conversationSummary}\n\nPlease extract the information about the selected dataset.`,
    },
  ]);

  console.log('📋 Parsed dataset:', result);

  return {
    selectedDataset: result,
  };
}

// Final result node - formats the parsed dataset information
async function finalResultNode(state: DataGovState) {
  const messages = state.messages;
  const selectedDataset = state.selectedDataset;

  console.log(
    '🎯 Final Result Node - Processing final result...',
    selectedDataset
  );

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
  };
}

// Conditional edge function to route to tools, parsing, or continue LLM loop
function shouldContinue(state: DataGovState) {
  const messages = state.messages;
  const lastMessage = messages.at(-1) as AIMessage;

  // If the LLM makes a tool call, go to tool node
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return 'toolNode';
  }

  // Check if the LLM is ready to select a dataset
  if (lastMessage.content && typeof lastMessage.content === 'string') {
    if (lastMessage.content.trim() === 'READY_TO_SELECT_DATASET') {
      return 'parseDataset';
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
  .addNode('parseDataset', parseDatasetNode)
  .addNode('finalResult', finalResultNode)

  // Add edges
  .addEdge(START, 'setup')
  .addEdge('setup', 'llmNode')
  .addConditionalEdges('llmNode', shouldContinue, [
    'toolNode',
    'llmNode',
    'parseDataset',
  ])
  .addEdge('toolNode', 'llmNode')
  .addEdge('parseDataset', 'finalResult')
  .addEdge('finalResult', END)

  .compile();

export default dataGovAgent;
