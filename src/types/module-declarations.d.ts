/**
 * Module declarations for packages without TypeScript definitions
 *
 * This file contains declarations for npm packages that don't have their own
 * TypeScript definition files or where the @types/* packages are not properly
 * recognized by the TypeScript compiler.
 */

// cookie-parser
declare module 'cookie-parser' {
  import { RequestHandler } from 'express';

  function cookieParser(secret?: string | string[], options?: any): RequestHandler;
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

  function morgan(format: string | Function, options?: any): RequestHandler;
  export = morgan;
}

// passport
declare module 'passport' {
  import { RequestHandler } from 'express';

  export interface Authenticator {
    use(strategy: any): this;
    use(name: string, strategy: any): this;
    initialize(options?: any): RequestHandler;
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
  import { Strategy as PassportStrategy } from 'passport';

  export interface Profile {
    id: string;
    displayName: string;
    name?: {
      familyName?: string;
      givenName?: string;
      middleName?: string;
    };
    emails?: Array<{ value: string; verified?: boolean }>;
    photos?: Array<{ value: string }>;
    provider: string;
    _raw: string;
    _json: any;
  }

  export interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
    userProfileURL?: string;
    passReqToCallback?: boolean;
  }

  export interface VerifyFunction {
    (accessToken: string, refreshToken: string, profile: Profile, done: (error: any, user?: any) => void): void;
  }

  export class Strategy implements PassportStrategy {
    constructor(options: StrategyOptions, verify: VerifyFunction);
    name: string;
    authenticate(req: any, options?: any): void;
  }
}

// passport-facebook
declare module 'passport-facebook' {
  import { Strategy as PassportStrategy } from 'passport';

  export interface Profile {
    id: string;
    displayName: string;
    name?: {
      familyName?: string;
      givenName?: string;
      middleName?: string;
    };
    emails?: Array<{ value: string }>;
    photos?: Array<{ value: string }>;
    provider: string;
    _raw: string;
    _json: any;
  }

  export interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    profileFields?: string[];
    enableProof?: boolean;
    passReqToCallback?: boolean;
  }

  export interface VerifyFunction {
    (accessToken: string, refreshToken: string, profile: Profile, done: (error: any, user?: any) => void): void;
  }

  export class Strategy implements PassportStrategy {
    constructor(options: StrategyOptions, verify: VerifyFunction);
    name: string;
    authenticate(req: any, options?: any): void;
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

// socket.io-client
declare module 'socket.io-client' {
  interface SocketOptions {
    query?: any;
    reconnection?: boolean;
    reconnectionAttempts?: number;
    reconnectionDelay?: number;
    reconnectionDelayMax?: number;
    timeout?: number;
    autoConnect?: boolean;
    extraHeaders?: { [header: string]: string };
    forceNew?: boolean;
    multiplex?: boolean;
    transports?: string[];
  }

  interface Socket {
    id: string;
    connected: boolean;
    disconnected: boolean;
    open(): Socket;
    connect(): Socket;
    disconnect(): Socket;
    emit(event: string, ...args: any[]): Socket;
    on(event: string, fn: Function): Socket;
    once(event: string, fn: Function): Socket;
    off(event?: string, fn?: Function): Socket;
    close(): Socket;
  }

  function io(uri: string, opts?: SocketOptions): Socket;
  export = io;
}

// nodemailer
declare module 'nodemailer' {
  export interface Transport {
    sendMail(mailOptions: Mail.Options): Promise<any>;
    // Add verify method with callback style
    verify(callback: (error: Error | null, success: boolean) => void): void;
    // Add verify method with promise style (not actually implemented but in our custom code)
    verify(): Promise<boolean>;
  }

  export function createTransport(transport: any, defaults?: any): Transport;

  export namespace Mail {
    export interface Options {
      from?: string;
      to?: string | string[];
      cc?: string | string[];
      bcc?: string | string[];
      subject?: string;
      text?: string;
      html?: string;
      attachments?: Attachment[];
      headers?: any;
    }

    export interface Attachment {
      filename?: string;
      content?: any;
      path?: string;
      contentType?: string;
      cid?: string;
    }
  }
}

// qrcode
declare module 'qrcode' {
  export interface QRCodeOptions {
    version?: number;
    errorCorrectionLevel?: 'low' | 'medium' | 'quartile' | 'high' | 'L' | 'M' | 'Q' | 'H';
    maskPattern?: number;
    toSJISFunc?: Function;
    margin?: number;
    scale?: number;
    width?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  // Add the specific type used in the sharing service
  export interface QRCodeToBufferOptions extends QRCodeOptions {
    type?: 'png' | 'svg' | 'utf8';
  }

  export function toCanvas(canvasElement: any, text: string, options?: QRCodeOptions): Promise<any>;
  export function toDataURL(text: string, options?: QRCodeOptions): Promise<string>;
  export function toString(text: string, options?: QRCodeOptions): Promise<string>;
  export function toFile(path: string, text: string, options?: QRCodeOptions): Promise<any>;
  export function toFileStream(stream: any, text: string, options?: QRCodeOptions): Promise<any>;
  export function toBuffer(text: string, options?: QRCodeToBufferOptions): Promise<Buffer>;
}

// speakeasy
declare module 'speakeasy' {
  export interface GenerateSecretOptions {
    length?: number;
    symbols?: boolean;
    otpauth_url?: boolean;
    name?: string;
    issuer?: string;
  }

  export interface GeneratedSecret {
    ascii: string;
    hex: string;
    base32: string;
    otpauth_url?: string;
  }

  export interface TotpOptions {
    secret: string;
    encoding?: 'ascii' | 'hex' | 'base32';
    step?: number;
    window?: number;
    time?: number;
    digits?: number;
    algorithm?: 'sha1' | 'sha256' | 'sha512';
  }

  export interface TotpVerifyOptions extends TotpOptions {
    token: string;
  }

  export function generateSecret(options?: GenerateSecretOptions): GeneratedSecret;

  export function totp(options: TotpOptions): string;
  export namespace totp {
    export function verify(options: TotpVerifyOptions): boolean;
  }
}

// ws
declare module 'ws' {
  import { EventEmitter } from 'events';
  import { IncomingMessage } from 'http';
  import { Duplex } from 'stream';

  class WebSocket extends EventEmitter {
    static readonly CONNECTING: number;
    static readonly OPEN: number;
    static readonly CLOSING: number;
    static readonly CLOSED: number;

    binaryType: string;
    bufferedAmount: number;
    extensions: string;
    protocol: string;
    readyState: number;
    url: string;

    constructor(address: string, protocols?: string | string[], options?: WebSocket.ClientOptions);

    close(code?: number, data?: string): void;
    ping(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    pong(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    send(data: any, cb?: (err?: Error) => void): void;
    send(data: any, options: { mask?: boolean; binary?: boolean; compress?: boolean; fin?: boolean }, cb?: (err?: Error) => void): void;

    on(event: 'close', listener: (code: number, reason: string) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'message', listener: (data: WebSocket.Data) => void): this;
    on(event: 'open', listener: () => void): this;
    on(event: 'ping' | 'pong', listener: (data: Buffer) => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
  }

  namespace WebSocket {
    export interface ClientOptions {
      protocol?: string;
      handshakeTimeout?: number;
      perMessageDeflate?: boolean | PerMessageDeflateOptions;
      localAddress?: string;
      protocolVersion?: number;
      headers?: { [key: string]: string };
      origin?: string;
      agent?: any;
      host?: string;
      family?: number;
      checkServerIdentity?(servername: string, cert: any): boolean;
      rejectUnauthorized?: boolean;
      maxPayload?: number;
    }

    export interface PerMessageDeflateOptions {
      serverNoContextTakeover?: boolean;
      clientNoContextTakeover?: boolean;
      serverMaxWindowBits?: number;
      clientMaxWindowBits?: number;
      zlibDeflateOptions?: {
        level?: number;
        windowBits?: number;
        memLevel?: number;
        strategy?: number;
      };
      zlibInflateOptions?: {
        windowBits?: number;
      };
      threshold?: number;
      concurrencyLimit?: number;
    }

    export type Data = string | Buffer | ArrayBuffer | Buffer[];

    export interface ServerOptions {
      host?: string;
      port?: number;
      backlog?: number;
      server?: any;
      verifyClient?: VerifyClientCallbackAsync | VerifyClientCallbackSync;
      handleProtocols?: (protocols: string[], request: IncomingMessage) => string | false;
      path?: string;
      noServer?: boolean;
      clientTracking?: boolean;
      perMessageDeflate?: boolean | PerMessageDeflateOptions;
      maxPayload?: number;
    }

    export interface VerifyClientCallbackAsync {
      (info: { origin: string; secure: boolean; req: IncomingMessage }, callback: (res: boolean, code?: number, message?: string) => void): void;
    }

    export interface VerifyClientCallbackSync {
      (info: { origin: string; secure: boolean; req: IncomingMessage }): boolean;
    }

    export class Server extends EventEmitter {
      constructor(options?: ServerOptions, callback?: () => void);

      clients: Set<WebSocket>;

      address(): { port: number; family: string; address: string };
      close(cb?: (err?: Error) => void): void;
      handleUpgrade(request: IncomingMessage, socket: Duplex, upgradeHead: Buffer, callback: (client: WebSocket, request: IncomingMessage) => void): void;
      shouldHandle(request: IncomingMessage): boolean;

      on(event: 'connection', cb: (socket: WebSocket, request: IncomingMessage) => void): this;
      on(event: 'error', cb: (error: Error) => void): this;
      on(event: 'headers', cb: (headers: string[], request: IncomingMessage) => void): this;
      on(event: 'listening', cb: () => void): this;
      on(event: string | symbol, listener: (...args: any[]) => void): this;
    }
  }

  export = WebSocket;
}
