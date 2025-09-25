import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { searchPackages } from '../lib/data-gov';

/**
 * Search for packages (datasets) on data.gov using the CKAN API
 */
export const packageSearch = tool(
  async ({ query, limit = 10, offset = 0 }) => {
    console.log(
      `🔍 Package Search - Query: "${query}", Limit: ${limit}, Offset: ${offset}`
    );

    // Search for packages on data.gov, applying pagination post-fact (since the API doesn't support pagination)
    const { result } = await searchPackages(query);

    const packages = result.results;

    return {
      success: true,
      results: packages.slice(offset, offset + limit),
    };
  },
  {
    name: 'package_search',
    description:
      'Search for datasets on data.gov using keywords. Returns a list of matching packages with metadata.',
    schema: z.object({
      query: z.string().describe('Search query for finding datasets'),
      limit: z
        .number()
        .optional()
        .describe('Maximum number of results to return (default: 10)'),
      offset: z
        .number()
        .optional()
        .describe('Number of results to skip for pagination (default: 0)'),
    }),
  }
);
