/* -----------------------------------------------------------------------
   src/models/profile-template.model.ts
   -----------------------------------------------------------------------
   Mongoose/TypeScript model that lets an **admin** define the structure
   (sections, fields, validation, UI hints, etc.) of every profile type.
   End-users only store “instances” that reference one of these templates.
------------------------------------------------------------------------ */

import mongoose, { Document, Model, Schema } from 'mongoose';

/* ────────────────────────────────────────────────────────────────────
   📌  Enums & helper types
   ──────────────────────────────────────────────────────────────────── */
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
  | 'email' | 'url'    | 'phone'  | 'date'   | 'datetime'
  | 'boolean' | 'file' | 'image'  | 'object' | 'list:text';

export interface IFieldOption {
  label: string;
  value: string | number;
}

export interface IFieldValidation {
  min?: number;           // length or numeric
  max?: number;
  regex?: string;         // JS-style regexp string
}

/* ────────────────────────────────────────────────────────────────────
   🧩  Field → Section → Template interfaces
   ──────────────────────────────────────────────────────────────────── */
export interface ITemplateField {
  key: string;            // e.g. "biography"
  label: string;          // i18n key or literal
  widget: FieldWidget;
  required?: boolean;
  default?: any;
  placeholder?: string;
  options?: IFieldOption[];
  validation?: IFieldValidation;
  ui?: {
    icon?: string;
    hint?: string;
    width?: 12 | 6 | 4 | 3;  // grid width in a 12-col system
    order?: number;          // within the section
  };
}

export interface ITemplateSection {
  key: string;             // "about", "contact", …
  label: string;
  order: number;
  icon?: string;
  collapsible?: boolean;
  fields: ITemplateField[];
}

export interface IProfileTemplate extends Document {
  /* header */
  profileCategory: ProfileCategory;
  profileType: ProfileType;

  name: string;            // human-readable: "Personal profile"
  slug: string;            // machine slug: "personal"
  version: number;         // 1, 2, 3…
  isActive: boolean;       // “published / available”

  sections: ITemplateSection[];

  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

/* ────────────────────────────────────────────────────────────────────
   🔧  Schemas
   ──────────────────────────────────────────────────────────────────── */
/* Field schema ------------------------------------------------------ */
const FieldSchema = new Schema<ITemplateField>(
  {
    key:        { type: String, required: true },
    label:      { type: String, required: true },
    widget:     { type: String, required: true },
    required:   { type: Boolean, default: false },
    default:    { type: Schema.Types.Mixed },
    placeholder:{ type: String },

    options:    [{
      label: { type: String, required: true },
      value: Schema.Types.Mixed
    }],

    validation: {
      min:   Number,
      max:   Number,
      regex: String
    },

    ui: {
      icon:  String,
      hint:  String,
      width: { type: Number, enum: [12, 6, 4, 3], default: 12 },
      order: { type: Number, default: 0 }
    }
  },
  { _id: false }  // embedded – no individual ObjectId
);

/* Section schema ---------------------------------------------------- */
const SectionSchema = new Schema<ITemplateSection>(
  {
    key:         { type: String, required: true },
    label:       { type: String, required: true },
    order:       { type: Number, default: 0 },
    icon:        String,
    collapsible: { type: Boolean, default: true },
    fields:      { type: [FieldSchema], default: [] }
  },
  { _id: false }
);

/* Template schema --------------------------------------------------- */
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

    name:     { type: String, required: true },
    slug:     { type: String, required: true, lowercase: true },
    version:  { type: Number, default: 1 },
    isActive: { type: Boolean, default: false },

    sections: { type: [SectionSchema], default: [] },

    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'Admin' }
  },
  { timestamps: true }
);

/* Indexes ----------------------------------------------------------- */
TemplateSchema.index(
  { profileCategory: 1, profileType: 1, version: -1 },
  { unique: true }            // ensures (category,type,version) is unique
);
TemplateSchema.index({ isActive: 1 });

/* Model ------------------------------------------------------------- */
export const ProfileTemplate: Model<IProfileTemplate> =
  mongoose.model<IProfileTemplate>('ProfileTemplate', TemplateSchema);
