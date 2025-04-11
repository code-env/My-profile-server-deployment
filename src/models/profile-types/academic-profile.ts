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
      institutionAndGoals: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }  // Academic goals and research interests
      },
      academicInterest: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }  // Academic goals and research interests
      },
      inspirationalQuotes: {
        enabled: { type: Boolean, default: true },
        content: [String]
      },
      degreeAndCertification: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed } 
      },
      researchAndPublications: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }  // Academic goals and research interests
      },
      needsAndResources: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }  // Academic goals and research interests
      },
      educationAndLearning: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }  // Academic goals and research interests
      },
      Skills: {
        enabled: { type: Boolean, default: true },
        content: [String]  // Academic goals and research interests
      },
      volunteering: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }  // Academic goals and research interests
      },
      gallery: {
        enabled: { type: Boolean, default: true },
        content: [String]
      },
      biography: {
        enabled: { type: Boolean, default: true },
        content: String    // Academic biography
      },
    },
    contact: {
      enabled: { type: Boolean, default: true },
      contactInfo: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }  // Academic contact information
      },
      academicAdvisor: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed }
      },
      institutionsAndCo: {
        enabled: { type: Boolean, default: true },
        content: { type: Schema.Types.Mixed } 
      },
      allumniNetwork: {
        enabled: { type: Boolean, default: true },
        content: [String] 
      },
      academic:{
        enabled:{type:Boolean, default:true},
        content:[String]
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
        content: { type: Schema.Types.Mixed } 
      },
  
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
