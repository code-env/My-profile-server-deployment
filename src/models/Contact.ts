import mongoose, { Document, Schema, Model } from 'mongoose';
import { IUser } from './User';
import { IRelationshipType } from './RelationshipType';
import { IProfile } from '../interfaces/profile.interface';

// Interface extending Document
export interface Contact extends Document {
  owner: mongoose.Types.ObjectId | IProfile;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  displayName?: string;
  phoneNumber: string;
  phoneType?: PhoneType;
  email?: string;
  isRegistered: boolean;
  relationshipType?: mongoose.Types.ObjectId | IRelationshipType
  profile?: mongoose.Types.ObjectId;
  lastSynced: Date;
  profileType: ProfileType;
  source: ContactSource;
  customFields?: Record<string, any>;
  labels?: string[];
  notes?: string;
  isFavorite: boolean;
  connectionStrength?: number;
  lastContacted?: Date;
  contact?: any;
  gender?: Gender;
  preferredProduct?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  photo?: string;
  indicatorType?: string;
  additionalIndicators?: string[];
}

export enum ProfileType {
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

export enum Gender {
  Male = 'Male',
  Female = 'Female',
  Other = 'Other',
  PreferNotToSay = 'Prefer not to say'
}

export enum PhoneType {
  Mobile = 'Mobile',
  Home = 'Home',
  Work = 'Work',
  Other = 'Other'
}

export enum ContactRelationship {
  Self = 'Self',
  Family = 'Family',
  Mates = 'Mates',
  Friends = 'Friends',
}

const contactSchema = new Schema<Contact>(
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
    middleName: {
      type: String,
      trim: true
    },
    lastName: {
      type: String,
      trim: true
    },
    suffix: {
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
    phoneType: {
      type: String,
      enum: Object.values(PhoneType)
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

    lastSynced: {
      type: Date,
      default: Date.now
    },
    profileType: {
      type: String,
      enum: Object.values(ProfileType),
      default: ProfileType.Personal
    },

    relationshipType: {
      type: Schema.Types.ObjectId,
      ref: 'RelationshipType',
      index: true
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
      type: Schema.Types.Mixed
    },
    gender: {
      type: String,
      enum: Object.values(Gender)
    },
    preferredProduct: {
      type: String,
      trim: true
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      country: { type: String, trim: true }
    },
    photo: {
      type: String // URL or path to the photo
    },
    indicatorType: {
      type: String,
      trim: true
    },
    additionalIndicators: [{
      type: String,
      trim: true
    }]
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        if (ret.customFields && Object.keys(ret.customFields).length === 0) {
          delete ret.customFields;
        }
      }
    }
  }
);

// Virtual for full name
contactSchema.virtual('fullName').get(function () {
  let name = this.firstName;
  if (this.middleName) name += ` ${this.middleName}`;
  if (this.lastName) name += ` ${this.lastName}`;
  if (this.suffix) name += ` ${this.suffix}`;
  return name.trim();
});

// Indexes for better query performance
contactSchema.index({ owner: 1, phoneNumber: 1 }, { unique: true });
contactSchema.index({ owner: 1, isRegistered: 1 });
contactSchema.index({ owner: 1, category: 1 });
contactSchema.index({ owner: 1, isFavorite: 1 });
contactSchema.index({ phoneNumber: 'text', firstName: 'text', lastName: 'text', displayName: 'text' });

// Pre-save hook to set displayName if not provided
contactSchema.pre('save', function (next) {
  if (!this.displayName) {
    this.displayName = this.get('fullName');
  }
  next();
});

// Static method to find or create a contact
contactSchema.statics.findOrCreate = async function (ownerId, phoneNumber, data = {}) {
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
contactSchema.methods.updateRegistrationStatus = async function () {
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
export interface ContactModel extends Model<Contact> {
  findOrCreate(ownerId: mongoose.Types.ObjectId, phoneNumber: string, data?: Partial<Contact>): Promise<Contact>;
}

export const Contact = mongoose.model<Contact, ContactModel>('Contact', contactSchema);