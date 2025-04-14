import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../app';
import { Connection } from '../models/Connection';
import { Message } from '../models/Message';
import {
  createTestUser,
  createTestProfile,
  createTestConnection,
  generateTestInteractions,
  cleanupTestData
} from './helpers/connection.helper';
import { generateToken } from '../utils/auth';

describe('Connection Analytics', () => {
  let testUser1: any;
  let testUser2: any;
  let testProfile1: any;
  let testProfile2: any;
  let testConnection: any;
  let authToken: string;

  beforeAll(async () => {
    // Create test users and profiles
    testUser1 = await createTestUser();
    testUser2 = await createTestUser();
    testProfile1 = await createTestProfile(testUser1._id);
    testProfile2 = await createTestProfile(testUser2._id);

    // Create connection between users
    testConnection = await createTestConnection(testUser1._id, testProfile2._id, {
      status: 'accepted',
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days ago
    });

    // Generate some test interactions
    await generateTestInteractions(testConnection, 15, 30);

    // Generate auth token for testUser1
    authToken = generateToken(testUser1);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('GET /api/connections/analytics/strength/:connectionId', () => {
    it('should return connection strength for valid connection', async () => {
      const response = await request(app)
        .get(`/api/connections/analytics/strength/${testConnection._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('strength');
      expect(response.body.data.strength).toHaveProperty('score');
      expect(response.body.data.strength).toHaveProperty('factors');
      expect(response.body.data.summary).toHaveProperty('level');
    });

    it('should return 404 for non-existent connection', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/connections/analytics/strength/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/connections/analytics/strength/${testConnection._id}`);

      expect(response.status).toBe(401);
    });

    it('should validate connection ownership', async () => {
      const unauthorizedUser = await createTestUser();
      const unauthorizedToken = generateToken(unauthorizedUser);

      const response = await request(app)
        .get(`/api/connections/analytics/strength/${testConnection._id}`)
        .set('Authorization', `Bearer ${unauthorizedToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/connections/analytics/history/:connectionId', () => {
    it('should return connection history for valid connection', async () => {
      const response = await request(app)
        .get(`/api/connections/analytics/history/${testConnection._id}`)
        .query({ period: 'month' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('history');
    });

    it('should accept different period parameters', async () => {
      const periods = ['week', 'month', 'year'];

      for (const period of periods) {
        const response = await request(app)
          .get(`/api/connections/analytics/history/${testConnection._id}`)
          .query({ period })
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should validate period parameter', async () => {
      const response = await request(app)
        .get(`/api/connections/analytics/history/${testConnection._id}`)
        .query({ period: 'invalid' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('Connection Strength Calculation', () => {
    it('should factor in message frequency', async () => {
      // Generate high message activity
      await generateTestInteractions(testConnection, 30, 30); // 30 messages in last 30 days

      const response = await request(app)
        .get(`/api/connections/analytics/strength/${testConnection._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.strength.factors.messageFrequency).toBeGreaterThan(0.5);
    });

    it('should factor in connection duration', async () => {
      // Connection was created 90 days ago in beforeAll
      const response = await request(app)
        .get(`/api/connections/analytics/strength/${testConnection._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.strength.factors.engagementDuration).toBeGreaterThan(0.2);
    });

    it('should factor in mutual connections', async () => {
      // Create some mutual connections
      const mutualUser = await createTestUser();
      await createTestConnection(testUser1._id, mutualUser._id);
      await createTestConnection(testUser2._id, mutualUser._id);

      const response = await request(app)
        .get(`/api/connections/analytics/strength/${testConnection._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.strength.factors.mutualConnections).toBeGreaterThan(0);
    });

    it('should provide relevant suggestions for weak factors', async () => {
      // Create a new connection with minimal interaction
      const newConnection = await createTestConnection(testUser1._id, testProfile2._id);

      const response = await request(app)
        .get(`/api/connections/analytics/strength/${newConnection._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.strength.metadata.suggestedActions.length).toBeGreaterThan(0);
    });
  });
});
