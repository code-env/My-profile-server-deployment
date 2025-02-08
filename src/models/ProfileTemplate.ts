import mongoose, { Document, Schema } from 'mongoose';

export interface IProfileTemplate extends Document {
  name: string;
  description: string;
  category: string;
  fields: {
    name: string;
    type: 'text' | 'number' | 'date' | 'boolean' | 'array' | 'object';
    required: boolean;
    label: string;
    placeholder?: string;
    options?: string[];
    defaultValue?: any;
  }[];
  layout: {
    sections: {
      title: string;
      fields: string[];
      order: number;
    }[];
  };
  settings: {
    defaultVisibility: 'public' | 'private' | 'connections';
    defaultTheme: string;
    allowedModules: string[];
  };
  createdBy: mongoose.Types.ObjectId;
  isPublic: boolean;
  usageCount: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const profileTemplateSchema = new Schema<IProfileTemplate>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['business', 'personal', 'portfolio', 'resume', 'company', 'other'],
    },
    fields: [{
      name: { type: String, required: true },
      type: { 
        type: String, 
        required: true,
        enum: ['text', 'number', 'date', 'boolean', 'array', 'object']
      },
      required: { type: Boolean, default: false },
      label: { type: String, required: true },
      placeholder: String,
      options: [String],
      defaultValue: Schema.Types.Mixed,
    }],
    layout: {
      sections: [{
        title: { type: String, required: true },
        fields: [String],
        order: { type: Number, required: true },
      }],
    },
    settings: {
      defaultVisibility: {
        type: String,
        enum: ['public', 'private', 'connections'],
        default: 'private',
      },
      defaultTheme: {
        type: String,
        default: 'default',
      },
      allowedModules: [String],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    tags: [String],
  },
  {
    timestamps: true,
  }
);

// Index for better search performance
profileTemplateSchema.index({ name: 'text', description: 'text', tags: 'text' });
profileTemplateSchema.index({ category: 1, isPublic: 1 });
profileTemplateSchema.index({ usageCount: -1 });

export const ProfileTemplate = mongoose.model<IProfileTemplate>('ProfileTemplate', profileTemplateSchema);
