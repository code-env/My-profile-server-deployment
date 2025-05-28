"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomError = void 0;
class CustomError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'CustomError';
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, CustomError);
        }
    }
}
exports.CustomError = CustomError;
