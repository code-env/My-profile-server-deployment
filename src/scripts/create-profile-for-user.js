const mongoose = require('mongoose');
const { config } = require('../config/config');
const { ProfileModel } = require('../models/profile.model');
const { ProfileTemplate } = require('../models/profiles/profile-template');
const { User } = require('../models/User');
const { generateUniqueConnectLink, generateReferralCode } = require('../utils/crypto');

/**
 * Creates a profile for a specific user
 * @param userId The user ID to create a profile for
 */
async function createProfileForUser(userId) {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // Check if user already has profiles
    const existingProfiles = await ProfileModel.find({
      'profileInformation.creator': userId
    });

    if (existingProfiles.length > 0) {
      console.log(`User ${userId} already has ${existingProfiles.length} profiles`);

      // Update user's profiles array if needed
      const profileIds = existingProfiles.map(p => p._id);
      if (!user.profiles || user.profiles.length === 0) {
        user.profiles = profileIds;
        await user.save();
        console.log(`Updated user's profiles array with existing profiles`);
      }

      return existingProfiles[0];
    }

    // Get the default personal profile template
    let template = await ProfileTemplate.findOne({
      profileType: 'personal',
      profileCategory: 'individual'
    });

    // If template doesn't exist, create it
    if (!template) {
      console.log('Default personal profile template not found, creating one...');

      // Create a default admin ID (this is required by the schema)
      const adminId = new mongoose.Types.ObjectId();

      // Create the default personal profile template
      template = await ProfileTemplate.create({
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

      console.log(`Created default personal profile template: ${template._id}`);
    }

    // Generate unique links
    const [connectLink, profileLink] = await Promise.all([
      generateUniqueConnectLink(),
      generateUniqueConnectLink()
    ]);

    // Generate a unique referral link
    const referralCode = generateReferralCode();
    const referralLink = `mypts-ref-${referralCode}`;

    // Create initial profile sections with all fields disabled by default
    const initialSections = template.categories.map(category => ({
      key: category.name,
      label: category.label,
      fields: category.fields.map(field => ({
        key: field.name,
        value: field.default || null,
        enabled: false // Fields are disabled by default
      }))
    }));

    // Create the profile
    const profile = new ProfileModel({
      profileCategory: template.profileCategory,
      profileType: template.profileType,
      templatedId: template._id,
      profileInformation: {
        username: user.fullName, // Use fullName instead of username
        title: `${user.fullName}'s Profile`,
        profileLink: profileLink,
        creator: new mongoose.Types.ObjectId(userId),
        connectLink,
        followLink: profileLink,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      ProfileReferal: {
        referalLink: referralLink,
        referals: 0
      },
      sections: initialSections
    });

    await profile.save();
    console.log(`Created profile for user ${userId}: ${profile._id}`);

    // Update user with profile ID
    user.profiles = [profile._id];
    await user.save();
    console.log(`Updated user's profiles array with new profile`);

    return profile;
  } catch (error) {
    console.error('Error creating profile for user:', error);
    throw error;
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Get user ID from command line argument
const userId = process.argv[2];

if (!userId) {
  console.error('Please provide a user ID as a command line argument');
  process.exit(1);
}

// Run the script
createProfileForUser(userId)
  .then((profile) => {
    console.log('Script completed successfully');
    console.log('Profile ID:', profile._id);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
