import { MessagesAnnotation, StateGraph } from '@langchain/langgraph';
import {
  packageSearch,
  packageShow,
  doiView,
  datasetDownload,
  datasetEvaluation,
} from '../tools';
import { openai } from '../llms';

// Extended state to track data-gov specific information
type DataGovState = typeof MessagesAnnotation.State & {
  searchResults?: any[];
  currentPackage?: any;
  datasetPreview?: any;
  evaluationResult?: any;
  selectedDataset?: any;
  userQuery?: string;
  searchAttempts?: number;
};

// Set up tool calling
const tools = [
  packageSearch,
  packageShow,
  doiView,
  datasetDownload,
  datasetEvaluation,
];

openai.bindTools(tools);

// Node 1: Package Search
async function packageSearchNode(state: DataGovState) {
  const messages = state.messages;
  const lastMessage = messages.at(-1);

  if (!lastMessage || lastMessage.type !== 'user') {
    throw new Error('No user message found for package search');
  }

  const userQuery = lastMessage.content as string;

  // Use the package search tool
  const searchResult = await packageSearch.invoke({
    query: userQuery,
    limit: 10,
  });

  return {
    ...state,
    userQuery,
    searchResults: searchResult.success ? searchResult.results : [],
    searchAttempts: (state.searchAttempts || 0) + 1,
    messages: [
      ...messages,
      {
        role: 'assistant',
        content: `Found ${searchResult.success ? searchResult.results.length : 0} datasets matching "${userQuery}". Let me get more details about the most relevant ones.`,
      },
    ],
  };
}

// Node 2: Package Show (Get detailed metadata)
async function packageShowNode(state: DataGovState) {
  const messages = state.messages;
  const searchResults = state.searchResults || [];

  if (searchResults.length === 0) {
    return {
      ...state,
      messages: [
        ...messages,
        {
          role: 'assistant',
          content:
            'No datasets found for your query. Please try a different search term.',
        },
      ],
    };
  }

  // Get details for the first (most relevant) package
  const firstPackage = searchResults[0];
  const packageDetails = await packageShow.invoke({
    packageId: firstPackage.id,
  });

  return {
    ...state,
    currentPackage: packageDetails.success ? packageDetails.package : null,
    messages: [
      ...messages,
      {
        role: 'assistant',
        content: `Retrieved detailed information for "${firstPackage.title}". ${packageDetails.success ? 'Let me evaluate if this dataset is suitable for your needs.' : 'Failed to retrieve package details.'}`,
      },
    ],
  };
}

// Node 3: DOI View (if needed)
async function doiViewNode(state: DataGovState) {
  const messages = state.messages;
  const currentPackage = state.currentPackage;

  if (!currentPackage) {
    return {
      ...state,
      messages: [
        ...messages,
        {
          role: 'assistant',
          content: 'No package details available for DOI view.',
        },
      ],
    };
  }

  // Look for DOI in extras
  const doiExtra = currentPackage.extras?.find(
    (extra: any) =>
      extra.key.toLowerCase().includes('doi') ||
      extra.key.toLowerCase().includes('identifier')
  );

  if (!doiExtra) {
    return {
      ...state,
      messages: [
        ...messages,
        {
          role: 'assistant',
          content:
            'No DOI found for this dataset. Proceeding to dataset download and preview.',
        },
      ],
    };
  }

  const doiResult = await doiView.invoke({ doi: doiExtra.value });

  return {
    ...state,
    messages: [
      ...messages,
      {
        role: 'assistant',
        content: `DOI Information: ${doiResult.success ? `Title: ${doiResult.doi_info?.title}, Citation: ${doiResult.doi_info?.citation}` : 'Failed to retrieve DOI information.'}`,
      },
    ],
  };
}

// Node 4: Dataset Download and Preview
async function datasetDownloadNode(state: DataGovState) {
  const messages = state.messages;
  const currentPackage = state.currentPackage;

  if (
    !currentPackage ||
    !currentPackage.resources ||
    currentPackage.resources.length === 0
  ) {
    return {
      ...state,
      messages: [
        ...messages,
        {
          role: 'assistant',
          content: 'No downloadable resources found for this dataset.',
        },
      ],
    };
  }

  // Use the first available resource
  const resource = currentPackage.resources[0];
  const downloadResult = await datasetDownload.invoke({
    resourceUrl: resource.url,
    resourceId: resource.id,
    format: resource.format,
  });

  return {
    ...state,
    datasetPreview: downloadResult.success ? downloadResult.preview : null,
    messages: [
      ...messages,
      {
        role: 'assistant',
        content: `Dataset preview: ${downloadResult.success ? `Found ${downloadResult.preview?.total_rows || 0} rows with columns: ${downloadResult.preview?.columns?.join(', ') || 'unknown'}` : 'Failed to download dataset preview.'}`,
      },
    ],
  };
}

// Node 5: Dataset Evaluation
async function datasetEvaluationNode(state: DataGovState) {
  const messages = state.messages;
  const currentPackage = state.currentPackage;
  const datasetPreview = state.datasetPreview;
  const userQuery = state.userQuery;

  if (!currentPackage || !userQuery) {
    return {
      ...state,
      messages: [
        ...messages,
        {
          role: 'assistant',
          content:
            'Cannot evaluate dataset without package details or user query.',
        },
      ],
    };
  }

  const evaluationResult = await datasetEvaluation.invoke({
    datasetMetadata: currentPackage,
    userQuery,
    datasetPreview,
  });

  return {
    ...state,
    evaluationResult: evaluationResult.success
      ? evaluationResult.evaluation
      : null,
    messages: [
      ...messages,
      {
        role: 'assistant',
        content: `Dataset evaluation: ${
          evaluationResult.success
            ? `Suitability: ${evaluationResult.evaluation?.is_suitable ? 'Yes' : 'No'}, Confidence: ${evaluationResult.evaluation?.confidence_score || 0}`
            : 'Failed to evaluate dataset.'
        }`,
      },
    ],
  };
}

// Node 6: Select Dataset and Return
async function selectDatasetNode(state: DataGovState) {
  const messages = state.messages;
  const currentPackage = state.currentPackage;
  const evaluationResult = state.evaluationResult;

  if (!currentPackage) {
    return {
      ...state,
      messages: [
        ...messages,
        {
          role: 'assistant',
          content: 'No dataset selected. Please try a different search.',
        },
      ],
    };
  }

  const isSuitable = evaluationResult?.is_suitable || false;

  return {
    ...state,
    selectedDataset: isSuitable ? currentPackage : null,
    messages: [
      ...messages,
      {
        role: 'assistant',
        content: isSuitable
          ? `✅ Selected dataset: "${currentPackage.title}"\n\n` +
            `📊 Organization: ${currentPackage.organization?.title || 'Unknown'}\n` +
            `📅 Last Modified: ${currentPackage.last_modified || 'Unknown'}\n` +
            `📋 Resources: ${currentPackage.resources?.length || 0} available\n` +
            `🔗 Access the dataset at: ${currentPackage.resources?.[0]?.url || 'No URL available'}`
          : `❌ The dataset "${currentPackage.title}" is not suitable for your query. Let me search for alternatives.`,
      },
    ],
  };
}

// Conditional edge functions
function shouldGetPackageDetails(state: DataGovState) {
  const searchResults = state.searchResults || [];
  return searchResults.length > 0 ? 'packageShow' : '__end__';
}

function hasEnoughInfo(state: DataGovState) {
  const currentPackage = state.currentPackage;
  const hasResources =
    currentPackage?.resources && currentPackage.resources.length > 0;
  const hasDOI = currentPackage?.extras?.some(
    (extra: any) =>
      extra.key.toLowerCase().includes('doi') ||
      extra.key.toLowerCase().includes('identifier')
  );

  // If we have resources, we can proceed to download
  // If we only have DOI, we should view DOI first
  return hasResources ? 'datasetDownload' : hasDOI ? 'doiView' : '__end__';
}

function shouldViewDOI(state: DataGovState) {
  const currentPackage = state.currentPackage;
  const hasDOI = currentPackage?.extras?.some(
    (extra: any) =>
      extra.key.toLowerCase().includes('doi') ||
      extra.key.toLowerCase().includes('identifier')
  );

  return hasDOI ? 'doiView' : 'datasetDownload';
}

function shouldEvaluateDataset(state: DataGovState) {
  const datasetPreview = state.datasetPreview;
  return datasetPreview ? 'datasetEvaluation' : '__end__';
}

function isDatasetSuitable(state: DataGovState) {
  const evaluationResult = state.evaluationResult;
  const searchAttempts = state.searchAttempts || 0;

  if (evaluationResult?.is_suitable) {
    return 'selectDataset';
  }

  // If not suitable and we haven't tried too many times, search again
  if (searchAttempts < 3) {
    return 'packageSearch';
  }

  return 'selectDataset'; // Give up and return what we have
}

// Build the data-gov agent workflow
const dataGovAgent = new StateGraph(MessagesAnnotation)
  .addNode('packageSearch', packageSearchNode)
  .addNode('packageShow', packageShowNode)
  .addNode('doiView', doiViewNode)
  .addNode('datasetDownload', datasetDownloadNode)
  .addNode('datasetEvaluation', datasetEvaluationNode)
  .addNode('selectDataset', selectDatasetNode)

  // Add edges
  .addEdge('__start__', 'packageSearch')
  .addConditionalEdges('packageSearch', shouldGetPackageDetails, [
    'packageShow',
    '__end__',
  ])
  .addConditionalEdges('packageShow', hasEnoughInfo, [
    'doiView',
    'datasetDownload',
    '__end__',
  ])
  .addConditionalEdges('doiView', shouldViewDOI, ['datasetDownload'])
  .addConditionalEdges('datasetDownload', shouldEvaluateDataset, [
    'datasetEvaluation',
    '__end__',
  ])
  .addConditionalEdges('datasetEvaluation', isDatasetSuitable, [
    'selectDataset',
    'packageSearch',
  ])
  .addEdge('selectDataset', '__end__')

  .compile();

export default dataGovAgent;
