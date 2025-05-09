const mongoose = require('mongoose');
const { config } = require('../config/config');
const { ProfileTemplate } = require('../models/profiles/profile-template');
const { logger } = require('../utils/logger');

/**
 * Creates a default personal profile template if it doesn't exist
 */
async function createDefaultProfileTemplate() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if a personal profile template already exists
    const existingTemplate = await ProfileTemplate.findOne({
      profileType: 'personal',
      profileCategory: 'individual'
    });

    if (existingTemplate) {
      console.log('Default personal profile template already exists:', existingTemplate._id);
      return existingTemplate;
    }

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
            },
            {
              name: 'gender',
              label: 'Gender',
              widget: 'select',
              order: 4,
              enabled: true,
              required: false,
              options: [
                { label: 'Male', value: 'male' },
                { label: 'Female', value: 'female' },
                { label: 'Non-binary', value: 'non-binary' },
                { label: 'Prefer not to say', value: 'not-specified' }
              ]
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
            },
            {
              name: 'address',
              label: 'Address',
              widget: 'textarea',
              order: 3,
              enabled: true,
              required: false,
              placeholder: 'Enter your address'
            }
          ]
        },
        {
          name: 'social',
          label: 'Social Media',
          icon: 'share',
          collapsible: true,
          fields: [
            {
              name: 'linkedin',
              label: 'LinkedIn',
              widget: 'url',
              order: 1,
              enabled: true,
              required: false,
              placeholder: 'Your LinkedIn profile URL'
            },
            {
              name: 'twitter',
              label: 'Twitter',
              widget: 'url',
              order: 2,
              enabled: true,
              required: false,
              placeholder: 'Your Twitter profile URL'
            },
            {
              name: 'facebook',
              label: 'Facebook',
              widget: 'url',
              order: 3,
              enabled: true,
              required: false,
              placeholder: 'Your Facebook profile URL'
            },
            {
              name: 'instagram',
              label: 'Instagram',
              widget: 'url',
              order: 4,
              enabled: true,
              required: false,
              placeholder: 'Your Instagram profile URL'
            }
          ]
        }
      ]
    });

    console.log('Created default personal profile template:', template._id);
    return template;
  } catch (error) {
    console.error('Error creating default personal profile template:', error);
    throw error;
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
createDefaultProfileTemplate()
  .then((template) => {
    console.log('Script completed successfully');
    console.log('Template ID:', template._id);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
