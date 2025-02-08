import mongoose, { Document, Schema } from 'mongoose';

export interface IEndorsement extends Document {
  recipient: mongoose.Types.ObjectId;
  endorser: mongoose.Types.ObjectId;
  skill: string;
  level: 'beginner' | 'intermediate' | 'expert';
  relationship: string;
  comment?: string;
  isVerified: boolean;
  weight: number;
  endorsedAt: Date;
  lastUpdated: Date;
}

const endorsementSchema = new Schema<IEndorsement>({
  recipient: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  endorser: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  skill: {
    type: String,
    required: true,
    trim: true,
  },
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'expert'],
    required: true,
  },
  relationship: {
    type: String,
    required: true,
    enum: [
      'colleague',
      'manager',
      'client',
      'mentor',
      'academic',
      'other'
    ],
  },
  comment: {
    type: String,
    maxlength: 500,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  weight: {
    type: Number,
    default: 1,
    min: 0,
    max: 10,
  },
  endorsedAt: {
    type: Date,
    default: Date.now,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
endorsementSchema.index({ recipient: 1, skill: 1 });
endorsementSchema.index({ endorser: 1, recipient: 1 }, { unique: true });
endorsementSchema.index({ skill: 'text' });

// Prevent self-endorsement
endorsementSchema.pre('save', function(next) {
  if (this.recipient.equals(this.endorser)) {
    next(new Error('Self-endorsement is not allowed'));
  }
  next();
});

// Update lastUpdated timestamp on modifications
endorsementSchema.pre('save', function(next) {
  if (this.isModified()) {
    this.lastUpdated = new Date();
  }
  next();
});

export const Endorsement = mongoose.model<IEndorsement>('Endorsement', endorsementSchema);
