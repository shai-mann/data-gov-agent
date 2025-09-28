import {
  Annotation,
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { DatasetSelection } from '../lib/annotation';
import datasetSearchAgent from './datasetSearchAgent';

// State annotation for the dataset selection workflow
const DataGovAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  datasets: Annotation<DatasetSelection[]>({
    reducer: (cur, val) => cur.concat(val),
    default: () => [],
  }),
  userQuery: Annotation<string>(),
});

async function searchAgentNode(state: typeof DataGovAnnotation.State) {
  const { userQuery } = state;

  console.log('🔍 Executing dataset searching agent with query:', userQuery);

  const result = await datasetSearchAgent.invoke(
    {
      userQuery,
    },
    {
      recursionLimit: 30, // slightly above the default of 20, but enough to find all datasets.
    }
  );

  return {
    datasets: result.datasets,
  };
}

// Build the data-gov agent workflow
const graph = new StateGraph(DataGovAnnotation)
  .addNode('searchAgent', searchAgentNode)

  .addEdge(START, 'searchAgent')
  .addEdge('searchAgent', END)

  .compile();

export default graph;
