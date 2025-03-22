# Authentication Guide for Flutter Integration

This guide provides a step-by-step breakdown of integrating Google and Facebook authentication for myprofile application without redirecting users outside the app.

## Overview
This backend authentication system authenticate users via Google and Facebook OAuth. Upon successful authentication, an `accessToken` and a `refreshToken` are issued, which can be used for further API requests and session management.

## API Endpoints

### Google Authentication
#### 1. Initiate Google Login (For Web-Based Authentication)
```
GET /api/sauth/google
```
This endpoint redirects users to the Google consent screen where they can select their account for authentication.

#### 2. Handle Google Callback (For Web-Based Authentication)
```
GET /api/sauth/google/callback
```
Once the user grants permission, Google redirects them back to this endpoint. It will return an `accessToken` and a `refreshToken` in the response.

#### 3. Authenticate Google Sign-In Directly (For Flutter Mobile App)

## The implementation of the consent screen on the mobile is different from the web. So you have to work on that part first and then consume the below route.
```
POST /api/sauth/google/mobile-callback
```
Instead of redirecting the user, the Flutter app will send the `idToken` received from Google Sign-In to this endpoint.

**Request Body:**
```json
{
  "idToken": "your-google-id-token"
}
```

**Example Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2N2RlMzhiOGM4NDk1NjgzNTA2MGFlYjEiLCJlbWFpbCI6ImxvbmZvbnl1eXJvbWFyaWNAZ21haWwuY29tIiwiaWF0IjoxNzQyNjIyMDY2LCJleHAiOjE3NDI2MjI5NjZ9.akN9gg3uUVoft3kJnJrI2TfPB27d7CjSYVRQmX5cbME",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2N2RlMzhiOGM4NDk1NjgzNTA2MGFlYjEiLCJlbWFpbCI6ImxvbmZvbnl1eXJvbWFyaWNAZ21haWwuY29tIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NDI2MjIwNjYsImV4cCI6MTc0MzIyNjg2Nn0.4v_tMAySVCvSm4LxNcuE3llXSeFOti0K2SNdYRmKqfE"
}
```

### Facebook Authentication
#### 1. Initiate Facebook Login (For Web-Based Authentication)
```
GET /api/sauth/facebook
```
This redirects users to the Facebook login page.

#### 2. Handle Facebook Callback (For Web-Based Authentication)
```
GET /api/sauth/facebook/callback
```
Similar to Google, this endpoint returns the `accessToken` and `refreshToken` upon successful authentication.

#### 3. Authenticate Facebook Sign-In Directly (For Flutter Mobile App)
```
POST /api/sauth/facebook/mobile-callback
```
Flutter will send the Facebook `accessToken` to this endpoint.

**Request Body:**
```json
{
  "accessToken": "your-facebook-access-token"
}
```

**Example Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2N2RlMzhiOGM4NDk1NjgzNTA2MGFlYjEiLCJlbWFpbCI6ImxvbmZvbnl1eXJvbWFyaWNAZ21haWwuY29tIiwiaWF0IjoxNzQyNjIyMDY2LCJleHAiOjE3NDI2MjI5NjZ9.akN9gg3uUVoft3kJnJrI2TfPB27d7CjSYVRQmX5cbME",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2N2RlMzhiOGM4NDk1NjgzNTA2MGFlYjEiLCJlbWFpbCI6ImxvbmZvbnl1eXJvbWFyaWNAZ21haWwuY29tIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NDI2MjIwNjYsImV4cCI6MTc0MzIyNjg2Nn0.4v_tMAySVCvSm4LxNcuE3llXSeFOti0K2SNdYRmKqfE"
}
```


### Get new access token using refresh token.

POST /api/auth/refresh-token
```
**Request Body:**
```json
{
    "refreshToken": "eyJhbG..."
}
```

**Responsed body:**
```json
{
    "success": true,
    "tokens": {
        "accessToken": "eyJhbG...",
        "refreshToken": "eyJhbG..."
    }
}
```

### Get new access token using refresh token.

DELETE /api/user/delete/{id}
**Request Body:**
```json
{
    "success": true,
    "tokens": {
        "accessToken": "eyJhbG...",
        "refreshToken": "eyJhbG..."
    }
}
```


