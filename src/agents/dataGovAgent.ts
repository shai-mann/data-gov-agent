import {
  Annotation,
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { DatasetWithEvaluation } from '../lib/annotation';
import { ToolNode } from 'langchain';
import { openai } from '../llms';
import { evalAgent, searchAgent } from './agentic-tools';
import { DATA_GOV_CORE_PROMPT } from '../lib/prompts';

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

  console.log('🔍 Initializing data-gov agent');

  const prompt = await DATA_GOV_CORE_PROMPT.formatMessages({});

  return {
    messages: prompt,
    userQuery,
  };
}

async function modelNode(state: typeof DataGovAnnotation.State) {
  console.log('🔍 Invoking core agent');

  const result = await llmWithTools.invoke(state.messages);

  return {
    messages: result,
  };
}

function shouldContinue(state: typeof DataGovAnnotation.State) {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];

  console.log('🔍 Last message:', lastMessage);

  // If the LLM makes a tool call, go to tool node
  if (
    'tool_calls' in lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls?.length
  ) {
    return 'tools';
  }

  // If no tools were called, the AI is presumed to have found all the datasets it needed to find
  console.log('🔍 Exiting search workflow');
  return END;
}

// Build the data-gov agent workflow
const graph = new StateGraph(DataGovAnnotation)
  .addNode('setup', setupNode)
  .addNode('model', modelNode)
  // TODO: add post-tools node to update the datasets with evaluations.
  .addNode('tools', new ToolNode(tools))

  .addEdge(START, 'setup')
  .addEdge('setup', 'model')
  .addConditionalEdges('model', shouldContinue, ['tools', END])
  .addEdge('tools', 'model')

  .compile();

export default graph;
