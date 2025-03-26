import { Schema } from 'mongoose';

const AcademicProfileSchema = new Schema({
  type: {
    category: { type: String, default: 'Individual' },
    subtype: { type: String, default: 'Academic' }
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
      interestAndGoals: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }  // Academic goals and research interests
      },
      quotes: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Academic quotes and philosophy
      },
      biography: {
        enabled: { type: Boolean, default: true },
        content: String    // Academic biography
      },
      needsAndWishlist: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Academic resources needed
      },
      specializations: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Academic specializations
      }
    },
    contact: {
      enabled: { type: Boolean, default: true },
      contactInfo: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }  // Academic contact information
      },
      modeOfContact: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Preferred academic contact methods
      },
      messagingApps: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Academic communication platforms
      },
      contactApps: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Academic networking platforms
      },
      emergency: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }  // Emergency academic contacts
      }
    },
    social: {
      enabled: { type: Boolean, default: true },
      socialMedia: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Academic social media profiles
      },
      websites: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Academic websites and portfolios
      },
      celebrations: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Academic achievements and awards
      },
      paymentsAndPartners: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Research funding and collaborators
      },
      academicInsurance: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }  // Academic insurance information
      }
    },
    academic: {
      enabled: { type: Boolean, default: true },
      education: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Educational background
      },
      research: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Research projects and publications
      },
      teaching: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Teaching experience and courses
      },
      certifications: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Academic certifications
      },
      conferences: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Conference presentations and attendance
      }
    }
  }
}, { _id: false, discriminatorKey: 'subtype' });

export default AcademicProfileSchema;
