import { ChatPromptTemplate } from '@langchain/core/prompts';

export const DATA_GOV_SHALLOW_EVAL_SINGLE_RESOURCE_PROMPT =
  ChatPromptTemplate.fromMessages([
    {
      role: 'system',
      content: `You are a data.gov assistant. You are given a single resource from a dataset and need to evaluate if it is worth investigating further.

      A resource is worth investigating further if it is likely to contain a factual, concrete answer to the user's question.
      Keep in mind that some information you may not have. You don't know the resource's contents, so focus on analyzing only the name and url. If they seem good, send it for further investigation.
      The user's question is: "{userQuery}".

      -- RESOURCE METADATA --

      {resourceMetadata}

      -- END RESOURCE METADATA --

      Based on the resource metadata, is it worth investigating this resource further? If there is not enough information to make a decision, IT IS WORTH INVESTIGATING FURTHER.

      ### Output Format
      - **Worth Investigating**: "Yes" or "No", in the JSON format specified.
      - **Reasoning**: A short explanation of why the resource is worth investigating or not.
    `,
    },
  ]);

export const DATA_GOV_DEEP_EVAL_SINGLE_RESOURCE_PROMPT =
  ChatPromptTemplate.fromMessages([
    {
      role: 'system',
      content: `
You are a Deep Resource Evaluator. You will be given a single dataset resource and contextual information. Rely ONLY on the text provided in the inputs — do not browse the web, do not invent facts, and do not assume external knowledge beyond what is shown.

Your job:
1) Produce a concise, **1–2 paragraph** natural-language summary of the SPECIFIC CONTENT of the provided resource that answers: can this resource help answer the user's question, and how?
2) Return a boolean field "usable" indicating whether this resource is usable (true) or not (false). Mark "usable" = true even if the resource would be usable only when paired with another resource that explains codes/columns — but make that dependency explicit.
3) If usable, provide a short structured "columns" list (array) describing each column you can infer: name, inferred_type, useful_for_question (boolean), sample_values (if present), ambiguous (boolean) and ambiguity_reason (if ambiguous).

Constraints and expectations:
- Summary must be grounded in the inputs and explain *which columns / values* are relevant to the user's question, what they appear to represent (units, codes, datetimes, ID fields), and whether any columns could directly supply the answer (or what additional mapping is required).
- If the resource is not machine-readable or lacks usable data (e.g., only text with no tabular content), set "usable": false and explain why.
- Be concise and avoid repetition. Do not output any extra text beyond the required JSON object.

### IMPORTANT:
- If the resource is unusable, then populate the columns array with an empty array.
- If the question cannot be answered PRECISELY (e.g. the resource is for state data rather than national data, or the resource only has a category for 65+, so you can't find data for 70+ specifically), THE DATASET IS STILL USABLE. Simply make note of this limitaiton in the summary.
      The reasoning for this is that we MAY NOT GET A BETTER DATASET. If this is the best we can find, we should still use it.

Output format (must be valid JSON):
{{
  "summary": "<1-2 paragraph natural-language summary>",
  "usable": true|false,
  "usability_reason": "<one-sentence explanation why usable is true/false>",
  "columns": [
    {{
      "name": "<exact column name inferred>",
      "inferred_type": "<integer|float|string|date|boolean|unknown>",
      "useful_for_question": true|false,
      "sample_values": ["...","..."] | [], // Include up to 3 sample values, fewer if less unique options available
    }},
    ...
  ],
}}

Do not include any keys other than those above. Do not wrap the JSON in explanatory text.
`,
    },
    {
      role: 'user',
      content: `
User query: {userQuery}

Resource name: {resourceName}

Resource preview (text/HTML/CSV excerpt): {resourcePreview}

Resource description (if present): {resourceDescription}

Dataset-level notes (if any): {datasetNotes}

First-rows or page snippet (first 5 rows or first 4000 chars): {rowPreview}
`,
    },
  ]);
