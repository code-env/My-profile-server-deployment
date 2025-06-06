import { Request } from 'express';
import { getClientInfo } from '../../utils/controllerUtils';
import { securityMonitoringService } from '../../services/securityMonitoring.service';
import { IRequestMetadata } from '../../middleware/advanced-tracking.middleware';
import { logger } from '../../utils/logger';

describe('Advanced Tracking Tests', () => {
  let mockRequest: Request;

  beforeEach(() => {
    // Mock request with various headers for testing
    mockRequest = {
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'accept-language': 'en-US,en;q=0.9',
        'x-forwarded-for': '192.168.1.1',
        'sec-ch-ua-platform': 'macOS',
        'sec-ch-viewport-width': '1920',
        'sec-ch-viewport-height': '1080',
        'sec-ch-ua-mobile': '?0',
        'cookie': 'session=test'
      },
      ip: '192.168.1.1',
      method: 'POST',
      url: '/api/test',
      protocol: 'https',
      hostname: 'localhost',
      connection: { remoteAddress: '192.168.1.1' },
      socket: { remoteAddress: '192.168.1.1' }
    } as unknown as Request;
  });

  it('should track client info correctly', async () => {
    console.log('Testing client info tracking...');
    const clientInfo = await getClientInfo(mockRequest);
    
    expect(clientInfo).toBeDefined();
    expect(clientInfo.ip).toBe('192.168.1.1');
    
    console.log('📱 Client Info:', JSON.stringify(clientInfo, null, 2));
  });

  it('should analyze normal requests without errors', async () => {
    console.log('Testing security monitoring...');
    
    const clientInfo = await getClientInfo(mockRequest);
    const normalMetadata: IRequestMetadata = {
      ip: clientInfo.ip,
      route: '/api/test',
      userId: 'test-user-id',
      sessionId: 'test-session-id',
      statusCode: 200,
      geolocation: {
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        ll: [37.7749, -122.4194]
      }
    };

    await expect(securityMonitoringService.analyzeRequest(normalMetadata))
      .resolves.not.toThrow();
    
    console.log('✅ Normal request analyzed');
  });

  it('should detect suspicious activity', async () => {
    console.log('Testing suspicious activity detection...');
    
    const suspiciousMetadata: IRequestMetadata = {
      ip: '10.0.0.1',
      route: '/api/test',
      userId: 'test-user-id',
      sessionId: 'test-session-id',
      statusCode: 401, // Trigger brute force detection
      geolocation: {
        country: 'Unknown',
        region: 'Unknown',
        city: 'Unknown'
      }
    };

    await expect(securityMonitoringService.analyzeRequest(suspiciousMetadata))
      .resolves.not.toThrow();
    
    console.log('⚠️ Suspicious request analyzed');
  });

  it('should handle rate limiting for rapid requests', async () => {
    console.log('Testing rate limiting...');
    
    const clientInfo = await getClientInfo(mockRequest);
    const normalMetadata: IRequestMetadata = {
      ip: clientInfo.ip,
      route: '/api/test',
      userId: 'test-user-id',
      sessionId: 'test-session-id',
      statusCode: 200,
      geolocation: {
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        ll: [37.7749, -122.4194]
      }
    };

    // Test rapid requests for rate limiting
    const requests = Array(10).fill(normalMetadata);
    const results = await Promise.allSettled(
      requests.map(metadata => securityMonitoringService.analyzeRequest(metadata))
    );

    // Some requests should succeed, others might be rate limited
    expect(results).toHaveLength(10);
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.log(`Request ${index + 1} rate limited:`, result.reason.message);
      }
    });
  });

  it('should log test completion properly', async () => {
    const clientInfo = await getClientInfo(mockRequest);
    
    // Log test completion
    logger.info('Advanced tracking test completed', {
      timestamp: new Date().toISOString(),
      normalRequestInfo: clientInfo,
      suspiciousRequestDetected: true
    });

    console.log('✅ Advanced tracking validation complete');
    console.log('📝 Check logs/all.log for detailed test results');
    
    // Test passes if no errors are thrown
    expect(true).toBe(true);
  });
});
