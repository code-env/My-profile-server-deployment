import { ProfileModel } from '../models/profile.model';
import mongoose from 'mongoose';
import createHttpError from 'http-errors';
import { NotificationService } from './notification.service';
import { CommunityGroupInvitation, ICommunityGroupInvitation } from '../models/community-group-invitation.model';
import ExcelJS from 'exceljs';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { stringify } from 'csv-stringify/sync';

const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'https://your-frontend.com';

export class CommunityService {

  async getShareLink(id: string) {
    const profile = await ProfileModel.findById(id);
    if (!profile || profile.profileType !== 'community') {
      throw createHttpError(404, 'Community not found');
    }
    return { link: profile.profileInformation.profileLink };
  }

  private generateJoinLink(invitationId: string) {
    return `${FRONTEND_BASE_URL}/community/invitations/${invitationId}/respond`;
  }

  async inviteExistingGroup(communityId: string, groupId: string, invitedBy: string, message?: string) {
    // Check if invitation already exists
    const existing = await CommunityGroupInvitation.findOne({ communityId, groupId });
    if (existing) {
      if (existing.status === 'pending') {
        throw createHttpError(409, 'An invitation is already pending for this group.');
      }
      if (existing.status === 'accepted') {
        throw createHttpError(409, 'This group is already a member of the community.');
      }
      if (existing.status === 'rejected') {
        // Optionally allow re-inviting after rejection, or throw error
        throw createHttpError(409, 'This group has already rejected the invitation.');
      }
      if (existing.status === 'cancelled') {
        // Reuse the cancelled invitation: set to pending, update invitedBy, clear respondedAt/message
        existing.status = 'pending';
        existing.invitedBy = new mongoose.Types.ObjectId(invitedBy);
        existing.createdAt = new Date();
        existing.respondedAt = undefined;
        existing.responseMessage = undefined;
        await existing.save();
        const joinLink = this.generateJoinLink(existing.id);
        // Send notification to group admin
        const groupProfile = await ProfileModel.findById(groupId);
        if (groupProfile) {
          const notificationService = new NotificationService();
          await notificationService.createNotification({
            recipient: groupProfile.profileInformation.creator,
            type: 'community_group_invitation_request',
            title: 'Community Invitation',
            message: message || `You have been invited to join a community.`,
            relatedTo: { model: 'Profile', id: communityId },
            link: joinLink,
          });
        }
        return { ...existing.toObject(), joinLink };
      }
    }
    // Create invitation
    const invitation = await CommunityGroupInvitation.create({
      communityId,
      groupId,
      invitedBy,
      status: 'pending',
    });
    // Generate join link
    const joinLink = this.generateJoinLink(invitation.id);
    // Send notification to group admin (assuming group profileInformation.creator is the admin)
    const groupProfile = await ProfileModel.findById(groupId);
    if (groupProfile) {
      const notificationService = new NotificationService();
      await notificationService.createNotification({
        recipient: groupProfile.profileInformation.creator,
        type: 'community_group_invitation_request',
        title: 'Community Invitation',
        message: message || `You have been invited to join a community.`,
        relatedTo: { model: 'Profile', id: communityId },
        link: joinLink,
      });
      // Optionally, send an email here using your email service
      // await emailService.sendGroupInvite({ to: groupProfile.email, joinLink, ... });
    }
    return { ...invitation.toObject(), joinLink };
  }

  async respondToGroupInvitation(invitationId: string, responderId: string, accept: boolean, responseMessage?: string) {
    const invitation = await CommunityGroupInvitation.findById(invitationId);
    if (!invitation) throw createHttpError(404, 'Invitation not found');
    if (invitation.status !== 'pending') throw createHttpError(400, 'Invitation already responded to');
    // Only group admin can respond
    const groupProfile = await ProfileModel.findById(invitation.groupId);
    if (!groupProfile) throw createHttpError(404, 'Group not found');
    if (groupProfile.profileInformation.creator.toString() !== responderId) {
      throw createHttpError(403, 'Only the group admin can respond to the invitation');
    }
    invitation.status = accept ? 'accepted' : 'rejected';
    invitation.respondedAt = new Date();
    invitation.responseMessage = responseMessage;
    await invitation.save();
    if (accept) {
      // Add group to community
      await ProfileModel.findByIdAndUpdate(invitation.communityId, {
        $addToSet: { groups: invitation.groupId },
      });
    }
    // Notify inviter
    const notificationService = new NotificationService();
    await notificationService.createNotification({
      recipient: invitation.invitedBy,
      type: 'community_group_invitation_response',
      title: 'Invitation Response',
      message: accept ? 'Invitation accepted.' : 'Invitation rejected.',
      relatedTo: { model: 'CommunityGroupInvitation', id: invitation._id },
    });
    return invitation;
  }

  async getPendingInvitationsForCommunity(communityId: string) {
    return CommunityGroupInvitation.find({ communityId, status: 'pending' });
  }

  async getPendingInvitationsForGroup(groupId: string) {
    return CommunityGroupInvitation.find({ groupId, status: 'pending' });
  }

  async broadcastWithinCommunity(communityId: string, message: string) {
    const profile = await ProfileModel.findById(communityId);
    if (!profile) throw createHttpError(404, 'Community not found');
    if (!profile.members || profile.members.length === 0) {
      throw createHttpError(400, 'No members to broadcast to');
    }

    // Send notification to all members
    const notificationService = new NotificationService();
    await Promise.all(
      profile.members.map(memberId =>
        notificationService.createNotification({
          recipient: memberId,
          type: 'community_broadcast',
          title: 'Community Announcement',
          message,
          relatedTo: { model: 'Profile', id: communityId }
        })
      )
    );

    // Store the broadcast in a section for history
    let section = profile.sections.find(s => s.key === 'broadcasts');
    if (!section) {
      section = {
        key: 'broadcasts',
        label: 'Broadcasts',
        order: profile.sections.length,
        fields: []
      };
      profile.sections.push(section);
    }
    section.fields.push({
      key: `broadcast_${Date.now()}`,
      label: 'Broadcast Message',
      widget: 'textarea',
      value: message,
      enabled: true
    });
    await profile.save();

    return { broadcasted: true, recipients: profile.members.length };
  }

  async reportCommunity(communityId: string, reason: string, details?: string, profileId?: string) {
    if (!profileId || !mongoose.Types.ObjectId.isValid(profileId)) {
      throw createHttpError(400, 'Invalid profileId');
    }
    const community = await ProfileModel.findById(communityId);
    if (!community) throw createHttpError(404, 'Community not found');
    // Check if profileId is a member or group in the community
    const isMember = community.members?.some((m: any) => m.toString() === profileId);
    const isGroup = community.groups?.some((g: any) => g.toString() === profileId);
    if (!isMember && !isGroup) {
      throw createHttpError(403, 'Profile is not a member or group of this community');
    }
    let section = community.sections.find(s => s.key === 'reports');
    if (!section) {
      section = {
        key: 'reports',
        label: 'Reports',
        order: community.sections.length,
        fields: []
      };
      community.sections.push(section);
    }
    section.fields.push({
      key: `report_${Date.now()}`,
      label: 'Report',
      widget: 'textarea',
      value: { reason, details, reportedAt: new Date(), reportedBy: profileId },
      enabled: true
    });
    await community.save();
    // send notification to community admin
    const notificationService = new NotificationService();
    await notificationService.createNotification({
      recipient: community.profileInformation.creator,
      type: 'community_report',
      title: 'Community Report',
      message: `A report has been made on the community by profile ${profileId}.`,
      relatedTo: { model: 'Profile', id: communityId },
    });
    return { reported: true };
  }

  async exitCommunity(communityId: string, profileId: string) {
    const community = await ProfileModel.findById(communityId);
    if (!community) throw createHttpError(404, 'Community not found');
    const isMember = community.members?.some((m: any) => m.toString() === profileId);
    const isGroup = community.groups?.some((g: any) => g.toString() === profileId);
    if (!isMember && !isGroup) {
      throw createHttpError(400, 'Profile is not a member or group of this community');
    }
    const update: any = {};
    if (isMember) update.$pull = { members: new mongoose.Types.ObjectId(profileId) };
    if (isGroup) update.$pull = { groups: new mongoose.Types.ObjectId(profileId) };
    const updated = await ProfileModel.findByIdAndUpdate(
      communityId,
      update,
      { new: true }
    );
    return updated;
  }

  async getCommunitySettings(communityId: string) {
    const profile = await ProfileModel.findById(communityId);
    if (!profile) throw createHttpError(404, 'Community not found');
    let section = profile.sections.find(s => s.key === 'settings');
    if (!section) {
      section = {
        key: 'settings',
        label: 'Settings',
        order: profile.sections.length,
        fields: []
      };
      profile.sections.push(section);
      await profile.save();
    }
    return section;
  }

  async updateCommunitySettings(communityId: string, updates: any) {
    const profile = await ProfileModel.findById(communityId);
    if (!profile) throw createHttpError(404, 'Community not found');
    let section = profile.sections.find(s => s.key === 'settings');
    if (!section) {
      section = {
        key: 'settings',
        label: 'Settings',
        order: profile.sections.length,
        fields: []
      };
      profile.sections.push(section);
    }
    Object.entries(updates).forEach(([key, value]) => {
      let field = section!.fields.find((f: any) => f.key === key);
      if (!field) {
        field = {
          key,
          label: key.charAt(0).toUpperCase() + key.slice(1),
          widget: 'text',
          value,
          enabled: true
        };
        section!.fields.push(field);
      } else {
        field.value = value;
      }
    });
    await profile.save();
    return section;
  }

  async setCommunityChatId(communityId: string, chatId: string) {
    const profile = await ProfileModel.findById(communityId);
    if (!profile) throw createHttpError(404, 'Community not found');
    let section = profile.sections.find(s => s.key === 'settings');
    if (!section) {
      section = {
        key: 'settings',
        label: 'Settings',
        order: profile.sections.length,
        fields: []
      };
      profile.sections.push(section);
    }
    let field = section.fields.find((f: any) => f.key === 'chatId');
    if (!field) {
      field = {
        key: 'chatId',
        label: 'Chat ID',
        widget: 'text',
        value: chatId,
        enabled: true
      };
      section.fields.push(field);
    } else {
      field.value = chatId;
    }
    await profile.save();
    return { chatId };
  }

  async addInvitation(communityId: string, { groupId, message }: { groupId: string, message?: string }) {
    const community = await ProfileModel.findById(communityId);
    if (!community) throw createHttpError(404, 'Community not found');
    let section = community.sections.find(s => s.key === 'invitations');
    if (!section) {
      section = {
        key: 'invitations',
        label: 'Invitations',
        order: community.sections.length,
        fields: []
      };
      community.sections.push(section);
    }
    section.fields.push({
      key: `invitation_${Date.now()}`,
      label: 'Invitation',
      widget: 'text',
      value: { groupId, message, invitedAt: new Date() },
      enabled: true
    });
    await community.save();
    // Send notification to the group profile (not user)
    const notificationService = new NotificationService();
    await notificationService.createNotification({
      recipient: groupId,
      type: 'community_group_invitation_request',
      title: 'Community Invitation',
      message: message || 'You have been invited to join a community',
      relatedTo: { model: 'Profile', id: communityId }
    });
    return { invited: true };
  }

  async addDiscussion(communityId: string, { title, content, author }: { title: string, content: string, author: string }) {
    const profile = await ProfileModel.findById(communityId);
    if (!profile) throw createHttpError(404, 'Community not found');
    let section = profile.sections.find(s => s.key === 'discussions');
    if (!section) {
      section = {
        key: 'discussions',
        label: 'Discussions',
        order: profile.sections.length,
        fields: []
      };
      profile.sections.push(section);
    }
    section.fields.push({
      key: `discussion_${Date.now()}`,
      label: title,
      widget: 'textarea',
      value: { title, content, author, createdAt: new Date() },
      enabled: true
    });
    await profile.save();
    return { discussionAdded: true };
  }

  async addAnnouncement(communityId: string, { title, content, author }: { title: string, content: string, author: string }) {
    const profile = await ProfileModel.findById(communityId);
    if (!profile) throw createHttpError(404, 'Community not found');
    let section = profile.sections.find(s => s.key === 'announcements');
    if (!section) {
      section = {
        key: 'announcements',
        label: 'Announcements',
        order: profile.sections.length,
        fields: []
      };
      profile.sections.push(section);
    }
    section.fields.push({
      key: `announcement_${Date.now()}`,
      label: title,
      widget: 'textarea',
      value: { title, content, author, createdAt: new Date() },
      enabled: true
    });
    await profile.save();
    // Broadcast the announcement as a notification to all members
    if (profile.members && profile.members.length > 0) {
      try {
        const notificationService = new NotificationService();
        await Promise.all(
          profile.members.map(memberId =>
          notificationService.createNotification({
            recipient: memberId,
            type: 'community_announcement',
            title,
            message: content,
            relatedTo: { model: 'Profile', id: communityId }
          })
          )
        );
      } catch (error) {
        // 
        console.error('Error sending notification:', error);
      }
    }
    return { announcementAdded: true };
  }

  async addMember(groupId: string, userId: string) {
    const updated = await ProfileModel.findByIdAndUpdate(
      groupId,
      { $addToSet: { members: new mongoose.Types.ObjectId(userId) } },
      { new: true }
    );
    if (!updated) throw createHttpError(404, 'Group not found');
    return updated;
  }

  async addSubGroup(communityId: string, groupId: string) {
    const updated = await ProfileModel.findByIdAndUpdate(
      communityId,
      { $addToSet: { groups: new mongoose.Types.ObjectId(groupId) } },
      { new: true }
    );
    if (!updated) throw createHttpError(404, 'Community not found');
    return updated;
  }

  async addGroup(communityId: string, groupId: string) {
    // Only add an existing groupId to the community's groups array
    const updated = await ProfileModel.findByIdAndUpdate(
      communityId,
      { $addToSet: { groups: new mongoose.Types.ObjectId(groupId) } },
      { new: true }
    );
    if (!updated) throw createHttpError(404, 'Community not found');
    return updated;
  }

  async cancelGroupInvitation(invitationId: string, userId: string) {
    const invitation = await CommunityGroupInvitation.findById(invitationId);
    if (!invitation) throw createHttpError(404, 'Invitation not found');
    if (invitation.status !== 'pending' && invitation.status !== 'cancelled') throw createHttpError(400, 'Only pending or cancelled invitations can be cancelled');
    if (invitation.invitedBy.toString() != userId) throw createHttpError(403, 'Only the inviter can cancel this invitation');
    invitation.status = 'cancelled';
    invitation.respondedAt = new Date();
    await invitation.save();
    // Notify group admin
    const groupProfile = await ProfileModel.findById(invitation.groupId);
    if (groupProfile) {
      try {
        const notificationService = new NotificationService();
        await notificationService.createNotification({
          recipient: groupProfile.profileInformation.creator,
          type: 'community_group_invitation_cancelled',
          title: 'Community Invitation Cancelled',
          message: 'The invitation to join the community has been cancelled.',
          relatedTo: { model: 'CommunityGroupInvitation', id: invitation._id },
        });
      } catch (error) {
        // set the status back to pending
        invitation.status = 'pending';
        await invitation.save();
        console.error('Error sending notification:', error);
      }
    }
    return invitation;
  }

  async exportProfileList(communityId: string, format: string) {
    const community = await ProfileModel.findById(communityId)
      .populate('members', 'profileInformation.username profileInformation.title profileInformation.email')
      .populate('groups', 'profileInformation.username profileInformation.title profileInformation.email');
    if (!community) throw createHttpError(404, 'Community not found');
    // Example: collect all member and group profiles
    const profiles = [
      ...(community.members || []),
      ...(community.groups || [])
    ].map((p: any) => ({
      username: p.profileInformation?.username,
      title: p.profileInformation?.title,
      email: p.profileInformation?.email || '',
      id: p._id?.toString()
    }));
    let fileBuffer: Buffer, fileName: string, mimeType: string;
    switch (format) {
      case 'xlsx': {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Profiles');
        sheet.addRow(['Username', 'Title', 'Email', 'ID']);
        profiles.forEach(p => sheet.addRow([p.username, p.title, p.email, p.id]));
        fileBuffer = await workbook.xlsx.writeBuffer() as Buffer;
        fileName = 'profiles.xlsx';
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      }
      case 'csv': {
        const csv = stringify(profiles, { header: true, columns: ['username', 'title', 'email', 'id'] });
        fileBuffer = Buffer.from(csv, 'utf-8');
        fileName = 'profiles.csv';
        mimeType = 'text/csv';
        break;
      }
      case 'docx': {
        const doc = new Document({
          sections: [{
            children: [
              new Paragraph({
                children: [new TextRun('Profile List')],
              }),
              ...profiles.map(p => new Paragraph(`${p.username} | ${p.title} | ${p.email} | ${p.id}`)),
            ],
          }],
        });
        fileBuffer = await Packer.toBuffer(doc);
        fileName = 'profiles.docx';
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      }
      case 'pptx': {
        // Placeholder: PPTXGenJS is browser-oriented, so use a placeholder buffer for now
        fileBuffer = Buffer.from('PPTX export not implemented in Node.js', 'utf-8');
        fileName = 'profiles.pptx';
        mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        break;
      }
      case 'rtf': {
        // Placeholder: rtf.js is not for Node.js, so use a simple RTF string
        const rtfContent = `{
  \\rtf1\\ansi\\deff0
  {\\fonttbl{\\f0 Courier;}}
  \\f0\\fs20 Profile List\\par
  ${profiles.map(p => `${p.username} | ${p.title} | ${p.email} | ${p.id}\\par`).join('\n  ')}
}`;
        fileBuffer = Buffer.from(rtfContent, 'utf-8');
        fileName = 'profiles.rtf';
        mimeType = 'application/rtf';
        break;
      }
      default:
        throw createHttpError(400, 'Unsupported export format');
    }
    return { fileBuffer, fileName, mimeType };
  }

  async exportAllCommunities(format: string) {
    const communities = await ProfileModel.find({ profileType: 'community' })
      .populate('profileInformation.creator', 'fullName email')
      .populate('members', '_id')
      .populate('groups', '_id');
    const rows = communities.map((c: any) => ({
      name: c.profileInformation?.title || c.profileInformation?.username,
      id: c._id?.toString(),
      creator: c.profileInformation?.creator?.fullName || '',
      creatorEmail: c.profileInformation?.creator?.email || '',
      createdAt: c.profileInformation?.createdAt?.toISOString() || '',
      memberCount: c.members?.length || 0,
      groupCount: c.groups?.length || 0
    }));
    let fileBuffer: Buffer, fileName: string, mimeType: string;
    switch (format) {
      case 'xlsx': {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Communities');
        sheet.addRow(['Name', 'ID', 'Creator', 'Creator Email', 'Created At', 'Member Count', 'Group Count']);
        rows.forEach(r => sheet.addRow([r.name, r.id, r.creator, r.creatorEmail, r.createdAt, r.memberCount, r.groupCount]));
        fileBuffer = await workbook.xlsx.writeBuffer() as Buffer;
        fileName = 'communities.xlsx';
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      }
      case 'csv': {
        const csv = stringify(rows, { header: true, columns: ['name', 'id', 'creator', 'creatorEmail', 'createdAt', 'memberCount', 'groupCount'] });
        fileBuffer = Buffer.from(csv, 'utf-8');
        fileName = 'communities.csv';
        mimeType = 'text/csv';
        break;
      }
      case 'docx': {
        const doc = new Document({
          sections: [{
            children: [
              new Paragraph({
                children: [new TextRun('Community List')],
              }),
              ...rows.map(r => new Paragraph(`${r.name} | ${r.id} | ${r.creator} | ${r.creatorEmail} | ${r.createdAt} | ${r.memberCount} | ${r.groupCount}`)),
            ],
          }],
        });
        fileBuffer = await Packer.toBuffer(doc);
        fileName = 'communities.docx';
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      }
      case 'pptx': {
        fileBuffer = Buffer.from('PPTX export not implemented in Node.js', 'utf-8');
        fileName = 'communities.pptx';
        mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        break;
      }
      case 'rtf': {
        const rtfContent = `{
  \rtf1\ansi\deff0
  {\fonttbl{\f0 Courier;}}
  \f0\fs20 Community List\par
  ${rows.map(r => `${r.name} | ${r.id} | ${r.creator} | ${r.creatorEmail} | ${r.createdAt} | ${r.memberCount} | ${r.groupCount}\par`).join('\n  ')}
}`;
        fileBuffer = Buffer.from(rtfContent, 'utf-8');
        fileName = 'communities.rtf';
        mimeType = 'application/rtf';
        break;
      }
      default:
        throw createHttpError(400, 'Unsupported export format');
    }
    return { fileBuffer, fileName, mimeType };
  }
} 