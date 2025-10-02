import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ONE_SECOND } from '../lib/utils.ts';
import { workingDatasetMemory } from '../lib/database.ts';

export const VALID_DATASET_FORMATS = ['CSV'] as const;

/**
 * Download and preview a dataset from data.gov (first 100 rows)
 */
export const datasetDownload = tool(
  async ({ resourceUrl, format = 'CSV', limit = 20, offset = 0 }) => {
    console.log(`📥 Dataset Download - URL: ${resourceUrl}, Format: ${format}`);

    // Check if resource is DOI link (sanity check)
    if (resourceUrl.includes('doi.org')) {
      // This small sanity check avoids downloading a common, useless link that the AI may pretend is a dataset.
      console.warn(`❌ Dataset Download - DOI link detected, skipping`);
      return {
        success: false,
        error: 'DOI link detected, skipping',
        preview: null,
      };
    }

    if (workingDatasetMemory[resourceUrl]) {
      console.log(
        `📥 Dataset Download - Using cached dataset, returning rows ${offset} to ${offset + limit}`
      );
      return {
        success: true,
        preview: previewDataset(
          workingDatasetMemory[resourceUrl],
          offset,
          limit
        ),
      };
    }

    try {
      // 15 second timeout - if the download takes too long, abort it.
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 15 * ONE_SECOND);

      const response = await fetch(resourceUrl, {
        headers: {
          'Content-Type': 'text/csv',
        },
        signal: controller.signal,
      });

      const csv = await response.text();

      workingDatasetMemory[resourceUrl] = csv.split('\n');

      // Give a tiny snippet of the CSV file
      const preview = previewDataset(
        workingDatasetMemory[resourceUrl],
        offset,
        limit
      );

      console.log(
        `✅ Dataset Download - Dataset downloaded with ${csv.length} total rows, returning rows ${offset} to ${offset + limit}`
      );
      return {
        success: true,
        preview: preview,
      };
    } catch (error) {
      console.log(
        `❌ Dataset Download - Error:`,
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
      return {
        success: false,
        // Give the AI a very generic error message so it doesn't retry the tool.
        error: 'Resource cannot be downloaded. Do not retry.',
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
        .enum(VALID_DATASET_FORMATS)
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

/**
 * Previews a dataset, always including the zeroth row (column headers).
 */
function previewDataset(dataset: string[], offset: number, limit: number) {
  const headers = dataset[0];
  const rows = dataset.slice(1 + offset, 1 + offset + limit);
  return [headers, ...rows];
}
