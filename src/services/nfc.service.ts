import { NFCCardModel, INFCCard } from '../models/nfc-card.model';
import { ScanModel, IScan } from '../models/scan.model';
import { ProfileModel } from '../models/profile.model';
import mongoose from 'mongoose';
import { nfcHardwareService, NFCCardData, CardWriteResult, CardReadResult } from './nfc-hardware.service';
import { EventEmitter } from 'events';

export interface NFCWriteData {
  profileLink: string;
  connectLink: string;
  basicInfo: {
    name: string;
    title?: string;
    phone?: string;
    email?: string;
    company?: string;
  };
  customFields?: any;
}

export interface NFCScanData {
  scannedBy?: mongoose.Types.ObjectId;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  deviceInfo?: {
    platform: string;
    userAgent: string;
  };
  ipAddress?: string;
}

class NFCService {

  /**
   * Initialize NFC hardware service
   */
  async initializeHardware(): Promise<void> {
    try {
      await nfcHardwareService.initialize();
      console.log('NFC Hardware Service initialized');
    } catch (error) {
      console.error('Failed to initialize NFC hardware:', error);
      throw error;
    }
  }

  /**
   * Program an NFC card with profile data (server-side card programming)
   */
  async programCard(
    cardId: string,
    profileId: string,
    readerName?: string
  ): Promise<{ success: boolean; message: string; cardId?: string; cardUID?: string }> {
    try {
      // Validate card exists and belongs to profile
      const card = await NFCCardModel.findOne({
        cardId,
        profileId: new mongoose.Types.ObjectId(profileId)
      });

      if (!card) {
        throw new Error('Card not found or not owned by profile');
      }

      if (card.status === 'active') {
        throw new Error('Card is already programmed and active');
      }

      // Generate the data to write to card
      const writeData = await this.generateCardData(cardId, profileId);

      // Write data to physical NFC card
      const writeResult = await nfcHardwareService.writeCard(writeData, readerName);

      if (!writeResult.success) {
        throw new Error(writeResult.error || 'Failed to write card');
      }

      // Update card status to active
      card.status = 'active';
      card.cardId = writeResult.cardUID || card.cardId;
      card.lastWriteDate = new Date();
      card.isConfigured = true;
      await card.save();

   return { success: true, message: 'Card programmed successfully', cardId: card.cardId, cardUID: writeResult.cardUID };
      // Note: cardUID is the unique hardware identifier of the physical NFC chip,
      // while cardId is our application's logical identifier for the card.
      // They may be different: cardId is assigned by our app, cardUID comes from the NFC hardware.
      // Here, we return cardId (logical) and cardUID (hardware) for reference.

    } catch (error) {
      console.error('Card programming error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Card programming failed'
      };
    }
  }

  /**
   * Read data from an NFC card for verification
   */
  async readCard(readerName?: string): Promise<CardReadResult> {
    try {
      return await nfcHardwareService.readCard(readerName);
    } catch (error) {
      console.error('Card reading error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Card reading failed'
      };
    }
  }

  /**
   * Format/erase an NFC card
   */
  async formatCard(cardId: string, profileId: string, readerName?: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // Validate card ownership
      const card = await NFCCardModel.findOne({
        cardId,
        profileId: new mongoose.Types.ObjectId(profileId)
      });

      if (!card) {
        throw new Error('Card not found or not owned by profile');
      }

      // Format the physical card
      const formatResult = await nfcHardwareService.formatCard(readerName);

      if (!formatResult.success) {
        throw new Error(formatResult.error || 'Failed to format card');
      }

      // Update card status
      card.status = 'inactive';
      card.isConfigured = false;
      card.lastWriteDate = undefined;
      await card.save();

      return {
        success: true,
        message: 'Card formatted successfully'
      };

    } catch (error) {
      console.error('Card formatting error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Card formatting failed'
      };
    }
  }

  /**
   * Reprogram an existing card with updated data
   */
  async reprogramCard(
    cardId: string,
    profileId: string,
    readerName?: string
  ): Promise<{ success: boolean; message: string; cardUID?: string }> {
    try {
      // First format the card
      const formatResult = await this.formatCard(cardId, profileId, readerName);
      if (!formatResult.success) {
        throw new Error('Failed to format card before reprogramming');
      }

      // Wait a moment for the format to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Then program it with new data
      return await this.programCard(cardId, profileId, readerName);

    } catch (error) {
      console.error('Card reprogramming error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Card reprogramming failed'
      };
    }
  }

  /**
   * Get NFC hardware status
   */
  getHardwareStatus(): {
    isReady: boolean;
    readers: string[];
    initialized: boolean;
  } {
    return {
      isReady: nfcHardwareService.isReady(),
      readers: nfcHardwareService.getReaders(),
      initialized: nfcHardwareService.isReady()
    };
  }

  /**
   * Generate complete NFC card data for programming
   */
  private async generateCardData(cardId: string, profileId: string): Promise<NFCCardData> {
    const card = await NFCCardModel.findOne({
      cardId,
      profileId: new mongoose.Types.ObjectId(profileId)
    });

    if (!card) {
      throw new Error('Card not found');
    }

    const profile = await ProfileModel.findById(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const baseUrl = process.env.FRONTEND_URL || 'https://myprofile.app';
    const profileUrl = `${baseUrl}/profile/${profile.profileInformation.profileLink}`;
    const connectUrl = `${baseUrl}/connect/${profile.profileInformation.connectLink}`;

    const cardData: NFCCardData = {
      profileId,
      cardId,
      profileUrl,
      connectUrl,
      basicInfo: {
        name: profile.profileInformation.accountHolder || profile.profileInformation.username || 'Unknown'
      }
    };

    // Add optional fields based on card configuration
    if (card.configuration.enabledFields.includes('title') && profile.profileInformation.title) {
      cardData.basicInfo.title = profile.profileInformation.title;
    }

    if (card.configuration.enabledFields.includes('email')) {
      cardData.basicInfo.email = this.extractEmailFromProfile(profile);
    }

    if (card.configuration.enabledFields.includes('phone')) {
      cardData.basicInfo.phone = this.extractPhoneFromProfile(profile);
    }

    if (card.configuration.enabledFields.includes('company')) {
      cardData.basicInfo.company = this.extractCompanyFromProfile(profile);
    }

    // Add custom data if configured
    if (card.configuration.customData) {
      cardData.customData = card.configuration.customData;
    }

    return cardData;
  }

  /**
   * Create/Register a new NFC card for a profile
   */
  async createCard(
    profileId: string,
    cardId: string,
    cardType: 'basic' | 'premium' | 'custom' = 'basic'
  ): Promise<INFCCard> {

    // Check if card already exists
    const existingCard = await NFCCardModel.findOne({ cardId });
    if (existingCard) {
      throw new Error('Card ID already exists');
    }

    // Validate profile exists
    const profile = await ProfileModel.findById(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const card = new NFCCardModel({
      cardId,
      profileId: new mongoose.Types.ObjectId(profileId),
      cardType,
      configuration: {
        dataTemplate: 'full',
        enabledFields: ['name', 'title', 'phone', 'email', 'profileLink', 'connectLink']
      },
      accessControl: {
        isEncrypted: false,
        accessLevel: 'public',
        allowedProfiles: []
      },
      analytics: {
        totalScans: 0,
        uniqueScans: 0,
        scanHistory: []
      }
    });

    return await card.save();
  }

  /**
   * Configure card data template and access controls
   */
  async configureCard(
    cardId: string,
    profileId: string,
    configuration: {
      dataTemplate?: 'full' | 'minimal' | 'custom';
      enabledFields?: string[];
      customData?: any;
      accessControl?: {
        isEncrypted?: boolean;
        accessLevel?: 'public' | 'protected' | 'private';
        allowedProfiles?: string[];
        requireLocation?: boolean;
        allowedLocations?: any[];
        expiryDate?: Date;
      };
    }
  ): Promise<INFCCard> {

    const card = await NFCCardModel.findOne({
      cardId,
      profileId: new mongoose.Types.ObjectId(profileId)
    });

    if (!card) {
      throw new Error('Card not found or not owned by profile');
    }

    // Update configuration
    if (configuration.dataTemplate) {
      card.configuration.dataTemplate = configuration.dataTemplate;
    }

    if (configuration.enabledFields) {
      card.configuration.enabledFields = configuration.enabledFields;
    }

    if (configuration.customData) {
      card.configuration.customData = configuration.customData;
    }

    // Update access control
    if (configuration.accessControl) {
      const ac = configuration.accessControl;

      if (ac.isEncrypted !== undefined) {
        card.accessControl.isEncrypted = ac.isEncrypted;
      }

      if (ac.accessLevel) {
        card.accessControl.accessLevel = ac.accessLevel;
      }

      if (ac.allowedProfiles) {
        card.accessControl.allowedProfiles = ac.allowedProfiles.map(
          id => new mongoose.Types.ObjectId(id)
        );
      }

      if (ac.requireLocation !== undefined) {
        card.accessControl.requireLocation = ac.requireLocation;
      }

      if (ac.allowedLocations) {
        card.accessControl.allowedLocations = ac.allowedLocations;
      }

      if (ac.expiryDate) {
        card.accessControl.expiryDate = ac.expiryDate;
      }
    }

    return await card.save();
  }

  /**
   * Generate data to write to NFC card based on profile and configuration
   */
  async generateWriteData(cardId: string, profileId: string): Promise<NFCWriteData> {
    const card = await NFCCardModel.findOne({
      cardId,
      profileId: new mongoose.Types.ObjectId(profileId)
    });

    if (!card) {
      throw new Error('Card not found or not owned by profile');
    }

    const profile = await ProfileModel.findById(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const { configuration } = card;
    const writeData: NFCWriteData = {
      profileLink: `${process.env.FRONTEND_URL || 'https://myprofile.app'}/profile/${profile.profileInformation.profileLink}`,
      connectLink: profile.profileInformation.connectLink,
      basicInfo: {
        name: ''
      }
    };

    // Build basic info based on enabled fields
    if (configuration.enabledFields.includes('name')) {
      writeData.basicInfo.name = profile.profileInformation.accountHolder ||
                                   profile.profileInformation.username;
    }

    if (configuration.enabledFields.includes('title')) {
      writeData.basicInfo.title = profile.profileInformation.title;
    }

    // Add contact info based on template
    if (configuration.dataTemplate === 'full' ||
        configuration.enabledFields.includes('phone')) {
      // Get phone from profile contacts/info
      writeData.basicInfo.phone = this.extractPhoneFromProfile(profile);
    }

    if (configuration.dataTemplate === 'full' ||
        configuration.enabledFields.includes('email')) {
      // Get email from profile contacts/info
      writeData.basicInfo.email = this.extractEmailFromProfile(profile);
    }

    if (configuration.dataTemplate === 'full' ||
        configuration.enabledFields.includes('company')) {
      writeData.basicInfo.company = this.extractCompanyFromProfile(profile);
    }

    // Add custom fields for custom template
    if (configuration.dataTemplate === 'custom' && configuration.customData) {
      writeData.customFields = configuration.customData;
    }

    return writeData;
  }

  /**
   * Record NFC write operation
   */
  async recordWrite(
    cardId: string,
    profileId: string,
    writeData: NFCWriteData,
    tagInfo: {
      uid?: string;
      type?: string;
      capacity?: number;
      writtenSize?: number;
    }
  ): Promise<IScan> {

    // Update card status
    const card = await NFCCardModel.findOne({
      cardId,
      profileId: new mongoose.Types.ObjectId(profileId)
    });

    if (card) {
      card.isConfigured = true;
      card.lastWriteDate = new Date();
      await card.save();
    }

    // Create scan record
    const scan = new ScanModel({
      profileId: new mongoose.Types.ObjectId(profileId),
      type: 'nfc-write',
      data: {
        nfcData: {
          operation: 'write',
          cardId,
          tagInfo,
          profileData: writeData,
          accessControl: card?.accessControl
        }
      }
    });

    return await scan.save();
  }

  /**
   * Record NFC read/scan operation with analytics
   */
  async recordScan(
    cardId: string,
    scanData: NFCScanData,
    readData?: any
  ): Promise<{ scan: IScan; allowed: boolean; cardOwnerProfile?: any }> {

    const card = await NFCCardModel.findOne({ cardId, status: 'active' });

    if (!card) {
      throw new Error('Card not found or inactive');
    }

    // Check access permissions
    const accessCheck = await this.checkScanAccess(card, scanData);

    if (!accessCheck.allowed) {
      // Still record the attempt for analytics, but mark as denied
      const deniedScan = new ScanModel({
        profileId: card.profileId,
        type: 'nfc-read',
        data: {
          nfcData: {
            operation: 'read',
            cardId,
            scannedBy: scanData,
            accessControl: {
              accessLevel: card.accessControl.accessLevel,
              isEncrypted: card.accessControl.isEncrypted
            }
          },
          metadata: {
            accessDenied: true,
            reason: accessCheck.reason
          }
        }
      });

      return {
        scan: await deniedScan.save(),
        allowed: false
      };
    }

    // Record successful scan
    const scan = new ScanModel({
      profileId: card.profileId,
      type: 'nfc-read',
      data: {
        nfcData: {
          operation: 'read',
          cardId,
          scannedBy: scanData,
          profileData: readData
        }
      }
    });

    // Update card analytics
    card.analytics.scanHistory.push({
      scannedBy: scanData.scannedBy,
      timestamp: new Date(),
      location: scanData.location,
      deviceInfo: scanData.deviceInfo,
      ipAddress: scanData.ipAddress
    });

    await card.save(); // This will trigger pre-save to update analytics

    // Get card owner profile for response
    const cardOwnerProfile = await ProfileModel.findById(card.profileId);

    return {
      scan: await scan.save(),
      allowed: true,
      cardOwnerProfile
    };
  }

  /**
   * Check if a profile can scan this card
   */
  private async checkScanAccess(
    card: INFCCard,
    scanData: NFCScanData
  ): Promise<{ allowed: boolean; reason?: string }> {

    const { accessControl } = card;

    // Check expiry
    if (accessControl.expiryDate && accessControl.expiryDate < new Date()) {
      return { allowed: false, reason: 'Card has expired' };
    }

    // Check access level
    if (accessControl.accessLevel === 'private') {
      if (!scanData.scannedBy) {
        return { allowed: false, reason: 'Authentication required for private cards' };
      }

      // Check if scanner is in allowed profiles
      const isAllowed = accessControl.allowedProfiles.some(
        profileId => profileId.toString() === scanData.scannedBy?.toString()
      );

      if (!isAllowed) {
        return { allowed: false, reason: 'Not authorized to scan this card' };
      }
    }

    // Check location restrictions
    if (accessControl.requireLocation && accessControl.allowedLocations && accessControl.allowedLocations.length > 0) {
      if (!scanData.location) {
        return { allowed: false, reason: 'Location required to scan this card' };
      }

      const isInAllowedLocation = accessControl.allowedLocations.some(allowedLoc => {
        const distance = this.calculateDistance(
          scanData.location!.latitude,
          scanData.location!.longitude,
          allowedLoc.latitude,
          allowedLoc.longitude
        );
        return distance <= allowedLoc.radius;
      });

      if (!isInAllowedLocation) {
        return { allowed: false, reason: 'Not in allowed location to scan this card' };
      }
    }

    return { allowed: true };
  }

  /**
   * Get cards for a profile
   */
  async getProfileCards(profileId: string): Promise<INFCCard[]> {
    return await NFCCardModel.find({
      profileId: new mongoose.Types.ObjectId(profileId)
    }).sort({ createdAt: -1 });
  }

  /**
   * Get card analytics
   */
  async getCardAnalytics(cardId: string, profileId: string) {
    const card = await NFCCardModel.findOne({
      cardId,
      profileId: new mongoose.Types.ObjectId(profileId)
    }).populate('analytics.scanHistory.scannedBy', 'profileInformation.username profileInformation.accountHolder');

    if (!card) {
      throw new Error('Card not found');
    }

    // Get scan records for additional analytics
    const scans = await ScanModel.find({
      'data.nfcData.cardId': cardId,
      profileId: new mongoose.Types.ObjectId(profileId)
    }).sort({ createdAt: -1 });

    return {
      card: {
        cardId: card.cardId,
        status: card.status,
        isConfigured: card.isConfigured,
        lastWriteDate: card.lastWriteDate,
        lastScanDate: card.lastScanDate
      },
      analytics: card.analytics,
      recentScans: scans.slice(0, 10) // Last 10 scans
    };
  }

  // Helper methods
  private extractPhoneFromProfile(profile: any): string | undefined {
    // Implementation depends on your profile structure
    return profile.profileInformation.phone ||
           profile.contacts?.find((c: any) => c.type === 'phone')?.value;
  }

  private extractEmailFromProfile(profile: any): string | undefined {
    // Implementation depends on your profile structure
    return profile.profileInformation.email ||
           profile.contacts?.find((c: any) => c.type === 'email')?.value;
  }

  private extractCompanyFromProfile(profile: any): string | undefined {
    // Implementation depends on your profile structure
    return profile.profileInformation.company ||
           profile.work?.company;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Batch program multiple cards for fulfillment operations
   */
  async batchProgramCards(
    cards: Array<{ cardId: string; profileId: string }>,
    readerName?: string
  ): Promise<{
    success: boolean;
    results: Array<{
      cardId: string;
      success: boolean;
      message: string;
      cardUID?: string;
      error?: string;
    }>;
    summary: {
      total: number;
      successful: number;
      failed: number;
    };
  }> {
    const results = [];
    let successful = 0;
    let failed = 0;

    for (const card of cards) {
      try {
        const result = await this.programCard(card.cardId, card.profileId, readerName);

        results.push({
          cardId: card.cardId,
          success: result.success,
          message: result.message,
          cardUID: result.cardUID,
          error: !result.success ? result.message : undefined
        });

        if (result.success) {
          successful++;
        } else {
          failed++;
        }

        // Small delay between programming operations for hardware stability
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        failed++;
        results.push({
          cardId: card.cardId,
          success: false,
          message: 'Programming failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      success: successful > 0,
      results,
      summary: {
        total: cards.length,
        successful,
        failed
      }
    };
  }

  /**
   * Quality control - verify card programming
   */
  async verifyCardProgramming(
    cardId: string,
    profileId: string,
    readerName?: string
  ): Promise<{
    success: boolean;
    verified: boolean;
    message: string;
    readData?: any;
    expectedData?: any;
  }> {
    try {
      // Read the card data
      const readResult = await this.readCard(readerName);

      if (!readResult.success) {
        return {
          success: false,
          verified: false,
          message: 'Failed to read card for verification'
        };
      }

      // Get expected data
      const expectedData = await this.generateCardData(cardId, profileId);

      // Compare read data with expected data
      const verified = this.compareCardData(readResult.data, expectedData);

      return {
        success: true,
        verified,
        message: verified ? 'Card programming verified successfully' : 'Card data mismatch detected',
        readData: readResult.data,
        expectedData
      };

    } catch (error) {
      return {
        success: false,
        verified: false,
        message: error instanceof Error ? error.message : 'Verification failed'
      };
    }
  }

  /**
   * Compare read card data with expected data
   */
  private compareCardData(readData: any, expectedData: NFCCardData): boolean {
    if (!readData || !expectedData) return false;

    // Check profile URL
    if (readData.url !== expectedData.profileUrl) return false;

    // Check basic info if available
    if (readData.name && expectedData.basicInfo.name) {
      if (readData.name !== expectedData.basicInfo.name) return false;
    }

    return true;
  }

  /**
   * Get card programming analytics
   */
  async getProgrammingAnalytics(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalCards: number;
    programmedCards: number;
    failedCards: number;
    byDay: Array<{ date: string; count: number }>;
    byCardType: Array<{ type: string; count: number }>;
  }> {
    const matchStage: any = {};

    if (startDate || endDate) {
      matchStage.programmedAt = {};
      if (startDate) matchStage.programmedAt.$gte = startDate;
      if (endDate) matchStage.programmedAt.$lte = endDate;
    }

    const stats = await NFCCardModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalCards: { $sum: 1 },
          programmedCards: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          failedCards: {
            $sum: { $cond: [{ $ne: ['$status', 'active'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get daily programming stats
    const dailyStats = await NFCCardModel.aggregate([
      { $match: { ...matchStage, status: 'active' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$programmedAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get card type stats
    const typeStats = await NFCCardModel.aggregate([
      { $match: { ...matchStage, status: 'active' } },
      {
        $group: {
          _id: '$cardType',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = stats[0] || { totalCards: 0, programmedCards: 0, failedCards: 0 };

    return {
      ...result,
      byDay: dailyStats.map(item => ({ date: item._id, count: item.count })),
      byCardType: typeStats.map(item => ({ type: item._id, count: item.count }))
    };
  }

}

export default new NFCService();
