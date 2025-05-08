import mongoose, { Schema, Document, Model } from 'mongoose';

export type ProfileDocument = IProfile & Document;


export type ProfileCategory = 'individual' | 'accessory' | 'group';
export type ProfileType =
  | 'personal' | 'academic' | 'work' | 'professional' | 'proprietor' | 'freelancer' | 'artist' | 'influencer' | 'athlete' | 'provider' | 'merchant' | 'vendor'
  | 'emergency' | 'medical' | 'pet' | 'ecommerce' | 'home' | 'transportation' | 'driver' | 'event' | 'dependent' | 'rider' | 'dummy'
  | 'group' | 'team' | 'family' | 'neighborhood' | 'company' | 'business' | 'association' | 'organization' | 'institution' | 'community';
 
interface IProfile {
  profileCategory: ProfileCategory;
  profileType: ProfileType;
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
        'personal', 'academic', 'work', 'professional', 'proprietor', 'freelancer', 'artist', 'influencer', 'athlete', 'provider', 'merchant', 'vendor',
        'emergency', 'medical', 'pet', 'ecommerce', 'home', 'transportation', 'driver', 'event', 'dependent', 'rider',
        'group', 'team', 'family', 'neighborhood', 'company', 'business', 'association', 'organization', 'institution', 'community'
      ],
      index: true
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
      followers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      following: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      connectedProfiles: [{ type: Schema.Types.ObjectId, ref: 'Profile' }],
      affiliatedProfiles: [{ type: Schema.Types.ObjectId, ref: 'Profile' }],
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    },
    templatedId: { type: Schema.Types.ObjectId, ref: 'ProfileTemplate', required: true },
    sections: [{ type: Schema.Types.Mixed }],

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
  },
  { timestamps: true }
);

export const Profile: Model<IProfile> = mongoose.model<IProfile>('Profile', ProfileSchema);