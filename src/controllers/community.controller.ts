import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import createHttpError from "http-errors";
import { isValidObjectId } from "mongoose";
import { CommunityService } from "../services/community.service";

const communityService = new CommunityService();

export class CommunityController {
  static getShareLink = asyncHandler(async (req: Request, res: Response) => {
    const user: any = req.user;
    if (!user || !user._id) throw createHttpError(401, "Not authenticated");
    const { id } = req.params;
    if (!isValidObjectId(id))
      throw createHttpError(400, "Invalid community ID");
    const link = await communityService.getShareLink(id);
    res.json({ success: true, data: link });
  });

  static inviteExistingGroup = asyncHandler(
    async (req: Request, res: Response) => {
      const user: any = req.user;
      if (!user || !user._id) throw createHttpError(401, "Not authenticated");
      const { id } = req.params;
      const { groupId, message } = req.body;
      if (!isValidObjectId(id) || !isValidObjectId(groupId))
        throw createHttpError(400, "Invalid ID");
      const invitation = await communityService.inviteExistingGroup(id, groupId, user._id, message);
      res.json({ success: true, data: invitation });
    }
  );

  static respondToGroupInvitation = asyncHandler(
    async (req: Request, res: Response) => {
      const user: any = req.user;
      if (!user || !user._id) throw createHttpError(401, "Not authenticated");
      const { invitationId } = req.params;
      const { accept, responseMessage } = req.body;
      if (typeof accept !== 'boolean') throw createHttpError(400, 'accept must be boolean');
      const result = await communityService.respondToGroupInvitation(invitationId, user._id, accept, responseMessage);
      res.json({ success: true, data: result });
    }
  );

  static cancelGroupInvitation = asyncHandler(
    async (req: Request, res: Response) => {
      const user: any = req.user;
      if (!user || !user._id) throw createHttpError(401, "Not authenticated");
      const { invitationId } = req.params;
      const result = await communityService.cancelGroupInvitation(invitationId, user._id);
      res.json({ success: true, data: result });
    }
  );

  static broadcastWithinCommunity = asyncHandler(
    async (req: Request, res: Response) => {
      const user: any = req.user;
      if (!user || !user._id) throw createHttpError(401, "Not authenticated");
      const { id } = req.params;
      const { message } = req.body;
      if (!isValidObjectId(id))
        throw createHttpError(400, "Invalid community ID");
      const result = await communityService.broadcastWithinCommunity(
        id,
        message
      );
      res.json({ success: true, data: result });
    }
  );

  static reportCommunity = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason, details, profileId } = req.body;
    if (!profileId || !isValidObjectId(profileId)) throw createHttpError(400, "Invalid profileId");
    if (!isValidObjectId(id)) throw createHttpError(400, "Invalid community ID");
    const result = await communityService.reportCommunity(id, reason, details, profileId);
    res.json({ success: true, data: result });
  });

  static exitCommunity = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { profileId } = req.body;
    if (!profileId || !isValidObjectId(profileId)) throw createHttpError(400, "Invalid profileId");
    if (!isValidObjectId(id)) throw createHttpError(400, "Invalid community ID");
    const updated = await communityService.exitCommunity(id, profileId);
    res.json({ success: true, data: updated });
  });

  static getCommunitySettings = asyncHandler(
    async (req: Request, res: Response) => {
      const user: any = req.user;
      if (!user || !user._id) throw createHttpError(401, "Not authenticated");
      const { id } = req.params;
      if (!isValidObjectId(id))
        throw createHttpError(400, "Invalid community ID");
      const settings = await communityService.getCommunitySettings(id);
      res.json({ success: true, data: settings });
    }
  );

  static updateCommunitySettings = asyncHandler(
    async (req: Request, res: Response) => {
      const user: any = req.user;
      if (!user || !user._id) throw createHttpError(401, "Not authenticated");
      const { id } = req.params;
      const updates = req.body;
      if (!isValidObjectId(id))
        throw createHttpError(400, "Invalid community ID");
      const updated = await communityService.updateCommunitySettings(
        id,
        updates
      );
      res.json({ success: true, data: updated });
    }
  );

  static setCommunityChatId = asyncHandler(
    async (req: Request, res: Response) => {
      const user: any = req.user;
      if (!user || !user._id) throw createHttpError(401, "Not authenticated");
      const { id } = req.params;
      const { chatId } = req.body;
      if (!isValidObjectId(id) || !chatId)
        throw createHttpError(400, "Invalid input");
      const updated = await communityService.setCommunityChatId(id, chatId);
      res.json({ success: true, data: updated });
    }
  );

  static exportProfileList = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { format = 'csv' } = req.query;
    if (!isValidObjectId(id)) throw createHttpError(400, "Invalid community ID");
    const allowedFormats = ['docx', 'xlsx', 'pptx', 'csv', 'rtf'];
    if (!allowedFormats.includes(format as string)) {
      throw createHttpError(400, `Invalid format. Allowed: ${allowedFormats.join(', ')}`);
    }
    // Optionally: check if user is authorized (member/admin)
    // const user: any = req.user;
    // ...authorization logic...
    const { fileBuffer, fileName, mimeType } = await communityService.exportProfileList(id, format as string);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', mimeType);
    res.send(fileBuffer);
  });

  static exportAllCommunities = asyncHandler(async (req: Request, res: Response) => {
    const { format = 'csv' } = req.query;
    const allowedFormats = ['docx', 'xlsx', 'pptx', 'csv', 'rtf'];
    if (!allowedFormats.includes(format as string)) {
      throw createHttpError(400, `Invalid format. Allowed: ${allowedFormats.join(', ')}`);
    }
    // Optionally: check if user is admin
    // const user: any = req.user;
    // ...authorization logic...
    const { fileBuffer, fileName, mimeType } = await communityService.exportAllCommunities(format as string);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', mimeType);
    res.send(fileBuffer);
  });
}
