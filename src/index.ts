import { Hono } from 'hono';
import dataGovAgent from './agents/dataGovAgent';
import queryAgent from './agents/queryAgent';
import datasetSearchAgent from './agents/datasetSearchAgent';

const app = new Hono();

// Create v1 sub-application
const v1 = new Hono();

// Health check endpoint
v1.get('/health', c => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Data Gov Agent endpoint
v1.post('/data-gov/search', async c => {
  try {
    const { query } = await c.req.json();

    if (!query) {
      return c.json({ error: 'Query parameter is required' }, 400);
    }

    const result = await dataGovAgent.invoke({
      userQuery: query,
    });

    return c.json({
      success: true,
      result: result.evaluatedDatasets.find(
        dataset => dataset.id === result.finalDataset?.id
      ),
      evaluatedDatasets: result.evaluatedDatasets,
      datasets: result.datasets,
      query: result.userQuery,
    });
  } catch (error) {
    console.error('Data Gov Agent error:', error);
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

v1.post('/test/dataset-search', async c => {
  try {
    const { query } = await c.req.json();

    if (!query) {
      return c.json({ error: 'Query parameter is required' }, 400);
    }

    const result = await datasetSearchAgent.invoke({
      userQuery: query,
    });

    return c.json({
      success: true,
      result: result.datasets,
      userQuery: result.userQuery,
      messages: result.messages,
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

v1.post('/test/query', async c => {
  try {
    const { query, dataset } = await c.req.json();

    if (!query || !dataset) {
      return c.json({ error: 'Query and dataset are required' }, 400);
    }

    const result = await queryAgent.invoke(
      {
        userQuery: query,
        dataset,
      },
      {
        recursionLimit: 40, // TEMPORARY testing to see how long it takes to get there
      }
    );

    return c.json({
      success: true,
      result: result.summary,
      messages: result.messages,
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

// Mount v1 routes under /v1
app.route('/v1', v1);

// 404 handler
app.notFound(c => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

// Export the Hono app for serverless deployment
export default app;

// DON'T SERVE HERE
// Bun will automatically serve the app for you
