import mongoose, { Schema, Document } from 'mongoose';

export interface NotificationChannelSettings {
    push: boolean;
    text: boolean;
    inApp: boolean;
    email: boolean;
}

export interface VisibilitySetting {
  level: 'Public' | 'ConnectionsOnly' | 'OnlyMe' | 'Custom';
  customUsers?: string[];
}

export interface AuthorizationSetting {
  level: 'Public' | 'ConnectionsOnly' | 'NoOne' | 'Custom';
  customUsers?: string[];
}

export interface DiscoverySettings {
  bySearch: boolean;
  byQRCode: boolean;
  byNearby: boolean;
  bySuggestions: boolean;
  byNFC: boolean;
  byContactSync: boolean;
  discoveryByTags: boolean;
  discoveryBySkills: boolean;
  discoveryByProfileType: boolean;
  contactSyncDiscovery: boolean;
  trendingListings: boolean;
}

export interface DataSettings {
  downloadMyData: boolean;
  deleteMyData: boolean;
  clearActivityLogs: boolean;
  dataSharingPreferences: boolean;
  autoDataBackup: boolean;
  activityLogsEnabled: boolean;
  thirdPartyIntegrations: string[];
  consentHistoryEnabled: boolean;
}

export interface BlockingSettings {
  blockedProfiles: string[];
  blockNewConnectionRequests: boolean;
  blockKeywords: string[];
  restrictInteractions: boolean;
  reportAndBlockEnabled: boolean;
}

export interface PaymentMethod {
  name: string;
  enabled: boolean;
  isDefault: boolean;
}

export interface PaySettings {
  paymentMethods: PaymentMethod[];
  payoutMethods: PaymentMethod[];
  autoPay: {
    autoRenewalEnabled: boolean;
    reminderDays: number;
  };
  subscriptions: {
    activeSubscriptions: string[];
    subscriptionReminderDays: number;
  };
  myPts: {
    earningEnabled: boolean;
    spendingRules: string[];
  };
}

export interface SettingsDocument extends Document {
  userId: string;
  general: {
    regional: {
      language: string;
      currency: string;
      numberFormat: 'dot' | 'comma';
      dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
      country: string;
      areaCode: string;
    };
    appSystem: {
      version: string;
      build: string;
      permissions: {
        camera: boolean;
        microphone: boolean;
        storage: boolean;
        notifications: boolean;
      };
      storageCacheEnabled: boolean;
      allowNotifications: boolean;
      backgroundActivity: boolean;
      allowMobileData: boolean;
      optimizeBatteryUsage: boolean;
      batteryUsage: boolean;
    };
    time: {
      dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
      timeZone: string;
      timeFormat: string;
      calendarType: 'Gregorian' | 'Islamic' | 'Custom';
      holidays: string[];
      showWeekNumbers: boolean;
      weekStartDay: 'Sunday' | 'Monday';
      bufferTimeMinutes: number;
      slotDurationMinutes: number;
      dailyBriefingNotification: boolean;
      dailyReminder: boolean;
      maxBookingsPerDay: number;
      isAvailable: boolean;
    };
    behaviorAndAlerts: {
      soundsEnabled: boolean;
      customTones?: string;
      vibrationPattern: 'none' | 'light' | 'default' | 'intense';
      hapticFeedback: boolean;
      appResponseSound: boolean;
    };
    measurements: {
      distanceUnit: 'Kilometers' | 'Miles';
      measurementSystem: 'Imperial' | 'Metric';
      parameterUnits: 'Imperial' | 'Metric';
    };
    appSections: {
      enabledModules: string[];
      layoutOrder: string[];
    };
    scanner: {
      playSound: boolean;
      autoCapture: boolean;
      enableQRScan: boolean;
      autoScan: boolean;
      enableNFCScan: boolean;
      scanActions: {
        openProfile: boolean;
        saveContact: boolean;
        autoShare: boolean;
      };
      autoAdjustBorders: boolean;
      allowManualAdjustAfterScan: boolean;
      useSystemCamera: boolean;
      importFromGallery: boolean;
      saveScansToPhotos: boolean;
      doubleFocus: boolean;
      showGridOverlay: boolean;
    };
  };
  specificSettings: {
    [key: string]: any;
  };

  notifications: {
    channels: NotificationChannelSettings;
    general: {
      allNotifications: boolean;
      frequency: 'immediate' | 'daily' | 'weekly';
      sound: boolean;
      vibration: boolean;
    };
    Account: {
      storageLevel: NotificationChannelSettings;
      transfer: NotificationChannelSettings;
      deactivateClose: NotificationChannelSettings;
    };
    Profile: {
      createDelete: NotificationChannelSettings;
      verification: NotificationChannelSettings;
      updates: NotificationChannelSettings;
      views: NotificationChannelSettings;
      invitations: NotificationChannelSettings;
      recomendations: NotificationChannelSettings;
      rewards: NotificationChannelSettings;
    };
    networking: {
      connections: NotificationChannelSettings;
      affiliations: NotificationChannelSettings;
      following: NotificationChannelSettings;
      invitation: NotificationChannelSettings;
      mutualRecommendation: NotificationChannelSettings;
      roleChanges: NotificationChannelSettings;
      circleUpdates: NotificationChannelSettings;
    };
    communication: {
      chat: NotificationChannelSettings;
      call: NotificationChannelSettings;
      post: NotificationChannelSettings;
      reactions: NotificationChannelSettings;
      inbox: NotificationChannelSettings;
      comments: NotificationChannelSettings;  
      share: NotificationChannelSettings;
    };
    calendar: {
      assignmentParticipation: NotificationChannelSettings;
      outcome: NotificationChannelSettings;
      booking: NotificationChannelSettings;
      holidays: NotificationChannelSettings;
      celebration: NotificationChannelSettings;
      reminder: NotificationChannelSettings;
      scheduleShift: NotificationChannelSettings;
    };
    paymentMarketing: {
      payment: NotificationChannelSettings;
      payout: NotificationChannelSettings;
      myPts: NotificationChannelSettings;
      subscription: NotificationChannelSettings;
      refund: NotificationChannelSettings;
      promotions: NotificationChannelSettings;
      newProduct: NotificationChannelSettings;
      seasonalSalesEvents: NotificationChannelSettings;
      referralBonus: NotificationChannelSettings;
    };
    securityPrivacy: {
      newDeviceLogin: NotificationChannelSettings;
      suspiciousLogin: NotificationChannelSettings;
      passwordResetRequest: NotificationChannelSettings;
      passwordChangeConfirmation: NotificationChannelSettings;
      twoFactorAuth: NotificationChannelSettings;
      securityPrivacyChange: NotificationChannelSettings;
      blockedUnblockedActivity: NotificationChannelSettings;
      reportSubmissionConfirmation: NotificationChannelSettings;
      privacyBreach: NotificationChannelSettings;
    };
    appUpdates: {
      newFeatureRelease: NotificationChannelSettings;
      appVersionUpdate: NotificationChannelSettings;
      mandatoryUpdate: NotificationChannelSettings;
      betaFeatureAccess: NotificationChannelSettings;
      systemMaintenance: NotificationChannelSettings;
      resolvedBugNotice: NotificationChannelSettings;
    };
  };

  security: {
    general: {
      passcode: boolean;
      appLock: boolean;
      changeEmail: boolean;
      changePhone: boolean;
      changePassword: boolean;
      changePasscode: boolean;
      changeAppLock: boolean;
    };
    authentication: {
      twoFactorAuth: boolean;
      googleAuthenticator: boolean;
      sessions: [];
      rememberDevice: boolean;
      OtpMethods: {
        email: boolean;
        phoneNumber: boolean;
      };
    };
    biometrics: {
      biometricLoginEnabled: boolean;
      requireBiometricForSensitiveActions: boolean;
      faceId: boolean;
      touchId: boolean;
      otp: boolean;
      passkey: boolean;
    };
    accessControls: {
      authorizeDevices: [];
      sessionTimeout: number;
      remoteLogoutFromAll: boolean;
    };
  };

  privacy: {
    Visibility: {
      profile: {
        profile: VisibilitySetting;
        status: VisibilitySetting;
        ptsBalance: VisibilitySetting;
        activity: VisibilitySetting;
        engagement: VisibilitySetting;
        plans: VisibilitySetting;
        data: VisibilitySetting;
        vault: VisibilitySetting;
      };
      circles: {
        contacts: VisibilitySetting;
        connections: VisibilitySetting;
        affiliations: VisibilitySetting;
        following: VisibilitySetting;
      };
      engagement: {
        posts: VisibilitySetting;
        calender: VisibilitySetting;
        schedules: VisibilitySetting;
      };
      list: {
        todo: VisibilitySetting;
        shopping: VisibilitySetting;
        wishList: VisibilitySetting;
      };
      vault: {
        wallet: VisibilitySetting;
        documents: VisibilitySetting;
        media: VisibilitySetting;
      };
    };
    permissions: {
      visit: AuthorizationSetting;
      request: AuthorizationSetting;
      saveContact: AuthorizationSetting;
      share: AuthorizationSetting;
      export: AuthorizationSetting;
      followMe: AuthorizationSetting;
      download: AuthorizationSetting;
      chatWithMe: AuthorizationSetting;
      callMe: AuthorizationSetting;
      TagMe: AuthorizationSetting;
    };
  };

  discovery: DiscoverySettings;
  dataSettings: DataSettings;
  blockingSettings: BlockingSettings;
  pay: PaySettings;
}

const ChannelSettingsSchema = new Schema<NotificationChannelSettings>({
  push: { type: Boolean, default: true },
  text: { type: Boolean, default: true },
  inApp: { type: Boolean, default: true },
  email: { type: Boolean, default: true },
}, { _id: false });

function channelField(overrides: Partial<NotificationChannelSettings> = {}) {
  return {
    type: ChannelSettingsSchema,
    default: () => ({ ...overrides })
  };
}

const TwoFactorSchema = new Schema({
  enabled: { type: Boolean, default: false },
  methods: {
    sms: { type: Boolean, default: false },
    email: { type: Boolean, default: false },
    authenticator: { type: Boolean, default: false },
  }
}, { _id: false });

const LoginMethodsSchema = new Schema({
  emailPassword: { type: Boolean, default: true },
  phoneNumber: { type: Boolean, default: false },
  magicLink: { type: Boolean, default: false },
}, { _id: false });

const AppLockPinSchema = new Schema({
  enabled: { type: Boolean, default: false },
  pinLength: { type: Number, enum: [4, 6], default: 4 },
}, { _id: false });

const VisibilityFieldSchema = new Schema<VisibilitySetting>({
  level: { type: String, enum: ['Public', 'ConnectionsOnly', 'OnlyMe', 'Custom'], default: 'ConnectionsOnly' },
  customUsers: [String],
}, { _id: false });

const AuthorizationFieldSchema = new Schema<AuthorizationSetting>({
  level: { type: String, enum: ['Public', 'ConnectionsOnly', 'NoOne', 'Custom'], default: 'ConnectionsOnly' },
  customUsers: [String],
}, { _id: false });

const SecuritySchema = new Schema({
  general: {
    passcode: { type: Boolean, default: false },
    appLock: { type: Boolean, default: false },
    changeEmail: { type: Boolean, default: true },
    changePhone: { type: Boolean, default: true },
    changePassword: { type: Boolean, default: true },
    changePasscode: { type: Boolean, default: true },
    changeAppLock: { type: Boolean, default: true },
  },
  authentication: {
    twoFactorAuth: { type: Boolean, default: false },
    googleAuthenticator: { type: Boolean, default: false },
    sessions: { type: [], default: [] },
    rememberDevice: { type: Boolean, default: true },
    OtpMethods: {
      email: { type: Boolean, default: true },
      phoneNumber: { type: Boolean, default: true },
    },
  },
  biometrics: {
    biometricLoginEnabled: { type: Boolean, default: false },
    requireBiometricForSensitiveActions: { type: Boolean, default: false },
    faceId: { type: Boolean, default: false },
    touchId: { type: Boolean, default: false },
    otp: { type: Boolean, default: false },
    passkey: { type: Boolean, default: false },
  },
  accessControls: {
    authorizeDevices: { type: [], default: [] },
    sessionTimeout: { type: Number, default: 30 },
    remoteLogoutFromAll: { type: Boolean, default: true },
  },
}, { _id: false });

const PrivacyVisibilitySchema = new Schema({
  profile: {
    profile: { type: VisibilityFieldSchema, default: () => ({}) },
    status: { type: VisibilityFieldSchema, default: () => ({}) },
    ptsBalance: { type: VisibilityFieldSchema, default: () => ({}) },
    activity: { type: VisibilityFieldSchema, default: () => ({}) },
    engagement: { type: VisibilityFieldSchema, default: () => ({}) },
    plans: { type: VisibilityFieldSchema, default: () => ({}) },
    data: { type: VisibilityFieldSchema, default: () => ({}) },
    vault: { type: VisibilityFieldSchema, default: () => ({}) },
  },
  circles: {
    contacts: { type: VisibilityFieldSchema, default: () => ({}) },
    connections: { type: VisibilityFieldSchema, default: () => ({}) },
    affiliations: { type: VisibilityFieldSchema, default: () => ({}) },
    following: { type: VisibilityFieldSchema, default: () => ({}) },
  },
  engagement: {
    posts: { type: VisibilityFieldSchema, default: () => ({}) },
    calender: { type: VisibilityFieldSchema, default: () => ({}) },
    schedules: { type: VisibilityFieldSchema, default: () => ({}) },
  },
  list: {
    todo: { type: VisibilityFieldSchema, default: () => ({}) },
    shopping: { type: VisibilityFieldSchema, default: () => ({}) },
    wishList: { type: VisibilityFieldSchema, default: () => ({}) },
  },
  vault: {
    wallet: { type: VisibilityFieldSchema, default: () => ({}) },
    documents: { type: VisibilityFieldSchema, default: () => ({}) },
    media: { type: VisibilityFieldSchema, default: () => ({}) },
  },
}, { _id: false });

const PrivacyPermissionsSchema = new Schema({
  visit: { type: AuthorizationFieldSchema, default: () => ({}) },
  request: { type: AuthorizationFieldSchema, default: () => ({}) },
  saveContact: { type: AuthorizationFieldSchema, default: () => ({}) },
  share: { type: AuthorizationFieldSchema, default: () => ({}) },
  export: { type: AuthorizationFieldSchema, default: () => ({}) },
  followMe: { type: AuthorizationFieldSchema, default: () => ({}) },
  download: { type: AuthorizationFieldSchema, default: () => ({}) },
  chatWithMe: { type: AuthorizationFieldSchema, default: () => ({}) },
  callMe: { type: AuthorizationFieldSchema, default: () => ({}) },
  TagMe: { type: AuthorizationFieldSchema, default: () => ({}) },
}, { _id: false });

const PrivacySchema = new Schema({
  Visibility: { type: PrivacyVisibilitySchema, default: () => ({}) },
  permissions: { type: PrivacyPermissionsSchema, default: () => ({}) },
}, { _id: false });

const DiscoverySchema = new Schema<DiscoverySettings>({
  bySearch: { type: Boolean, default: true },
  byQRCode: { type: Boolean, default: true },
  byNearby: { type: Boolean, default: false },
  bySuggestions: { type: Boolean, default: true },
  byNFC: { type: Boolean, default: false },
  byContactSync: { type: Boolean, default: true },
  discoveryByTags: { type: Boolean, default: false },
  discoveryBySkills: { type: Boolean, default: false },
  discoveryByProfileType: { type: Boolean, default: false },
  contactSyncDiscovery: { type: Boolean, default: true },
  trendingListings: { type: Boolean, default: true },
}, { _id: false });

const DataSettingsSchema = new Schema<DataSettings>({
  downloadMyData: { type: Boolean, default: false },
  deleteMyData: { type: Boolean, default: false },
  clearActivityLogs: { type: Boolean, default: false },
  dataSharingPreferences: { type: Boolean, default: false },
  autoDataBackup: { type: Boolean, default: true },
  activityLogsEnabled: { type: Boolean, default: true },
  thirdPartyIntegrations: [String],
  consentHistoryEnabled: { type: Boolean, default: true },
}, { _id: false });

const BlockingSettingsSchema = new Schema<BlockingSettings>({
  blockedProfiles: [String],
  blockNewConnectionRequests: { type: Boolean, default: false },
  blockKeywords: [String],
  restrictInteractions: { type: Boolean, default: false },
  reportAndBlockEnabled: { type: Boolean, default: true },
}, { _id: false });

const PaymentMethodSchema = new Schema<PaymentMethod>({
  name: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
}, { _id: false });

const AutoPaySchema = new Schema<PaySettings['autoPay']>({
  autoRenewalEnabled: { type: Boolean, default: false },
  reminderDays: { type: Number, default: 1 },
}, { _id: false });

const SubscriptionsSchema = new Schema<PaySettings['subscriptions']>({
  activeSubscriptions: [String],
  subscriptionReminderDays: { type: Number, default: 1 },
}, { _id: false });

const PaySchema = new Schema<PaySettings>({
  paymentMethods: { type: [PaymentMethodSchema], default: [] },
  payoutMethods: { type: [PaymentMethodSchema], default: [] },
  autoPay: { type: AutoPaySchema, default: () => ({}) },
  subscriptions: { type: SubscriptionsSchema, default: () => ({}) },
  myPts: {
    earningEnabled: { type: Boolean, default: true },
    spendingRules: [String],
  }
}, { _id: false });

const SettingsSchema = new Schema<SettingsDocument>({
  userId: { type: String, required: true, unique: true, ref: 'User' },
  general: {
    regional: {
      language: { type: String, required: true },
      currency: { type: String, required: true },
      numberFormat: { type: String, enum: ['dot', 'comma'], default: 'dot' },
      dateFormat: { type: String, enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'], default: 'MM/DD/YYYY' },
      country: { type: String, required: true },
      areaCode: { type: String, required: true },
    },
    appSystem: {
      version: { type: String, required: true },
      build: { type: String, required: true },
      permissions: {
        camera: { type: Boolean, default: true },
        microphone: { type: Boolean, default: true },
        storage: { type: Boolean, default: true },
        notifications: { type: Boolean, default: true },
      },
      storageCacheEnabled: { type: Boolean, default: true },
      allowNotifications: { type: Boolean, default: true },
      backgroundActivity: { type: Boolean, default: true },
      allowMobileData: { type: Boolean, default: true },
      optimizeBatteryUsage: { type: Boolean, default: true },
      batteryUsage: { type: Boolean, default: true },
    },
    time: {
      dateFormat: { type: String, enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'], default: 'MM/DD/YYYY' },
      timeZone: { type: String, required: true },
      timeFormat: { type: String, required: true },
      calendarType: { type: String, enum: ['Gregorian', 'Islamic', 'Custom'], default: 'Gregorian' },
      holidays: [String],
      showWeekNumbers: { type: Boolean, default: false },
      weekStartDay: { type: String, enum: ['Sunday', 'Monday'], default: 'Monday' },
      bufferTimeMinutes: { type: Number, default: 10 },
      slotDurationMinutes: { type: Number, default: 30 },
      dailyBriefingNotification: { type: Boolean, default: true },
      dailyReminder: { type: Boolean, default: false },
      maxBookingsPerDay: { type: Number, default: 5 },
      isAvailable: { type: Boolean, default: true },
    },
    behaviorAndAlerts: {
      soundsEnabled: { type: Boolean, default: true },
      customTones: { type: String },
      vibrationPattern: { type: String, enum: ['none', 'light', 'default', 'intense'], default: 'default' },
      hapticFeedback: { type: Boolean, default: true },
      appResponseSound: { type: Boolean, default: true },
    },
    measurements: {
      distanceUnit: { type: String, enum: ['Kilometers', 'Miles'], default: 'Kilometers' },
      measurementSystem: { type: String, enum: ['Imperial', 'Metric'], default: 'Metric' },
      parameterUnits: { type: String, enum: ['Imperial', 'Metric'], default: 'Metric' },
    },
    appSections: {
      enabledModules: [String],
      layoutOrder: [String],
    },
    scanner: {
      playSound: { type: Boolean, default: true },
      autoCapture: { type: Boolean, default: false },
      enableQRScan: { type: Boolean, default: true },
      autoScan: { type: Boolean, default: false },
      enableNFCScan: { type: Boolean, default: false },
      scanActions: {
        openProfile: { type: Boolean, default: true },
        saveContact: { type: Boolean, default: false },
        autoShare: { type: Boolean, default: false },
      },
      autoAdjustBorders: { type: Boolean, default: true },
      allowManualAdjustAfterScan: { type: Boolean, default: true },
      useSystemCamera: { type: Boolean, default: true },
      importFromGallery: { type: Boolean, default: true },
      saveScansToPhotos: { type: Boolean, default: false },
      doubleFocus: { type: Boolean, default: true },
      showGridOverlay: { type: Boolean, default: true },
    },
  },
  specificSettings: {
    type: Map,
    of: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  notifications: {
    channels: { type: ChannelSettingsSchema, required: true },
    general: {
      allNotifications: { type: Boolean, default: true },
      frequency: { type: String, enum: ['immediate', 'daily', 'weekly'], default: 'immediate' },
      sound: { type: Boolean, default: true },
      vibration: { type: Boolean, default: true },
    },
    Account: {
      storageLevel: channelField(),
      transfer: channelField(),
      deactivateClose: channelField(),
    },
    Profile: {
      createDelete: channelField(),
      verification: channelField(),
      updates: channelField(),
      views: channelField(),
      invitations: channelField(),
      recomendations: channelField(),
      rewards: channelField(),
    },
    networking: {
      connections: channelField(),
      affiliations: channelField(),
      following: channelField(),
      invitation: channelField(),
      mutualRecommendation: channelField(),
      roleChanges: channelField(),
      circleUpdates: channelField(),
    },
    communication: {
      chat: channelField(),
      call: channelField(),
      post: channelField(),
      reactions: channelField(),
      inbox: channelField(),
      comments: channelField(),
      share: channelField(),
    },
    calendar: {
      assignmentParticipation: channelField(),
      outcome: channelField(),
      booking: channelField(),
      holidays: channelField(),
      celebration: channelField(),
      reminder: channelField(),
      scheduleShift: channelField(),
    },
    paymentMarketing: {
      payment: channelField(),
      payout: channelField(),
      myPts: channelField(),
      subscription: channelField(),
      refund: channelField(),
      promotions: channelField(),
      newProduct: channelField(),
      seasonalSalesEvents: channelField(),
      referralBonus: channelField(),
    },
    securityPrivacy: {
      newDeviceLogin: channelField(),
      suspiciousLogin: channelField(),
      passwordResetRequest: channelField(),
      passwordChangeConfirmation: channelField(),
      twoFactorAuth: channelField(),
      securityPrivacyChange: channelField(),
      blockedUnblockedActivity: channelField(),
      reportSubmissionConfirmation: channelField(),
      privacyBreach: channelField(),
    },
    appUpdates: {
      newFeatureRelease: channelField(),
      appVersionUpdate: channelField(),
      mandatoryUpdate: channelField(),
      betaFeatureAccess: channelField(),
      systemMaintenance: channelField(),
      resolvedBugNotice: channelField(),
    },
  },
  security: { type: SecuritySchema, required: true },
  privacy: { type: PrivacySchema, required: true },
  discovery: { type: DiscoverySchema, default: () => ({}) },
  dataSettings: { type: DataSettingsSchema, default: () => ({}) },
  blockingSettings: { type: BlockingSettingsSchema, default: () => ({}) },
  pay: { type: PaySchema, default: () => ({}) },
}, {
  timestamps: true
});

export const SettingsModel = mongoose.model<SettingsDocument>('Settings', SettingsSchema) 