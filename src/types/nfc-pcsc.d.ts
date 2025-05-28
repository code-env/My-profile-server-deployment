// Type definitions for nfc-pcsc
// Project: https://github.com/pokusew/nfc-pcsc
// Definitions by: MyProfile Team

declare module 'nfc-pcsc' {
  import { EventEmitter } from 'events';

  export interface NFCOptions {
    logger?: any;
    scanInterval?: number;
    [key: string]: any;
  }

  export interface Card {
    atr: Buffer;
    standard: string;
    type: number;
    uid: Buffer;
    protocol: number;
    [key: string]: any;
  }

  export class Reader extends EventEmitter {
    reader: {
      name: string;
      [key: string]: any;
    };
    name: string;

    connect(): Promise<void>;
    disconnect(): Promise<void>;
    transmit(data: Buffer, responseMaxLength?: number): Promise<Buffer>;
    on(event: 'card', callback: (card: Card) => void): this;
    on(event: 'card.off', callback: (card: Card) => void): this;
    on(event: 'error', callback: (err: Error) => void): this;
    on(event: string, callback: Function): this;
    removeAllListeners(event?: string): void;
    read(blockNumber: number, length: number, blockSize?: number): Promise<Buffer>;
    write(blockNumber: number, data: Buffer | string, blockSize?: number): Promise<void>;
  }

  export class NFC extends EventEmitter {
    constructor(options?: NFCOptions);

    on(event: 'reader', callback: (reader: Reader) => void): this;
    on(event: 'error', callback: (err: Error) => void): this;
    on(event: string, callback: Function): this;
    off(event: string, callback: Function): this;
    start(): Promise<void>;
    stop(): Promise<void>;
    getReaders(): Promise<Reader[]>;
  }
}
