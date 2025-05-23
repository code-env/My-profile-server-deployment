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