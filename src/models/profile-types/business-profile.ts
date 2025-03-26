import { Schema } from 'mongoose';

const BusinessProfileSchema = new Schema({
  type: {
    category: { type: String, default: 'Individual' },
    subtype: { type: String, default: 'Business' }
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
        content: { type: Schema.Types.Mixed }  // Business goals and mission
      },
      quotes: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Business testimonials
      },
      biography: {
        enabled: { type: Boolean, default: true },
        content: String    // Company history
      },
      needsAndWishlist: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Business needs and expansion plans
      },
      businessServices: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Services offered
      }
    },
    contact: {
      enabled: { type: Boolean, default: true },
      contactInfo: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }  // Business contact details
      },
      modeOfContact: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Preferred business contact methods
      },
      messagingApps: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Business communication channels
      },
      contactApps: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Business apps and platforms
      },
      emergency: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }  // Emergency business contacts
      }
    },
    social: {
      enabled: { type: Boolean, default: true },
      socialMedia: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Business social media profiles
      },
      websites: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Business websites and platforms
      },
      celebrations: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Business milestones and events
      },
      paymentsAndPartners: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Business partners and payment info
      },
      businessInsurance: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }  // Business insurance details
      }
    },
    business: {
      enabled: { type: Boolean, default: true },
      registration: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }  // Business registration details
      },
      licenses: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Business licenses and permits
      },
      team: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Team members and roles
      },
      locations: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Business locations
      }
    }
  }
}, { _id: false, discriminatorKey: 'subtype' });

export default BusinessProfileSchema;
