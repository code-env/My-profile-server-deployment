import mongoose, { Document, Schema, Model } from 'mongoose';
import { IMyPts, IMyPtsMethods, IMyPtsTransaction, TransactionStatus, TransactionType } from '../interfaces/my-pts.interface';

// Define MyPts Document type
export type MyPtsDocument = IMyPts & Document & IMyPtsMethods;

// Create the MyPts schema
const myPtsSchema = new Schema<IMyPts>(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
      unique: true,
      index: true
    },
    balance: {
      type: Number,
      default: 0,
      min: 0
    },
    lifetimeEarned: {
      type: Number,
      default: 0,
      min: 0
    },
    lifetimeSpent: {
      type: Number,
      default: 0,
      min: 0
    },
    lastTransaction: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Create the MyPtsTransaction schema
const myPtsTransactionSchema = new Schema<IMyPtsTransaction>(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: Object.values(TransactionType),
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true
    },
    balance: {
      type: Number,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: Object.values(TransactionStatus),
      default: TransactionStatus.COMPLETED,
      index: true
    },
    metadata: {
      type: Schema.Types.Mixed
    },
    referenceId: {
      type: String,
      sparse: true,
      index: true
    },
    relatedTransaction: {
      type: Schema.Types.ObjectId,
      ref: 'MyPtsTransaction'
    },
    hubLogId: {
      type: Schema.Types.ObjectId,
      ref: 'MyPtsHubLog',
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes for better query performance
myPtsSchema.index({ balance: -1 });
myPtsTransactionSchema.index({ createdAt: -1 });
myPtsTransactionSchema.index({ profileId: 1, type: 1 });
myPtsTransactionSchema.index({ profileId: 1, createdAt: -1 });

// Instance methods
myPtsSchema.methods.addMyPts = async function(
  amount: number,
  type: TransactionType,
  description: string,
  metadata?: Record<string, any>,
  referenceId?: string
): Promise<IMyPtsTransaction> {
  if (amount <= 0) {
    throw new Error('Amount must be greater than zero');
  }

  // Update MyPts document
  const previousBalance = this.balance;
  this.balance += amount;
  this.lifetimeEarned += amount;
  this.lastTransaction = new Date();
  await this.save();

  // Check if balance has crossed the 1000 MyPts threshold for referral rewards
  if (previousBalance < 1000 && this.balance >= 1000) {
    try {
      // Import here to avoid circular dependency
      const { ProfileReferralService } = require('../services/profile-referral.service');
      // Update referral status if this profile was referred by someone
      await ProfileReferralService.checkThresholdAndUpdateStatus(this.profileId);
    } catch (error) {
      console.error('Error updating referral threshold status:', error);
      // Don't throw the error to avoid disrupting the main transaction
    }
  }

  // Create transaction record
  const transaction = await MyPtsTransactionModel.create({
    profileId: this.profileId,
    type,
    amount,
    balance: this.balance,
    description,
    status: TransactionStatus.COMPLETED,
    metadata,
    referenceId
  });

  return transaction;
};

myPtsSchema.methods.deductMyPts = async function(
  amount: number,
  type: TransactionType,
  description: string,
  metadata?: Record<string, any>,
  referenceId?: string
): Promise<IMyPtsTransaction> {
  if (amount <= 0) {
    throw new Error('Amount must be greater than zero');
  }

  if (this.balance < amount) {
    throw new Error('Insufficient MyPts balance');
  }

  // Update MyPts document
  this.balance -= amount;
  this.lifetimeSpent += amount;
  this.lastTransaction = new Date();
  await this.save();

  // Create transaction record
  const transaction = await MyPtsTransactionModel.create({
    profileId: this.profileId,
    type,
    amount: -amount, // Negative amount for deductions
    balance: this.balance,
    description,
    status: TransactionStatus.COMPLETED,
    metadata,
    referenceId
  });

  return transaction;
};

myPtsSchema.methods.donateMyPts = async function(
  toProfileId: mongoose.Types.ObjectId,
  amount: number,
  description: string
): Promise<IMyPtsTransaction> {
  if (amount <= 0) {
    throw new Error('Donation amount must be greater than zero');
  }

  if (this.balance < amount) {
    throw new Error('Insufficient MyPts balance for donation');
  }

  // Start a session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Deduct points from sender
    const senderTransaction = await this.deductMyPts(
      amount,
      TransactionType.DONATION_SENT,
      `Donated ${amount} MyPts to profile: ${toProfileId} - ${description}`
    );

    // Add points to receiver
    const receiverPoints = await MyPtsModel.findOne({ profileId: toProfileId });
    if (!receiverPoints) {
      // Create new MyPts document for receiver if it doesn't exist
      await MyPtsModel.create({
        profileId: toProfileId,
        balance: amount,
        lifetimeEarned: amount,
        lastTransaction: new Date()
      });

      // Create transaction record for receiver
      const receiverTransaction = await MyPtsTransactionModel.create({
        profileId: toProfileId,
        type: TransactionType.DONATION_RECEIVED,
        amount,
        balance: amount,
        description: `Received ${amount} MyPts donation from profile: ${this.profileId} - ${description}`,
        relatedTransaction: senderTransaction._id
      });

      // Update sender transaction with related transaction
      await MyPtsTransactionModel.findByIdAndUpdate(senderTransaction._id, {
        relatedTransaction: receiverTransaction._id
      });

      await session.commitTransaction();
      session.endSession();

      return senderTransaction;
    } else {
      // Add points to existing receiver
      const receiverTransaction = await receiverPoints.addMyPts(
        amount,
        TransactionType.DONATION_RECEIVED,
        `Received ${amount} MyPts donation from profile: ${this.profileId} - ${description}`
      );

      // Update sender and receiver transactions with related transaction IDs
      await MyPtsTransactionModel.findByIdAndUpdate(senderTransaction._id, {
        relatedTransaction: receiverTransaction._id
      });

      await MyPtsTransactionModel.findByIdAndUpdate(receiverTransaction._id, {
        relatedTransaction: senderTransaction._id
      });

      await session.commitTransaction();
      session.endSession();

      return senderTransaction;
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

myPtsSchema.methods.getTransactionHistory = async function(
  limit: number = 20,
  offset: number = 0
): Promise<IMyPtsTransaction[]> {
  return MyPtsTransactionModel.find({ profileId: this.profileId })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);
};

myPtsSchema.methods.getTransactionsByType = async function(
  type: TransactionType,
  limit: number = 20,
  offset: number = 0
): Promise<IMyPtsTransaction[]> {
  return MyPtsTransactionModel.find({
    profileId: this.profileId,
    type: type
  })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);
};

// Static methods
myPtsSchema.statics.findOrCreate = async function(
  profileId: mongoose.Types.ObjectId
): Promise<MyPtsDocument> {
  let myPts = await this.findOne({ profileId });

  if (!myPts) {
    myPts = await this.create({
      profileId,
      balance: 0,
      lifetimeEarned: 0,
      lifetimeSpent: 0
    });
  }

  return myPts;
};

// Define interface for model type
export interface IMyPtsModel extends Model<IMyPts, {}, IMyPtsMethods> {
  findOrCreate(profileId: mongoose.Types.ObjectId): Promise<MyPtsDocument>;
}

// Create and export the models
export const MyPtsModel = mongoose.model<IMyPts, IMyPtsModel>('MyPts', myPtsSchema);
export const MyPtsTransactionModel = mongoose.model<IMyPtsTransaction>('MyPtsTransaction', myPtsTransactionSchema);
