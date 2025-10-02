import type { WSContext } from 'hono/ws';

// Store active WebSocket connections by connection ID
const wsConnections = new Map<string, WSContext>();

// Message types for categorization
export enum WSMessageType {
  STATE_TRANSITION = 'state_transition',
  SUB_STATE_LOG = 'sub_state_log',
  CHAIN_START = 'chain_start',
  CHAIN_END = 'chain_end',
  TOOL_START = 'tool_start',
  TOOL_END = 'tool_end',
  ERROR = 'error',
  INFO = 'info',
}

export interface WSMessage {
  type: WSMessageType;
  timestamp: string;
  data: any;
}

/**
 * Register a WebSocket connection
 */
export function registerWSConnection(connectionId: string, ws: WSContext) {
  wsConnections.set(connectionId, ws);
}

/**
 * Unregister a WebSocket connection
 */
export function unregisterWSConnection(connectionId: string) {
  wsConnections.delete(connectionId);
}

/**
 * Send a message to a specific WebSocket connection
 * If connectionId is undefined, logs a warning about the swallowed message
 */
export function sendToConnection(
  connectionId: string | undefined,
  message: WSMessage
) {
  if (!connectionId) {
    console.warn(
      '[WS] Message not sent - no connection ID provided:',
      message.type
    );
    return;
  }

  if (!wsConnections.has(connectionId)) {
    console.warn(
      `[WS] Message not sent - connection ${connectionId} not found:`,
      message.type
    );
    return;
  }

  const ws = wsConnections.get(connectionId);
  console.log('Sending message to connection:', connectionId, message);
  ws?.send(JSON.stringify(message));
}

/**
 * Global helper to log a state transition
 */
export function logStateTransition(
  connectionId: string | undefined,
  fromState: string,
  toState: string,
  metadata?: any
) {
  console.log(`[State] ${fromState} → ${toState}`);
  sendToConnection(connectionId, {
    type: WSMessageType.STATE_TRANSITION,
    timestamp: new Date().toISOString(),
    data: {
      from: fromState,
      to: toState,
      ...metadata,
    },
  });
}

/**
 * Global helper to log a sub-state update
 */
export function logSubState(
  connectionId: string | undefined,
  state: string,
  action: string,
  metadata?: any
) {
  console.log(`  [${state}] ${action}`);
  sendToConnection(connectionId, {
    type: WSMessageType.SUB_STATE_LOG,
    timestamp: new Date().toISOString(),
    data: {
      state,
      action,
      ...metadata,
    },
  });
}

/**
 * Global helper to log general information
 */
export function logInfo(
  connectionId: string | undefined,
  message: string,
  metadata?: any
) {
  console.log(`[Info] ${message}`);
  sendToConnection(connectionId, {
    type: WSMessageType.INFO,
    timestamp: new Date().toISOString(),
    data: {
      message,
      ...metadata,
    },
  });
}

/**
 * Global helper to log an error
 */
export function logError(
  connectionId: string | undefined,
  error: string | Error,
  context?: any
) {
  console.error(`[Error]`, error);
  sendToConnection(connectionId, {
    type: WSMessageType.ERROR,
    timestamp: new Date().toISOString(),
    data: {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      context,
    },
  });
}
