import { DatasetSelection, DatasetWithEvaluation } from '../../lib/annotation';

export const MOCK_USER_QUERY = {
  query:
    'Determine the percentage of crimes committed by people age 80 and older in the United States, using the most recent available data. Approximations are acceptable if the dataset uses age groups such as 65+ or covers only state-level data.',
};

/*
 * Mock datasets for testing.
 */
export const MOCK_DATASETS = [
  {
    id: '37f7cedc-4ed8-4569-99a9-0c36f1af7152',
    title: 'Arrest Data',
    reason:
      'This dataset provides national arrest estimates detailed by offense, sex, age, and race, which can help analyze crime rates among older populations.',
  },
  {
    id: 'e219a097-b2fe-4c81-bf07-b6e27bf0b09c',
    title: 'Age-by-Race Specific Crime Rates, 1965-1985:  [United States]',
    reason:
      'This dataset examines age-specific crime rates, which can provide insights into crime committed by older individuals.',
  },
  {
    id: '87dbbdaf-8ea8-427d-acd8-8915231cca65',
    title: 'Violent Crime Rate',
    reason:
      'This dataset contains data on violent crime rates in California, which can be used to approximate crime rates among older populations.',
  },
  {
    id: '6c4e2995-7bdf-4c37-a269-386348be7e65',
    title: 'Violence Reduction - Victim Demographics - Aggregated',
    reason:
      "This dataset includes demographic information on violent crime victims, which may include age breakdowns relevant to the user's query.",
  },
  {
    id: '9f440483-56ed-4d7c-a464-c660949808ba',
    title: 'Felony Sentences',
    reason:
      'This dataset includes demographic information such as age, which can help analyze crime rates among older individuals.',
  },
  {
    id: 'aa2c447c-5e77-4791-81d5-15630312f667',
    title: 'Uniform Crime Reporting Program Data Series',
    reason:
      'This dataset provides comprehensive crime data, including age breakdowns, which can help analyze crime rates among older populations.',
  },
  {
    id: '2b050709-22ca-48b7-a0dd-35933b74f1e8',
    title: 'National Prisoner Statistics (NPS) Series',
    reason:
      'This dataset provides data on prisoners, including age demographics, which can help analyze crime rates among older individuals.',
  },
  {
    id: '7440ee03-99c9-45f9-9fbb-4bfe9469f19c',
    title: 'Electronic Police Report 2021',
    reason:
      'This dataset includes detailed police reports with demographic information, including age, which can help analyze crime rates among older individuals.',
  },
  {
    id: 'df1de6e0-a78a-41be-be43-7bc04d8dad42',
    title: '21st Century Corporate Financial Fraud, United States, 2005-2010',
    reason:
      'While focused on corporate fraud, this dataset may provide insights into demographic trends related to crime, including age.',
  },
  {
    id: '32b1872e-1faf-477e-99fc-bcad2a69729a',
    title: 'NCHS - Leading Causes of Death: United States',
    reason:
      'This dataset presents age-adjusted death rates, which can provide insights into mortality related to crime among older populations.',
  },
  {
    id: '405652c8-9146-4e16-8604-c6c04892a956',
    title:
      'Death rates for suicide, by sex, race, Hispanic origin, and age: United States',
    reason:
      'This dataset provides death rates by age, which can help analyze trends related to crime and mortality among older individuals.',
  },
  {
    id: 'f6731209-f2b6-4786-9ce2-306d9accb8f6',
    title: 'NCHS - Injury Mortality: United States',
    reason:
      'This dataset describes injury mortality, which can be relevant for understanding crime-related deaths among older populations.',
  },
  {
    id: 'e3725a5b-d1fd-46e8-bb68-c999d3061e0a',
    title:
      'Provisional COVID-19 death counts, rates, and percent of total deaths, by jurisdiction of residence',
    reason:
      'This dataset includes demographic characteristics, including age, which can help analyze trends related to crime and mortality among older individuals.',
  },
  {
    id: '5cb8d78e-54d3-4a36-bb51-190c316829f7',
    title: 'Motor Vehicle Collisions - Crashes',
    reason:
      'This dataset includes details on crash events, which may provide insights into incidents involving older individuals.',
  },
  {
    id: '1c249f51-eb6d-4f04-86fc-a7979bcc8518',
    title: 'Federal Student Loan Portfolio',
    reason:
      'This dataset includes demographic information that may provide insights into the financial behaviors of older individuals, which can be related to crime.',
  },
] satisfies DatasetSelection[];

export const MOCK_EVALUATED_DATASETS = [
  {
    id: '6c4e2995-7bdf-4c37-a269-386348be7e65',
    title: 'Violence Reduction - Victim Demographics - Aggregated',
    reason:
      "This dataset includes demographic information on violent crime victims, which may include age breakdowns relevant to the user's query.",
    evaluation: {
      usable: true,
      score: 75,
      reasoning:
        'The dataset provides demographic information on violent crime victims, including age breakdowns. It includes columns for age groups, which can help approximate the percentage of crimes committed by individuals aged 80 and older. The dataset aggregates data by quarter and includes various demographic factors, making it suitable for analysis. For example, queries can be made to sum the number of victims aged 80+ and compare it to the total number of victims to calculate the percentage.',
      bestResource:
        '[CSV Dataset](https://data.cityofchicago.org/api/views/gj7a-742p/rows.csv?accessType=DOWNLOAD)',
    },
  },
  {
    id: '9f440483-56ed-4d7c-a464-c660949808ba',
    title: 'Felony Sentences',
    reason:
      'This dataset includes demographic information such as age, which can help analyze crime rates among older individuals.',
    evaluation: {
      usable: true,
      score: 85,
      reasoning:
        'The dataset contains demographic information, including age groups, which is essential for analyzing crime rates among older individuals. The "AGE_GROUP" column can help identify the percentage of crimes committed by individuals aged 80 and older, or at least those in the 65+ category. The dataset includes various offenses and sentencing details, which can provide a comprehensive view of felony crimes.',
      bestResource:
        'https://opendata.dc.gov/api/download/v1/items/f92f4556f26b4737a040fb996eaefca3/csv?layers=40',
    },
  },
  {
    id: '7440ee03-99c9-45f9-9fbb-4bfe9469f19c',
    title: 'Electronic Police Report 2021',
    reason:
      'This dataset includes detailed police reports with demographic information, including age, which can help analyze crime rates among older individuals.',
    evaluation: {
      usable: true,
      score: 75,
      reasoning:
        'The dataset contains detailed police reports with demographic information, including the age of offenders and victims. This allows for the analysis of crime rates among individuals aged 80 and older. The presence of the "Offender_Age" column is particularly useful for determining the percentage of crimes committed by this age group. However, the dataset is limited to New Orleans, which may not represent national trends.',
      bestResource:
        '[CSV Dataset](https://data.nola.gov/api/views/6pqh-bfxa/rows.csv?accessType=DOWNLOAD)',
    },
  },
  {
    id: 'f6731209-f2b6-4786-9ce2-306d9accb8f6',
    title: 'NCHS - Injury Mortality: United States',
    reason:
      'This dataset describes injury mortality, which can be relevant for understanding crime-related deaths among older populations.',
    evaluation: {
      usable: true,
      score: 70,
      reasoning:
        'The dataset provides drug overdose death rates, which can be relevant for understanding mortality related to crime among older populations. The preview shows that it includes age groups, which may allow for analysis of the 80+ age demographic. However, it does not directly provide crime data, but rather focuses on mortality rates, which could be indirectly related to crime statistics.',
      bestResource:
        '[CSV Dataset](https://data.cdc.gov/api/views/95ax-ymtc/rows.csv?accessType=DOWNLOAD)',
    },
  },
] satisfies DatasetWithEvaluation[];

export const MOCK_FINAL_SELECTION = {
  type: 'dataset',
  id: '9f440483-56ed-4d7c-a464-c660949808ba',
};

export const MOCK_CONTEXT_SUMMARY =
  '### Columns and Values\n\n1. **Data_Status**: This column represents the status of the data for a given year and series. It contains string data, specifically codes that indicate whether the data is final, preliminary, or forecasted. An example value is \"2023F\", which suggests that the data is forecasted for the year 2023. The meaning of this value indicates that the data is not yet finalized and is subject to change.\n\n2. **MSN**: The \"MSN\" (Mnemonic Series Name) column contains a five-character code that identifies specific energy data series. This column is a string type and is crucial for categorizing the data. For instance, \"ABICB\" refers to \"Aviation gasoline blending components consumed by the industrial sector\". The structure of the code provides insights into the energy source, sector, and type of data being reported.\n\n3. **StateCode**: This column contains two-character string codes that represent U.S. states and territories, following the U.S. Postal Service abbreviations. For example, \"AK\" stands for Alaska. This column is essential for identifying the geographical context of the data, allowing users to filter or analyze data by state.\n\n4. **Year**: The \"Year\" column indicates the year for which the data is reported. It is an integer type formatted as a four-digit year (YYYY). For example, the value \"1960\" indicates that the data pertains to that specific year. This column is critical for time series analysis, allowing users to track changes over time.\n\n5. **Data**: This column contains the actual numerical values associated with the energy data series for the specified year, state, and MSN. The data type is typically a float or integer, depending on the context of the measurement. For instance, a value of \"0\" indicates no consumption or expenditure for that series in the given year. This column is the core of the dataset, providing the quantitative information needed for analysis.\n\n### Dataset Overview\n\nThe State Energy Data System (SEDS) dataset provides comprehensive annual time series estimates of state-level energy use, production, prices, and expenditures across various economic sectors in the United States. The dataset spans from 1960 to the present and includes data presented in physical units (BTUs) and monetary values (dollars). Each entry in the dataset is characterized by a unique combination of a mnemonic series name (MSN), state code, year, and the corresponding data value, which allows for detailed analysis of energy trends and patterns at the state level.\n\nThe dataset is structured to facilitate easy access and analysis, with specific columns dedicated to the status of the data, the type of energy being reported, the geographical context (state), and the temporal aspect (year). This structure enables users to perform targeted queries and extract meaningful insights regarding energy consumption, production, and pricing trends across different states and over time.';
