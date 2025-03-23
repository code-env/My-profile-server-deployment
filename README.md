# MyProfile Server API Documentation [`UPDATED`]

## Authentication Endpoints

### Base URL
```
https://my-profile-server-api.onrender.com/api/auth
```

## **Available Endpoints**

### **1. Register User**
**POST** `/register`

**Content-Type:** `application/json`
```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123",
  "fullName": "John Doe",
  "username": "johndoe",
  "accountType": "MYSELF",
  "dateOfBirth": "1990-01-01",
  "phoneNumber": "+237693028598",
  "countryOfResidence": "United States",
  "verificationMethod": "EMAIL",
  "accountCategory": "PRIMARY_ACCOUNT"
}
```

---

### **2. Login**
**POST** `/login`

**Content-Type:** `application/json`
```json
{
  "identifier": "nfondrew@gmail.com",
  "password": "SecureP@ss123"
}
```

**Response**
```json
{
    "success": true,
    "user": {
        "id": "67dfa4002757a088dd347c31"
    },
    "message": "Valid credentials"
}
```

---

### **3. Trouble Logging In**
**POST** `/trouble-login`

**Content-Type:** `application/json`
```json
{
  "email": "user@example.com",
  "issue": "forgot_password" // Or: "account_locked", "2fa_issues", "other"
}
```

---

### **4. Check Email/Username Availability**
- **GET** `/check-email/:email`
- **GET** `/check-username/:username`

---

### **5. Resend OTP**
use this to request otp during login too

**POST** `/resend-otp`

**Content-Type:** `application/json`
```json
{
    "_id": "67dfa4002757a088dd347c31",
    "verificationMethod": "EMAIL"
}
```

**Response**
```json
{
    "success": true,
    "message": "OTP resent successfully via EMAIL:  nfondrew@gmail.com ",
    "userId": "67dfa4002757a088dd347c31",
    "otp": "382457"
}
```

---

### **6. Verify OTP**
**POST** `/verify-otp`

**Content-Type:** `application/json`
```json
{
    "_id": "67dfa4002757a088dd347c31",
    "otp": "364861",
    "verificationMethod": "EMAIL"
}
```

**Response**
```json
{
    "success": true,
    "message": "OTP verified successfully",
    "tokens": {
        "accessToken": "",
        "refreshToken": ""
    },
    "user": {
        "_id": "67dfa4002757a088dd347c31",
        "email": "nfondrew@gmail.com",
        "username": "nfondrew",
        "fullname": "John Doe"
    }
}
```

---

### **7. Reset Password Flow**
**POST** `/forgot-password`
```json
{
  "email": "user@example.com"
}
```

**POST** `/reset-password`
```json
{
  "token": "reset_token",
  "password": "NewSecureP@ss123"
}
```

---

### **8. Get User Profile**
**GET** `/user/:id`

**Response**
```json
{
    "success": true,
    "user": {
        "verificationData": {
            "attempts": 0
        },
        "subscription": {
            "limitations": {
                "maxProfiles": 1,
                "maxGalleryItems": 10,
                "maxFollowers": 100
            },
            "plan": "free",
            "features": [],
            "startDate": "2025-03-23T06:02:40.365Z"
        },
        "biometricAuth": {
            "enabled": false,
            "methods": [],
            "devices": []
        },
        "notifications": {
            "email": true,
            "marketing": false,
            "push": true,
            "sms": false
        },
        "social": {
            "followers": [],
            "following": [],
            "blockedUsers": []
        },
        "otpData": {
            "attempts": 0
        },
        "referralRewards": {
            "earnedPoints": 0,
            "pendingPoints": 0,
            "totalReferrals": 0,
            "successfulReferrals": 0,
            "referralHistory": []
        },
        "_id": "67dfa4002757a088dd347c31",
        "email": "nfondrew@gmail.com",
        "fullName": "John Doe",
        "username": "nfondrew",
        "dateOfBirth": "1990-01-01T00:00:00.000Z",
        "countryOfResidence": "United States",
        "phoneNumber": "+237692028598",
        "accountType": "MYSELF",
        "signupType": "email",
        "accountCategory": "PRIMARY_ACCOUNT",
        "verificationMethod": "EMAIL",
        "isEmailVerified": true,
        "isPhoneVerified": false,
        "refreshTokens": [
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        ],
        "lastLogin": "2025-03-23T07:30:05.042Z",
        "failedLoginAttempts": 0,
        "role": "user",
        "profiles": [],
        "referrals": [],
        "isTwoFactorEnabled": false,
        "sessions": [],
        "devices": [],
        "createdAt": "2025-03-23T06:02:40.369Z",
        "updatedAt": "2025-03-23T07:32:25.982Z",
        "referralCode": "ECVVHSW9"
    }
}
```

---

## **Authentication Flow**

### **Registration:**
1. Call `/register` with user details.
2. Receive OTP for verification.
3. Verify OTP using `/verify-otp`.
4. User can now log in.

### **Login:**
1. Call `/login` with credentials.
2. Receive access and refresh tokens.
3. Store tokens securely (`httpOnly` cookies).

### **Trouble Logging In:**
1. User clicks "Having trouble?"
2. Show issue selection (forgot password, locked account, 2FA issues).
3. Call `/trouble-login` with selected issue.
4. Follow returned `nextSteps` instructions.

---

## **Error Handling**
All endpoints follow this error format:
```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

---

## **Security Notes**

### **Rate Limiting:**
- **Login:** 5 attempts per 15 minutes.
- **Password Reset:** 3 requests per hour.
- **OTP Verification:** 3 attempts per code.

### **Token Management:**
- **Access tokens** expire in **1 hour**.
- **Refresh tokens** expire in **7 days**.
- Store tokens in `httpOnly` cookies.

### **Password Requirements:**
- Minimum **8 characters**.
- Must include **uppercase, lowercase, number, special character**.
- Cannot be the same as previous **3 passwords**.

---

## **Support Contacts**
For integration support:
- **Email:** support@myprofile.ltd
- **Phone:** +237693028598
- **API Documentation:** [Documentation](https://my-profile-server-api.onrender.com/api/auth/#resend-otp)

---

## **Testing**

Use these credentials in development:
```json
{
  "email": "test@myprofile.ltd",
  "password": "Test@123456"
}
```
