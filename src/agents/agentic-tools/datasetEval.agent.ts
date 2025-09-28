import { tool } from 'langchain';
import { z } from 'zod';
import datasetEvalAgent from '../datasetEvalAgent';

export const evalAgent = tool(
  async ({ userQuery, dataset }) => {
    console.log('🔍 Executing dataset evaluating agent');

    const result = await datasetEvalAgent.invoke({
      userQuery,
      dataset,
    });

    return {
      // Content of the last message is the evaluation
      evaluation: result.messages.at(-1)?.content,
      dataset,
    };
  },
  {
    name: 'evalAgent',
    description: "Evaluate a single dataset in the context of the user's query",
    schema: z.object({
      userQuery: z
        .string()
        .describe("The user's PRECISE and EXACT query to search for datasets"),
      dataset: z.object({
        id: z.string().describe('The ID of the dataset to evaluate'),
        title: z.string().describe('The title of the dataset to evaluate'),
        reason: z.string().describe('The reason for evaluating the dataset'),
      }),
    }),
  }
);
