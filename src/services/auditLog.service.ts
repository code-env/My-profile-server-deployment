import { Request } from 'express';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';

// Define audit log schema
const auditLogSchema = new mongoose.Schema({
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

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export class AuditLogService {
  static async log(params: {
    userId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    changes?: any;
    request: Request;
    status: 'success' | 'failure';
    errorMessage?: string;
    metadata?: any;
  }) {
    try {
      const {
        userId,
        action,
        resourceType,
        resourceId,
        changes,
        request,
        status,
        errorMessage,
        metadata
      } = params;

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
        logger.warn(`Sensitive operation performed: ${action}`, {
          userId,
          resourceType,
          resourceId,
          ip: request.ip
        });
      }
    } catch (error) {
      logger.error('Failed to create audit log:', error);
    }
  }

  private static isSensitiveOperation(action: string): boolean {
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

  static async getAuditTrail(userId: string, filters: any = {}) {
    return AuditLog.find({ userId, ...filters })
      .sort({ timestamp: -1 })
      .limit(100);
  }
}
