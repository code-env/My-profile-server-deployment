import mongoose, { Document, Schema, Model } from 'mongoose';
import { IUser } from './User';

// Interface extending Document
export interface IContact extends Document {
  owner: mongoose.Types.ObjectId | IUser;
  firstName: string;
  lastName: string;
  displayName?: string;
  phoneNumber: string;
  email?: string;
  isRegistered: boolean;
  profile?: mongoose.Types.ObjectId;
  lastSynced: Date;
  category: ContactCategory;
  source: ContactSource;
  customFields?: Record<string, any>;
  labels?: string[];
  notes?: string;
  isFavorite: boolean;
  connectionStrength?: number; // 1-5 scale for how strong the connection is
  lastContacted?: Date;
  contact?: any; // WhatsApp contact data if needed
}

export enum ContactCategory {
  Personal = 'Personal',
  Professional = 'Professional',
  Family = 'Family',
  Friends = 'Friends',
  Business = 'Business',
  Other = 'Other',
  Uncategorized = 'Uncategorized'
}

export enum ContactSource {
  Manual = 'Manual',
  Imported = 'Imported',
  Synced = 'Synced',
  WhatsApp = 'WhatsApp',
  System = 'System'
}

const contactSchema = new Schema<IContact>(
  {
    owner: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true 
    },
    firstName: { 
      type: String, 
      required: true,
      trim: true 
    },
    lastName: { 
      type: String, 
      trim: true 
    },
    displayName: { 
      type: String, 
      trim: true 
    },
    phoneNumber: { 
      type: String, 
      required: true,
      index: true 
    },
    email: { 
      type: String, 
      lowercase: true,
      trim: true,
      sparse: true 
    },
    isRegistered: { 
      type: Boolean, 
      default: false,
      index: true 
    },
    profile: { 
      type: Schema.Types.ObjectId, 
      ref: 'Profile',
      sparse: true 
    },
    lastSynced: { 
      type: Date, 
      default: Date.now 
    },
    category: { 
      type: String, 
      enum: Object.values(ContactCategory),
      default: ContactCategory.Other 
    },
    source: { 
      type: String, 
      enum: Object.values(ContactSource),
      default: ContactSource.Manual 
    },
    customFields: { 
      type: Schema.Types.Mixed,
      default: {} 
    },
    labels: [{ 
      type: String,
      trim: true 
    }],
    notes: { 
      type: String,
      trim: true 
    },
    isFavorite: { 
      type: Boolean, 
      default: false,
      index: true 
    },
    connectionStrength: { 
      type: Number,
      min: 1,
      max: 5 
    },
    lastContacted: { 
      type: Date 
    },
    contact: { 
      type: Schema.Types.Mixed // For WhatsApp contact data
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function(doc, ret) {
        delete ret.__v; // Remove version key
        if (ret.customFields && Object.keys(ret.customFields).length === 0) {
          delete ret.customFields;
        }
      }
    }
  }
);

// Virtual for full name
contactSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Indexes for better query performance
contactSchema.index({ owner: 1, phoneNumber: 1 }, { unique: true });
contactSchema.index({ owner: 1, isRegistered: 1 });
contactSchema.index({ owner: 1, category: 1 });
contactSchema.index({ owner: 1, isFavorite: 1 });
contactSchema.index({ phoneNumber: 'text', firstName: 'text', lastName: 'text', displayName: 'text' });

// Pre-save hook to set displayName if not provided
contactSchema.pre('save', function(next) {
  if (!this.displayName) {
    this.displayName = `${this.firstName} ${this.lastName}`.trim();
  }
  next();
});

// Static method to find or create a contact
contactSchema.statics.findOrCreate = async function(ownerId, phoneNumber, data = {}) {
  const existingContact = await this.findOne({ owner: ownerId, phoneNumber });
  if (existingContact) {
    return existingContact;
  }
  return this.create({ 
    owner: ownerId, 
    phoneNumber,
    ...data,
    source: ContactSource.Synced
  });
};

// Method to check if contact is registered and update accordingly
contactSchema.methods.updateRegistrationStatus = async function() {
  const User = mongoose.model('User');
  const Profile = mongoose.model('Profile');
  
  // Check by phone number
  const user = await User.findOne({ phoneNumber: this.phoneNumber });
  if (user) {
    this.isRegistered = true;
    this.profile = user.profiles[0]; // Or find appropriate profile
  } else if (this.email) {
    // Check by email if phone number didn't match
    const userByEmail = await User.findOne({ email: this.email });
    if (userByEmail) {
      this.isRegistered = true;
      this.profile = userByEmail.profiles[0];
    }
  } else {
    this.isRegistered = false;
    this.profile = undefined;
  }
  
  this.lastSynced = new Date();
  return this.save();
};

// Interface for Contact model
export interface IContactModel extends Model<IContact> {
  findOrCreate(ownerId: mongoose.Types.ObjectId, phoneNumber: string, data?: Partial<IContact>): Promise<IContact>;
}

export const Contact = mongoose.model<IContact, IContactModel>('Contact', contactSchema);