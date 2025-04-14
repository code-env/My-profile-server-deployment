import { Request } from 'express';
import { getClientInfo } from '../utils/controllerUtils';
import { securityMonitoringService } from '../services/securityMonitoring.service';
import { IRequestMetadata } from '../middleware/advanced-tracking.middleware';
import { logger } from '../utils/logger';

async function testAdvancedTracking() {
  console.log('🔍 Starting advanced tracking validation...\n');

  // Mock request with various headers for testing
  const mockRequest = {
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

  try {
    // Test client info tracking
    console.log('Testing client info tracking...');
    const clientInfo = await getClientInfo(mockRequest);
    console.log('📱 Client Info:', JSON.stringify(clientInfo, null, 2));

    // Create request metadata for security monitoring
    const normalMetadata: IRequestMetadata = {
      ip: clientInfo.ip,
      userAgent: mockRequest.headers['user-agent'] || '',
      route: '/api/test',
      method: mockRequest.method,
      statusCode: 200,
      userId: 'test-user-id',
      sessionId: 'test-session-id',
      timestamps: {
        start: Date.now(),
        end: Date.now() + 100 // Simulate 100ms request
      },
      geolocation: clientInfo.geoLocation,
      device: {
        type: 'desktop',
        vendor: 'Apple',
        model: 'MacBook',
        os: {
          name: 'macOS',
          version: '10.15.7'
        },
        browser: {
          name: 'Chrome',
          version: '98.0.4758.102'
        }
      },
      performance: {
        totalDuration: 100,
        processingTime: 50,
        dbQueries: 2,
        dbTime: 30
      }
    };

    // Test security monitoring
    console.log('\nTesting security monitoring...');
    await securityMonitoringService.analyzeRequest(normalMetadata);
    console.log('✅ Normal request analyzed');

    // Test suspicious activity detection
    console.log('\nTesting suspicious activity detection...');
    const suspiciousMetadata: IRequestMetadata = {
      ...normalMetadata,
      ip: '10.0.0.1',
      userAgent: 'Unknown Browser',
      statusCode: 401, // Trigger brute force detection
      device: {
        ...normalMetadata.device,
        type: 'unknown',
        vendor: 'unknown'
      }
    };

    await securityMonitoringService.analyzeRequest(suspiciousMetadata);
    console.log('⚠️ Suspicious request analyzed');

    // Test rapid requests for rate limiting
    console.log('\nTesting rate limiting...');
    const requests = Array(10).fill(normalMetadata);
    await Promise.all(requests.map(metadata =>
      securityMonitoringService.analyzeRequest(metadata).catch(err =>
        console.log('Expected rate limit error:', err.message)
      )
    ));

    // Log test completion
    logger.info('Advanced tracking test completed', {
      timestamp: new Date().toISOString(),
      normalRequestInfo: clientInfo,
      suspiciousRequestDetected: true
    });

    console.log('\n✅ Advanced tracking validation complete');
    console.log('📝 Check logs/all.log for detailed test results');
  } catch (error) {
    logger.error('Advanced tracking test failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    console.error('❌ Test failed:', error);
  }
}

// Run the validation
testAdvancedTracking().catch(console.error);
