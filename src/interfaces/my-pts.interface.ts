import mongoose from 'mongoose';

export enum TransactionType {
  // MyPts management
  BUY_MYPTS = 'BUY_MYPTS',             // User buys MyPts with real money
  SELL_MYPTS = 'SELL_MYPTS',           // User sells MyPts for real money
  WITHDRAW_MYPTS = 'WITHDRAW_MYPTS',    // User withdraws MyPts back to reserve
  EARN_MYPTS = 'EARN_MYPTS',           // User earns MyPts through activities
  BOOKING_PAYMENT = 'BOOKING_PAYMENT', // User pays for a booking using MyPts
  BOOKING_REWARD = 'BOOKING_REWARD', // User receives a reward for a booking
  BOOKING_PUNISHMENT = 'BOOKING_PUNISHMENT', // User receives a punishment for a booking
  BOOKING_REFUND = 'BOOKING_REFUND', // User receives a refund for a booking
  TASK_REWARD = 'TASK_REWARD', // User receives a reward for a task

  // Product transactions
  PURCHASE_PRODUCT = 'PURCHASE_PRODUCT',           // User purchases a product for another profile using MyPts
  RECEIVE_PRODUCT_PAYMENT = 'RECEIVE_PRODUCT_PAYMENT', // User receives MyPts from product sale

  // Donations
  DONATION_SENT = 'DONATION_SENT',           // User donates MyPts to another profile
  DONATION_RECEIVED = 'DONATION_RECEIVED',   // User receives MyPts as donation

  // Other
  REFUND = 'REFUND',               // MyPts refunded to user
  EXPIRE = 'EXPIRE',               // MyPts expired
  ADJUSTMENT = 'ADJUSTMENT',       // Admin adjustment of MyPts
  ADMIN_WITHDRAWAL = 'ADMIN_WITHDRAWAL'  // Admin withdraws MyPts from a profile
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  RESERVED = 'RESERVED',  // New status for sell transactions that are pending approval
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED'   // New status for rejected transactions
}

export interface IMyPtsTransaction {
  _id?: mongoose.Types.ObjectId;    // MongoDB document ID
  profileId: mongoose.Types.ObjectId;
  type: TransactionType;
  amount: number;                   // Positive for additions, negative for deductions
  balance: number;                  // Balance after transaction
  description: string;
  status: TransactionStatus;
  metadata?: Record<string, any>;   // Additional data specific to transaction type
  referenceId?: string;             // External reference ID (e.g., order ID, payment ID)
  relatedTransaction?: mongoose.Types.ObjectId; // For refunds, donations, product purchases, etc.
  hubLogId?: mongoose.Types.ObjectId; // Reference to related hub log entry
  createdAt: Date;
  updatedAt: Date;
}

export interface IMyPts {
  profileId: mongoose.Types.ObjectId;
  balance: number;                  // Current MyPts balance
  lifetimeEarned: number;           // Total MyPts earned/received over time
  lifetimeSpent: number;            // Total MyPts spent/sent over time
  lastTransaction?: Date;           // Date of last transaction
  createdAt: Date;
  updatedAt: Date;
  save: (options?: any) => Promise<IMyPts>;
}

// Product interface for MyPts purchases
export interface IMyPtsProduct {
  id: string;
  name: string;
  description: string;
  price: number;                    // Price in MyPts
  category: string;
  sellerId: mongoose.Types.ObjectId; // Profile ID of the seller
  isActive: boolean;
  metadata?: Record<string, any>;   // Additional product data
}

export interface IMyPtsMethods {
  // Core methods
  addMyPts(amount: number, type: TransactionType, description: string, metadata?: Record<string, any>, referenceId?: string): Promise<IMyPtsTransaction>;
  deductMyPts(amount: number, type: TransactionType, description: string, metadata?: Record<string, any>, referenceId?: string): Promise<IMyPtsTransaction>;

  // Transaction methods
  purchaseProduct(productId: string, productName: string, sellerProfileId: mongoose.Types.ObjectId, amount: number, metadata?: Record<string, any>): Promise<IMyPtsTransaction>;
  donateMyPts(toProfileId: mongoose.Types.ObjectId, amount: number, message?: string): Promise<IMyPtsTransaction>;

  // History methods
  getTransactionHistory(limit?: number, offset?: number): Promise<IMyPtsTransaction[]>;
  getTransactionsByType(type: TransactionType, limit?: number, offset?: number): Promise<IMyPtsTransaction[]>;
}
