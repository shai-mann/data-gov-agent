import { tool } from 'langchain';
import { z } from 'zod';
import datasetSearchAgent from '../datasetSearchAgent';

export const searchAgent = tool(
  async ({ userQuery }) => {
    console.log('🔍 Executing dataset searching agent');

    const result = await datasetSearchAgent.invoke(
      {
        userQuery,
      },
      {
        recursionLimit: 30, // slightly above the default of 20, but enough to find all datasets.
      }
    );

    return {
      datasets: result.datasets,
    };
  },
  {
    name: 'searchAgent',
    description: "Search for 10-15 datasets matching the user's query",
    schema: z.object({
      userQuery: z.string(),
    }),
  }
);
