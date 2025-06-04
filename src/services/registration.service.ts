import { User, IUser } from '../models/User';
import { CustomError } from '../utils/errors';
import { generateOTP } from '../utils/crypto';
import EmailService from './email.service';
import { logger } from '../utils/logger';
import mongoose, { Document } from 'mongoose';
import { VerificationMethod } from '../types/auth.types';

// Enhanced type definitions
type RegistrationStep = 
  | 'INITIAL'
  | 'BASIC_INFO'
  | 'ELIGIBILITY'
  | 'CONTACT'
  | 'SECURITY'
  | 'VERIFICATION';

interface IRegistrationResponse {
  userId: string;
  step: RegistrationStep;
  message: string;
  verificationMethod?: VerificationMethod;
}

interface IVerificationData {
  otp: string;
  otpExpiry: Date;
  attempts: number;
}

export class RegistrationService {
  private static readonly OTP_EXPIRY_MINUTES = 10;
  private static readonly MAX_OTP_ATTEMPTS = 3;

  static async initiateRegistration(email: string): Promise<IRegistrationResponse> {
    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new CustomError('EMAIL_EXISTS', 'Email already registered');
      }

      const user = await User.create({
        email,
        registrationStep: 'INITIAL' as RegistrationStep
      }) as IUser & { _id: mongoose.Types.ObjectId };

      return {
        userId: user._id.toString(),
        step: 'BASIC_INFO',
        message: 'Email validated. Please provide basic information.'
      };
    } catch (error) {
      logger.error('Error in initiateRegistration:', error);
      throw error;
    }
  }

  static async updateBasicInfo(
    userId: string,
    accountType: 'MYSELF' | 'SOMEONE_ELSE',
    fullName: string,
    username: string
  ): Promise<IRegistrationResponse> {
    try {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        throw new CustomError('USERNAME_EXISTS', 'Username already taken');
      }

      const user:any = await User.findByIdAndUpdate(
        userId,
        {
          accountType,
          fullName,
          username,
          registrationStep: 'BASIC_INFO' as RegistrationStep
        },
        { new: true }
      ) as IUser & Document;

      if (!user) {
        throw new CustomError('USER_NOT_FOUND', 'User not found');
      }

      return {
        userId: user._id.toString(),
        step: 'ELIGIBILITY',
        message: 'Basic information saved. Please verify your eligibility.'
      };
    } catch (error) {
      logger.error('Error in updateBasicInfo:', error);
      throw error;
    }
  }

  static async updateEligibility(
    userId: string,
    dateOfBirth: string,
    countryOfResidence: string,
    accountCategory: 'PRIMARY_ACCOUNT' | 'SECONDARY_ACCOUNT'
  ): Promise<IRegistrationResponse> {
    try {
      const user:any = await User.findByIdAndUpdate(
        userId,
        {
          dateOfBirth: new Date(dateOfBirth),
          countryOfResidence,
          accountCategory,
          registrationStep: 'ELIGIBILITY' as RegistrationStep
        },
        { new: true }
      ) ;

      if (!user) {
        throw new CustomError('USER_NOT_FOUND', 'User not found');
      }

      return {
        userId: user._id.toString(),
        step: 'CONTACT',
        message: 'Eligibility verified. Please provide contact information.'
      };
    } catch (error) {
      logger.error('Error in updateEligibility:', error);
      throw error;
    }
  }

  static async updateContact(
    userId: string,
    phoneNumber: string,
    verificationMethod: VerificationMethod
  ): Promise<IRegistrationResponse> {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          phoneNumber,
          verificationMethod,
          registrationStep: 'CONTACT' as RegistrationStep
        },
        { new: true }
      ) as any;

      if (!user) {
        throw new CustomError('USER_NOT_FOUND', 'User not found');
      }

      return {
        userId: user._id.toString(),
        step: 'SECURITY',
        message: 'Contact information saved. Please set up your security.'
      };
    } catch (error) {
      logger.error('Error in updateContact:', error);
      throw error;
    }
  }

  static async setupSecurity(
    userId: string,
    password: string
  ): Promise<IRegistrationResponse> {
    try {
      const user:any = await User.findById(userId) as IUser & Document;
      if (!user) {
        throw new CustomError('USER_NOT_FOUND', 'User not found');
      }

      const otp = generateOTP(6);
      const otpExpiry = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

      const verificationData: IVerificationData = {
        otp,
        otpExpiry,
        attempts: 0
      };

      await User.findByIdAndUpdate(
        userId,
        {
          password,
          verificationData,
          registrationStep: 'VERIFICATION' as RegistrationStep
        },
        { new: true }
      );

      if (user.verificationMethod === 'EMAIL') {
        await EmailService.sendAccountVerificationOTP(user.email, otp);
      } else {
        throw new CustomError('SMS_NOT_IMPLEMENTED', 'SMS service not implemented');
      }
const id = user._id.toString();
      return {
        userId: user._id.toString() as string,
        step: 'VERIFICATION',
        verificationMethod: user.verificationMethod,
        message: `Security setup complete. Please verify your ${user.verificationMethod.toLowerCase()}.`
      };
    } catch (error) {
      logger.error('Error in setupSecurity:', error);
      throw error;
    }
  }

  static async verifyOTP(
    userId: string,
    otp: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new CustomError('USER_NOT_FOUND', 'User not found');
      }

      if (!user.verificationData.otp || !user.verificationData.otpExpiry) {
        throw new CustomError('NO_OTP_FOUND', 'No OTP request found');
      }

      if (user.verificationData.otpExpiry < new Date()) {
        throw new CustomError('OTP_EXPIRED', 'OTP has expired');
      }

      if (user.verificationData.attempts >= this.MAX_OTP_ATTEMPTS) {
        throw new CustomError('MAX_ATTEMPTS_EXCEEDED', 'Maximum verification attempts exceeded');
      }

      if (user.verificationData.otp !== otp) {
        await User.findByIdAndUpdate(userId, {
          $inc: { 'verificationData.attempts': 1 }
        });
        throw new CustomError('INVALID_OTP', 'Invalid OTP');
      }

      // Mark verification as complete based on method
      const updateData: any = {
        'verificationData.otp': null,
        'verificationData.otpExpiry': null,
        'verificationData.attempts': 0
      };

      if (user.verificationMethod === 'EMAIL') {
        updateData.isEmailVerified = true;
      } else {
        updateData.isPhoneVerified = true;
      }

      await User.findByIdAndUpdate(userId, updateData);

      return {
        success: true,
        message: 'Verification successful'
      };
    } catch (error) {
      logger.error('Error in verifyOTP:', error);
      throw error;
    }
  }
}
