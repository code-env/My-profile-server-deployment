import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import appServer from '../../app';
import { User } from '../../models/User';
import { ProfileModel } from '../../models/profile.model';
import { Task } from '../../models/Tasks';
import { TaskStatus, PriorityLevel, TaskCategory, TaskType } from '../../models/plans-shared';
import { Request, Response, NextFunction } from 'express';
import * as TaskController from '../../controllers/task.controller';

// Mock the models
jest.mock('../../models/User');
jest.mock('../../models/profile.model');
jest.mock('../../models/Tasks');
jest.mock('mongoose');

// Mock Task model methods
const mockTask = {
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  create: jest.fn()
};

(Task as any) = mockTask;

const app = appServer.getApp();

let mongoServer: MongoMemoryServer;
let testUser: any;
let testProfile: any;
let authToken: string;
let testTask: any;

// Set timeout for all tests
// jest.setTimeout(10000);

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

describe('Task Features API Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let responseObject: any = {};

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

    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup response mock
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation((result) => {
        responseObject = result;
        return mockResponse;
      }),
    };

    mockNext = jest.fn();
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  describe('Task Comments', () => {
    beforeEach(() => {
      mockRequest = {
        user: testUser,
        params: { id: testTask._id.toString() },
        body: {
          text: 'Test comment',
          profile: testProfile._id.toString()
        }
      };
    });

    it('should add a comment to a task', async () => {
      const mockComment = {
        _id: new mongoose.Types.ObjectId(),
        text: mockRequest.body.text,
        postedBy: testProfile._id,
        createdAt: new Date()
      };

      (Task.findById as jest.Mock).mockResolvedValue({
        ...testTask,
        profile: testProfile
      });

      const updatedTask = {
        ...testTask,
        profile: testProfile,
        comments: [mockComment]
      };

      (Task.findByIdAndUpdate as jest.Mock).mockResolvedValue(updatedTask);

      await TaskController.addComment(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedTask,
        message: 'Comment added successfully'
      });
    });

    it('should return 404 for non-existent task', async () => {
      (Task.findById as jest.Mock).mockResolvedValue(null);

      await TaskController.addComment(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Task not found'
      });
    });
  });

  describe('Task Likes', () => {
    beforeEach(() => {
      mockRequest = {
        user: testUser,
        params: { id: testTask._id.toString() },
        body: {
          profile: testProfile._id.toString()
        }
      };
    });

    it('should like a task', async () => {
      const taskWithoutLike = {
        ...testTask,
        profile: testProfile,
        likes: []
      };

      const updatedTask = {
        ...taskWithoutLike,
        likes: [testProfile._id]
      };

      (Task.findById as jest.Mock).mockResolvedValue(taskWithoutLike);
      (Task.findByIdAndUpdate as jest.Mock).mockResolvedValue(updatedTask);

      await TaskController.likeTask(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: 1,
        message: 'Task liked successfully'
      });
    });

    it('should return 404 for non-existent task', async () => {
      (Task.findById as jest.Mock).mockResolvedValue(null);

      await TaskController.likeTask(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Task not found'
      });
    });
  });

  describe('Task Settings', () => {
    beforeEach(() => {
      mockRequest = {
        user: testUser,
        params: { id: testTask._id.toString() },
        body: {
          visibility: {
            level: 'OnlyMe'
          },
          notifications: {
            enabled: false
          }
        }
      };
    });

    it('should update task settings', async () => {
      const updatedTask = {
        ...testTask,
        settings: mockRequest.body
      };

      (Task.findById as jest.Mock).mockResolvedValue(testTask);
      (Task.findByIdAndUpdate as jest.Mock).mockResolvedValue(updatedTask);

      await TaskController.updateTaskSettings(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedTask,
        message: 'Task settings updated successfully'
      });
    });

    it('should get task settings', async () => {
      const taskWithSettings = {
        ...testTask,
        settings: {
          visibility: {
            level: 'Public'
          },
          notifications: {
            enabled: true
          }
        }
      };

      (Task.findById as jest.Mock).mockResolvedValue(taskWithSettings);

      await TaskController.getTaskSettings(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          settings: taskWithSettings.settings,
          taskId: taskWithSettings._id,
          title: taskWithSettings.title
        },
        message: 'Task settings fetched successfully'
      });
    });
  });
}); 