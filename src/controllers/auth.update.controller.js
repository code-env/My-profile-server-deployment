const { User } = require('../models/User');
const { logger } = require('../utils/logger');

/**
 * Controller for handling user profile updates
 */
class AuthUpdateController {
  /**
   * Update user profile information
   * @route POST /auth/update-profile
   */
  static async updateProfile(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const { dateOfBirth, countryOfResidence } = req.body;
      
      // Validate that at least one field is provided
      if (!dateOfBirth && !countryOfResidence) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      // Find the user by ID
      const userToUpdate = await User.findById(user._id);
      
      if (!userToUpdate) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Update fields if provided
      if (dateOfBirth) {
        userToUpdate.dateOfBirth = new Date(dateOfBirth);
      }
      
      if (countryOfResidence) {
        userToUpdate.countryOfResidence = countryOfResidence;
      }

      // Save the updated user
      await userToUpdate.save();

      logger.info(`User ${user._id} updated profile information`);

      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: userToUpdate._id,
          email: userToUpdate.email,
          fullName: userToUpdate.fullName,
          username: userToUpdate.username,
          dateOfBirth: userToUpdate.dateOfBirth,
          countryOfResidence: userToUpdate.countryOfResidence,
          profileImage: userToUpdate.profileImage
        }
      });
    } catch (error) {
      logger.error('Error updating profile:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update profile'
      });
    }
  }
}

module.exports = { AuthUpdateController };
