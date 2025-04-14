import { logger } from '../utils/logger';
import mongoose from 'mongoose';

interface IAuditLogBase {
  timestamp: Date;
  userId?: string;
  ip?: string;
}

interface IRequestLog extends IAuditLogBase {
  action: string;
  details: any;
}

interface ISecurityLog extends IAuditLogBase {
  type: 'SUSPICIOUS_PATTERN' | 'RATE_LIMIT_EXCEEDED' | 'GEO_ANOMALY' | 'BRUTE_FORCE_ATTEMPT' | 'CONCURRENT_SESSIONS';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: any;
}

const securityLogSchema = new mongoose.Schema({
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
  details: mongoose.Schema.Types.Mixed
}, { timestamps: true });

const requestLogSchema = new mongoose.Schema({
  timestamp: { type: Date, required: true, default: Date.now },
  userId: String,
  action: { type: String, required: true },
  details: mongoose.Schema.Types.Mixed
}, { timestamps: true });

const SecurityLog = mongoose.model('SecurityLog', securityLogSchema);
const RequestLog = mongoose.model('RequestLog', requestLogSchema);

export class AuditLogService {
  async logRequest(data: IRequestLog): Promise<void> {
    try {
      await RequestLog.create({
        timestamp: data.timestamp || new Date(),
        userId: data.userId,
        action: data.action,
        details: data.details
      });

      logger.debug('Request logged successfully', {
        userId: data.userId,
        action: data.action
      });
    } catch (error) {
      logger.error('Error logging request:', error);
      throw error;
    }
  }

  async logSecurity(data: ISecurityLog): Promise<void> {
    try {
      await SecurityLog.create({
        timestamp: data.timestamp || new Date(),
        type: data.type,
        severity: data.severity,
        userId: data.userId,
        ip: data.ip,
        details: data.details
      });

      logger.warn('Security event logged', {
        type: data.type,
        severity: data.severity,
        userId: data.userId,
        ip: data.ip
      });

      if (data.severity === 'HIGH' || data.severity === 'CRITICAL') {
        await this.notifySecurityTeam(data);
      }
    } catch (error) {
      logger.error('Error logging security event:', error);
      throw error;
    }
  }

  private async notifySecurityTeam(securityLog: ISecurityLog): Promise<void> {
    // Implement security team notification logic here
    // This could include:
    // - Sending emails
    // - Creating incident tickets
    // - Triggering alerts in monitoring systems
    logger.info('Security team notified of high severity event', {
      type: securityLog.type,
      severity: securityLog.severity,
      timestamp: securityLog.timestamp
    });
  }

  async getSecurityLogs(filters: {
    startDate?: Date;
    endDate?: Date;
    type?: string;
    severity?: string;
    userId?: string;
    ip?: string;
  }): Promise<any[]> {
    try {
      const query: any = {};

      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) query.timestamp.$gte = filters.startDate;
        if (filters.endDate) query.timestamp.$lte = filters.endDate;
      }

      if (filters.type) query.type = filters.type;
      if (filters.severity) query.severity = filters.severity;
      if (filters.userId) query.userId = filters.userId;
      if (filters.ip) query.ip = filters.ip;

      return await SecurityLog.find(query)
        .sort({ timestamp: -1 })
        .limit(1000)
        .lean()
        .exec();
    } catch (error) {
      logger.error('Error retrieving security logs:', error);
      throw error;
    }
  }

  async getRequestLogs(filters: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    action?: string;
  }): Promise<any[]> {
    try {
      const query: any = {};

      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) query.timestamp.$gte = filters.startDate;
        if (filters.endDate) query.timestamp.$lte = filters.endDate;
      }

      if (filters.userId) query.userId = filters.userId;
      if (filters.action) query.action = filters.action;

      return await RequestLog.find(query)
        .sort({ timestamp: -1 })
        .limit(1000)
        .lean()
        .exec();
    } catch (error) {
      logger.error('Error retrieving request logs:', error);
      throw error;
    }
  }

  async clearOldLogs(daysToKeep: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      await Promise.all([
        SecurityLog.deleteMany({ timestamp: { $lt: cutoffDate } }),
        RequestLog.deleteMany({ timestamp: { $lt: cutoffDate } })
      ]);

      logger.info(`Cleared logs older than ${daysToKeep} days`);
    } catch (error) {
      logger.error('Error clearing old logs:', error);
      throw error;
    }
  }
}

export const auditLogService = new AuditLogService();
