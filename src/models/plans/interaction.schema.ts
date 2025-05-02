import { Schema, Types } from 'mongoose';
import { IPlan, PlanModel } from './Plan';

export enum InteractionMode {
    CALL = 'call',
    TEXT = 'text',
    EMAIL = 'email',
    IN_PERSON = 'in_person',
    VIDEO = 'video'
}

export enum InteractionCategory {
    PERSONAL = 'personal',
    WORK = 'work',
    FAMILY = 'family',
    FRIENDS = 'friends',
    BUSINESS = 'business',
    NETWORKING = 'networking',


}

interface IInteraction extends IPlan {
    profile: Types.ObjectId;  // Reference to the profile being interacted with
    relationship: string;     // e.g., "Friend", "Family", "Colleague"
    lastContact: Date;
    nextContact?: Date;
    frequency?: string;       // e.g., "Weekly", "Monthly"
    mode: InteractionMode;
    physicalLocation?: {
        address?: string;
        coordinates?: {
            lat: number;
            lng: number;
        };
    };
    category: InteractionCategory;
}

const InteractionSchema = new Schema<IInteraction>({
    profile: {
        type: Schema.Types.ObjectId,
        ref: 'Profile',
        required: true
    },
    relationship: {
        type: String,
        required: true
    },
    lastContact: {
        type: Date,
        required: true
    },
    nextContact: {
        type: Date
    },
    frequency: {
        type: String
    },
    mode: {
        type: String,
        enum: Object.values(InteractionMode),
        required: true
    },
    physicalLocation: {
        address: { type: String },
        coordinates: {
            lat: { type: Number },
            lng: { type: Number }
        }
    },
    category: {
        type: String,
        enum: Object.values(InteractionCategory),
        required: true
    }
}, { discriminatorKey: 'planType' });

// Add instance methods
InteractionSchema.methods.updateContact = function (newDate: Date): void {
    this.lastContact = new Date();
    this.nextContact = newDate;
};

InteractionSchema.methods.changeRelationship = function (newRelationship: string): void {
    this.relationship = newRelationship;
};

export const InteractionModel = PlanModel.discriminator<IInteraction>('interaction', InteractionSchema);
export type IInteractionModel = typeof InteractionModel;