import mongoose from 'mongoose';
import {
  MyPtsHubModel,
  MyPtsHubDocument,
  MyPtsSupplyAction,
  IMyPtsHubLog
} from '../models/my-pts-hub.model';
import { MyPtsModel } from '../models/my-pts.model';
import { MyPtsValueModel } from '../models/my-pts-value.model';
import { logger } from '../utils/logger';

/**
 * Service class for MyPts Hub operations
 * Follows the Singleton pattern for global state management
 */
class MyPtsHubService {
  private static instance: MyPtsHubService;
  private hub: MyPtsHubDocument | null = null;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): MyPtsHubService {
    if (!MyPtsHubService.instance) {
      MyPtsHubService.instance = new MyPtsHubService();
    }
    return MyPtsHubService.instance;
  }

  /**
   * Initialize the service
   * Loads the hub document and ensures it exists
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        this.hub = await MyPtsHubModel.getHub();

        // Verify the hub data is consistent with the actual MyPts in the system
        await this.verifySystemConsistency();

        this.initialized = true;
        logger.info('MyPtsHubService initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize MyPtsHubService', { error });
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Verify that the hub data is consistent with the actual MyPts in the system
   */
  private async verifySystemConsistency(): Promise<void> {
    try {
      // Calculate the actual circulating supply by summing all profile balances
      const result = await MyPtsModel.aggregate([
        { $group: { _id: null, totalCirculating: { $sum: "$balance" } } }
      ]);

      const actualCirculating = result[0]?.totalCirculating || 0;

      // If there's a discrepancy, log it but don't automatically correct it
      // This requires admin intervention to resolve
      if (this.hub && actualCirculating !== this.hub.circulatingSupply) {
        logger.warn('MyPts system inconsistency detected', {
          hubCirculatingSupply: this.hub.circulatingSupply,
          actualCirculatingSupply: actualCirculating,
          difference: this.hub.circulatingSupply - actualCirculating
        });
      }
    } catch (error) {
      logger.error('Error verifying MyPts system consistency', { error });
      // Don't throw - this is a verification step that shouldn't block initialization
    }
  }

  /**
   * Get the current hub state
   */
  public async getHubState(): Promise<MyPtsHubDocument> {
    await this.ensureInitialized();
    return this.hub!;
  }

  /**
   * Issue new MyPts
   */
  public async issueMyPts(
    amount: number,
    reason: string,
    adminId?: mongoose.Types.ObjectId,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    await this.ensureInitialized();

    const result = await this.hub!.issueMyPts(amount, reason, adminId, metadata);

    // Update the MyPtsValue model with the new total supply
    await this.updateMyPtsValueModel();

    return result;
  }

  /**
   * Burn existing MyPts
   */
  public async burnMyPts(
    amount: number,
    reason: string,
    adminId?: mongoose.Types.ObjectId,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    await this.ensureInitialized();

    const result = await this.hub!.burnMyPts(amount, reason, adminId, metadata);

    // Update the MyPtsValue model with the new total supply
    await this.updateMyPtsValueModel();

    return result;
  }

  /**
   * Move MyPts from reserve to circulation
   */
  public async moveToCirculation(
    amount: number,
    reason: string,
    adminId?: mongoose.Types.ObjectId,
    metadata?: Record<string, any>,
    transactionId?: mongoose.Types.ObjectId
  ): Promise<{ success: boolean; logId?: mongoose.Types.ObjectId }> {
    await this.ensureInitialized();
    return this.hub!.moveToCirculation(amount, reason, adminId, metadata, transactionId);
  }

  /**
   * Move MyPts from circulation to reserve
   */
  public async moveToReserve(
    amount: number,
    reason: string,
    adminId?: mongoose.Types.ObjectId,
    metadata?: Record<string, any>,
    transactionId?: mongoose.Types.ObjectId
  ): Promise<{ success: boolean; logId?: mongoose.Types.ObjectId }> {
    await this.ensureInitialized();
    return this.hub!.moveToReserve(amount, reason, adminId, metadata, transactionId);
  }

  /**
   * Adjust the maximum supply
   */
  public async adjustMaxSupply(
    newMaxSupply: number | null,
    reason: string,
    adminId?: mongoose.Types.ObjectId
  ): Promise<boolean> {
    await this.ensureInitialized();
    return this.hub!.adjustMaxSupply(newMaxSupply, reason, adminId);
  }

  /**
   * Update the value per MyPt
   */
  public async updateValuePerMyPt(newValue: number): Promise<boolean> {
    await this.ensureInitialized();

    const result = await this.hub!.updateValuePerMyPt(newValue);

    // Update the MyPtsValue model with the new value
    await this.updateMyPtsValueModel();

    return result;
  }

  /**
   * Get supply logs with filtering and pagination
   */
  public async getLogs(
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
    await this.ensureInitialized();
    return MyPtsHubModel.getLogs(filter, pagination);
  }

  /**
   * Calculate the actual circulating supply by summing all profile balances
   */
  public async calculateActualCirculatingSupply(): Promise<number> {
    const result = await MyPtsModel.aggregate([
      { $group: { _id: null, totalCirculating: { $sum: "$balance" } } }
    ]);

    return result[0]?.totalCirculating || 0;
  }

  /**
   * Reconcile the hub data with the actual MyPts in the system
   * This should only be called by admins after careful investigation
   */
  public async reconcileSupply(
    reason: string,
    adminId: mongoose.Types.ObjectId
  ): Promise<{
    success: boolean;
    previousCirculating: number;
    actualCirculating: number;
    difference: number;
  }> {
    await this.ensureInitialized();

    const actualCirculating = await this.calculateActualCirculatingSupply();
    const previousCirculating = this.hub!.circulatingSupply;
    const difference = actualCirculating - previousCirculating;

    if (difference === 0) {
      return {
        success: true,
        previousCirculating,
        actualCirculating,
        difference
      };
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (difference > 0) {
        // More MyPts in circulation than expected - issue more to match
        await this.hub!.issueMyPts(
          difference,
          `System reconciliation: ${reason}`,
          adminId,
          { reconciliation: true, previousCirculating, actualCirculating }
        );

        // Move the newly issued MyPts directly to circulation
        await this.hub!.moveToCirculation(
          difference,
          `System reconciliation: moving newly issued MyPts to circulation`,
          adminId,
          { reconciliation: true }
        );
      } else {
        // Fewer MyPts in circulation than expected - adjust the hub data
        await this.hub!.moveToReserve(
          Math.abs(difference),
          `System reconciliation: ${reason}`,
          adminId,
          { reconciliation: true, previousCirculating, actualCirculating }
        );
      }

      // Update the MyPtsValue model with the new total supply
      await this.updateMyPtsValueModel();

      await session.commitTransaction();

      return {
        success: true,
        previousCirculating,
        actualCirculating,
        difference
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to reconcile MyPts supply', {
        error,
        previousCirculating,
        actualCirculating,
        difference
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Update the MyPtsValue model with the current hub data
   */
  private async updateMyPtsValueModel(): Promise<void> {
    try {
      const currentValue = await MyPtsValueModel.getCurrentValue();

      // Update with the latest hub data
      currentValue.totalSupply = this.hub!.totalSupply;
      currentValue.baseValue = this.hub!.valuePerMyPt;
      currentValue.totalValueUSD = this.hub!.totalSupply * this.hub!.valuePerMyPt;

      await currentValue.save();
    } catch (error) {
      logger.error('Failed to update MyPtsValue model', { error });
      // Don't throw - this is a secondary operation that shouldn't block the main flow
    }
  }

  /**
   * Ensure the service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// Export the singleton instance
export const myPtsHubService = MyPtsHubService.getInstance();
