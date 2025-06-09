# User Management Documentation

## Overview

The User Management system provides comprehensive administrative functionality for managing users in the MyProfile platform. This system is designed for administrators and super administrators to efficiently manage user accounts, roles, permissions, and monitor user activities.

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [User Management API](#user-management-api)
3. [User Operations](#user-operations)
4. [Filtering & Search](#filtering--search)
5. [User Statistics](#user-statistics)
6. [Bulk Operations](#bulk-operations)
7. [Security Features](#security-features)
8. [Error Handling](#error-handling)
9. [Examples](#examples)
10. [Best Practices](#best-practices)

## Authentication & Authorization

### Role-Based Access Control

The system implements a hierarchical role structure:

- **superadmin**: Full system access, can manage all users including admins
- **admin**: Can manage regular users, limited admin functionality
- **user**: Standard user with no admin privileges

### Access Requirements

All admin user management endpoints require:
- Valid authentication token
- Admin or superadmin role
- Specific permissions for certain operations

```typescript
// Role hierarchy for operations
const rolePermissions = {
  superadmin: ['create_admin', 'delete_admin', 'manage_all_users'],
  admin: ['manage_users', 'view_stats', 'bulk_operations'],
  user: []
};
```

## User Management API

### Base URL
```
/api/admin/users
```

### Endpoints Overview

| Method | Endpoint | Description | Required Role |
|--------|----------|-------------|---------------|
| POST | `/` | Create new user | admin/superadmin |
| GET | `/` | Get all users with pagination | admin/superadmin |
| GET | `/stats` | Get user statistics | admin/superadmin |
| GET | `/search` | Search users | admin/superadmin |
| GET | `/:userId` | Get user by ID | admin/superadmin |
| PUT | `/:userId` | Update user | admin/superadmin |
| DELETE | `/:userId` | Delete user | admin/superadmin |
| POST | `/:userId/ban` | Ban/unban user | admin/superadmin |
| POST | `/:userId/lock` | Lock/unlock account | admin/superadmin |
| POST | `/:userId/role` | Change user role | admin/superadmin |
| POST | `/:userId/verify` | Force verify user | admin/superadmin |
| POST | `/bulk-update` | Bulk update users | admin/superadmin |

## User Operations

### 1. Create User

Create a new user account with administrative privileges.

**Endpoint:** `POST /api/admin/users`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "fullName": "John Doe",
  "username": "johndoe",
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1990-01-01",
  "countryOfResidence": "US",
  "phoneNumber": "+1234567890",
  "accountType": "MYSELF",
  "accountCategory": "PRIMARY_ACCOUNT",
  "verificationMethod": "EMAIL",
  "role": "user",
  "isEmailVerified": true,
  "isPhoneVerified": false
}
```

**Required Fields:**
- `email`: Valid email address
- `password`: Minimum 6 characters
- `fullName`: User's full name
- `username`: Unique username
- `accountType`: "MYSELF" or "SOMEONE_ELSE"
- `accountCategory`: "PRIMARY_ACCOUNT" or "SECONDARY_ACCOUNT"
- `verificationMethod`: "EMAIL" or "PHONE"

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "_id": "user_id",
    "email": "user@example.com",
    "fullName": "John Doe",
    "username": "johndoe",
    "role": "user",
    "isEmailVerified": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2. Get All Users

Retrieve users with pagination and filtering options.

**Endpoint:** `GET /api/admin/users`

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 20, max: 100)
- `search`: Search term for name, email, username, phone
- `role`: Filter by user role
- `accountType`: Filter by account type
- `isEmailVerified`: Filter by email verification status
- `isPhoneVerified`: Filter by phone verification status
- `status`: Filter by status (active/inactive/banned)
- `countryOfResidence`: Filter by country
- `dateJoinedFrom`: Filter by registration date (from)
- `dateJoinedTo`: Filter by registration date (to)
- `lastLoginFrom`: Filter by last login date (from)
- `lastLoginTo`: Filter by last login date (to)

**Example Request:**
```
GET /api/admin/users?page=1&limit=20&search=john&role=user&status=active
```

**Response:**
```json
{
  "success": true,
  "message": "Users fetched successfully",
  "data": {
    "users": [...],
    "totalCount": 150,
    "totalPages": 8,
    "currentPage": 1,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### 3. Get User by ID

Retrieve detailed information for a specific user.

**Endpoint:** `GET /api/admin/users/:userId`

**Response:**
```json
{
  "success": true,
  "message": "User fetched successfully",
  "data": {
    "_id": "user_id",
    "email": "user@example.com",
    "fullName": "John Doe",
    "username": "johndoe",
    "role": "user",
    "isEmailVerified": true,
    "isPhoneVerified": false,
    "accountType": "MYSELF",
    "lastLogin": "2024-01-01T00:00:00.000Z",
    "sessions": [...],
    "loginHistory": [...]
  }
}
```

### 4. Update User

Update user information and settings.

**Endpoint:** `PUT /api/admin/users/:userId`

**Request Body:**
```json
{
  "fullName": "John Updated Doe",
  "email": "newemail@example.com",
  "phoneNumber": "+1987654321",
  "countryOfResidence": "CA",
  "isEmailVerified": true,
  "role": "admin"
}
```

### 5. Delete User

Permanently delete a user account.

**Endpoint:** `DELETE /api/admin/users/:userId`

**Restrictions:**
- Cannot delete own account
- Admins cannot delete other admins (superadmin only)

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

### 6. Ban/Unban User

Temporarily ban or unban user accounts.

**Endpoint:** `POST /api/admin/users/:userId/ban`

**Request Body:**
```json
{
  "banned": true,
  "reason": "Violation of terms of service"
}
```

**Restrictions:**
- Cannot ban own account
- Admins cannot ban other admins (superadmin only)

### 7. Lock/Unlock Account

Lock or unlock user accounts for security purposes.

**Endpoint:** `POST /api/admin/users/:userId/lock`

**Request Body:**
```json
{
  "locked": true,
  "reason": "Suspicious activity detected"
}
```

### 8. Change User Role

Modify user roles and permissions.

**Endpoint:** `POST /api/admin/users/:userId/role`

**Request Body:**
```json
{
  "role": "admin"
}
```

**Restrictions:**
- Cannot change own role
- Admins cannot promote users to admin/superadmin roles
- Admins cannot change admin roles

### 9. Force Verify User

Manually verify user email or phone without OTP.

**Endpoint:** `POST /api/admin/users/:userId/verify`

**Request Body:**
```json
{
  "type": "email"
}
```

**Valid Types:**
- `email`: Verify email address
- `phone`: Verify phone number

## Filtering & Search

### Advanced Filtering

The system supports comprehensive filtering options:

```javascript
// Example filter combinations
const filters = {
  search: "john",              // Search in name, email, username, phone
  role: "user",               // Filter by role
  accountType: "MYSELF",      // Filter by account type
  isEmailVerified: true,      // Email verification status
  isPhoneVerified: false,     // Phone verification status
  status: "active",           // Account status
  countryOfResidence: "US",   // Country filter
  dateJoinedFrom: "2024-01-01", // Registration date range
  dateJoinedTo: "2024-12-31",
  lastLoginFrom: "2024-01-01",  // Last login range
  lastLoginTo: "2024-12-31"
};
```

### Search Functionality

**Endpoint:** `GET /api/admin/users/search`

**Query Parameters:**
- `q`: Search term (required)
- `limit`: Maximum results (default: 10, max: 50)

**Example:**
```
GET /api/admin/users/search?q=john&limit=10
```

## User Statistics

Get comprehensive user statistics and analytics.

**Endpoint:** `GET /api/admin/users/stats`

**Response:**
```json
{
  "success": true,
  "message": "User statistics fetched successfully",
  "data": {
    "totalUsers": 1500,
    "activeUsers": 1200,
    "verifiedUsers": 1100,
    "usersByRole": {
      "user": 1450,
      "admin": 45,
      "superadmin": 5
    },
    "usersByAccountType": {
      "MYSELF": 1200,
      "SOMEONE_ELSE": 300
    },
    "newUsersThisWeek": 25,
    "newUsersThisMonth": 150,
    "recentLoginCount": 800
  }
}
```

## Bulk Operations

Perform operations on multiple users simultaneously.

**Endpoint:** `POST /api/admin/users/bulk-update`

**Request Body:**
```json
{
  "userIds": ["user_id_1", "user_id_2", "user_id_3"],
  "updateData": {
    "isEmailVerified": true,
    "role": "user"
  }
}
```

**Restrictions:**
- Cannot include own account in bulk operations
- Maximum 100 users per bulk operation
- Limited to safe operations only

**Response:**
```json
{
  "success": true,
  "message": "Bulk update completed",
  "data": {
    "updated": 2,
    "failed": ["user_id_3"],
    "errors": {
      "user_id_3": "User not found"
    }
  }
}
```

## Security Features

### Access Control

1. **Role Verification**: Every endpoint verifies user role
2. **Self-Protection**: Users cannot perform destructive actions on themselves
3. **Hierarchical Permissions**: Superadmin > Admin > User
4. **Audit Logging**: All admin actions are logged

### Data Protection

1. **Password Exclusion**: Passwords never returned in responses
2. **Sensitive Data Filtering**: Tokens and secrets excluded
3. **Input Validation**: All inputs validated and sanitized
4. **Rate Limiting**: API endpoints are rate-limited

### Session Management

1. **Active Session Tracking**: Monitor user login sessions
2. **Force Logout**: Ability to terminate user sessions
3. **Device Tracking**: Track user devices and locations
4. **Suspicious Activity**: Monitor for unusual patterns

## Error Handling

### Common Error Responses

```json
// Authentication Error
{
  "success": false,
  "message": "Authentication required"
}

// Authorization Error
{
  "success": false,
  "message": "Admin access required"
}

// Validation Error
{
  "success": false,
  "message": "Invalid email format"
}

// Not Found Error
{
  "success": false,
  "message": "User not found"
}

// Conflict Error
{
  "success": false,
  "message": "User with this email already exists"
}
```

### Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request / Validation Error
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `409`: Conflict
- `500`: Internal Server Error

## Examples

### Complete User Management Workflow

```javascript
// 1. Create a new user
const createResponse = await fetch('/api/admin/users', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'newuser@example.com',
    password: 'securePassword123',
    fullName: 'New User',
    username: 'newuser',
    accountType: 'MYSELF',
    accountCategory: 'PRIMARY_ACCOUNT',
    verificationMethod: 'EMAIL'
  })
});

// 2. Get all users with pagination
const usersResponse = await fetch('/api/admin/users?page=1&limit=20', {
  headers: { 'Authorization': 'Bearer ' + token }
});

// 3. Search for specific users
const searchResponse = await fetch('/api/admin/users/search?q=john', {
  headers: { 'Authorization': 'Bearer ' + token }
});

// 4. Update user information
const updateResponse = await fetch('/api/admin/users/USER_ID', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    fullName: 'Updated Name',
    isEmailVerified: true
  })
});

// 5. Ban a user
const banResponse = await fetch('/api/admin/users/USER_ID/ban', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    banned: true,
    reason: 'Terms violation'
  })
});

// 6. Get user statistics
const statsResponse = await fetch('/api/admin/users/stats', {
  headers: { 'Authorization': 'Bearer ' + token }
});

// 7. Bulk update users
const bulkResponse = await fetch('/api/admin/users/bulk-update', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userIds: ['id1', 'id2', 'id3'],
    updateData: { isEmailVerified: true }
  })
});
```

### Frontend Integration Example

```javascript
class UserManagementService {
  constructor(apiBase, token) {
    this.apiBase = apiBase;
    this.token = token;
  }

  async getAllUsers(page = 1, limit = 20, filters = {}) {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...filters
    });

    const response = await fetch(`${this.apiBase}/admin/users?${queryParams}`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });

    return response.json();
  }

  async createUser(userData) {
    const response = await fetch(`${this.apiBase}/admin/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });

    return response.json();
  }

  async updateUserStatus(userId, action, data) {
    const response = await fetch(`${this.apiBase}/admin/users/${userId}/${action}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    return response.json();
  }
}

// Usage
const userService = new UserManagementService('/api', authToken);

// Get users with filtering
const users = await userService.getAllUsers(1, 20, {
  search: 'john',
  role: 'user',
  status: 'active'
});

// Create new user
const newUser = await userService.createUser({
  email: 'user@example.com',
  password: 'password123',
  fullName: 'John Doe',
  username: 'johndoe',
  accountType: 'MYSELF',
  accountCategory: 'PRIMARY_ACCOUNT',
  verificationMethod: 'EMAIL'
});

// Ban user
const banResult = await userService.updateUserStatus('userId', 'ban', {
  banned: true,
  reason: 'Terms violation'
});
```

## Best Practices

### Security Best Practices

1. **Always Validate Permissions**: Check user roles before operations
2. **Log Admin Actions**: Maintain audit trail for all admin operations
3. **Rate Limiting**: Implement rate limiting on admin endpoints
4. **Input Validation**: Validate and sanitize all inputs
5. **Secure Communication**: Use HTTPS for all admin operations

### Performance Best Practices

1. **Pagination**: Always use pagination for large datasets
2. **Indexing**: Ensure database indexes on frequently queried fields
3. **Caching**: Cache user statistics and frequently accessed data
4. **Async Operations**: Use async operations for bulk updates
5. **Connection Pooling**: Use database connection pooling

### User Experience Best Practices

1. **Clear Error Messages**: Provide descriptive error messages
2. **Progress Indicators**: Show progress for bulk operations
3. **Confirmation Dialogs**: Require confirmation for destructive actions
4. **Search Functionality**: Implement robust search capabilities
5. **Export Features**: Allow data export for reporting

### Data Management Best Practices

1. **Soft Deletes**: Consider soft deletes instead of hard deletes
2. **Data Retention**: Implement data retention policies
3. **Backup Strategy**: Regular backups of user data
4. **Privacy Compliance**: Ensure GDPR/privacy law compliance
5. **Data Anonymization**: Anonymize data for analytics

### Monitoring and Alerting

1. **Admin Activity Monitoring**: Monitor all admin activities
2. **Failed Login Tracking**: Track failed admin login attempts
3. **Bulk Operation Alerts**: Alert on large bulk operations
4. **System Health Monitoring**: Monitor API performance
5. **Security Alerts**: Alert on suspicious admin activities

## API Rate Limits

| Endpoint Type | Rate Limit | Window |
|---------------|------------|---------|
| Read Operations | 1000/hour | 1 hour |
| Write Operations | 100/hour | 1 hour |
| Bulk Operations | 10/hour | 1 hour |
| Search Operations | 500/hour | 1 hour |

## Changelog

### Version 1.0.0
- Initial user management system
- Basic CRUD operations
- Role-based access control
- Pagination and filtering
- User statistics
- Bulk operations
- Search functionality

### Future Enhancements
- Advanced analytics dashboard
- User activity timeline
- Automated user lifecycle management
- Enhanced security features
- API versioning
- Webhook notifications
- Advanced reporting capabilities

---

This documentation provides a comprehensive guide to the User Management system. For additional support or questions, please contact the development team. 