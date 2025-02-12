import crypto from 'crypto';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

interface HardwareInfo {
  cpu: string;
  memory: number;
  hostname: string;
  platform: string;
  macAddress: string;
}

interface LicenseData {
  employeeId: string;
  name: string;
  email: string;
  department: string;
  issuedAt: string;
  expiresAt: string;
  hardwareFingerprint: string;
}

export class LicenseManager {
  private readonly licensePath = path.join(process.cwd(), '.license');
  private readonly adminFingerprintPath = path.join(process.cwd(), '.admin-fingerprint');
  private readonly algorithm = 'aes-256-gcm';

  /**
   * Generate hardware fingerprint for the current machine
   */
  private getHardwareInfo(): HardwareInfo {
    const networkInterfaces = os.networkInterfaces();
    let macAddress = '';

    // Get first non-internal MAC address
    Object.values(networkInterfaces).forEach(interfaces => {
      interfaces?.forEach(details => {
        if (!details.internal && !macAddress) {
          macAddress = details.mac;
        }
      });
    });

    return {
      cpu: os.cpus()[0]?.model || '',
      memory: os.totalmem(),
      hostname: os.hostname(),
      platform: os.platform(),
      macAddress
    };
  }

  /**
   * Generate hardware fingerprint hash
   */
  private generateHardwareFingerprint(): string {
    const info = this.getHardwareInfo();
    const fingerprintData = [
      info.cpu,
      info.memory.toString(),
      info.platform,
      info.macAddress,
    ].join('|');

    return crypto
      .createHash('sha256')
      .update(fingerprintData)
      .digest('hex');
  }

  /**
   * Verify admin hardware fingerprint
   */
  private verifyAdminHardware(): boolean {
    try {
      // If no admin fingerprint exists yet, create it
      if (!fs.existsSync(this.adminFingerprintPath)) {
        const fingerprint = this.generateHardwareFingerprint();
        // Encrypt the fingerprint with a derivative of the company secret
        const secret = process.env.COMPANY_SECRET;
        if (!secret) {
          throw new Error('COMPANY_SECRET not found');
        }
        const key = crypto
          .createHash('sha256')
          .update(secret)
          .digest();
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, key, iv);
        const encrypted = Buffer.concat([
          cipher.update(fingerprint, 'utf8'),
          cipher.final()
        ]);
        const authTag = cipher.getAuthTag();
        const data = Buffer.concat([iv, authTag, encrypted]);
        fs.writeFileSync(this.adminFingerprintPath, data);
        return true;
      }

      // Verify existing admin fingerprint
      const data = fs.readFileSync(this.adminFingerprintPath);
      const secret = process.env.COMPANY_SECRET;
      if (!secret) {
        throw new Error('COMPANY_SECRET not found');
      }
      const key = crypto
        .createHash('sha256')
        .update(secret)
        .digest();
      const iv = data.slice(0, 16);
      const authTag = data.slice(16, 32);
      const encrypted = data.slice(32);
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);
      const storedFingerprint = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]).toString('utf8');

      return storedFingerprint === this.generateHardwareFingerprint();

    } catch (error) {
      logger.error('Admin hardware verification failed:', error);
      return false;
    }
  }

  /**
   * Generate a new license
   */
  public generateLicense(employeeData: Omit<LicenseData, 'hardwareFingerprint' | 'issuedAt' | 'expiresAt'>, secret: string): string {
    // Verify this is the admin machine
    if (!this.verifyAdminHardware()) {
      throw new Error('Unauthorized: License generation is restricted to the administrator machine');
    }

    const hardwareFingerprint = this.generateHardwareFingerprint();

    const licenseData: LicenseData = {
      ...employeeData,
      hardwareFingerprint,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
    };

    return this.encryptLicense(licenseData, secret);
  }

  /**
   * Encrypt license data
   */
  private encryptLicense(data: LicenseData, secret: string): string {
    const iv = crypto.randomBytes(16);
    const salt = crypto.randomBytes(64);
    const key = crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha512');

    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(data), 'utf8'),
      cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    const licenseData = Buffer.concat([
      salt,
      iv,
      authTag,
      encrypted
    ]);

    return licenseData.toString('base64');
  }

  /**
   * Decrypt license data
   */
  private decryptLicense(encryptedData: string, secret: string): LicenseData {
    const data = Buffer.from(encryptedData, 'base64');

    const salt = data.slice(0, 64);
    const iv = data.slice(64, 80);
    const authTag = data.slice(80, 96);
    const encrypted = data.slice(96);

    const key = crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha512');
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);

    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return JSON.parse(decrypted.toString('utf8'));
  }

  /**
   * Install a license
   */
  public installLicense(encryptedLicense: string): void {
    fs.writeFileSync(this.licensePath, encryptedLicense);
  }

  /**
   * Validate license
   */
  public validateLicense(secret: string): { isValid: boolean; employee?: LicenseData; error?: string } {
    try {
      if (!fs.existsSync(this.licensePath)) {
        return { isValid: false, error: 'No license file found' };
      }

      const encryptedLicense = fs.readFileSync(this.licensePath, 'utf8');
      const licenseData = this.decryptLicense(encryptedLicense, secret);
      const currentFingerprint = this.generateHardwareFingerprint();

      // Validate hardware fingerprint
      if (currentFingerprint !== licenseData.hardwareFingerprint) {
        return { isValid: false, error: 'Invalid hardware configuration' };
      }

      // Validate expiration
      if (new Date(licenseData.expiresAt) < new Date()) {
        return { isValid: false, error: 'License has expired' };
      }

      return { isValid: true, employee: licenseData };

    } catch (error) {
      logger.error('License validation error:', error);
      return { isValid: false, error: 'Invalid license' };
    }
  }
}

export const licenseManager = new LicenseManager();
