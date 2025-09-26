import { z } from 'zod';

// Zod schema for the response of the package search
export const PackageSearchResponseSchema = z.object({
  success: z.boolean(),
  result: z.object({
    results: z.array(z.any()),
  }),
});

export type PackageSearchResponse = z.infer<typeof PackageSearchResponseSchema>;

export const PackageAutocompleteResponseSchema = z.object({
  success: z.boolean(),
  result: z.array(
    z.object({
      name: z.string(),
      title: z.string(),
      match_field: z.string(),
      match_displayed: z.string(),
    })
  ),
});

export type PackageAutocompleteResponse = z.infer<
  typeof PackageAutocompleteResponseSchema
>;

export const SinglePackageResponseSchema = z.object({
  success: z.boolean(),
  result: z.any(),
});

export type SinglePackageResponse = z.infer<typeof SinglePackageResponseSchema>;
