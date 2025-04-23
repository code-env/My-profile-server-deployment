import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { myPtsHubService } from '../services/my-pts-hub.service';
import { MyPtsSupplyAction } from '../models/my-pts-hub.model';
import { logger } from '../utils/logger';

/**
 * Get the current state of the MyPts Hub
 */
export const getHubState = async (req: Request, res: Response) => {
  try {
    const hub = await myPtsHubService.getHubState();

    return res.status(200).json({
      success: true,
      data: {
        totalSupply: hub.totalSupply,
        circulatingSupply: hub.circulatingSupply,
        reserveSupply: hub.reserveSupply,
        maxSupply: hub.maxSupply,
        valuePerMyPt: hub.valuePerMyPt,
        lastAdjustment: hub.lastAdjustment,
        updatedAt: hub.updatedAt
      }
    });
  } catch (error: any) {
    logger.error(`Error getting MyPts hub state: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to get MyPts hub state' });
  }
};

/**
 * Get MyPts supply logs with filtering and pagination
 */
export const getSupplyLogs = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any
    if (!user|| user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Parse filter parameters
    const filter: any = {};

    if (req.query.action && Object.values(MyPtsSupplyAction).includes(req.query.action as MyPtsSupplyAction)) {
      filter.action = req.query.action;
    }

    if (req.query.startDate) {
      filter.startDate = new Date(req.query.startDate as string);
    }

    if (req.query.endDate) {
      filter.endDate = new Date(req.query.endDate as string);
    }

    if (req.query.adminId && mongoose.Types.ObjectId.isValid(req.query.adminId as string)) {
      filter.adminId = new mongoose.Types.ObjectId(req.query.adminId as string);
    }

    // Parse pagination parameters
    const pagination: any = {};

    if (req.query.limit) {
      pagination.limit = parseInt(req.query.limit as string);
    }

    if (req.query.offset) {
      pagination.offset = parseInt(req.query.offset as string);
    }

    // Get logs
    const { logs, total } = await myPtsHubService.getLogs(filter, pagination);

    return res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          limit: pagination.limit || 20,
          offset: pagination.offset || 0,
          hasMore: (pagination.offset || 0) + logs.length < total
        }
      }
    });
  } catch (error: any) {
    logger.error(`Error getting MyPts supply logs: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to get MyPts supply logs' });
  }
};

/**
 * Issue new MyPts
 */
export const issueMyPts = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any
    if (!user|| user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { amount, reason, metadata } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
    }

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Reason is required' });
    }

    const adminId = new mongoose.Types.ObjectId(user._id);

    await myPtsHubService.issueMyPts(amount, reason, adminId, metadata);

    const hub = await myPtsHubService.getHubState();

    return res.status(200).json({
      success: true,
      data: {
        message: `Successfully issued ${amount} MyPts`,
        totalSupply: hub.totalSupply,
        reserveSupply: hub.reserveSupply,
        circulatingSupply: hub.circulatingSupply
      }
    });
  } catch (error: any) {
    logger.error(`Error issuing MyPts: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: `Failed to issue MyPts: ${error.message}` });
  }
};

/**
 * Move MyPts from reserve to circulation
 */
export const moveToCirculation = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any
    if (!user|| user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { amount, reason, metadata } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
    }

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Reason is required' });
    }

    const adminId = new mongoose.Types.ObjectId(user._id);

    await myPtsHubService.moveToCirculation(amount, reason, adminId, metadata);

    const hub = await myPtsHubService.getHubState();

    return res.status(200).json({
      success: true,
      data: {
        message: `Successfully moved ${amount} MyPts from reserve to circulation`,
        reserveSupply: hub.reserveSupply,
        circulatingSupply: hub.circulatingSupply
      }
    });
  } catch (error: any) {
    logger.error(`Error moving MyPts to circulation: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: `Failed to move MyPts to circulation: ${error.message}` });
  }
};

/**
 * Move MyPts from circulation to reserve
 */
export const moveToReserve = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any
    if (!user|| user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { amount, reason, metadata } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
    }

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Reason is required' });
    }

    const adminId = new mongoose.Types.ObjectId(user._id);

    await myPtsHubService.moveToReserve(amount, reason, adminId, metadata);

    const hub = await myPtsHubService.getHubState();

    return res.status(200).json({
      success: true,
      data: {
        message: `Successfully moved ${amount} MyPts from circulation to reserve`,
        reserveSupply: hub.reserveSupply,
        circulatingSupply: hub.circulatingSupply
      }
    });
  } catch (error: any) {
    logger.error(`Error moving MyPts to reserve: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: `Failed to move MyPts to reserve: ${error.message}` });
  }
};

/**
 * Adjust the maximum supply
 */
export const adjustMaxSupply = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any
    if (!user|| user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { maxSupply, reason } = req.body;

    // maxSupply can be null (unlimited) or a positive number
    if (maxSupply !== null && (!Number.isFinite(maxSupply) || maxSupply <= 0)) {
      return res.status(400).json({ success: false, message: 'Max supply must be null or a positive number' });
    }

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Reason is required' });
    }

    const adminId = new mongoose.Types.ObjectId(user._id);

    await myPtsHubService.adjustMaxSupply(maxSupply, reason, adminId);

    const hub = await myPtsHubService.getHubState();

    return res.status(200).json({
      success: true,
      data: {
        message: maxSupply === null
          ? 'Successfully removed maximum supply limit'
          : `Successfully set maximum supply to ${maxSupply} MyPts`,
        maxSupply: hub.maxSupply,
        totalSupply: hub.totalSupply
      }
    });
  } catch (error: any) {
    logger.error(`Error adjusting maximum supply: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: `Failed to adjust maximum supply: ${error.message}` });
  }
};

/**
 * Update the value per MyPt
 */
export const updateValuePerMyPt = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any
    if (!user|| user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { value } = req.body;

    if (!value || value <= 0) {
      return res.status(400).json({ success: false, message: 'Value must be greater than zero' });
    }

    await myPtsHubService.updateValuePerMyPt(value);

    const hub = await myPtsHubService.getHubState();

    return res.status(200).json({
      success: true,
      data: {
        message: `Successfully updated value per MyPt to $${value}`,
        valuePerMyPt: hub.valuePerMyPt,
        totalValueUSD: hub.totalSupply * hub.valuePerMyPt
      }
    });
  } catch (error: any) {
    logger.error(`Error updating value per MyPt: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: `Failed to update value per MyPt: ${error.message}` });
  }
};

/**
 * Verify system consistency
 */
export const verifySystemConsistency = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any
    if (!user|| user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const hub = await myPtsHubService.getHubState();
    const actualCirculating = await myPtsHubService.calculateActualCirculatingSupply();
    const difference = actualCirculating - hub.circulatingSupply;

    return res.status(200).json({
      success: true,
      data: {
        hubCirculatingSupply: hub.circulatingSupply,
        actualCirculatingSupply: actualCirculating,
        difference,
        isConsistent: difference === 0,
        message: difference === 0
          ? 'System is consistent'
          : `System inconsistency detected: ${Math.abs(difference)} MyPts ${difference > 0 ? 'excess' : 'missing'}`
      }
    });
  } catch (error: any) {
    logger.error(`Error verifying system consistency: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to verify system consistency' });
  }
};

/**
 * Reconcile system supply
 */
export const reconcileSupply = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any
    if (!user|| user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Reason is required' });
    }

    const adminId = new mongoose.Types.ObjectId(user._id);

    const result = await myPtsHubService.reconcileSupply(reason, adminId);

    return res.status(200).json({
      success: true,
      data: {
        message: `Successfully reconciled system supply`,
        previousCirculating: result.previousCirculating,
        actualCirculating: result.actualCirculating,
        difference: result.difference,
        action: result.difference > 0
          ? `Issued ${result.difference} MyPts to match actual circulation`
          : `Moved ${Math.abs(result.difference)} MyPts to reserve to match actual circulation`
      }
    });
  } catch (error: any) {
    logger.error(`Error reconciling system supply: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: `Failed to reconcile system supply: ${error.message}` });
  }
};
