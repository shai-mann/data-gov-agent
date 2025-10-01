import { z } from 'zod';

export const PendingResourceSchema = z.object({
  url: z.string().describe('The URL of the resource'),
  name: z.string().describe('The name of the resource'),
  description: z
    .string()
    .nullable()
    .describe('The description of the resource'),
  format: z.string().describe('The format of the resource'),
});

export type PendingResource = z.infer<typeof PendingResourceSchema>;

export const SummarySchema = z.object({
  summary: z
    .string()
    .describe(
      '1–2 sentence explanation of how bestResource answers the query; mention secondaryResources if needed.'
    ),
  bestResource: z
    .string()
    .describe('The single most relevant resource URL (exact URL only).'),
  secondaryResources: z
    .array(z.string())
    .describe('Supporting resource URLs (exact URLs only).'),
});

export type Summary = z.infer<typeof SummarySchema>;
