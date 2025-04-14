# Connection System Documentation

## Overview
The connection system enables users to establish various types of connections with profiles through multiple channels (QR codes, links, direct requests) with automatic approval capabilities and real-time notifications.

## Core Components

### 1. Connection Types
- Follow
- Connect
- Business
- Donation
- Custom types can be added

### 2. Connection Sources
- **QR Code**: Scan-based connections
- **Link**: Click-through connections
- **Direct**: Manual connection requests

### 3. Auto-Accept System

#### Rules for Auto-Acceptance
1. **Profile Preferences**
   - `automatic`: All connections auto-accepted
   - `verified-only`: Only verified users' connections auto-accepted
   - `manual`: No auto-acceptance

2. **Source-based Rules**
   - QR and link connections auto-accepted if not requiring verification
   - Direct connections require manual approval by default

3. **Type-based Rules**
   - Follow connections auto-accepted if profile allows followers
   - Donation connections checked against minimum amount
   - Business connections may require additional verification

### 4. Live Notification System

#### Notification Types
1. **CONNECTION_REQUEST**
   ```json
   {
     "type": "CONNECTION_REQUEST",
     "recipient": "profileOwnerId",
     "sender": "requesterId",
     "reference": {
       "type": "connection",
       "id": "connectionId"
     },
     "metadata": {
       "connectionType": "type",
       "message": "optional message",
       "source": "qr|link|direct"
     }
   }
   ```

2. **CONNECTION_ACCEPTED**
   ```json
   {
     "type": "CONNECTION_ACCEPTED",
     "recipient": "requesterId",
     "sender": "profileOwnerId",
     "reference": {
       "type": "connection",
       "id": "connectionId"
     },
     "metadata": {
       "connectionType": "type",
       "profileName": "name",
       "source": "qr|link|direct"
     }
   }
   ```

### 5. Analytics Integration
- Tracks connection events
- Records source information
- Stores user agent data
- Maintains engagement metrics

## API Endpoints

### 1. QR Code Connection
```http
POST /api/connections/qr/:profileId
Authorization: Bearer <token>

{
  "connectionType": "follow" // optional
}
```

### 2. Link Connection
```http
POST /api/connections/link/:profileId
Authorization: Bearer <token>

{
  "connectionType": "connect" // optional
}
```

### 3. Direct Connection Request
```http
POST /api/connections/request
Authorization: Bearer <token>

{
  "toProfileId": "string",
  "connectionType": "string",
  "message": "string",
  "metadata": {
    "key": "value"
  }
}
```

## Connection Flow

1. **Request Initiation**
   - User initiates connection through any source
   - System validates user authentication
   - Checks for existing connections

2. **Auto-Accept Check**
   - Evaluates profile preferences
   - Checks connection source
   - Verifies connection type rules

3. **Connection Creation**
   - Creates connection record
   - Sets initial status (pending/accepted)
   - Records metadata and source info

4. **Notification Dispatch**
   - Sends real-time notification
   - Updates connection counts
   - Triggers analytics event

5. **Profile Update**
   - Updates connection arrays
   - Recalculates statistics
   - Records in recent connections

## Security Considerations

1. **Authentication**
   - All endpoints require valid JWT
   - Token verification on each request
   - User ID extracted from token

2. **Rate Limiting**
   - Prevents connection spam
   - Source-based limits
   - User-based cooldowns

3. **Validation**
   - Profile existence check
   - Connection type validation
   - Duplicate connection prevention

## Error Handling

1. **Common Errors**
   - Profile not found
   - Duplicate connection
   - Invalid connection type
   - Insufficient permissions

2. **Error Responses**
   ```json
   {
     "success": false,
     "message": "Error description",
     "code": "ERROR_CODE"
   }
   ```

## Best Practices

1. **Connection Requests**
   - Include meaningful messages
   - Provide relevant metadata
   - Use appropriate connection types

2. **Auto-Accept Configuration**
   - Enable for trusted sources
   - Require verification for sensitive profiles
   - Set appropriate minimum donations

3. **Notification Handling**
   - Process in real-time
   - Include actionable data
   - Maintain notification history

## Future Considerations

1. **Scalability**
   - Connection request queuing
   - Notification batching
   - Analytics aggregation

2. **Features**
   - Connection strength scoring
   - Network visualization
   - Connection recommendations

3. **Integration**
   - CRM systems
   - External networks
   - Analytics platforms
