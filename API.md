# My Profile API Documentation

## Overview

My Profile provides a comprehensive REST API for managing user profiles, social connections, and media content. This document details the API endpoints, authentication, data models, and usage examples.

## Base URL

```
Production: https://api.myprofile.com/v1
Development: http://localhost:3000/v1
```

## Authentication

### Bearer Token
All authenticated endpoints require a JWT token in the Authorization header:
```http
Authorization: Bearer <token>
```

### OAuth2 Authentication
OAuth2 authentication is supported with the following providers:
- Google
- GitHub
- LinkedIn

## Authentication Endpoints

### Register
```http
POST /auth/register
```
Create a new user account.

**Request Body:**
```json
{
  "email": "string",
  "password": "string",
  "fullName": "string",
  "username": "string",
  "dateOfBirth": "string (ISO date)",
  "countryOfResidence": "string",
  "phoneNumber": "string",
  "accountType": "MYSELF | SOMEONE_ELSE",
  "accountCategory": "PRIMARY_ACCOUNT | SECONDARY_ACCOUNT",
  "verificationMethod": "PHONE | EMAIL"
}
```

**Response:**
```json
{
  "user": {
    "id": "string",
    "email": "string",
    "fullName": "string",
    "username": "string",
    "isEmailVerified": "boolean",
    "isPhoneVerified": "boolean",
    "registrationStep": "string"
  },
  "tokens": {
    "accessToken": "string",
    "refreshToken": "string"
  }
}
```

### Login
```http
POST /auth/login
```
Authenticate user and receive access tokens.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "accessToken": "string",
  "refreshToken": "string",
  "user": {
    "id": "string",
    "email": "string",
    "fullName": "string",
    "role": "string",
    "isTwoFactorEnabled": "boolean"
  }
}
```

### Refresh Token
```http
POST /auth/refresh-token
```
Get a new access token using a refresh token.

**Request Body:**
```json
{
  "refreshToken": "string"
}
```

**Response:**
```json
{
  "accessToken": "string",
  "refreshToken": "string"
}
```

### Logout
```http
POST /auth/logout
```
Invalidate the current session.

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Successfully logged out"
}
```

### Logout All Sessions
```http
POST /auth/logout-all
```
Invalidate all active sessions for the current user.

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Successfully logged out from all devices"
}
```

### Get Active Sessions
```http
GET /auth/sessions
```
Get all active sessions for the current user.

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:**
```json
{
  "sessions": [
    {
      "deviceInfo": {
        "userAgent": "string",
        "ip": "string",
        "deviceType": "string"
      },
      "lastUsed": "string (ISO date)",
      "createdAt": "string (ISO date)",
      "isActive": "boolean"
    }
  ]
}
```

### Forgot Password
```http
POST /auth/forgot-password
```
Request a password reset link.

**Request Body:**
```json
{
  "email": "string"
}
```

**Response:**
```json
{
  "message": "Password reset instructions sent to email"
}
```

### Reset Password
```http
POST /auth/reset-password
```
Reset password using the reset token.

**Request Body:**
```json
{
  "token": "string",
  "newPassword": "string"
}
```

**Response:**
```json
{
  "message": "Password successfully reset"
}
```

### Verify OTP
```http
POST /auth/verify-otp
```
Verify a one-time password.

**Request Body:**
```json
{
  "otp": "string",
  "purpose": "registration | login | reset_password | change_email"
}
```

**Response:**
```json
{
  "verified": "boolean",
  "message": "string"
}
```

### Resend OTP
```http
POST /auth/resend-otp
```
Request a new OTP code.

**Request Body:**
```json
{
  "channel": "email | sms",
  "purpose": "registration | login | reset_password | change_email"
}
```

**Response:**
```json
{
  "message": "OTP sent successfully"
}
```

### Email Verification
```http
POST /auth/verify-email
```
Verify user's email address.

**Request Body:**
```json
{
  "token": "string"
}
```

**Response:**
```json
{
  "verified": "boolean",
  "message": "string"
}
```

### Resend Verification Email
```http
POST /auth/resend-verification
```
Request a new verification email.

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Verification email sent successfully"
}
```

### Error Responses

All endpoints may return the following error responses:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

Common error codes:
- `AUTH001`: Invalid credentials
- `AUTH002`: Account locked
- `AUTH003`: Email not verified
- `AUTH004`: Invalid token
- `AUTH005`: Token expired
- `AUTH006`: Too many attempts
- `AUTH007`: Invalid OTP
- `AUTH008`: OTP expired

## Rate Limiting

- Standard tier: 100 requests/minute
- Premium tier: 1000 requests/minute
- Enterprise tier: Custom limits

Rate limit headers:
```http
X-RateLimit-Limit: <max_requests>
X-RateLimit-Remaining: <remaining_requests>
X-RateLimit-Reset: <reset_timestamp>
```

## Common Response Codes

- `200 OK`: Success
- `201 Created`: Resource created
- `400 Bad Request`: Invalid parameters
- `401 Unauthorized`: Invalid/missing token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

## Data Models

### Profile Model
```typescript
interface Profile {
  id: string;
  personalInfo: {
    name: {
      first: string;
      last: string;
      middle?: string;
      preferred?: string;
    };
    dateOfBirth?: Date;
    gender?: string;
    location?: {
      country: string;
      city?: string;
      coordinates?: {
        latitude: number;
        longitude: number;
      };
    };
  };
  contact: {
    email: string;
    phone?: string;
    social?: {
      linkedin?: string;
      twitter?: string;
      github?: string;
    };
  };
  professional: {
    title?: string;
    company?: string;
    industry?: string;
    skills?: string[];
    experience?: {
      company: string;
      title: string;
      startDate: Date;
      endDate?: Date;
      description?: string;
    }[];
  };
  settings: {
    privacy: {
      profileVisibility: 'public' | 'private' | 'connections';
      showEmail: boolean;
      showPhone: boolean;
    };
    notifications: {
      email: boolean;
      push: boolean;
      connectionRequests: boolean;
    };
  };
  media: {
    avatar?: string;
    gallery?: {
      id: string;
      url: string;
      type: 'image' | 'video';
      isPublic: boolean;
    }[];
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    lastLogin?: Date;
    version: number;
  };
}
```

### Connection Model
```typescript
interface Connection {
  id: string;
  requesterId: string;
  recipientId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    acceptedAt?: Date;
  };
}
```

## API Endpoints

### Profile Management

#### Create Profile
```http
POST /profiles
Content-Type: application/json
Authorization: Bearer <token>

{
  "personalInfo": {
    "name": {
      "first": "John",
      "last": "Doe"
    },
    "dateOfBirth": "1990-01-01"
  },
  "contact": {
    "email": "john@example.com"
  }
}
```

#### Get Profile
```http
GET /profiles/:id
Authorization: Bearer <token>
```

#### Update Profile
```http
PATCH /profiles/:id
Content-Type: application/json
Authorization: Bearer <token>

{
  "professional": {
    "title": "Software Engineer",
    "skills": ["TypeScript", "Node.js"]
  }
}
```

#### Delete Profile
```http
DELETE /profiles/:id
Authorization: Bearer <token>
```

### Media Management

#### Upload Media
```http
POST /profiles/:id/media
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: <file>
type: "image" | "video"
isPublic: boolean
```

#### Get Media
```http
GET /profiles/:id/media/:mediaId
Authorization: Bearer <token>
```

#### Delete Media
```http
DELETE /profiles/:id/media/:mediaId
Authorization: Bearer <token>
```

### Connection Management

#### Send Connection Request
```http
POST /connections
Content-Type: application/json
Authorization: Bearer <token>

{
  "recipientId": "user123"
}
```

#### Accept/Reject Connection
```http
PATCH /connections/:id
Content-Type: application/json
Authorization: Bearer <token>

{
  "status": "accepted" | "rejected"
}
```

### Search & Discovery

#### Search Profiles
```http
GET /search/profiles
Authorization: Bearer <token>
Query Parameters:
- q: search query
- skills: comma-separated skills
- location: country or city
- page: page number
- limit: results per page
```

#### Get Suggested Connections
```http
GET /profiles/:id/suggestions
Authorization: Bearer <token>
Query Parameters:
- limit: number of suggestions
- includeSecondDegree: boolean
```

## Profile Operations

### Create Profile
```http
POST /profiles
```

Creates a new profile for a user.

**Request Headers:**
- `Authorization`: Bearer token required

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "profileId": "string",
    "userId": "string",
    "createdAt": "string"
  }
}
```

### Get Profile
```http
GET /profiles/{userId}
```

Retrieves a user's profile.

**Parameters:**
- `userId`: string (path parameter)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "string",
    "userId": "string",
    "personalInfo": {
      "firstName": "string",
      "lastName": "string",
      "dateOfBirth": "string",
      "about": "string"
    },
    "contactInfo": {
      "email": "string",
      "phone": "string",
      "address": "string"
    },
    "socialInfo": {
      "website": "string",
      "socialLinks": {}
    }
  }
}
```

### Update Profile
```http
PATCH /profiles/{profileId}
```

Updates specific fields of a profile.

**Parameters:**
- `profileId`: string (path parameter)

**Request Body:**
```json
{
  "personalInfo": {},
  "contactInfo": {},
  "socialInfo": {},
  "settings": {}
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "string",
    "updated": true
  }
}
```

### Delete Profile
```http
DELETE /profiles/{userId}
```

Deletes a user's profile.

**Parameters:**
- `userId`: string (path parameter)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Profile deleted successfully"
}
```

### Update Availability
```http
PUT /profiles/{profileId}/availability
```

Updates a profile's availability settings.

**Request Body:**
```json
{
  "status": "available | busy | away",
  "workingHours": [
    {
      "day": 0,
      "start": "09:00",
      "end": "17:00",
      "available": true
    }
  ],
  "timeZone": "string",
  "bufferTime": 15,
  "defaultMeetingDuration": 30
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "availability": {
      "status": "string",
      "workingHours": []
    }
  }
}
```

### Update Skills
```http
PUT /profiles/{profileId}/skills
```

Updates a profile's skills.

**Request Body:**
```json
{
  "skills": [
    {
      "name": "string",
      "level": "beginner | intermediate | expert",
      "endorsements": 0
    }
  ]
}
```

### Add Portfolio Project
```http
POST /profiles/{profileId}/portfolio
```

Adds a new portfolio project.

**Request Body:**
```json
{
  "title": "string",
  "description": "string",
  "shortDescription": "string",
  "thumbnail": "string",
  "images": ["string"],
  "videos": ["string"],
  "category": "string",
  "tags": ["string"],
  "technologies": ["string"],
  "url": "string",
  "githubUrl": "string",
  "startDate": "string",
  "endDate": "string",
  "status": "in-progress | completed | on-hold"
}
```

### Manage Connection
```http
POST /profiles/{profileId}/connections/{targetProfileId}
```

Manages connections between profiles.

**Parameters:**
- `action`: "connect" | "disconnect" | "block"

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Connection action completed successfully"
}
```

### Add Endorsement
```http
POST /profiles/{profileId}/skills/{skillName}/endorsements
```

Adds an endorsement to a skill.

**Parameters:**
- `endorserId`: string

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Skill endorsed successfully"
}
```

### Update Security Settings
```http
PUT /profiles/{profileId}/security
```

Updates security settings.

**Request Body:**
```json
{
  "twoFactorRequired": true,
  "ipWhitelist": ["string"]
}
```

### Update Connection Preferences
```http
PUT /profiles/{profileId}/connection-preferences
```

Updates connection preferences.

**Request Body:**
```json
{
  "allowFollowers": true,
  "allowEmployment": true,
  "allowDonations": true,
  "allowCollaboration": true,
  "connectionPrivacy": "public | private | mutual",
  "connectionApproval": "automatic | manual | verified-only"
}
```

### Update Social Links
```http
PUT /profiles/{profileId}/social-links
```

Updates social media links.

**Request Body:**
```json
{
  "website": "string",
  "facebook": "string",
  "twitter": "string",
  "instagram": "string",
  "linkedin": "string",
  "github": "string",
  "youtube": "string",
  "tiktok": "string"
}
```

## Error Responses

All endpoints may return the following errors:

- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

Error Response Format:
```json
{
  "success": false,
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

## Webhooks

### Available Events
- `profile.created`
- `profile.updated`
- `profile.deleted`
- `connection.requested`
- `connection.accepted`
- `connection.rejected`
- `media.uploaded`
- `media.deleted`

### Webhook Format
```typescript
interface WebhookPayload {
  event: string;
  timestamp: string;
  data: {
    id: string;
    type: string;
    attributes: Record<string, any>;
  };
}
```

## Error Handling

### Error Response Format
```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId: string;
  };
}
```

### Common Error Codes
- `INVALID_REQUEST`: Request validation failed
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Permission denied
- `NOT_FOUND`: Resource not found
- `RATE_LIMITED`: Too many requests
- `INTERNAL_ERROR`: Server error

## Type Definitions

### Request Validation Types
```typescript
interface ValidationOptions {
  customValidation?: (value: any) => boolean;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}

type CustomValidator = (value: any) => boolean | Promise<boolean>;
```

### Image Processing Types
```typescript
interface ImageOptions {
  width?: number;
  height?: number;
  format?: 'jpeg' | 'png' | 'webp';
  quality?: number;
  fit?: 'cover' | 'contain' | 'fill';
}

interface ProcessingResult {
  url: string;
  width: number;
  height: number;
  size: number;
  format: string;
}
```

## SDKs & Libraries

### Official SDKs
- [JavaScript/TypeScript](https://github.com/myprofile/js-sdk)
- [Python](https://github.com/myprofile/python-sdk)
- [Java](https://github.com/myprofile/java-sdk)

### Community Libraries
- [React Components](https://github.com/myprofile/react-components)
- [Vue.js Integration](https://github.com/myprofile/vue-integration)
- [iOS Swift Package](https://github.com/myprofile/ios-sdk)

## Best Practices

### Rate Limit Handling
- Implement exponential backoff
- Cache responses when possible
- Monitor rate limit headers
- Use bulk operations when available

### Security
- Store tokens securely
- Implement refresh token rotation
- Validate all user input
- Use HTTPS for all requests
- Implement proper CORS headers

### Performance
- Use compression
- Implement caching
- Batch requests when possible
- Use appropriate pagination
- Optimize payload size
