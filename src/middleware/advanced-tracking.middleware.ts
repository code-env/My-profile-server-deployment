import { Request, Response, NextFunction } from 'express';
import { getRequestInfo } from '../utils/requestInfo';
import { logger, accessLogger, securityLogger, performanceLogger } from '../utils/logger';
import geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';
import { User } from '../models/User';
import crypto from 'crypto';
import os from 'os';

type UserDocument = InstanceType<typeof User>;

declare global {
  namespace Express {
    interface Request {
      user?: User | undefined;
      deviceId?: string;
      fingerprint?: string;
    }
  }
}

import { securityMonitoringService } from '../services/securityMonitoring.service';
import { auditLogService } from '../services/auditLog.service';

export interface IRequestMetadata {
  ip: string;
  userAgent: string;
  geolocation?: {
    country?: string;
    region?: string;
    city?: string;
    ll?: [number, number];
  };
  device?: {
    type?: string;
    vendor?: string;
    model?: string;
    os?: {
      name?: string;
      version?: string;
    };
    browser?: {
      name?: string;
      version?: string;
    };
  };
  timestamps: {
    start: number;
    end?: number;
  };
  performance?: {
    totalDuration?: number;
    processingTime?: number;
    dbQueries?: number;
    dbTime?: number;
    memoryUsage?: {
      heapUsed: number;
      heapTotal: number;
      external: number;
      rss: number;
    };
    systemInfo?: {
      cpuUsage: number;
      totalMemory: number;
      freeMemory: number;
      loadAverage: number[];
    };
  };
  route?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  sessionId?: string;
  security?: {
    tls?: {
      protocol?: string;
      cipher?: string;
    };
    headers?: Record<string, string>;
    fingerprint?: string;
    jwt?: {
      iat?: number;
      exp?: number;
      sub?: string;
    };
  };
  request?: {
    size?: number;
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
    params?: Record<string, unknown>;
    contentType?: string;
    acceptLanguage?: string;
    acceptEncoding?: string;
  };
  network?: {
    remoteAddress?: string;
    remotePort?: number;
    localAddress?: string;
    localPort?: number;
    protocol?: string;
  };
}

function generateFingerprint(req: Request): string {
  const components = [
    req.headers['user-agent'],
    req.headers['accept-language'],
    req.headers['accept-encoding'],
    req.ip,
    req.headers['sec-ch-ua'],
    req.headers['sec-ch-ua-platform']
  ].filter(Boolean);
  return crypto.createHash('sha256').update(components.join('|')).digest('hex');
}

function getSystemMetrics() {
  const cpus = os.cpus();
  const totalCpuTime = cpus.reduce((acc, cpu) => {
    return acc + Object.values(cpu.times).reduce((sum, time) => sum + time, 0);
  }, 0);
  const cpuUsage = totalCpuTime / (cpus.length * 100); // Normalized CPU usage

  return {
    cpuUsage,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    loadAverage: os.loadavg()
  };
}

function extractJwtData(authHeader?: string) {
  if (!authHeader?.startsWith('Bearer ')) return undefined;

  try {
    const token = authHeader.split(' ')[1];
    const base64Payload = token.split('.')[1];
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
    return {
      iat: payload.iat,
      exp: payload.exp,
      sub: payload.sub
    };
  } catch (error) {
    return undefined;
  }
}

export const advancedTrackingMiddleware = async (
  req: Request & { metadata?: IRequestMetadata },
  res: Response,
  next: NextFunction
) => {
  try {
    // Basic request info
    const requestInfo = await getRequestInfo(req);
    const ua = new UAParser(req.headers['user-agent']);
    const geo = geoip.lookup(requestInfo.ip);
    const user = req.user as UserDocument;
    const fingerprint = generateFingerprint(req);
    const startTime = Date.now();

    // Get TLS info if available
    const socket = req.socket as any;
    const tlsInfo = socket.encrypted ? {
      protocol: socket.getProtocol?.(),
      cipher: socket.getCipher?.()
    } : undefined;

    // Calculate request size
    const requestSize = req.headers['content-length']
      ? parseInt(req.headers['content-length'])
      : Buffer.byteLength(JSON.stringify(req.body), 'utf8');

    // Initialize request metadata
    req.metadata = {
      ip: requestInfo.ip,
      userAgent: req.headers['user-agent'] || '',
      geolocation: geo ? {
        country: geo.country,
        region: geo.region,
        city: geo.city,
        ll: geo.ll
      } : undefined,
      device: {
        type: ua.getDevice().type,
        vendor: ua.getDevice().vendor,
        model: ua.getDevice().model,
        os: {
          name: ua.getOS().name,
          version: ua.getOS().version
        },
        browser: {
          name: ua.getBrowser().name,
          version: ua.getBrowser().version
        }
      },
      timestamps: {
        start: startTime
      },
      route: req.path,
      method: req.method,
      userId: user?._id?.toString(),
      sessionId: req.cookies?.sessionId,
      security: {
        tls: tlsInfo,
        headers: Object.entries(req.headers).reduce((acc, [key, value]) => {
          acc[key] = Array.isArray(value) ? value.join(', ') : String(value || '');
          return acc;
        }, {} as Record<string, string>),
        fingerprint,
        jwt: extractJwtData(req.headers.authorization)
      },
      request: {
        size: requestSize,
        query: req.query,
        body: req.body,
        params: req.params,
        contentType: Array.isArray(req.headers['content-type'])
          ? req.headers['content-type'][0]
          : req.headers['content-type'],
        acceptLanguage: Array.isArray(req.headers['accept-language'])
          ? req.headers['accept-language'][0]
          : req.headers['accept-language'],
        acceptEncoding: Array.isArray(req.headers['accept-encoding'])
          ? req.headers['accept-encoding'][0]
          : req.headers['accept-encoding']
      },
      network: {
        remoteAddress: socket?.remoteAddress,
        remotePort: socket?.remotePort,
        localAddress: socket?.localAddress,
        localPort: socket?.localPort,
        protocol: req.protocol
      }
    };

    // Track DB queries with error handling and cleanup
    let dbQueries = 0;
    let dbTime = 0;
    let originalExec: Function | undefined;

    try {
      // Safely get mongoose Query prototype
      const mongoose = require('mongoose');
      if (mongoose?.Query?.prototype?.exec) {
        originalExec = mongoose.Query.prototype.exec;
        mongoose.Query.prototype.exec = async function() {
          const start = Date.now();
          try {
            const result = await originalExec!.apply(this, arguments);
            dbTime += Date.now() - start;
            dbQueries++;
            return result;
          } catch (error) {
            dbTime += Date.now() - start;
            dbQueries++;
            throw error;
          }
        };
      }
    } catch (error) {
      logger.error('Failed to setup DB query tracking:', error);
    }

    // Track response with cleanup and error handling
    res.on('finish', async () => {
      try {
        const endTime = Date.now();
        if (req.metadata) {
          // Safely get memory metrics
          let memoryMetrics;
          try {
            const memoryUsage = process.memoryUsage();
            memoryMetrics = {
              heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
              heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
              external: Math.round(memoryUsage.external / 1024 / 1024),
              rss: Math.round(memoryUsage.rss / 1024 / 1024)
            };
          } catch (error) {
            logger.error('Failed to get memory metrics:', error);
            memoryMetrics = {
              heapUsed: 0,
              heapTotal: 0,
              external: 0,
              rss: 0
            };
          }

          // Safely get system metrics
          let systemMetrics;
          try {
            systemMetrics = getSystemMetrics();
          } catch (error) {
            logger.error('Failed to get system metrics:', error);
            systemMetrics = {
              cpuUsage: 0,
              totalMemory: 0,
              freeMemory: 0,
              loadAverage: [0, 0, 0]
            };
          }

          req.metadata.timestamps.end = endTime;
          req.metadata.performance = {
            totalDuration: endTime - req.metadata.timestamps.start,
            processingTime: endTime - req.metadata.timestamps.start,
            dbQueries,
            dbTime,
            memoryUsage: memoryMetrics,
            systemInfo: systemMetrics
          };
        req.metadata.statusCode = res.statusCode;

        // Comprehensive logging using specialized loggers
        accessLogger.log(req, res, req.metadata.performance?.totalDuration || 0);

        performanceLogger.log('request-complete', req.metadata.performance?.totalDuration || 0, {
          path: req.path,
          method: req.method,
          statusCode: res.statusCode,
          dbQueries,
          dbTime,
          memoryUsage: req.metadata.performance.memoryUsage,
          systemInfo: req.metadata.performance.systemInfo
        });

        if (res.statusCode >= 400) {
          securityLogger.log('request-error', {
            statusCode: res.statusCode,
            path: req.path,
            method: req.method,
            ip: req.metadata.ip,
            userId: req.metadata.userId,
            error: res.locals.error
          });
        }

          try {
            // Security monitoring
            await securityMonitoringService.analyzeRequest(req.metadata);

            // Audit logging with full request details
            await auditLogService.logRequest({
              userId: req.metadata.userId,
              action: `${req.method} ${req.path}`,
              details: req.metadata,
              timestamp: new Date()
            });

            // Log complete request metadata
            // Create a structured log entry with better context
            logger.info('Request details', {
              type: req.path.includes('auth/register') ? 'Registration' : 'General',
              endpoint: req.path,
              method: req.method,
              ip: req.metadata.ip,
              agent: req.metadata.userAgent,
              location: req.metadata.geolocation,
              device: {
                ...req.metadata.device,
                fingerprint: req.metadata.security?.fingerprint
              },
              request: {
                ...req.metadata.request,
                headers: req.metadata.security?.headers
              },
              timing: {
                start: new Date(req.metadata.timestamps.start).toISOString(),
                duration: req.metadata.performance?.totalDuration,
                dbTime: req.metadata.performance?.dbTime
              },
              user: req.metadata.userId ? {
                id: req.metadata.userId,
                session: req.metadata.sessionId
              } : 'anonymous',
              security: {
                tls: req.metadata.security?.tls,
                jwt: req.metadata.security?.jwt
              }
            });
          } catch (error) {
            logger.error('Error in tracking handlers:', error);
          }
        }
      } catch (error) {
        logger.error('Error in response tracking:', error);
      } finally {
        // Always attempt to restore mongoose exec
        if (originalExec) {
          try {
            const mongoose = require('mongoose');
            if (mongoose?.Query?.prototype) {
              mongoose.Query.prototype.exec = originalExec;
            }
          } catch (error) {
            logger.error('Error restoring mongoose exec:', error);
          }
        }
      }
    });

    next();
  } catch (error) {
    logger.error('Error in advanced tracking middleware:', error);
    next(error);
  }
};
