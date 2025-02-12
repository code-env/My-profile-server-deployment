import axios from 'axios';
import { logger } from '../utils/logger';

async function testAdvancedTracking() {
  const baseURL = 'http://localhost:5000';
  console.log('🔍 Starting advanced tracking test suite...\n');

  try {
    // Test 1: Health check (General request)
    console.log('Test 1: Health check request');
    await axios.get(`${baseURL}/api/health`, {
      headers: {
        'User-Agent': 'HealthMonitor/1.0 (Node.js Monitoring Service)',
        'Accept-Language': 'en-US,en;q=0.9',
        'X-Monitor-ID': 'health-check-001'
      }
    });

    // Test 2: Registration attempt (Security sensitive)
    console.log('\nTest 2: User registration');
    try {
      await axios.post(`${baseURL}/api/auth/register`, {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'Test User',
        deviceInfo: {
          platform: 'Web',
          browser: 'Chrome'
        }
      }, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/91.0.4472.124',
          'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
          'Sec-Ch-Ua': '"Google Chrome";v="91", " Not;A Brand";v="99"',
          'Sec-Ch-Ua-Platform': 'macOS',
          'X-Device-Type': 'desktop',
          'X-App-Version': '2.0.0'
        }
      });
    } catch (error) {
      console.log('Expected registration handling (security checks)');
    }

    // Test 3: Login attempt (Security + Performance)
    console.log('\nTest 3: Login attempt');
    try {
      await axios.post(`${baseURL}/api/auth/login`, {
        email: 'test@example.com',
        password: 'wrongpassword',
        deviceInfo: {
          platform: 'iOS',
          version: '15.0'
        }
      }, {
        headers: {
          'User-Agent': 'MyApp/2.0 (iPhone; iOS 15.0; Scale/3.00)',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8',
          'X-Device-ID': 'ios-device-123',
          'X-Request-Start': Date.now().toString()
        }
      });
    } catch (error) {
      console.log('Expected authentication error (security tracking)');
    }

    // Test 4: Performance-heavy operation
    console.log('\nTest 4: Performance test');
    await axios.get(`${baseURL}/api/test/load`, {
      headers: {
        'X-Request-Start': Date.now().toString(),
        'X-Performance-Track': 'true',
        'X-Custom-Operation': 'heavy-computation'
      }
    });

    // Test 5: Security-sensitive operation
    console.log('\nTest 5: Security operation');
    try {
      await axios.post(`${baseURL}/api/test/secure`, {
        action: 'changePassword',
        token: 'invalid-token'
      }, {
        headers: {
          'Authorization': 'Bearer invalid-token',
          'X-Security-Check': 'true',
          'X-Request-ID': 'sec-op-123',
          'X-Forwarded-For': '10.0.0.1'
        }
      });
    } catch (error) {
      console.log('Expected security validation (tracking suspicious activity)');
    }

    // Test 6: Rate limiting test
    console.log('\nTest 6: Rate limiting');
    const rapidRequests = Array(10).fill(null).map(() =>
      axios.get(`${baseURL}/api/test/rapid`, {
        headers: {
          'X-Rate-Limit-Test': 'true',
          'X-Client-ID': 'test-client'
        }
      }).catch(err => console.log('Expected rate limit (DoS protection)'))
    );
    await Promise.all(rapidRequests);

    // Test 7: Complex data operation
    console.log('\nTest 7: Complex operation');
    await axios.post(`${baseURL}/api/test/complex`, {
      operation: 'aggregate',
      filters: [{ field: 'date', op: 'gt', value: '2024-01-01' }],
      groupBy: ['category', 'region'],
      metrics: ['sum', 'average', 'count']
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Operation-ID': 'complex-query-001',
        'X-Batch-Size': '1000'
      }
    });

    // Test 8: Error tracking
    console.log('\nTest 8: Error handling');
    try {
      await axios.get(`${baseURL}/api/test/error`, {
        headers: {
          'X-Error-Test': 'true',
          'X-Debug-Mode': 'verbose'
        }
      });
    } catch (error) {
      console.log('Expected error response (error tracking)');
    }

    console.log('\n✅ Test suite completed');
    console.log('📝 Check the following log files for detailed tracking information:');
    console.log('   - logs/all.log: Complete request tracking with all metadata');
    console.log('   - logs/access.log: Structured HTTP access logs');
    console.log('   - logs/error.log: Detailed error tracking and stack traces');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    logger.error('Test suite failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
}

// Run the test suite
console.log('🚀 Starting advanced tracking demonstration...\n');
testAdvancedTracking().catch(console.error);
