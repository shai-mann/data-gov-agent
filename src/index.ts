import { Hono } from 'hono';
import { upgradeWebSocket, websocket } from 'hono/bun';
import type { WSContext } from 'hono/ws';
import { cors } from 'hono/cors';
import { coreAgent } from '@agents';
import testing from './routes/testing';
import agents from './routes/agents';

// Store active WebSocket connections by connection ID
const wsConnections = new Map<string, WSContext>();

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
app.get(
  '/ws',
  upgradeWebSocket(() => {
    const connectionId = crypto.randomUUID();

    return {
      onOpen(_event, ws) {
        wsConnections.set(connectionId, ws);
        ws.send(JSON.stringify({ type: 'connection', connectionId }));
        console.log(`WebSocket connected: ${connectionId}`);
      },
      onMessage(event) {
        console.log(`Message from ${connectionId}:`, event.data);
      },
      onClose() {
        wsConnections.delete(connectionId);
        console.log(`WebSocket disconnected: ${connectionId}`);
      },
      onError(event) {
        console.error(`WebSocket error for ${connectionId}:`, event);
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

    // Helper function to send messages to the client via WebSocket
    const sendToClient = (message: { type: string; data?: any }) => {
      if (connectionId && wsConnections.has(connectionId)) {
        const ws = wsConnections.get(connectionId);
        ws?.send(JSON.stringify(message));
      }
    };

    sendToClient({ type: 'start', data: { query } });

    const result = await coreAgent.invoke(
      {
        userQuery: query,
      },
      {
        callbacks: [
          {
            handleChainStart(
              _chain,
              _inputs,
              _runId,
              _parentRunId,
              _tags,
              _metadata,
              runName
            ) {
              sendToClient({ type: 'chain_start', data: { runName } });
            },
            handleChainEnd(_outputs, _runId, _parentRunId, _tags, runName) {
              sendToClient({ type: 'chain_end', data: { runName } });
            },
            handleToolStart(
              _tool,
              _input,
              _runId,
              _parentRunId,
              _tags,
              _metadata,
              name
            ) {
              sendToClient({ type: 'tool_start', data: { name } });
            },
            handleToolEnd(output, runId, parentRunId, tags) {
              sendToClient({
                type: 'tool_end',
                data: { output, runId, parentRunId, tags },
              });
            },
          },
        ],
      }
    );

    sendToClient({ type: 'complete', data: { result: result.output } });

    return c.json({
      success: true,
      result: result.output,
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

// Export the Hono app for Bun with WebSocket support
export default {
  fetch: app.fetch,
  websocket,
};

// DON'T SERVE HERE
// Bun will automatically serve the app for you
