import { Hono } from 'hono';
import {
  searchAgent,
  shallowEvalAgent,
  queryAgent,
  resourceEvalAgent,
} from '@agents';
import { packageShow, datasetDownload } from '@tools';
import { ResourceEvaluation } from '../agents/resource-eval-agent/annotations';

/**
 * This contains testing routes for hitting the individual agents without any bells and whistles.
 * Other routes will provide more complete functionality, but this is intended for isolated testing of single agents.
 */

const testing = new Hono();

testing.post('/search', async c => {
  try {
    const { query } = await c.req.json();

    if (!query) {
      return c.json({ error: 'Query parameter is required' }, 400);
    }

    const result = await searchAgent.invoke({
      userQuery: query,
    });

    return c.json({
      success: true,
      ...result,
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

testing.post('/shallow-eval', async c => {
  try {
    const { datasetId, query } = await c.req.json();

    const dataset = await packageShow.invoke({
      packageId: datasetId,
    });

    const result = await shallowEvalAgent.invoke({
      dataset,
      userQuery: query,
    });

    return c.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Shallow eval error:', error);
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

testing.post('/resource-eval', async c => {
  try {
    const { resource, query } = await c.req.json();

    const result = await resourceEvalAgent.invoke({
      resource,
      userQuery: query,
    });

    return c.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Resource eval error:', error);
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

testing.post('/query', async c => {
  try {
    const { query, dataset } = await c.req.json();

    if (!query || !dataset) {
      return c.json({ error: 'Query and dataset are required' }, 400);
    }

    const resource = dataset.evaluations.find(
      (r: ResourceEvaluation) => r.url === dataset.bestResource
    );

    if (!resource) {
      return c.json({ error: 'Resource not found' }, 400);
    }

    // Pre-fetch the dataset
    await datasetDownload.invoke({
      resourceUrl: resource.url,
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

export default testing;
