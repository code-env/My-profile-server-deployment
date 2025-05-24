import { EventEmitter } from 'events';

// Type definitions for nfc-pcsc (imported dynamically)
interface NFCOptions {
  logger?: any;
  scanInterval?: number;
  [key: string]: any;
}

interface Card {
  atr: Buffer;
  standard: string;
  type: number;
  uid: Buffer;
  protocol: number;
  [key: string]: any;
}

interface Reader extends EventEmitter {
  reader: {
    name: string;
    [key: string]: any;
  };
  name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  transmit(data: Buffer, responseMaxLength?: number): Promise<Buffer>;
  read(blockNumber: number, length: number, blockSize?: number): Promise<Buffer>;
  write(blockNumber: number, data: Buffer | string, blockSize?: number): Promise<void>;
}

interface NFC extends EventEmitter {
  start(): Promise<void>;
  stop(): Promise<void>;
  getReaders(): Promise<Reader[]>;
}

export interface NFCCardData {
  profileId: string;
  cardId: string;
  profileUrl: string;
  connectUrl: string;
  basicInfo: {
    name: string;
    title?: string;
    email?: string;
    phone?: string;
    company?: string;
  };
  customData?: any;
}

export interface CardReadResult {
  success: boolean;
  data?: any;
  error?: string;
  cardUID?: string;
}

export interface CardWriteResult {
  success: boolean;
  cardUID?: string;
  error?: string;
  bytesWritten?: number;
}

class NFCHardwareService extends EventEmitter {
  private nfc: NFC | null = null;
  private isInitialized: boolean = false;
  private readers: Map<string, Reader> = new Map();
  private hardwareAvailable: boolean = false;

  constructor() {
    super();
  }

  /**
   * Dynamically load the NFC module to handle missing native bindings gracefully
   */
  private async loadNFCModule(): Promise<any> {
    try {
      const nfcModule = await import('nfc-pcsc');
      return nfcModule;
    } catch (error) {
      console.warn('NFC hardware not available:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Check if NFC hardware is available
   */
  isHardwareAvailable(): boolean {
    return this.hardwareAvailable;
  }

  /**
   * Initialize NFC hardware service
   */
  async initialize(): Promise<void> {
    try {
      // Dynamically import nfc-pcsc to handle missing native bindings gracefully
      const nfcModule = await this.loadNFCModule();
      if (!nfcModule) {
        throw new Error('NFC hardware not available - native bindings not found');
      }

      this.nfc = new nfcModule.NFC();
      this.hardwareAvailable = true;

      if (this.nfc) {
        this.nfc.on('reader', (reader: any) => {
          console.log(`NFC Reader attached: ${reader.reader.name}`);
          this.readers.set(reader.reader.name, reader);

          reader.on('card', (card: any) => {
            console.log(`Card detected on ${reader.reader.name}:`, card);
            this.emit('card-detected', { reader: reader.reader.name, card });
          });

          reader.on('card.off', (card: any) => {
            console.log(`Card removed from ${reader.reader.name}:`, card);
            this.emit('card-removed', { reader: reader.reader.name, card });
          });

          reader.on('error', (err: any) => {
            console.error(`Reader error on ${reader.reader.name}:`, err);
            this.emit('reader-error', { reader: reader.reader.name, error: err });
          });
        });

        this.nfc.on('error', (err: any) => {
          console.error('NFC Service Error:', err);
          this.emit('error', err);
        });
      }

      this.isInitialized = true;
      console.log('NFC Hardware Service initialized successfully');

    } catch (error) {
      console.error('Failed to initialize NFC Hardware Service:', error);
      throw new Error(`NFC Hardware initialization failed: ${error}`);
    }
  }

  /**
   * Check if NFC service is initialized and has readers
   */
  isReady(): boolean {
    return this.isInitialized && this.hardwareAvailable && this.readers.size > 0;
  }

  /**
   * Get list of available readers
   */
  getReaders(): string[] {
    return Array.from(this.readers.keys());
  }

  /**
   * Read data from an NFC card
   */
  async readCard(readerName?: string): Promise<CardReadResult> {
    return new Promise((resolve) => {
      if (!this.isInitialized || !this.hardwareAvailable) {
        return resolve({ success: false, error: 'NFC hardware not available or not initialized' });
      }

      const reader = readerName ?
        this.readers.get(readerName) :
        Array.from(this.readers.values())[0];

      if (!reader) {
        return resolve({ success: false, error: 'No NFC reader available' });
      }

      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Read operation timeout' });
      }, 10000); // 10 second timeout

      const onCard = async (card: any) => {
        try {
          clearTimeout(timeout);
          reader.off('card', onCard);

          // Try to read NDEF data from the card
          const data = await this.readNDEFData(reader);

          resolve({
            success: true,
            data,
            cardUID: card.uid
          });
        } catch (error) {
          resolve({
            success: false,
            error: `Failed to read card: ${error}`,
            cardUID: card.uid
          });
        }
      };

      reader.on('card', onCard);
      console.log(`Waiting for card on reader: ${reader.reader.name}`);
    });
  }

  /**
   * Write data to an NFC card
   */
  async writeCard(data: NFCCardData, readerName?: string): Promise<CardWriteResult> {
    return new Promise((resolve) => {
      if (!this.isInitialized || !this.hardwareAvailable) {
        return resolve({ success: false, error: 'NFC hardware not available or not initialized' });
      }

      const reader = readerName ?
        this.readers.get(readerName) :
        Array.from(this.readers.values())[0];

      if (!reader) {
        return resolve({ success: false, error: 'No NFC reader available' });
      }

      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Write operation timeout' });
      }, 15000); // 15 second timeout

      const onCard = async (card: any) => {
        try {
          clearTimeout(timeout);
          reader.off('card', onCard);

          // Write NDEF data to the card
          const bytesWritten = await this.writeNDEFData(reader, data);

          resolve({
            success: true,
            cardUID: card.uid,
            bytesWritten
          });
        } catch (error) {
          resolve({
            success: false,
            error: `Failed to write card: ${error}`,
            cardUID: card.uid
          });
        }
      };

      reader.on('card', onCard);
      console.log(`Waiting for card to write on reader: ${reader.reader.name}`);
    });
  }

  /**
   * Read NDEF data from card
   */
  private async readNDEFData(reader: any): Promise<any> {
    try {
      // Read NDEF data from the card
      // This is a simplified implementation - actual NDEF parsing would be more complex
      const response = await reader.read(4, 16); // Read 16 bytes starting from block 4

      // Parse the NDEF message
      const ndefData = this.parseNDEFMessage(response);
      return ndefData;

    } catch (error) {
      throw new Error(`NDEF read failed: ${error}`);
    }
  }

  /**
   * Write NDEF data to card
   */
  private async writeNDEFData(reader: any, data: NFCCardData): Promise<number> {
    try {
      // Create NDEF message with profile URL
      const ndefMessage = this.createNDEFMessage(data);

      // Write the NDEF message to the card
      // Block 4 is typically where NDEF data starts on NTAG cards
      await reader.write(4, ndefMessage);

      return ndefMessage.length;

    } catch (error) {
      throw new Error(`NDEF write failed: ${error}`);
    }
  }

  /**
   * Create NDEF message from card data
   */
  private createNDEFMessage(data: NFCCardData): Buffer {
    // Create a simple NDEF URI record pointing to the profile URL
    const uri = data.profileUrl;

    // NDEF URI Record format:
    // TNF: 0x01 (Well-known)
    // Type: 'U' (URI)
    // Payload: URI identifier code + URI

    const uriIdentifier = 0x01; // http://www.
    const uriBytes = Buffer.from(uri.replace('http://www.', ''), 'utf8');
    const payload = Buffer.concat([Buffer.from([uriIdentifier]), uriBytes]);

    // NDEF Record Header
    const flags = 0xD1; // MB=1, ME=1, CF=0, SR=1, IL=0, TNF=001
    const typeLength = 1;
    const payloadLength = payload.length;
    const type = Buffer.from('U', 'utf8');

    // Construct the complete NDEF message
    const record = Buffer.concat([
      Buffer.from([flags, typeLength, payloadLength]),
      type,
      payload
    ]);

    // NDEF Message = NDEF Record(s)
    return record;
  }

  /**
   * Parse NDEF message from buffer
   */
  private parseNDEFMessage(buffer: Buffer): any {
    try {
      // This is a simplified NDEF parser
      // In production, you'd want to use a proper NDEF library

      if (buffer.length < 3) {
        return null;
      }

      const flags = buffer[0];
      const typeLength = buffer[1];
      const payloadLength = buffer[2];

      if (buffer.length < 3 + typeLength + payloadLength) {
        return null;
      }

      const type = buffer.slice(3, 3 + typeLength).toString('utf8');
      const payload = buffer.slice(3 + typeLength, 3 + typeLength + payloadLength);

      if (type === 'U') {
        // URI record
        const uriIdentifier = payload[0];
        const uriData = payload.slice(1).toString('utf8');

        let fullUri = uriData;
        switch (uriIdentifier) {
          case 0x01:
            fullUri = 'http://www.' + uriData;
            break;
          case 0x02:
            fullUri = 'https://www.' + uriData;
            break;
          case 0x03:
            fullUri = 'http://' + uriData;
            break;
          case 0x04:
            fullUri = 'https://' + uriData;
            break;
        }

        return {
          type: 'uri',
          uri: fullUri
        };
      }

      return {
        type: 'unknown',
        rawPayload: payload
      };

    } catch (error) {
      console.error('NDEF parse error:', error);
      return null;
    }
  }

  /**
   * Format a card (erase all data)
   */
  async formatCard(readerName?: string): Promise<CardWriteResult> {
    return new Promise((resolve) => {
      if (!this.isInitialized) {
        return resolve({ success: false, error: 'NFC service not initialized' });
      }

      const reader = readerName ?
        this.readers.get(readerName) :
        Array.from(this.readers.values())[0];

      if (!reader) {
        return resolve({ success: false, error: 'No NFC reader available' });
      }

      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Format operation timeout' });
      }, 10000);

      const onCard = async (card: any) => {
        try {
          clearTimeout(timeout);
          reader.off('card', onCard);

          // Write empty NDEF message to format the card
          const emptyNDEF = Buffer.alloc(16, 0);
          await reader.write(4, emptyNDEF);

          resolve({
            success: true,
            cardUID: card.uid,
            bytesWritten: emptyNDEF.length
          });
        } catch (error) {
          resolve({
            success: false,
            error: `Failed to format card: ${error}`,
            cardUID: card.uid
          });
        }
      };

      reader.on('card', onCard);
      console.log(`Waiting for card to format on reader: ${reader.reader.name}`);
    });
  }

  /**
   * Get card information without reading/writing
   */
  async getCardInfo(readerName?: string): Promise<any> {
    return new Promise((resolve) => {
      if (!this.isInitialized) {
        return resolve({ success: false, error: 'NFC service not initialized' });
      }

      const reader = readerName ?
        this.readers.get(readerName) :
        Array.from(this.readers.values())[0];

      if (!reader) {
        return resolve({ success: false, error: 'No NFC reader available' });
      }

      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Card detection timeout' });
      }, 5000);

      const onCard = (card: any) => {
        clearTimeout(timeout);
        reader.off('card', onCard);

        resolve({
          success: true,
          uid: card.uid,
          atr: card.atr,
          type: card.type || 'unknown'
        });
      };

      reader.on('card', onCard);
      console.log(`Waiting for card on reader: ${reader.reader.name}`);
    });
  }

  /**
   * Shutdown the NFC service
   */
  async shutdown(): Promise<void> {
    try {
      if (this.nfc) {
        // Clean up readers
        for (const reader of this.readers.values()) {
          reader.removeAllListeners();
        }
        this.readers.clear();

        // Close NFC service
        this.nfc.removeAllListeners();
        this.nfc = null;
      }

      this.isInitialized = false;
      console.log('NFC Hardware Service shutdown completed');

    } catch (error) {
      console.error('Error during NFC service shutdown:', error);
    }
  }
}

// Create singleton instance
export const nfcHardwareService = new NFCHardwareService();
export default NFCHardwareService;
