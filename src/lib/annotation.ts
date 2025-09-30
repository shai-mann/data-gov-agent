import { z } from 'zod';

export type DatasetSelection = { id: string; title: string; reason: string };

export type DatasetWithEvaluation = DatasetSelection & {
  // Optional because it may not have been evaluated yet
  evaluation?:
    | {
        usable: true;
        score: number;
        reasoning: string;
        bestResource: string;
      }
    | {
        usable: false;
      };
};

export const DatasetWithEvaluationSchema = z.object({
  id: z.string(),
  title: z.string(),
  reason: z.string(),
  evaluation: z
    .discriminatedUnion('usable', [
      z.object({
        usable: z.literal(true),
        score: z.number(),
        reasoning: z.string(),
        bestResource: z
          .string()
          .describe(
            "The best resource to answer the user's question. This must be identical to the original link in order to be filled accurately. If filled incorrectly, it is unusable"
          ),
      }),
      z.object({
        usable: z.literal(false),
      }),
    ])
    .optional()
    .nullable(),
});

export const QueryAgentSummarySchema = z.object({
  queries: z.array(z.string()).describe('The SQL queries that were executed'),
  results: z.string().describe('The results of the SQL query'),
  summary: z.string().describe('A summary of the results of the SQL query'),
});

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
