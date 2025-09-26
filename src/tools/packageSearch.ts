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

    const packages = result.results.slice(offset, offset + limit);

    // Extract only necessary keys from the package object
    const massagedPackages = packages.map(pkg => ({
      id: pkg.id,
      isopen: pkg.isopen,
      license_title: pkg.license_title,
      maintainer: pkg.maintainer,
      name: pkg.name,
      notes: pkg.notes,
      num_resources: pkg.num_resources,
      num_tags: pkg.num_tags,
      organization: pkg.organization,
      owner_org: pkg.owner_org,
      private: pkg.private,
      state: pkg.state,
      title: pkg.title,
      type: pkg.type,
      url: pkg.url,
      version: pkg.version,
      extras: pkg.extras,
    }));

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
