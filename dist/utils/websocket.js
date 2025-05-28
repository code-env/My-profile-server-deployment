"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPresenceService = exports.getInteractionService = exports.getIO = exports.broadcastLog = exports.initializeWebSocket = void 0;
const ws_1 = __importDefault(require("ws"));
const socket_io_1 = require("socket.io");
const logger_1 = require("./logger");
const interaction_service_1 = require("../services/interaction.service");
const Interaction_1 = require("../models/Interaction");
const presence_service_1 = require("../services/presence.service");
// Existing WebSocket for logs
let wss;
const clients = new Set();
// Socket.IO for real-time interactions
let io;
let interactionService;
let presenceService;
const initializeWebSocket = (server, app) => {
    // Initialize WebSocketServer for logs (keep existing functionality)
    wss = new ws_1.default.Server({
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
    // Initialize interaction service and set up socket server
    console.info('Initializing interaction service...');
    interactionService = new interaction_service_1.InteractionService(Interaction_1.Interaction);
    interactionService.setSocketServer(io);
    // Initialize presence service for online/offline status
    console.info('Initializing presence service...');
    presenceService = new presence_service_1.PresenceService();
    presenceService.setSocketServer(io);
    // Set up Socket.IO connection handler for presence
    io.on('connection', (socket) => {
        logger_1.logger.info(`New Socket.IO connection: ${socket.id}`);
        // Handle presence connection
        socket.on('presence:connect', (data) => {
            if (data.userId && data.profileId) {
                const deviceInfo = {
                    userAgent: socket.handshake.headers['user-agent'] || '',
                    ip: socket.handshake.address,
                    deviceType: data.deviceType || 'unknown'
                };
                presenceService.handleUserConnect(data.userId, data.profileId, socket, deviceInfo);
            }
        });
    });
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
    // Store instances in app.locals for middleware access
    app.locals.wss = wss;
    app.locals.io = io;
    app.locals.interactionService = interactionService;
    app.locals.presenceService = presenceService;
};
exports.initializeWebSocket = initializeWebSocket;
// Existing log broadcast function
const broadcastLog = (logEntry) => {
    const message = JSON.stringify(logEntry);
    clients.forEach((client) => {
        if (client.readyState === ws_1.default.OPEN) {
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
// Get PresenceService instance
const getPresenceService = () => {
    if (!presenceService)
        throw new Error('PresenceService not initialized');
    return presenceService;
};
exports.getPresenceService = getPresenceService;
