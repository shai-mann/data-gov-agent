import { DatasetSelection, DatasetWithEvaluation } from '../../lib/annotation';

/*
 * Mock datasets for testing.
 */
export const MOCK_DATASETS = [
  {
    id: 'e219a097-b2fe-4c81-bf07-b6e27bf0b09c',
    title: 'Age-by-Race Specific Crime Rates, 1965-1985:  [United States]',
    reason:
      'This dataset examines age-specific crime rates, which can help analyze the percentage of crimes committed by individuals over 80 years old.',
  },
  {
    id: 'f468fe8a-a319-464f-9374-f77128ffc9dc',
    title: 'NYPD Arrest Data (Year to Date)',
    reason:
      'This dataset includes demographic information about offenders, including age, which can be used to determine the percentage of crimes committed by those over 80.',
  },
  {
    id: 'de7df4d0-aab6-4de1-9329-1db57e84a22e',
    title: 'NYPD Shooting Incident Data (Historic)',
    reason:
      'This dataset provides information on shooting incidents, including offender demographics, which can help assess crimes committed by older individuals.',
  },
  {
    id: '02300200-a311-43b5-8cb5-10dc81ced205',
    title: 'NYPD Arrests Data (Historic)',
    reason:
      'This dataset contains historical arrest data with demographic details, including age, useful for analyzing crime rates among older populations.',
  },
  {
    id: '9f440483-56ed-4d7c-a464-c660949808ba',
    title: 'Felony Sentences',
    reason:
      'This dataset includes demographic information on offenders, such as age, which can be analyzed to find the percentage of crimes committed by those over 80.',
  },
  {
    id: 'f6731209-f2b6-4786-9ce2-306d9accb8f6',
    title:
      'Drug overdose death rates, by drug type, sex, age, race, and Hispanic origin: United States',
    reason:
      'This dataset provides age-specific death rates, which can be useful in understanding crime-related deaths among older populations.',
  },
  {
    id: '37f7cedc-4ed8-4569-99a9-0c36f1af7152',
    title: 'Arrest Data',
    reason:
      'This dataset provides national arrest estimates detailed by age, which can help analyze the percentage of crimes committed by individuals over 80.',
  },
  {
    id: 'c5f53aa3-78a2-4b3b-acc2-57396fa30b6e',
    title: 'Mental Health Care in the Last 4 Weeks',
    reason:
      'This dataset includes demographic information that may help in understanding the relationship between age and crime.',
  },
  {
    id: '8dc5d5f6-9799-4230-9a90-7d7d77853cbe',
    title: 'NCHS - Injury Mortality: United States',
    reason:
      'This dataset provides information on injury mortality, which can be relevant to understanding crime rates among older individuals.',
  },
  {
    id: '405652c8-9146-4e16-8604-c6c04892a956',
    title:
      'Death rates for suicide, by sex, race, Hispanic origin, and age: United States',
    reason:
      'This dataset provides age-specific death rates, which can be useful in understanding crime-related deaths among older populations.',
  },
] satisfies DatasetSelection[];

export const MOCK_EVALUATED_DATASETS = [
  {
    id: 'e219a097-b2fe-4c81-bf07-b6e27bf0b09c',
    title: 'Age-by-Race Specific Crime Rates, 1965-1985:  [United States]',
    reason:
      'This dataset examines age-specific crime rates, which can help analyze the percentage of crimes committed by individuals over 80 years old.',
    evaluation: {
      relevant: true,
      score: 85,
      reasoning:
        "The dataset provides age-by-race specific crime rates from 1965 to 1985, which includes data on arrests and crime rates for various age groups. This can help analyze the percentage of crimes committed by individuals over 80 years old. The dataset is comprehensive in its coverage of age-specific crime rates, making it suitable for answering the user's question. However, it is important to note that the dataset only covers a historical period and may not reflect current trends.",
      bestResource: '[DOI Link](https://doi.org/10.3886/ICPSR09589)',
    },
  },
  {
    id: 'f468fe8a-a319-464f-9374-f77128ffc9dc',
    title: 'NYPD Arrest Data (Year to Date)',
    reason:
      'This dataset includes demographic information about offenders, including age, which can be used to determine the percentage of crimes committed by those over 80.',
    evaluation: {
      relevant: true,
      score: 85,
      reasoning:
        'The dataset includes demographic information about offenders, specifically their age, which allows for the calculation of the percentage of crimes committed by individuals over 80 years old. The CSV format provides structured data that can be analyzed to extract the required information. For example, queries can be made to count the total number of arrests and the number of arrests for individuals aged 80 and above, enabling the calculation of the desired percentage.',
      bestResource:
        '[NYPD Arrest Data (Year to Date)](https://data.cityofnewyork.us/d/uip8-fykc)',
    },
  },
  {
    id: 'de7df4d0-aab6-4de1-9329-1db57e84a22e',
    title: 'NYPD Shooting Incident Data (Historic)',
    reason:
      'This dataset provides information on shooting incidents, including offender demographics, which can help assess crimes committed by older individuals.',
    evaluation: {
      relevant: true,
      score: 85,
      reasoning:
        "The dataset includes detailed information about shooting incidents in NYC, including offender demographics such as age. This allows for the analysis of crimes committed by individuals over 80 years old. The dataset's structure includes columns for the perpetrator's age group, which can be used to calculate the percentage of crimes committed by this demographic.",
      bestResource:
        '[NYPD Shooting Incident Data (Historic) CSV](https://data.cityofnewyork.us/api/views/833y-fsy8/rows.csv?accessType=DOWNLOAD)',
    },
  },
  {
    id: '02300200-a311-43b5-8cb5-10dc81ced205',
    title: 'NYPD Arrests Data (Historic)',
    reason:
      'This dataset contains historical arrest data with demographic details, including age, useful for analyzing crime rates among older populations.',
    evaluation: {
      relevant: true,
      score: 85,
      reasoning:
        'The dataset contains historical arrest data with demographic details, including age, which is essential for analyzing crime rates among older populations. Although the CSV resource could not be downloaded, the DOI information indicates that the dataset includes relevant fields such as age, arrest date, and crime descriptions, which can be used to calculate the percentage of crimes committed by individuals over 80 years old.',
      bestResource:
        '[NYPD Arrests Data (Historic)](https://data.cityofnewyork.us/d/8h9b-rp9u)',
    },
  },
  {
    id: '9f440483-56ed-4d7c-a464-c660949808ba',
    title: 'Felony Sentences',
    reason:
      'This dataset includes demographic information on offenders, such as age, which can be analyzed to find the percentage of crimes committed by those over 80.',
    evaluation: {
      relevant: true,
      score: 85,
      reasoning:
        'The dataset contains demographic information on offenders, including age groups, which allows for the calculation of the percentage of crimes committed by individuals over 80 years old. The CSV format is suitable for analysis, and the dataset is comprehensive, covering felony counts sentenced from 2010 onward.',
      bestResource:
        '[Felony Sentences CSV](https://opendata.dc.gov/api/download/v1/items/f92f4556f26b4737a040fb996eaefca3/csv?layers=40)',
    },
  },
  {
    id: 'f6731209-f2b6-4786-9ce2-306d9accb8f6',
    title:
      'Drug overdose death rates, by drug type, sex, age, race, and Hispanic origin: United States',
    reason:
      'This dataset provides age-specific death rates, which can be useful in understanding crime-related deaths among older populations.',
    evaluation: {
      relevant: false,
    },
  },
  {
    id: '37f7cedc-4ed8-4569-99a9-0c36f1af7152',
    title: 'Arrest Data',
    reason:
      "The dataset provides national arrest estimates detailed by age, which could potentially help analyze the percentage of crimes committed by individuals over 80. However, the only available resource is in HTML format, which does not allow for direct data analysis or extraction of numerical values. Therefore, it cannot be used to answer the user's question effectively.",
    evaluation: {
      relevant: false,
    },
  },
  {
    id: 'c5f53aa3-78a2-4b3b-acc2-57396fa30b6e',
    title: 'Mental Health Care in the Last 4 Weeks',
    reason:
      'This dataset includes demographic information that may help in understanding the relationship between age and crime.',
    evaluation: {
      relevant: false,
    },
  },
  {
    id: '8dc5d5f6-9799-4230-9a90-7d7d77853cbe',
    title: 'NCHS - Injury Mortality: United States',
    reason:
      'This dataset provides information on injury mortality, which can be relevant to understanding crime rates among older individuals.',
    evaluation: {
      relevant: false,
    },
  },
  {
    id: '405652c8-9146-4e16-8604-c6c04892a956',
    title:
      'Death rates for suicide, by sex, race, Hispanic origin, and age: United States',
    reason:
      'This dataset provides age-specific death rates, which can be useful in understanding crime-related deaths among older populations.',
    evaluation: {
      relevant: false,
    },
  },
] satisfies DatasetWithEvaluation[];
