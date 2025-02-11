"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastLog = exports.initializeWebSocket = void 0;
const ws_1 = require("ws");
const logger_1 = require("./logger");
let wss;
const clients = new Set();
const initializeWebSocket = (server) => {
    wss = new ws_1.WebSocket.Server({ server });
    wss.on('connection', (ws) => {
        clients.add(ws);
        logger_1.logger.info('New WebSocket client connected');
        ws.on('close', () => {
            clients.delete(ws);
            logger_1.logger.info('WebSocket client disconnected');
        });
        ws.on('error', (error) => {
            logger_1.logger.error('WebSocket error:', error);
            clients.delete(ws);
        });
    });
};
exports.initializeWebSocket = initializeWebSocket;
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
