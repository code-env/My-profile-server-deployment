import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../../models/User';
import { ProfileModel as Profile } from '../../models/profile.model';
import { UserControllers } from '../../controllers/user.controller';

// Mock the profile model and mongoose
jest.mock('../../models/profile.model');
jest.mock('mongoose', () => {
  const mockObjectId = jest.fn().mockImplementation((id) => ({
    toString: () => id,
    _id: id,
  }));
  
  // Add isValid method using Object.assign to avoid TypeScript errors
  Object.assign(mockObjectId, {
    isValid: jest.fn().mockReturnValue(true)
  });
  
  return {
    ...jest.requireActual('mongoose'),
    connection: {
      readyState: 1,
      name: 'test-db',
    },
    Types: {
      ObjectId: mockObjectId,
    },
  };
});

describe('UserControllers', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseObject: any = {};

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock User model methods
    jest.spyOn(User, 'find').mockImplementation();
    jest.spyOn(User, 'findById').mockImplementation();
    jest.spyOn(User, 'findOne').mockImplementation();
    jest.spyOn(User, 'findByIdAndDelete').mockImplementation();

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

  afterEach(() => {
    // Restore mocks after each test
    jest.restoreAllMocks();
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
        user: { _id: '123' } as any,
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
        user: null as any,
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
        user: { _id: '123' } as any,
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
        user: { _id: '123' } as any,
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
        user: { _id: 'admin123', role: 'admin' } as any,
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
      mockRequest.user = { _id: 'user123', role: 'user' } as any;

      await UserControllers.AdminUpdateUserById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Admin access required',
      });
    });

    it('should handle invalid user ID', async () => {
      (mongoose.Types.ObjectId.isValid as jest.Mock).mockReturnValue(false);

      await UserControllers.AdminUpdateUserById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid user ID',
      });
    });

    it('should handle user not found', async () => {
      (mongoose.Types.ObjectId.isValid as jest.Mock).mockReturnValue(true);
      (User.findById as jest.Mock).mockResolvedValue(null);

      await UserControllers.AdminUpdateUserById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
      });
    });

    it('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      (mongoose.Types.ObjectId.isValid as jest.Mock).mockReturnValue(true);
      (User.findById as jest.Mock).mockRejectedValue(error);

      await UserControllers.AdminUpdateUserById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database connection failed',
        debug: undefined,
      });
    });
  });

  describe('DeleteUserById', () => {
    beforeEach(() => {
      mockRequest = {
        params: { id: '123' },
      };
    });

    it('should delete user successfully', async () => {
      const mockUser = {
        _id: '123',
        email: 'test@example.com',
        fullName: 'Test User',
      };

      (User.findByIdAndDelete as jest.Mock).mockResolvedValue(mockUser);

      await UserControllers.DeleteUserById(mockRequest as Request, mockResponse as Response);

      expect(User.findByIdAndDelete).toHaveBeenCalledWith('123');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'User deleted successfully',
      });
    });

    it('should handle user not found', async () => {
      (User.findByIdAndDelete as jest.Mock).mockResolvedValue(null);

      await UserControllers.DeleteUserById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
      });
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      (User.findByIdAndDelete as jest.Mock).mockRejectedValue(error);

      await UserControllers.DeleteUserById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database error',
      });
    });
  });

  // Additional edge cases for existing methods
  describe('GetUserById - Additional Edge Cases', () => {
    beforeEach(() => {
      mockRequest = {
        params: { id: 'invalid-id' },
      };
    });

    it('should handle invalid ObjectId format', async () => {
      // Mock mongoose.Types.ObjectId constructor to throw error
      const mockObjectIdConstructor = jest.fn().mockImplementation(() => {
        throw new Error('Invalid ObjectId');
      });
      
      // Replace the constructor temporarily
      const originalObjectId = mongoose.Types.ObjectId;
      (mongoose.Types as any).ObjectId = mockObjectIdConstructor;

      await UserControllers.GetUserById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid user ID format',
      });

      // Restore original constructor
      (mongoose.Types as any).ObjectId = originalObjectId;
    });

    it('should handle database connection issues', async () => {
      // Mock connection state as disconnected
      (mongoose.connection as any).readyState = 0;

      await UserControllers.GetUserById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database connection not established',
        debug: { connectionState: 0 },
      });

      // Restore connection state
      (mongoose.connection as any).readyState = 1;
    });
  });

  describe('GetCurrentUser - Additional Edge Cases', () => {
    beforeEach(() => {
      mockRequest = {
        user: { _id: '123' } as any,
      };
    });

    it('should handle user not found in database', async () => {
      (User.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await UserControllers.GetCurrentUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
      });
    });

    it('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      (User.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockRejectedValue(error),
      });

      await UserControllers.GetCurrentUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database connection failed',
      });
    });
  });

  describe('UpdateUserInfo - Additional Edge Cases', () => {
    beforeEach(() => {
      mockRequest = {
        user: { _id: '123' } as any,
        body: {
          fullName: 'Updated Name',
        },
      };
    });

    it('should handle unauthenticated user', async () => {
      mockRequest.user = null as any;

      await UserControllers.UpdateUserInfo(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Not authenticated',
      });
    });

    it('should handle database save errors', async () => {
      const mockUser = {
        _id: '123',
        fullName: 'Old Name',
        save: jest.fn().mockRejectedValue(new Error('Save failed')),
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await UserControllers.UpdateUserInfo(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Save failed',
      });
    });
  });

  describe('UpdateProfileImage - Additional Edge Cases', () => {
    beforeEach(() => {
      mockRequest = {
        user: { _id: '123' } as any,
        body: {
          profileImage: 'new-image.jpg',
        },
      };
    });

    it('should handle unauthenticated user', async () => {
      mockRequest.user = null as any;

      await UserControllers.UpdateProfileImage(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Not authenticated',
      });
    });

    it('should handle user not found', async () => {
      (User.findById as jest.Mock).mockResolvedValue(null);

      await UserControllers.UpdateProfileImage(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
      });
    });

    it('should handle database save errors', async () => {
      const mockUser = {
        _id: '123',
        profileImage: 'old-image.jpg',
        save: jest.fn().mockRejectedValue(new Error('Save failed')),
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await UserControllers.UpdateProfileImage(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Save failed',
      });
    });
  });

  describe('GenerateUsername - Additional Edge Cases', () => {
    beforeEach(() => {
      mockRequest = {
        query: { firstname: 'John Doe' },
      };
    });

    it('should handle database errors when checking username availability', async () => {
      const error = new Error('Database connection failed');
      (User.findOne as jest.Mock).mockRejectedValue(error);

      await UserControllers.GenerateUsername(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database connection failed',
      });
    });

    it('should handle very long names', async () => {
      mockRequest.query = { firstname: 'A'.repeat(100) }; // Very long name
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

      // Check that usernames are properly truncated
      const response = responseObject;
      response.usernames.forEach((username: string) => {
        expect(username.length).toBeLessThanOrEqual(20);
      });
    });

    it('should handle names with special characters', async () => {
      mockRequest.query = { firstname: 'José María Ñoño' };
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
  });
}); 