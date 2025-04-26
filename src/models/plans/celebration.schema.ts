import { Schema, Types } from 'mongoose';
import { IPlan, PlanModel } from './Plan';

interface ICelebration extends IPlan {
    gifts: [
        {
            _id: Types.ObjectId;
            description: string;
            requestedBy?: Types.ObjectId;
            promisedBy?: Types.ObjectId;
            received: boolean;
            link?: string;
        }
    ];
    category: 'birthday' | 'anniversary' | 'holiday' | 'achievement' | 'other';
    status: 'planning' | 'upcoming' | 'completed' | 'cancelled';
    photoAlbum?: Types.ObjectId;
    socialMediaPosts: {
        platform: string;
        postId: string;
        url: string;
    }[];
}

const CelebrationSchema = new Schema<ICelebration>({
    gifts: [
        {
          _id: { type: Types.ObjectId, default: () => new Types.ObjectId() },
          description: String,
          requestedBy: { type: Types.ObjectId, ref: 'Profile' },
          promisedBy: { type: Types.ObjectId, ref: 'Profile' },
          received: Boolean,
          link: String,
        },
      ],
    category: {
        type: String,
        enum: ['birthday', 'anniversary', 'holiday', 'achievement', 'other'],
        default: 'birthday'
    },
    status: {
        type: String,
        enum: ['planning', 'upcoming', 'completed', 'cancelled'],
        default: 'planning'
    },
    photoAlbum: { type: Schema.Types.ObjectId, ref: 'Gallery' },
    socialMediaPosts: [{
        platform: { type: String, required: true },
        postId: { type: String, required: true },
        url: { type: String, required: true }
    }]
}, { discriminatorKey: 'planType' });

// Add instance methods
CelebrationSchema.methods.addGift = function (
    description: string,
    requestedBy?: Types.ObjectId
): Types.ObjectId {
    const gift = {
        _id: new Types.ObjectId(),
        description,
        requestedBy,
        received: false
    };
    this.gifts.push(gift);
    return gift._id;
};

CelebrationSchema.methods.markGiftReceived = function (giftId: Types.ObjectId): boolean {
    const gift = this.gifts.id(giftId);
    if (gift) {
        gift.received = true;
        return true;
    }
    return false;
};

CelebrationSchema.methods.addSocialMediaPost = function (
    platform: string,
    postId: string,
    url: string
): void {
    this.socialMediaPosts.push({ platform, postId, url });
};

export const CelebrationModel = PlanModel.discriminator<ICelebration>('celebration', CelebrationSchema);
export type ICelebrationModel = typeof CelebrationModel;