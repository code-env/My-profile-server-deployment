// import axios from 'axios';
// import { config } from '../config/config';
// import { logger } from '../utils/logger';
// import dotenv from 'dotenv';

// dotenv.config();

// interface SMSPayload {
//     messages: {
//         destinations: { to: string }[];
//         from: string;
//         text: string;
//     }[];
// }

// class InfobipSMSService {
//     private static isReady = false;
//     private readonly baseUrl: string;
//     private readonly apiKey: string;

//     constructor() {
//         this.apiKey = process.env.INFOBIP_API_KEY || '';
//         this.baseUrl = process.env.INFO_BIP_API_URL || 'https://1gn969.api.infobip.com';

//         if (!this.apiKey) {
//             throw new Error('Infobip API key is missing. Please set INFOBIP_API_KEY in your .env file.');
//         }
//     }

//     public static async initialize(): Promise<void> {
//         logger.info('Infobip SMS Service Initialized');
//         this.isReady = true;
//     }

//     public static async cleanup(): Promise<void> {
//         logger.info('Infobip SMS Service Cleanup - No action needed');
//     }

//     public static async sendOTP(phoneNumber: string, otp: string): Promise<void> {
//         const service = new InfobipSMSService();

//         if (!service.isValidPhoneNumber(phoneNumber)) {
//             throw new Error('Invalid phone number format');
//         }

//         const payload: SMSPayload = {
//             messages: [{
//                 destinations: [{ to: phoneNumber }],
//                 from: process.env.INFOBIP_FROM_NUMBER || '',
//                 text: `Your verification code is: ${otp}`
//             }]
//         };

//         try {
//             const response = await axios.post(`${service.baseUrl}/sms/2/text/advanced`, payload, {
//                 headers: {
//                     Authorization: `App ${service.apiKey}`,
//                     'Content-Type': 'application/json',
//                     Accept: 'application/json',
//                 }
//             });

//             logger.info('OTP sent successfully:', response.data);
//         } catch (error) {
//             logger.error('Error sending OTP:', error);
//             throw error;
//         }
//     }

//     private isValidPhoneNumber(phoneNumber: string): boolean {
//         const phoneRegex = /^\+[1-9]\d{1,14}$/;
//         return phoneRegex.test(phoneNumber);
//     }

//     public static isClientReady(): boolean {
//         return this.isReady;
//     }
// }

// export default InfobipSMSService;
