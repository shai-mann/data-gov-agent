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
    id: 'f468fe8a-a319-464f-9374-f77128ffc9dc',
    title: 'NYPD Arrest Data (Year to Date)',
    reason:
      'This dataset includes demographic information about offenders, including age, which can be used to determine the percentage of crimes committed by those over 80.',
    evaluation: {
      usable: true,
      score: 85,
      reasoning:
        'The dataset includes demographic information about offenders, specifically the "AGE_GROUP" column, which can be used to determine the percentage of crimes committed by individuals over 80 years old. The data is structured and provides a comprehensive view of arrests, allowing for analysis of age-related crime statistics. For example, queries can be made to count the total arrests and those specifically for the age group "80+" to calculate the desired percentage.',
      bestResource:
        '[NYPD Arrest Data (Year to Date) - CSV](https://data.cityofnewyork.us/api/views/uip8-fykc/rows.csv?accessType=DOWNLOAD)',
    },
  },
  {
    id: 'de7df4d0-aab6-4de1-9329-1db57e84a22e',
    title: 'NYPD Shooting Incident Data (Historic)',
    reason:
      'This dataset provides information on shooting incidents, including offender demographics, which can help assess crimes committed by older individuals.',
    evaluation: {
      usable: true,
      score: 75,
      reasoning:
        "The dataset includes offender demographics, specifically the age group of perpetrators, which is essential for determining the percentage of crimes committed by individuals over 80 years old. The CSV format allows for easy analysis of the data. For example, queries can be made to filter incidents where the perpetrator's age group includes '80+' and compare that to the total number of incidents.",
      bestResource:
        '[NYPD Shooting Incident Data (Historic) - CSV](https://data.cityofnewyork.us/api/views/833y-fsy8/rows.csv?accessType=DOWNLOAD)',
    },
  },
  {
    id: '9f440483-56ed-4d7c-a464-c660949808ba',
    title: 'Felony Sentences',
    reason:
      'This dataset includes demographic information on offenders, such as age, which can be analyzed to find the percentage of crimes committed by those over 80.',
    evaluation: {
      usable: true,
      score: 85,
      reasoning:
        'The dataset contains demographic information, including age groups of offenders, which can be analyzed to determine the percentage of crimes committed by individuals over 80 years old. The columns include "AGE_GROUP" and various offense details, allowing for specific queries regarding age demographics and crime rates. For example, one could filter the dataset for entries where "AGE_GROUP" indicates "80+" and compare that to the total number of offenses to calculate the desired percentage.',
      bestResource:
        '[CSV Dataset](https://opendata.dc.gov/api/download/v1/items/f92f4556f26b4737a040fb996eaefca3/csv?layers=40)',
    },
  },
] satisfies DatasetWithEvaluation[];
