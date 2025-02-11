/**
 * @file test.routes.ts
 * @description Advanced Tracking & Monitoring Test Routes
 * =================================================
 *
 * These routes provide endpoints for testing and demonstrating the advanced
 * tracking capabilities of the system. Each endpoint simulates different
 * scenarios and load patterns to showcase:
 *
 * Features Demonstrated:
 * --------------------
 * - Request/Response tracking
 * - Performance monitoring
 * - Security tracking
 * - Error handling
 * - Resource utilization
 * - Rate limiting
 *
 * Test Endpoints:
 * -------------
 * 1. GET /health
 *    Basic health check with request size tracking
 *
 * 2. GET /load
 *    Simulates CPU-intensive operations and DB queries
 *
 * 3. POST /secure
 *    Tests security monitoring and unauthorized access
 *
 * 4. GET /rapid
 *    Tests rate limiting and concurrent request handling
 *
 * 5. POST /complex
 *    Simulates complex operations with multiple phases
 *
 * 6. GET /error
 *    Triggers error handling and tracking
 *
 * @version 1.0.0
 */

import express from 'express';
import { delay, generateCPULoad, getRequestSize, formatBytes } from '../utils/controllerUtils';
import { logger } from '../utils/logger';

const router = express.Router();

// Test endpoint for health checks
router.get('/health', (req, res) => {
  const requestSize = getRequestSize(req);
  logger.info('Health check request', {
    size: formatBytes(requestSize),
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString()
  });
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    requestSize: formatBytes(requestSize)
  });
});

// Test endpoint for load testing
router.get('/load', async (req, res) => {
  const startTime = Date.now();

  // Track request size
  const requestSize = getRequestSize(req);

  // Simulate CPU-intensive operation
  generateCPULoad(500);

  // Simulate DB operations
  await delay(200);

  const endTime = Date.now();
  const processingTime = endTime - startTime;

  logger.info('Load test completed', {
    duration: processingTime,
    requestSize: formatBytes(requestSize),
    cpuTime: '500ms',
    dbTime: '200ms'
  });

  res.json({
    success: true,
    metrics: {
      processingTime,
      requestSize: formatBytes(requestSize),
      timestamp: new Date().toISOString()
    }
  });
});

// Test endpoint for security operations
router.post('/secure', (req, res) => {
  const { action, token } = req.body;
  const requestSize = getRequestSize(req);

  logger.warn('Security operation attempted', {
    action,
    requestSize: formatBytes(requestSize),
    headers: req.headers,
    ip: req.ip
  });

  // Always return 401 for test purposes
  res.status(401).json({
    error: 'Unauthorized',
    details: 'Invalid security token',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint for rate limiting
router.get('/rapid', (req, res) => {
  const requestSize = getRequestSize(req);

  logger.info('Rapid request received', {
    timestamp: new Date().toISOString(),
    requestSize: formatBytes(requestSize),
    clientId: req.headers['x-client-id']
  });

  res.json({
    timestamp: Date.now(),
    requestSize: formatBytes(requestSize)
  });
});

// Test endpoint for complex operations
router.post('/complex', async (req, res) => {
  const startTime = Date.now();
  const { operation, filters, groupBy, metrics } = req.body;
  const requestSize = getRequestSize(req);

  // Simulate complex processing
  generateCPULoad(200);
  await delay(300);

  const endTime = Date.now();
  const processingTime = endTime - startTime;

  logger.info('Complex operation completed', {
    operation,
    processingTime,
    requestSize: formatBytes(requestSize),
    filters,
    groupBy,
    metrics
  });

  res.json({
    operation,
    result: {
      processedFilters: filters,
      groupedBy: groupBy,
      calculatedMetrics: metrics,
      processingTime,
      timestamp: new Date().toISOString()
    }
  });
});

// Test endpoint for error handling
router.get('/error', (req, res) => {
  const requestSize = getRequestSize(req);

  logger.error('Test error triggered', {
    timestamp: new Date().toISOString(),
    requestSize: formatBytes(requestSize),
    headers: req.headers
  });

  throw new Error('Test error for tracking');
});

// Catch-all for undefined test routes
router.use('*', (req, res) => {
  const requestSize = getRequestSize(req);

  logger.warn('Unknown test endpoint accessed', {
    path: req.path,
    method: req.method,
    requestSize: formatBytes(requestSize)
  });

  res.status(404).json({
    error: 'Test endpoint not found',
    timestamp: new Date().toISOString()
  });
});

// Export as named export to match usage in index.ts
export const testRoutes = router;
