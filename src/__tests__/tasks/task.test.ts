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

describe('Task API Endpoints', () => {
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
        creator: testUser._id
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
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  describe('POST /api/tasks', () => {
    it('should create a new task with all fields', async () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      const taskData = {
        title: 'Test Task',
        description: 'Test Description',
        profile: testProfile._id,
        category: TaskCategory.Personal,
        priority: PriorityLevel.Medium,
        status: TaskStatus.Todo,
        visibility: 'Public',
        type: TaskType.Todo,
        isAllDay: false,
        startTime: now.toISOString(),
        endTime: tomorrow.toISOString(),
        duration: {
          hours: 2,
          minutes: 30
        },
        name: 'Test Task',
        createdBy: testUser._id,
        repeat: {
          isRepeating: true,
          frequency: 'Daily',
          interval: 1,
          endCondition: 'Never'
        },
        reminders: [{
          time: now.toISOString(),
          type: 'Push',
          message: 'Test reminder'
        }],
        settings: {
          visibility: {
            level: 'Public',
            customUsers: []
          },
          notifications: {
            enabled: true,
            channels: {
              push: true,
              email: true,
              inApp: true
            }
          },
          privacy: {
            allowComments: true,
            allowLikes: true,
            allowParticipants: true
          }
        }
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(taskData.title);
      expect(response.body.data.profile.toString()).toBe(testProfile._id.toString());
      expect(response.body.data.createdBy.toString()).toBe(testUser._id.toString());
    });

    it('should create an all-day task', async () => {
      const taskData = {
        title: 'All Day Task',
        name: 'All Day Task',
        type: TaskType.Event,
        status: TaskStatus.Upcoming,
        priority: PriorityLevel.High,
        category: TaskCategory.Family,
        isAllDay: true,
        startTime: new Date().toISOString(),
        profile: testProfile._id,
        visibility: 'Public'
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      expect(response.status).toBe(201);
      expect(response.body.data.isAllDay).toBe(true);
    });

    it('should validate required fields', async () => {
      const invalidTask = {
        description: 'Missing required fields'
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidTask);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/tasks', () => {
    beforeEach(async () => {
      // Create some test tasks
      const tasks = [
        {
          title: 'Task 1',
          type: TaskType.Todo,
          status: TaskStatus.Todo,
          priority: PriorityLevel.High,
          category: TaskCategory.Personal,
          profile: testProfile._id,
          createdBy: testUser._id
        },
        {
          title: 'Task 2',
          type: TaskType.Todo,
          status: TaskStatus.InProgress,
          priority: PriorityLevel.Medium,
          category: TaskCategory.Family,
          profile: testProfile._id,
          createdBy: testUser._id
        }
      ];

      await Promise.all(tasks.map(task => 
        request(app)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send(task)
      ));
    });

    it('should get all tasks for a profile', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ profileId: testProfile._id.toString() });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should filter tasks by status', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          profileId: testProfile._id.toString(),
          status: TaskStatus.Todo
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe(TaskStatus.Todo);
    });

    it('should filter tasks by category', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          profileId: testProfile._id.toString(),
          category: TaskCategory.Family
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].category).toBe(TaskCategory.Family);
    });

    it('should filter tasks by priority', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          profileId: testProfile._id.toString(),
          priority: PriorityLevel.High
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].priority).toBe(PriorityLevel.High);
    });
  });

  describe('GET /api/tasks/:id', () => {
    let testTask: any;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Task',
          type: TaskType.Todo,
          status: TaskStatus.Todo,
          priority: PriorityLevel.High,
          category: TaskCategory.Personal,
          profile: testProfile._id
        });

      testTask = response.body.data;
    });

    it('should get a task by id', async () => {
      const response = await request(app)
        .get(`/api/tasks/${testTask._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(testTask._id);
    });

    it('should return 404 for non-existent task', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/tasks/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/tasks/:id', () => {
    let testTask: any;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Task',
          description: 'Test Description',
          profile: testProfile._id,
          type: TaskType.Todo,
          status: TaskStatus.Todo,
          priority: PriorityLevel.Medium,
          category: TaskCategory.Personal,
          visibility: 'Public'
        });

      testTask = response.body.data;
    });

    it('should update task settings', async () => {
      const updateData = {
        title: 'Updated Task',
        description: 'Updated Description',
        profile: testProfile._id,
        settings: {
          visibility: {
            level: 'Private'
          },
          notifications: {
            enabled: false
          }
        }
      };

      const response = await request(app)
        .put(`/api/tasks/${testTask._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.description).toBe(updateData.description);
      expect(response.body.data.settings.visibility.level).toBe('Private');
      expect(response.body.data.settings.notifications.enabled).toBe(false);
    });

    it('should update task status and add completedAt', async () => {
      const updateData = {
        status: TaskStatus.Completed,
        profile: testProfile._id,
        title: testTask.title,
        visibility: testTask.visibility
      };

      const response = await request(app)
        .put(`/api/tasks/${testTask._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(TaskStatus.Completed);
      expect(response.body.data.completedAt).toBeDefined();
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    let testTask: any;

    beforeEach(async () => {
      // Create a task with explicit createdBy field
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Task',
          name: 'Test Task',
          description: 'Test Description',
          profile: testProfile._id,
          type: TaskType.Todo,
          status: TaskStatus.Todo,
          priority: PriorityLevel.High,
          category: TaskCategory.Personal,
          visibility: 'Public',
          createdBy: testUser._id
        });

      testTask = response.body.data;
      
      // Verify the task was created with correct ownership
      expect(response.status).toBe(201);
      expect(testTask.createdBy).toBe(testUser._id.toString());
    });

    it('should delete a task', async () => {
      const response = await request(app)
        .delete(`/api/tasks/${testTask._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify task is deleted
      const getResponse = await request(app)
        .get(`/api/tasks/${testTask._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent task', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .delete(`/api/tasks/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});