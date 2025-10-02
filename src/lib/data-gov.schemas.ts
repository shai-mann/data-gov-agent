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

export const PackageShowSchema = z.object({
  id: z.string(),
  notes: z.string(),
  name: z.string(),
  title: z.string(),
  type: z.string(),
  state: z.string(), // active, not active, etc.

  resources: z.array(
    z.object({
      url: z.string(),
      name: z.string(),
      format: z.string(),
      mimetype: z.string().nullable(),
      description: z.string(),
    })
  ),
  extras: z.array(
    z.object({
      key: z.string(),
      value: z.any(),
    })
  ),
});

export type PackageShowResponse = z.infer<typeof PackageShowSchema>;
