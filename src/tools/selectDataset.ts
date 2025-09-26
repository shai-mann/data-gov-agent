import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * This tool just returns the dataset information so it can be added to the state in the following node.
 */
export const selectDataset = tool(
  async ({ id, title, reason }) => {
    console.log('🔍 Selecting dataset:', title);
    return {
      id,
      title,
      reason,
    };
  },
  {
    name: 'selectDataset',
    description:
      'Select a dataset by providing its ID, title, and reason for relevance',
    schema: z.object({
      id: z.string().describe('The dataset ID to select'),
      title: z.string().describe('The title of the dataset'),
      reason: z
        .string()
        .describe(
          'Explanation of why this dataset is relevant to the user query'
        ),
    }),
  }
);
