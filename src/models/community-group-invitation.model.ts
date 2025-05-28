import mongoose, { Schema, Document, Model } from 'mongoose';

export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface ICommunityGroupInvitation extends Document {
  communityId: mongoose.Types.ObjectId;
  groupId: mongoose.Types.ObjectId;
  invitedBy: mongoose.Types.ObjectId;
  status: InvitationStatus;
  createdAt: Date;
  respondedAt?: Date;
  responseMessage?: string;
}

const CommunityGroupInvitationSchema = new Schema<ICommunityGroupInvitation>({
  communityId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true, index: true },
  groupId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true, index: true },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'Users', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'cancelled'], default: 'pending', index: true },
  createdAt: { type: Date, default: Date.now },
  respondedAt: { type: Date },
  responseMessage: { type: String },
});

CommunityGroupInvitationSchema.index({ communityId: 1, groupId: 1 }, { unique: true });

export const CommunityGroupInvitation: Model<ICommunityGroupInvitation> = mongoose.model<ICommunityGroupInvitation>(
  'CommunityGroupInvitation',
  CommunityGroupInvitationSchema
); 