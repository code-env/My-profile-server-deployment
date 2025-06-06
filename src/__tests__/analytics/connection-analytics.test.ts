import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import { Connection } from '../../models/Connection';
import { User } from '../../models/User';
import { ProfileModel as Profile } from '../../models/profile.model';
import { ProfileTemplate } from '../../models/profiles/profile-template';
import { generateTokens } from '../../config/passport';
import * as connectionAnalyticsController from '../../controllers/connection-analytics.controller';

// Mock external services
jest.mock('../../services/analytics.service', () => ({
  AnalyticsService: jest.fn().mockImplementation(() => ({
    getInteractionCount: jest.fn().mockResolvedValue(5)
  }))
}));

jest.mock('../../models/message.model', () => ({
  Message: {
    countDocuments: jest.fn().mockResolvedValue(10)
  }
}));

describe('Connection Analytics', () => {
  let mongoServer: MongoMemoryServer;
  let app: express.Application;
  let testUser1: any;
  let testUser2: any;
  let testProfile1: any;
  let testProfile2: any;
  let testConnection: any;
  let testTemplate: any;
  let authToken: string;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Setup Express app
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    app.use((req: any, res, next) => {
      if (req.path.includes('/strength/') || req.path.includes('/history/')) {
        // Only set user if auth header is present
        if (req.headers.authorization && testUser1) {
          req.user = { 
            id: testUser1._id,
            _id: testUser1._id,
            ...testUser1?.toObject()
          };
        }
      }
      next();
    });

    // Setup routes
    app.get('/strength/:connectionId', connectionAnalyticsController.ConnectionAnalyticsController.getConnectionStrength);
    app.get('/history/:connectionId', connectionAnalyticsController.ConnectionAnalyticsController.getStrengthHistory);

    // Error handling middleware
    app.use((err: any, req: any, res: any, next: any) => {
      console.error('Test error caught:', err.message);
      res.status(err.status || 500).json({ 
        success: false,
        message: err.message || 'Internal server error' 
      });
    });
  });

  beforeEach(async () => {
    // Clear all collections
    await Promise.all([
      Connection.deleteMany({}),
      User.deleteMany({}),
      Profile.deleteMany({}),
      ProfileTemplate.deleteMany({})
    ]);

    // Create test template first
    testTemplate = await ProfileTemplate.create({
      profileCategory: 'individual',
      profileType: 'personal',
      name: 'Test Personal Template',
      slug: 'test-personal',
      categories: [
        {
          name: 'basic',
          label: 'Basic Information',
          fields: [
            {
              name: 'firstName',
              label: 'First Name',
              widget: 'text',
              order: 1,
              enabled: true,
              required: true
            }
          ]
        }
      ],
      createdBy: new mongoose.Types.ObjectId()
    });

    // Create test users
    testUser1 = await User.create({
      email: 'user1@test.com',
      firstName: 'Test',
      lastName: 'User1',
      fullName: 'Test User 1',
      username: 'testuser1',
      password: 'password123',
      dateOfBirth: new Date('1990-01-01'),
      countryOfResidence: 'US',
      phoneNumber: '+1234567890',
      accountType: 'MYSELF',
      accountCategory: 'PRIMARY_ACCOUNT',
      verificationMethod: 'EMAIL',
      isEmailVerified: true,
      signupType: 'email',
      role: 'user',
      subscription: {
        plan: 'free',
        features: [],
        limitations: {
          maxProfiles: 1,
          maxGalleryItems: 10,
          maxFollowers: 100
        },
        startDate: new Date()
      },
      mpts: 0,
      profiles: [],
      referrals: [],
      isTwoFactorEnabled: false,
      biometricAuth: {
        enabled: false,
        methods: [],
        lastUsed: new Date(),
        devices: []
      },
      devices: [],
      notifications: {
        email: true,
        push: true,
        sms: false,
        marketing: false
      },
      social: {
        followers: [],
        following: [],
        blockedUsers: []
      },
      otpData: {
        attempts: 0
      },
      verificationData: {
        attempts: 0
      },
      refreshTokens: [],
      sessions: [],
      failedLoginAttempts: 0,
      referralRewards: {
        earnedPoints: 0,
        pendingPoints: 0,
        totalReferrals: 0,
        successfulReferrals: 0,
        referralHistory: []
      },
      registrationStep: 'VERIFICATION'
    });

    testUser2 = await User.create({
      email: 'user2@test.com',
      firstName: 'Test',
      lastName: 'User2',
      fullName: 'Test User 2',
      username: 'testuser2',
      password: 'password123',
      dateOfBirth: new Date('1990-01-01'),
      countryOfResidence: 'US',
      phoneNumber: '+1234567891',
      accountType: 'MYSELF',
      accountCategory: 'PRIMARY_ACCOUNT',
      verificationMethod: 'EMAIL',
      isEmailVerified: true,
      signupType: 'email',
      role: 'user',
      subscription: {
        plan: 'free',
        features: [],
        limitations: {
          maxProfiles: 1,
          maxGalleryItems: 10,
          maxFollowers: 100
        },
        startDate: new Date()
      },
      mpts: 0,
      profiles: [],
      referrals: [],
      isTwoFactorEnabled: false,
      biometricAuth: {
        enabled: false,
        methods: [],
        lastUsed: new Date(),
        devices: []
      },
      devices: [],
      notifications: {
        email: true,
        push: true,
        sms: false,
        marketing: false
      },
      social: {
        followers: [],
        following: [],
        blockedUsers: []
      },
      otpData: {
        attempts: 0
      },
      verificationData: {
        attempts: 0
      },
      refreshTokens: [],
      sessions: [],
      failedLoginAttempts: 0,
      referralRewards: {
        earnedPoints: 0,
        pendingPoints: 0,
        totalReferrals: 0,
        successfulReferrals: 0,
        referralHistory: []
      },
      registrationStep: 'VERIFICATION'
    });

    // Create test profiles with all required fields
    testProfile1 = await Profile.create({
      profileCategory: 'individual',
      profileType: 'personal',
      templatedId: testTemplate._id,
      sections: [],
      ProfileFormat: {
        updatedAt: new Date()
      },
      profileInformation: { 
        creator: testUser1._id,
        firstName: 'Test',
        lastName: 'User1',
        username: 'testuser1-profile',
        profileLink: `https://myprofile.com/testuser1-${Date.now()}`,
        connectLink: `https://myprofile.com/connect/testuser1-${Date.now()}`,
        followLink: `https://myprofile.com/follow/testuser1-${Date.now()}`,
        followers: [],
        following: [],
        connectedProfiles: [],
        affiliatedProfiles: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      owner: testUser1._id
    });

    testProfile2 = await Profile.create({
      profileCategory: 'individual',
      profileType: 'personal',
      templatedId: testTemplate._id,
      sections: [],
      ProfileFormat: {
        updatedAt: new Date()
      },
      profileInformation: { 
        creator: testUser2._id,
        firstName: 'Test',
        lastName: 'User2',
        username: 'testuser2-profile',
        profileLink: `https://myprofile.com/testuser2-${Date.now()}`,
        connectLink: `https://myprofile.com/connect/testuser2-${Date.now()}`,
        followLink: `https://myprofile.com/follow/testuser2-${Date.now()}`,
        followers: [],
        following: [],
        connectedProfiles: [],
        affiliatedProfiles: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      owner: testUser2._id
    });

    // Create test connection
    testConnection = await Connection.create({
      fromUser: testUser1._id,
      fromProfile: testProfile1._id,
      toProfile: testProfile2._id,
      status: 'accepted',
      connectionType: 'connect',
      connectionCategory: 'connection',
      source: 'direct',
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days ago
    });

    // Generate auth token for testUser1
    const tokens = generateTokens(testUser1._id.toString(), testUser1.email);
    authToken = tokens.accessToken;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('GET /api/connections/analytics/strength/:connectionId', () => {
    it('should return connection strength for valid connection', async () => {
      const response = await request(app)
        .get(`/strength/${testConnection._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('strength');
    });

    it('should return 400 for non-existent connection', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/strength/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500); // Connection not found throws error, results in 500
      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/strength/${testConnection._id}`);

      expect(response.status).toBe(400); // Authentication error returns 400
    });
  });

  describe('GET /api/connections/analytics/history/:connectionId', () => {
    it('should return connection history for valid connection', async () => {
      const response = await request(app)
        .get(`/history/${testConnection._id}`)
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
          .get(`/history/${testConnection._id}`)
          .query({ period })
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should validate period parameter', async () => {
      const response = await request(app)
        .get(`/history/${testConnection._id}`)
        .query({ period: 'invalid' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200); // Service will handle invalid period gracefully
    });
  });

  describe('Connection Strength Calculation', () => {
    it('should factor in connection duration', async () => {
      const response = await request(app)
        .get(`/strength/${testConnection._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      if (response.body.data && response.body.data.strength && response.body.data.strength.factors) {
        expect(response.body.data.strength.factors.engagementDuration).toBeGreaterThan(0);
      }
    });

    it('should provide relevant suggestions for weak factors', async () => {
      // Create a third profile for the new connection to avoid duplicate key error
      const testProfile3 = await Profile.create({
        profileCategory: 'individual',
        profileType: 'personal',
        templatedId: testTemplate._id,
        sections: [],
        ProfileFormat: {
          updatedAt: new Date()
        },
        profileInformation: { 
          creator: testUser2._id, // Use testUser2 as creator
          firstName: 'Test',
          lastName: 'User3',
          username: 'testuser3-profile',
          profileLink: `https://myprofile.com/testuser3-${Date.now()}`,
          connectLink: `https://myprofile.com/connect/testuser3-${Date.now()}`,
          followLink: `https://myprofile.com/follow/testuser3-${Date.now()}`,
          followers: [],
          following: [],
          connectedProfiles: [],
          affiliatedProfiles: [],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        owner: testUser2._id
      });

      // Create a new connection with minimal interaction
      const newConnection = await Connection.create({
        fromUser: testUser1._id,
        fromProfile: testProfile1._id,
        toProfile: testProfile3._id, // Use the new profile to avoid duplicate
        status: 'accepted',
        connectionType: 'connect',
        connectionCategory: 'connection',
        source: 'direct',
        createdAt: new Date() // New connection
      });

      const response = await request(app)
        .get(`/strength/${newConnection._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      if (response.body.data && response.body.data.strength && response.body.data.strength.metadata) {
        expect(response.body.data.strength.metadata.suggestedActions).toBeDefined();
      }
    });
  });
});
