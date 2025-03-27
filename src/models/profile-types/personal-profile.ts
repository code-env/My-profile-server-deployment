import { Schema } from 'mongoose';

const PersonalProfileSchema = new Schema({
  type: {
    category: { type: String, default: 'Individual' },
    subtype: { type: String, default: 'Personal' }
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
        content: { type: Schema.Types.Mixed }
      },
      quotes: {
        enabled: { type: Boolean, default: true },
           content: [Object]
      },
      biography: {
        enabled: { type: Boolean, default: true },
        content: String
      },
      needsAndWishlist: {
        enabled: { type: Boolean, default: true },
           content: [Object]
      },
      hobbies: {
        enabled: { type: Boolean, default: true },
           content: [Object]
      }
    },
    contact: {
      enabled: { type: Boolean, default: true },
      contactInfo: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }
      },
      modeOfContact: {
        enabled: { type: Boolean, default: true },
           content: [Object]
      },
      messagingApps: {
        enabled: { type: Boolean, default: true },
        content: [Object]
      },
      contactApps: {
        enabled: { type: Boolean, default: true },
           content: [Object]
      },
      emergency: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }
      }
    },
    social: {
      enabled: { type: Boolean, default: true },
      socialMedia: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]
      },
      websites: {
        enabled: { type: Boolean, default: true },
           content: [Object]
      },
      celebrations: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]
      },
      paymentsAndPartners: {
        enabled: { type: Boolean, default: true },
        content: [Schema.Types.Mixed]
      },
      lifeInsurance: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }
      }
    }
  }
}, { _id: false, discriminatorKey: 'subtype' });

export default PersonalProfileSchema;
