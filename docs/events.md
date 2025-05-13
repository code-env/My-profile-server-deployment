# Events API Documentation

## Event Types and Interfaces

### Base Event Interface
```typescript
interface IEvent {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  eventType: EventType;
  createdBy: ObjectId;
  profile: ObjectId;
  status: EventStatus;
  priority: PriorityLevel;
  visibility: VisibilityType;
  category?: string;
  color?: string;
  location?: Location;
  attachments: Attachment[];
  comments: Comment[];
  agendaItems: AgendaItem[];
  participants: ObjectId[];
  likes: ObjectId[];
  repeat?: RepeatSettings;
  reminders: Reminder[];
  isGroupEvent: boolean;
  duration?: {
    hours: number;
    minutes: number;
  };
}
```

### Event Types
```typescript
enum EventType {
  Meeting = 'meeting',
  Celebration = 'celebration',
  Appointment = 'appointment',
  Booking = 'booking'
}
```

### Event Status
```typescript
enum EventStatus {
  Upcoming = 'upcoming',
  InProgress = 'in-progress',
  Completed = 'completed',
  Cancelled = 'cancelled'
}
```

### Priority Levels
```typescript
enum PriorityLevel {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Urgent = 'Urgent'
}
```

### Visibility Types
```typescript
enum VisibilityType {
  Public = 'Public',
  Private = 'Private',
  Shared = 'Shared'
}
```

### Booking Status
```typescript
export enum BookingStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Cancelled = 'cancelled',
  Completed = 'completed',
  NoShow = 'no-show'
}
```

## API Endpoints and Payloads

### 1. Create Meeting
```http
POST /api/events
```

**Payload:**
```json
{
  "title": "Team Meeting",
  "description": "Weekly sync",
  "startTime": "2024-03-20T10:00:00Z",
  "endTime": "2024-03-20T11:00:00Z",
  "isAllDay": false,
  "eventType": "meeting",
  "priority": "Medium",
  "visibility": "Shared",
  "category": "Work",
  "color": "#1DA1F2",
  "location": {
    "name": "Conference Room A",
    "address": "123 Main St",
    "coordinates": {
      "lat": 40.7128,
      "lng": -74.0060
    },
    "online": false
  },
  "participants": ["profileId1", "profileId2"],
  "agendaItems": [
    {
      "description": "Review Q1 goals",
      "assignedTo": "profileId1"
    }
  ],
  "repeat": {
    "isRepeating": true,
    "frequency": "Weekly",
    "endCondition": "Never"
  },
  "reminders": [
    {
      "type": "Minutes15",
      "triggered": false
    }
  ],
  "isGroupEvent": true
}
```

### 2. Create Celebration
```http
POST /api/events
```

**Payload:**
```json
{
  "title": "Birthday Party",
  "description": "John's 30th birthday celebration",
  "startTime": "2024-03-25T18:00:00Z",
  "endTime": "2024-03-25T23:00:00Z",
  "isAllDay": false,
  "eventType": "celebration",
  "priority": "Medium",
  "visibility": "Public",
  "category": "Personal",
  "color": "#FF69B4",
  "location": {
    "name": "The Grand Hall",
    "address": "456 Party St",
    "coordinates": {
      "lat": 40.7128,
      "lng": -74.0060
    },
    "online": false
  },
  "participants": ["profileId1", "profileId2", "profileId3"],
  "attachments": [
    {
      "type": "Photo",
      "name": "venue.jpg",
      "description": "Venue preview"
    }
  ],
  "reminders": [
    {
      "type": "Days1",
      "triggered": false
    }
  ],
  "isGroupEvent": true
}
```

### 3. Create Appointment
```http
POST /api/events
```

**Payload:**
```json
{
  "title": "Doctor's Appointment",
  "description": "Annual checkup",
  "startTime": "2024-03-22T14:00:00Z",
  "endTime": "2024-03-22T15:00:00Z",
  "isAllDay": false,
  "eventType": "appointment",
  "priority": "High",
  "visibility": "Private",
  "category": "Health",
  "color": "#4CAF50",
  "location": {
    "name": "City Medical Center",
    "address": "789 Health Ave",
    "coordinates": {
      "lat": 40.7128,
      "lng": -74.0060
    },
    "online": false
  },
  "serviceProvider": {
    "profileId": "doctorProfileId",
    "role": "General Practitioner"
  },
  "reminders": [
    {
      "type": "Hours1",
      "triggered": false
    }
  ],
  "isGroupEvent": false
}
```

### 4. Create Booking
```http
POST /api/events/booking
```

**Payload:**
```json
{
  "title": "Massage Session",
  "description": "Deep tissue massage",
  "startTime": "2024-03-20T14:00:00Z",
  "endTime": "2024-03-20T15:00:00Z",
  "isAllDay": false,
  "eventType": "booking",
  "priority": "Medium",
  "visibility": "Private",
  "category": "Wellness",
  "color": "#9C27B0",
  "location": {
    "name": "Spa Center",
    "address": "321 Relaxation Blvd",
    "coordinates": {
      "lat": 40.7128,
      "lng": -74.0060
    },
    "online": false
  },
  "booking": {
    "serviceProvider": {
      "profileId": "therapistProfileId",
      "role": "Massage Therapist"
    },
    "service": {
      "name": "Deep Tissue Massage",
      "description": "60-minute deep tissue massage",
      "duration": 60,
      "reward": {
        "type": "Reward",
        "points": 100,
        "currency": "MyPts",
        "description": "Massage session payment",
        "required": true
      }
    },
    "status": "Pending",
    "requireApproval": true
  },
  "profile": "clientProfileId",
  "reminders": [
    {
      "type": "Hours1",
      "triggered": false
    }
  ],
  "isGroupEvent": false
}
```

### 5. Update Booking Status
```http
PATCH /api/events/:id/booking/status
```

**Payload:**
```json
{
  "status": "Confirmed",
  "cancellationReason": "Client requested cancellation" // Optional, required for Cancelled status
}
```

### 6. Update Booking Reward
```http
PATCH /api/events/:id/booking/reward
```

**Payload:**
```json
{
  "status": "completed",
  "transactionId": "txn_123456" // Optional
}
```

### 7. Reschedule Booking
```http
PATCH /api/events/:id/booking/reschedule
```

**Payload:**
```json
{
  "startTime": "2024-03-21T14:00:00Z",
  "endTime": "2024-03-21T15:00:00Z"
}
```

### 8. Add Attachment
```http
POST /api/events/:id/attachments
```

**Payload:**
```json
{
  "type": "Photo",
  "data": "base64EncodedImageData",
  "name": "meeting_notes.jpg",
  "description": "Meeting notes and diagrams"
}
```

### 9. Add Comment
```http
POST /api/events/:id/comments
```

**Payload:**
```json
{
  "text": "Great meeting!",
  "profile": "profileId"
}
```

### 10. Add Agenda Item
```http
POST /api/events/:id/agenda
```

**Payload:**
```json
{
  "description": "Discuss Q2 goals",
  "assignedTo": "profileId",
  "completed": false
}
```

## Response Formats

### Success Response
```json
{
  "success": true,
  "data": {
    // Event object
  },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "details": {
    // Additional error details if available
  }
}
```

## Common Error Codes
- 400: Bad Request - Invalid input data
- 401: Unauthorized - Authentication required
- 403: Forbidden - Insufficient permissions
- 404: Not Found - Resource not found
- 409: Conflict - Time slot overlap
- 422: Unprocessable Entity - Validation error
- 500: Internal Server Error

## Notes
- All timestamps should be in ISO 8601 format
- All IDs should be valid MongoDB ObjectIds
- Authentication is required for all endpoints
- Profile IDs are required for booking-related operations
- Time overlap checks are performed for all time-based operations
- Each event type has specific required fields:
  - Meeting: participants, agendaItems
  - Celebration: participants, location
  - Appointment: serviceProvider
  - Booking: booking.serviceProvider, booking.service 