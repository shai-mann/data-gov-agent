import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Download and preview a dataset from data.gov (first 100 rows)
 */
export const datasetDownload = tool(
  async ({ resourceUrl, format = 'CSV', limit = 3, offset = 0 }) => {
    console.log(`📥 Dataset Download - URL: ${resourceUrl}, Format: ${format}`);

    try {
      const response = await fetch(resourceUrl, {
        headers: {
          'Content-Type': 'text/csv',
        },
      });

      const csv = await response.text();

      // Give a tiny snippet of the CSV file
      const preview = csv.split('\n').slice(offset, offset + limit);

      console.log(
        `✅ Dataset Download - Dataset downloaded with ${csv.length} total rows, returning rows ${offset} to ${offset + limit}`
      );
      return {
        success: true,
        preview: preview,
      };
    } catch (error) {
      console.log(`❌ Dataset Download - Error:`, error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
        preview: null,
      };
    }
  },
  {
    name: 'dataset_download',
    description:
      'Download and preview a dataset from data.gov. Returns the first 100 rows of data with column information.',
    schema: z.object({
      resourceUrl: z
        .string()
        .describe('URL of the dataset resource to download'),
      format: z
        .enum(['CSV'])
        .optional()
        .default('CSV')
        .describe(
          'Expected format of the dataset (CSV, JSON, XML, etc.). Currently only supports CSV.'
        ),
      limit: z
        .number()
        .optional()
        .default(3)
        .describe('Number of rows to return, between 1 and 10'),
      offset: z
        .number()
        .optional()
        .default(0)
        .describe('Number of rows to skip'),
    }),
  }
);
