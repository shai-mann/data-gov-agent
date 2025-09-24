import { MessagesAnnotation, StateGraph } from '@langchain/langgraph';
import { ToolNode } from 'langchain';
import { AIMessage } from '@langchain/core/messages';
import { add } from '../tools';
import { openai } from '../llms';

// Set up tool calling
const tools = [add];
const llmWithTools = openai.bindTools(tools);

// Nodes
async function llmCall(state: typeof MessagesAnnotation.State) {
  // LLM decides whether to call a tool or not
  const result = await llmWithTools.invoke([
    {
      role: 'system',
      content:
        'You are a helpful assistant tasked with performing arithmetic on a set of inputs.',
    },
    ...state.messages,
  ]);

  return {
    messages: [result],
  };
}

const toolNode = new ToolNode(tools);

// Conditional edge function to route to the tool node or end
function shouldContinue(state: typeof MessagesAnnotation.State) {
  const messages = state.messages;
  const lastMessage = messages.at(-1) as AIMessage;

  // If the LLM makes a tool call, then perform an action
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return 'toolNode';
  }

  // Otherwise, we stop (reply to the user)
  return '__end__';
}

// Build workflow
const calcAgent = new StateGraph(MessagesAnnotation)
  .addNode('llmCall', llmCall)
  .addNode('toolNode', toolNode)
  // Add edges to connect nodes
  .addEdge('__start__', 'llmCall')
  .addConditionalEdges('llmCall', shouldContinue, ['toolNode', '__end__'])
  .addEdge('toolNode', 'llmCall')
  .compile();

export default calcAgent;
