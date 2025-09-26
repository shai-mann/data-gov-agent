import {
  StateGraph,
  MessagesAnnotation,
  Annotation,
  END,
  START,
} from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';

const SimpleAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  currentOutput: Annotation<string[]>,
});

const getWeather = tool(
  input => {
    if (['sf', 'san francisco'].includes(input.location.toLowerCase())) {
      return {
        success: true,
        results: [{ text: "It's 60 degrees and foggy.", day: 'Monday' }],
      };
    } else {
      return {
        success: true,
        results: [{ text: "It's 90 degrees and sunny.", day: 'Monday' }],
      };
    }
  },
  {
    name: 'get_weather',
    description: 'Call to get the current weather.',
    schema: z.object({
      location: z.string().describe('Location to get the weather for.'),
    }),
  }
);

const tools = [getWeather];
const modelWithTools = new ChatOpenAI({
  model: 'gpt-4o-mini',
  temperature: 0,
}).bindTools(tools);

const toolNodeForGraph = new ToolNode(tools);

const setupNode = async (state: typeof SimpleAnnotation.State) => {
  console.log('🔍 Setup node...');
  return {
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      ...state.messages,
    ],
    currentOutput: ['shai output'],
  };
};

const shouldContinue = (state: typeof SimpleAnnotation.State) => {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  if (
    'tool_calls' in lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls?.length
  ) {
    console.log('🔍 Tool calls:', lastMessage.tool_calls);
    return 'tools';
  }
  return END;
};

const callModel = async (state: typeof SimpleAnnotation.State) => {
  console.log('🔍 Calling model...');
  const { messages } = state;
  const response = await modelWithTools.invoke(messages);
  return { messages: response };
};

export const graph = new StateGraph(SimpleAnnotation)
  .addNode('setup', setupNode)
  .addNode('agent', callModel)
  .addNode('tools', toolNodeForGraph)
  .addEdge(START, 'setup')
  .addEdge('setup', 'agent')
  .addConditionalEdges('agent', shouldContinue)
  .addEdge('tools', 'agent')
  .compile();
