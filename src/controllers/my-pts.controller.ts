import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { MyPtsModel, MyPtsTransactionModel } from '../models/my-pts.model';
import { ProfileModel } from '../models/profile.model';
import { TransactionType, TransactionStatus } from '../interfaces/my-pts.interface';
import { myPtsHubService } from '../services/my-pts-hub.service';
import { logger } from '../utils/logger';
import { IProfile } from '../interfaces/profile.interface';

/**
 * Get MyPts balance for the authenticated profile
 */
export const getMyPtsBalance = async (req: Request, res: Response) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ success: false, message: 'Profile not authenticated' });
    }

    const profile = req.profile as unknown as IProfile;
    const myPts = await profile.getMyPts();

    // Get currency from query parameter, default to USD
    const currency = req.query.currency as string || 'USD';

    // Get value information
    const valueInfo = await profile.getMyPtsValue(currency);

    return res.status(200).json({
      success: true,
      data: {
        balance: myPts.balance,
        lifetimeEarned: myPts.lifetimeEarned,
        lifetimeSpent: myPts.lifetimeSpent,
        lastTransaction: myPts.lastTransaction,
        value: {
          valuePerMyPt: valueInfo.valuePerPts,
          currency: valueInfo.currency,
          symbol: valueInfo.symbol,
          totalValue: valueInfo.totalValue,
          formattedValue: valueInfo.formattedValue
        }
      }
    });
  } catch (error: any) {
    logger.error(`Error getting MyPts balance: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to get MyPts balance' });
  }
};

/**
 * Get transaction history for the authenticated profile
 */
export const getTransactionHistory = async (req: Request, res: Response) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ success: false, message: 'Profile not authenticated' });
    }

    const profile = req.profile as unknown as IProfile;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    // Get transactions directly from the model
    const profileId = profile._id as unknown as mongoose.Types.ObjectId;
    const transactions = await MyPtsTransactionModel.find({ profileId: profileId.toString() })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);

    // Get total count for pagination
    const totalCount = await MyPtsTransactionModel.countDocuments({ profileId: profileId.toString() });

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + transactions.length < totalCount
        }
      }
    });
  } catch (error: any) {
    logger.error(`Error getting transaction history: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to get transaction history' });
  }
};

/**
 * Get transactions by type for the authenticated profile
 */
export const getTransactionsByType = async (req: Request, res: Response) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ success: false, message: 'Profile not authenticated' });
    }

    const profile = req.profile as unknown as IProfile;
    const { type } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    // Validate transaction type
    if (!Object.values(TransactionType).includes(type as TransactionType)) {
      return res.status(400).json({ success: false, message: 'Invalid transaction type' });
    }

    const profileId = (profile._id as unknown as mongoose.Types.ObjectId).toString();

    // Get transactions directly from the model
    const transactions = await MyPtsTransactionModel.find({
      profileId: profileId,
      type: type as TransactionType
    })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);

    // Get total count for pagination
    const totalCount = await MyPtsTransactionModel.countDocuments({
      profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(),
      type: type
    });

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + transactions.length < totalCount
        }
      }
    });
  } catch (error: any) {
    logger.error(`Error getting transactions by type: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to get transactions by type' });
  }
};

/**
 * Buy MyPts with real money (simulated)
 */
export const buyMyPts = async (req: Request, res: Response) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ success: false, message: 'Profile not authenticated' });
    }

    const profile = req.profile as unknown as IProfile;
    const { amount, paymentMethod, paymentId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    // In a real implementation, you would integrate with a payment processor here
    // For now, we'll simulate a successful payment

    // Get the hub and move MyPts from reserve to circulation
    const hub = await myPtsHubService.getHubState();

    // Check if there are enough MyPts in reserve
    if (hub.reserveSupply < amount) {
      // If not enough in reserve, issue more MyPts
      await myPtsHubService.issueMyPts(
        amount - hub.reserveSupply,
        `Automatic issuance for purchase by profile ${profile._id}`,
        undefined,
        { automatic: true, profileId: profile._id }
      );
    }

    const myPts = await profile.getMyPts();

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    let transactionRecord;

    try {
      // Update MyPts document
      myPts.balance += amount;
      myPts.lifetimeEarned += amount;
      myPts.lastTransaction = new Date();
      await myPts.save({ session });

      // Create transaction record first
      const transaction = await MyPtsTransactionModel.create([{
        profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(),
        type: TransactionType.BUY_MYPTS,
        amount,
        balance: myPts.balance,
        description: `Bought ${amount} MyPts`,
        metadata: { paymentMethod, paymentId },
        referenceId: paymentId
      }], { session });

      // Move MyPts from reserve to circulation and link with transaction
      const hubResult = await myPtsHubService.moveToCirculation(
        amount,
        `Purchase by profile ${profile._id}`,
        undefined,
        {
          profileId: profile._id,
          paymentMethod,
          paymentId
        },
        transaction[0]._id
      );

      // Update transaction with hub log ID if available
      if (hubResult.logId) {
        await MyPtsTransactionModel.findByIdAndUpdate(
          transaction[0]._id,
          { hubLogId: hubResult.logId },
          { session }
        );
      }

      // Update the profile's myPtsBalance for quick access
      await ProfileModel.findByIdAndUpdate(profile._id, {
        myPtsBalance: myPts.balance
      }, { session });

      await session.commitTransaction();

      // Store the transaction for the response
      transactionRecord = transaction[0];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    return res.status(200).json({
      success: true,
      data: {
        transaction: transactionRecord,
        newBalance: myPts.balance
      }
    });
  } catch (error: any) {
    logger.error(`Error buying MyPts: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to buy MyPts' });
  }
};

/**
 * Sell MyPts for real money (simulated)
 */
export const sellMyPts = async (req: Request, res: Response) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ success: false, message: 'Profile not authenticated' });
    }

    const profile = req.profile as unknown as IProfile;
    const { amount, paymentMethod, accountDetails } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    if (!paymentMethod || !accountDetails) {
      return res.status(400).json({ success: false, message: 'Payment information is required' });
    }

    // In a real implementation, you would integrate with a payment processor here
    // For now, we'll simulate a successful sale

    const myPts = await profile.getMyPts();

    if (myPts.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient MyPts balance' });
    }

    let transactionRecord;

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update MyPts document
      myPts.balance -= amount;
      myPts.lifetimeSpent += amount;
      myPts.lastTransaction = new Date();
      await myPts.save({ session });

      // Create transaction record
      const transaction = await MyPtsTransactionModel.create([
        {
          profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(),
          type: TransactionType.SELL_MYPTS,
          amount: -amount, // Negative amount for deductions
          balance: myPts.balance,
          description: `Sold ${amount} MyPts`,
          metadata: { paymentMethod, accountDetails }
        }
      ], { session });

      // Move MyPts from circulation to reserve and link with transaction
      const hubResult = await myPtsHubService.moveToReserve(
        amount,
        `Sale by profile ${profile._id}`,
        undefined,
        {
          profileId: profile._id,
          paymentMethod,
          accountDetails
        },
        transaction[0]._id
      );

      // Update transaction with hub log ID
      if (hubResult.logId) {
        await MyPtsTransactionModel.findByIdAndUpdate(
          transaction[0]._id,
          { hubLogId: hubResult.logId },
          { session }
        );
      }

      // Update the profile's myPtsBalance for quick access
      await ProfileModel.findByIdAndUpdate(profile._id, {
        myPtsBalance: myPts.balance
      }, { session });

      await session.commitTransaction();

      // Store the transaction for the response
      transactionRecord = transaction[0];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    return res.status(200).json({
      success: true,
      data: {
        transaction: transactionRecord,
        newBalance: myPts.balance
      }
    });
  } catch (error: any) {
    logger.error(`Error selling MyPts: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to sell MyPts' });
  }
};

/**
 * Purchase a product for another profile using MyPts
 */
export const purchaseProduct = async (req: Request, res: Response) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ success: false, message: 'Profile not authenticated' });
    }

    const profile = req.profile as unknown as IProfile;
    const { amount, toProfileId, productId, productName } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    if (!toProfileId) {
      return res.status(400).json({ success: false, message: 'Recipient profile ID is required' });
    }

    if (!productId || !productName) {
      return res.status(400).json({ success: false, message: 'Product information is required' });
    }

    // Validate recipient profile exists
    const recipientProfile = await ProfileModel.findById(toProfileId);
    if (!recipientProfile) {
      return res.status(404).json({ success: false, message: 'Recipient profile not found' });
    }

    // Check if sender and recipient are the same
    const profileId = (profile._id as unknown as mongoose.Types.ObjectId).toString();
    if (profileId === toProfileId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot purchase a product for yourself' });
    }

    const myPts = await profile.getMyPts();

    if (myPts.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient MyPts balance' });
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Deduct points from sender
      myPts.balance -= amount;
      myPts.lifetimeSpent += amount;
      myPts.lastTransaction = new Date();
      await myPts.save({ session });

      // Create sender transaction record
      const senderTransaction = await MyPtsTransactionModel.create([{
        profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(),
        type: TransactionType.PURCHASE_PRODUCT,
        amount: -amount,
        balance: myPts.balance,
        description: `Purchased product: ${productName} for profile: ${toProfileId} using ${amount} MyPts`,
        metadata: { productId, productName, recipientProfileId: toProfileId }
      }], { session });

      // Add points to receiver
      let receiverPoints = await MyPtsModel.findOne({ profileId: toProfileId });

      if (!receiverPoints) {
        // Create new MyPts document for receiver if it doesn't exist
        const newReceiverPoints = await MyPtsModel.create([{
          profileId: toProfileId,
          balance: amount,
          lifetimeEarned: amount,
          lastTransaction: new Date()
        }], { session });
        receiverPoints = newReceiverPoints[0]; // Extract from array when using create with session
      } else {
        // Update existing receiver points
        receiverPoints.balance += amount;
        receiverPoints.lifetimeEarned += amount;
        receiverPoints.lastTransaction = new Date();
        await receiverPoints.save({ session });
      }

      // Create receiver transaction record
      const receiverTransaction = await MyPtsTransactionModel.create([{
        profileId: toProfileId,
        type: TransactionType.RECEIVE_PRODUCT_PAYMENT,
        amount: amount,
        balance: receiverPoints?.balance || amount,
        description: `Received ${amount} MyPts payment for product: ${productName} from profile: ${(profile._id as unknown as mongoose.Types.ObjectId).toString()}`,
        metadata: { productId, productName, buyerProfileId: (profile._id as unknown as mongoose.Types.ObjectId).toString() },
        relatedTransaction: senderTransaction[0]._id // First item from array when using create with session
      }], { session });

      // Update sender transaction with related transaction
      await MyPtsTransactionModel.findByIdAndUpdate(
        senderTransaction[0]._id,
        { relatedTransaction: receiverTransaction[0]._id },
        { session }
      );

      // Update the profile's myPtsBalance for quick access
      await ProfileModel.findByIdAndUpdate(profile._id, {
        myPtsBalance: myPts.balance
      }, { session });

      // Update recipient's myPtsBalance for quick access
      await ProfileModel.findByIdAndUpdate(toProfileId, {
        myPtsBalance: receiverPoints?.balance || amount
      }, { session });

      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        data: {
          transaction: senderTransaction[0],
          newBalance: myPts.balance
        }
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error: any) {
    logger.error(`Error purchasing product: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to purchase product' });
  }
};

/**
 * Get all profile transactions (admin only)
 */
export const getAllProfileTransactions = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const {
      limit = 20,
      offset = 0,
      sort = 'desc',
      profileId,
      type,
      startDate,
      endDate
    } = req.query;

    // Build query
    const query: any = {};

    if (profileId) {
      query.profileId = profileId;
    }

    if (type) {
      query.type = type;
    }

    if (startDate || endDate) {
      query.createdAt = {};

      if (startDate) {
        query.createdAt.$gte = new Date(startDate as string);
      }

      if (endDate) {
        query.createdAt.$lte = new Date(endDate as string);
      }
    }

    // Get transactions
    const [transactions, total] = await Promise.all([
      MyPtsTransactionModel.find(query)
        .sort({ createdAt: sort === 'asc' ? 1 : -1 })
        .skip(Number(offset))
        .limit(Number(limit)),
      MyPtsTransactionModel.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + transactions.length < total
        }
      }
    });
  } catch (error: any) {
    logger.error(`Error getting all profile transactions: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to get all profile transactions' });
  }
};

/**
 * Award MyPts to a profile (admin only)
 */
export const awardMyPts = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { profileId, amount, reason } = req.body;

    if (!profileId || !mongoose.Types.ObjectId.isValid(profileId)) {
      return res.status(400).json({ success: false, message: 'Valid profile ID is required' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    // Validate profile exists
    const profile = await ProfileModel.findById(profileId);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Get the hub and check reserve
    const hub = await myPtsHubService.getHubState();

    // Check if we need to issue new MyPts
    if (hub.reserveSupply < amount) {
      // Issue new MyPts to cover the amount
      await myPtsHubService.issueMyPts(
        amount - hub.reserveSupply,
        `Automatic issuance for admin award to profile ${profileId}`,
        new mongoose.Types.ObjectId(user._id),
        { automatic: true, profileId, reason }
      );
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    let transactionRecord;

    try {
      // Get or create MyPts for the profile
      const myPts = await MyPtsModel.findOrCreate(mongoose.Types.ObjectId.createFromHexString(profileId.toString()));

      // Update MyPts document
      myPts.balance += amount;
      myPts.lifetimeEarned += amount;
      myPts.lastTransaction = new Date();
      await myPts.save({ session });

      // Create transaction record first
      const transaction = await MyPtsTransactionModel.create([{
        profileId,
        type: TransactionType.ADJUSTMENT,
        amount,
        balance: myPts.balance,
        description: reason || `Admin award: ${amount} MyPts`,
        metadata: { adminId: user._id }
      }], { session });

      transactionRecord = transaction[0];

      // Move MyPts from reserve to circulation and link with transaction
      const hubResult = await myPtsHubService.moveToCirculation(
        amount,
        `Admin award to profile ${profileId}`,
        new mongoose.Types.ObjectId(user._id),
        {
          profileId,
          reason: reason || `Admin award: ${amount} MyPts`
        },
        transaction[0]._id
      );

      // Update transaction with hub log ID if available
      if (hubResult.logId) {
        await MyPtsTransactionModel.findByIdAndUpdate(
          transaction[0]._id,
          { hubLogId: hubResult.logId },
          { session }
        );
      }

      // Update the profile's myPtsBalance for quick access
      await ProfileModel.findByIdAndUpdate(profileId, {
        myPtsBalance: myPts.balance
      }, { session });

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    return res.status(200).json({
      success: true,
      data: {
        transaction: transactionRecord,
        newBalance: transactionRecord.balance
      }
    });
  } catch (error: any) {
    logger.error(`Error awarding MyPts: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to award MyPts' });
  }
};

/**
 * Make a donation to another profile
 */
export const donateMyPts = async (req: Request, res: Response) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ success: false, message: 'Profile not authenticated' });
    }

    const profile = req.profile as unknown as IProfile;
    const { amount, toProfileId, message } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    if (!toProfileId) {
      return res.status(400).json({ success: false, message: 'Recipient profile ID is required' });
    }

    // Validate recipient profile exists
    const recipientProfile = await ProfileModel.findById(toProfileId);
    if (!recipientProfile) {
      return res.status(404).json({ success: false, message: 'Recipient profile not found' });
    }

    // Check if sender and recipient are the same
    const profileId = (profile._id as unknown as mongoose.Types.ObjectId).toString();
    if (profileId === toProfileId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot donate MyPts to yourself' });
    }

    const myPts = await profile.getMyPts();

    if (myPts.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient MyPts balance' });
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Deduct points from sender
      myPts.balance -= amount;
      myPts.lifetimeSpent += amount;
      myPts.lastTransaction = new Date();
      await myPts.save({ session });

      // Create sender transaction record
      const senderTransaction = await MyPtsTransactionModel.create([{
        profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(),
        type: TransactionType.DONATION_SENT,
        amount: -amount,
        balance: myPts.balance,
        description: `Donated ${amount} MyPts to profile: ${toProfileId}${message ? ` - ${message}` : ''}`
      }], { session });

      // Add points to receiver
      let receiverPoints = await MyPtsModel.findOne({ profileId: toProfileId });

      if (!receiverPoints) {
        // Create new MyPts document for receiver if it doesn't exist
        const newReceiverPoints = await MyPtsModel.create([{
          profileId: toProfileId,
          balance: amount,
          lifetimeEarned: amount,
          lastTransaction: new Date()
        }], { session });
        receiverPoints = newReceiverPoints[0]; // Extract from array when using create with session
      } else {
        // Update existing receiver points
        receiverPoints.balance += amount;
        receiverPoints.lifetimeEarned += amount;
        receiverPoints.lastTransaction = new Date();
        await receiverPoints.save({ session });
      }

      // Create receiver transaction record
      const receiverTransaction = await MyPtsTransactionModel.create([{
        profileId: toProfileId,
        type: TransactionType.DONATION_RECEIVED,
        amount: amount,
        balance: receiverPoints?.balance || amount,
        description: `Received ${amount} MyPts donation from profile: ${(profile._id as unknown as mongoose.Types.ObjectId).toString()}${message ? ` - ${message}` : ''}`,
        relatedTransaction: senderTransaction[0]._id // First item from array when using create with session
      }], { session });

      // Update sender transaction with related transaction
      await MyPtsTransactionModel.findByIdAndUpdate(
        senderTransaction[0]._id,
        { relatedTransaction: receiverTransaction[0]._id },
        { session }
      );

      // Update the profile's myPtsBalance for quick access
      await ProfileModel.findByIdAndUpdate(profile._id, {
        myPtsBalance: myPts.balance
      }, { session });

      // Update recipient's myPtsBalance for quick access
      await ProfileModel.findByIdAndUpdate(toProfileId, {
        myPtsBalance: receiverPoints?.balance || amount
      }, { session });

      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        data: {
          transaction: senderTransaction[0],
          newBalance: myPts.balance
        }
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } catch (error: any) {
    logger.error(`Error donating MyPts: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to donate MyPts' });
  }
};

/**
 * Withdraw MyPts back to reserve
 */
export const withdrawMyPts = async (req: Request, res: Response) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ success: false, message: 'Profile not authenticated' });
    }

    const profile = req.profile as unknown as IProfile;
    const { amount, reason } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const myPts = await profile.getMyPts();

    if (myPts.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient MyPts balance' });
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    let transactionRecord;

    try {
      // Update MyPts document
      myPts.balance -= amount;
      myPts.lifetimeSpent += amount;
      myPts.lastTransaction = new Date();
      await myPts.save({ session });

      // Create transaction record first
      const transaction = await MyPtsTransactionModel.create([{
        profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(),
        type: TransactionType.WITHDRAW_MYPTS,
        amount: -amount, // Negative amount for deductions
        balance: myPts.balance,
        description: `Withdrew ${amount} MyPts to reserve${reason ? `: ${reason}` : ''}`,
        status: TransactionStatus.COMPLETED,
        metadata: { reason }
      }], { session });

      // Move MyPts from circulation to reserve and link with transaction
      const hubResult = await myPtsHubService.moveToReserve(
        amount,
        `Withdrawal by profile ${profile._id}: ${reason || 'No reason provided'}`,
        undefined,
        {
          profileId: profile._id,
          reason
        },
        transaction[0]._id
      );

      // Update transaction with hub log ID if available
      if (hubResult.logId) {
        await MyPtsTransactionModel.findByIdAndUpdate(
          transaction[0]._id,
          { hubLogId: hubResult.logId },
          { session }
        );
      }

      // Update the profile's myPtsBalance for quick access
      await ProfileModel.findByIdAndUpdate(profile._id, {
        myPtsBalance: myPts.balance
      }, { session });

      await session.commitTransaction();

      // Store the transaction for the response
      transactionRecord = transaction[0];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    return res.status(200).json({
      success: true,
      data: {
        transaction: transactionRecord,
        newBalance: myPts.balance
      }
    });
  } catch (error: any) {
    logger.error(`Error withdrawing MyPts: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to withdraw MyPts' });
  }
};

/**
 * Earn MyPts through activities
 */
/**
 * Get MyPts statistics for admin
 */
export const getMyPtsStats = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    // Get current hub state
    const hub = await myPtsHubService.getHubState();

    // Get total MyPts awarded by admins
    const totalAwarded = await MyPtsTransactionModel.aggregate([
      { $match: { type: TransactionType.ADJUSTMENT, amount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get total MyPts purchased (bought with real money)
    const totalPurchased = await MyPtsTransactionModel.aggregate([
      { $match: { type: TransactionType.BUY_MYPTS } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get total MyPts sold (exchanged for real money)
    const totalSold = await MyPtsTransactionModel.aggregate([
      { $match: { type: TransactionType.SELL_MYPTS } },
      { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
    ]);

    // Get total MyPts earned through activities
    const totalEarned = await MyPtsTransactionModel.aggregate([
      { $match: { type: TransactionType.EARN_MYPTS } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get total MyPts in circulation (sum of all profile balances)
    const totalInCirculation = await MyPtsModel.aggregate([
      { $group: { _id: null, total: { $sum: '$balance' } } }
    ]);

    // Get transaction counts by type
    const transactionCounts = await MyPtsTransactionModel.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    // Format transaction counts as an object
    const transactionCountsByType: Record<string, number> = {};
    transactionCounts.forEach((item: any) => {
      transactionCountsByType[item._id] = item.count;
    });

    // Get monthly transaction totals for the last 12 months
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const monthlyStats = await MyPtsTransactionModel.aggregate([
      {
        $match: {
          createdAt: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            type: '$type'
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Format monthly stats
    const formattedMonthlyStats = [];
    for (let i = 0; i < 12; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth() + 1;

      const monthData: {
        year: number;
        month: number;
        label: string;
        transactions: Record<string, { total: number; count: number }>;
      } = {
        year,
        month,
        label: targetDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
        transactions: {}
      };

      // Find stats for this month
      monthlyStats.forEach((stat: any) => {
        if (stat._id.year === year && stat._id.month === month) {
          monthData.transactions[stat._id.type as string] = {
            total: stat.total,
            count: stat.count
          };
        }
      });

      formattedMonthlyStats.push(monthData);
    }

    return res.status(200).json({
      success: true,
      data: {
        hubState: {
          totalSupply: hub.totalSupply,
          circulatingSupply: hub.circulatingSupply,
          reserveSupply: hub.reserveSupply,
          maxSupply: hub.maxSupply,
          valuePerMyPt: hub.valuePerMyPt
        },
        totalAwarded: totalAwarded.length > 0 ? totalAwarded[0].total : 0,
        totalPurchased: totalPurchased.length > 0 ? totalPurchased[0].total : 0,
        totalSold: totalSold.length > 0 ? totalSold[0].total : 0,
        totalEarned: totalEarned.length > 0 ? totalEarned[0].total : 0,
        totalInCirculation: totalInCirculation.length > 0 ? totalInCirculation[0].total : 0,
        transactionCountsByType,
        monthlyStats: formattedMonthlyStats.reverse() // Most recent first
      }
    });
  } catch (error: any) {
    logger.error(`Error getting MyPts statistics: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to get MyPts statistics' });
  }
};

export const earnMyPts = async (req: Request, res: Response) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ success: false, message: 'Profile not authenticated' });
    }

    const profile = req.profile as unknown as IProfile;
    const { activityType, referenceId } = req.body;

    if (!activityType) {
      return res.status(400).json({ success: false, message: 'Activity type is required' });
    }

    // Define MyPts earned for different activities
    const pointsMap: Record<string, number> = {
      'profile_completion': 50,
      'daily_login': 10,
      'post_creation': 5,
      'comment': 2,
      'share': 3,
      'referral': 100,
      'connection_accepted': 15
    };

    const amount = pointsMap[activityType] || 0;

    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid activity type' });
    }

    const myPts = await profile.getMyPts();

    // Check if this activity has already been rewarded (for unique activities)
    if (referenceId && ['profile_completion', 'referral'].includes(activityType)) {
      const existingTransaction = await MyPtsTransactionModel.findOne({
        profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(),
        type: TransactionType.EARN_MYPTS,
        'metadata.activityType': activityType,
        'metadata.referenceId': referenceId
      });

      if (existingTransaction) {
        return res.status(400).json({
          success: false,
          message: 'MyPts already awarded for this activity'
        });
      }
    }

    // Get the hub and check reserve
    const hub = await myPtsHubService.getHubState();

    // Check if we need to issue new MyPts
    if (hub.reserveSupply < amount) {
      // Issue new MyPts to cover the amount
      await myPtsHubService.issueMyPts(
        amount,
        `Automatic issuance for activity: ${activityType}`,
        undefined,
        { automatic: true, activityType, referenceId }
      );
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    let transactionRecord;

    try {
      // Update MyPts document
      myPts.balance += amount;
      myPts.lifetimeEarned += amount;
      myPts.lastTransaction = new Date();
      await myPts.save({ session });

      // Create transaction record first
      const transaction = await MyPtsTransactionModel.create([{
        profileId: (profile._id as unknown as mongoose.Types.ObjectId).toString(),
        type: TransactionType.EARN_MYPTS,
        amount,
        balance: myPts.balance,
        description: `Earned ${amount} MyPts for ${activityType.replace('_', ' ')}`,
        metadata: { activityType, referenceId }
      }], { session });

      // Move MyPts from reserve to circulation and link with transaction
      const hubResult = await myPtsHubService.moveToCirculation(
        amount,
        `Earned through activity: ${activityType}`,
        undefined,
        { activityType, referenceId },
        transaction[0]._id
      );

      // Update transaction with hub log ID if available
      if (hubResult.logId) {
        await MyPtsTransactionModel.findByIdAndUpdate(
          transaction[0]._id,
          { hubLogId: hubResult.logId },
          { session }
        );
      }

      // Update the profile's myPtsBalance for quick access
      await ProfileModel.findByIdAndUpdate(profile._id, {
        myPtsBalance: myPts.balance
      }, { session });

      await session.commitTransaction();

      // Store the transaction for the response
      transactionRecord = transaction[0];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    return res.status(200).json({
      success: true,
      data: {
        transaction: transactionRecord,
        newBalance: myPts.balance,
        myPtsEarned: amount
      }
    });
  } catch (error: any) {
    logger.error(`Error earning MyPts: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to earn MyPts' });
  }
};
