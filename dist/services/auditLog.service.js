"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = require("../utils/logger");
// Define audit log schema
const auditLogSchema = new mongoose_1.default.Schema({
    userId: String,
    action: String,
    resourceType: String,
    resourceId: String,
    changes: Object,
    ipAddress: String,
    userAgent: String,
    deviceFingerprint: String,
    status: String,
    errorMessage: String,
    timestamp: { type: Date, default: Date.now },
    metadata: Object
});
const AuditLog = mongoose_1.default.model('AuditLog', auditLogSchema);
class AuditLogService {
    static async log(params) {
        try {
            const { userId, action, resourceType, resourceId, changes, request, status, errorMessage, metadata } = params;
            const log = new AuditLog({
                userId,
                action,
                resourceType,
                resourceId,
                changes,
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'],
                deviceFingerprint: request.headers['x-device-fingerprint'],
                status,
                errorMessage,
                metadata
            });
            await log.save();
            // Log sensitive operations to a separate security log
            if (this.isSensitiveOperation(action)) {
                logger_1.logger.warn(`Sensitive operation performed: ${action}`, {
                    userId,
                    resourceType,
                    resourceId,
                    ip: request.ip
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to create audit log:', error);
        }
    }
    static isSensitiveOperation(action) {
        const sensitiveActions = [
            'login',
            'logout',
            'password_change',
            'role_change',
            'permission_change',
            'api_key_generate',
            'mfa_change',
            'security_settings_change'
        ];
        return sensitiveActions.includes(action.toLowerCase());
    }
    static async getAuditTrail(userId, filters = {}) {
        return AuditLog.find({ userId, ...filters })
            .sort({ timestamp: -1 })
            .limit(100);
    }
}
exports.AuditLogService = AuditLogService;
