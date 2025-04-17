import mongoose, { Document, Schema, Model } from 'mongoose';

// Interface extending Document
export interface IRelationshipType extends Document {
    name: string;
    profileType: ProfileType;
    group?: string;
    description?: string;
    isSystemDefined: boolean;
    isApproved?: boolean;
    tags?: string[];
}

// Enums for categories (extend as needed)
export enum ProfileType {
    Personal = 'Personal',
    Family = 'Family',
    Professional = 'Professional',
    Organization = 'Organization',
    Academic = 'Academic',
    Business = 'Business',
}

const relationshipTypeSchema = new Schema<IRelationshipType>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        profileType: {
            type: String,
            enum: Object.values(ProfileType),
            required: true,
            index: true
        },
        isApproved: {
            type: Boolean,
            default: false
        },
        group: {
            type: String,
            trim: true,
            index: true
        },
        description: {
            type: String,
            trim: true
        },
        isSystemDefined: {
            type: Boolean,
            default: true
        },
        tags: [{
            type: String,
            trim: true
        }]
    },
    {
        timestamps: true,
        toJSON: {
            transform: function (doc, ret) {
                delete ret.__v;
            }
        }
    }
);

// Indexes for query optimization
relationshipTypeSchema.index({ name: 'text', description: 'text' });
relationshipTypeSchema.index({ profileType: 1, group: 1 });

// Static method to find or create a relationship type
relationshipTypeSchema.statics.findOrCreate = async function (
    name: string,
    profileType: ProfileType,
    group?: string
) {
    const existing = await this.findOne({ name, profileType });
    if (existing) return existing;
    return this.create({ name, profileType, group, isSystemDefined: false });
};

// Interface for RelationshipType model
export interface IRelationshipTypeModel extends Model<IRelationshipType> {
    findOrCreate(
        name: string,
        profileType: ProfileType,
        group?: string
    ): Promise<IRelationshipType>;
}

export const RelationshipType = mongoose.model<IRelationshipType, IRelationshipTypeModel>(
    'RelationshipType',
    relationshipTypeSchema
);