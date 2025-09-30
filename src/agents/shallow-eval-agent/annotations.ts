import { z } from 'zod';

export const PendingResourceSchema = z.object({
  url: z.string().describe('The URL of the resource'),
  name: z.string().describe('The name of the resource'),
  format: z.string().describe('The format of the resource'),
});

export type PendingResource = z.infer<typeof PendingResourceSchema>;

export const ShallowEvaluationSchema = z.object({
  mimeType: z.string().describe('The MIME type of the resource'),
  isCompatible: z
    .boolean()
    .describe(
      'Whether the resource is compatible with the dataset tools we have access to'
    ),
  link: z
    .string()
    .describe(
      'The link to the resource, PRECISELY as it appears in the dataset. If the resource is compatible, must be provided.'
    ),
  reasoning: z.string().describe('The reasoning for the evaluation'),
});
