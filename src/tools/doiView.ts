import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as cheerio from 'cheerio';
import { ONE_SECOND } from '../lib/utils.ts';
import * as ExcelJS from 'exceljs';

/**
 * In order from most restrictive to least restrictive, HTML selectors that may contain the core content on a page.
 * The ordering is intentional so the returned value is hopefully the most specific selector, giving the most useful content.
 */
const HTML_SELECTORS = [
  // Most restrictive / semantic
  'main', // semantic HTML5
  'article', // common for blog/official docs
  '.usa-layout-docs__main', // common on US gov sites
  '.main-content', // common CMS pattern
  '#main-content', // common ID
  '.content-area', // Wordpress-like
  '.entry-content', // another Wordpress-like
  '.post-content', // blog/article structure
  '.page-content', // general CMS style
  '.gov-main', // sometimes in .gov sites
  '.body-content', // catchall
  'body', // fallback: grab everything
];

function getCoreContent($: cheerio.CheerioAPI) {
  for (const selector of HTML_SELECTORS) {
    const text = $(selector).text().replace(/\s+/g, ' ').trim();
    if (text && text.length > 200) {
      // require some minimum length to avoid false hits
      return text;
    }
  }

  return ''; // if nothing worked
}

/**
 * Parse an XLSX file in-memory from a fetch response
 * @param {Response} fetchResponse - the Response object from fetch(url)
 * @returns {Promise<Array<Object>>} - array of rows as objects with column headers as keys
 */
async function xlsxHandler(fetchResponse: Response) {
  const buffer = await fetchResponse.arrayBuffer();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer); // load workbook in-memory

  const parsedSheets = workbook.worksheets
    .map(parseWorksheet)
    // Slice to 10,000 characters total, so some of all sheets are included
    .map(sheet => sheet.slice(0, 10000 / workbook.worksheets.length));

  return parsedSheets.join('\n-----\n').trim();
}

function parseWorksheet(worksheet: ExcelJS.Worksheet) {
  const lines: string[] = [];

  worksheet.eachRow({ includeEmpty: true }, row => {
    const values = row.values;
    let cells: string[] = [];

    if (Array.isArray(values)) {
      // Normal array case: skip the dummy first element
      cells = values.slice(1).map(v => (v != null ? JSON.stringify(v) : ''));
    } else if (typeof values === 'object' && values !== null) {
      // Object case: sort keys numerically and map to strings
      const sortedKeys = Object.keys(values)
        .map(Number)
        .filter(k => !isNaN(k))
        .sort((a, b) => a - b);
      cells = sortedKeys.map(k => (values[k] != null ? String(values[k]) : ''));
    }

    lines.push(cells.join('\t'));
  });

  return lines.join('\n');
}

const IGNORED_LINK_TYPES = ['.jpeg', '.jpg', '.png', '.gif', '.docx', '.csv'];

/**
 * View DOI (Digital Object Identifier) information for a dataset.
 * The models all seem to use this as a catch-all for any non-dataset resource link.
 * It's not intentional usage, but I'm adding parsing for other data formats to help them anyways.
 */
export const doiView = tool(
  async ({ doi }) => {
    console.log(`🔗 DOI View - DOI: ${doi}`);

    // Skip ignored link types
    if (IGNORED_LINK_TYPES.some(type => doi.includes(type))) {
      return {
        success: false,
        error: 'This link is not a valid non-dataset resource link.',
        doi_info: null,
      };
    }

    try {
      // Fetch the DOI info using a basic fetch request in the HTML
      // TODO: FUTURE IDEA: use Langchain's built in HTML parsing tool for this?
      // TODO: FUTURE IDEA: add parsing node with separate model call for this tool?

      // 5 second timeout - if the download takes too long, abort it.
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5 * ONE_SECOND);

      const response = await fetch(doi, {
        redirect: 'follow',
        signal: controller.signal,
      });

      let text = '';

      if (doi.includes('xls') || doi.includes('xlsx')) {
        text = await xlsxHandler(response);
      } else {
        const html = await response.text();

        const $ = cheerio.load(html);
        text = getCoreContent($);
      }

      console.log(`✅ DOI View - Retrieved info for: ${doi}`);

      if (
        text.startsWith('Error') ||
        text.startsWith('The page does not exist for')
      ) {
        return {
          success: false,
          error: 'This page does not exist.',
          doi_info: null,
        };
      }

      return {
        success: true,
        doi_info: text.slice(0, 10000), // safety: prevent token explosion
      };
    } catch (error) {
      console.log(`❌ DOI View - Error:`, error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
        doi_info: null,
      };
    }
  },
  {
    name: 'doi_view',
    description:
      'View DOI (Digital Object Identifier) information for a dataset. Returns metadata about the dataset including title, authors, publisher, and citation information.',
    schema: z.object({
      doi: z.string().describe('The full DOI link to view'),
    }),
  }
);
