import { IUser } from '../models/User';
import { IProfile } from '../interfaces/profile.interface';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      token?: string;
      profile?: IProfile;
    }
  }
}
