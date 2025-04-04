# Social Authentication API Documentation

This document provides comprehensive information about the social authentication endpoints available in our API. These endpoints allow users to authenticate using various social providers (Google, Facebook, LinkedIn).

## Base URL

```
http://localhost:3000/api
```

## Authentication Flow

1. User clicks on a social login button in your application
2. User is redirected to the social provider's consent screen
3. After granting permission, the user is redirected back to your application
4. The API sets authentication tokens in cookies
5. Your application can then access protected resources using these tokens

## Available Social Providers

- Google
- Facebook
- LinkedIn

## Endpoints

### Google Authentication

#### Initiate Google Authentication

```
GET /auth/google
```

**Description**: Redirects the user to Google's consent screen.

**Usage Example**:

```javascript
// JavaScript/Next.js
window.location.href = 'http://localhost:3000/api/auth/google';

// Flutter
// Use a WebView or the flutter_web_auth package to open this URL
```

#### Google Authentication Callback

```
GET /auth/google/callback
```

**Description**: Callback endpoint that Google redirects to after user grants permission. This endpoint sets authentication tokens in cookies and redirects to `/socials?success=true&provider=google&token={accessToken}`.

**Note**: You don't need to call this endpoint directly. Google will redirect to it automatically.

### Facebook Authentication

#### Initiate Facebook Authentication

```
GET /auth/facebook
```

**Description**: Redirects the user to Facebook's consent screen.

**Usage Example**:

```javascript
// JavaScript/Next.js
window.location.href = 'http://localhost:3000/api/auth/facebook';

// Flutter
// Use a WebView or the flutter_web_auth package to open this URL
```

#### Facebook Authentication Callback

```
GET /auth/facebook/callback
```

**Description**: Callback endpoint that Facebook redirects to after user grants permission. This endpoint sets authentication tokens in cookies and redirects to `/socials?success=true&provider=facebook`.

**Note**: You don't need to call this endpoint directly. Facebook will redirect to it automatically.

### LinkedIn Authentication

#### Initiate LinkedIn Authentication

```
GET /auth/linkedin
```

**Description**: Redirects the user to LinkedIn's consent screen.

**Usage Example**:

```javascript
// JavaScript/Next.js
window.location.href = 'http://localhost:3000/api/auth/linkedin';

// Flutter
// Use a WebView or the flutter_web_auth package to open this URL
```

#### LinkedIn Authentication Callback

```
GET /auth/linkedin/callback
```

**Description**: Callback endpoint that LinkedIn redirects to after user grants permission. This endpoint sets authentication tokens in cookies and redirects to `/socials?success=true&provider=linkedin`.

**Note**: You don't need to call this endpoint directly. LinkedIn will redirect to it automatically.

### Mobile Authentication

#### Google Mobile Authentication

```
POST /auth/google/mobile
```

**Description**: Authenticates a user using a Google ID token obtained from the Google Sign-In SDK for mobile.

**Request Body**:
```json
{
  "idToken": "your_google_id_token"
}
```

**Response**:
```json
{
  "accessToken": "jwt_access_token",
  "refreshToken": "jwt_refresh_token",
  "user": {
    "id": "user_id",
    "email": "user_email",
    "fullName": "user_full_name",
    "username": "username",
    "googleId": "google_id",
    "isEmailVerified": true,
    "signupType": "google",
    "profileImage": "profile_image_url"
  }
}
```

**Usage Example**:

```javascript
// JavaScript/Next.js
fetch('http://localhost:3000/api/auth/google/mobile', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    idToken: googleIdToken
  })
})
.then(response => response.json())
.then(data => console.log(data));

// Flutter
// Using http package
http.post(
  Uri.parse('http://localhost:3000/api/auth/google/mobile'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({'idToken': googleIdToken})
).then((response) {
  final data = jsonDecode(response.body);
  print(data);
});
```

### User Information

#### Get Current User

```
GET /auth/user/me
```

**Description**: Returns information about the currently authenticated user.

**Authentication**: Required (via cookies or Authorization header)

**Response**:
```json
{
  "success": true,
  "user": {
    "id": "user_id",
    "email": "user_email",
    "username": "username",
    "fullName": "user_full_name",
    "profileImage": "profile_image_url",
    "isEmailVerified": true,
    "signupType": "google",
    "googleId": "google_id",
    "facebookId": "facebook_id",
    "linkedinId": "linkedin_id"
  }
}
```

**Usage Example**:

```javascript
// JavaScript/Next.js
fetch('http://localhost:3000/api/auth/user/me', {
  credentials: 'include' // Important to include cookies
})
.then(response => response.json())
.then(data => console.log(data));

// Flutter
// Using http package with cookies
http.get(
  Uri.parse('http://localhost:3000/api/auth/user/me'),
  headers: {
    'Cookie': 'accessToken=your_access_token'
  }
).then((response) {
  final data = jsonDecode(response.body);
  print(data);
});

// Or using Authorization header
http.get(
  Uri.parse('http://localhost:3000/api/auth/user/me'),
  headers: {
    'Authorization': 'Bearer your_access_token'
  }
).then((response) {
  final data = jsonDecode(response.body);
  print(data);
});
```

#### Get User Info from Token

```
GET /auth/user/info
```

**Description**: Returns information about a user based on the provided token.

**Authentication**: Required (via Authorization header)

**Response**:
```json
{
  "success": true,
  "user": {
    "id": "user_id",
    "email": "user_email",
    "fullName": "user_full_name",
    "username": "username",
    "googleId": "google_id",
    "facebookId": "facebook_id",
    "linkedinId": "linkedin_id",
    "signupType": "google",
    "isEmailVerified": true,
    "profileImage": "profile_image_url"
  }
}
```

**Usage Example**:

```javascript
// JavaScript/Next.js
fetch('http://localhost:3000/api/auth/user/info', {
  headers: {
    'Authorization': 'Bearer your_access_token'
  }
})
.then(response => response.json())
.then(data => console.log(data));

// Flutter
// Using http package
http.get(
  Uri.parse('http://localhost:3000/api/auth/user/info'),
  headers: {
    'Authorization': 'Bearer your_access_token'
  }
).then((response) {
  final data = jsonDecode(response.body);
  print(data);
});
```

## Authentication Tokens

The API uses JWT (JSON Web Tokens) for authentication. When a user successfully authenticates, the API sets two cookies:

1. **accessToken**: Used for authenticating requests. Expires after 1 hour.
2. **refreshToken**: Used for obtaining a new access token when it expires. Expires after 7 days.

These tokens are also returned in the response body for mobile applications that don't support cookies.

## Error Handling

All endpoints return appropriate HTTP status codes and error messages in case of failure:

- **400 Bad Request**: Invalid request parameters
- **401 Unauthorized**: Authentication required or invalid token
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server error

Error responses have the following format:

```json
{
  "success": false,
  "message": "Error message",
  "code": "ERROR_CODE",
  "details": {
    // Additional error details if available
  }
}
```

## Implementation Examples

### Web (HTML/JavaScript)

```html
<!-- Login buttons -->
<button id="google-login">Sign in with Google</button>
<button id="facebook-login">Sign in with Facebook</button>
<button id="linkedin-login">Sign in with LinkedIn</button>

<script>
  // Redirect to Google OAuth2 consent screen
  document.getElementById('google-login').addEventListener('click', () => {
    window.location.href = 'http://localhost:3000/api/auth/google';
  });

  // Redirect to Facebook OAuth2 consent screen
  document.getElementById('facebook-login').addEventListener('click', () => {
    window.location.href = 'http://localhost:3000/api/auth/facebook';
  });

  // Redirect to LinkedIn OAuth2 consent screen
  document.getElementById('linkedin-login').addEventListener('click', () => {
    window.location.href = 'http://localhost:3000/api/auth/linkedin';
  });

  // Handle the callback from OAuth providers
  const urlParams = new URLSearchParams(window.location.search);
  const success = urlParams.get('success');
  const provider = urlParams.get('provider');
  
  if (success === 'true' && provider) {
    // Fetch user data
    fetch('http://localhost:3000/api/auth/user/me', {
      credentials: 'include' // Important to include cookies
    })
      .then(response => response.json())
      .then(data => {
        console.log('User data:', data);
        // Display user info or redirect to dashboard
      })
      .catch(error => {
        console.error('Error fetching user data:', error);
      });
  }
</script>
```

### Next.js

```jsx
// pages/login.js
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Login() {
  const router = useRouter();
  const { success, provider } = router.query;

  useEffect(() => {
    // Check if user was redirected after successful authentication
    if (success === 'true' && provider) {
      // Fetch user data
      fetch('/api/auth/user/me', {
        credentials: 'include'
      })
        .then(response => response.json())
        .then(data => {
          console.log('User data:', data);
          // Redirect to dashboard or update state
          router.push('/dashboard');
        })
        .catch(error => {
          console.error('Error fetching user data:', error);
        });
    }
  }, [success, provider, router]);

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  const handleFacebookLogin = () => {
    window.location.href = '/api/auth/facebook';
  };

  const handleLinkedInLogin = () => {
    window.location.href = '/api/auth/linkedin';
  };

  return (
    <div>
      <h1>Login</h1>
      <button onClick={handleGoogleLogin}>Sign in with Google</button>
      <button onClick={handleFacebookLogin}>Sign in with Facebook</button>
      <button onClick={handleLinkedInLogin}>Sign in with LinkedIn</button>
    </div>
  );
}
```

### Flutter

```dart
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:webview_flutter/webview_flutter.dart';
import 'dart:convert';

class SocialLoginPage extends StatelessWidget {
  final String apiUrl = 'http://localhost:3000/api';

  Future<void> _handleGoogleSignIn(BuildContext context) async {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => WebView(
          initialUrl: '$apiUrl/auth/google',
          javascriptMode: JavascriptMode.unrestricted,
          navigationDelegate: (NavigationRequest request) {
            if (request.url.startsWith('http://localhost:3000/socials?success=true')) {
              // Extract token from URL if available
              Uri uri = Uri.parse(request.url);
              String? token = uri.queryParameters['token'];
              
              // Fetch user data
              _getUserData(token);
              
              // Navigate back to app
              Navigator.pop(context);
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      ),
    );
  }

  Future<void> _getUserData(String? token) async {
    try {
      final response = await http.get(
        Uri.parse('$apiUrl/auth/user/info'),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );
      
      if (response.statusCode == 200) {
        final userData = jsonDecode(response.body);
        print('User data: $userData');
        // Store user data or update state
      } else {
        print('Failed to get user data: ${response.body}');
      }
    } catch (e) {
      print('Error getting user data: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Social Login'),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ElevatedButton(
              onPressed: () => _handleGoogleSignIn(context),
              child: Text('Sign in with Google'),
            ),
            ElevatedButton(
              onPressed: () {
                // Similar implementation for Facebook
              },
              child: Text('Sign in with Facebook'),
            ),
            ElevatedButton(
              onPressed: () {
                // Similar implementation for LinkedIn
              },
              child: Text('Sign in with LinkedIn'),
            ),
          ],
        ),
      ),
    );
  }
}
```

## Security Considerations

1. **HTTPS**: Always use HTTPS in production to protect tokens and user data.
2. **Token Storage**: Store tokens securely:
   - Web: Use HttpOnly cookies
   - Mobile: Use secure storage (Keychain for iOS, EncryptedSharedPreferences for Android)
3. **CSRF Protection**: Implement CSRF protection for cookie-based authentication.
4. **Redirect URIs**: Only use registered redirect URIs to prevent open redirect vulnerabilities.

## Troubleshooting

### Common Issues

1. **"Invalid redirect_uri"**: The redirect URI in your code doesn't match what's registered in the social provider's developer console.
2. **"Authentication required"**: The token is missing or invalid.
3. **"User not found"**: The user associated with the token no longer exists.

### Debugging Tips

1. Check browser console for errors
2. Verify that cookies are being set correctly
3. Ensure that the correct client IDs and secrets are being used
4. Verify that redirect URIs are correctly registered in the social provider's developer console

## Support

For additional support or questions, please contact our development team at support@example.com.
