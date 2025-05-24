# Scan Feature API Documentation

## Overview

The Scan Feature API allows users to create, manage, and retrieve different types of scans associated with their profiles. The system supports four types of scans:

- **QR Code Scans** - Store text data extracted from QR codes
- **Badge Scans** - Store images of badges, IDs, or certificates
- **Document Scans** - Store PDFs or images of documents
- **Card Scans** - Store images of business cards, credit cards, etc.

## Base URL
```
http://localhost:3000/api
```

## Authentication

All scan endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

To get a JWT token, first authenticate:

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

## Data Model

### Scan Object Structure

```typescript
{
  "_id": "string",
  "profileId": "ObjectId",
  "type": "badge" | "doc" | "qrcode" | "card",
  "data": {
    // For file-based scans (badge, doc, card)
    "fileUrl": "string",      // Cloudinary URL
    "fileName": "string",     // Original filename
    "fileType": "string",     // MIME type
    "fileSize": "number",     // File size in bytes

    // For QR code scans
    "text": "string",         // QR code text content

    // Additional metadata
    "metadata": {
      // Custom key-value pairs
    }
  },
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

## API Endpoints

### 1. Create a Scan

**Endpoint:** `POST /api/profiles/:profileId/scans`

**Description:** Creates a new scan for the specified profile.

**Path Parameters:**
- `profileId` (string) - The ID of the profile to associate the scan with

**Request Body:**

For QR Code Scans:
```json
{
  "type": "qrcode",
  "data": {
    "text": "https://example.com or any QR code text",
    "metadata": {
      "source": "mobile_app",
      "location": "conference_hall"
    }
  }
}
```

For File-based Scans (Badge/Doc/Card):
```json
{
  "type": "badge",
  "data": {
    "fileUrl": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA...",
    "fileName": "badge.jpg",
    "fileType": "image/jpeg",
    "metadata": {
      "event": "Tech Conference 2024",
      "role": "Speaker"
    }
  }
}
```

**Response:**
```json
{
  "_id": "67890abcdef123456789",
  "profileId": "12345abcdef67890123",
  "type": "badge",
  "data": {
    "fileUrl": "https://res.cloudinary.com/your-cloud/image/upload/v1234567890/scans/badge/abc123.jpg",
    "fileName": "badge.jpg",
    "fileType": "image/jpeg",
    "fileSize": 245760,
    "metadata": {
      "event": "Tech Conference 2024",
      "role": "Speaker"
    }
  },
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### 2. Get Profile Scans

**Endpoint:** `GET /api/profiles/:profileId/scans`

**Description:** Retrieves all scans for a specific profile with optional filtering and pagination.

**Query Parameters:**
- `type` (optional) - Filter by scan type: `badge`, `doc`, `qrcode`, `card`
- `limit` (optional, default: 50) - Number of results to return
- `skip` (optional, default: 0) - Number of results to skip for pagination
- `sort` (optional, default: -createdAt) - Sort order

**Examples:**
```
GET /api/profiles/12345/scans
GET /api/profiles/12345/scans?type=qrcode
GET /api/profiles/12345/scans?limit=10&skip=20
GET /api/profiles/12345/scans?sort=createdAt
```

**Response:**
```json
{
  "scans": [
    {
      "_id": "67890abcdef123456789",
      "profileId": "12345abcdef67890123",
      "type": "badge",
      "data": {
        "fileUrl": "https://res.cloudinary.com/...",
        "fileName": "badge.jpg",
        "fileType": "image/jpeg",
        "fileSize": 245760
      },
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 50,
    "skip": 0,
    "hasMore": false
  }
}
```

### 3. Get Scan Statistics

**Endpoint:** `GET /api/profiles/:profileId/scans/stats`

**Description:** Returns statistics about scans for a profile.

**Response:**
```json
{
  "totalScans": 15,
  "byType": [
    {
      "type": "qrcode",
      "count": 8,
      "latestScan": "2024-01-15T10:30:00.000Z"
    },
    {
      "type": "badge",
      "count": 4,
      "latestScan": "2024-01-14T15:20:00.000Z"
    },
    {
      "type": "doc",
      "count": 2,
      "latestScan": "2024-01-13T09:15:00.000Z"
    },
    {
      "type": "card",
      "count": 1,
      "latestScan": "2024-01-12T14:45:00.000Z"
    }
  ]
}
```

### 4. Get Specific Scan

**Endpoint:** `GET /api/profiles/:profileId/scans/:scanId`

**Description:** Retrieves a specific scan by its ID.

**Response:**
```json
{
  "_id": "67890abcdef123456789",
  "profileId": "12345abcdef67890123",
  "type": "qrcode",
  "data": {
    "text": "https://myprofile.app/connect/johndoe",
    "metadata": {
      "scannedAt": "networking_event",
      "contact": "John Doe"
    }
  },
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### 5. Update Scan

**Endpoint:** `PUT /api/profiles/:profileId/scans/:scanId`

**Description:** Updates scan metadata. Note: File URLs and core data cannot be modified.

**Request Body:**
```json
{
  "data": {
    "text": "Updated QR code text",
    "metadata": {
      "updated": true,
      "notes": "Added additional context"
    }
  }
}
```

**Response:**
```json
{
  "_id": "67890abcdef123456789",
  "profileId": "12345abcdef67890123",
  "type": "qrcode",
  "data": {
    "text": "Updated QR code text",
    "metadata": {
      "updated": true,
      "notes": "Added additional context"
    }
  },
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T11:45:00.000Z"
}
```

### 6. Delete Scan

**Endpoint:** `DELETE /api/profiles/:profileId/scans/:scanId`

**Description:** Deletes a scan and its associated file from Cloudinary.

**Response:**
```json
{
  "message": "Scan deleted successfully"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid profile ID"
}
```

### 401 Unauthorized
```json
{
  "error": "Authentication required"
}
```

### 404 Not Found
```json
{
  "error": "Scan not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "An unknown error occurred",
  "details": "Error stack trace"
}
```

## Validation Rules

### Scan Types
- Must be one of: `badge`, `doc`, `qrcode`, `card`

### QR Code Scans
- Must include `data.text` field
- Cannot include file-related fields

### File-based Scans (badge, doc, card)
- Must include `data.fileUrl` field (base64 encoded)
- Should include `fileName`, `fileType` for better organization
- Files are automatically uploaded to Cloudinary

### File Formats Supported
- **Images:** JPEG, PNG, GIF, WebP
- **Documents:** PDF
- **Maximum file size:** Determined by Cloudinary settings

## Usage Examples

### Postman Collection

#### 1. Login and Get Token
```http
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "identifier": "test@example.com",
  "password": "password123"
}
```

#### 2. Create QR Code Scan
```http
POST http://localhost:3000/api/profiles/12345abcdef67890123/scans
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "type": "qrcode",
  "data": {
    "text": "https://myprofile.app/connect/johndoe",
    "metadata": {
      "source": "networking_event",
      "location": "Tech Conference 2024"
    }
  }
}
```

#### 3. Create Badge Scan
```http
POST http://localhost:3000/api/profiles/12345abcdef67890123/scans
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "type": "badge",
  "data": {
    "fileUrl": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA...",
    "fileName": "conference_badge.jpg",
    "fileType": "image/jpeg",
    "metadata": {
      "event": "Tech Conference 2024",
      "role": "Attendee",
      "day": "1"
    }
  }
}
```

#### 4. Get All Scans
```http
GET http://localhost:3000/api/profiles/12345abcdef67890123/scans
Authorization: Bearer YOUR_JWT_TOKEN
```

#### 5. Get QR Code Scans Only
```http
GET http://localhost:3000/api/profiles/12345abcdef67890123/scans?type=qrcode
Authorization: Bearer YOUR_JWT_TOKEN
```

#### 6. Get Scan Statistics
```http
GET http://localhost:3000/api/profiles/12345abcdef67890123/scans/stats
Authorization: Bearer YOUR_JWT_TOKEN
```

## Sample Base64 Test Data

For quick testing, here's a minimal 1x1 pixel PNG image in base64:

```
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==
```

## Integration Notes

### Client-Side Implementation
1. Capture scan data (QR code text, image file, etc.)
2. Convert files to base64 if needed
3. Send to appropriate API endpoint
4. Handle response and update UI
5. Store scan ID for future reference

### File Upload Process
1. Files are sent as base64 strings in the request body
2. Server uploads to Cloudinary automatically
3. Cloudinary URL is stored in the database
4. Original file metadata is preserved

### Security Considerations
- All endpoints require valid JWT authentication
- Profile access is validated through authentication middleware
- File uploads are validated for size and type
- Cloudinary handles secure file storage and delivery

## Changelog

### Version 1.0.0 (Current)
- Initial implementation of scan feature
- Support for 4 scan types: badge, doc, qrcode, card
- Base64 file upload with Cloudinary integration
- CRUD operations for scan management
- Statistics and filtering capabilities

---

# NFC Card Feature API Documentation

## Overview

The NFC Card Feature extends the Scan API to provide comprehensive NFC card management with analytics tracking and access controls. Profile users can purchase NFC cards, configure what data to write, and track analytics when cards are scanned by others.

## Base URL
```
http://localhost:3000/api/nfc
```

## Authentication

All NFC endpoints require JWT authentication except for the public scan recording endpoint.

## Data Models

### NFC Card Object Structure

```typescript
{
  "_id": "ObjectId",
  "profileId": "ObjectId",
  "cardId": "string",           // Unique card identifier
  "cardType": "basic" | "premium" | "enterprise",
  "status": "purchased" | "configured" | "written" | "active" | "inactive",
  "configuration": {
    "template": "full" | "minimal" | "custom",
    "fields": ["name", "email", "phone", "company", "website", "social"],
    "customData": {
      "title": "string",
      "description": "string",
      "additionalInfo": "object"
    }
  },
  "analytics": {
    "totalScans": "number",
    "uniqueScans": "number",
    "lastScanned": "Date",
    "scanHistory": [{
      "scannedAt": "Date",
      "scannedBy": "ObjectId",
      "location": {
        "latitude": "number",
        "longitude": "number",
        "address": "string"
      },
      "deviceInfo": {
        "platform": "string",
        "version": "string",
        "model": "string"
      },
      "isUnique": "boolean"
    }]
  },
  "accessControl": {
    "isPublic": "boolean",
    "accessLevel": "public" | "protected" | "private",
    "encryptionEnabled": "boolean",
    "allowedUsers": ["ObjectId"],
    "locationRestriction": {
      "enabled": "boolean",
      "allowedLocations": [{
        "latitude": "number",
        "longitude": "number",
        "radius": "number"
      }]
    }
  },
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

## API Endpoints

### Card Management

#### 1. Create NFC Card
```http
POST /api/nfc/cards
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "cardType": "basic",
  "configuration": {
    "template": "full",
    "fields": ["name", "email", "phone", "company"]
  },
  "accessControl": {
    "isPublic": true,
    "accessLevel": "public"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "NFC card created successfully",
  "data": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "cardId": "NFC-abc123def456",
    "cardType": "basic",
    "status": "purchased",
    "configuration": { ... },
    "analytics": {
      "totalScans": 0,
      "uniqueScans": 0,
      "scanHistory": []
    },
    "createdAt": "2023-07-20T10:30:00.000Z"
  }
}
```

#### 2. Get User's NFC Cards
```http
GET /api/nfc/cards
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters:**
- `status` (optional): Filter by card status
- `cardType` (optional): Filter by card type
- `page` (optional): Page number for pagination
- `limit` (optional): Items per page

#### 3. Get Specific Card
```http
GET /api/nfc/cards/60f7b3b3b3b3b3b3b3b3b3b3
Authorization: Bearer YOUR_JWT_TOKEN
```

#### 4. Update Card Configuration
```http
PUT /api/nfc/cards/60f7b3b3b3b3b3b3b3b3b3b3/configuration
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "configuration": {
    "template": "custom",
    "fields": ["name", "email", "website"],
    "customData": {
      "title": "Senior Developer",
      "description": "Passionate about creating amazing experiences",
      "additionalInfo": {
        "skills": ["React", "Node.js", "TypeScript"],
        "experience": "5 years"
      }
    }
  }
}
```

#### 5. Update Access Control
```http
PUT /api/nfc/cards/60f7b3b3b3b3b3b3b3b3b3b3/access-control
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "accessControl": {
    "isPublic": false,
    "accessLevel": "protected",
    "encryptionEnabled": true,
    "allowedUsers": ["60f7b3b3b3b3b3b3b3b3b3b4"],
    "locationRestriction": {
      "enabled": true,
      "allowedLocations": [{
        "latitude": 40.7128,
        "longitude": -74.0060,
        "radius": 1000
      }]
    }
  }
}
```

#### 6. Delete Card
```http
DELETE /api/nfc/cards/60f7b3b3b3b3b3b3b3b3b3b3
Authorization: Bearer YOUR_JWT_TOKEN
```

### NFC Data Generation

#### 7. Generate NFC Write Data
```http
POST /api/nfc/cards/60f7b3b3b3b3b3b3b3b3b3b3/generate-write-data
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "message": "NFC write data generated successfully",
  "data": {
    "writeData": {
      "recordType": "text/plain",
      "payload": "https://myprofile.app/nfc/60f7b3b3b3b3b3b3b3b3b3b3",
      "id": "myprofile_nfc_card"
    },
    "instructions": [
      "Hold your NFC-enabled device close to the card",
      "Open your NFC writing app",
      "Write the provided data to the card",
      "Test the card by scanning it"
    ]
  }
}
```

#### 8. Get Card Read Data (Public)
```http
GET /api/nfc/cards/60f7b3b3b3b3b3b3b3b3b3b3/read-data
```

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "company": "Tech Corp",
    "website": "https://johndoe.com",
    "social": {
      "linkedin": "https://linkedin.com/in/johndoe",
      "twitter": "https://twitter.com/johndoe"
    },
    "profileUrl": "https://myprofile.app/profile/johndoe"
  }
}
```

### Analytics

#### 9. Record Scan (Public - for Flutter app)
```http
POST /api/nfc/scan
Content-Type: application/json

{
  "cardId": "60f7b3b3b3b3b3b3b3b3b3b3",
  "scannedBy": "60f7b3b3b3b3b3b3b3b3b4",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "address": "New York, NY"
  },
  "deviceInfo": {
    "platform": "android",
    "version": "12",
    "model": "Pixel 6"
  }
}
```

#### 10. Get Card Analytics
```http
GET /api/nfc/cards/60f7b3b3b3b3b3b3b3b3b3b3/analytics
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalScans": 45,
    "uniqueScans": 32,
    "lastScanned": "2023-07-20T15:30:00.000Z",
    "scansByDay": [
      { "date": "2023-07-20", "count": 5 },
      { "date": "2023-07-19", "count": 8 }
    ],
    "topLocations": [
      { "address": "New York, NY", "count": 12 },
      { "address": "San Francisco, CA", "count": 8 }
    ],
    "deviceBreakdown": {
      "android": 28,
      "ios": 17
    }
  }
}
```

#### 11. Get Scan History
```http
GET /api/nfc/cards/60f7b3b3b3b3b3b3b3b3b3b3/scans?page=1&limit=20&startDate=2023-07-01&endDate=2023-07-31
Authorization: Bearer YOUR_JWT_TOKEN
```

### Templates

#### 12. Get Available Templates
```http
GET /api/nfc/templates
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "name": "full",
        "description": "Complete profile information",
        "fields": ["name", "email", "phone", "company", "website", "social", "bio"]
      },
      {
        "name": "minimal",
        "description": "Essential contact information only",
        "fields": ["name", "email", "phone"]
      },
      {
        "name": "custom",
        "description": "Customizable template",
        "fields": []
      }
    ]
  }
}
```

#### 13. Get Template Details
```http
GET /api/nfc/templates/full
Authorization: Bearer YOUR_JWT_TOKEN
```

### Bulk Operations

#### 14. Get User Analytics Overview
```http
GET /api/nfc/analytics/overview
Authorization: Bearer YOUR_JWT_TOKEN
```

#### 15. Export Card Data
```http
GET /api/nfc/cards/60f7b3b3b3b3b3b3b3b3b3b3/export
Authorization: Bearer YOUR_JWT_TOKEN
```

#### 16. Bulk Update Access Control
```http
PUT /api/nfc/cards/bulk/access-control
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "cardIds": ["60f7b3b3b3b3b3b3b3b3b3b3", "60f7b3b3b3b3b3b3b3b3b4"],
  "accessControl": {
    "isPublic": true,
    "accessLevel": "public"
  }
}
```

## Error Responses

### Common Error Codes

- `400 Bad Request` - Invalid request data or validation errors
- `401 Unauthorized` - Missing or invalid authentication token
- `403 Forbidden` - Access denied due to access control settings
- `404 Not Found` - Card or resource not found
- `409 Conflict` - Card already exists or status conflict
- `500 Internal Server Error` - Server error

### Example Error Response
```json
{
  "success": false,
  "message": "Validation failed: Card type must be basic, premium, or enterprise",
  "errors": [
    {
      "path": "cardType",
      "message": "Card type must be basic, premium, or enterprise"
    }
  ]
}
```

## Postman Collection Examples

### Environment Variables
```json
{
  "base_url": "http://localhost:3000",
  "auth_token": "YOUR_JWT_TOKEN_HERE",
  "profile_id": "YOUR_PROFILE_ID_HERE",
  "card_id": "CARD_ID_HERE"
}
```

### Sample Test Flow

1. **Create a Card**
   ```javascript
   // Test Script
   pm.test("Card created successfully", function () {
       pm.response.to.have.status(201);
       pm.expect(pm.response.json().success).to.be.true;
       pm.environment.set("card_id", pm.response.json().data._id);
   });
   ```

2. **Configure the Card**
   ```javascript
   // Test Script
   pm.test("Card configured successfully", function () {
       pm.response.to.have.status(200);
       pm.expect(pm.response.json().data.status).to.eql("configured");
   });
   ```

3. **Generate Write Data**
   ```javascript
   // Test Script
   pm.test("Write data generated", function () {
       pm.response.to.have.status(200);
       pm.expect(pm.response.json().data.writeData).to.exist;
   });
   ```

4. **Record a Scan**
   ```javascript
   // Test Script (Public endpoint - no auth needed)
   pm.test("Scan recorded successfully", function () {
       pm.response.to.have.status(200);
       pm.expect(pm.response.json().success).to.be.true;
   });
   ```

5. **Check Analytics**
   ```javascript
   // Test Script
   pm.test("Analytics retrieved", function () {
       pm.response.to.have.status(200);
       pm.expect(pm.response.json().data.totalScans).to.be.above(0);
   });
   ```

## Flutter Integration

### NFC Reading (When Someone Scans Your Card)
```dart
import 'package:nfc_manager/nfc_manager.dart';

// Start NFC session
NfcManager.instance.startSession(onDiscovered: (NfcTag tag) async {
  try {
    // Read NDEF data from the tag
    Ndef? ndef = Ndef.from(tag);
    if (ndef != null) {
      NdefMessage message = await ndef.read();
      String cardUrl = String.fromCharCodes(message.records.first.payload);

      // Extract card ID from URL and call your API
      String cardId = extractCardIdFromUrl(cardUrl);
      await recordScan(cardId);
    }
  } catch (e) {
    print('Error reading NFC: $e');
  }
});

// Record the scan
Future<void> recordScan(String cardId) async {
  final response = await http.post(
    Uri.parse('${baseUrl}/api/nfc/scan'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'cardId': cardId,
      'location': await getCurrentLocation(),
      'deviceInfo': await getDeviceInfo(),
    }),
  );
}
```

### NFC Writing (When Configuring Your Card)
```dart
// Write data to NFC card
Future<void> writeToCard(String writeData) async {
  NfcManager.instance.startSession(onDiscovered: (NfcTag tag) async {
    try {
      Ndef? ndef = Ndef.from(tag);
      if (ndef != null && ndef.isWritable) {
        // Create NDEF message
        NdefMessage message = NdefMessage([
          NdefRecord.createText(writeData),
        ]);

        // Write to card
        await ndef.write(message);
        print('Successfully wrote to NFC card');
      }
    } catch (e) {
      print('Error writing to NFC: $e');
    }
  });
}
```

## Security Features

### Access Control Levels

1. **Public**: Anyone can scan and access card data
2. **Protected**: Only registered users can access card data
3. **Private**: Only specific allowed users can access card data

### Location-Based Restrictions

Cards can be configured to only work within specific geographic areas:

```json
{
  "locationRestriction": {
    "enabled": true,
    "allowedLocations": [{
      "latitude": 40.7128,
      "longitude": -74.0060,
      "radius": 1000  // meters
    }]
  }
}
```

### Encryption

Premium and Enterprise cards support end-to-end encryption for sensitive data.

## Rate Limiting

- **Authenticated endpoints**: 100 requests per minute per user
- **Public scan endpoint**: 1000 requests per minute per IP
- **Analytics endpoints**: 50 requests per minute per user

## Changelog

### Version 2.0.0 (NFC Feature)
- Added comprehensive NFC card management system
- Implemented analytics tracking with scan history
- Added access control system with location restrictions
- Created template system for card configuration
- Added bulk operations for enterprise users
- Integrated with Flutter NFC capabilities
- Added public scan recording endpoint for mobile apps

---

# NFC Card Programming & Management API (v2)

## Overview
This API enables real-world, server-side NFC card programming, batch fulfillment, verification, analytics, and robust management for digital asset platforms. It is modeled after industry leaders (Popl, HiHello, Mobilo) and supports secure, reliable, and scalable NFC card operations for business and enterprise use cases.

---

## Key Features
- **Server-side NFC programming** using nfc-pcsc and NDEF
- **Batch programming** for fulfillment/production
- **Card verification** and quality control
- **Comprehensive analytics** (scans, locations, devices)
- **Access control** and security (public/protected/private)
- **RESTful endpoints** for all operations

---

## NFC Card Lifecycle & Workflow

1. **Order/Provision Card**
   - Create a card record for a user/profile
2. **Configure Card**
   - Set up data template, fields, and access control
3. **Batch Programming (Fulfillment)**
   - Use server-side hardware to program cards in batches
   - Verify each card after programming
4. **Ship to User**
   - Card is shipped after successful programming/verification
5. **Scan & Analytics**
   - Track scans, locations, devices, and usage
6. **Reprogram/Deactivate**
   - Cards can be reprogrammed, deactivated, or replaced

---

## Endpoints

### Card Management
- `POST   /api/nfc/cards` — Create NFC card
- `GET    /api/nfc/cards` — List user cards (filter by status/type)
- `GET    /api/nfc/cards/:cardId` — Get card details
- `PUT    /api/nfc/cards/:cardId/configuration` — Update card configuration
- `DELETE /api/nfc/cards/:cardId` — Deactivate card

### Programming & Fulfillment
- `POST /api/nfc/cards/:cardId/program` — Program card (server-side, requires hardware)
- `POST /api/nfc/cards/batch/program` — Batch program cards for fulfillment
- `POST /api/nfc/cards/:cardId/verify` — Verify card programming quality
- `POST /api/nfc/cards/:cardId/reprogram` — Reprogram card with new data
- `POST /api/nfc/cards/:cardId/format` — Format/erase card
- `POST /api/nfc/cards/read` — Read card data (hardware required)

### Hardware Management
- `GET  /api/nfc/hardware/status` — Get NFC hardware status
- `POST /api/nfc/hardware/initialize` — Initialize NFC hardware

### Analytics
- `GET /api/nfc/analytics/programming` — Programming analytics (batch, fulfillment)
- `GET /api/nfc/cards/:cardId/analytics` — Card scan analytics

### Templates
- `GET /api/nfc/templates` — List available data templates
- `GET /api/nfc/templates/:templateName` — Get template details

---

## Example Batch Programming Flow
1. Admin calls `POST /api/nfc/cards/batch/program` with array of `{ cardId, profileId }` and `readerName`.
2. Server programs each card using nfc-pcsc hardware, verifies each write, and returns a batch result.
3. Failed cards can be retried or flagged for manual review.

---

## Security & Quality
- All programming is performed server-side for quality control and security.
- Analytics and scan history are tracked for each card.
- Access control and location restrictions are supported.

---

## See Also
- [VAULT_SYSTEM.md](./VAULT_SYSTEM.md) — Digital asset and NFC integration
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — System architecture

---

*For full request/response examples, see the detailed endpoint documentation below and in the Postman collection.*
