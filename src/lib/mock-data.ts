import { DatasetWithEvaluation } from '../agents/search-agent/searchAgent.ts';

export const MOCK_USER_QUERY = {
  query:
    'Determine the percentage of crimes committed by people age 80 and older in the United States, using the most recent available data. Approximations are acceptable if the dataset uses age groups such as 65+ or covers only state-level data.',
};

export const MOCK_FINAL_SELECTION = {
  summary:
    'The best resource provides educational performance metrics such as SAT and ACT scores, which can be used to derive state rankings in education quality. However, additional context or data on how to rank these states based on the metrics is necessary, which can be supplemented by secondary resources.',
  bestResource:
    'https://data.wa.gov/api/views/wajg-ig9g/rows.csv?accessType=DOWNLOAD',
  secondaryResources: [],
  id: '98f9aa47-ab58-4c84-a23d-d1ed64ba1cf3',
  evaluations: [
    {
      url: 'https://data.wa.gov/api/views/wajg-ig9g/rows.csv?accessType=DOWNLOAD',
      name: 'Comma Separated Values File',
      description: '',
      summary:
        "The provided dataset contains various columns related to educational institutions in the United States, including state abbreviations (STABBR) and several performance metrics such as SAT and ACT scores. However, it does not explicitly provide a ranking or score for education quality at the state level. To identify the states with the highest rankings in education quality, one would need to derive or calculate rankings based on the available performance metrics, particularly SAT_AVG or ACT scores. Therefore, while the dataset is usable, it requires additional processing to answer the user's question directly.",
      usable: true,
      usability_reason:
        'The dataset contains relevant educational performance metrics, but requires processing to derive state rankings.',
      columns: [
        {
          name: 'STABBR',
          inferred_type: 'string',
          useful_for_question: true,
          sample_values: ['CA', 'NY', 'TX'],
        },
        {
          name: 'SAT_AVG',
          inferred_type: 'float',
          useful_for_question: true,
          sample_values: ['1200.5', '1350.0', '1100.0'],
        },
        {
          name: 'ACTCMMID',
          inferred_type: 'float',
          useful_for_question: true,
          sample_values: ['25.0', '30.0', '22.0'],
        },
      ],
    },
  ],
} satisfies DatasetWithEvaluation;

export const MOCK_CONTEXT_SUMMARY =
  '### Columns and Values\n\n1. **Data_Status**: This column represents the status of the data for a given year and series. It contains string data, specifically codes that indicate whether the data is final, preliminary, or forecasted. An example value is "2023F", which suggests that the data is forecasted for the year 2023. The meaning of this value indicates that the data is not yet finalized and is subject to change.\n\n2. **MSN**: The "MSN" (Mnemonic Series Name) column contains a five-character code that identifies specific energy data series. This column is a string type and is crucial for categorizing the data. For instance, "ABICB" refers to "Aviation gasoline blending components consumed by the industrial sector". The structure of the code provides insights into the energy source, sector, and type of data being reported.\n\n3. **StateCode**: This column contains two-character string codes that represent U.S. states and territories, following the U.S. Postal Service abbreviations. For example, "AK" stands for Alaska. This column is essential for identifying the geographical context of the data, allowing users to filter or analyze data by state.\n\n4. **Year**: The "Year" column indicates the year for which the data is reported. It is an integer type formatted as a four-digit year (YYYY). For example, the value "1960" indicates that the data pertains to that specific year. This column is critical for time series analysis, allowing users to track changes over time.\n\n5. **Data**: This column contains the actual numerical values associated with the energy data series for the specified year, state, and MSN. The data type is typically a float or integer, depending on the context of the measurement. For instance, a value of "0" indicates no consumption or expenditure for that series in the given year. This column is the core of the dataset, providing the quantitative information needed for analysis.\n\n### Dataset Overview\n\nThe State Energy Data System (SEDS) dataset provides comprehensive annual time series estimates of state-level energy use, production, prices, and expenditures across various economic sectors in the United States. The dataset spans from 1960 to the present and includes data presented in physical units (BTUs) and monetary values (dollars). Each entry in the dataset is characterized by a unique combination of a mnemonic series name (MSN), state code, year, and the corresponding data value, which allows for detailed analysis of energy trends and patterns at the state level.\n\nThe dataset is structured to facilitate easy access and analysis, with specific columns dedicated to the status of the data, the type of energy being reported, the geographical context (state), and the temporal aspect (year). This structure enables users to perform targeted queries and extract meaningful insights regarding energy consumption, production, and pricing trends across different states and over time.';
