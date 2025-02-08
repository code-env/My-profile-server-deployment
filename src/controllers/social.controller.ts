import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import createHttpError from 'http-errors';
import { SocialService } from '../services/social.service';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

const socialService = new SocialService();

// Connection Controllers

// @desc    Send connection request
// @route   POST /api/social/connections/request
// @access  Private
export const sendConnectionRequest = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  const { recipientId, message } = req.body;

  if (user._id.toString() === recipientId) {
    throw createHttpError(400, 'Cannot connect with yourself');
  }

  const connection = await socialService.sendConnectionRequest(
    user._id,
    recipientId,
    message
  );

  res.status(201).json(connection);
});

// @desc    Respond to connection request
// @route   PUT /api/social/connections/:id/respond
// @access  Private
export const respondToConnection = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  const { id } = req.params;
  const { accept } = req.body;

  if (typeof accept !== 'boolean') {
    throw createHttpError(400, 'Accept parameter must be a boolean');
  }

  const connection = await socialService.respondToConnectionRequest(
    user._id,
    new mongoose.Types.ObjectId(id),
    accept
  );
  res.json(connection);
});

// @desc    Get user connections
// @route   GET /api/social/connections
// @access  Private
export const getConnections = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  const { status, page, limit } = req.query;

  const result = await socialService.getConnections(
    user._id,
    status ? (status as string).split(',') : undefined,
    Number(page) || 1,
    Number(limit) || 10
  );

  res.json(result);
});

// Endorsement Controllers

// @desc    Create endorsement
// @route   POST /api/social/endorsements
// @access  Private
export const createEndorsement = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  const { recipientId, skill, level, relationship, comment } = req.body;

  if (user._id.toString() === recipientId) {
    throw createHttpError(400, 'Cannot endorse yourself');
  }

  if (!['beginner', 'intermediate', 'expert'].includes(level)) {
    throw createHttpError(400, 'Invalid skill level');
  }

  const endorsement = await socialService.createEndorsement(
    user._id,
    recipientId,
    {
      skill,
      level,
      relationship,
      comment,
    }
  );

  res.status(201).json(endorsement);
});

// @desc    Get user endorsements
// @route   GET /api/social/endorsements
// @access  Private
export const getEndorsements = asyncHandler(async (req: Request, res: Response) => {
  const user: any = req.user!;
  const { skill, level, page, limit } = req.query;

  const result = await socialService.getEndorsements(user._id, {
    skill: skill as string,
    level: level as string,
    page: Number(page) || 1,
    limit: Number(limit) || 10,
  });

  res.json(result);
});

// @desc    Get user's received endorsements
// @route   GET /api/social/endorsements/:userId
// @access  Private
export const getUserEndorsements = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { skill, level, page, limit } = req.query;

  const result = await socialService.getEndorsements(new mongoose.Types.ObjectId(userId), {
    skill: skill as string,
    level: level as string,
    page: Number(page) || 1,
    limit: Number(limit) || 10,
  });

  res.json(result);
});
