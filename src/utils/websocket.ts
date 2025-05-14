// utils/websocket.ts
import { Server as HTTPServer } from 'http';
import WebSocket from 'ws';
import { Server as SocketIOServer } from 'socket.io';
import { DetailedRequestInfo } from './requestInfo';
import { logger } from './logger';
import { Express } from 'express';
import { InteractionService } from '../services/interaction.service';
import { Interaction } from '../models/Interaction';
import { PresenceService } from '../services/presence.service';

// Existing WebSocket for logs
let wss: WebSocket.Server;
const clients = new Set<WebSocket>();

// Socket.IO for real-time interactions
let io: SocketIOServer;
let interactionService: InteractionService;
let presenceService: PresenceService;

export const initializeWebSocket = (server: HTTPServer, app: Express) => {
  // Initialize WebSocketServer for logs (keep existing functionality)
  wss = new WebSocket.Server({
    server,
    path: '/ws/logs'
  });

  // Initialize Socket.IO for real-time interactions
  io = new SocketIOServer(server, {
    cors: {
      origin: "*", // Adjust for production
      methods: ["GET", "POST"]
    },
    path: '/socket.io' // Different path from WS
  });

  // Initialize interaction service and set up socket server
  console.info('Initializing interaction service...');
  interactionService = new InteractionService(Interaction);
  interactionService.setSocketServer(io);

  // Initialize presence service for online/offline status
  console.info('Initializing presence service...');
  presenceService = new PresenceService();
  presenceService.setSocketServer(io);

  // Set up Socket.IO connection handler for presence
  io.on('connection', (socket) => {
    logger.info(`New Socket.IO connection: ${socket.id}`);

    // Handle presence connection
    socket.on('presence:connect', (data) => {
      if (data.userId && data.profileId) {
        const deviceInfo = {
          userAgent: socket.handshake.headers['user-agent'] || '',
          ip: socket.handshake.address,
          deviceType: data.deviceType || 'unknown'
        };

        presenceService.handleUserConnect(
          data.userId,
          data.profileId,
          socket,
          deviceInfo
        );
      }
    });
  });

  // Existing WS connection handling for logs
  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);
    logger.info('New WebSocket client connected for logs');

    ws.on('close', () => {
      clients.delete(ws);
      logger.info('WebSocket client disconnected');
    });

    ws.on('error', (error: Error) => {
      logger.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  // Store instances in app.locals for middleware access
  app.locals.wss = wss;
  app.locals.io = io;
  app.locals.interactionService = interactionService;
  app.locals.presenceService = presenceService;
};

// Existing log broadcast function
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

// Get Socket.IO instance
export const getIO = (): SocketIOServer => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};

// Get InteractionService instance
export const getInteractionService = (): InteractionService => {
  if (!interactionService) throw new Error('InteractionService not initialized');
  return interactionService;
};

// Get PresenceService instance
export const getPresenceService = (): PresenceService => {
  if (!presenceService) throw new Error('PresenceService not initialized');
  return presenceService;
};
