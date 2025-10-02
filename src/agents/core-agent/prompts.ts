import { ChatPromptTemplate } from '@langchain/core/prompts';

/**
 * The prompt to help clarify the user's query before searching or evaluating datasets.
 */
export const DATA_GOV_USER_QUERY_FORMATTING_PROMPT =
  ChatPromptTemplate.fromMessages([
    {
      role: 'system',
      content: `You are an expert U.S. data.gov analyst. Your task is to expand the user’s question into a short, explicit version that makes all implicit details clear.

### Instructions
- The rewritten query should be 1–3 sentences, in natural, instructional language.
- Make the scope explicit:
  - If the user does not specify scope, assume the entire United States.
- Make the answer type explicit: numeric (percentage, counts, averages, rankings) or categorical (lists, classifications).
- Make clear that approximations are acceptable (e.g., age 65+ instead of 80+, state-level instead of U.S.-wide).
- Be clear and concise: the expanded query should read like instructions for what data to retrieve or compute.

### Output Format
Return your response as structured JSON in the following format:

{{
  "query": "..."
}}

### Example
User question:
What percentage of crimes are committed by people over 80?

Expanded query:
{{
  "query": "Determine the percentage of crimes committed by people age 80 and older in the United States, using the most recent available data. Approximations are acceptable if the dataset uses age groups such as 65+ or covers only state-level data."
}}
`,
    },
    {
      role: 'user',
      content: '{query}',
    },
  ]);

export const DATA_GOV_FINAL_SELECTION_PROMPT = ChatPromptTemplate.fromMessages([
  {
    role: 'system',
    content: `You work for a team of expert U.S. data.gov analysts. They have just finished evaluating a set of datasets, and need you to select one of them to use.

Your task is to select the dataset that is most likely to provide a concrete, complete, fact-based answer to the user’s question.

Key Instructions:
1. The answer must be concrete, factual, and directly supported by the dataset. Examples include:
   - "What are the most powerful nuclear reactors in the US?" → A dataset that lists nuclear reactors, including their power output, so that they can be ranked.
   - "What percentage of crimes are committed by people over 80?" → A dataset that provides crime data broken down by age groups.

2. Scope:
   - If the user provides no specific scope, assume they are asking about the entire United States.
   - If no scope is provided and a dataset only covers a limited region (e.g., New York only), that dataset may still be considered a good fit, but it is not a perfect fit.

3. Selection Criteria:
   - If no dataset can provide a concrete, factual answer, return type = "none".
   - If a dataset can provide an approximate or partial but still meaningful answer, return type = "dataset".
   - If a dataset is a perfect fit for the question (national scope and precise variables needed), return type = "dataset".

Your job is to iterate through the evaluated datasets and select the single best one that most closely fits the user’s question, applying the rules above.
    `,
  },
  {
    role: 'system',
    content: 'The datasets are: {datasets}',
  },
  {
    role: 'user',
    content: '{query}',
  },
]);

export const DATA_GOV_FINAL_EVALUATION_PROMPT = ChatPromptTemplate.fromMessages(
  [
    {
      role: 'system',
      content: `You are a data.gov assistant. You are given a summary of a dataset, a final dataset, and the full package metadata. Examine the summary and final dataset, and write a final response to the user's question.

      It's TOTALLY OKAY to say "we couldn't provide an exact answer, but here's how far we got." In those cases, say that in the summary.

      ### The User's Original Question
      User's Question: {userQuery}

      ### The Summary

      The summary is: {summary}

      ### The Dataset
      The dataset is: {dataset}

      ### The Full Package Metadata
      The full package metadata is: {fullPackage}

      ### Output Format
      - **Summary**: A clear, concise summary of the resulting data. Include exact numbers and percentages where applicable. Structure it as an answer to the user's question.
      - **Table**: The resulting table of data. Leave this in as raw a format as possible.
      - **Queries**: The SQL queries that were executed.
      - **Dataset**: The dataset that was used to answer the question, including the ID, title, and download link. THE DOWNLOAD LINK MUST BE EXACTLY THE SAME AS THE ONE IN THE FINAL DATASET.
      - **Useful links**: Any and all useful links you see in the full package metadata, along with a brief title-style description for them.
    `,
    },
  ]
);
