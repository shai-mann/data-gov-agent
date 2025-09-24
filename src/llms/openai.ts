import { ChatOpenAI } from '@langchain/openai';

export const openai = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',
});
