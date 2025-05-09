import mongoose from 'mongoose';
import { ProfileTemplate } from '../models/profiles/profile-template';
import { logger } from '../utils/logger';

/**
 * Initializes default profile templates if they don't exist
 */
export async function initializeProfileTemplates(): Promise<void> {
  try {
    logger.info('Checking for default profile templates...');

    // Check if personal profile template exists
    const personalTemplate = await ProfileTemplate.findOne({
      profileType: 'personal',
      profileCategory: 'individual'
    });

    if (!personalTemplate) {
      logger.info('Creating default personal profile template...');
      
      // Create a default admin ID (this is required by the schema)
      const adminId = new mongoose.Types.ObjectId();

      // Create the default personal profile template
      const template = await ProfileTemplate.create({
        profileCategory: 'individual',
        profileType: 'personal',
        name: 'Personal Profile',
        slug: 'personal-profile',
        createdBy: adminId,
        categories: [
          {
            name: 'basic',
            label: 'Basic Information',
            icon: 'user',
            collapsible: true,
            fields: [
              {
                name: 'fullName',
                label: 'Full Name',
                widget: 'text',
                order: 1,
                enabled: true,
                required: true,
                placeholder: 'Enter your full name'
              },
              {
                name: 'bio',
                label: 'Bio',
                widget: 'textarea',
                order: 2,
                enabled: true,
                required: false,
                placeholder: 'Tell us about yourself'
              },
              {
                name: 'dateOfBirth',
                label: 'Date of Birth',
                widget: 'date',
                order: 3,
                enabled: true,
                required: false
              }
            ]
          },
          {
            name: 'contact',
            label: 'Contact Information',
            icon: 'phone',
            collapsible: true,
            fields: [
              {
                name: 'email',
                label: 'Email',
                widget: 'email',
                order: 1,
                enabled: true,
                required: false,
                placeholder: 'Enter your email'
              },
              {
                name: 'phone',
                label: 'Phone',
                widget: 'phone',
                order: 2,
                enabled: true,
                required: false,
                placeholder: 'Enter your phone number'
              }
            ]
          }
        ]
      });

      logger.info(`Created default personal profile template: ${template._id}`);
    } else {
      logger.info(`Default personal profile template already exists: ${personalTemplate._id}`);
    }

    logger.info('Profile templates initialization completed');
  } catch (error) {
    logger.error('Failed to initialize profile templates', { error });
    throw error;
  }
}
