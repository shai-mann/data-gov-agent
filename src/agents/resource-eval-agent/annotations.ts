import { z } from 'zod';

export const ResourceEvaluationSchema = z.object({
  summary: z.string().describe('The summary of the resource'),
  usable: z.boolean().describe('Whether the resource is usable'),
  usability_reason: z
    .string()
    .describe('The reason why the resource is usable'),
  columns: z
    .array(
      z.object({
        name: z.string().describe('The name of the column'),
        inferred_type: z.string().describe('The inferred type of the column'),
        useful_for_question: z
          .boolean()
          .describe('Whether the column is useful for the question'),
        sample_values: z
          .array(z.string())
          .describe('The sample values of the column'),
      })
    )
    .describe('The columns of the resource'),
});

export type ResourceEvaluation = z.infer<typeof ResourceEvaluationSchema>;
