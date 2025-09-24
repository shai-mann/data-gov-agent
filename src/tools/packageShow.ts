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

    try {
      const baseUrl = 'https://catalog.data.gov/api/3/action';
      const showUrl = `${baseUrl}/package_show`;

      const params = new URLSearchParams({
        id: packageId,
      });

      console.log(`📡 Package Show - Fetching: ${showUrl}?${params}`);
      const response = await fetch(`${showUrl}?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as any;

      if (!data.success) {
        throw new Error(`API error: ${data.error?.message || 'Unknown error'}`);
      }

      const packageData: PackageDetails = {
        id: data.result.id,
        title: data.result.title,
        notes: data.result.notes || '',
        tags: data.result.tags || [],
        organization: data.result.organization || {
          title: 'Unknown',
          name: 'unknown',
          description: '',
        },
        resources: data.result.resources || [],
        extras: data.result.extras || [],
        license_title: data.result.license_title || 'Unknown',
        license_url: data.result.license_url || '',
        author: data.result.author || 'Unknown',
        author_email: data.result.author_email || '',
        maintainer: data.result.maintainer || 'Unknown',
        maintainer_email: data.result.maintainer_email || '',
        created: data.result.created || '',
        last_modified: data.result.last_modified || '',
      };

      console.log(`✅ Package Show - Retrieved: "${packageData.title}"`);
      return {
        success: true,
        package: packageData,
      };
    } catch (error) {
      console.log(`❌ Package Show - Error:`, error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
        package: null,
      };
    }
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
