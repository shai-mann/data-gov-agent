import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Select a dataset as the final result for the user's query
 */
export const selectDataset = tool(
  async ({
    datasetId,
    datasetTitle,
    reason,
    organization,
    lastModified,
    resourceCount,
    downloadUrl,
  }) => {
    console.log(
      `🎯 Select Dataset - Selected: "${datasetTitle}" (${datasetId})`
    );
    console.log(`📝 Reason: ${reason}`);
    console.log(`🏢 Organization: ${organization}`);
    console.log(`📅 Last Modified: ${lastModified}`);
    console.log(`📊 Resources: ${resourceCount}`);
    console.log(`🔗 Download URL: ${downloadUrl}`);

    return {
      success: true,
      selected: true,
      datasetId,
      datasetTitle,
      reason,
      organization,
      lastModified,
      resourceCount,
      downloadUrl,
    };
  },
  {
    name: 'select_dataset',
    description:
      "Select a dataset as the final result. Use this when you have found a suitable dataset for the user's query. This will end the search process.",
    schema: z.object({
      datasetId: z.string().describe('ID of the selected dataset'),
      datasetTitle: z.string().describe('Title of the selected dataset'),
      reason: z
        .string()
        .describe("Why this dataset is suitable for the user's query"),
      organization: z
        .string()
        .optional()
        .describe('Organization that published the dataset'),
      lastModified: z
        .string()
        .optional()
        .describe('Last modified date of the dataset'),
      resourceCount: z
        .number()
        .optional()
        .describe('Number of resources available in the dataset'),
      downloadUrl: z
        .string()
        .optional()
        .describe('URL to download the dataset'),
    }),
  }
);
