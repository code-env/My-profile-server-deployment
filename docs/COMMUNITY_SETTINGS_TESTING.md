# Community Settings API Testing Guide

This document provides comprehensive testing instructions for all the new community settings endpoints that integrate the existing `SettingsModel` with community functionality.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [API Endpoints Overview](#api-endpoints-overview)
3. [HTTP Tests (REST Client)](#http-tests-rest-client)
4. [Node.js Test Script](#nodejs-test-script)
5. [Database Service Tests](#database-service-tests)
6. [Manual Testing with cURL](#manual-testing-with-curl)
7. [Test Scenarios](#test-scenarios)
8. [Expected Responses](#expected-responses)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

Before testing, ensure you have:

- ✅ Server running on your specified port (default: 3000)
- ✅ MongoDB connection established
- ✅ Valid JWT authentication token
- ✅ At least one community profile created
- ✅ REST Client extension (for VS Code/Cursor) or Postman

## API Endpoints Overview

### Core Settings Endpoints
- `GET /api/communities/:id/settings` - Get all community settings
- `PUT /api/communities/:id/settings` - Update general community settings

### Specialized Settings Endpoints
- `PUT /api/communities/:id/settings/notifications` - Update notification preferences
- `PUT /api/communities/:id/settings/privacy` - Update privacy and visibility settings
- `GET /api/communities/:id/settings/moderation` - Get moderation settings
- `PUT /api/communities/:id/settings/moderation` - Update moderation settings
- `PUT /api/communities/:id/settings/specific` - Update specific community setting
- `GET /api/communities/:id/settings/specific/:key` - Get specific community setting

## HTTP Tests (REST Client)

Create a file named `community-settings.http` and add the following tests:

```http
### Community Settings API Tests
### Replace variables with your actual values

@baseUrl = http://localhost:3000
@communityId = 64f1234567890abcdef12345
@authToken = your-jwt-token-here

### 1. Get Community Settings (Creates defaults if none exist)
GET {{baseUrl}}/api/communities/{{communityId}}/settings
Authorization: Bearer {{authToken}}

### 2. Update General Community Settings
PUT {{baseUrl}}/api/communities/{{communityId}}/settings
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "general": {
    "regional": {
      "language": "es",
      "currency": "EUR",
      "country": "ES",
      "areaCode": "+34",
      "numberFormat": "comma",
      "dateFormat": "DD/MM/YYYY"
    },
    "appSections": {
      "enabledModules": ["announcements", "discussions", "events", "members", "marketplace"],
      "layoutOrder": ["announcements", "events", "discussions", "members", "marketplace"]
    },
    "time": {
      "timeZone": "Europe/Madrid",
      "timeFormat": "24h",
      "dateFormat": "DD/MM/YYYY",
      "calendarType": "Gregorian",
      "weekStartDay": "Monday",
      "bufferTimeMinutes": 15,
      "slotDurationMinutes": 60,
      "maxBookingsPerDay": 8,
      "isAvailable": true
    },
    "appSystem": {
      "version": "1.0.0",
      "build": "1.0.0",
      "permissions": {
        "camera": false,
        "microphone": false,
        "storage": true,
        "notifications": true
      },
      "allowNotifications": true,
      "backgroundActivity": false
    }
  },
  "specificSettings": {
    "communityType": "private",
    "joinApproval": "manual",
    "memberInvitePermission": "moderators",
    "postingPermission": "members",
    "moderationLevel": "standard"
  }
}

### 3. Update Notification Settings
PUT {{baseUrl}}/api/communities/{{communityId}}/settings/notifications
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "channels": {
    "push": true,
    "email": false,
    "inApp": true,
    "text": false
  },
  "general": {
    "allNotifications": true,
    "frequency": "daily",
    "sound": true,
    "vibration": false
  },
  "communication": {
    "chat": { "push": false, "email": false, "inApp": true },
    "post": { "push": true, "email": true, "inApp": true },
    "reactions": { "push": false, "email": false, "inApp": true }
  },
  "networking": {
    "connections": { "push": true, "email": true, "inApp": true },
    "invitations": { "push": true, "email": true, "inApp": true }
  }
}

### 4. Update Privacy Settings
PUT {{baseUrl}}/api/communities/{{communityId}}/settings/privacy
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "Visibility": {
    "profile": {
      "profile": { "level": "Public", "customUsers": [] },
      "status": { "level": "ConnectionsOnly", "customUsers": [] },
      "activity": { "level": "OnlyMe", "customUsers": [] }
    },
    "circles": {
      "connections": { "level": "Public", "customUsers": [] },
      "following": { "level": "ConnectionsOnly", "customUsers": [] }
    },
    "engagement": {
      "posts": { "level": "Public", "customUsers": [] },
      "calender": { "level": "ConnectionsOnly", "customUsers": [] }
    }
  },
  "permissions": {
    "visit": { "level": "Public", "customUsers": [] },
    "request": { "level": "Public", "customUsers": [] },
    "saveContact": { "level": "ConnectionsOnly", "customUsers": [] },
    "share": { "level": "ConnectionsOnly", "customUsers": [] },
    "followMe": { "level": "Public", "customUsers": [] },
    "chatWithMe": { "level": "ConnectionsOnly", "customUsers": [] },
    "callMe": { "level": "ConnectionsOnly", "customUsers": [] }
  }
}

### 5. Get Moderation Settings
GET {{baseUrl}}/api/communities/{{communityId}}/settings/moderation
Authorization: Bearer {{authToken}}

### 6. Update Moderation Settings
PUT {{baseUrl}}/api/communities/{{communityId}}/settings/moderation
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "communityType": "restricted",
  "joinApproval": "invite-only",
  "memberInvitePermission": "admins",
  "postingPermission": "moderators",
  "moderationLevel": "strict",
  "autoModeration": true,
  "contentFiltering": "strict",
  "reportThreshold": 2,
  "blockingSettings": {
    "blockNewConnectionRequests": true,
    "blockKeywords": ["spam", "inappropriate", "offensive", "scam"],
    "restrictInteractions": false,
    "reportAndBlockEnabled": true
  }
}

### 7. Update Specific Community Setting
PUT {{baseUrl}}/api/communities/{{communityId}}/settings/specific
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "key": "maxMembersPerDay",
  "value": 50
}

### 8. Get Specific Community Setting
GET {{baseUrl}}/api/communities/{{communityId}}/settings/specific/maxMembersPerDay
Authorization: Bearer {{authToken}}

### 9. Update Discovery Settings
PUT {{baseUrl}}/api/communities/{{communityId}}/settings
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "discovery": {
    "bySearch": true,
    "byQRCode": true,
    "byNearby": false,
    "bySuggestions": true,
    "byNFC": false,
    "byContactSync": false,
    "discoveryByTags": true,
    "discoveryBySkills": false,
    "discoveryByProfileType": true,
    "contactSyncDiscovery": false,
    "trendingListings": true
  }
}

### 10. Update Security Settings
PUT {{baseUrl}}/api/communities/{{communityId}}/settings
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "security": {
    "general": {
      "passcode": false,
      "appLock": true,
      "changeEmail": false,
      "changePhone": false,
      "changePassword": true
    },
    "authentication": {
      "twoFactorAuth": true,
      "googleAuthenticator": false,
      "rememberDevice": false,
      "OtpMethods": {
        "email": true,
        "phoneNumber": false
      }
    },
    "biometrics": {
      "biometricLoginEnabled": false,
      "requireBiometricForSensitiveActions": false
    },
    "accessControls": {
      "sessionTimeout": 30,
      "remoteLogoutFromAll": true
    }
  }
}

### 11. Update Payment Settings
PUT {{baseUrl}}/api/communities/{{communityId}}/settings
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "pay": {
    "autoPay": {
      "autoRenewalEnabled": true,
      "reminderDays": 7
    },
    "subscriptions": {
      "subscriptionReminderDays": 3
    },
    "myPts": {
      "earningEnabled": true,
      "spendingRules": ["community_events", "premium_features"]
    }
  }
}

### 12. Update Data Settings
PUT {{baseUrl}}/api/communities/{{communityId}}/settings
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "dataSettings": {
    "downloadMyData": true,
    "deleteMyData": false,
    "clearActivityLogs": false,
    "dataSharingPreferences": true,
    "autoDataBackup": true,
    "activityLogsEnabled": true,
    "consentHistoryEnabled": true
  }
}

### 13. Test Multiple Specific Settings
PUT {{baseUrl}}/api/communities/{{communityId}}/settings/specific
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "key": "welcomeMessage",
  "value": "Welcome to our amazing community! Please read the rules."
}

###
PUT {{baseUrl}}/api/communities/{{communityId}}/settings/specific
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "key": "maxPostsPerDay",
  "value": 10
}

###
PUT {{baseUrl}}/api/communities/{{communityId}}/settings/specific
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "key": "allowGuestViewing",
  "value": false
}

### 14. Get All Specific Settings (by getting full settings)
GET {{baseUrl}}/api/communities/{{communityId}}/settings
Authorization: Bearer {{authToken}}

### 15. Test Error Cases

# Invalid community ID
GET {{baseUrl}}/api/communities/invalid-id/settings
Authorization: Bearer {{authToken}}

# Missing authentication
GET {{baseUrl}}/api/communities/{{communityId}}/settings

# Invalid specific setting key
GET {{baseUrl}}/api/communities/{{communityId}}/settings/specific/nonexistent
Authorization: Bearer {{authToken}}

### 16. Test Minimal Required Fields Update
PUT {{baseUrl}}/api/communities/{{communityId}}/settings
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "general": {
    "regional": {
      "language": "fr",
      "currency": "EUR",
      "country": "FR",
      "areaCode": "+33"
    },
    "time": {
      "timeZone": "Europe/Paris",
      "timeFormat": "24h"
    },
    "appSystem": {
      "version": "1.0.0",
      "build": "1.0.0"
    }
  }
}
```

## Node.js Test Script

Create `test-community-settings.js`:

```javascript
const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000';
const AUTH_TOKEN = 'your-jwt-token-here';
const COMMUNITY_ID = '64f1234567890abcdef12345';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function runAllTests() {
  console.log('🚀 Starting Comprehensive Community Settings Tests...\n');

  const tests = [
    testGetInitialSettings,
    testUpdateGeneralSettings,
    testUpdateNotificationSettings,
    testUpdatePrivacySettings,
    testGetModerationSettings,
    testUpdateModerationSettings,
    testSpecificSettings,
    testDiscoverySettings,
    testSecuritySettings,
    testPaymentSettings,
    testDataSettings,
    testErrorCases,
    testFinalVerification
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test();
      console.log('✅ PASSED\n');
      passed++;
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      console.log('📝 Details:', error.response?.data || error.message);
      console.log('');
      failed++;
    }
  }

  console.log('📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
}

async function testGetInitialSettings() {
  console.log('1️⃣ Testing: Get Initial Settings');
  const response = await api.get(`/api/communities/${COMMUNITY_ID}/settings`);
  
  if (!response.data.success) throw new Error('Response not successful');
  if (!response.data.data.general) throw new Error('General settings missing');
  if (!response.data.data.notifications) throw new Error('Notification settings missing');
  
  console.log('📊 Default language:', response.data.data.general.regional.language);
  console.log('📊 Default community type:', response.data.data.specificSettings?.communityType || 'Not set');
}

async function testUpdateGeneralSettings() {
  console.log('2️⃣ Testing: Update General Settings');
  const response = await api.put(`/api/communities/${COMMUNITY_ID}/settings`, {
    general: {
      regional: {
        language: 'fr',
        currency: 'EUR',
        country: 'FR',
        areaCode: '+33',
        numberFormat: 'comma',
        dateFormat: 'DD/MM/YYYY'
      },
      appSections: {
        enabledModules: ['announcements', 'discussions', 'events'],
        layoutOrder: ['announcements', 'events', 'discussions']
      },
      time: {
        timeZone: 'Europe/Paris',
        timeFormat: '24h',
        dateFormat: 'DD/MM/YYYY',
        calendarType: 'Gregorian',
        weekStartDay: 'Monday'
      },
      appSystem: {
        version: '1.0.0',
        build: '1.0.0',
        permissions: {
          camera: false,
          microphone: false,
          storage: true,
          notifications: true
        }
      }
    },
    specificSettings: {
      communityType: 'private',
      joinApproval: 'manual',
      memberInvitePermission: 'moderators'
    }
  });
  
  if (!response.data.success) throw new Error('Update failed');
  console.log('📊 Updated language:', response.data.data.general.regional.language);
  console.log('📊 Updated area code:', response.data.data.general.regional.areaCode);
}

async function testUpdateNotificationSettings() {
  console.log('3️⃣ Testing: Update Notification Settings');
  const response = await api.put(`/api/communities/${COMMUNITY_ID}/settings/notifications`, {
    channels: {
      push: false,
      email: true,
      inApp: true
    },
    general: {
      frequency: 'weekly'
    },
    communication: {
      chat: { push: false, email: true, inApp: true }
    }
  });
  
  if (!response.data.success) throw new Error('Notification update failed');
  console.log('📊 Email notifications:', response.data.data.notifications.channels.email);
}

async function testUpdatePrivacySettings() {
  console.log('4️⃣ Testing: Update Privacy Settings');
  const response = await api.put(`/api/communities/${COMMUNITY_ID}/settings/privacy`, {
    Visibility: {
      profile: {
        profile: { level: 'ConnectionsOnly', customUsers: [] }
      }
    },
    permissions: {
      visit: { level: 'Public', customUsers: [] }
    }
  });
  
  if (!response.data.success) throw new Error('Privacy update failed');
  console.log('📊 Profile visibility updated');
}

async function testGetModerationSettings() {
  console.log('5️⃣ Testing: Get Moderation Settings');
  const response = await api.get(`/api/communities/${COMMUNITY_ID}/settings/moderation`);
  
  if (!response.data.success) throw new Error('Get moderation failed');
  console.log('📊 Community type:', response.data.data.communityType);
  console.log('📊 Join approval:', response.data.data.joinApproval);
}

async function testUpdateModerationSettings() {
  console.log('6️⃣ Testing: Update Moderation Settings');
  const response = await api.put(`/api/communities/${COMMUNITY_ID}/settings/moderation`, {
    moderationLevel: 'strict',
    autoModeration: true,
    contentFiltering: 'strict',
    reportThreshold: 2
  });
  
  if (!response.data.success) throw new Error('Moderation update failed');
  console.log('📊 Moderation level updated to strict');
}

async function testSpecificSettings() {
  console.log('7️⃣ Testing: Specific Settings');
  
  // Set multiple specific settings
  await api.put(`/api/communities/${COMMUNITY_ID}/settings/specific`, {
    key: 'maxMembersPerDay',
    value: 100
  });
  
  await api.put(`/api/communities/${COMMUNITY_ID}/settings/specific`, {
    key: 'welcomeMessage',
    value: 'Welcome to our community!'
  });
  
  // Get specific setting
  const response = await api.get(`/api/communities/${COMMUNITY_ID}/settings/specific/maxMembersPerDay`);
  
  if (response.data.data.value !== 100) throw new Error('Specific setting not saved correctly');
  console.log('📊 Max members per day:', response.data.data.value);
}

async function testDiscoverySettings() {
  console.log('8️⃣ Testing: Discovery Settings');
  const response = await api.put(`/api/communities/${COMMUNITY_ID}/settings`, {
    discovery: {
      bySearch: true,
      byQRCode: false,
      bySuggestions: true,
      discoveryByTags: true
    }
  });
  
  if (!response.data.success) throw new Error('Discovery update failed');
  console.log('📊 Discovery settings updated');
}

async function testSecuritySettings() {
  console.log('9️⃣ Testing: Security Settings');
  const response = await api.put(`/api/communities/${COMMUNITY_ID}/settings`, {
    security: {
      general: {
        appLock: true,
        changeEmail: false
      },
      authentication: {
        twoFactorAuth: true,
        rememberDevice: false
      }
    }
  });
  
  if (!response.data.success) throw new Error('Security update failed');
  console.log('📊 Security settings updated');
}

async function testPaymentSettings() {
  console.log('🔟 Testing: Payment Settings');
  const response = await api.put(`/api/communities/${COMMUNITY_ID}/settings`, {
    pay: {
      autoPay: {
        autoRenewalEnabled: true,
        reminderDays: 5
      },
      myPts: {
        earningEnabled: true
      }
    }
  });
  
  if (!response.data.success) throw new Error('Payment update failed');
  console.log('📊 Payment settings updated');
}

async function testDataSettings() {
  console.log('1️⃣1️⃣ Testing: Data Settings');
  const response = await api.put(`/api/communities/${COMMUNITY_ID}/settings`, {
    dataSettings: {
      autoDataBackup: true,
      activityLogsEnabled: true,
      dataSharingPreferences: false
    }
  });
  
  if (!response.data.success) throw new Error('Data settings update failed');
  console.log('📊 Data settings updated');
}

async function testErrorCases() {
  console.log('1️⃣2️⃣ Testing: Error Cases');
  
  try {
    // Test invalid community ID
    await api.get('/api/communities/invalid-id/settings');
    throw new Error('Should have failed with invalid ID');
  } catch (error) {
    if (error.response?.status !== 400) throw new Error('Wrong error status for invalid ID');
  }
  
  try {
    // Test without authentication
    await axios.get(`${BASE_URL}/api/communities/${COMMUNITY_ID}/settings`);
    throw new Error('Should have failed without auth');
  } catch (error) {
    if (error.response?.status !== 401) throw new Error('Wrong error status for no auth');
  }
  
  console.log('📊 Error cases handled correctly');
}

async function testFinalVerification() {
  console.log('1️⃣3️⃣ Testing: Final Verification');
  const response = await api.get(`/api/communities/${COMMUNITY_ID}/settings`);
  
  const settings = response.data.data;
  
  console.log('📋 Final Settings Summary:');
  console.log('- Language:', settings.general.regional.language);
  console.log('- Currency:', settings.general.regional.currency);
  console.log('- Area Code:', settings.general.regional.areaCode);
  console.log('- Email notifications:', settings.notifications.channels.email);
  console.log('- App lock:', settings.security.general.appLock);
  console.log('- Auto backup:', settings.dataSettings.autoDataBackup);
  
  if (settings.general.regional.language !== 'fr') {
    throw new Error('Language setting not persisted');
  }
  
  if (settings.general.regional.areaCode !== '+33') {
    throw new Error('Area code setting not persisted');
  }
  
  console.log('📊 All settings verified successfully');
}

// Run tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests };
```

## Database Service Tests

Create `test-service-direct.js`:

```javascript
const mongoose = require('mongoose');
const { CommunityService } = require('./src/services/community.service');
const { ProfileModel } = require('./src/models/profile.model');
const { SettingsModel } = require('./src/models/settings');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mypts-test';

async function testServiceDirect() {
  console.log('🧪 Testing Community Settings Service Directly...\n');
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const communityService = new CommunityService();
    
    // Create test community
    const testCommunity = await ProfileModel.create({
      profileType: 'community',
      profileInformation: {
        title: 'Test Community',
        username: `test-${Date.now()}`,
        creator: new mongoose.Types.ObjectId(),
        createdAt: new Date()
      },
      members: [],
      groups: [],
      sections: []
    });
    
    const communityId = testCommunity._id.toString();
    console.log('✅ Test community created:', communityId);
    
    // Test all service methods
    console.log('\n1️⃣ Testing getCommunitySettings...');
    const settings = await communityService.getCommunitySettings(communityId);
    console.log('✅ Settings created with defaults');
    
    console.log('\n2️⃣ Testing updateCommunitySettings...');
    await communityService.updateCommunitySettings(communityId, {
      general: { regional: { language: 'de', currency: 'EUR' } },
      specificSettings: { communityType: 'restricted', joinApproval: 'invite-only' }
    });
    console.log('✅ General settings updated');
    
    console.log('\n3️⃣ Testing updateCommunityNotificationSettings...');
    await communityService.updateCommunityNotificationSettings(communityId, {
      channels: { email: false, push: true },
      general: { frequency: 'daily' }
    });
    console.log('✅ Notification settings updated');
    
    console.log('\n4️⃣ Testing updateCommunityPrivacySettings...');
    await communityService.updateCommunityPrivacySettings(communityId, {
      Visibility: {
        profile: { profile: { level: 'OnlyMe', customUsers: [] } }
      }
    });
    console.log('✅ Privacy settings updated');
    
    console.log('\n5️⃣ Testing getCommunityModerationSettings...');
    const modSettings = await communityService.getCommunityModerationSettings(communityId);
    console.log('✅ Moderation settings retrieved:', modSettings.communityType);
    
    console.log('\n6️⃣ Testing updateCommunityModerationSettings...');
    await communityService.updateCommunityModerationSettings(communityId, {
      moderationLevel: 'relaxed',
      autoModeration: false,
      reportThreshold: 10
    });
    console.log('✅ Moderation settings updated');
    
    console.log('\n7️⃣ Testing specific settings...');
    await communityService.updateCommunitySpecificSetting(communityId, 'customRule', 'No spam allowed');
    const customRule = await communityService.getCommunitySpecificSetting(communityId, 'customRule');
    console.log('✅ Specific setting:', customRule);
    
    // Verify final state
    console.log('\n8️⃣ Final verification...');
    const finalSettings = await communityService.getCommunitySettings(communityId);
    console.log('📊 Final language:', finalSettings.general.regional.language);
    console.log('📊 Final community type:', finalSettings.specificSettings?.get('communityType'));
    console.log('📊 Custom rule:', finalSettings.specificSettings?.get('customRule'));
    
    // Cleanup
    await ProfileModel.findByIdAndDelete(communityId);
    await SettingsModel.findOneAndDelete({ userId: communityId });
    console.log('✅ Cleanup completed');
    
    console.log('\n🎉 All service tests passed!');
    
  } catch (error) {
    console.error('❌ Service test failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  testServiceDirect();
}
```

## Manual Testing with cURL

### Basic Commands

```bash
# Set variables
export BASE_URL="http://localhost:3000"
export COMMUNITY_ID="your-community-id"
export AUTH_TOKEN="your-jwt-token"

# Get settings
curl -H "Authorization: Bearer $AUTH_TOKEN" \
     "$BASE_URL/api/communities/$COMMUNITY_ID/settings"

# Update general settings with all required fields
curl -X PUT \
     -H "Authorization: Bearer $AUTH_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "general": {
         "regional": {
           "language": "it", 
           "currency": "EUR",
           "country": "IT",
           "areaCode": "+39"
         },
         "time": {
           "timeZone": "Europe/Rome",
           "timeFormat": "24h"
         },
         "appSystem": {
           "version": "1.0.0",
           "build": "1.0.0"
         }
       },
       "specificSettings": {
         "communityType": "private",
         "joinApproval": "manual"
       }
     }' \
     "$BASE_URL/api/communities/$COMMUNITY_ID/settings"

# Update notifications
curl -X PUT \
     -H "Authorization: Bearer $AUTH_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "channels": {"push": true, "email": false},
       "general": {"frequency": "weekly"}
     }' \
     "$BASE_URL/api/communities/$COMMUNITY_ID/settings/notifications"

# Get moderation settings
curl -H "Authorization: Bearer $AUTH_TOKEN" \
     "$BASE_URL/api/communities/$COMMUNITY_ID/settings/moderation"

# Update specific setting
curl -X PUT \
     -H "Authorization: Bearer $AUTH_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"key": "maxMembers", "value": 500}' \
     "$BASE_URL/api/communities/$COMMUNITY_ID/settings/specific"
```

## Test Scenarios

### Scenario 1: New Community Setup
1. Create a new community
2. Get initial settings (should create defaults)
3. Update basic settings (language, currency, type)
4. Configure moderation settings
5. Set notification preferences
6. Verify all settings persist

### Scenario 2: Privacy Configuration
1. Update visibility settings for different profile sections
2. Configure permissions for various actions
3. Test custom user lists for visibility
4. Verify privacy settings are applied correctly

### Scenario 3: Moderation Workflow
1. Set community to private with manual approval
2. Configure strict content filtering
3. Set low report threshold
4. Add blocked keywords
5. Test moderation settings retrieval

### Scenario 4: Notification Management
1. Disable all email notifications
2. Enable only critical push notifications
3. Set daily digest frequency
4. Configure category-specific preferences
5. Verify notification settings work

### Scenario 5: Custom Community Features
1. Add custom community-specific settings
2. Set welcome message
3. Configure member limits
4. Add custom rules
5. Test retrieval of specific settings

## Expected Responses

### Successful Response Format
```json
{
  "success": true,
  "data": {
    "userId": "community-id",
    "general": { /* general settings */ },
    "notifications": { /* notification settings */ },
    "security": { /* security settings */ },
    "privacy": { /* privacy settings */ },
    "discovery": { /* discovery settings */ },
    "dataSettings": { /* data settings */ },
    "blockingSettings": { /* blocking settings */ },
    "pay": { /* payment settings */ },
    "specificSettings": { /* Map of community-specific settings */ }
  }
}
```

### Error Response Format
```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400
}
```

### Common Status Codes
- `200` - Success
- `400` - Bad Request (invalid data)
- `401` - Unauthorized (missing/invalid token)
- `404` - Not Found (community doesn't exist)
- `500` - Internal Server Error

## Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Check if JWT token is valid and not expired
   - Ensure Authorization header format: `Bearer <token>`

2. **404 Community Not Found**
   - Verify community ID exists in database
   - Ensure community profileType is 'community'

3. **Settings Not Persisting**
   - Check MongoDB connection
   - Verify SettingsModel schema matches data structure

4. **Type Errors**
   - Ensure specificSettings values match expected types
   - Check that Map structure is handled correctly

5. **Deep Merge Issues**
   - Verify nested object updates don't overwrite existing data
   - Check that arrays are handled properly in updates

6. **⚠️ Validation Errors (MOST COMMON)**
   - **Missing areaCode**: Always include `areaCode` in `general.regional` (e.g., "+1", "+33", "+44")
   - **Missing timeZone**: Always include `timeZone` in `general.time` (e.g., "UTC", "Europe/London")
   - **Missing timeFormat**: Always include `timeFormat` in `general.time` (e.g., "12h", "24h")
   - **Missing version/build**: Always include `version` and `build` in `general.appSystem`

### Required Fields Checklist

When updating community settings, ensure these fields are included:

```json
{
  "general": {
    "regional": {
      "language": "en",     // Required
      "currency": "USD",    // Required
      "country": "US",      // Required
      "areaCode": "+1"      // Required ⚠️
    },
    "time": {
      "timeZone": "UTC",    // Required ⚠️
      "timeFormat": "12h"   // Required ⚠️
    },
    "appSystem": {
      "version": "1.0.0",   // Required ⚠️
      "build": "1.0.0"      // Required ⚠️
    }
  }
}
```

### Debug Commands

```bash
# Check if community exists
curl -H "Authorization: Bearer $AUTH_TOKEN" \
     "$BASE_URL/api/profiles/$COMMUNITY_ID"

# Check MongoDB directly
mongo mypts --eval "db.settings.find({userId: '$COMMUNITY_ID'})"

# Check server logs for errors
tail -f server.log | grep -i error

# Validate required fields before sending
echo '{
  "general": {
    "regional": {"language": "en", "currency": "USD", "country": "US", "areaCode": "+1"},
    "time": {"timeZone": "UTC", "timeFormat": "12h"},
    "appSystem": {"version": "1.0.0", "build": "1.0.0"}
  }
}' | jq .
```

## Performance Testing

### Load Testing with Artillery

Create `artillery-config.yml`:

```yaml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
  variables:
    authToken: 'your-jwt-token'
    communityId: 'your-community-id'

scenarios:
  - name: "Community Settings Load Test"
    requests:
      - get:
          url: "/api/communities/{{ communityId }}/settings"
          headers:
            Authorization: "Bearer {{ authToken }}"
      - put:
          url: "/api/communities/{{ communityId }}/settings"
          headers:
            Authorization: "Bearer {{ authToken }}"
            Content-Type: "application/json"
          json:
            specificSettings:
              testValue: "{{ $randomString() }}"
```

Run with: `artillery run artillery-config.yml`

---

## 🎯 Summary

This comprehensive testing guide covers:

- ✅ **HTTP API Testing** with REST Client
- ✅ **Automated Node.js Testing** with detailed verification
- ✅ **Direct Service Testing** for database operations
- ✅ **Manual cURL Testing** for quick verification
- ✅ **Error Case Testing** for robustness
- ✅ **Performance Testing** for load handling
- ✅ **Troubleshooting Guide** for common issues

Use these tests to ensure your community settings integration works perfectly across all scenarios! 🚀 