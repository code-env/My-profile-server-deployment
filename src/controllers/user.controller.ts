import { Request, Response } from "express";
import { User } from "../models/User";

export class UserControllers {
  /**
   * Get all users
   * @route GET /auth/users
   */
  static async GetAllUsers(req: Request, res: Response) {
    try {
      const users = await User.find({}, "_id email fullName username profileImage");
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

      // Fetch the user by ID and select only the required fields
      const user = await User.findById(id, "_id email username profileImage");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.status(200).json({ success: true, user });
    } catch (error: any) {
      console.error(error.message);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch user",
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
  
    
      const candidatesSet = new Set<string>();
      let iterations = 0;
      const maxIterations = 25;
  
     
      while (candidatesSet.size < 3 && iterations < maxIterations) {
        iterations++;
        const randomNumber = Math.floor(Math.random() * 11);
        const candidate = `~its${firstname.toLowerCase()}${dayOfBirth}${randomNumber}`;
        candidatesSet.add(candidate);
      }
  
      let candidateList = Array.from(candidatesSet);
  
  
      const existingUsers = await User.find({ username: { $in: candidateList } }).select('username');
      const existingUsernames = new Set(existingUsers.map(user => user.username));

      
      candidateList = candidateList.filter(candidate => !existingUsernames.has(candidate));
  
     
      while (candidateList.length < 3 && iterations < maxIterations) {
        iterations++;
        const randomNumber = Math.floor(Math.random() * 11);
        const candidate = `~its${firstname.toLowerCase()}${dayOfBirth}${randomNumber}`;
  
     
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
    } catch (error: any) {
      console.error(error.message);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to generate username",
      });
    }
  }
  




}