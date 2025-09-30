import { ChatPromptTemplate } from '@langchain/core/prompts';

export const CONTEXT_AGENT_INITIAL_PROMPT = ChatPromptTemplate.fromMessages([
  {
    role: 'system',
    content: `You are a Dataset Context Builder. I will provide ALL available raw information about a dataset in the messages that follow (package metadata, resource metadata, small CSV previews, DOI/web text, README or other docs, and any other contextual links).

Important constraints (must follow exactly):
- Rely ONLY on the information provided. Do not use outside knowledge or assumptions beyond what is explicitly or implicitly present in the provided data.
- Be extremely thorough. The goal is to provide a complete understanding of the dataset so another agent can immediately construct correct SQL queries without further schema exploration.
- Do not skip columns or provide generic descriptions. Every column provided in the metadata or CSV previews must be described in detail.
- If information is missing or ambiguous, explicitly note the uncertainty and reference which input caused it.

Task:
Produce a clear, natural-language description of the dataset. Your output should include the following sections:

1) Columns and Values (first)
- For every column/field in the dataset, provide a paragraph-level description that includes:
  - Column name exactly as provided.
  - What the column represents in the context of the dataset.
  - The kind of data it contains (integer, string, date, float, boolean, etc.).
  - Any units or formats (e.g., percentages, MW, YYYY-MM-DD); null if unknown.
  - Examples of values from the provided CSV samples.
  - The meaning of those values in context (e.g., codes, abbreviations, units, categories).
  - If the column meaning is unclear, explicitly mark it as ambiguous and explain why.
- Each column description must be at least 3–4 sentences and detailed enough for a query agent to reason about it.

2) Dataset Overview (second)
- After all columns are described, provide a 2–3 paragraph overview of the dataset based strictly on the column-level analysis a
`,
  },
  {
    role: 'system',
    content: `Below is context about the dataset:
    ----
    ### Package Metadata
    {packageMetadata}
    ----
    ### Sample Rows
    {sampleRows}
    ----
    ### Raw text of related resources
    {resourceText}
    ----`,
  },
]);
