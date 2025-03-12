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
}
