import { z } from 'zod';

// export const PackageSchema = z.object({
//   author: z.string().nullable(),
//   author_email: z.string().nullable(),
//   creator_user_id: z.string().nullable(),
//   id: z.string(),
//   isopen: z.boolean(),
//   license_id: z.string().nullable(),
//   license_title: z.string().nullable(),
//   maintainer: z.string().nullable(),
//   maintainer_email: z.string().nullable(),
//   metadata_created: z.string(),
//   metadata_modified: z.string(),
//   name: z.string(),
//   notes: z.string().nullable(),
//   num_resources: z.number(),
//   num_tags: z.number(),
//   owner_org: z.string().nullable(),
//   private: z.boolean(),
//   state: z.string().nullable(),
//   title: z.string().nullable(),
//   type: z.string().nullable(),
//   url: z.string().nullable(),
//   version: z.string().nullable(),
//   organization: z.object({
//     id: z.string().nullable(),
//     name: z.string().nullable(),
//     title: z.string().nullable(),
//     type: z.string().nullable(),
//     description: z.string().nullable(),
//     image_url: z.string().nullable(),
//     created: z.string().nullable(),
//     is_organization: z.boolean(),
//     approval_status: z.string().nullable(),
//     state: z.string().nullable(),
//   }),
//   extras: z.array(
//     z.object({
//       key: z.string().nullable(),
//       value: z.union([z.string(), z.boolean(), z.array(z.string())]),
//     })
//   ),
//   resources: z.array(
//     z.object({
//       cache_last_updated: z.string().nullable(),
//       cache_url: z.string().nullable(),
//       created: z.string(),
//       description: z.string(),
//       format: z.string(),
//       hash: z.string(),
//       id: z.string(),
//       last_modified: z.string().nullable(),
//       metadata_modified: z.string(),
//       mimetype: z.string(),
//       mimetype_inner: z.string().nullable(),
//       name: z.string(),
//       package_id: z.string(),
//       position: z.number(),
//       resource_type: z.string().nullable(),
//       size: z.number().nullable(),
//       state: z.string(),
//       tracking_summary: z.object({
//         total: z.number(),
//         recent: z.number(),
//       }),
//       url: z.string(),
//       url_type: z.string().nullable(),
//     })
//   ),
// });

// Zod schema for the response of the package search
export const PackageSearchResponseSchema = z.object({
  success: z.boolean(),
  result: z.object({
    results: z.array(z.any()),
  }),
});

export type PackageSearchResponse = z.infer<typeof PackageSearchResponseSchema>;
