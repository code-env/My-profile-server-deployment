# API Endpoints Documentation

## Events

### Create Event
```http
POST /api/events
```

**Payload:**
```json
{
  "title": "string",
  "description": "string",
  "startTime": "date",
  "endTime": "date",
  "isAllDay": "boolean",
  "eventType": "meeting | celebration | appointment | booking",
  "status": "upcoming | in-progress | completed | cancelled",
  "priority": "Low | Medium | High | Urgent",
  "visibility": "Public | Private | Shared",
  "category": "string",
  "color": "string",
  "location": {
    "name": "string",
    "address": "string",
    "coordinates": {
      "lat": "number",
      "lng": "number"
    },
    "online": "boolean",
    "meetingUrl": "string"
  },
  "participants": [{
    "profile": "ObjectId",
    "role": "attendee | organizer | speaker",
    "status": "pending | accepted | declined | maybe"
  }],
  "attachments": [{
    "fileType": "string",
    "url": "string",
    "name": "string"
  }],
  "agendaItems": [{
    "description": "string",
    "assignedTo": "ObjectId",
    "completed": "boolean"
  }],
  "isGroupEvent": "boolean",
  "duration": {
    "hours": "number",
    "minutes": "number"
  },
  "repeat": {
    "isRepeating": "boolean",
    "frequency": "None | Daily | Weekdays | Weekends | Weekly | BiWeekly | Monthly | Yearly | Custom",
    "interval": "number",
    "endCondition": "Never | UntilDate | AfterOccurrences",
    "endDate": "date",
    "occurrences": "number"
  },
  "reminders": [{
    "type": "None | AtEventTime | Minutes15 | Minutes30 | Hours1 | Hours2 | Days1 | Days2 | Weeks1 | Custom",
    "amount": "number",
    "unit": "Minutes | Hours | Days | Weeks",
    "customEmail": "string"
  }],
  "maxAttendees": "number"
}
```

### Get Event by ID
```http
GET /api/events/:eventId
```

### Get User Events
```http
GET /api/events/user
```

### Update Event
```http
PATCH /api/events/:eventId
```
**Payload:** Same as Create Event (all fields optional)

### Delete Event
```http
DELETE /api/events/:eventId
```

## Reminders

### Add Reminder
```http
POST /api/events/:eventId/reminders
```

**Payload:**
```json
{
  "type": "None | AtEventTime | Minutes15 | Minutes30 | Hours1 | Hours2 | Days1 | Days2 | Weeks1 | Custom",
  "amount": "number",
  "unit": "Minutes | Hours | Days | Weeks",
  "customEmail": "string",
  "message": "string",
  "recipients": ["string"]
}
```

**Notes:**
- `type` must be one of: None, AtEventTime, Minutes15, Minutes30, Hours1, Hours2, Days1, Days2, Weeks1, Custom
- `amount` must be a positive number (min: 1)
- `unit` must be one of: Minutes, Hours, Days, Weeks
- `customEmail` is optional
- `message` is optional
- `recipients` is optional array of recipient IDs

### Get Event Reminders
```http
GET /api/events/:eventId/reminders
```

### Delete Reminder
```http
DELETE /api/events/:eventId/reminders/:reminderIndex
```

### Cancel All Reminders
```http
POST /api/events/:eventId/reminders/cancel
```

### Process Due Reminders (Internal)
```http
POST /api/events/process
```

## Participants

### Add Participants
```http
POST /api/events/:eventId/participants
```

**Payload:**
```json
{
  "profileIds": ["ObjectId"],
  "role": "attendee | organizer | speaker"
}
```

### Get Event Participants
```http
GET /api/events/:eventId/participants
```

**Query Parameters:**
- `status`: "pending | accepted | declined | maybe"
- `role`: "attendee | organizer | speaker"

### Update Participant Status
```http
PATCH /api/events/:eventId/participants/:profileId/status
```

**Payload:**
```json
{
  "status": "pending | accepted | declined | maybe"
}
```

### Update Participant Role
```http
PATCH /api/events/:eventId/participants/:profileId/role
```

**Payload:**
```json
{
  "role": "attendee | organizer | speaker"
}
```

### Remove Participant
```http
DELETE /api/events/:eventId/participants/:profileId
```

## Tasks

### Create Task
```http
POST /api/tasks
```

**Payload:**
```json
{
  "title": "string",
  "description": "string",
  "type": "string",
  "subTasks": [{
    "description": "string",
    "isCompleted": "boolean"
  }],
  "startTime": "date",
  "endTime": "date",
  "scheduledTime": "date",
  "isAllDay": "boolean",
  "duration": {
    "hours": "number",
    "minutes": "number"
  },
  "repeat": {
    "isRepeating": "boolean",
    "frequency": "None | Daily | Weekdays | Weekends | Weekly | BiWeekly | Monthly | Yearly | Custom",
    "interval": "number",
    "endCondition": "Never | UntilDate | AfterOccurrences",
    "endDate": "date",
    "occurrences": "number"
  },
  "reminders": [{
    "type": "None | AtEventTime | Minutes15 | Minutes30 | Hours1 | Hours2 | Days1 | Days2 | Weeks1 | Custom",
    "amount": "number",
    "unit": "Minutes | Hours | Days | Weeks",
    "customEmail": "string"
  }],
  "visibility": "Public | Private | Shared",
  "participants": ["ObjectId"],
  "reward": {
    "type": "Reward | Punishment",
    "points": "number",
    "currency": "string",
    "description": "string"
  },
  "color": "string",
  "category": "Personal | Work | Health | Education | Other",
  "priority": "Low | Medium | High | Urgent",
  "status": "Upcoming | InProgress | Completed | Cancelled",
  "notes": "string",
  "attachments": [{
    "fileType": "string",
    "url": "string",
    "name": "string"
  }],
  "location": {
    "name": "string",
    "address": "string",
    "coordinates": {
      "lat": "number",
      "lng": "number"
    }
  }
}
```

### Get Task by ID
```http
GET /api/tasks/:taskId
```

### Get User Tasks
```http
GET /api/tasks/user
```

### Update Task
```http
PATCH /api/tasks/:taskId
```
**Payload:** Same as Create Task (all fields optional)

### Delete Task
```http
DELETE /api/tasks/:taskId
```

## Common Response Format

All endpoints return responses in the following format:

```json
{
  "success": "boolean",
  "data": "object | array",
  "message": "string"
}
```

## Error Response Format

```json
{
  "success": "boolean",
  "error": {
    "message": "string",
    "code": "string",
    "details": "object"
  }
}
```

## Authentication

All endpoints require authentication. Include the JWT token in the Authorization header:

```http
Authorization: Bearer <token>
``` 