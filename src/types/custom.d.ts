// Custom type declarations for modules without official type definitions

// cookie-parser
declare module 'cookie-parser' {
  import { RequestHandler } from 'express';
  
  function cookieParser(secret?: string, options?: any): RequestHandler;
  export = cookieParser;
}

// compression
declare module 'compression' {
  import { RequestHandler } from 'express';
  
  function compression(options?: any): RequestHandler;
  export = compression;
}

// morgan
declare module 'morgan' {
  import { RequestHandler } from 'express';
  
  function morgan(format: string, options?: any): RequestHandler;
  export = morgan;
}

// passport
declare module 'passport' {
  import { RequestHandler } from 'express';
  
  export interface Authenticator {
    use(strategy: any): void;
    initialize(): RequestHandler;
    session(options?: any): RequestHandler;
    authenticate(strategy: string | string[], options?: any): RequestHandler;
    serializeUser(fn: (user: any, done: (err: any, id?: any) => void) => void): void;
    deserializeUser(fn: (id: any, done: (err: any, user?: any) => void) => void): void;
  }
  
  const passport: Authenticator;
  export = passport;
}

// passport-google-oauth20
declare module 'passport-google-oauth20' {
  import { Request } from 'express';
  
  export interface Profile {
    id: string;
    displayName: string;
    name?: {
      familyName?: string;
      givenName?: string;
      middleName?: string;
    };
    emails?: Array<{
      value: string;
      type?: string;
    }>;
    photos?: Array<{
      value: string;
    }>;
    provider: string;
    _raw: string;
    _json: any;
  }
  
  export interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
    passReqToCallback?: boolean;
  }
  
  export interface VerifyFunction {
    (accessToken: string, refreshToken: string, profile: Profile, done: (error: any, user?: any) => void): void;
  }
  
  export interface VerifyFunctionWithRequest {
    (req: Request, accessToken: string, refreshToken: string, profile: Profile, done: (error: any, user?: any) => void): void;
  }
  
  export class Strategy {
    constructor(options: StrategyOptions, verify: VerifyFunction | VerifyFunctionWithRequest);
    name: string;
    authenticate(req: Request, options?: any): void;
  }
}

// passport-facebook
declare module 'passport-facebook' {
  import { Request } from 'express';
  
  export interface Profile {
    id: string;
    displayName: string;
    name?: {
      familyName?: string;
      givenName?: string;
      middleName?: string;
    };
    emails?: Array<{
      value: string;
      type?: string;
    }>;
    photos?: Array<{
      value: string;
    }>;
    provider: string;
    _raw: string;
    _json: any;
  }
  
  export interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    profileFields?: string[];
    passReqToCallback?: boolean;
  }
  
  export interface VerifyFunction {
    (accessToken: string, refreshToken: string, profile: Profile, done: (error: any, user?: any) => void): void;
  }
  
  export interface VerifyFunctionWithRequest {
    (req: Request, accessToken: string, refreshToken: string, profile: Profile, done: (error: any, user?: any) => void): void;
  }
  
  export class Strategy {
    constructor(options: StrategyOptions, verify: VerifyFunction | VerifyFunctionWithRequest);
    name: string;
    authenticate(req: Request, options?: any): void;
  }
}

// bcryptjs
declare module 'bcryptjs' {
  export function genSalt(rounds?: number): Promise<string>;
  export function hash(data: string, salt: string | number): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
  
  export function genSaltSync(rounds?: number): string;
  export function hashSync(data: string, salt: string | number): string;
  export function compareSync(data: string, encrypted: string): boolean;
}

// nodemailer
declare module 'nodemailer' {
  export interface Transport {
    sendMail(mailOptions: MailOptions): Promise<any>;
  }
  
  export interface MailOptions {
    from?: string;
    to?: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    attachments?: any[];
  }
  
  export function createTransport(options: any): Transport;
}

// qrcode
declare module 'qrcode' {
  export function toDataURL(text: string, options?: any): Promise<string>;
  export function toCanvas(canvas: any, text: string, options?: any): Promise<any>;
  export function toString(text: string, options?: any): Promise<string>;
}

// speakeasy
declare module 'speakeasy' {
  export function generateSecret(options?: any): { base32: string, otpauth_url: string };
  export function totp(options: { secret: string, encoding?: string }): string;
  export function totp.verify(options: { secret: string, encoding?: string, token: string, window?: number }): boolean;
}

// ws
declare module 'ws' {
  import { EventEmitter } from 'events';
  import { Server as HTTPServer } from 'http';
  
  export class WebSocket extends EventEmitter {
    static CONNECTING: number;
    static OPEN: number;
    static CLOSING: number;
    static CLOSED: number;
    
    readyState: number;
    
    constructor(address: string, protocols?: string | string[], options?: any);
    
    close(code?: number, data?: string): void;
    ping(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    pong(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    send(data: any, cb?: (err?: Error) => void): void;
    send(data: any, options: { mask?: boolean, binary?: boolean }, cb?: (err?: Error) => void): void;
    
    on(event: 'close', listener: (code: number, reason: string) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'message', listener: (data: any) => void): this;
    on(event: 'open', listener: () => void): this;
    on(event: 'ping' | 'pong', listener: (data: any) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }
  
  export class Server extends EventEmitter {
    constructor(options?: any, callback?: () => void);
    constructor(callback?: () => void);
    
    close(cb?: (err?: Error) => void): void;
    handleUpgrade(request: any, socket: any, upgradeHead: any, callback: (client: WebSocket) => void): void;
    
    on(event: 'connection', listener: (socket: WebSocket, request: any) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'headers', listener: (headers: string[], request: any) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }
  
  export function createServer(options?: any, connectionListener?: (socket: WebSocket) => void): Server;
  export function connect(address: string, openListener?: () => void): WebSocket;
}
