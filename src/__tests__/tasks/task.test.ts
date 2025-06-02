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

const app = appServer.getApp();

let mongoServer: MongoMemoryServer;
let testUser: any;
let testProfile: any;
let authToken: string;

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

// Mock the models
jest.mock('../../models/User');
jest.mock('../../models/profile.model');
jest.mock('../../models/Tasks');
jest.mock('mongoose');

describe('Task API Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let responseObject: any = {};

  beforeEach(() => {
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

    // Setup test user
    testUser = {
      _id: new mongoose.Types.ObjectId(),
      email: 'test@example.com',
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
    };

    // Setup test profile
    testProfile = {
      _id: new mongoose.Types.ObjectId(),
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
    };

    // Mock User.create
    (User.create as jest.Mock).mockResolvedValue(testUser);
    (ProfileModel.create as jest.Mock).mockResolvedValue(testProfile);
  });

  describe('Create Task', () => {
    beforeEach(() => {
      mockRequest = {
        user: testUser,
        body: {
          title: 'Test Task',
          description: 'Test Description',
          profile: testProfile._id,
          type: TaskType.Todo,
          status: TaskStatus.Todo,
          priority: PriorityLevel.Medium,
          category: TaskCategory.Personal,
          visibility: 'Public'
        }
      };
    });

    it('should create a new task successfully', async () => {
      const mockTask = {
        _id: new mongoose.Types.ObjectId(),
        ...mockRequest.body,
        createdBy: testUser._id
      };

      (Task.create as jest.Mock).mockResolvedValue(mockTask);

      await TaskController.createTask(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockTask,
        message: 'Task created successfully'
      });
    });

    it('should handle validation errors', async () => {
      mockRequest.body = {
        description: 'Missing required fields'
      };

      await TaskController.createTask(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('required')
      });
    });
  });

  describe('Get Tasks', () => {
    beforeEach(() => {
      mockRequest = {
        user: testUser,
        query: {
          profileId: testProfile._id.toString()
        }
      };
    });

    it('should get all tasks for a profile', async () => {
      const mockTasks = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: 'Task 1',
          profile: testProfile._id,
          createdBy: testUser._id
        },
        {
          _id: new mongoose.Types.ObjectId(),
          title: 'Task 2',
          profile: testProfile._id,
          createdBy: testUser._id
        }
      ];

      (Task.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockTasks)
      });

      await TaskController.getUserTasks(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockTasks,
        message: 'Tasks fetched successfully'
      });
    });
  });

  describe('Update Task', () => {
    const taskId = new mongoose.Types.ObjectId();

    beforeEach(() => {
      mockRequest = {
        user: testUser,
        params: { id: taskId.toString() },
        body: {
          title: 'Updated Task',
          description: 'Updated Description',
          profile: testProfile._id,
          status: TaskStatus.Completed
        }
      };
    });

    it('should update a task successfully', async () => {
      const mockUpdatedTask = {
        _id: taskId,
        ...mockRequest.body,
        createdBy: testUser._id,
        completedAt: new Date()
      };

      (Task.findOneAndUpdate as jest.Mock).mockResolvedValue(mockUpdatedTask);

      await TaskController.updateTask(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockUpdatedTask,
        message: 'Task updated successfully'
      });
    });
  });

  describe('Delete Task', () => {
    const taskId = new mongoose.Types.ObjectId();

    beforeEach(() => {
      mockRequest = {
        user: testUser,
        params: { id: taskId.toString() }
      };
    });

    it('should delete a task successfully', async () => {
      (Task.findOneAndDelete as jest.Mock).mockResolvedValue({
        _id: taskId,
        createdBy: testUser._id
      });

      await TaskController.deleteTask(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: null,
        message: 'Task deleted successfully'
      });
    });

    it('should return 404 for non-existent task', async () => {
      (Task.findOneAndDelete as jest.Mock).mockResolvedValue(null);

      await TaskController.deleteTask(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Task not found'
      });
    });
  });
});