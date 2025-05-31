import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../../models/User';
import { ProfileModel as Profile } from '../../models/profile.model';
import { UserControllers } from '../../controllers/user.controller';

// Mock the models
jest.mock('../../models/User');
jest.mock('../../models/profile.model');
jest.mock('mongoose');

describe('UserControllers', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
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

    // Setup request mock
    mockRequest = {};
  });

  describe('GetAllUsers', () => {
    it('should return all users successfully', async () => {
      const mockUsers = [
        { _id: '1', email: 'user1@test.com', fullName: 'User One' },
        { _id: '2', email: 'user2@test.com', fullName: 'User Two' },
      ];

      (User.find as jest.Mock).mockResolvedValue(mockUsers);

      await UserControllers.GetAllUsers(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        users: mockUsers,
      });
    });

    it('should handle errors when fetching users', async () => {
      const error = new Error('Database error');
      (User.find as jest.Mock).mockRejectedValue(error);

      await UserControllers.GetAllUsers(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database error',
      });
    });
  });

  describe('GetUserById', () => {
    beforeEach(() => {
      mockRequest = {
        params: { id: '123' },
      };
      (mongoose.connection as any) = {
        readyState: 1,
        name: 'test-db',
      };
    });

    it('should return user when found', async () => {
      const mockUser = {
        _id: '123',
        email: 'test@example.com',
        username: 'testuser',
        fullName: 'Test User',
        profileImage: 'image.jpg',
        phoneNumber: '1234567890',
        countryOfResidence: 'US',
        isEmailVerified: true,
        isPhoneVerified: true,
        accountType: 'personal',
        role: 'user',
      };

      (User.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      await UserControllers.GetUserById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        user: mockUser,
      });
    });

    it('should handle user not found', async () => {
      (User.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await UserControllers.GetUserById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
        debug: expect.any(Object),
      });
    });
  });

  describe('GetCurrentUser', () => {
    beforeEach(() => {
      mockRequest = {
        user: { _id: '123' },
      };
    });

    it('should return current user with profiles', async () => {
      const mockUser = {
        _id: '123',
        email: 'test@example.com',
        username: 'testuser',
      };

      const mockProfiles = [
        {
          _id: 'profile1',
          profileInformation: {
            title: 'Profile 1',
            creator: '123',
          },
          ProfileMypts: {
            currentBalance: 1000,
            lifetimeMypts: 2000,
          },
          profileCategory: 'personal',
          profileType: 'standard',
        },
      ];

      (User.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser),
      });
      (Profile.find as jest.Mock).mockResolvedValue(mockProfiles);

      await UserControllers.GetCurrentUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        user: expect.objectContaining({
          ...mockUser,
          profiles: expect.arrayContaining([
            expect.objectContaining({
              _id: 'profile1',
              name: 'Profile 1',
            }),
          ]),
        }),
      });
    });

    it('should handle unauthorized access', async () => {
      mockRequest = {
        user: null as unknown as typeof User,
      };

      await UserControllers.GetCurrentUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Not authenticated',
      });
    });
  });

  describe('UpdateUserInfo', () => {
    beforeEach(() => {
      mockRequest = {
        user: { _id: '123' },
        body: {
          fullName: 'Updated Name',
          email: 'updated@example.com',
          phoneNumber: '9876543210',
        },
      };
    });

    it('should update user information successfully', async () => {
      const mockUser = {
        _id: '123',
        fullName: 'Old Name',
        email: 'old@example.com',
        phoneNumber: '1234567890',
        save: jest.fn().mockResolvedValue(true),
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await UserControllers.UpdateUserInfo(mockRequest as Request, mockResponse as Response);

      expect(mockUser.save).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'User information updated successfully',
        user: expect.objectContaining({
          _id: '123',
          fullName: 'Updated Name',
          email: 'updated@example.com',
          phoneNumber: '9876543210',
        }),
      });
    });

    it('should handle user not found', async () => {
      (User.findById as jest.Mock).mockResolvedValue(null);

      await UserControllers.UpdateUserInfo(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
      });
    });
  });

  describe('UpdateProfileImage', () => {
    beforeEach(() => {
      mockRequest = {
        user: { _id: '123' },
        body: {
          profileImage: 'new-image.jpg',
        },
      };
    });

    it('should update profile image successfully', async () => {
      const mockUser = {
        _id: '123',
        profileImage: 'old-image.jpg',
        save: jest.fn().mockResolvedValue(true),
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await UserControllers.UpdateProfileImage(mockRequest as Request, mockResponse as Response);

      expect(mockUser.save).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Profile image updated successfully',
        user: {
          _id: '123',
          profileImage: 'new-image.jpg',
        },
      });
    });

    it('should handle missing profile image URL', async () => {
      mockRequest.body = {};

      await UserControllers.UpdateProfileImage(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Profile image URL is required',
      });
    });
  });

  describe('GenerateUsername', () => {
    beforeEach(() => {
      mockRequest = {
        query: { firstname: 'John Doe' },
      };
    });

    it('should generate unique usernames', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);

      await UserControllers.GenerateUsername(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        usernames: expect.arrayContaining([
          expect.any(String),
          expect.any(String),
          expect.any(String),
        ]),
      });
    });

    it('should handle missing firstname', async () => {
      mockRequest.query = {};

      await UserControllers.GenerateUsername(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Firstname (full name) is required',
      });
    });
  });

  describe('AdminUpdateUserById', () => {
    beforeEach(() => {
      mockRequest = {
        params: { id: '123' },
        user: { _id: 'admin123', role: 'admin' },
        body: {
          fullName: 'Updated Name',
          email: 'updated@example.com',
        },
      };
    });

    it('should allow admin to update user', async () => {
      const mockUser = {
        _id: '123',
        fullName: 'Old Name',
        email: 'old@example.com',
        save: jest.fn().mockResolvedValue(true),
      };

      (mongoose.Types.ObjectId.isValid as jest.Mock).mockReturnValue(true);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await UserControllers.AdminUpdateUserById(mockRequest as Request, mockResponse as Response);

      expect(mockUser.save).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'User updated successfully',
        user: expect.objectContaining({
          _id: '123',
          fullName: 'Updated Name',
          email: 'updated@example.com',
        }),
      });
    });

    it('should handle non-admin access', async () => {
      mockRequest.user = { _id: 'user123', role: 'user' };

      await UserControllers.AdminUpdateUserById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Admin access required',
      });
    });
  });
}); 