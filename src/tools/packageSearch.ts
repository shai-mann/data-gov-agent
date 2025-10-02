import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { searchPackages } from '../lib/data-gov.ts';
import { PackageShowSchema } from '../lib/data-gov.schemas.ts';

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

    const packages = result.results.slice(offset, offset + limit);

    // Extract only necessary keys from the package object
    const massagedPackages = packages
      .map(pkg => ({
        id: pkg.id,
        notes: pkg.notes,
        name: pkg.name,
        title: pkg.title,
        type: pkg.type,
        state: pkg.state, // active, not active, etc.

        resources: [], // skip the packages to save on context size, but the schema requires the key to exist
        extras: [], // skip the extras to save on context size
      }))
      .map(pkg => PackageShowSchema.parse(pkg));

    console.log(
      `🔍 Package Search - Found ${massagedPackages.length} packages`
    );

    return {
      success: true,
      results: massagedPackages.slice(offset, offset + limit),
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
        .default(10)
        .describe('Maximum number of results to return (default: 10)'),
      offset: z
        .number()
        .optional()
        .default(0)
        .describe('Number of results to skip for pagination (default: 0)'),
    }),
  }
);
