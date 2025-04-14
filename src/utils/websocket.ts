import { Server as HTTPServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { DetailedRequestInfo } from './requestInfo';
import { logger } from './logger';
import { Express } from 'express';

let wss: WebSocketServer;
const clients = new Set<WebSocket>();

export const initializeWebSocket = (server: HTTPServer, app: Express) => {
  wss = new WebSocketServer({
    server,
    path: '/ws/logs' // Add specific path for logs WebSocket
  });

  // Store WSS instance in app.locals for middleware access
  app.locals.wss = wss;

  wss.on('connection', (ws) => {
    clients.add(ws);
    logger.info('New WebSocket client connected');

    ws.on('close', () => {
      clients.delete(ws);
      logger.info('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });
};

export const broadcastLog = (logEntry: DetailedRequestInfo) => {
  const message = JSON.stringify(logEntry);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        logger.error('Error broadcasting log:', error);
      }
    }
  });
};
