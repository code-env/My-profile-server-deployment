import { Document } from 'mongoose';
import { IUser } from '../models/User';

export type UserDocument = IUser & Document;

declare global {
  namespace Express {
    interface Request {
      user?: UserDocument;
    }
  }
}
