import { Document } from 'mongoose';
import { Types } from 'mongoose';

export interface IProfileConnection {
  requesterId: Types.ObjectId | string; // Profile ID of the requester
  receiverId: Types.ObjectId | string;  // Profile ID of the receiver
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';
  createdAt: Date;
  updatedAt: Date;
  message?: string; // Optional message with the connection request
  acceptedAt?: Date; // When the connection was accepted
  rejectedAt?: Date; // When the connection was rejected
  blockedAt?: Date;  // When the connection was blocked
}

export interface IProfileConnectionMethods {
  isAccepted(): boolean;
  isPending(): boolean;
  isRejected(): boolean;
  isBlocked(): boolean;
}

export type ProfileConnectionDocument = IProfileConnection & Document & IProfileConnectionMethods;

export interface ProfileConnectionResponse {
  id: string;
  requesterId: string;
  receiverId: string;
  status: string;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  blockedAt?: Date;
  requesterProfile?: {
    id: string;
    name: string;
    profileType: string;
    profileImage?: string;
  };
  receiverProfile?: {
    id: string;
    name: string;
    profileType: string;
    profileImage?: string;
  };
}
