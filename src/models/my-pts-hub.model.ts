import mongoose, { Document, Schema, Model } from 'mongoose';
import { logger } from '../utils/logger';

/**
 * Enum for MyPts supply adjustment actions
 */
export enum MyPtsSupplyAction {
  ISSUE = 'ISSUE',                 // Create new MyPts
  BURN = 'BURN',                   // Destroy existing MyPts
  RESERVE_TO_CIRCULATION = 'RESERVE_TO_CIRCULATION', // Move from reserve to circulation
  CIRCULATION_TO_RESERVE = 'CIRCULATION_TO_RESERVE', // Move from circulation to reserve
  HOLDING_TO_CIRCULATION = 'HOLDING_TO_CIRCULATION', // Move from holding to circulation
  HOLDING_TO_RESERVE = 'HOLDING_TO_RESERVE',         // Move from holding to reserve
  ADJUST_MAX_SUPPLY = 'ADJUST_MAX_SUPPLY'  // Change the maximum supply cap
}

/**
 * Interface for MyPts Hub document
 */
export interface IMyPtsHub {
  totalSupply: number;             // Total MyPts in existence
  circulatingSupply: number;       // MyPts in circulation (held by profiles)
  reserveSupply: number;           // MyPts held in reserve by the system
  holdingSupply: number;           // MyPts held in holding (15% of total)
  maxSupply: number | null;        // Maximum possible supply (null = unlimited)
  valuePerMyPt: number;            // Current value in USD
  lastAdjustment: Date;            // Last time the supply was adjusted
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for MyPts Hub Log document
 */
export interface IMyPtsHubLog {
  action: MyPtsSupplyAction;
  amount: number;
  reason: string;
  adminId?: mongoose.Types.ObjectId;
  metadata?: Record<string, any>;
  totalSupplyBefore: number;
  totalSupplyAfter: number;
  circulatingSupplyBefore: number;
  circulatingSupplyAfter: number;
  reserveSupplyBefore: number;
  reserveSupplyAfter: number;
  holdingSupplyBefore?: number;
  holdingSupplyAfter?: number;
  valuePerMyPt: number;
  transactionId?: mongoose.Types.ObjectId; // Reference to related user transaction
  createdAt: Date;
}

/**
 * Interface for MyPts Hub methods
 */
export interface IMyPtsHubMethods {
  issueMyPts(amount: number, reason: string, adminId?: mongoose.Types.ObjectId, metadata?: Record<string, any>): Promise<boolean>;
  burnMyPts(amount: number, reason: string, adminId?: mongoose.Types.ObjectId, metadata?: Record<string, any>): Promise<boolean>;
  moveToCirculation(amount: number, reason: string, adminId?: mongoose.Types.ObjectId, metadata?: Record<string, any>, transactionId?: mongoose.Types.ObjectId): Promise<{ success: boolean; logId?: mongoose.Types.ObjectId }>;
  moveToReserve(amount: number, reason: string, adminId?: mongoose.Types.ObjectId, metadata?: Record<string, any>, transactionId?: mongoose.Types.ObjectId): Promise<{ success: boolean; logId?: mongoose.Types.ObjectId }>;
  moveFromHoldingToCirculation(amount: number, reason: string, adminId?: mongoose.Types.ObjectId, metadata?: Record<string, any>, transactionId?: mongoose.Types.ObjectId): Promise<{ success: boolean; logId?: mongoose.Types.ObjectId }>;
  moveFromHoldingToReserve(amount: number, reason: string, adminId?: mongoose.Types.ObjectId, metadata?: Record<string, any>, transactionId?: mongoose.Types.ObjectId): Promise<{ success: boolean; logId?: mongoose.Types.ObjectId }>;
  adjustMaxSupply(newMaxSupply: number | null, reason: string, adminId?: mongoose.Types.ObjectId): Promise<boolean>;
  updateValuePerMyPt(newValue: number): Promise<boolean>;
  validateSupplyOperation(action: MyPtsSupplyAction, amount: number): { valid: boolean; message?: string };
}

// Define MyPtsHub Document type
export type MyPtsHubDocument = IMyPtsHub & Document & IMyPtsHubMethods;

const totalSupply = 1000000000
// Create the MyPtsHub schema
const myPtsHubSchema = new Schema<IMyPtsHub>(
  {
    totalSupply: {
      type: Number,
      required: true,
      default: totalSupply,  // 1 billion total supply
      min: 0
    },
    circulatingSupply: {
      type: Number,
      required: true,
      default: 0,  // No MyPts in circulation initially
      min: 0
    },
    reserveSupply: {
      type: Number,
      required: true,
      default: totalSupply * 0.85,  // 85% of total supply in reserve
      min: 0
    },
    holdingSupply: {
      type: Number,
      required: true,
      default: totalSupply * 0.15 ,  // 15% of total supply in holding
      min: 0
    },
    maxSupply: {
      type: Number,
      default: null,
      min: 0
    },
    valuePerMyPt: {
      type: Number,
      required: true,
      default: 0.024,  // Initial value from your requirements
      min: 0
    },
    lastAdjustment: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Create the MyPtsHubLog schema
const myPtsHubLogSchema = new Schema<IMyPtsHubLog>(
  {
    action: {
      type: String,
      required: true,
      enum: Object.values(MyPtsSupplyAction)
    },
    amount: {
      type: Number,
      required: true
    },
    reason: {
      type: String,
      required: true
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    metadata: {
      type: Schema.Types.Mixed
    },
    totalSupplyBefore: {
      type: Number,
      required: true
    },
    totalSupplyAfter: {
      type: Number,
      required: true
    },
    circulatingSupplyBefore: {
      type: Number,
      required: true
    },
    circulatingSupplyAfter: {
      type: Number,
      required: true
    },
    reserveSupplyBefore: {
      type: Number,
      required: true
    },
    reserveSupplyAfter: {
      type: Number,
      required: true
    },
    holdingSupplyBefore: {
      type: Number
    },
    holdingSupplyAfter: {
      type: Number
    },
    valuePerMyPt: {
      type: Number,
      required: true
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: 'MyPtsTransaction',
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Add indexes for better query performance
myPtsHubLogSchema.index({ action: 1 });
myPtsHubLogSchema.index({ createdAt: -1 });
myPtsHubLogSchema.index({ adminId: 1 });

/**
 * Validate a supply operation
 */
myPtsHubSchema.methods.validateSupplyOperation = function(
  action: MyPtsSupplyAction,
  amount: number
): { valid: boolean; message?: string } {
  if (amount <= 0) {
    return { valid: false, message: 'Amount must be greater than zero' };
  }

  switch (action) {
    case MyPtsSupplyAction.ISSUE:
      // Check if issuing would exceed max supply
      if (this.maxSupply !== null && this.totalSupply + amount > this.maxSupply) {
        return {
          valid: false,
          message: `Issuing ${amount} MyPts would exceed the maximum supply of ${this.maxSupply}`
        };
      }
      break;

    case MyPtsSupplyAction.BURN:
      // Check if there are enough MyPts to burn
      if (amount > this.circulatingSupply) {
        return {
          valid: false,
          message: `Cannot burn ${amount} MyPts when only ${this.circulatingSupply} are in circulation`
        };
      }
      break;

    case MyPtsSupplyAction.RESERVE_TO_CIRCULATION:
      // Check if there are enough MyPts in reserve
      if (amount > this.reserveSupply) {
        return {
          valid: false,
          message: `Cannot move ${amount} MyPts to circulation when only ${this.reserveSupply} are in reserve`
        };
      }
      break;

    case MyPtsSupplyAction.CIRCULATION_TO_RESERVE:
      // Check if there are enough MyPts in circulation
      if (amount > this.circulatingSupply) {
        return {
          valid: false,
          message: `Cannot move ${amount} MyPts to reserve when only ${this.circulatingSupply} are in circulation`
        };
      }
      break;
  }

  return { valid: true };
};

/**
 * Create a log entry for a supply operation
 */
async function createSupplyLog(
  hub: MyPtsHubDocument,
  action: MyPtsSupplyAction,
  amount: number,
  reason: string,
  totalSupplyBefore: number,
  circulatingSupplyBefore: number,
  reserveSupplyBefore: number,
  adminId?: mongoose.Types.ObjectId,
  metadata?: Record<string, any>,
  transactionId?: mongoose.Types.ObjectId,
  holdingSupplyBefore?: number
): Promise<mongoose.Types.ObjectId | undefined> {
  try {
    const logData: any = {
      action,
      amount,
      reason,
      adminId,
      metadata,
      totalSupplyBefore,
      totalSupplyAfter: hub.totalSupply,
      circulatingSupplyBefore,
      circulatingSupplyAfter: hub.circulatingSupply,
      reserveSupplyBefore,
      reserveSupplyAfter: hub.reserveSupply,
      valuePerMyPt: hub.valuePerMyPt,
      transactionId
    };

    // Add holding supply information if provided
    if (holdingSupplyBefore !== undefined) {
      logData.holdingSupplyBefore = holdingSupplyBefore;
      logData.holdingSupplyAfter = hub.holdingSupply;
    }

    const log = await MyPtsHubLogModel.create(logData);
    return log._id;
  } catch (error) {
    logger.error('Failed to create MyPts supply log', { error, action, amount, reason });
    // Don't throw - we don't want to fail the main operation if logging fails
    return undefined;
  }
}

/**
 * Issue new MyPts
 */
myPtsHubSchema.methods.issueMyPts = async function(
  amount: number,
  reason: string,
  adminId?: mongoose.Types.ObjectId,
  metadata?: Record<string, any>
): Promise<boolean> {
  const validation = this.validateSupplyOperation(MyPtsSupplyAction.ISSUE, amount);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const totalSupplyBefore = this.totalSupply;
    const circulatingSupplyBefore = this.circulatingSupply;
    const reserveSupplyBefore = this.reserveSupply;
    const holdingSupplyBefore = this.holdingSupply;

    // Update the hub document
    this.totalSupply += amount;
    this.holdingSupply += amount; // New MyPts go to holding first
    this.lastAdjustment = new Date();
    await this.save({ session });

    // Create log entry
    await createSupplyLog(
      this  as MyPtsHubDocument,
      MyPtsSupplyAction.ISSUE,
      amount,
      reason,
      totalSupplyBefore,
      circulatingSupplyBefore,
      reserveSupplyBefore,
      adminId,
      metadata,
      undefined,
      holdingSupplyBefore
    );

    await session.commitTransaction();
    return true;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Burn existing MyPts
 */
myPtsHubSchema.methods.burnMyPts = async function(
  amount: number,
  reason: string,
  adminId?: mongoose.Types.ObjectId,
  metadata?: Record<string, any>
): Promise<boolean> {
  const validation = this.validateSupplyOperation(MyPtsSupplyAction.BURN, amount);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const totalSupplyBefore = this.totalSupply;
    const circulatingSupplyBefore = this.circulatingSupply;
    const reserveSupplyBefore = this.reserveSupply;

    // Update the hub document
    this.totalSupply -= amount;
    this.circulatingSupply -= amount;
    this.lastAdjustment = new Date();
    await this.save({ session });

    // Create log entry
    await createSupplyLog(
         this  as MyPtsHubDocument,
      MyPtsSupplyAction.BURN,
      amount,
      reason,
      totalSupplyBefore,
      circulatingSupplyBefore,
      reserveSupplyBefore,
      adminId,
      metadata
    );

    await session.commitTransaction();
    return true;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Move MyPts from reserve to circulation
 */
myPtsHubSchema.methods.moveToCirculation = async function(
  amount: number,
  reason: string,
  adminId?: mongoose.Types.ObjectId,
  metadata?: Record<string, any>,
  transactionId?: mongoose.Types.ObjectId
): Promise<{ success: boolean; logId?: mongoose.Types.ObjectId }> {
  const validation = this.validateSupplyOperation(MyPtsSupplyAction.RESERVE_TO_CIRCULATION, amount);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const totalSupplyBefore = this.totalSupply;
    const circulatingSupplyBefore = this.circulatingSupply;
    const reserveSupplyBefore = this.reserveSupply;

    // Update the hub document
    this.circulatingSupply += amount;
    this.reserveSupply -= amount;
    this.lastAdjustment = new Date();
    await this.save({ session });

    // Create log entry
    const logId = await createSupplyLog(
      this  as MyPtsHubDocument,
      MyPtsSupplyAction.RESERVE_TO_CIRCULATION,
      amount,
      reason,
      totalSupplyBefore,
      circulatingSupplyBefore,
      reserveSupplyBefore,
      adminId,
      metadata,
      transactionId
    );

    await session.commitTransaction();
    return { success: true, logId };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Move MyPts from circulation to reserve
 */
myPtsHubSchema.methods.moveToReserve = async function(
  amount: number,
  reason: string,
  adminId?: mongoose.Types.ObjectId,
  metadata?: Record<string, any>,
  transactionId?: mongoose.Types.ObjectId
): Promise<{ success: boolean; logId?: mongoose.Types.ObjectId }> {
  const validation = this.validateSupplyOperation(MyPtsSupplyAction.CIRCULATION_TO_RESERVE, amount);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const totalSupplyBefore = this.totalSupply;
    const circulatingSupplyBefore = this.circulatingSupply;
    const reserveSupplyBefore = this.reserveSupply;

    // Update the hub document
    this.circulatingSupply -= amount;
    this.reserveSupply += amount;
    this.lastAdjustment = new Date();
    await this.save({ session });

    // Create log entry
    const logId = await createSupplyLog(
      this as MyPtsHubDocument,
      MyPtsSupplyAction.CIRCULATION_TO_RESERVE,
      amount,
      reason,
      totalSupplyBefore,
      circulatingSupplyBefore,
      reserveSupplyBefore,
      adminId,
      metadata,
      transactionId
    );

    await session.commitTransaction();
    return { success: true, logId };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Move MyPts from holding to circulation
 */
myPtsHubSchema.methods.moveFromHoldingToCirculation = async function(
  amount: number,
  reason: string,
  adminId?: mongoose.Types.ObjectId,
  metadata?: Record<string, any>,
  transactionId?: mongoose.Types.ObjectId
): Promise<{ success: boolean; logId?: mongoose.Types.ObjectId }> {
  // Validate the amount
  if (amount <= 0) {
    throw new Error('Amount must be greater than zero');
  }

  // Check if there's enough in holding
  if (amount > this.holdingSupply) {
    throw new Error(`Not enough MyPts in holding. Requested: ${amount}, Available: ${this.holdingSupply}`);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const totalSupplyBefore = this.totalSupply;
    const circulatingSupplyBefore = this.circulatingSupply;
    const reserveSupplyBefore = this.reserveSupply;
    const holdingSupplyBefore = this.holdingSupply;

    // Update the hub document
    this.circulatingSupply += amount;
    this.holdingSupply -= amount;
    this.lastAdjustment = new Date();
    await this.save({ session });

    // Create log entry
    const logId = await createSupplyLog(
      this as MyPtsHubDocument,
      MyPtsSupplyAction.HOLDING_TO_CIRCULATION,
      amount,
      reason,
      totalSupplyBefore,
      circulatingSupplyBefore,
      reserveSupplyBefore,
      adminId,
      metadata,
      transactionId,
      holdingSupplyBefore
    );

    await session.commitTransaction();
    return { success: true, logId };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Move MyPts from holding to reserve
 */
myPtsHubSchema.methods.moveFromHoldingToReserve = async function(
  amount: number,
  reason: string,
  adminId?: mongoose.Types.ObjectId,
  metadata?: Record<string, any>,
  transactionId?: mongoose.Types.ObjectId
): Promise<{ success: boolean; logId?: mongoose.Types.ObjectId }> {
  // Validate the amount
  if (amount <= 0) {
    throw new Error('Amount must be greater than zero');
  }

  // Check if there's enough in holding
  if (amount > this.holdingSupply) {
    throw new Error(`Not enough MyPts in holding. Requested: ${amount}, Available: ${this.holdingSupply}`);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const totalSupplyBefore = this.totalSupply;
    const circulatingSupplyBefore = this.circulatingSupply;
    const reserveSupplyBefore = this.reserveSupply;
    const holdingSupplyBefore = this.holdingSupply;

    // Update the hub document
    this.reserveSupply += amount;
    this.holdingSupply -= amount;
    this.lastAdjustment = new Date();
    await this.save({ session });

    // Create log entry
    const logId = await createSupplyLog(
      this as MyPtsHubDocument,
      MyPtsSupplyAction.HOLDING_TO_RESERVE,
      amount,
      reason,
      totalSupplyBefore,
      circulatingSupplyBefore,
      reserveSupplyBefore,
      adminId,
      metadata,
      transactionId,
      holdingSupplyBefore
    );

    await session.commitTransaction();
    return { success: true, logId };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Adjust the maximum supply
 */
myPtsHubSchema.methods.adjustMaxSupply = async function(
  newMaxSupply: number | null,
  reason: string,
  adminId?: mongoose.Types.ObjectId
): Promise<boolean> {
  // Validate the new max supply
  if (newMaxSupply !== null) {
    if (newMaxSupply < 0) {
      throw new Error('Maximum supply cannot be negative');
    }

    if (newMaxSupply < this.totalSupply) {
      throw new Error(`New maximum supply (${newMaxSupply}) cannot be less than current total supply (${this.totalSupply})`);
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const totalSupplyBefore = this.totalSupply;
    const circulatingSupplyBefore = this.circulatingSupply;
    const reserveSupplyBefore = this.reserveSupply;
    const oldMaxSupply = this.maxSupply;

    // Update the hub document
    this.maxSupply = newMaxSupply;
    this.lastAdjustment = new Date();
    await this.save({ session });

    // Create log entry
    await createSupplyLog(
         this  as MyPtsHubDocument,
      MyPtsSupplyAction.ADJUST_MAX_SUPPLY,
      newMaxSupply || 0,
      reason,
      totalSupplyBefore,
      circulatingSupplyBefore,
      reserveSupplyBefore,
      adminId,
      { oldMaxSupply, newMaxSupply }
    );

    await session.commitTransaction();
    return true;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Update the value per MyPt
 */
myPtsHubSchema.methods.updateValuePerMyPt = async function(newValue: number): Promise<boolean> {
  if (newValue <= 0) {
    throw new Error('Value per MyPt must be greater than zero');
  }

  this.valuePerMyPt = newValue;
  await this.save();
  return true;
};

/**
 * Static method to get the hub (singleton)
 * Always returns the latest document from the database
 */
myPtsHubSchema.statics.getHub = async function(): Promise<MyPtsHubDocument> {
  try {
    // Always get the latest document from the database
    let hub = await this.findOne().sort({ updatedAt: -1 });

    if (!hub) {
      logger.info('No MyPtsHub document found, creating a new one');
      hub = await this.create({
        totalSupply: 1000000000,  // 1 billion total supply
        circulatingSupply: 0,     // No MyPts in circulation initially
        reserveSupply: 0,         // No MyPts in reserve initially
        holdingSupply: 150000000, // 15% of total supply in holding
        maxSupply: null,
        valuePerMyPt: 0.024,
        lastAdjustment: new Date()
      });
      logger.info('Created new MyPtsHub document', { hubId: hub._id.toString() });
    } else {
      logger.debug('Found existing MyPtsHub document', { hubId: hub._id.toString() });
    }

    return hub;
  } catch (error) {
    logger.error('Error getting MyPtsHub document', { error });
    throw error;
  }
};

/**
 * Static method to get supply logs with filtering and pagination
 */
myPtsHubSchema.statics.getLogs = async function(
  filter: {
    action?: MyPtsSupplyAction;
    startDate?: Date;
    endDate?: Date;
    adminId?: mongoose.Types.ObjectId;
  } = {},
  pagination: {
    limit?: number;
    offset?: number;
    sort?: Record<string, 1 | -1>;
  } = {}
): Promise<{ logs: IMyPtsHubLog[]; total: number; }> {
  const query: any = {};

  if (filter.action) {
    query.action = filter.action;
  }

  if (filter.adminId) {
    query.adminId = filter.adminId;
  }

  if (filter.startDate || filter.endDate) {
    query.createdAt = {};

    if (filter.startDate) {
      query.createdAt.$gte = filter.startDate;
    }

    if (filter.endDate) {
      query.createdAt.$lte = filter.endDate;
    }
  }

  const limit = pagination.limit || 20;
  const offset = pagination.offset || 0;
  const sort = pagination.sort || { createdAt: -1 };

  const [logs, total] = await Promise.all([
    MyPtsHubLogModel.find(query)
      .sort(sort)
      .skip(offset)
      .limit(limit),
    MyPtsHubLogModel.countDocuments(query)
  ]);

  return { logs, total };
};

// Define interface for model type
export interface IMyPtsHubModel extends Model<IMyPtsHub, {}, IMyPtsHubMethods> {
  getHub(): Promise<MyPtsHubDocument>;
  getLogs(
    filter?: {
      action?: MyPtsSupplyAction;
      startDate?: Date;
      endDate?: Date;
      adminId?: mongoose.Types.ObjectId;
    },
    pagination?: {
      limit?: number;
      offset?: number;
      sort?: Record<string, 1 | -1>;
    }
  ): Promise<{ logs: IMyPtsHubLog[]; total: number; }>;
}

// Create and export the models
export const MyPtsHubModel = mongoose.model<IMyPtsHub, IMyPtsHubModel>('MyPtsHub', myPtsHubSchema);
export const MyPtsHubLogModel = mongoose.model<IMyPtsHubLog>('MyPtsHubLog', myPtsHubLogSchema);
