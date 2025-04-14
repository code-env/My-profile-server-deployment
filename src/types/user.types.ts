import { Document } from 'mongoose';
import { IUser } from '../models/User';

export type UserDocument = IUser & Document;

declare global {
  namespace Express {
    // Override the base User type from @types/passport
    // This ensures Request.user will be of this type
    interface User extends Document {
      _id: any;
      email: string;
      password: string;
      fullName: string;
      username: string;
      dateOfBirth: Date;
      countryOfResidence: string;
      phoneNumber: string;
      accountType: 'MYSELF' | 'SOMEONE_ELSE';
      accountCategory: 'PRIMARY_ACCOUNT' | 'SECONDARY_ACCOUNT';
      verificationMethod: 'PHONE' | 'EMAIL';
      isEmailVerified: boolean;
      isPhoneVerified: boolean;
      role: 'superadmin' | 'admin' | 'user';
      // Add other properties from IUser as needed
    }
  }
}
