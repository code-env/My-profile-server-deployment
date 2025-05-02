// Type declarations for passport-related modules
declare module 'passport-linkedin-oauth2' {
  import { Strategy as PassportStrategy } from 'passport';

  export interface Profile {
    id: string;
    displayName: string;
    emails?: Array<{ value: string }>;
    photos?: Array<{ value: string }>;
  }

  export interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
    state?: boolean;
  }

  export class Strategy implements PassportStrategy {
    constructor(
      options: StrategyOptions,
      verify: (
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: (error: Error | null, user?: any) => void
      ) => void
    );

    name: string;
    authenticate(req: any, options?: any): void;
  }
}

// Add missing types for jsonwebtoken
declare module 'jsonwebtoken' {
  // Define StringValue type similar to the original definition
  type StringValue = string | string[];

  export interface SignOptions {
    expiresIn?: StringValue | number;
  }

  export function sign(
    payload: string | object | Buffer,
    secretOrPrivateKey: string | Buffer,
    options?: SignOptions
  ): string;

  export function verify(token: any, arg1: string): { userId: string; } {
    throw new Error('Function not implemented.');
  }
}
