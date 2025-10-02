import { Hono } from 'hono';
import { searchAgent, evalAgent, queryAgent } from '../agents/index.ts';
import { datasetDownload } from '../tools/index.ts';
import { DATA_GOV_USER_QUERY_FORMATTING_PROMPT } from '../agents/core-agent/prompts.ts';
import { openai } from '../llms/index.ts';
import { z } from 'zod';

/**
 * This contains the main agent routes for the data.gov agent system.
 * These routes provide the core functionality broken out into separate agents.
 */

const agents = new Hono();

agents.post('/search', async c => {
  try {
    const { query } = await c.req.json();

    if (!query) {
      return c.json({ error: 'Query parameter is required' }, 400);
    }

    // Formatting, as the core agent does in the userQueryFormattingNode
    const prompt = await DATA_GOV_USER_QUERY_FORMATTING_PROMPT.formatMessages({
      query,
    });

    const formattingStructuredModel = openai.withStructuredOutput(
      z.object({
        query: z.string(),
      })
    );

    const { query: structuredResult } =
      await formattingStructuredModel.invoke(prompt);

    // Invoke the search agent to find datasets
    const result = await searchAgent.invoke({
      userQuery: structuredResult,
    });

    return c.json({
      success: true,
      datasets: result.datasets,
    });
  } catch (error) {
    console.error('Search Agent error:', error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      500
    );
  }
});

agents.post('/evaluate', async c => {
  try {
    const { datasets, query } = await c.req.json();

    if (!datasets || !Array.isArray(datasets) || !query) {
      return c.json({ error: 'Datasets array and query are required' }, 400);
    }

    // Evaluate each dataset in parallel, as the core agent does in the fan-out edge to the evalNode
    const evaluationPromises = datasets.map(async dataset => {
      try {
        const result = await evalAgent.invoke({
          dataset,
          userQuery: query,
        });
        return result.dataset;
      } catch (error) {
        console.error(`Error evaluating dataset ${dataset.id}:`, error);
        return {
          ...dataset,
          evaluation: {
            usable: false,
            reason:
              error instanceof Error ? error.message : 'Unknown error occurred',
          },
        };
      }
    });

    const evaluatedDatasets = await Promise.allSettled(evaluationPromises);

    return c.json({
      success: true,
      datasets: evaluatedDatasets,
    });
  } catch (error) {
    console.error('Evaluate Agent error:', error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      500
    );
  }
});

agents.post('/query', async c => {
  try {
    const { query, dataset } = await c.req.json();

    if (!query || !dataset) {
      return c.json({ error: 'Query and dataset are required' }, 400);
    }

    // Pre-fetch the dataset
    await datasetDownload.invoke({
      resourceUrl: dataset.evaluation.bestResource,
    });

    const result = await queryAgent.invoke({
      userQuery: query,
      dataset,
    });

    return c.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Query Agent error:', error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      500
    );
  }
});

export default agents;
