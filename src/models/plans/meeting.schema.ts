import { Schema, Types } from 'mongoose';
import { IPlan, PlanModel } from './Plan';

interface IMeeting extends IPlan {
    agenda: [
        {
            _id: Types.ObjectId;
            title: string;
            description?: string;
            order: number;
            completed: boolean;
        }
    ];
    minutes?: string;
    decisions: {
        description: string;
        agreedBy: Types.ObjectId[];
    }[];
    status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
    requiredAttendees: Types.ObjectId[];
    optionalAttendees: Types.ObjectId[];
    meetingSpecificSettings?: {
        requireApproval?: boolean;
        minParticipants?: number;
        autoConfirm?: boolean;
    };
    

}

const MeetingSchema = new Schema<IMeeting>({
    agenda: [
        {
            _id: { type: Types.ObjectId, default: () => new Types.ObjectId() },
            title: String,
            description: String,
            order: Number,
            completed: Boolean,
        },
    ],
    minutes: { type: String },
    decisions: [{
        description: { type: String, required: true },
        agreedBy: [{ type: Schema.Types.ObjectId, ref: 'Profile' }]
    }],
    status: {
        type: String,
        enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
        default: 'scheduled'
    },
    requiredAttendees: [{ type: Schema.Types.ObjectId, ref: 'Profile' }],
    optionalAttendees: [{ type: Schema.Types.ObjectId, ref: 'Profile' }],
    meetingSpecificSettings: {
        requireApproval: { type: Boolean, default: false },
        minParticipants: { type: Number, default: 0 },
        autoConfirm: { type: Boolean, default: false }
    }
}, { discriminatorKey: 'planType' });

// Add instance methods
MeetingSchema.methods.addAgendaItem = function (
    title: string,
    order: number,
    description?: string
): Types.ObjectId {
    const newItem = {
        _id: new Types.ObjectId(),
        title,
        description,
        order,
        completed: false
    };
    this.agenda.push(newItem);
    return newItem._id;
};

MeetingSchema.methods.recordDecision = function (
    description: string,
    agreedBy: Types.ObjectId[]
): Types.ObjectId {
    const decision = {
        _id: new Types.ObjectId(),
        description,
        agreedBy
    };
    this.decisions.push(decision);
    return decision._id;
};

MeetingSchema.methods.scheduleMeeting = function (
    startTime: Date,
    endTime: Date,
    bookedBy: Types.ObjectId
) {
    if (!this.bookingSettings) {
        throw new Error('Booking settings not configured for this meeting');
    }

    const newBooking = {
        _id: new Types.ObjectId(),
        bookedBy,
        status: this.meetingSpecificSettings?.autoConfirm ? 'confirmed' : 'pending',
        slot: {
            start: startTime,
            end: endTime,
            timeZone: this.bookingSettings.timeZone
        },
        createdAt: new Date()
    };

    if (!this.bookings) {
        this.bookings = [];
    }
    this.bookings.push(newBooking);
    return newBooking._id;
};
export const MeetingModel = PlanModel.discriminator<IMeeting>('meeting', MeetingSchema);
export type IMeetingModel = typeof MeetingModel;