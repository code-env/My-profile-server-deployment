import * as admin from 'firebase-admin';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Service for sending push notifications via Firebase Cloud Messaging
 */
class FirebaseService {
  private initialized: boolean = false;

  constructor() {
    this.initializeFirebase();
  }

  /**
   * Initialize Firebase Admin SDK
   */
  private initializeFirebase(): void {
    try {
      // Check if Firebase is already initialized
      if (admin.apps.length > 0) {
        this.initialized = true;
        return;
      }

      // Check for service account credentials
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

      if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
        // Initialize with service account file
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        this.initialized = true;
        logger.info('Firebase initialized with service account file');
      } else if (serviceAccountEnv) {
        // Initialize with service account JSON from environment variable
        const serviceAccount = JSON.parse(serviceAccountEnv);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        this.initialized = true;
        logger.info('Firebase initialized with service account from environment');
      } else {
        logger.warn('Firebase service account not found. Push notifications will not work.');
      }
    } catch (error) {
      logger.error('Failed to initialize Firebase:', error);
    }
  }

  /**
   * Send a push notification to a single device
   * @param token FCM device token
   * @param title Notification title
   * @param body Notification body
   * @param data Additional data to send with the notification
   */
  public async sendPushNotification(
    token: string,
    title: string,
    body: string,
    data: Record<string, string> = {}
  ): Promise<boolean> {
    if (!this.initialized) {
      logger.warn('Cannot send push notification: Firebase not initialized');
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        token,
        notification: {
          title,
          body
        },
        data,
        android: {
          notification: {
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            sound: 'default'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default'
            }
          }
        }
      };

      const response = await admin.messaging().send(message);
      logger.info(`Push notification sent: ${response}`);
      return true;
    } catch (error: any) {
      // Check if the token is invalid
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        logger.warn(`Invalid FCM token: ${token}`);
        // Return a special value to indicate the token should be removed
        return false;
      }

      logger.error('Error sending push notification:', error);
      return false;
    }
  }

  /**
   * Send a push notification to multiple devices
   * @param tokens Array of FCM device tokens
   * @param title Notification title
   * @param body Notification body
   * @param data Additional data to send with the notification
   */
  public async sendMulticastPushNotification(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, string> = {}
  ): Promise<{ success: number; failure: number; invalidTokens: string[] }> {
    if (!this.initialized) {
      logger.warn('Cannot send multicast push notification: Firebase not initialized');
      return { success: 0, failure: tokens.length, invalidTokens: [] };
    }

    if (tokens.length === 0) {
      return { success: 0, failure: 0, invalidTokens: [] };
    }

    try {
      // Send messages in batches if there are many tokens
      const batchSize = 500; // FCM has a limit of 500 tokens per request
      const batches = [];

      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        batches.push(batch);
      }

      let totalSuccess = 0;
      let totalFailure = 0;
      const invalidTokens: string[] = [];

      // Process each batch
      for (const batchTokens of batches) {
        // Send individual messages instead of using sendMulticast
        const messages = batchTokens.map(token => ({
          token,
          notification: {
            title,
            body
          },
          data,
          android: {
            notification: {
              clickAction: 'FLUTTER_NOTIFICATION_CLICK',
              sound: 'default'
            }
          },
          apns: {
            payload: {
              aps: {
                sound: 'default'
              }
            }
          }
        }));

        // Send messages in batch using Promise.all
        const responses = await Promise.all(
          messages.map(msg => admin.messaging().send(msg)
            .then(response => ({ success: true, response }))
            .catch(error => ({ success: false, error }))
          )
        );

        // Process responses
        responses.forEach((resp: { success: boolean; error?: any }, idx: number) => {
          if (resp.success) {
            totalSuccess++;
          } else {
            totalFailure++;
            const error = resp.error;
            if (error && (error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered')) {
              invalidTokens.push(batchTokens[idx]);
            }
          }
        });
      }

      logger.info(`Multicast push notification sent: ${totalSuccess} successful, ${totalFailure} failed`);

      return {
        success: totalSuccess,
        failure: totalFailure,
        invalidTokens
      };
    } catch (error) {
      logger.error('Error sending multicast push notification:', error);
      return { success: 0, failure: tokens.length, invalidTokens: [] };
    }
  }

  /**
   * Send a notification about a transaction
   * @param tokens FCM device tokens
   * @param title Notification title
   * @param body Notification body
   * @param transactionData Transaction data
   */
  public async sendTransactionNotification(
    tokens: string[],
    title: string,
    body: string,
    transactionData: {
      id: string;
      type: string;
      amount: number;
      status: string;
    }
  ): Promise<{ success: number; failure: number; invalidTokens: string[] }> {
    // Prepare data payload
    const data = {
      notificationType: 'transaction',
      transactionId: transactionData.id,
      transactionType: transactionData.type,
      transactionAmount: transactionData.amount.toString(),
      transactionStatus: transactionData.status,
      clickAction: 'TRANSACTION_DETAILS',
      // Add timestamp for ordering
      timestamp: Date.now().toString()
    };

    return this.sendMulticastPushNotification(tokens, title, body, data);
  }
}

// Export a singleton instance
export const firebaseService = new FirebaseService();
export default firebaseService;
