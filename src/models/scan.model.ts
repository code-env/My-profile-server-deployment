import mongoose, { Schema, Document } from 'mongoose';

export type ScanType = 'badge' | 'doc' | 'qrcode' | 'card' | 'nfc-read' | 'nfc-write';

export interface IScan extends Document {
  profileId: mongoose.Types.ObjectId;
  type: ScanType;
  data: {
    // For file-based scans (badge, doc, card)
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;

    // For QR code scans (text data)
    text?: string;

    // For NFC operations
    nfcData?: {
      operation: 'read' | 'write';
      cardId?: string;           // Physical NFC card identifier
      tagInfo?: {
        uid?: string;            // NFC tag unique ID
        type?: string;           // NTAG213, MIFARE, etc.
        capacity?: number;       // Storage capacity in bytes
        writtenSize?: number;    // Actual data size written
      };
      profileData?: {            // Data written to/read from NFC
        profileLink?: string;
        connectLink?: string;
        basicInfo?: {
          name?: string;
          title?: string;
          phone?: string;
          email?: string;
          company?: string;
        };
        customFields?: any;
      };
      accessControl?: {
        isEncrypted?: boolean;
        accessLevel?: 'public' | 'protected' | 'private';
        allowedProfiles?: mongoose.Types.ObjectId[];
      };
      // Analytics data for when others scan this card
      scannedBy?: {
        profileId?: mongoose.Types.ObjectId;
        location?: {
          latitude?: number;
          longitude?: number;
          address?: string;
        };
        deviceInfo?: {
          platform?: string;     // iOS, Android, Web
          userAgent?: string;
        };
        ipAddress?: string;
      };
    };

    // Additional metadata
    metadata?: {
      [key: string]: any;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const ScanSchema = new Schema<IScan>({
  profileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Profile',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['badge', 'doc', 'qrcode', 'card', 'nfc-read', 'nfc-write'],
    required: true
  },
  data: {
    // File-based data
    fileUrl: {
      type: String,
      required: false
    },
    fileName: {
      type: String,
      required: false
    },
    fileType: {
      type: String,
      required: false
    },
    fileSize: {
      type: Number,
      required: false
    },

    // Text data for QR codes
    text: {
      type: String,
      required: false
    },

    // Additional metadata
    metadata: {
      type: Schema.Types.Mixed,
      required: false
    }
  }
}, {
  timestamps: true
});

// Add compound index for efficient queries
ScanSchema.index({ profileId: 1, type: 1 });
ScanSchema.index({ profileId: 1, createdAt: -1 });

// Validation to ensure proper data is provided based on type
ScanSchema.pre('save', function(next) {
  if (this.type === 'qrcode') {
    if (!this.data.text) {
      return next(new Error('QR code scans must have text data'));
    }
  } else if (this.type === 'nfc-read' || this.type === 'nfc-write') {
    if (!this.data.nfcData) {
      return next(new Error('NFC scans must have nfcData'));
    }
    if (!this.data.nfcData.operation) {
      return next(new Error('NFC scans must specify operation (read/write)'));
    }
  } else {
    // File-based scans (badge, doc, card)
    if (!this.data.fileUrl) {
      return next(new Error('File-based scans must have a file URL'));
    }
  }
  next();
});

export const ScanModel = mongoose.model<IScan>('Scan', ScanSchema);
