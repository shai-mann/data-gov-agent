import { ToolMessage } from 'langchain';
import { z } from 'zod';
import { DatasetWithEvaluation } from '../../lib/annotation';

/**
 * Takes in a list of tool messages that were returned from the evalAgent tool, and updates the datasets with the evaluations.
 */
export function handleEvalToolMessages(
  messages: ToolMessage[],
  datasets: DatasetWithEvaluation[]
) {
  // Parse the tool messages into a list of datasets with evaluations
  const toolMessages = messages.map(m =>
    z
      .object({
        evaluation: z.string(),
        dataset: z.object({
          id: z.string(),
          title: z.string(),
          reason: z.string(),
        }),
      })
      .parse(JSON.parse(m.content as string))
  );

  // Update the datasets with the evaluations
  const newDatasets = toolMessages
    .map(m => {
      const existingDataset = datasets.find(d => d.id === m.dataset.id);
      if (existingDataset) {
        console.log('🔍 [CORE] Updating existing dataset:', existingDataset.id);
        return {
          ...existingDataset,
          evaluation: m.evaluation,
        };
      }
    })
    .filter(Boolean) as DatasetWithEvaluation[];

  console.log(
    '🔍 [CORE] Updating',
    newDatasets.length,
    'datasets with evaluations. There were already',
    datasets.length,
    'datasets in the state.'
  );

  return newDatasets;
}

/**
 * Takes in a list of tool messages that were returned from the selectDataset tool, and updates the datasets with the selections.
 * Overwrites the old datasets with new list.
 */
export function handleSelectDatasetToolMessages(messages: ToolMessage[]) {
  const { datasets } = z
    .object({
      datasets: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          reason: z.string(),
        })
      ),
    })
    .parse(JSON.parse(messages[0].content as string));

  console.log(
    '🔍 [CORE] Updating',
    datasets.length,
    'datasets with selections.'
  );
  return datasets;
}
