# MyProfile Server API Documentation

Authentication Endpoints
Base URL
https://my-profile-server-api.onrender.com/api/auth
Available Endpoints
1. Register User
POST /register
Content-Type: application/json

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
2. Login
POST /login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecureP@ss123"
}
3. Trouble Logging In (New!)
POST /trouble-login
Content-Type: application/json

{
  "email": "user@example.com",
  "issue": "forgot_password" // Or: "account_locked", "2fa_issues", "other"
}
4. Check Email/Username Availability
GET /check-email/:email
GET /check-username/:username
5. Verify OTP
POST /verify-otp
Content-Type: application/json

{
  "_id": "user_id",
  "otp": "123456",
  "verificationMethod": "email"
}
6. Reset Password Flow
POST /forgot-password
{
  "email": "user@example.com"
}

POST /reset-password
{
  "token": "reset_token",
  "password": "NewSecureP@ss123"
}
Authentication Flow
Registration:

Call /register with user details
Receive OTP for verification
Verify OTP using /verify-otp
User can now login
Login:

Call /login with credentials
Receive access and refresh tokens
Store tokens securely (httpOnly cookies)
Trouble Logging In:

User clicks "Having trouble?"
Show issue selection (forgot password, locked account, 2FA issues)
Call /trouble-login with selected issue
Follow returned nextSteps instructions
Error Handling
All endpoints follow this error format:

{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": {}
  }
}
Security Notes
Rate Limiting:

Login: 5 attempts per 15 minutes
Password Reset: 3 requests per hour
OTP Verification: 3 attempts per code
Token Management:

Access tokens expire in 1 hour
Refresh tokens expire in 7 days
Store tokens in httpOnly cookies
Password Requirements:

Minimum 8 characters
Must include uppercase, lowercase, number, special char
Cannot be same as previous 3 passwords
Support Contacts
For integration support:

Email: support@myprofile.ltd
Phone: +237693028598
API Documentation: /api-docs.html
Testing
Use these credentials in development:

{
  "email": "test@myprofile.ltd",
  "password": "Test@123456"
}

Token Issues:

Always check token expiration
Implement refresh token rotation
Clear tokens on logout
Validation Errors:

Check API response for detailed error messages
Implement client-side validation matching API requirements
Rate Limiting:

Implement exponential backoff
Show user-friendly messages when limited
For more detailed documentation, visit /api-docs.html on the server.
