"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInteractionService = exports.getIO = exports.broadcastLog = exports.initializeWebSocket = void 0;
const ws_1 = require("ws");
const socket_io_1 = require("socket.io");
const logger_1 = require("./logger");
const interaction_service_1 = require("../services/interaction.service");
const Interaction_1 = require("../models/Interaction");
// Existing WebSocket for logs
let wss;
const clients = new Set();
// Socket.IO for real-time interactions
let io;
let interactionService;
const initializeWebSocket = (server, app) => {
    // Initialize WebSocketServer for logs (keep existing functionality)
    wss = new ws_1.WebSocketServer({
        server,
        path: '/ws/logs'
    });
    // Initialize Socket.IO for real-time interactions
    io = new socket_io_1.Server(server, {
        cors: {
            origin: "*", // Adjust for production
            methods: ["GET", "POST"]
        },
        path: '/socket.io' // Different path from WS
    });
    // Initialize interaction service
    interactionService = new interaction_service_1.InteractionService(Interaction_1.Interaction);
    // Existing WS connection handling for logs
    wss.on('connection', (ws) => {
        clients.add(ws);
        logger_1.logger.info('New WebSocket client connected for logs');
        ws.on('close', () => {
            clients.delete(ws);
            logger_1.logger.info('WebSocket client disconnected');
        });
        ws.on('error', (error) => {
            logger_1.logger.error('WebSocket error:', error);
            clients.delete(ws);
        });
    });
    // Socket.IO connection handling for interactions
    io.on('connection', (socket) => {
        const userId = socket.handshake.query.userId;
        if (userId) {
            interactionService.registerUserSocket(userId, socket);
            logger_1.logger.info(`User ${userId} connected via Socket.IO`);
        }
        socket.on('disconnect', () => {
            logger_1.logger.info('Socket.IO client disconnected');
        });
    });
    // Store instances in app.locals for middleware access
    app.locals.wss = wss;
    app.locals.io = io;
    app.locals.interactionService = interactionService;
};
exports.initializeWebSocket = initializeWebSocket;
// Existing log broadcast function
const broadcastLog = (logEntry) => {
    const message = JSON.stringify(logEntry);
    clients.forEach((client) => {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            try {
                client.send(message);
            }
            catch (error) {
                logger_1.logger.error('Error broadcasting log:', error);
            }
        }
    });
};
exports.broadcastLog = broadcastLog;
// Get Socket.IO instance
const getIO = () => {
    if (!io)
        throw new Error('Socket.IO not initialized');
    return io;
};
exports.getIO = getIO;
// Get InteractionService instance
const getInteractionService = () => {
    if (!interactionService)
        throw new Error('InteractionService not initialized');
    return interactionService;
};
exports.getInteractionService = getInteractionService;
