import { Request, Response } from "express";
import { User } from "../models/User";
import mongoose from 'mongoose';

export class UserControllers {
  /**
   * Get all users
   * @route GET /auth/users
   */
  static async GetAllUsers(req: Request, res: Response) {
    try {
      const users = await User.find({}, "_id email fullName username profileImage phoneNumber formattedPhoneNumber");
      res.status(200).json({ success: true, users });
    } catch (error: any) {
      console.error(error.message);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch users",
      });
    }
  }

  /**
   * Get user by ID
   * @route GET /auth/users/:id
   * @param req - Express request object
   * @param res - Express response object
   */
  static async GetUserById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      console.log('Fetching user with ID:', id);

      // Check MongoDB connection state
      const connectionState = mongoose.connection.readyState;
      console.log('MongoDB connection state:', connectionState);
      // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting

      if (connectionState !== 1) {
        return res.status(500).json({
          success: false,
          message: "Database connection not established",
          debug: { connectionState }
        });
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        console.log('Invalid ObjectId format:', id);
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format"
        });
      }

      // Get database name
      const dbName = mongoose.connection.name;
      console.log('Connected to database:', dbName);

      // Try to find user
      const user = await User.findById(id).exec();
      console.log('User query result:', user);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
          debug: {
            searchedId: id,
            modelName: User.modelName,
            collectionName: User.collection.name,
            databaseName: dbName
          }
        });
      }

      res.status(200).json({
        success: true,
        user: {
          _id: user._id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          profileImage: user.profileImage || null,
          phoneNumber: user.phoneNumber,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
          accountType: user.accountType,
          role: user.role
        }
      });
    } catch (error: any) {
      console.error('Error in GetUserById:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch user",
        debug: process.env.NODE_ENV === 'development' ? {
          errorType: error.constructor.name,
          errorMessage: error.message,
          userId: req.params.id,
          connectionState: mongoose.connection.readyState
        } : undefined
      });
    }
  }

  /**
   * Delete user by ID
   * @route PUT /auth/users/:id
   * @param req - Express request object
   * @param res - Express response object
   */
  static async DeleteUserById(req: Request, res: Response) {
    try {
      const { id } = req.params;


      const user = await User.findByIdAndDelete(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.status(200).json({ success: true, message: "User deleted successfully" });
    } catch (error: any) {
      console.error(error.message);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to delete user",
      });
    }
  }


/**
 * Generate a user name
 * @route GET /auth/users/generate-username
 * @param req - Express request object
 * @param res - Express response object
 */
static async GenerateUsername(req: Request, res: Response) {
  try {
    const { firstname, dateOfBirth } = req.body;

    if (!firstname || !dateOfBirth) {
      return res.status(400).json({
        success: false,
        message: "Firstname and dateOfBirth are required",
      });
    }

    const dayOfBirth = new Date(dateOfBirth).getDate();

    if (isNaN(dayOfBirth)) {
      return res.status(400).json({
        success: false,
        message: "Invalid dateOfBirth format",
      });
    }

    // Replace spaces and truncate firstname
    const sanitizedFirstname: string = firstname.toLowerCase().replace(/\s+/g, '_').slice(0, 8);

    const candidatesSet: Set<string> = new Set();
    let iterations = 0;
    const maxIterations = 25;

    while (candidatesSet.size < 3 && iterations < maxIterations) {
      iterations++;
      const randomNumber = Math.floor(Math.random() * 11);
      const candidate = `~its${sanitizedFirstname}${dayOfBirth}${randomNumber}`;
      candidatesSet.add(candidate);
    }

    let candidateList: string[] = Array.from(candidatesSet);

    const existingUsers = await User.find({ username: { $in: candidateList } }).select('username');
    const existingUsernames = new Set(existingUsers.map(user => user.username));

    candidateList = candidateList.filter(candidate => !existingUsernames.has(candidate));

    while (candidateList.length < 3 && iterations < maxIterations) {
      iterations++;
      const randomNumber = Math.floor(Math.random() * 11);
      const candidate = `~its${sanitizedFirstname}${dayOfBirth}${randomNumber}`;

      if (existingUsernames.has(candidate) || candidateList.includes(candidate)) continue;

      candidateList.push(candidate);
    }

    if (candidateList.length < 3) {
      return res.status(500).json({
        success: false,
        message: "Unable to generate three unique usernames. Please try again.",
      });
    }

    res.status(200).json({ success: true, usernames: candidateList.slice(0, 3) });
  } catch (error: unknown) {
    console.error((error as Error).message);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to generate username",
    });
  }
}



}
