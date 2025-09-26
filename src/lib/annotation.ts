import { z } from 'zod';

// Schema for structured dataset selection
export const DatasetSelectionSchema = z.object({
  datasets: z.array(
    z.object({
      id: z.string().describe('The ID of the selected dataset'),
      title: z.string().describe('The title of the selected dataset'),
      reason: z
        .string()
        .describe(
          "Explanation of why this dataset is suitable for the user's query"
        ),
      organization: z
        .string()
        .describe('The organization that published the dataset'),
      lastModified: z.string().describe('When the dataset was last modified'),
      resourceCount: z.number().describe('Number of resources in the dataset'),
      downloadUrl: z.string().describe('URL to download the dataset'),
    })
  ),
});

export type DatasetSelections = z.infer<typeof DatasetSelectionSchema>;
