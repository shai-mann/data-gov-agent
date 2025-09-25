import { tool } from '@langchain/core/tools';
import { z } from 'zod';

interface PackageDetails {
  id: string;
  title: string;
  notes: string;
  tags: Array<{ name: string; display_name: string }>;
  organization: {
    title: string;
    name: string;
    description: string;
  };
  resources: Array<{
    id: string;
    name: string;
    description: string;
    format: string;
    url: string;
    size: number;
    created: string;
    last_modified: string;
  }>;
  extras: Array<{
    key: string;
    value: string;
  }>;
  license_title: string;
  license_url: string;
  author: string;
  author_email: string;
  maintainer: string;
  maintainer_email: string;
  created: string;
  last_modified: string;
}

/**
 * Get detailed metadata for a specific package (dataset) from data.gov
 */
export const packageShow = tool(
  async ({ packageId }) => {
    console.log(`📦 Package Show - Package ID: ${packageId}`);

    return {
      id: '1',
      title: 'Sample Title',
      notes: 'Sample notes',
      tags: [{ name: 'Sample Tag', display_name: 'Sample Tag' }],
      organization: {
        title: 'Unknown',
        name: 'unknown',
        description: '',
      },
      resources: [
        {
          id: '1',
          name: 'Sample Resource',
          description: 'Sample description',
          format: 'CSV',
          url: 'https://www.sample.com',
          size: 100,
          created: '2021-01-01',
          last_modified: '2021-01-01',
        },
      ],
      extras: [
        {
          key: 'Sample Key',
          value: 'Sample Value',
        },
      ],
      license_title: 'Sample License',
      license_url: 'https://www.sample.com',
      author: 'Sample Author',
      author_email: 'sample@sample.com',
      maintainer: 'Sample Maintainer',
      maintainer_email: 'sample@sample.com',
      created: '2021-01-01',
      last_modified: '2021-01-01',
    } satisfies PackageDetails;
  },
  {
    name: 'package_show',
    description:
      'Get detailed metadata for a specific dataset package from data.gov.',
    schema: z.object({
      packageId: z
        .string()
        .describe('The ID of the package to retrieve details for'),
    }),
  }
);
