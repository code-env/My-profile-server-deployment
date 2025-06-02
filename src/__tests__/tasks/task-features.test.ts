import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import appServer from '../../app';
import { User } from '../../models/User';
import { ProfileModel } from '../../models/profile.model';
import { TaskStatus, PriorityLevel, TaskCategory, TaskType } from '../../models/plans-shared';

const app = appServer.getApp();

let mongoServer: MongoMemoryServer;
let testUser: any;
let testProfile: any;
let authToken: string;
let testTask: any;

// Set timeout for all tests
jest.setTimeout(10000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  await new Promise(resolve => setTimeout(resolve, 500)); // Allow time for cleanup
});

describe('Task Features API Endpoints', () => {
  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    // Create test user with all required fields
    testUser = await User.create({
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      fullName: 'Test User',
      username: 'testuser',
      dateOfBirth: new Date('1990-01-01'),
      countryOfResidence: 'US',
      phoneNumber: '+1234567890',
      accountType: 'MYSELF',
      accountCategory: 'PRIMARY_ACCOUNT',
      verificationMethod: 'EMAIL',
      signupType: 'email'
    });

    // Create test profile
    testProfile = await ProfileModel.create({
      name: 'Test Profile',
      profileInformation: {
        username: 'testprofile',
        profileLink: 'test-profile-link',
        connectLink: 'test-connect-link',
        followLink: 'test-follow-link',
        creator: testUser._id,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      templatedId: new mongoose.Types.ObjectId(),
      profileType: 'personal',
      profileCategory: 'individual'
    });

    // Get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
        identifier: 'test@example.com'
      });
    
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.success).toBe(true);
    expect(loginResponse.body.tokens).toBeDefined();
    expect(loginResponse.body.tokens.accessToken).toBeDefined();
    expect(loginResponse.body.tokens.refreshToken).toBeDefined();
    
    authToken = loginResponse.body.tokens.accessToken;

    // Create a test task
    const taskResponse = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Test Task',
        type: TaskType.Todo,
        status: TaskStatus.Todo,
        priority: PriorityLevel.High,
        category: TaskCategory.Personal,
        profile: testProfile._id,
        createdBy: testUser._id,
        settings: {
          visibility: {
            level: 'Public',
            customUsers: []
          },
          notifications: {
            enabled: true,
            channels: {
              push: true,
              email: true
            },
            reminderSettings: {
              defaultReminder: 30,
              customReminders: []
            }
          },
          privacy: {
            allowComments: true,
            allowLikes: true,
            allowParticipants: true
          }
        }
      });

    testTask = taskResponse.body.data;
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  describe('Subtask Management', () => {
    it('should add a subtask', async () => {
      const subtaskData = {
        description: 'Test Subtask',
        isCompleted: false
      };

      const response = await request(app)
        .post(`/api/tasks/${testTask._id}/subtasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(subtaskData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.subTasks).toHaveLength(1);
      expect(response.body.data.subTasks[0].description).toBe(subtaskData.description);
    });

    it('should update a subtask', async () => {
      // First add a subtask
      const createResponse = await request(app)
        .post(`/api/tasks/${testTask._id}/subtasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Test Subtask',
          isCompleted: false
        });

      const updateData = {
        description: 'Updated Subtask',
        isCompleted: true
      };

      const response = await request(app)
        .put(`/api/tasks/${testTask._id}/subtasks/0`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.subTasks[0].description).toBe(updateData.description);
      expect(response.body.data.subTasks[0].isCompleted).toBe(true);
    });

    it('should delete a subtask', async () => {
      // First add a subtask
      await request(app)
        .post(`/api/tasks/${testTask._id}/subtasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Test Subtask',
          isCompleted: false
        });

      const response = await request(app)
        .delete(`/api/tasks/${testTask._id}/subtasks/0`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.subTasks).toHaveLength(0);
    });
  });

  describe('Comment Management', () => {
    it('should add a comment', async () => {
      const commentData = {
        text: 'Test Comment'
      };

      const response = await request(app)
        .post(`/api/tasks/${testTask._id}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(commentData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.comments).toHaveLength(1);
      expect(response.body.data.comments[0].text).toBe(commentData.text);
      expect(response.body.data.comments[0].postedBy.toString()).toBe(testProfile._id.toString());
    });

    it('should like a comment', async () => {
      // First add a comment
      await request(app)
        .post(`/api/tasks/${testTask._id}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Test Comment'
        });

      const response = await request(app)
        .post(`/api/tasks/${testTask._id}/comments/0/like`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ profileId: testProfile._id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.comments[0].likes).toContain(testProfile._id.toString());
    });

    it('should unlike a comment', async () => {
      // First add a comment and like it
      await request(app)
        .post(`/api/tasks/${testTask._id}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Test Comment'
        });

      await request(app)
        .post(`/api/tasks/${testTask._id}/comments/0/like`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ profileId: testProfile._id });

      const response = await request(app)
        .delete(`/api/tasks/${testTask._id}/comments/0/like`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ profileId: testProfile._id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.comments[0].likes).not.toContain(testProfile._id.toString());
    });
  });

  describe('Attachment Management', () => {
    it('should add an attachment', async () => {
      const attachmentData = {
        name: 'test.txt',
        url: 'https://example.com/test.txt',
        type: 'text/plain',
        size: 1024
      };

      const response = await request(app)
        .post(`/api/tasks/${testTask._id}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(attachmentData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.attachments).toHaveLength(1);
      expect(response.body.data.attachments[0].name).toBe(attachmentData.name);
      expect(response.body.data.attachments[0].url).toBe(attachmentData.url);
    });

    it('should remove an attachment', async () => {
      // First add an attachment
      const attachmentData = {
        name: 'test.txt',
        url: 'https://example.com/test.txt',
        type: 'text/plain',
        size: 1024
      };

      const addResponse = await request(app)
        .post(`/api/tasks/${testTask._id}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(attachmentData);

      expect(addResponse.status).toBe(200);
      expect(addResponse.body.success).toBe(true);
      expect(addResponse.body.data.attachments).toHaveLength(1);

      // Get the attachment ID from the response
      const attachmentId = addResponse.body.data.attachments[0]._id;

      const response = await request(app)
        .delete(`/api/tasks/${testTask._id}/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.attachments).toHaveLength(0);
    });
  });

  describe('Task Settings', () => {
    it('should get task settings', async () => {
      const response = await request(app)
        .get(`/api/tasks/${testTask._id}/settings`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.settings).toBeDefined();
      expect(response.body.data.settings.visibility).toBeDefined();
      expect(response.body.data.settings.notifications).toBeDefined();
      expect(response.body.data.settings.privacy).toBeDefined();
    });

    it('should update task settings', async () => {
      const settingsData = {
        visibility: {
          level: 'OnlyMe'
        },
        notifications: {
          enabled: true,
          channels: {
            push: true,
            email: true
          },
          reminderSettings: {
            defaultReminder: 30,
            customReminders: []
          }
        },
        privacy: {
          allowComments: false,
          allowLikes: false
        }
      };

      const response = await request(app)
        .put(`/api/tasks/${testTask._id}/settings`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(settingsData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.settings.visibility.level).toBe(settingsData.visibility.level);
      expect(response.body.data.settings.notifications.enabled).toBe(settingsData.notifications.enabled);
      expect(response.body.data.settings.privacy.allowComments).toBe(settingsData.privacy.allowComments);
    });
  });
}); 