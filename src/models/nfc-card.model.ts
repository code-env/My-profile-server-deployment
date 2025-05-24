import mongoose, { Schema, Document } from 'mongoose';

export interface INFCCard extends Document {
  cardId: string;               // Unique physical card identifier
  profileId: mongoose.Types.ObjectId;
  purchaseDate: Date;
  status: 'active' | 'inactive' | 'lost' | 'damaged';
  cardType: 'basic' | 'premium' | 'custom';
  isConfigured: boolean;        // Has data been written to the card
  lastWriteDate?: Date;
  lastScanDate?: Date;         // Last time card was scanned by someone
  totalScans: number;          // Analytics: total times scanned

  // Card configuration
  configuration: {
    dataTemplate: 'full' | 'minimal' | 'custom';
    enabledFields: string[];   // Which profile fields to include
    customData?: any;          // Custom data for 'custom' template
  };

  // Access control settings
  accessControl: {
    isEncrypted: boolean;
    accessLevel: 'public' | 'protected' | 'private';
    allowedProfiles: mongoose.Types.ObjectId[];  // Who can scan this card
    requireLocation?: boolean;   // Require location for scans
    allowedLocations?: {        // Geographic restrictions
      latitude: number;
      longitude: number;
      radius: number;           // In meters
      name: string;
    }[];
    expiryDate?: Date;          // When card access expires
  };

  // Analytics and tracking
  analytics: {
    totalScans: number;
    uniqueScans: number;        // Unique profiles that scanned
    lastScanLocation?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
    scanHistory: {
      scannedBy?: mongoose.Types.ObjectId;
      timestamp: Date;
      location?: {
        latitude: number;
        longitude: number;
        address?: string;
      };
      deviceInfo?: {
        platform: string;
        userAgent: string;
      };
      ipAddress?: string;
    }[];
  };

  createdAt: Date;
  updatedAt: Date;
}

const NFCCardSchema = new Schema<INFCCard>({
  cardId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  profileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Profile',
    required: true,
    index: true
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'lost', 'damaged'],
    default: 'active'
  },
  cardType: {
    type: String,
    enum: ['basic', 'premium', 'custom'],
    default: 'basic'
  },
  isConfigured: {
    type: Boolean,
    default: false
  },
  lastWriteDate: {
    type: Date,
    required: false
  },
  lastScanDate: {
    type: Date,
    required: false
  },
  totalScans: {
    type: Number,
    default: 0
  },

  // Configuration
  configuration: {
    dataTemplate: {
      type: String,
      enum: ['full', 'minimal', 'custom'],
      default: 'full'
    },
    enabledFields: [{
      type: String
    }],
    customData: {
      type: Schema.Types.Mixed,
      required: false
    }
  },

  // Access Control
  accessControl: {
    isEncrypted: {
      type: Boolean,
      default: false
    },
    accessLevel: {
      type: String,
      enum: ['public', 'protected', 'private'],
      default: 'public'
    },
    allowedProfiles: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile'
    }],
    requireLocation: {
      type: Boolean,
      default: false
    },
    allowedLocations: [{
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      radius: { type: Number, required: true },
      name: { type: String, required: true }
    }],
    expiryDate: {
      type: Date,
      required: false
    }
  },

  // Analytics
  analytics: {
    totalScans: {
      type: Number,
      default: 0
    },
    uniqueScans: {
      type: Number,
      default: 0
    },
    lastScanLocation: {
      latitude: { type: Number, required: false },
      longitude: { type: Number, required: false },
      address: { type: String, required: false }
    },
    scanHistory: [{
      scannedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Profile',
        required: false
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      location: {
        latitude: { type: Number, required: false },
        longitude: { type: Number, required: false },
        address: { type: String, required: false }
      },
      deviceInfo: {
        platform: { type: String, required: false },
        userAgent: { type: String, required: false }
      },
      ipAddress: { type: String, required: false }
    }]
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
NFCCardSchema.index({ profileId: 1, status: 1 });
NFCCardSchema.index({ cardId: 1, status: 1 });
NFCCardSchema.index({ 'analytics.totalScans': -1 });
NFCCardSchema.index({ 'analytics.scanHistory.timestamp': -1 });

// Pre-save middleware to update analytics
NFCCardSchema.pre('save', function(next) {
  // Update unique scans count
  if (this.analytics.scanHistory.length > 0) {
    const uniqueProfiles = new Set(
      this.analytics.scanHistory
        .filter(scan => scan.scannedBy)
        .map(scan => scan.scannedBy?.toString())
    );
    this.analytics.uniqueScans = uniqueProfiles.size;
    this.analytics.totalScans = this.analytics.scanHistory.length;

    // Update last scan info
    const lastScan = this.analytics.scanHistory[this.analytics.scanHistory.length - 1];
    if (lastScan) {
      this.lastScanDate = lastScan.timestamp;
      if (lastScan.location) {
        this.analytics.lastScanLocation = lastScan.location;
      }
    }
  }
  next();
});

export const NFCCardModel = mongoose.model<INFCCard>('NFCCard', NFCCardSchema);
