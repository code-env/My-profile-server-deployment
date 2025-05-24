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
router.get('/:id/settings', protect, CommunityController.getCommunitySettings);
router.put('/:id/settings', protect, CommunityController.updateCommunitySettings);
router.put('/:id/chat', protect, CommunityController.setCommunityChatId);
router.get('/:id/export', protect, CommunityController.exportProfileList);
router.get('/export', protect, CommunityController.exportAllCommunities);

export default router; 

//being a leader 