import { Hono } from 'hono';
import dataGovAgent from './agents/dataGovAgent';
import { HumanMessage } from '@langchain/core/messages';
import { datasetDownload, doiView } from './tools';

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
      messages: [
        new HumanMessage({
          content: query,
        }),
      ],
    });

    return c.json({
      success: true,
      result: result.selectedDataset,
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

v1.get('/testing/tool', async c => {
  const { resourceUrl, format, limit, offset } = c.req.query();

  if (!['CSV'].find(f => f === format)) {
    return c.json({ error: 'Invalid format' }, 400);
  }

  const result = await datasetDownload.func({
    resourceUrl,
    format: format as 'CSV',
    limit: limit ? parseInt(limit) : 3,
    offset: offset ? parseInt(offset) : 0,
  });
  return c.json({
    success: true,
    result: result,
  });
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
