import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { packageAutocomplete } from '../lib/data-gov';

/**
 * Get a list of related package names to a query from data.gov
 */
export const packageNameSearch = tool(
  async ({ query, limit = 5, offset = 0 }) => {
    console.log(`📦 Package Name Search - Query: ${query}`);

    const { result } = await packageAutocomplete(query);

    console.log(
      '🔍 Package Name Search - Result:',
      result.slice(offset, offset + limit)
    );

    // Slice the result to the limit and offset
    return {
      success: true,
      results: result.slice(offset, offset + limit),
    };
  },
  {
    name: 'package_name_search',
    description:
      'Get a list of related package names to a query from data.gov.',
    schema: z.object({
      query: z
        .string()
        .describe('The ID of the package to retrieve details for'),
      limit: z.number().default(5).describe('The number of results to return'),
      offset: z
        .number()
        .default(0)
        .describe('The offset of the results to return'),
    }),
  }
);
