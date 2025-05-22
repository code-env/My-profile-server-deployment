import { Request, Response } from "express";
import { User } from "../models/User";
import mongoose from "mongoose";
import { ProfileModel as Profile } from "../models/profile.model";

export class UserControllers {
  /**
   * Get all users
   * @route GET /auth/users
   */
  static async GetAllUsers(req: Request, res: Response) {
    try {
      const users = await User.find(
        {},
        "_id email fullName username profileImage phoneNumber formattedPhoneNumber"
      );
      res.status(200).json({ success: true, users });
    } catch (error: any) {
      console.error(error.message);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to fetch users",
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

      console.log("Fetching user with ID:", id);

      // Check MongoDB connection state
      const connectionState = mongoose.connection.readyState;
      console.log("MongoDB connection state:", connectionState);
      // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting

      if (connectionState !== 1) {
        return res.status(500).json({
          success: false,
          message: "Database connection not established",
          debug: { connectionState },
        });
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        console.log("Invalid ObjectId format:", id);
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format",
        });
      }

      // Get database name
      const dbName = mongoose.connection.name;
      console.log("Connected to database:", dbName);

      // Try to find user
      const user = await User.findById(id).exec();
      console.log("User query result:", user);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
          debug: {
            searchedId: id,
            modelName: User.modelName,
            collectionName: User.collection.name,
            databaseName: dbName,
          },
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
          role: user.role,
        },
      });
    } catch (error: any) {
      console.error("Error in GetUserById:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to fetch user",
        debug:
          process.env.NODE_ENV === "development"
            ? {
                errorType: error.constructor.name,
                errorMessage: error.message,
                userId: req.params.id,
                connectionState: mongoose.connection.readyState,
              }
            : undefined,
      });
    }
  }

  /**
   * Get current user with profiles
   * @route GET /api/users/me
   * @param req - Express request object with authenticated user
   * @param res - Express response object
   */
  static async GetCurrentUser(req: Request, res: Response) {
    try {
      // The user is attached to the request by the authenticateToken middleware
      const user = req.user as any;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // Get the user's profiles
      const profiles = await Profile.find({ 'profileInformation.creator': user._id });
      const userFromDb = await User.findById(user._id).lean();
      if (!userFromDb) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      // Get profiles with basic information
      const profilesWithBalance = await Promise.all(
        profiles.map(async (profile: any) => {
          try {
            // Get profile information
            const profileInfo = profile.profileInformation || {};
            const profileMyPts = profile.ProfileMypts || { currentBalance: 0, lifetimeMypts: 0 };

            // Default value information
            const valueInfo = {
              valuePerPts: 0.024, // Default base value
              currency: 'USD',
              symbol: '$',
              totalValue: profileMyPts.currentBalance * 0.024,
              formattedValue: `$${(profileMyPts.currentBalance * 0.024).toFixed(2)}`
            };

            return {
              _id: profile._id,
              name: profileInfo.title || 'Untitled Profile',
              type: {
                category: profile.profileCategory || "unknown",
                subtype: profile.profileType || "unknown",
              },
              description: "", // No direct equivalent in new model
              accessToken: "", // No direct equivalent in new model
              // Include balance information
              balance: {
                balance: profileMyPts.currentBalance || 0,
                lifetimeEarned: profileMyPts.lifetimeMypts || 0,
                lifetimeSpent: 0, // Not available in new model
                lastTransaction: null, // Not available in new model
                value: valueInfo
              }
            };
          } catch (error) {
            console.error(`Error getting profile info for profile ${profile._id}:`, error);
            // Return profile with minimal information if there's an error
            return {
              _id: profile._id,
              name: profile.profileInformation?.title || 'Untitled Profile',
              type: {
                category: profile.profileCategory || "unknown",
                subtype: profile.profileType || "unknown",
              },
              description: "",
              accessToken: ""
            };
          }
        })
      );

      // Return user data with profiles including balance
      res.status(200).json({
        success: true,
        user: {
          ...userFromDb,
          profiles: profilesWithBalance,
        },
      });
    } catch (error: any) {
      console.error("Error in GetCurrentUser:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch current user",
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

      res
        .status(200)
        .json({ success: true, message: "User deleted successfully" });
    } catch (error: any) {
      console.error(error.message);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to delete user",
      });
    }
  }

  /**
   * Generate a user name
   * @route GET /users/generate-username
   * @param req - Express request object
   * @param res - Express response object
   */
  static async GenerateUsername(req: Request, res: Response) {
    console.log("Generating username...");
    try {
      const firstname = req.query.firstname as string;

      if (!firstname) {
        return res.status(400).json({
          success: false,
          message: "Firstname (full name) is required",
        });
      }

      const MAX_USERNAME_LENGTH = 20;
      const MAX_FIRSTNAME_LENGTH = 12; // Limit the length of the firstname to avoid long processing

      const sanitize = (str: string): string =>
        str
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_");

      const truncate = (str: string, length: number): string =>
        str.length > length ? str.slice(0, length) : str;

      const shortenedFirstname = truncate(firstname, MAX_FIRSTNAME_LENGTH);
      const parts = sanitize(shortenedFirstname).split("_").filter(Boolean);

      const baseCandidates = new Set<string>();

      // Generate initial name permutations with both separators
      if (parts.length >= 2) {
        const first = parts[0];
        const last = parts[parts.length - 1];

        baseCandidates.add(truncate(`${first}_${last}`, MAX_USERNAME_LENGTH));
        baseCandidates.add(truncate(`${last}_${first}`, MAX_USERNAME_LENGTH));
      }

      baseCandidates.add(truncate(parts.join("_"), MAX_USERNAME_LENGTH));
      baseCandidates.add(
        truncate(parts.slice().reverse().join("_"), MAX_USERNAME_LENGTH)
      );

      const baseUsernames = Array.from(baseCandidates);
      const availableUsernames: string[] = [];

      // Keep generating until 3 unique usernames are found
      for (const base of baseUsernames) {
        let candidate = base;
        let suffix = 1;

        // This inner loop guarantees availability
        while (availableUsernames.length < 3) {
          const existing = await User.findOne({ username: candidate });

          if (!existing && !availableUsernames.includes(candidate)) {
            availableUsernames.push(candidate);
          } else {
            candidate = truncate(
              `${base}${suffix.toString().padStart(2, "0")}`,
              MAX_USERNAME_LENGTH
            );
            suffix++;
          }
        }
        if (availableUsernames.length >= 3) break;
      }

      // In case all baseUsernames are exhausted and we still need more
      while (availableUsernames.length < 3) {
        const fallbackBase = sanitize(parts.join("_")) || "user";

        let suffix = 0;

        let candidate = truncate(
          `${fallbackBase}${suffix.toString().padStart(2, "0")}`,
          MAX_USERNAME_LENGTH
        );

        // Keep generating until a unique one is found
        while (true) {
          const existing = await User.findOne({ username: candidate });

          if (!existing && !availableUsernames.includes(candidate)) {
            availableUsernames.push(candidate);
            break;
          }

          suffix++;
          candidate = truncate(`${fallbackBase}${suffix}`, MAX_USERNAME_LENGTH);
        }
      }

      return res.status(200).json({
        success: true,
        usernames: availableUsernames,
      });
    } catch (error: unknown) {
      console.error((error as Error).message);
      return res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to generate username",
      });
    }
  }
}
