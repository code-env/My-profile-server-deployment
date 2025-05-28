# Community/Group Activity Payload Examples

## Add Invitation
```json
POST /api/communities/:id/invitations
{
  "groupId": "<group_profile_id>",
  "message": "We'd love your group to join our community!"
}
```

## Add Discussion
```json
POST /api/communities/:id/discussions
{
  "title": "How can we improve engagement?",
  "content": "Share your ideas for boosting participation in our events.",
  "author": "<user_id>"
}
```

## Add Announcement
```json
POST /api/communities/:id/announcements
{
  "title": "Upcoming Meetup",
  "content": "Join us for our next community meetup on Friday!",
  "author": "<user_id>"
}
```


## Add Member (to group)
```json
POST /api/groups/:id/members
{
  "userId": "<user_id>"
}
```

## Add Sub Group (to community)
```json
POST /api/communities/:id/subgroups
{
  "groupId": "<group_profile_id>"
}
```

## Add Group (to community)
```json
POST /api/communities/:id/groups
{
  "groupId": "<group_profile_id>"
}
```

## Community Group Invitation Endpoints

### Invite Group to Community
**POST** `/api/communities/:id/invite-group`

Invite a group to join a community. Only community admins can invite.

**Request Body:**
```json
{
  "groupId": "<groupProfileId>",
  "message": "Optional invitation message"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "<invitationId>",
    "communityId": "<communityId>",
    "groupId": "<groupId>",
    "invitedBy": "<userId>",
    "status": "pending",
    "createdAt": "...",
    "joinLink": "https://your-frontend.com/community/invitations/<invitationId>/respond"
  }
}
```

---

### Respond to Group Invitation
**POST** `/api/communities/invitations/:invitationId/respond`

Accept or reject a group invitation. Only the group admin can respond.

**Request Body:**
```json
{
  "accept": true,
  "responseMessage": "Optional message"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "<invitationId>",
    "status": "accepted",
    ...
  }
}
```

---

### Cancel Group Invitation
**POST** `/api/communities/invitations/:invitationId/cancel`

Cancel a pending group invitation. Only the inviter can cancel.

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "<invitationId>",
    "status": "cancelled",
    ...
  }
}
```

---

## Report Community

**POST** `/api/communities/:id/report`

Report a community for abuse, spam, or other issues. Only members can report.

**Request Body:**
```json
{
  "reason": "Spam or inappropriate content",
  "details": "This community is posting spam links.",
  "profileId": "<your_profile_id>"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reported": true
  }
}
```

---

## Other Community Endpoints (for reference)

- **POST** `/api/communities/:id/exit` — Exit a community (removes the user from members).
- **GET** `/api/communities/:id/settings` — Get community settings.
- **PUT** `/api/communities/:id/settings` — Update community settings.
- **PUT** `/api/communities/:id/chat` — Set the community chat ID.

--- 