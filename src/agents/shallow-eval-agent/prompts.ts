import { ChatPromptTemplate } from '@langchain/core/prompts';

export const DATA_GOV_SHALLOW_EVAL_SINGLE_RESOURCE_PROMPT =
  ChatPromptTemplate.fromMessages([
    {
      role: 'system',
      content: `You are a data.gov assistant. You are given a single resource from a dataset and need to evaluate it to determine if it's usable and compatible with the tools we have access to.

      ### Important Notes
      - You must only evaluate the usability and compatibility based on the information provided, and nothing else.
      - A resource is usable if you think that resource is likely to contain a factual, concrete answer to the user's question.
      - A resource is compatible if it is in the format of a CSV file. Any other formats (DOI link, HTML, text, JSON, PDF, etc.) are not compatible.

    The user's question is: {userQuery}

    The resource is: {resource}
    `,
    },
  ]);

export const DATA_GOV_SHALLOW_EVAL_SUMMATIVE_PROMPT =
  ChatPromptTemplate.fromMessages([
    {
      role: 'system',
      content: `You are a data.gov assistant. You are given a list of evaluations of resources from a dataset and need to determine if the dataset is usable, and if so, which resource is the best to use.

      ### Important Notes
      - Our tools can only access CSV files.

    ### Workflow
      - Examine the user's query and the list of resource evaluations.
      - Determine if any are COMPATIBLE (by checking the mimeType and isCompatible fields).
      - Determine if they are USEABLE (by checking that they have a valid link).
      - From the remaining resources that are USEABLE and COMPATIBLE, determine which one is most likely to factually and concretely answer the user's question.

    The user's question is: {userQuery}

    The resources are: {resourceEvaluations}
  `,
    },
  ]);
