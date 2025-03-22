# Authentication Guide for Flutter Integration

This guide provides a step-by-step breakdown of integrating Google and Facebook authentication using Passport.js for a Flutter application without redirecting users outside the app.

## Overview
This backend authentication system uses Passport.js to authenticate users via Google and Facebook OAuth. Upon successful authentication, an `accessToken` and a `refreshToken` are issued, which can be used for further API requests and session management.

## API Endpoints

### Google Authentication
#### 1. Initiate Google Login (Consent Screen)
```
GET /api/auth/google
```
This endpoint redirects users to the Google consent screen where they can select their account for authentication.

#### 2. Handle Google Callback
```
GET /api/auth/google/callback
```
Once the user grants permission, Google redirects them back to this endpoint. It will return an `accessToken` and a `refreshToken` in the response.

Example Response:
```json
{
  "accessToken": "your-access-token",
  "refreshToken": "your-refresh-token",
  "user": {
    "_id": "user-id",
    "email": "user@example.com",
    "fullName": "User Name"
  }
}
```

### Facebook Authentication
#### 1. Initiate Facebook Login (Consent Screen)
```
GET /api/auth/facebook
```
This redirects users to the Facebook login page.

#### 2. Handle Facebook Callback
```
GET /api/auth/facebook/callback
```
Similar to Google, this endpoint returns the `accessToken` and `refreshToken` upon successful authentication.

### Refresh Access Token
```
POST /api/auth/refresh-token
```
**Request Body:**
```json
{
  "refreshToken": "your-refresh-token"
}
```

**Response:**
```json
{
  "accessToken": "new-access-token",
  "refreshToken": "new-refresh-token"
}
```

## Integrating Authentication in Flutter (Without Redirecting Out of the App)

### Setting Up Google Sign-In on Flutter
For Flutter, use the `google_sign_in` package:

#### 1. Install the package
```yaml
dependencies:
  google_sign_in: ^6.1.4
  google_sign_in_web: ^0.12.0
  google_sign_in_ios: ^5.6.2
```

#### 2. Configure Google OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Navigate to **APIs & Services > Credentials**.
4. Click **Create Credentials > OAuth 2.0 Client IDs**.
5. Select **Application Type: Android** (for Android) or **iOS** (for iOS).
6. Set **Package Name** (Android) or **Bundle Identifier** (iOS).
7. Copy **Client ID** and add it to your Flutter app.

#### 3. Implement Google Sign-In in Flutter
```dart
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

final GoogleSignIn _googleSignIn = GoogleSignIn(
  scopes: ['email', 'profile'],
);

Future<void> handleGoogleSignIn() async {
  try {
    final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
    final GoogleSignInAuthentication googleAuth = await googleUser!.authentication;
    final String? idToken = googleAuth.idToken;
    
    if (idToken != null) {
      final response = await http.post(
        Uri.parse("https://yourbackend.com/api/auth/google/callback"),
        body: jsonEncode({"idToken": idToken}),
        headers: {"Content-Type": "application/json"},
      );
      final data = jsonDecode(response.body);
      print("Access Token: ${data['accessToken']}");
    }
  } catch (error) {
    print('Google Sign-In Error: $error');
  }
}
```

### Setting Up Facebook Sign-In on Flutter
Use the `flutter_facebook_auth` package:

#### 1. Install the package
```yaml
dependencies:
  flutter_facebook_auth: ^6.0.2
```

#### 2. Configure Facebook Login
1. Go to [Facebook Developer Console](https://developers.facebook.com/).
2. Create an app and enable Facebook Login.
3. Add the **App ID** and **App Secret**.
4. In **OAuth Redirect URIs**, add your backend callback URL.

#### 3. Implement Facebook Sign-In in Flutter
```dart
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

Future<void> handleFacebookSignIn() async {
  try {
    final LoginResult result = await FacebookAuth.instance.login();
    if (result.status == LoginStatus.success) {
      final AccessToken accessToken = result.accessToken!;
      final response = await http.post(
        Uri.parse("https://yourbackend.com/api/auth/facebook/callback"),
        body: jsonEncode({"accessToken": accessToken.token}),
        headers: {"Content-Type": "application/json"},
      );
      final data = jsonDecode(response.body);
      print("Access Token: ${data['accessToken']}");
    }
  } catch (error) {
    print('Facebook Sign-In Error: $error');
  }
}
```

## Important Notes for Flutter Integration
- On **Android**, add your OAuth client IDs in `android/app/src/main/res/values/strings.xml`.
- On **iOS**, configure OAuth in `Info.plist`.
- **Do not redirect users outside the app**; instead, use native SDKs or WebView.
- The backend expects an `idToken` (Google) or `accessToken` (Facebook) to be sent for validation.
- Store and manage the `refreshToken` securely in Flutter for session persistence.

## Conclusion
This guide outlines how to integrate OAuth authentication with Google and Facebook in a Flutter app without redirecting users out of the app. The backend provides the necessary endpoints, and the frontend must handle OAuth flows accordingly. If the user logs out, revoke the `refreshToken` to ensure security.

