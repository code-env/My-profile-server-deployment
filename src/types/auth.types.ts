import { z } from 'zod';

export type OTPChannel = 'email' | 'sms';
export type AccountType = 'MYSELF' | 'SOMEONE_ELSE';
export type VerificationMethod = 'PHONE' | 'EMAIL';

// Registration schema with all fields
export const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .regex(/^[a-zA-Z0-9_~]+$/, 'Username can only contain letters, numbers, underscores, and the ~ symbol'),
  accountType: z.enum(['MYSELF', 'SOMEONE_ELSE'], {
    errorMap: () => ({ message: 'Account type must be either MYSELF or SOMEONE_ELSE' }),
  }),
  dateOfBirth: z.string(),
  countryOfResidence: z.string(),
  accountCategory: z.enum(['PRIMARY_ACCOUNT', 'SECONDARY_ACCOUNT']),
  phoneNumber: z.string()
    .regex(/^[\+\-\(\)\s0-9]+$/, 'Please enter a valid phone number'),
  verificationMethod: z.enum(['PHONE', 'EMAIL']),
  referralCode: z.string().optional()
});

// Login schema
export const loginSchema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});

// OTP Verification schema
export const otpVerificationSchema = z.object({
  userId: z.string(),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  verificationMethod: z.enum(['PHONE', 'EMAIL'])
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  userId?: string;
  verificationMethod?: VerificationMethod;
  otpRequired?: boolean;
  otpChannel?: OTPChannel;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  tokens?: AuthTokens;
  user?: {
    id: string;
    email: string;
    fullName: string;
    username: string;
  };
  otpRequired?: boolean;
  otpChannel?: OTPChannel;
}

export interface TokenPayload {
  userId: string;
  type: 'access' | 'refresh';
  exp: number;
  iat: number;
}

export interface OTPVerificationResponse {
  success: boolean;
  message: string;
  userId?: string;
  user: any;
  verificationMethod: VerificationMethod;
  otpRequired: boolean;
  tokens?: AuthTokens;
  otpChannel?: OTPChannel;
}

export interface SanitizedUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  profilePicture?: string;
  registrationStep: string;
  verificationMethod: string;
  lastLogin?: Date;
}
