import { Request, Response } from 'express';
import mongoose from 'mongoose';
import NFCService from '../services/nfc.service';
import { NFCCardModel } from '../models/nfc-card.model';
import { ScanModel } from '../models/scan.model';
import { ProfileModel } from '../models/profile.model';

/**
 * NFC Hardware Programming Controller
 * Implements real-world NFC card programming using industry-proven approaches
 */
export class NFCController {

  /**
   * Program an NFC card with profile data (server-side programming)
   * @route POST /api/nfc/cards/:cardId/program
   */
  static async programCard(req: Request, res: Response) {
    try {
      const { cardId } = req.params;
      const { profileId, readerName } = req.body;

      if (!cardId || !profileId) {
        return res.status(400).json({
          success: false,
          error: 'Card ID and Profile ID are required'
        });
      }

      const result = await NFCService.programCard(cardId, profileId, readerName);

      res.status(result.success ? 200 : 400).json(result);

    } catch (error) {
      console.error('Error programming NFC card:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to program NFC card'
      });
    }
  }

  /**
   * Read data from an NFC card for verification
   * @route POST /api/nfc/cards/read
   */
  static async readCard(req: Request, res: Response) {
    try {
      const { readerName } = req.body;

      const result = await NFCService.readCard(readerName);

      res.status(result.success ? 200 : 400).json(result);

    } catch (error) {
      console.error('Error reading NFC card:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read NFC card'
      });
    }
  }

  /**
   * Format/erase an NFC card
   * @route POST /api/nfc/cards/:cardId/format
   */
  static async formatCard(req: Request, res: Response) {
    try {
      const { cardId } = req.params;
      const { profileId, readerName } = req.body;

      if (!cardId || !profileId) {
        return res.status(400).json({
          success: false,
          error: 'Card ID and Profile ID are required'
        });
      }

      const result = await NFCService.formatCard(cardId, profileId, readerName);

      res.status(result.success ? 200 : 400).json(result);

    } catch (error) {
      console.error('Error formatting NFC card:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to format NFC card'
      });
    }
  }

  /**
   * Reprogram an existing card with updated data
   * @route POST /api/nfc/cards/:cardId/reprogram
   */
  static async reprogramCard(req: Request, res: Response) {
    try {
      const { cardId } = req.params;
      const { profileId, readerName } = req.body;

      if (!cardId || !profileId) {
        return res.status(400).json({
          success: false,
          error: 'Card ID and Profile ID are required'
        });
      }

      const result = await NFCService.reprogramCard(cardId, profileId, readerName);

      res.status(result.success ? 200 : 400).json(result);

    } catch (error) {
      console.error('Error reprogramming NFC card:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reprogram NFC card'
      });
    }
  }

  /**
   * Get NFC hardware status
   * @route GET /api/nfc/hardware/status
   */
  static async getHardwareStatus(req: Request, res: Response) {
    try {
      const status = NFCService.getHardwareStatus();

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      console.error('Error getting hardware status:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get hardware status'
      });
    }
  }

  /**
   * Initialize NFC hardware service
   * @route POST /api/nfc/hardware/initialize
   */
  static async initializeHardware(req: Request, res: Response) {
    try {
      await NFCService.initializeHardware();

      res.json({
        success: true,
        message: 'NFC hardware initialized successfully'
      });

    } catch (error) {
      console.error('Error initializing hardware:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize NFC hardware'
      });
    }
  }

  /**
   * Batch program multiple cards for fulfillment operations
   * @route POST /api/nfc/cards/batch/program
   */
  static async batchProgramCards(req: Request, res: Response) {
    try {
      const { cards, readerName } = req.body;

      if (!Array.isArray(cards) || cards.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Cards array is required and must not be empty'
        });
      }

      // Validate each card in the batch
      for (const card of cards) {
        if (!card.cardId || !card.profileId) {
          return res.status(400).json({
            success: false,
            error: 'Each card must have cardId and profileId'
          });
        }
      }

      const result = await NFCService.batchProgramCards(cards, readerName);

      res.json(result);

    } catch (error) {
      console.error('Error in batch programming:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Batch programming failed'
      });
    }
  }

  /**
   * Verify card programming quality
   * @route POST /api/nfc/cards/:cardId/verify
   */
  static async verifyCardProgramming(req: Request, res: Response) {
    try {
      const { cardId } = req.params;
      const { profileId, readerName } = req.body;

      if (!cardId || !profileId) {
        return res.status(400).json({
          success: false,
          error: 'Card ID and Profile ID are required'
        });
      }

      const result = await NFCService.verifyCardProgramming(cardId, profileId, readerName);

      res.json(result);

    } catch (error) {
      console.error('Error verifying card programming:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Card verification failed'
      });
    }
  }

  /**
   * Get card programming analytics
   * @route GET /api/nfc/analytics/programming
   */
  static async getProgrammingAnalytics(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const analytics = await NFCService.getProgrammingAnalytics(start, end);

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      console.error('Error getting programming analytics:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get analytics'
      });
    }
  }

  static async createCard(req: Request, res: Response) {
    try {
      const user = req.user as any;
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const { cardType, configuration, accessControl } = req.body;
      const cardId = `NFC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const profile = await ProfileModel.findOne({
        'profileInformation.creator': user._id
      });

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'No profile found for user'
        });
      }

      const card = await NFCService.createCard(cardId, profile._id.toString(), cardType || 'basic');

      if (configuration || accessControl) {
        await NFCService.configureCard(cardId, profile._id.toString(), {
          ...configuration,
          accessControl
        });
      }

      res.status(201).json({
        success: true,
        data: card
      });

    } catch (error) {
      console.error('Error creating NFC card:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create card'
      });
    }
  }

  /**
   * Get user's NFC cards
   * @route GET /api/nfc/cards
   */
  static async getUserCards(req: Request, res: Response) {
    try {
      const user = req.user as any;
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Get all profiles for the user
      const profiles = await ProfileModel.find({
        'profileInformation.creator': user._id
      });

      const profileIds = profiles.map(p => p._id);

      // Get all cards for user's profiles
      const cards = await NFCCardModel.find({
        profileId: { $in: profileIds }
      }).populate('profileId', 'profileInformation.fullName profileInformation.profileLink');

      res.json({
        success: true,
        data: cards
      });

    } catch (error) {
      console.error('Error getting user cards:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get cards'
      });
    }
  }

  /**
   * Get specific card details
   * @route GET /api/nfc/cards/:cardId
   */
  static async getCard(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const { cardId } = req.params;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Get user's profiles
      const profiles = await ProfileModel.find({
        'profileInformation.creator': user._id
      });

      const profileIds = profiles.map(p => p._id);

      // Find card that belongs to user's profiles
      const card = await NFCCardModel.findOne({
        cardId,
        profileId: { $in: profileIds }
      }).populate('profileId', 'profileInformation.fullName profileInformation.profileLink');

      if (!card) {
        return res.status(404).json({
          success: false,
          error: 'Card not found'
        });
      }

      res.json({
        success: true,
        data: card
      });

    } catch (error) {
      console.error('Error getting card:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get card'
      });
    }
  }

  /**
   * Update card configuration
   * @route PUT /api/nfc/cards/:cardId/configuration
   */
  static async updateCardConfiguration(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const { cardId } = req.params;
      const { configuration } = req.body;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Get user's profiles
      const profiles = await ProfileModel.find({
        'profileInformation.creator': user._id
      });

      const profileIds = profiles.map(p => p._id);

      // Find card that belongs to user's profiles
      const card = await NFCCardModel.findOne({
        cardId,
        profileId: { $in: profileIds }
      });

      if (!card) {
        return res.status(404).json({
          success: false,
          error: 'Card not found'
        });
      }

      const updatedCard = await NFCService.configureCard(cardId, card.profileId.toString(), {
        ...configuration
      });

      res.json({
        success: true,
        data: updatedCard
      });

    } catch (error) {
      console.error('Error updating card configuration:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update configuration'
      });
    }
  }

  /**
   * Update card access control
   * @route PUT /api/nfc/cards/:cardId/access-control
   */
  static async updateAccessControl(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const { cardId } = req.params;
      const { accessControl } = req.body;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Get user's profiles
      const profiles = await ProfileModel.find({
        'profileInformation.creator': user._id
      });

      const profileIds = profiles.map(p => p._id);

      // Find card that belongs to user's profiles
      const card = await NFCCardModel.findOne({
        cardId,
        profileId: { $in: profileIds }
      });

      if (!card) {
        return res.status(404).json({
          success: false,
          error: 'Card not found'
        });
      }

      const updatedCard = await NFCService.configureCard(cardId, card.profileId.toString(), {
        accessControl
      });

      res.json({
        success: true,
        data: updatedCard
      });

    } catch (error) {
      console.error('Error updating access control:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update access control'
      });
    }
  }

  /**
   * Delete a card
   * @route DELETE /api/nfc/cards/:cardId
   */
  static async deleteCard(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const { cardId } = req.params;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Get user's profiles
      const profiles = await ProfileModel.find({
        'profileInformation.creator': user._id
      });

      const profileIds = profiles.map(p => p._id);

      // Find and delete card that belongs to user's profiles
      const card = await NFCCardModel.findOneAndDelete({
        cardId,
        profileId: { $in: profileIds }
      });

      if (!card) {
        return res.status(404).json({
          success: false,
          error: 'Card not found'
        });
      }

      res.json({
        success: true,
        message: 'Card deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting card:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete card'
      });
    }
  }

  /**
   * Generate NFC write data for a card
   * @route POST /api/nfc/cards/:cardId/generate-write-data
   */
  static async generateWriteData(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const { cardId } = req.params;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Get user's profiles
      const profiles = await ProfileModel.find({
        'profileInformation.creator': user._id
      });

      const profileIds = profiles.map(p => p._id);

      // Find card that belongs to user's profiles
      const card = await NFCCardModel.findOne({
        cardId,
        profileId: { $in: profileIds }
      });

      if (!card) {
        return res.status(404).json({
          success: false,
          error: 'Card not found'
        });
      }

      const writeData = await NFCService.generateWriteData(cardId, card.profileId.toString());

      res.json({
        success: true,
        data: writeData
      });

    } catch (error) {
      console.error('Error generating write data:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate write data'
      });
    }
  }

  /**
   * Get card data for NFC reading (public endpoint)
   * @route GET /api/nfc/cards/:cardId/read-data
   */
  static async getCardReadData(req: Request, res: Response) {
    try {
      const { cardId } = req.params;

      // Find card (public endpoint, no auth required)
      const card = await NFCCardModel.findOne({ cardId })
        .populate('profileId', 'profileInformation');

      if (!card) {
        return res.status(404).json({
          success: false,
          error: 'Card not found'
        });
      }

      // Check if card is active and accessible
      if (card.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: 'Card is not active'
        });
      }

      // Check access control
      if (card.accessControl.accessLevel === 'private') {
        return res.status(403).json({
          success: false,
          error: 'Card access is private'
        });
      }

      // Generate read data
      const readData = await NFCService.generateWriteData(cardId, card.profileId.toString());

      res.json({
        success: true,
        data: readData
      });

    } catch (error) {
      console.error('Error getting card read data:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get card data'
      });
    }
  }

  /**
   * Record a scan (public endpoint)
   * @route POST /api/nfc/scan
   */
  static async recordScan(req: Request, res: Response) {
    try {
      const { cardId, scannedBy, location, deviceInfo } = req.body;

      if (!cardId) {
        return res.status(400).json({
          success: false,
          error: 'Card ID is required'
        });
      }

      // Find the card
      const card = await NFCCardModel.findOne({ cardId });

      if (!card) {
        return res.status(404).json({
          success: false,
          error: 'Card not found'
        });
      }

      // Record the scan
      const scanData = {
        cardId: card._id,
        profileId: card.profileId,
        scannedBy: scannedBy ? new mongoose.Types.ObjectId(scannedBy) : undefined,
        location,
        deviceInfo,
        ipAddress: req.ip || req.socket.remoteAddress
      };

      const scan = new ScanModel(scanData);
      await scan.save();

      // Update card analytics
      card.analytics.totalScans += 1;
      card.analytics.lastScanLocation = location;
      card.analytics.scanHistory.push({
        scannedBy: scannedBy ? new mongoose.Types.ObjectId(scannedBy) : undefined,
        timestamp: new Date(),
        location,
        deviceInfo,
        ipAddress: req.ip || req.socket.remoteAddress
      });

      // Keep only last 100 scan history entries
      if (card.analytics.scanHistory.length > 100) {
        card.analytics.scanHistory = card.analytics.scanHistory.slice(-100);
      }

      card.lastScanDate = new Date();
      await card.save();

      res.json({
        success: true,
        message: 'Scan recorded successfully'
      });

    } catch (error) {
      console.error('Error recording scan:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record scan'
      });
    }
  }

  /**
   * Get card analytics
   * @route GET /api/nfc/cards/:cardId/analytics
   */
  static async getCardAnalytics(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const { cardId } = req.params;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Get user's profiles
      const profiles = await ProfileModel.find({
        'profileInformation.creator': user._id
      });

      const profileIds = profiles.map(p => p._id);

      // Find card that belongs to user's profiles
      const card = await NFCCardModel.findOne({
        cardId,
        profileId: { $in: profileIds }
      });

      if (!card) {
        return res.status(404).json({
          success: false,
          error: 'Card not found'
        });
      }

      // Get scan analytics
      const scans = await ScanModel.find({ cardId: card._id })
        .sort({ timestamp: -1 })
        .limit(100);

      const analytics = {
        totalScans: card.analytics.totalScans,
        uniqueScans: card.analytics.uniqueScans,
        lastScanDate: card.lastScanDate,
        lastScanLocation: card.analytics.lastScanLocation,
        recentScans: scans.slice(0, 10),
        scansByDay: await this.getScansByDay(card._id as mongoose.Types.ObjectId),
        scansByLocation: await this.getScansByLocation(card._id as mongoose.Types.ObjectId)
      };

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      console.error('Error getting card analytics:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get analytics'
      });
    }
  }

  /**
   * Get scan history for a card
   * @route GET /api/nfc/cards/:cardId/scans
   */
  static async getCardScans(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const { cardId } = req.params;
      const { page = 1, limit = 20, startDate, endDate } = req.query;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Get user's profiles
      const profiles = await ProfileModel.find({
        'profileInformation.creator': user._id
      });

      const profileIds = profiles.map(p => p._id);

      // Find card that belongs to user's profiles
      const card = await NFCCardModel.findOne({
        cardId,
        profileId: { $in: profileIds }
      });

      if (!card) {
        return res.status(404).json({
          success: false,
          error: 'Card not found'
        });
      }

      // Build query
      const query: any = { cardId: card._id };

      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate as string);
        if (endDate) query.timestamp.$lte = new Date(endDate as string);
      }

      // Get paginated scans
      const skip = (Number(page) - 1) * Number(limit);
      const scans = await ScanModel.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('scannedBy', 'fullName email');

      const total = await ScanModel.countDocuments(query);

      res.json({
        success: true,
        data: {
          scans,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });

    } catch (error) {
      console.error('Error getting card scans:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get scans'
      });
    }
  }

  /**
   * Get available configuration templates
   * @route GET /api/nfc/templates
   */
  static async getTemplates(req: Request, res: Response) {
    try {
      const templates = [
        {
          name: 'full',
          displayName: 'Full Profile',
          description: 'Includes all profile information',
          fields: ['name', 'title', 'email', 'phone', 'company', 'profileLink', 'connectLink', 'socialLinks']
        },
        {
          name: 'minimal',
          displayName: 'Minimal Profile',
          description: 'Basic contact information only',
          fields: ['name', 'email', 'phone', 'profileLink']
        },
        {
          name: 'custom',
          displayName: 'Custom Template',
          description: 'Customizable field selection',
          fields: [] // User can select fields
        }
      ];

      res.json({
        success: true,
        data: templates
      });

    } catch (error) {
      console.error('Error getting templates:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get templates'
      });
    }
  }

  /**
   * Get template details
   * @route GET /api/nfc/templates/:templateName
   */
  static async getTemplate(req: Request, res: Response) {
    try {
      const { templateName } = req.params;

      const templates: any = {
        full: {
          name: 'full',
          displayName: 'Full Profile',
          description: 'Includes all profile information',
          fields: ['name', 'title', 'email', 'phone', 'company', 'profileLink', 'connectLink', 'socialLinks'],
          maxDataSize: 8192 // bytes
        },
        minimal: {
          name: 'minimal',
          displayName: 'Minimal Profile',
          description: 'Basic contact information only',
          fields: ['name', 'email', 'phone', 'profileLink'],
          maxDataSize: 2048 // bytes
        },
        custom: {
          name: 'custom',
          displayName: 'Custom Template',
          description: 'Customizable field selection',
          fields: [],
          maxDataSize: 8192, // bytes
          availableFields: ['name', 'title', 'email', 'phone', 'company', 'profileLink', 'connectLink', 'socialLinks', 'address', 'website']
        }
      };

      const template = templates[templateName];

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      res.json({
        success: true,
        data: template
      });

    } catch (error) {
      console.error('Error getting template:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get template'
      });
    }
  }

  /**
   * Get analytics overview for all user's cards
   * @route GET /api/nfc/analytics/overview
   */
  static async getUserAnalyticsOverview(req: Request, res: Response) {
    try {
      const user = req.user as any;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Get user's profiles
      const profiles = await ProfileModel.find({
        'profileInformation.creator': user._id
      });

      const profileIds = profiles.map(p => p._id);

      // Get all cards for user's profiles
      const cards = await NFCCardModel.find({
        profileId: { $in: profileIds }
      });

      // Calculate overview analytics
      const totalCards = cards.length;
      const activeCards = cards.filter(c => c.status === 'active').length;
      const totalScans = cards.reduce((sum, card) => sum + card.analytics.totalScans, 0);
      const totalUniqueScans = cards.reduce((sum, card) => sum + card.analytics.uniqueScans, 0);

      // Get recent scans across all cards
      const cardIds = cards.map(c => c._id);
      const recentScans = await ScanModel.find({ cardId: { $in: cardIds } })
        .sort({ timestamp: -1 })
        .limit(10)
        .populate('cardId', 'cardId')
        .populate('profileId', 'profileInformation.fullName');

      const overview = {
        totalCards,
        activeCards,
        totalScans,
        totalUniqueScans,
        recentScans,
        cardsByType: this.getCardsByType(cards),
        scanTrends: await this.getScanTrends(cardIds as mongoose.Types.ObjectId[])
      };

      res.json({
        success: true,
        data: overview
      });

    } catch (error) {
      console.error('Error getting user analytics overview:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get analytics overview'
      });
    }
  }

  /**
   * Export card data
   * @route GET /api/nfc/cards/:cardId/export
   */
  static async exportCardData(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const { cardId } = req.params;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Get user's profiles
      const profiles = await ProfileModel.find({
        'profileInformation.creator': user._id
      });

      const profileIds = profiles.map(p => p._id);

      // Find card that belongs to user's profiles
      const card = await NFCCardModel.findOne({
        cardId,
        profileId: { $in: profileIds }
      }).populate('profileId');

      if (!card) {
        return res.status(404).json({
          success: false,
          error: 'Card not found'
        });
      }

      // Get all scans for this card
      const scans = await ScanModel.find({ cardId: card._id })
        .sort({ timestamp: -1 })
        .populate('scannedBy', 'fullName email');

      const exportData = {
        card: {
          cardId: card.cardId,
          cardType: card.cardType,
          status: card.status,
          createdAt: card.createdAt,
          configuration: card.configuration,
          accessControl: card.accessControl
        },
        profile: card.profileId,
        analytics: card.analytics,
        scans: scans.map(scan => ({
          timestamp: scan.get("timestamp"),
          scannedBy: scan.get("scannedBy"),
          location: scan.get("location"),
          deviceInfo: scan.get("deviceInfo"),
          ipAddress: scan.get("ipAddress")
        }))
      };

      res.json({
        success: true,
        data: exportData
      });

    } catch (error) {
      console.error('Error exporting card data:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export card data'
      });
    }
  }

  /**
   * Bulk update access control for multiple cards
   * @route PUT /api/nfc/cards/bulk/access-control
   */
  static async bulkUpdateAccessControl(req: Request, res: Response) {
    try {
      const user = req.user as any;
      const { cardIds, accessControl } = req.body;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Get user's profiles
      const profiles = await ProfileModel.find({
        'profileInformation.creator': user._id
      });

      const profileIds = profiles.map(p => p._id);

      // Find cards that belong to user's profiles
      const cards = await NFCCardModel.find({
        cardId: { $in: cardIds },
        profileId: { $in: profileIds }
      });

      if (cards.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No cards found'
        });
      }

      // Update access control for all found cards
      const updatePromises = cards.map(card =>
        NFCService.configureCard(card.cardId, card.profileId.toString(), {
          accessControl
        })
      );

      const updatedCards = await Promise.all(updatePromises);

      res.json({
        success: true,
        data: {
          updatedCount: updatedCards.length,
          cards: updatedCards
        }
      });

    } catch (error) {
      console.error('Error bulk updating access control:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to bulk update access control'
      });
    }
  }

  // Helper methods
  private static getCardsByType(cards: any[]) {
    const types = cards.reduce((acc, card) => {
      acc[card.cardType] = (acc[card.cardType] || 0) + 1;
      return acc;
    }, {});
    return types;
  }

  private static async getScansByDay(cardId: mongoose.Types.ObjectId) {
    const scans = await ScanModel.aggregate([
      { $match: { cardId } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    return scans.map(item => ({ date: item._id, count: item.count }));
  }

  private static async getScansByLocation(cardId: mongoose.Types.ObjectId) {
    const scans = await ScanModel.aggregate([
      { $match: { cardId, 'location.address': { $exists: true } } },
      {
        $group: {
          _id: '$location.address',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    return scans.map(item => ({ location: item._id, count: item.count }));
  }

  private static async getScanTrends(cardIds: mongoose.Types.ObjectId[]) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trends = await ScanModel.aggregate([
      {
        $match: {
          cardId: { $in: cardIds },
          timestamp: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return trends.map(item => ({ date: item._id, count: item.count }));
  }
}
