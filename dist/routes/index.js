"use strict";
/**
 * @fileoverview Central route configuration
 * Sets up all API routes with proper middleware and validation
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRoutes = void 0;
const auth_routes_1 = __importDefault(require("./auth.routes"));
const profile_routes_1 = __importDefault(require("./profile.routes"));
const connection_routes_1 = __importDefault(require("./connection.routes"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const setupRoutes = (app) => {
    // Public routes
    app.use('/api/auth', auth_routes_1.default);
    // Protected routes
    app.use('/api/profiles', auth_middleware_1.protect, profile_routes_1.default);
    app.use('/api/connections', auth_middleware_1.protect, connection_routes_1.default);
    // Register additional routes here
};
exports.setupRoutes = setupRoutes;
