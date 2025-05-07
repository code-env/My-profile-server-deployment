import mongoose, { Document, Model, Schema } from 'mongoose';

export type ProfileCategory = 'individual' | 'accessory' | 'group';

export const PROFILE_TYPE_ENUM = [
  // individual
  'personal', 'academic', 'work', 'professional', 'proprietor',
  'freelancer', 'artist', 'influencer', 'athlete', 'provider',
  'merchant', 'vendor',
  // accessory
  'emergency', 'medical', 'pet', 'ecommerce', 'home', 'transportation',
  'driver', 'event', 'dependent', 'rider',
  // group
  'group', 'team', 'family', 'neighborhood', 'company', 'business',
  'association', 'organization', 'institution', 'community'
] as const;

export type ProfileType = typeof PROFILE_TYPE_ENUM[number];

export type FieldWidget =
  | 'text' | 'textarea' | 'number' | 'select' | 'multiselect'
  | 'email' | 'url' | 'phone' | 'date' | 'datetime'
  | 'boolean' | 'file' | 'image' | 'object' | 'list:text';

export interface IFieldOption {
  label: string;
  value: string | number;
}

export interface IFieldValidation {
  min?: number;
  max?: number;
  regex?: string;
}

export interface ITemplateField {
  name: string;           
  label: string;          
  widget: FieldWidget;    
  content?: any;          
  order: number;          
  enabled: boolean;       
  required?: boolean;     
  default?: any;          
  placeholder?: string;   
  options?: IFieldOption[]; 
  validation?: IFieldValidation; 
}

export interface ITemplateCategory {
  name: string;           
  label: string;          
  icon?: string;          
  collapsible?: boolean;  
  fields: ITemplateField[]; 
}

export interface IProfileTemplate extends Document {
  profileCategory: ProfileCategory;
  profileType: ProfileType;

  name: string;            // Human-readable name
  slug: string;            // URL-friendly identifier for the web version

  categories: ITemplateCategory[];

  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const FieldSchema = new Schema<ITemplateField>(
  {
    name: { type: String, required: true },
    label: { type: String, required: true },
    widget: { type: String, required: true },
    content: { type: Schema.Types.Mixed },
    order: { type: Number, required: true },
    enabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    default: { type: Schema.Types.Mixed },
    placeholder: { type: String },
    options: [{
      label: { type: String, required: true },
      value: Schema.Types.Mixed
    }],
    validation: {
      min: Number,
      max: Number,
      regex: String
    }
  },
  { _id: false }
);

const CategorySchema = new Schema<ITemplateCategory>(
  {
    name: { type: String, required: true },
    label: { type: String, required: true },
    icon: String,
    collapsible: { type: Boolean, default: true },
    fields: { type: [FieldSchema], default: [] }
  },
  { _id: false }
);

const TemplateSchema = new Schema<IProfileTemplate>(
  {
    profileCategory: {
      type: String,
      enum: ['individual', 'accessory', 'group'],
      required: true,
      index: true
    },
    profileType: {
      type: String,
      enum: PROFILE_TYPE_ENUM,
      required: true,
      index: true
    },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    categories: { type: [CategorySchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'SuperAdmin', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'SuperAdmin' }
  },
  { timestamps: true }
);

TemplateSchema.index(
  { profileCategory: 1, profileType: 1 },
  { unique: true }
);

export const ProfileTemplate: Model<IProfileTemplate> =
  mongoose.model<IProfileTemplate>('ProfileTemplate', TemplateSchema);