"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogService = exports.AuditLogService = void 0;
const logger_1 = require("../utils/logger");
const mongoose_1 = __importDefault(require("mongoose"));
const securityLogSchema = new mongoose_1.default.Schema({
    timestamp: { type: Date, required: true, default: Date.now },
    type: {
        type: String,
        required: true,
        enum: ['SUSPICIOUS_PATTERN', 'RATE_LIMIT_EXCEEDED', 'GEO_ANOMALY', 'BRUTE_FORCE_ATTEMPT', 'CONCURRENT_SESSIONS']
    },
    severity: {
        type: String,
        required: true,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    },
    userId: String,
    ip: String,
    details: mongoose_1.default.Schema.Types.Mixed
}, { timestamps: true });
const requestLogSchema = new mongoose_1.default.Schema({
    timestamp: { type: Date, required: true, default: Date.now },
    userId: String,
    action: { type: String, required: true },
    details: mongoose_1.default.Schema.Types.Mixed
}, { timestamps: true });
const SecurityLog = mongoose_1.default.model('SecurityLog', securityLogSchema);
const RequestLog = mongoose_1.default.model('RequestLog', requestLogSchema);
class AuditLogService {
    async logRequest(data) {
        try {
            await RequestLog.create({
                timestamp: data.timestamp || new Date(),
                userId: data.userId,
                action: data.action,
                details: data.details
            });
            logger_1.logger.debug('Request logged successfully', {
                userId: data.userId,
                action: data.action
            });
        }
        catch (error) {
            logger_1.logger.error('Error logging request:', error);
            throw error;
        }
    }
    async logSecurity(data) {
        try {
            await SecurityLog.create({
                timestamp: data.timestamp || new Date(),
                type: data.type,
                severity: data.severity,
                userId: data.userId,
                ip: data.ip,
                details: data.details
            });
            logger_1.logger.warn('Security event logged', {
                type: data.type,
                severity: data.severity,
                userId: data.userId,
                ip: data.ip
            });
            if (data.severity === 'HIGH' || data.severity === 'CRITICAL') {
                await this.notifySecurityTeam(data);
            }
        }
        catch (error) {
            logger_1.logger.error('Error logging security event:', error);
            throw error;
        }
    }
    async notifySecurityTeam(securityLog) {
        // Implement security team notification logic here
        // This could include:
        // - Sending emails
        // - Creating incident tickets
        // - Triggering alerts in monitoring systems
        logger_1.logger.info('Security team notified of high severity event', {
            type: securityLog.type,
            severity: securityLog.severity,
            timestamp: securityLog.timestamp
        });
    }
    async getSecurityLogs(filters) {
        try {
            const query = {};
            if (filters.startDate || filters.endDate) {
                query.timestamp = {};
                if (filters.startDate)
                    query.timestamp.$gte = filters.startDate;
                if (filters.endDate)
                    query.timestamp.$lte = filters.endDate;
            }
            if (filters.type)
                query.type = filters.type;
            if (filters.severity)
                query.severity = filters.severity;
            if (filters.userId)
                query.userId = filters.userId;
            if (filters.ip)
                query.ip = filters.ip;
            return await SecurityLog.find(query)
                .sort({ timestamp: -1 })
                .limit(1000)
                .lean()
                .exec();
        }
        catch (error) {
            logger_1.logger.error('Error retrieving security logs:', error);
            throw error;
        }
    }
    async getRequestLogs(filters) {
        try {
            const query = {};
            if (filters.startDate || filters.endDate) {
                query.timestamp = {};
                if (filters.startDate)
                    query.timestamp.$gte = filters.startDate;
                if (filters.endDate)
                    query.timestamp.$lte = filters.endDate;
            }
            if (filters.userId)
                query.userId = filters.userId;
            if (filters.action)
                query.action = filters.action;
            return await RequestLog.find(query)
                .sort({ timestamp: -1 })
                .limit(1000)
                .lean()
                .exec();
        }
        catch (error) {
            logger_1.logger.error('Error retrieving request logs:', error);
            throw error;
        }
    }
    async clearOldLogs(daysToKeep = 90) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            await Promise.all([
                SecurityLog.deleteMany({ timestamp: { $lt: cutoffDate } }),
                RequestLog.deleteMany({ timestamp: { $lt: cutoffDate } })
            ]);
            logger_1.logger.info(`Cleared logs older than ${daysToKeep} days`);
        }
        catch (error) {
            logger_1.logger.error('Error clearing old logs:', error);
            throw error;
        }
    }
}
exports.AuditLogService = AuditLogService;
exports.auditLogService = new AuditLogService();
