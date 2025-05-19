import { Schema } from 'mongoose';

const SubGroupSchema = new Schema({
  name: { type: String, required: true },
  description: String,
  members: [{
    profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
    role: { 
      type: String, 
      enum: ['admin', 'moderator', 'member'],
      default: 'member'
    },
    joinedAt: { type: Date, default: Date.now }
  }],
  settings: {
    isPrivate: { type: Boolean, default: false },
    allowMemberInvites: { type: Boolean, default: true },
    messageRetention: { type: Number, default: 30 }, // days
    fileSharing: { type: Boolean, default: true }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const GroupProfileSchema = new Schema({
  type: {
    category: { type: String, default: 'Group' },
    subtype: { type: String, default: 'Group' }
  },
  details: {
    title: String,
    username: String,
    holder: String,
    relationship: String,
    demographics: {
      age: Number,
      gender: String
    }
  },
  categories: {
    about: {
      enabled: { type: Boolean, default: true },
      groupInfo: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }  // Group description and purpose
      },
      rules: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Group rules and guidelines
      },
      announcements: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Group announcements
      }
    },
    groups: {
      enabled: { type: Boolean, default: true },
      mainGroup: {
        enabled: { type: Boolean, default: true },
        name: { type: String, required: true },
        description: String,
        members: [{
          profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
          role: { 
            type: String, 
            enum: ['owner', 'admin', 'moderator', 'member'],
            default: 'member'
          },
          joinedAt: { type: Date, default: Date.now }
        }],
        settings: {
          isPrivate: { type: Boolean, default: false },
          allowMemberInvites: { type: Boolean, default: true },
          allowSubgroupCreation: { type: Boolean, default: true },
          messageRetention: { type: Number, default: 30 }, // days
          fileSharing: { type: Boolean, default: true },
          maxSubgroups: { type: Number, default: 10 }
        }
      },
      subgroups: [SubGroupSchema]
    },
    contact: {
      enabled: { type: Boolean, default: true },
      contactInfo: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }  // Group contact information
      },
      modeOfContact: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Preferred contact methods
      },
      messagingApps: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Communication channels
      },
      contactApps: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Group platforms
      }
    },
    social: {
      enabled: { type: Boolean, default: true },
      socialMedia: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Group social media profiles
      },
      websites: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Group websites and platforms
      },
      events: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Group events and activities
      },
      resources: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Group resources and files
      }
    }
  }
}, { _id: false, discriminatorKey: 'subtype' });

export default GroupProfileSchema; 