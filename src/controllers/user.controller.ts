import { Request, Response } from "express";
import { User } from "../models/User";
import mongoose from "mongoose";
import { ProfileModel as Profile } from "../models/profile.model";

export class UserControllers {
  /**
   * Get all users
   * @route GET /auth/users
   */
  /**
   * Get all users with pagination and search
   * @route GET /auth/users
   * @param req - Express request object (supports ?page, ?limit, ?search)
   * @param res - Express response object
   */
  static async GetAllUsers(req: Request, res: Response) {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.max(
        1,
        Math.min(100, parseInt(req.query.limit as string) || 10)
      );
      const search = (req.query.search as string)?.trim();

      const query: any = {};
      if (search && search.length > 0 && search !== "undefined") {
        const regex = new RegExp(search, "i");
        query.$or = [
          { email: { $regex: regex } },
          { fullName: { $regex: regex } },
          { username: { $regex: regex } },
          { phoneNumber: { $regex: regex } },
        ];
      }

      const users = await User.find(
        query,
        "_id email fullName username profileImage phoneNumber formattedPhoneNumber countryOfResidence isEmailVerified isPhoneVerified accountType role"
      )
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const total = await User.countDocuments(query);

      const sortedUsers = users
        .sort((a, b) => {
          const nameA = a.fullName?.toLowerCase() || "";
          const nameB = b.fullName?.toLowerCase() || "";
          if (nameA < nameB) return -1;
          if (nameA > nameB) return 1;
          // If names are equal, sort by email
          const emailA = a.email?.toLowerCase() || "";
          const emailB = b.email?.toLowerCase() || "";
          if (emailA < emailB) return -1;
          if (emailA > emailB) return 1;
          return 0; // Names and emails are equal
        })
        .map(({ _id, ...u }) => ({
          ...u,
          id: _id,
        }));

      const userWithProfiles = await Promise.all(
        sortedUsers.map(async (user) => {
          try {
            // Get the user's profiles
            const profiles = await Profile.find({
              "profileInformation.creator": user.id,
            });

            // Get profile information
            const profileInfo = profiles.map((profile) => ({
              _id: profile._id,
              name: profile.profileInformation.title || "Untitled Profile",
              currentBalance: profile.ProfileMypts?.currentBalance || 0,
              lifetimeMypts: profile.ProfileMypts?.lifetimeMypts || 0,
            }));

            return {
              ...user,
              profiles: profileInfo,
            };
          } catch (error) {
            console.error("Error fetching profiles for user:", user.id, error);
            return {
              ...user,
              profiles: [],
            };
          }
        })
      );

      // console.log(
      //   `Fetched ${userWithProfiles.length} users on page ${page} with limit ${limit}`
      // );

      res.status(200).json({
        success: true,
        users: userWithProfiles,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
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
   * Get user by ID (public route)
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

      // Try to convert string ID to ObjectId for better error handling
      let objectId;
      try {
        objectId = new mongoose.Types.ObjectId(id);
      } catch (error) {
        console.log("Error converting to ObjectId:", id, error);
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format",
        });
      }

      // Get database name
      const dbName = mongoose.connection.name;
      console.log("Connected to database:", dbName);

      // Try to find user
      console.log("Searching for user with ID:", objectId);
      const user = await User.findById(objectId).exec();
      console.log("User query result:", user ? "User found" : "User not found");

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

      // Return the user data
      console.log("Returning user data for ID:", user._id);

      res.status(200).json({
        success: true,
        user: {
          _id: user._id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          profileImage: user.profileImage || null,
          phoneNumber: user.phoneNumber || "",
          countryOfResidence: user.countryOfResidence || "",
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
                stack: error.stack,
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
      const profiles = await Profile.find({
        "profileInformation.creator": user._id,
      });
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
            const profileMyPts = profile.ProfileMypts || {
              currentBalance: 0,
              lifetimeMypts: 0,
            };

            // Default value information
            const valueInfo = {
              valuePerPts: 0.024, // Default base value
              currency: "USD",
              symbol: "$",
              totalValue: profileMyPts.currentBalance * 0.024,
              formattedValue: `$${(profileMyPts.currentBalance * 0.024).toFixed(2)}`,
            };

            return {
              _id: profile._id,
              name: profileInfo.title || "Untitled Profile",
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
                value: valueInfo,
              },
            };
          } catch (error) {
            console.error(
              `Error getting profile info for profile ${profile._id}:`,
              error
            );
            // Return profile with minimal information if there's an error
            return {
              _id: profile._id,
              name: profile.profileInformation?.title || "Untitled Profile",
              type: {
                category: profile.profileCategory || "unknown",
                subtype: profile.profileType || "unknown",
              },
              description: "",
              accessToken: "",
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
   * Update user information
   * @route PUT /api/users/update
   * @param req - Express request object with authenticated user
   * @param res - Express response object
   */
  static async UpdateUserInfo(req: Request, res: Response) {
    try {
      // Get the authenticated user from the request
      const authenticatedUser = req.user as any;

      if (!authenticatedUser || !authenticatedUser._id) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // Get the user data from the request body
      const {
        fullName,

        email,
        phoneNumber,
        countryOfResidence,
        dateOfBirth,
        isTwoFactorEnabled,
        notifications,
      } = req.body;

      // Find the user in the database
      const user = await User.findById(authenticatedUser._id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Update the user fields if they are provided
      if (fullName !== undefined) user.fullName = fullName;
      if (email !== undefined) user.email = email;
      if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
      if (countryOfResidence !== undefined)
        user.countryOfResidence = countryOfResidence;
      if (dateOfBirth !== undefined) user.dateOfBirth = new Date(dateOfBirth);
      if (isTwoFactorEnabled !== undefined)
        user.isTwoFactorEnabled = isTwoFactorEnabled;

      // Update notification preferences if provided
      if (notifications) {
        // Create a basic notification preferences object based on the provided data
        const updatedNotifications = {
          email:
            notifications.email?.enabled !== undefined
              ? notifications.email.enabled
              : user.notifications?.email || true,
          push:
            notifications.push?.enabled !== undefined
              ? notifications.push.enabled
              : user.notifications?.push || true,
          sms:
            notifications.sms?.enabled !== undefined
              ? notifications.sms.enabled
              : user.notifications?.sms || false,
          marketing:
            notifications.email?.marketing !== undefined
              ? notifications.email.marketing
              : user.notifications?.marketing || false,
        };

        // Update the user's notification preferences
        user.notifications = updatedNotifications;

        // If telegram notifications are provided, update them
        if (notifications.telegram) {
          if (!user.telegramNotifications) {
            user.telegramNotifications = {
              enabled: false,
              username: "",
              preferences: {
                transactions: true,
                transactionUpdates: true,
                purchaseConfirmations: true,
                saleConfirmations: true,
                security: true,
                connectionRequests: false,
                messages: false,
              },
            };
          }

          // Update telegram notification settings
          if (notifications.telegram.enabled !== undefined) {
            user.telegramNotifications.enabled = notifications.telegram.enabled;
          }

          if (notifications.telegram.username) {
            user.telegramNotifications.username =
              notifications.telegram.username;
          }

          // Update telegram preferences if provided
          const prefs = user.telegramNotifications.preferences;

          if (notifications.telegram.transactions !== undefined) {
            prefs.transactions = notifications.telegram.transactions;
          }

          if (notifications.telegram.transactionUpdates !== undefined) {
            prefs.transactionUpdates =
              notifications.telegram.transactionUpdates;
          }

          if (notifications.telegram.purchaseConfirmations !== undefined) {
            prefs.purchaseConfirmations =
              notifications.telegram.purchaseConfirmations;
          }

          if (notifications.telegram.saleConfirmations !== undefined) {
            prefs.saleConfirmations = notifications.telegram.saleConfirmations;
          }

          if (notifications.telegram.security !== undefined) {
            prefs.security = notifications.telegram.security;
          }

          if (notifications.telegram.connectionRequests !== undefined) {
            prefs.connectionRequests =
              notifications.telegram.connectionRequests;
          }

          if (notifications.telegram.messages !== undefined) {
            prefs.messages = notifications.telegram.messages;
          }
        }
      }

      // Save the updated user
      await user.save();

      // Update country information in all profiles if country was changed
      if (countryOfResidence !== undefined) {
        try {
          const {
            updateUserProfileCountries,
          } = require("../scripts/update-user-profile-country");
          const updateResult = await updateUserProfileCountries(
            authenticatedUser._id,
            false
          );
          console.log(`Profile country update result: ${updateResult.message}`);
        } catch (error) {
          console.error("Error updating profile countries:", error);
          // Just log the error, don't fail the main operation
        }
      }

      // Return the updated user
      res.status(200).json({
        success: true,
        message: "User information updated successfully",
        user: {
          _id: user._id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          profileImage: user.profileImage || null,
          phoneNumber: user.phoneNumber,
          countryOfResidence: user.countryOfResidence,
          dateOfBirth: user.dateOfBirth,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
          accountType: user.accountType,
          role: user.role,
          isTwoFactorEnabled: user.isTwoFactorEnabled,
          notifications: user.notifications,
        },
      });
    } catch (error: any) {
      console.error("Error in UpdateUserInfo:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to update user information",
      });
    }
  }

  /**
   * Update user profile image
   * @route PUT /api/users/update-profile-image
   * @param req - Express request object with authenticated user
   * @param res - Express response object
   */
  static async UpdateProfileImage(req: Request, res: Response) {
    try {
      // Get the authenticated user from the request
      const authenticatedUser = req.user as any;

      if (!authenticatedUser || !authenticatedUser._id) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // Get the profile image URL from the request body
      const { profileImage } = req.body;

      if (!profileImage) {
        return res.status(400).json({
          success: false,
          message: "Profile image URL is required",
        });
      }

      // Find the user in the database
      const user = await User.findById(authenticatedUser._id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Update the profile image
      user.profileImage = profileImage;

      // Save the updated user
      await user.save();

      // Return the updated user
      res.status(200).json({
        success: true,
        message: "Profile image updated successfully",
        user: {
          _id: user._id,
          profileImage: user.profileImage,
        },
      });
    } catch (error: any) {
      console.error("Error in UpdateProfileImage:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to update profile image",
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

  /**
   * Admin: Update any user by ID
   * @route PUT /auth/users/:id
   * @param req - Express request object (must be admin)
   * @param res - Express response object
   */
  static async AdminUpdateUserById(req: Request, res: Response) {
    try {
      console.log("Admin update user request:", {
        userId: req.params.id,
        body: req.body,
        user: req.user
          ? `User ID: ${(req.user as any)?._id}`
          : "No user in request",
      });

      // Require admin - temporarily disable for testing
      const requester = req.user as any;
      if (
        req.user &&
        requester &&
        requester.role !== "admin" &&
        requester.role !== "superadmin"
      ) {
        return res
          .status(403)
          .json({ success: false, message: "Admin access required" });
      }

      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid user ID" });
      }

      const {
        fullName,
        email,
        phoneNumber,
        countryOfResidence,
        dateOfBirth,
        isTwoFactorEnabled,
        notifications,
      } = req.body;

      const user = await User.findById(id);
      if (!user) {
        console.log(`User not found with ID: ${id}`);
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      console.log("Found user to update:", {
        userId: user._id,
        email: user.email,
        fullName: user.fullName,
      });

      if (fullName !== undefined) user.fullName = fullName;
      if (email !== undefined) user.email = email;
      if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
      if (countryOfResidence !== undefined)
        user.countryOfResidence = countryOfResidence;
      if (dateOfBirth !== undefined) user.dateOfBirth = new Date(dateOfBirth);
      if (isTwoFactorEnabled !== undefined)
        user.isTwoFactorEnabled = isTwoFactorEnabled;
      if (notifications) user.notifications = notifications;
      // Save the updated user
      console.log("Saving updated user...");
      await user.save();
      console.log("User updated successfully");

      // Update country information in all profiles associated with this user
      // Import and use the profile country update function only if countryOfResidence was updated
      if (countryOfResidence !== undefined) {
        try {
          const {
            updateUserProfileCountries,
          } = require("../scripts/update-user-profile-country");
          const updateResult = await updateUserProfileCountries(id, false); // false means don't establish a new DB connection
          console.log(`Profile country update result: ${updateResult.message}`);
        } catch (error) {
          console.error("Error updating profile countries:", error);
          // Don't throw error, just log it - we don't want to fail the main operation
        }
      }

      // Return the updated user data
      res.status(200).json({
        success: true,
        message: "User updated successfully",
        user: {
          _id: user._id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          profileImage: user.profileImage || null,
          phoneNumber: user.phoneNumber,
          countryOfResidence: user.countryOfResidence,
          dateOfBirth: user.dateOfBirth,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
          accountType: user.accountType,
          role: user.role,
          isTwoFactorEnabled: user.isTwoFactorEnabled,
          notifications: user.notifications,
        },
      });
    } catch (error: any) {
      console.error("Error in AdminUpdateUserById:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to update user",
        debug:
          process.env.NODE_ENV === "development"
            ? {
                errorType: error.constructor.name,
                errorMessage: error.message,
                userId: req.params.id,
              }
            : undefined,
      });
    }
  }
}
