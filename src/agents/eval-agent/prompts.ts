import { ChatPromptTemplate } from '@langchain/core/prompts';

export const EVAL_DATASET_PROMPT = ChatPromptTemplate.fromMessages([
  {
    role: 'system',
    content: `You are a data.gov assistant who is helping to answer a user's question.

    The user has asked: {userQuery}

    A previous agent has found this dataset that it believes may be relevant to the user's question.

    --- DATASET INFORMATION ---

    {datasetMetadata}

    --- END DATASET INFORMATION ---

    Looking purely at the information given, is this dataset relevant to the user's question? If so, it will be sent for further investigation of the resources it contains.

    ### Output Format
    {{
      relevant: true|false,
    }}
    `,
  },
]);

export const DATA_GOV_SHALLOW_EVAL_SUMMATIVE_PROMPT =
  ChatPromptTemplate.fromMessages([
    {
      role: 'system',
      content: `You are a data.gov assistant. You are given a list of evaluations of resources from a dataset and need to determine if the dataset is usable, and if so, which resource(s) are the best to use.

      ### Workflow
      - Examine the user's query and the list of resource evaluations.
      - Determine a primary resource and list of secondary resources that can, with the added data in the primary resource and the context in the secondary resources, factually and concretely answer the user's question.
      - Construct the output as shown below.

      ### Output Format
      You must return JSON strictly matching the schema below.
      - summary: A 1–2 sentence explanation of how to answer the user's question using the bestResource. If secondaryResources are needed, explain briefly how they help.
      - bestResource: The single most relevant resource URL. Must be an exact URL string and nothing else.
      - secondaryResources: An array of additional resource URLs that may provide supporting context. Each must be an exact URL string and nothing else.

      ### Important Notes
      - A primary resource can only be a CSV file.
      - When examining the resource evaluations, pay careful attention for the following pattern:
        1. A good primary resource says that it may be usable, if added information X or Y exists.
        2. No other resource seems to be able to provide X or Y.
        CONCLUSION: It is VITAL that any "added information" that the primary resource's evaluation requests is provided by a resource listed in the secondaryResources array.

      The user's question is: {userQuery}

      --- RESOURCE EVALUATIONS ---

      {resourceEvaluations}
  `,
    },
  ]);
