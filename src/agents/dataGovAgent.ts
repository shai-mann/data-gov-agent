import {
  Annotation,
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { DatasetWithEvaluation } from '../lib/annotation';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { openai } from '../llms';
import { evalAgent, searchAgent } from './agentic-tools';
import { DATA_GOV_CORE_PROMPT } from '../lib/prompts';
import { isAIMessage, isToolMessage } from '@langchain/core/messages';
import {
  handleEvalToolMessages,
  handleSelectDatasetToolMessages,
} from './helpers/gov-agent.helpers';

const DataGovAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  datasets: Annotation<DatasetWithEvaluation[]>({
    // NOT CONCATENATION, because we need to be able to override old datasets when the search returns new ones.
    reducer: (_, val) => val,
    default: () => [],
  }),
  userQuery: Annotation<string>(),
});

const tools = [searchAgent, evalAgent];
const llmWithTools = openai.bindTools(tools);

async function setupNode(state: typeof DataGovAnnotation.State) {
  const { userQuery } = state;

  console.log('🔍 [CORE] Initializing');

  const prompt = await DATA_GOV_CORE_PROMPT.formatMessages({
    query: userQuery,
  });

  return {
    messages: prompt,
    userQuery,
  };
}

async function modelNode(state: typeof DataGovAnnotation.State) {
  console.log('🔍 [CORE] Invoking model');

  const result = await llmWithTools.invoke(state.messages);

  return {
    messages: result,
  };
}

async function postToolsNode(state: typeof DataGovAnnotation.State) {
  console.log('🔍 [CORE] Updating datasets with evaluations');

  const { messages, datasets } = state;

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
    .filter(m => m.name === 'evalAgent' || m.name === 'searchAgent')
    .filter(m => m.content && typeof m.content === 'string');

  // There should never be tool calls to both at once, so we can presume only searching if searching was called.
  if (toolMessages.filter(m => m.name === 'searchAgent').length > 0) {
    return {
      datasets: handleSelectDatasetToolMessages(
        toolMessages.filter(m => m.name === 'searchAgent')
      ),
    };
  }

  return {
    datasets: handleEvalToolMessages(
      toolMessages.filter(m => m.name === 'evalAgent'),
      datasets
    ),
  };
}

function shouldContinue(state: typeof DataGovAnnotation.State) {
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
  console.log('🔍 [CORE] Exiting workflow');
  return END;
}

// Build the data-gov agent workflow
const graph = new StateGraph(DataGovAnnotation)
  .addNode('setup', setupNode)
  .addNode('model', modelNode)
  // TODO: custom tool node to intercept and use the correct user query, so the agent can't change it when passing it in????
  .addNode('tools', new ToolNode(tools))
  .addNode('postTools', postToolsNode)

  .addEdge(START, 'setup')
  .addEdge('setup', 'model')
  .addConditionalEdges('model', shouldContinue, ['tools', END])
  .addEdge('tools', 'postTools')
  .addEdge('postTools', 'model')

  .compile();

export default graph;
