import { Request, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { DetailedRequestInfo } from '../utils/requestInfo';

// In-memory cache for recent request tracking data
const trackingCache: DetailedRequestInfo[] = [];
const CACHE_SIZE = 1000; // Keep last 1000 requests

export const addToTrackingCache = (info: DetailedRequestInfo) => {
  trackingCache.unshift(info);
  if (trackingCache.length > CACHE_SIZE) {
    trackingCache.pop();
  }
};

export const getLogFile = async (req: Request, res: Response) => {
  try {
    const filename = req.params.filename;
    const logPath = path.join(process.cwd(), 'logs', filename);

    // Basic security check
    if (!filename.endsWith('.log')) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    const content = await fs.readFile(logPath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);

    // Handle pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;

    const paginatedLines = lines.slice(startIdx, endIdx);

    res.json({
      total: lines.length,
      page,
      limit,
      data: paginatedLines.map(line => JSON.parse(line))
    });
  } catch (error) {
    logger.error('Error reading log file:', error);
    res.status(500).json({ error: 'Failed to read log file' });
  }
};

export const deleteLogFile = async (req: Request, res: Response) => {
  try {
    const filename = req.params.filename;
    const logPath = path.join(process.cwd(), 'logs', filename);

    if (!filename.endsWith('.log')) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    await fs.writeFile(logPath, ''); // Clear file content
    res.json({ message: 'Log file cleared successfully' });
  } catch (error) {
    logger.error('Error clearing log file:', error);
    res.status(500).json({ error: 'Failed to clear log file' });
  }
};

interface TrackingQuery {
  ip?: string;
  country?: string;
  browser?: string;
  os?: string;
  threatScore?: number;
  startDate?: string;
  endDate?: string;
}

export const getTrackingData = async (req: Request, res: Response) => {
  try {
    // For initial load, return all logs without filtering
    if (!Object.keys(req.query).length) {
      return res.json({
        total: trackingCache.length,
        page: 1,
        limit: trackingCache.length,
        data: trackingCache
      });
    }

    const query: TrackingQuery = req.query;
    let filteredData = [...trackingCache];

    // Apply filters only if query parameters exist
    if (query.ip) {
      filteredData = filteredData.filter(data => data.ip === query.ip);
    }
    if (query.country) {
      filteredData = filteredData.filter(data => data.geo?.country === query.country);
    }
    if (query.browser) {
      filteredData = filteredData.filter(data => data.browser.name.toLowerCase().includes(query.browser!.toLowerCase()));
    }
    if (query.os) {
      filteredData = filteredData.filter(data => data.os.name.toLowerCase().includes(query.os!.toLowerCase()));
    }
    if (query.threatScore) {
      filteredData = filteredData.filter(data => data.security.threatScore >= Number(query.threatScore));
    }
    if (query.startDate && query.endDate) {
      const start = new Date(query.startDate).getTime();
      const end = new Date(query.endDate).getTime();
      filteredData = filteredData.filter(data => {
        const timestamp = data.timestamp;
        return timestamp >= start && timestamp <= end;
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;

    // Only include analytics if specifically requested
    const includeAnalytics = req.query.includeAnalytics === 'true';
    const response: any = {
      total: filteredData.length,
      page,
      limit,
      data: filteredData.slice(startIdx, endIdx)
    };

    if (includeAnalytics) {
      response.analytics = {
        totalRequests: filteredData.length,
        uniqueIPs: new Set(filteredData.map(data => data.ip)).size,
        countries: Object.entries(
          filteredData.reduce((acc: any, data) => {
            const country = data.geo?.country || 'Unknown';
            acc[country] = (acc[country] || 0) + 1;
            return acc;
          }, {})
        ),
        browsers: Object.entries(
          filteredData.reduce((acc: any, data) => {
            const browser = data.browser.name;
            acc[browser] = (acc[browser] || 0) + 1;
            return acc;
          }, {})
        ),
        averageThreatScore: filteredData.length ?
          filteredData.reduce((acc, data) => acc + data.security.threatScore, 0) / filteredData.length : 0,
        highThreatRequests: filteredData.filter(data => data.security.threatScore > 70).length
      };
    }

    res.json(response);
  } catch (error) {
    logger.error('Error retrieving tracking data:', error);
    res.status(500).json({ error: 'Failed to retrieve tracking data' });
  }
};

export const getTrackingAnalytics = async (req: Request, res: Response) => {
  try {
    const timeframe = req.query.timeframe || '24h'; // Default to last 24 hours
    const now = Date.now();
    let timeThreshold: number;

    switch (timeframe) {
      case '1h':
        timeThreshold = now - 3600000;
        break;
      case '24h':
        timeThreshold = now - 86400000;
        break;
      case '7d':
        timeThreshold = now - 604800000;
        break;
      case '30d':
        timeThreshold = now - 2592000000;
        break;
      default:
        timeThreshold = now - 86400000; // Default to 24h
    }

    const relevantData = trackingCache.filter(data => data.timestamp >= timeThreshold);

    const analytics = {
      overview: {
        totalRequests: relevantData.length,
        uniqueIPs: new Set(relevantData.map(data => data.ip)).size,
        uniqueCountries: new Set(relevantData.map(data => data.geo?.country || 'Unknown')).size,
        averageResponseTime: relevantData.reduce((acc, data: any) => acc + (data.responseTime || 0), 0) / relevantData.length
      },
      security: {
        averageThreatScore: relevantData.reduce((acc, data) => acc + data.security.threatScore, 0) / relevantData.length,
        highThreatRequests: relevantData.filter(data => data.security.threatScore > 70).length,
        proxyRequests: relevantData.filter(data => data.security.isProxy).length,
        torRequests: relevantData.filter(data => data.security.isTor).length
      },
      topCountries: Object.entries(
        relevantData.reduce((acc: any, data) => {
          const country = data.geo?.country || 'Unknown';
          acc[country] = (acc[country] || 0) + 1;
          return acc;
        }, {})
      ).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 10),
      browserShare: Object.entries(
        relevantData.reduce((acc: any, data) => {
          const browser = data.browser.name;
          acc[browser] = (acc[browser] || 0) + 1;
          return acc;
        }, {})
      ).sort((a, b) => (b[1] as number) - (a[1] as number)),
      osDistribution: Object.entries(
        relevantData.reduce((acc: any, data) => {
          const os = data.os.name;
          acc[os] = (acc[os] || 0) + 1;
          return acc;
        }, {})
      ).sort((a, b) => (b[1] as number) - (a[1] as number)),
      timeDistribution: relevantData.reduce((acc: any, data) => {
        const hour = new Date(data.timestamp).getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, Array(24).fill(0))
    };

    res.json(analytics);
  } catch (error) {
    logger.error('Error retrieving tracking analytics:', error);
    res.status(500).json({ error: 'Failed to retrieve tracking analytics' });
  }
};
