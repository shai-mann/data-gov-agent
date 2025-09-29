import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as cheerio from 'cheerio';
import { ONE_SECOND } from '../lib/utils';

/**
 * View DOI (Digital Object Identifier) information for a dataset
 */
export const doiView = tool(
  async ({ doi }) => {
    console.log(`🔗 DOI View - DOI: ${doi}`);

    try {
      // Fetch the DOI info using a basic fetch request in the HTML
      // TODO: use Langchain's built in HTML parsing tool for this?
      // TODO: add parsing node with separate model call for this tool?

      // 5 second timeout - if the download takes too long, abort it.
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5 * ONE_SECOND);

      const response = await fetch(doi, {
        redirect: 'follow',
        signal: controller.signal,
      });

      const html = await response.text();

      const $ = cheerio.load(html);
      const text = $('body').text().replace(/\s+/g, ' ').trim();

      console.log(`✅ DOI View - Retrieved info for: ${doi}`);
      return {
        success: true,
        doi_info: text.slice(2000, 7000), // safety: prevent token explosion
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
