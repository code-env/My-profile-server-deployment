import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * License Configuration and Security Settings
 */
export const licenseConfig = {
  // Company-specific encryption key (64 bytes hex)
  COMPANY_SECRET: process.env.COMPANY_SECRET || 'MyProfile-' + crypto.randomBytes(32).toString('hex'),

  // License key format
  format: {
    prefix: 'MP-',
    segments: 3, // Number of encrypted segments
    segmentLength: 32, // Length of each segment
    delimiter: '.',
  },

  // Encryption settings
  encryption: {
    algorithm: 'aes-256-cbc',
    keyLength: 32,
    ivLength: 16,
  },

  // License settings
  settings: {
    expiryDays: 365,
    maxValidationAttempts: 5,
    hardwareTolerancePercent: 10,
  },

  // Hardware fingerprint weights
  hardwareWeights: {
    cpu: 3,
    memory: 2,
    macAddress: 4,
    platform: 3,
    hostname: 1,
  },
};

// Log warning if using default secrets in production
if (process.env.NODE_ENV === 'production' && !process.env.COMPANY_SECRET) {
  logger.warn('WARNING: Using default company secret in production!');
}

/**
 * Generate multi-segment license key
 */
export function generateLicenseKey(data: any, companySecret: string): string {
  // Split the company secret into multiple keys for different segments
  const keys = [];
  for (let i = 0; i < licenseConfig.format.segments; i++) {
    const segmentKey = crypto.createHash('sha256')
      .update(`${companySecret}-segment-${i}`)
      .digest();
    keys.push(segmentKey);
  }

  // Generate different segments of the license
  const segments = keys.map((key, index) => {
    const iv = crypto.randomBytes(licenseConfig.encryption.ivLength);
    const cipher = crypto.createCipheriv(licenseConfig.encryption.algorithm, key, iv);

    // Each segment encrypts different parts of the data
    const segmentData = {
      part: index,
      timestamp: Date.now(),
      ...data,
    };

    let encrypted = cipher.update(JSON.stringify(segmentData), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Combine IV and encrypted data
    return iv.toString('hex') + encrypted;
  });

  return licenseConfig.format.prefix + segments.join(licenseConfig.format.delimiter);
}

/**
 * Validate multi-segment license key
 */
export function validateLicenseKey(licenseKey: string, companySecret: string): boolean {
  try {
    const segments = licenseKey
      .substring(licenseConfig.format.prefix.length)
      .split(licenseConfig.format.delimiter);

    if (segments.length !== licenseConfig.format.segments) {
      return false;
    }

    // Validate each segment
    const keys = segments.map((_, index) =>
      crypto.createHash('sha256')
        .update(`${companySecret}-segment-${index}`)
        .digest()
    );

    // Attempt to decrypt each segment
    segments.forEach((segment, index) => {
      const iv = Buffer.from(segment.substring(0, 32), 'hex');
      const encrypted = segment.substring(32);

      const decipher = crypto.createDecipheriv(
        licenseConfig.encryption.algorithm,
        keys[index],
        iv
      );

      const decrypted = decipher.update(encrypted, 'hex', 'utf8');
      JSON.parse(decrypted + decipher.final('utf8'));
    });

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Extract data from license key
 */
export function extractLicenseData(licenseKey: string, companySecret: string): any {
  const segments = licenseKey
    .substring(licenseConfig.format.prefix.length)
    .split(licenseConfig.format.delimiter);

  const keys = segments.map((_, index) =>
    crypto.createHash('sha256')
      .update(`${companySecret}-segment-${index}`)
      .digest()
  );

  const decryptedSegments = segments.map((segment, index) => {
    const iv = Buffer.from(segment.substring(0, 32), 'hex');
    const encrypted = segment.substring(32);

    const decipher = crypto.createDecipheriv(
      licenseConfig.encryption.algorithm,
      keys[index],
      iv
    );

    const decrypted = decipher.update(encrypted, 'hex', 'utf8');
    return JSON.parse(decrypted + decipher.final('utf8'));
  });

  // Combine all segments data
  return decryptedSegments.reduce((acc, segment) => ({
    ...acc,
    ...segment
  }), {});
}
