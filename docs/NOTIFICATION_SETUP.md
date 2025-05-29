# MyPts Notification System Setup

This document provides instructions for setting up and configuring the notification system for MyPts.

## Overview

The notification system supports three channels:
1. Email notifications
2. Push notifications (via Firebase Cloud Messaging)
3. Telegram notifications

## Environment Variables

Add the following environment variables to your `.env` file:

```
# Firebase Cloud Messaging
FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/firebase-service-account.json
# OR
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"your-project-id",...}

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

## Setting Up Firebase Cloud Messaging (FCM)

1. Create a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Go to Project Settings > Service Accounts
3. Click "Generate new private key" to download your service account credentials
4. Save the JSON file securely and set the `FIREBASE_SERVICE_ACCOUNT_PATH` environment variable to point to this file
   - Alternatively, you can set the `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable with the contents of the JSON file

## Setting Up Telegram Bot

1. Open Telegram and search for the BotFather (@BotFather)
2. Start a chat with BotFather and send the command `/newbot`
3. Follow the instructions to create a new bot
4. Once created, BotFather will provide a token (e.g., `123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ`)
5. Set the `TELEGRAM_BOT_TOKEN` environment variable with this token
6. Customize your bot with the following commands to BotFather:
   - `/setdescription` - Set a description for your bot
   - `/setabouttext` - Set the about text
   - `/setuserpic` - Set the bot's profile picture
   - `/setcommands` - Set available commands

### Bot Commands

Set up the following commands for your Telegram bot:

```
start - Start the bot and get a welcome message
help - Get help and information about the bot
status - Check your notification status
settings - Manage your notification settings
```

## Client-Side Integration

### Push Notifications

To enable push notifications in your client applications:

1. Add Firebase to your web app or mobile app
2. Request notification permission from users
3. Get the FCM token and send it to your server
4. Store the token in the user's device record

Example for web apps:

```javascript
// Request permission
const permission = await Notification.requestPermission();
if (permission === 'granted') {
  // Get FCM token
  const token = await getToken(messaging, { 
    vapidKey: 'YOUR_VAPID_KEY' 
  });
  
  // Send token to server
  await fetch('/api/user/devices/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token,
      deviceType: 'web',
      deviceName: navigator.userAgent
    }),
  });
}
```

### Telegram Notifications

To enable Telegram notifications, users need to:

1. Start a chat with your bot (@YourBotUsername)
2. Enter their Telegram username in the notification preferences
3. Verify their Telegram account

## Testing the Notification System

### Test Email Notifications

```bash
curl -X POST http://localhost:3000/api/test/notifications/email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{"email":"user@example.com","subject":"Test Notification","message":"This is a test notification"}'
```

### Test Push Notifications

```bash
curl -X POST http://localhost:3000/api/test/notifications/push \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{"title":"Test Notification","message":"This is a test push notification"}'
```

### Test Telegram Notifications

```bash
curl -X POST http://localhost:3000/api/test/notifications/telegram \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{"username":"telegram_username","message":"This is a test Telegram notification"}'
```

## Troubleshooting

### Email Notifications

- Check SMTP settings in your environment variables
- Verify that the email templates exist in the `src/templates` directory
- Check the logs for any errors related to email sending

### Push Notifications

- Verify that the Firebase service account is correctly configured
- Check that the client has granted notification permissions
- Ensure the FCM token is correctly stored in the user's device record

### Telegram Notifications

- Verify that the Telegram bot token is correct
- Ensure the user has started a chat with your bot
- Check that the username provided by the user is correct (with or without the @ symbol)

## Notification Templates

Email templates are located in the `src/templates` directory:

- `notification-email.html` - General notification template
- `transaction-notification.html` - Transaction notification template
- `purchase-confirmation-email.html` - Purchase confirmation template
- `sale-confirmation-email.html` - Sale confirmation template
- `security-alert-email.html` - Security alert template

To add a new template:

1. Create a new HTML file in the `src/templates` directory
2. Use Handlebars syntax for dynamic content
3. Update the `sendEmailNotification` method in `notification.service.ts` to use your new template

## User Preferences

Users can manage their notification preferences in their account settings:

- Email notifications
- Push notifications
- Telegram notifications

Each channel has specific preferences for different types of notifications:
- Transactions
- Transaction updates
- Purchase confirmations
- Sale confirmations
- Security alerts
- Profile views
- Connection requests
- Messages
- Endorsements
- Account updates
