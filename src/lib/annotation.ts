export type DatasetSelection = { id: string; title: string; reason: string };

export type DatasetEvaluation = {
  dataset: DatasetSelection;
  evaluation: string;
  score: number;
};
