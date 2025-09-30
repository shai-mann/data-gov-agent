import {
  BaseMessage,
  isAIMessage,
  isToolMessage,
} from '@langchain/core/messages';

export const ONE_SECOND = 1000;

export function getLastAiMessageIndex(messages: BaseMessage[]) {
  return (
    messages
      .map((m, i) => [m, i] as const)
      .filter(([m]) => isAIMessage(m))
      .map(([, i]) => i)
      .pop() ?? -1
  );
}

export function getToolMessages(
  messages: BaseMessage[],
  toolName: string,
  start = 0
) {
  return (
    messages
      .slice(start)
      .filter(m => isToolMessage(m))
      .filter(m => m.name === toolName)
      .filter(m => m.content && typeof m.content === 'string')
      // Filter out error messages from tools
      .filter(m => (m.content as string).trim().startsWith('Error') === false)
      .map(m => JSON.parse(m.content as string))
  );
}
