"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const logger_1 = require("../utils/logger");
const mongodb_1 = require("mongodb");
const mongoose_1 = __importDefault(require("mongoose"));
const http_errors_1 = __importDefault(require("http-errors"));
/**
 * Global error handler middleware
 * Handles different types of errors and provides consistent error responses
 */
const errorHandler = (err, req, res, next) => {
    var _a;
    const response = {
        success: false,
        message: 'An unexpected error occurred',
    };
    // Log error with request context
    logger_1.logger.error('Error handling request:', {
        error: err,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a._id,
        stack: err.stack,
    });
    // Handle different error types
    if (http_errors_1.default.isHttpError(err)) {
        response.message = err.message;
        response.code = err.name;
        res.status(err.status);
    }
    else if (err instanceof mongoose_1.default.Error.ValidationError) {
        response.message = 'Validation Error';
        response.code = 'VALIDATION_ERROR';
        response.details = Object.values(err.errors).map(e => e.message);
        res.status(400);
    }
    else if (err instanceof mongodb_1.MongoError) {
        if (err.code === 11000) {
            response.message = 'Duplicate key error';
            response.code = 'DUPLICATE_KEY';
            res.status(409);
        }
        else {
            response.message = 'Database error';
            response.code = 'DATABASE_ERROR';
            res.status(500);
        }
    }
    else if (err instanceof Error) {
        response.message = err.message;
        response.code = err.name;
        res.status(500);
    }
    else {
        res.status(500);
    }
    // Add debugging information in development
    if (process.env.NODE_ENV === 'development') {
        response.details = {
            stack: err.stack,
            name: err.name,
        };
    }
    // Send error response
    res.json(response);
};
exports.errorHandler = errorHandler;
