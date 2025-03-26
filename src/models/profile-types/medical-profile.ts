import { Schema } from 'mongoose';

const MedicalProfileSchema = new Schema({
  type: {
    category: { type: String, default: 'Individual' },
    subtype: { type: String, default: 'Medical' }
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
        content: { type: Schema.Types.Mixed }  // Health goals and objectives
      },
      quotes: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Medical quotes and notes
      },
      biography: {
        enabled: { type: Boolean, default: true },
        content: String    // Medical history summary
      },
      needsAndWishlist: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Medical needs and requirements
      },
      conditions: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Medical conditions
      }
    },
    contact: {
      enabled: { type: Boolean, default: true },
      contactInfo: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }  // Medical contact information
      },
      modeOfContact: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Preferred medical contact methods
      },
      messagingApps: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Healthcare communication apps
      },
      contactApps: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Healthcare platforms
      },
      emergency: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }  // Emergency medical contacts
      }
    },
    social: {
      enabled: { type: Boolean, default: true },
      socialMedia: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Health-related social profiles
      },
      websites: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Medical portals and websites
      },
      celebrations: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Health milestones
      },
      paymentsAndPartners: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Healthcare providers and insurance
      },
      healthInsurance: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }  // Health insurance details
      }
    },
    medical: {
      enabled: { type: Boolean, default: true },
      medications: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Current medications
      },
      allergies: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Allergies and reactions
      },
      immunizations: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Vaccination records
      },
      providers: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Healthcare providers
      },
      history: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]  // Medical history
      }
    }
  }
}, { _id: false, discriminatorKey: 'subtype' });

export default MedicalProfileSchema;
