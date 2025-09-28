import { z } from 'zod';

export type DatasetSelection = { id: string; title: string; reason: string };

export type DatasetWithEvaluation = DatasetSelection & {
  // Optional because it may not have been evaluated yet
  evaluation?:
    | {
        relevant: true;
        score: number;
        reasoning: string;
        bestResource: string;
      }
    | {
        relevant: false;
      };
};

export const DatasetWithEvaluationSchema = z.object({
  id: z.string(),
  title: z.string(),
  reason: z.string(),
  evaluation: z
    .discriminatedUnion('relevant', [
      z.object({
        relevant: z.literal(true),
        score: z.number(),
        reasoning: z.string(),
        bestResource: z
          .string()
          .describe(
            "The best resource to answer the user's question. This must be identical to the original link in order to be filled accurately. If filled incorrectly, it is unusable"
          ),
      }),
      z.object({
        relevant: z.literal(false),
      }),
    ])
    .optional()
    .nullable(),
});
