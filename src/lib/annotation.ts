export type DatasetSelection = { id: string; title: string; reason: string };

export type DatasetWithEvaluation = DatasetSelection & {
  evaluation?: string; // Optional because it may not have been evaluated yet
};
