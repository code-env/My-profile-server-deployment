import { Request } from 'express';
import { Document } from 'mongoose';
import { IProfile } from '../models/profile.model';

export type Role = 'superadmin' | 'admin' | 'user';

declare global {
  namespace Express {
    interface Request {
      profile?: Document<unknown, {}, IProfile> & IProfile;
    }
  }
}
