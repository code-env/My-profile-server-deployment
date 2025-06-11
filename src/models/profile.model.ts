import mongoose, { Schema, Document, Model } from 'mongoose';
import { MyPtsModel } from './my-pts.model';
import { MyPtsValueModel } from './my-pts-value.model';
import { IMyPts } from '../interfaces/my-pts.interface';
import { IProfileMethods } from '../interfaces/profile.interface';

export type ProfileDocument = IProfile & Document & {
  _id: mongoose.Types.ObjectId;
};

export type ProfileCategory = 'individual' | 'accessory' | 'group';
export type ProfileType =
  | 'personal' | 'academic' | 'work' | 'professional' | 'proprietor' | 'freelancer' | 'artist' | 'influencer' | 'athlete' | 'provider' | 'merchant' | 'vendor'
  | 'emergency' | 'medical' | 'pet' | 'ecommerce' | 'home' | 'transportation' | 'driver' | 'event' | 'dependent' | 'rider' | 'dummy'
  | 'group' | 'team' | 'family' | 'neighborhood' | 'company' | 'business' | 'association' | 'organization' | 'institution' | 'community';

interface IProfile {
  profileCategory: ProfileCategory;
  profileType: ProfileType;
  secondaryId?: string; // Secondary ID for easy user reference
  ProfileFormat: {
    profileImage?: string;
    coverImage?: string;
    profileLogo?: string;
    customization?: {
      theme?: {
        primaryColor?: string;
        secondaryColor?: string;
        accent?: string;
        background?: string;
        text?: string;
        font?: string;
      };
      layout?: {
        sections?: Array<{ id: string; type: string; order: number; visible: boolean }>;
        gridStyle?: 'right-sided' | 'centered' | 'left-sided';
        animation?: 'fade' | 'slide' | 'zoom';
      };
    };
    customCSS?: string;
    updatedAt: Date;
  };

  profileInformation: {
    username: string;
    profileLink: string;
    title?: string;
    accountHolder?: string;
    pid?: string;
    relationshipToAccountHolder?: string;
    creator: mongoose.Types.ObjectId;
    connectLink: string;
    followLink: string;
    followers: mongoose.Types.ObjectId[];
    following: mongoose.Types.ObjectId[];
    connectedProfiles: mongoose.Types.ObjectId[];
    affiliatedProfiles: mongoose.Types.ObjectId[];
    accessToken?: string; // Added for profile token authentication
    createdAt: Date;
    updatedAt: Date;
  };

  ProfileQrCode: {
    qrCode?: string;
    emailSignature?: string;
    wallPaper?: string;
    VirtualBackground?: string;
  };

  profileLocation?: {
    city?: string;
    stateOrProvince?: string;
    country?: string;
    countryCode?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };

  ProfileProducts?: {
    type: 'Accessory' | 'Device' | 'None';
    name?: string;
    description?: string;
  };

  verificationStatus?: {
    isVerified: boolean;
    badge: 'blue_tick' | 'gold_tick' | 'none';
    verifiedAt?: Date;
  };

  ProfileMypts?: {
    currentBalance: number;
    lifetimeMypts: number;
  };

  ProfileReferal?: {
    referalLink?: string;
    referals: number;
  };

  ProfileBadges?: {

    badges?: Array<{
      id: string;
      name: string;
      category: string;
      description: string;
      icon: string;
      earnedAt: Date;
    }>;
  };

  analytics?: {
    Mypts?: {
      balance: number;
      usage: number;
      redeemed: number;
      invested: number;
    };
    Usage?: {
      stamps: number;
      reward: number;
      badges: number;
      milestones: number;
    };
    Profiling?: {
      completion: number;
      category: number;
      links: number;
      content: number;
    };
    Products?: {
      accessories: number;
      devices: number;
      taps: number;
      scans: number;
    };
    Networking?: {
      shared: number;
      views: number;
      contacts: number;
      relationships: number;
    };
    Circles?: {
      contacts: number;
      connections: number;
      following: number;
      followers: number;
      affiliations: number;
    };
    engagement?: {
      chats: number;
      calls: number;
      posts: number;
      comments: number;
    };
    plans?: {
      interactions: number;
      task: number;
      events: number;
      schedules: number;
    };
    data?: {
      entries: number;
      dataPts: number;
      tracking: number;
    };
    discover?: {
      searches: number;
      Reviews: number;
      survey: number;
      videos: number;
    };
  };

  templatedId: mongoose.Types.ObjectId;
  sections: ITemplateSection[];
  members?: mongoose.Types.ObjectId[];
  groups?: mongoose.Types.ObjectId[];

  availability?: {
    isAvailable: boolean;
    defaultDuration: number; // in minutes
    bufferTime: number; // in minutes
    endDate?: Date; // Add end date field
    workingHours: {
      [key: string]: { // key is day of week (0-6)
        start: string; // format: "HH:mm"
        end: string; // format: "HH:mm"
        isWorking: boolean;
      };
    };
    exceptions: Array<{
      date: Date;
      isAvailable: boolean;
      slots?: Array<{
        start: string; // format: "HH:mm"
        end: string; // format: "HH:mm"
      }>;
    }>;
    bookingWindow: {
      minNotice: number; // minimum notice in minutes
      maxAdvance: number; // maximum advance booking in days
    };
    breakTime: Array<{
      start: string; // format: "HH:mm"
      end: string; // format: "HH:mm"
      days: string[];
    }>;
  };

  specificSettings: {
    [key: string]: any;
  };
}

interface ITemplateSection {
  key: string;
  label: string;
  order: number;
  icon?: string;
  collapsible?: boolean;
  fields: ITemplateField[];
}

interface ITemplateField {
  key: string;
  label: string;
  widget: FieldWidget;
  required?: boolean;
  default?: any;
  enabled: boolean;
  placeholder?: string;
  options?: IFieldOption[];
  validation?: IFieldValidation;
  value?: any;
}

interface IFieldOption {
  label: string;
  value: string | number;
}

interface IFieldValidation {
  min?: number;
  max?: number;
  regex?: string;
}

type FieldWidget =
  | 'text' | 'textarea' | 'number' | 'select' | 'multiselect'
  | 'email' | 'url' | 'phone' | 'date' | 'datetime'
  | 'boolean' | 'file' | 'image' | 'object' | 'list:text';

// Define the Profile Schema
const ProfileSchema = new Schema<IProfile>(
  {
    profileCategory: {
      type: String,
      required: true,
      enum: ['accessory', 'group', 'individual'],
      index: true,
    },
    profileType: {
      type: String,
      required: true,
      enum: [
        // individual
        'personal', 'academic', 'work', 'professional', 'proprietor', 'freelancer', 'artist', 'influencer', 'athlete', 'provider', 'merchant', 'vendor',
        // accessory
        'emergency', 'medical', 'pet', 'ecommerce', 'home', 'transportation', 'driver', 'event', 'dependent', 'rider',
        // group
        'group', 'team', 'family', 'neighborhood', 'company', 'business', 'association', 'organization', 'institution', 'community'
      ],
      index: true
    },
    secondaryId: {
      type: String,
      unique: true,
      sparse: true, // Allow null values (for existing profiles until updated)
      index: true,
      validate: {
        validator: function(v: string) {
          // Must start with a letter and be 8 characters long with only alphanumeric characters
          return /^[a-zA-Z][a-zA-Z0-9]{7}$/.test(v);
        },
        message: props => `${props.value} is not a valid secondary ID. It must start with a letter and be 8 characters long.`
      }
    },
    profileInformation: {
      username: { type: String, required: true, trim: true, index: true },
      profileLink: { type: String, required: true, unique: true, index: true },
      title: { type: String, trim: true },
      accountHolder: { type: String, trim: true },
      pid: { type: String, trim: true },
      relationshipToAccountHolder: { type: String, trim: true },
      creator: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
      connectLink: { type: String, required: true, unique: true, index: true },
      followLink: { type: String, required: true, unique: true, index: true },
      followers: [{ type: Schema.Types.ObjectId, ref: 'Profile' }],
      following: [{ type: Schema.Types.ObjectId, ref: 'Profile' }],
      connectedProfiles: [{ type: Schema.Types.ObjectId, ref: 'Profile' }],
      affiliatedProfiles: [{ type: Schema.Types.ObjectId, ref: 'Profile' }],
      accessToken: { type: String, trim: true, index: true }, // Added for profile token authentication
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    },
    templatedId: { type: Schema.Types.ObjectId, ref: 'ProfileTemplate', required: true },
    sections: [{ type: Schema.Types.Mixed }],
    members: [{ type: Schema.Types.ObjectId, ref: 'Profile' }],
    groups: [{ type: Schema.Types.ObjectId, ref: 'Profile' }],

    ProfileFormat: {
      profileImage: { type: String, trim: true },
      coverImage: { type: String, trim: true },
      profileLogo: { type: String, trim: true },
      customization: {
        theme: {
          primaryColor: { type: String, default: '#000000' },
          secondaryColor: { type: String, default: '#ffffff' },
          accent: { type: String, default: '#ff4081' },
          background: { type: String, default: '#f5f5f5' },
          text: { type: String, default: '#212121' },
          font: { type: String, default: 'Roboto' }
        },
        layout: {
          sections: [{ id: String, type: String, order: Number, visible: { type: Boolean, default: true } }],
          gridStyle: { type: String, enum: ['right-sided', 'centered', 'left-sided'], default: 'centered' },
          animation: { type: String, enum: ['fade', 'slide', 'zoom'], default: 'fade' }
        }
      },
      customCSS: { type: String, trim: true },
      updatedAt: { type: Date, default: Date.now }
    },
    ProfileQrCode: {
      qrCode: String,
      emailSignature: String,
      wallPaper: String,
      VirtualBackground: String
    },
    profileLocation: {
      city: String,
      stateOrProvince: String,
      country: String,
      countryCode: String,
      coordinates: {
        latitude: { type: Number, default: 0 },
        longitude: { type: Number, default: 0 }
      }
    },
    ProfileProducts: {
      type: { type: String, enum: ['Accessory', 'Device', 'None'], default: 'None' },
      name: String,
      description: String
    },
    verificationStatus: {
      isVerified: { type: Boolean, default: false },
      badge: {
        type: String,
        enum: ['blue_tick', 'gold_tick', 'none'],
        default: 'none',
      },
      verifiedAt: Date,
    },
    ProfileMypts: {
      currentBalance: { type: Number, default: 0 },
      lifetimeMypts: { type: Number, default: 0 },
    },
    ProfileReferal: {
      referalLink: String,
      referals: { type: Number, default: 0 },
    },
    ProfileBadges: {
      badges: [{
        id: String,
        name: String,
        category: String,
        description: String,
        icon: String,
        earnedAt: Date,
      }],
    },
    analytics: {
      Mypts: {
        balance: { type: Number, default: 0 },
        usage: { type: Number, default: 0 },
        redeemed: { type: Number, default: 0 },
        invested: { type: Number, default: 0 }
      },
      Usage: {
        stamps: { type: Number, default: 0 },
        reward: { type: Number, default: 0 },
        badges: { type: Number, default: 0 },
        milestones: { type: Number, default: 0 }
      },
      Profiling: {
        completion: { type: Number, default: 0 },
        category: { type: Number, default: 0 },
        links: { type: Number, default: 0 },
        content: { type: Number, default: 0 }
      },
      Products: {
        accessories: { type: Number, default: 0 },
        devices: { type: Number, default: 0 },
        taps: { type: Number, default: 0 },
        scans: { type: Number, default: 0 }
      },
      Networking: {
        shared: { type: Number, default: 0 },
        views: { type: Number, default: 0 },
        contacts: { type: Number, default: 0 },
        relationships: { type: Number, default: 0 }
      },
      Circles: {
        contacts: { type: Number, default: 0 },
        connections: { type: Number, default: 0 },
        following: { type: Number, default: 0 },
        followers: { type: Number, default: 0 },
        affiliations: { type: Number, default: 0 }
      },
      engagement: {
        chats: { type: Number, default: 0 },
        calls: { type: Number, default: 0 },
        posts: { type: Number, default: 0 },
        comments: { type: Number, default: 0 }
      },
      plans: {
        interactions: { type: Number, default: 0 },
        task: { type: Number, default: 0 },
        events: { type: Number, default: 0 },
        schedules: { type: Number, default: 0 },
      },
      data: {
        entries: { type: Number, default: 0 },
        dataPts: { type: Number, default: 0 },
        tracking: { type: Number, default: 0 }
      },
      discover: {
        searches: { type: Number, default: 0 },
        Reviews: { type: Number, default: 0 },
        survey: { type: Number, default: 0 },
        videos: { type: Number, default: 0 },
      }
    },
    availability: {
      isAvailable: { type: Boolean, default: false },
      defaultDuration: { type: Number, default: 60 }, // 60 minutes default
      bufferTime: { type: Number, default: 15 }, // 15 minutes default
      endDate: { type: Date }, // Optional end date
      workingHours: {
        type: Map,
        of: {
          start: { type: String, required: true },
          end: { type: String, required: true },
          isWorking: { type: Boolean, default: true }
        },
        default: {}
      },
      exceptions: [{
        date: { type: Date, required: true },
        isAvailable: { type: Boolean, default: true },
        slots: [{
          start: { type: String, required: true },
          end: { type: String, required: true }
        }]
      }],
      bookingWindow: {
        minNotice: { type: Number, default: 60 }, // 1 hour default
        maxAdvance: { type: Number, default: 30 } // 30 days default
      },
      breakTime: [{
        start: { type: String, required: true },
        end: { type: String, required: true },
        days: [{ type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] }]
      }]
    },

    specificSettings: {
      type: Map,
      of: {
        type: Schema.Types.Mixed,
        default: {}
      }
    }
  },
  { timestamps: true }
);

// Add profile methods for MyPts
ProfileSchema.methods.getMyPts = async function(): Promise<IMyPts> {
  // Find or create MyPts for this profile
  const myPts = await MyPtsModel.findOrCreate(this._id);
  return myPts;
};

ProfileSchema.methods.getMyPtsValue = async function(currency: string = 'USD'): Promise<{
  balance: number;
  valuePerPts: number;
  currency: string;
  symbol: string;
  totalValue: number;
  formattedValue: string;
}> {
  try {
    // Get MyPts balance
    const myPts = await this.getMyPts();

    // Get current MyPts value
    const currentValue = await MyPtsValueModel.getCurrentValue();

    // Get value in specified currency
    const valuePerPts = currentValue.getValueInCurrency(currency);

    // Calculate total value
    const totalValue = myPts.balance * valuePerPts;

    // Get currency symbol
    let symbol = currentValue.baseSymbol;
    if (currency !== currentValue.baseCurrency) {
      const exchangeRate = currentValue.exchangeRates.find(er => er.currency === currency);
      if (exchangeRate) {
        symbol = exchangeRate.symbol;
      }
    }

    // Format the value
    const formattedValue = `${symbol}${totalValue.toFixed(2)}`;

    return {
      balance: myPts.balance,
      valuePerPts,
      currency,
      symbol,
      totalValue,
      formattedValue
    };
  } catch (error) {
    console.error('Error getting MyPts value:', error);

    // Fallback to default values if there's an error
    return {
      balance: this.ProfileMypts?.currentBalance || 0,
      valuePerPts: 0.024, // Default base value
      currency: currency,
      symbol: currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency,
      totalValue: (this.ProfileMypts?.currentBalance || 0) * 0.024,
      formattedValue: `${currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency}${((this.ProfileMypts?.currentBalance || 0) * 0.024).toFixed(2)}`
    };
  }
};

// Add post-save middleware to create a referral code
ProfileSchema.post('save', async function(doc) {
  try {
    // Import here to avoid circular dependency
    const { ProfileReferralService } = require('../services/profile-referral.service');
    await ProfileReferralService.initializeReferralCode(doc._id);
    console.log(`Referral code initialized for profile: ${doc._id}`);
  } catch (error) {
    console.error(`Error initializing referral code for profile ${doc._id}:`, error);
    // Don't throw the error to avoid disrupting the save operation
  }
});

// Add method to check availability for a specific time slot
ProfileSchema.methods.checkAvailability = async function(startTime: Date, endTime: Date): Promise<boolean> {
  if (!this.availability?.isAvailable) return false;

  const dayOfWeek = startTime.getDay();
  const workingHours = this.availability.workingHours[dayOfWeek];

  // Check if it's a working day
  if (!workingHours?.isWorking) return false;

  // Check if time is within working hours
  const startHour = parseInt(workingHours.start.split(':')[0]);
  const startMinute = parseInt(workingHours.start.split(':')[1]);
  const endHour = parseInt(workingHours.end.split(':')[0]);
  const endMinute = parseInt(workingHours.end.split(':')[1]);

  const slotStartHour = startTime.getHours();
  const slotStartMinute = startTime.getMinutes();
  const slotEndHour = endTime.getHours();
  const slotEndMinute = endTime.getMinutes();

  if (slotStartHour < startHour || (slotStartHour === startHour && slotStartMinute < startMinute)) return false;
  if (slotEndHour > endHour || (slotEndHour === endHour && slotEndMinute > endMinute)) return false;

  // Check for exceptions
  const dateStr = startTime.toISOString().split('T')[0];
  const exception = this.availability.exceptions?.find((e: { date: Date; isAvailable: boolean; slots?: Array<{ start: string; end: string }> }) =>
    e.date.toISOString().split('T')[0] === dateStr
  );

  if (exception) {
    if (!exception.isAvailable) return false;
    if (exception.slots) {
      return exception.slots.some((slot: { start: string; end: string }) => {
        const slotStart = new Date(`${dateStr}T${slot.start}`);
        const slotEnd = new Date(`${dateStr}T${slot.end}`);
        return startTime >= slotStart && endTime <= slotEnd;
      });
    }
  }

  // Check for break times
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[dayOfWeek];
  const isInBreakTime = this.availability.breakTime?.some((breakTime: { start: string; end: string; days: string[] }) => {
    if (!breakTime.days.includes(dayName)) return false;
    const breakStart = new Date(`${dateStr}T${breakTime.start}`);
    const breakEnd = new Date(`${dateStr}T${breakTime.end}`);
    return (startTime >= breakStart && startTime < breakEnd) ||
           (endTime > breakStart && endTime <= breakEnd);
  });

  if (isInBreakTime) return false;

  return true;
};

// Add method to get available slots for a specific date
ProfileSchema.methods.getAvailableSlots = async function(date: Date): Promise<Array<{start: Date, end: Date}>> {
  if (!this.availability?.isAvailable) return [];

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = dayNames[date.getDay()];
  const workingHours = this.availability.workingHours[dayOfWeek];

  if (!workingHours?.isWorking) return [];

  const dateStr = date.toISOString().split('T')[0];
  const slots: Array<{start: Date, end: Date}> = [];

  // Check for exceptions
  const exception = this.availability.exceptions?.find((e: { date: Date; isAvailable: boolean; slots?: Array<{ start: string; end: string }> }) =>
    e.date.toISOString().split('T')[0] === dateStr
  );

  if (exception) {
    if (!exception.isAvailable) return [];
    if (exception.slots) {
      return exception.slots.map((slot: { start: string; end: string }) => ({
        start: new Date(`${dateStr}T${slot.start}`),
        end: new Date(`${dateStr}T${slot.end}`)
      }));
    }
  }

  // Generate slots based on working hours and default duration
  const startTime = new Date(`${dateStr}T${workingHours.start}`);
  const endTime = new Date(`${dateStr}T${workingHours.end}`);
  const duration = this.availability.defaultDuration;
  const buffer = this.availability.bufferTime;

  let currentTime = new Date(startTime);
  while (currentTime < endTime) {
    const slotEnd = new Date(currentTime.getTime() + duration * 60000);
    if (slotEnd <= endTime) {
      // Check if slot overlaps with break time
      const isInBreakTime = this.availability.breakTime?.some((breakTime: { start: string; end: string; days: string[] }) => {
        if (!breakTime.days.includes(dayOfWeek)) return false;
        const breakStart = new Date(`${dateStr}T${breakTime.start}`);
        const breakEnd = new Date(`${dateStr}T${breakTime.end}`);
        return (currentTime >= breakStart && currentTime < breakEnd) ||
               (slotEnd > breakStart && slotEnd <= breakEnd);
      });

      if (!isInBreakTime) {
        slots.push({
          start: new Date(currentTime),
          end: new Date(slotEnd)
        });
      }
    }
    currentTime = new Date(currentTime.getTime() + (duration + buffer) * 60000);
  }

  return slots;
};

// Add the addSettings method
ProfileSchema.methods.addSettings = async function(settings: Record<string, any>): Promise<void> {
  this.settings = { ...this.settings || {}, ...settings };
  await this.save();
};

// Define interface for model type with methods
interface IProfileModel extends Model<IProfile> {
  // Add any static methods here if needed
}

export const ProfileModel: Model<IProfile> = mongoose.model<IProfile, IProfileModel>('Profile', ProfileSchema);
