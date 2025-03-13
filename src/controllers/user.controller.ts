import { Request, Response } from "express";
import { User } from "../models/User";

export class ChatUserControllers {
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
}