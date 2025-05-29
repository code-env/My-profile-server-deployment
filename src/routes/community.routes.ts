import express from 'express';
import { protect } from '../middleware/auth.middleware';
import { CommunityController } from '../controllers/community.controller';

const router = express.Router();

router.get('/:id/share-link', protect, CommunityController.getShareLink);
router.post('/:id/invite-group', protect, CommunityController.inviteExistingGroup);
router.post('/invitations/:invitationId/respond', protect, CommunityController.respondToGroupInvitation);
router.post('/invitations/:invitationId/cancel', protect, CommunityController.cancelGroupInvitation);
router.post('/:id/broadcast', protect, CommunityController.broadcastWithinCommunity);
router.post('/:id/report', protect, CommunityController.reportCommunity);
router.post('/:id/exit', protect, CommunityController.exitCommunity);

// Settings routes
router.get('/:id/settings', protect, CommunityController.getCommunitySettings);
router.get('/:id/with-settings', protect, CommunityController.getCommunityWithSettings);
router.put('/:id/settings', protect, CommunityController.updateCommunitySettings);
router.put('/:id/settings/notifications', protect, CommunityController.updateCommunityNotificationSettings);
router.put('/:id/settings/privacy', protect, CommunityController.updateCommunityPrivacySettings);
router.get('/:id/settings/moderation', protect, CommunityController.getCommunityModerationSettings);
router.put('/:id/settings/moderation', protect, CommunityController.updateCommunityModerationSettings);
router.put('/:id/settings/specific', protect, CommunityController.updateCommunitySpecificSetting);
router.get('/:id/settings/specific/:key', protect, CommunityController.getCommunitySpecificSetting);

router.put('/:id/chat', protect, CommunityController.setCommunityChatId);
router.get('/:id/export', protect, CommunityController.exportProfileList);
router.get('/export', protect, CommunityController.exportAllCommunities);

export default router; 

//being a leader 