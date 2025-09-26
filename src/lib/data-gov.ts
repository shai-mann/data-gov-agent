import {
  PackageAutocompleteResponse,
  PackageAutocompleteResponseSchema,
  PackageSearchResponse,
  PackageSearchResponseSchema,
  SinglePackageResponse,
  SinglePackageResponseSchema,
} from './data-gov.schemas';

export const DATA_GOV_API_URL = 'https://catalog.data.gov/api/3';

export const DATA_GOV_API_KEY = process.env.DATA_GOV_API_KEY!;

export async function searchPackages(query: string) {
  const response = await fetch(
    `${DATA_GOV_API_URL}/action/package_search?q=${query}`,
    {
      method: 'GET',
      headers: {
        'x-api-key': DATA_GOV_API_KEY,
      },
    }
  );

  // Validate the response
  const result = PackageSearchResponseSchema.parse(await response.json());

  return result satisfies PackageSearchResponse;
}

export async function packageAutocomplete(query: string) {
  const response = await fetch(
    `${DATA_GOV_API_URL}/action/package_autocomplete?q=${query}`,
    {
      method: 'GET',
    }
  );

  const result = PackageAutocompleteResponseSchema.parse(await response.json());

  return result satisfies PackageAutocompleteResponse;
}

export async function getPackage(packageId: string) {
  const response = await fetch(
    `${DATA_GOV_API_URL}/action/package_show?id=${packageId}`,
    {
      method: 'GET',
    }
  );

  // Validate the response
  const result = SinglePackageResponseSchema.parse(await response.json());

  return result satisfies SinglePackageResponse;
}
