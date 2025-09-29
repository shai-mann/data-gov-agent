import { Hono } from 'hono';
import dataGovAgent from './agents/dataGovAgent';

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
      query: query,
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
