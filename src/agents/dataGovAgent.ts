import { MessagesAnnotation, StateGraph } from '@langchain/langgraph';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import {
  packageSearch,
  packageShow,
  doiView,
  datasetDownload,
  datasetEvaluation,
  selectDataset,
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
  selectDataset,
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
- selectDataset: Select a dataset as the final result (this ends the search process)

Your workflow:
1. Search for datasets matching the user's query using packageSearch
2. Get detailed information about promising candidates using packageShow
3. View DOI information if available using doiView
4. Download and preview the dataset using datasetDownload
5. Evaluate if it's suitable for the user's needs using datasetEvaluation
6. If suitable, use selectDataset to finalize your choice and end the process
7. If not suitable, search for alternatives or explain why

IMPORTANT: When you find a suitable dataset, you MUST use the selectDataset tool to finalize your choice. This will end the search process and provide the user with the selected dataset information.

Be thorough in your evaluation and helpful in your explanations.`,
    },
    ...state.messages,
  ]);

  return {
    ...state,
    messages: [result],
  };
}

// Custom tool node that handles state updates
async function toolNodeWithStateUpdate(state: DataGovState) {
  const messages = state.messages;
  const lastMessage = messages.at(-1) as AIMessage;

  if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
    console.log('⚠️ Tool Node - No tool calls found');
    return { ...state, messages: [lastMessage] };
  }

  console.log(
    '🔧 Tool Node - Executing tool calls:',
    lastMessage.tool_calls.map(tc => ({
      name: tc.name,
      args: tc.args,
    }))
  );

  const results = [];
  let newState = { ...state };

  for (const toolCall of lastMessage.tool_calls) {
    const tool = tools.find(t => t.name === toolCall.name);
    if (!tool) {
      console.log(`❌ Tool not found: ${toolCall.name}`);
      continue;
    }

    console.log(
      `🛠️ Executing tool: ${toolCall.name} with args:`,
      toolCall.args
    );

    try {
      const result = await (tool as any).invoke(toolCall.args);
      console.log(
        `✅ Tool ${toolCall.name} result:`,
        JSON.stringify(result, null, 2)
      );

      // If this is a select_dataset tool call, update the state
      if (toolCall.name === 'select_dataset' && result.success) {
        newState.selectedDataset = {
          id: result.datasetId,
          title: result.datasetTitle,
          reason: result.reason,
          organization: result.organization,
          lastModified: result.lastModified,
          resourceCount: result.resourceCount,
          downloadUrl: result.downloadUrl,
        };
        console.log('🎯 Dataset selected and added to state');
      }

      results.push({
        tool_call_id: toolCall.id,
        name: toolCall.name,
        content: JSON.stringify(result),
      });
    } catch (error) {
      console.log(`❌ Tool ${toolCall.name} error:`, error);
      results.push({
        tool_call_id: toolCall.id,
        name: toolCall.name,
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  const toolMessages = results.map(result => ({
    role: 'tool' as const,
    content: result.content,
    tool_call_id: result.tool_call_id,
    name: result.name,
  }));

  console.log('📤 Tool Node - Tool results:', toolMessages);

  return {
    ...newState,
    messages: [...messages, ...toolMessages],
  };
}

// Final result node - returns the selected dataset
async function finalResultNode(state: DataGovState) {
  const messages = state.messages;
  const selectedDataset = state.selectedDataset;

  console.log('🎯 Final Result Node - Processing final result...');
  console.log('📊 Selected Dataset:', selectedDataset);

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

// State-based conditional edge function
function shouldContinue(state: DataGovState) {
  const messages = state.messages;
  const lastMessage = messages.at(-1) as AIMessage;

  console.log('🔄 Conditional Edge - Deciding next step...');
  console.log('📝 Last message type:', lastMessage.constructor.name);
  console.log(
    '🔧 Has tool calls:',
    !!(lastMessage.tool_calls && lastMessage.tool_calls.length > 0)
  );
  console.log('🎯 Has selected dataset in state:', !!state.selectedDataset);

  // If the LLM makes a tool call, execute the tool
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    console.log('➡️ Routing to toolNode');
    return 'toolNode';
  }

  // If we have a selected dataset in state, move to final result
  if (state.selectedDataset) {
    console.log('➡️ Routing to finalResult (dataset selected)');
    return 'finalResult';
  }

  // Otherwise, return to the LLM
  console.log('➡️ Routing back to llmNode');
  return 'llmNode';
}

// Build the data-gov agent workflow
const dataGovAgent = new StateGraph(MessagesAnnotation)
  .addNode('setup', setupNode)
  .addNode('llmNode', datasetFindingNode)
  .addNode('toolNode', toolNodeWithStateUpdate)
  .addNode('finalResult', finalResultNode)

  // Add edges
  .addEdge('__start__', 'setup')
  .addEdge('setup', 'llmNode')
  .addConditionalEdges('llmNode', shouldContinue, [
    'toolNode',
    'finalResult',
    'llmNode',
  ])
  .addEdge('toolNode', 'llmNode')
  .addEdge('finalResult', '__end__')

  .compile();

export default dataGovAgent;
