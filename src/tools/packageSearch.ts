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

    return {
      success: true,
      results: [
        {
          id: '1',
          title: 'Sample Dataset',
          notes: 'Sample notes',
          tags: [{ name: 'Sample Tag' }],
          organization: { title: 'Sample Organization' },
          resources: [
            {
              id: '1',
              name: 'Sample Resource',
              format: 'CSV',
              url: 'https://www.sample.com',
            },
          ],
        },
        {
          id: '2',
          title: 'Sample Dataset 2',
          notes: 'Sample notes 2',
          tags: [{ name: 'Sample Tag 2' }],
          organization: { title: 'Sample Organization 2' },
          resources: [
            {
              id: '2',
              name: 'Sample Resource 2',
              format: 'CSV',
              url: 'https://www.sample.com',
            },
          ],
        },
        {
          id: '3',
          title: 'Sample Dataset 3',
          notes: 'Sample notes 3',
          tags: [{ name: 'Sample Tag 3' }],
          organization: { title: 'Sample Organization 3' },
          resources: [
            {
              id: '3',
              name: 'Sample Resource 3',
              format: 'CSV',
              url: 'https://www.sample.com',
            },
          ],
        },
        {
          id: '4',
          title: 'Sample Dataset 4',
          notes: 'Sample notes 4',
          tags: [{ name: 'Sample Tag 4' }],
          organization: { title: 'Sample Organization 4' },
          resources: [
            {
              id: '4',
              name: 'Sample Resource 4',
              format: 'CSV',
              url: 'https://www.sample.com',
            },
          ],
        },
        {
          id: '5',
          title: 'Sample Dataset 5',
          notes: 'Sample notes 5',
          tags: [{ name: 'Sample Tag 5' }],
          organization: { title: 'Sample Organization 5' },
          resources: [
            {
              id: '5',
              name: 'Sample Resource 5',
              format: 'CSV',
              url: 'https://www.sample.com',
            },
          ],
        },
      ] satisfies PackageSearchResult[],
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
