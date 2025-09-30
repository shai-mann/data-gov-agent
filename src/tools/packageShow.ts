import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getPackage } from '@lib/data-gov';
import { PackageShowSchema } from '@lib/data-gov.schemas';

/**
 * Get detailed metadata for a specific package (dataset) from data.gov
 */
export const packageShow = tool(
  async ({ packageId }) => {
    console.log(`📦 Package Show - Package ID: ${packageId}`);

    const { result } = await getPackage(packageId);

    // This is a shortcut for real error handling, but good for an interview project!
    // TODO: replace with real error handling
    const parsedResult = PackageShowSchema.safeParse(result);

    if (!parsedResult.success) {
      console.error('🔍 Error parsing package:', parsedResult.error, result);
      throw new Error('Error parsing package: ' + parsedResult.error.message);
    }

    return parsedResult.data;
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
