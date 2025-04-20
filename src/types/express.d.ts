import { IProfile } from '../interfaces/profile.interface';
import { IUser } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      token?: string;
      profile?: IProfile;
      licenseValidated?: boolean;
    }
  }
}

export {};
