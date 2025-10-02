import { Hono } from 'hono';
import { upgradeWebSocket, websocket } from 'hono/bun';
import { cors } from 'hono/cors';
import { coreAgent } from '@agents';
import testing from './routes/testing';
import agents from './routes/agents';
import { registerWSConnection, logInfo, logError } from './lib/ws-logger';

const app = new Hono();

// Configure CORS
app.use(
  '*',
  cors({
    origin: ['http://localhost:3001', 'https://data-gov.shaimr.com'],
    credentials: true,
  })
);

// Mount routes
app.route('/test', testing);
app.route('/agents', agents);

// WebSocket endpoint - clients connect here and receive a connection ID
// Supports reconnection: pass ?connectionId=<existing-id> to reuse a connection ID
app.get(
  '/ws',
  upgradeWebSocket(c => {
    // Check if client wants to reuse an existing connection ID
    const requestedConnectionId = c.req.query('connectionId');
    const connectionId = requestedConnectionId || crypto.randomUUID();
    const isReconnect = !!requestedConnectionId;

    return {
      onOpen(_event, ws) {
        registerWSConnection(connectionId, ws);
        ws.send(
          JSON.stringify({
            type: 'connection',
            connectionId,
            reconnected: isReconnect,
          })
        );
        console.log(
          `[WebSocket] ${isReconnect ? 'Reconnected' : 'Connected'}: ${connectionId}`
        );
      },
      onMessage(event) {
        // Only log if it's an actual message, not just keepalive
        if (event.data && event.data !== 'ping') {
          console.log(`[WebSocket] Message from ${connectionId}`);
        }
      },
      onClose() {
        console.log(`[WebSocket] Disconnected: ${connectionId}`);
      },
      onError(event) {
        console.error(`[WebSocket] Error ${connectionId}:`, event);
      },
    };
  })
);

// Health check endpoint
app.get('/health', c => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Core agent production endpoint
app.post('/research', async c => {
  try {
    const { query, connectionId } = await c.req.json();

    if (!query) {
      return c.json({ error: 'Query parameter is required' }, 400);
    }

    logInfo(connectionId, 'Starting research query', { query });

    const result = await coreAgent.invoke({
      userQuery: query,
      connectionId,
    });

    logInfo(connectionId, 'Research complete', { result: result.output });

    return c.json({
      success: true,
      result: result.output,
    });
  } catch (error) {
    // Log error to WebSocket if connection exists
    const { connectionId } = await c.req.json();
    logError(
      connectionId,
      error instanceof Error ? error : new Error(String(error))
    );

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

// Export the Hono app for Bun with WebSocket support
export default {
  fetch: app.fetch,
  websocket,
};

// DON'T SERVE HERE
// Bun will automatically serve the app for you
