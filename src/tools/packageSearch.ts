import { tool } from '@langchain/core/tools';
import { z } from 'zod';

interface PackageSearchResult {
  id: string;
  title: string;
  notes: string;
  tags: Array<{ name: string }>;
  organization: { title: string };
  resources: Array<{
    id: string;
    name: string;
    format: string;
    url: string;
  }>;
}

/**
 * Search for packages (datasets) on data.gov using the CKAN API
 */
export const packageSearch = tool(
  async ({ query, limit = 10, offset = 0 }) => {
    console.log(
      `🔍 Package Search - Query: "${query}", Limit: ${limit}, Offset: ${offset}`
    );

    try {
      const baseUrl = 'https://catalog.data.gov/api/3/action';
      const searchUrl = `${baseUrl}/package_search`;

      const params = new URLSearchParams({
        q: query,
        rows: limit.toString(),
        start: offset.toString(),
        sort: 'score desc, metadata_modified desc',
      });

      console.log(`📡 Package Search - Fetching: ${searchUrl}?${params}`);
      const response = await fetch(`${searchUrl}?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as any;

      if (!data.success) {
        throw new Error(`API error: ${data.error?.message || 'Unknown error'}`);
      }

      const results: PackageSearchResult[] = data.result.results.map(
        (pkg: any) => ({
          id: pkg.id,
          title: pkg.title,
          notes: pkg.notes || '',
          tags: pkg.tags || [],
          organization: pkg.organization || { title: 'Unknown' },
          resources: pkg.resources || [],
        })
      );

      console.log(`✅ Package Search - Found ${results.length} results`);
      return {
        success: true,
        count: data.result.count,
        results: results,
        query: query,
      };
    } catch (error) {
      console.log(`❌ Package Search - Error:`, error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
        results: [],
        query: query,
      };
    }
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
