import { Hono } from 'hono';
import { coreAgent } from '@agents';
import testing from './routes/testing';
import agents from './routes/agents';

const app = new Hono();

// Mount routes
app.route('/test', testing);
app.route('/agents', agents);

// Health check endpoint
app.get('/health', c => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Core agent production endpoint
app.post('/research', async c => {
  try {
    const { query } = await c.req.json();

    if (!query) {
      return c.json({ error: 'Query parameter is required' }, 400);
    }

    const result = await coreAgent.invoke({
      userQuery: query,
    });

    return c.json({
      success: true,
      ...result,
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
