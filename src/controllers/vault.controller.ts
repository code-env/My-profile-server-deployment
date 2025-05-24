/**
 * @file vault.controller.ts
 * @description Vault Controller for Digital Asset Management
 * ========================================================
 *
 * This controller handles all HTTP requests for the Vault system,
 * including wallet items, documents, media, and albums.
 *
 * @version 1.0.0
 * @author My Profile Server
 */

import { Request, Response } from 'express';
import { vaultService } from '../services/vault.service';
import { ProfileModel } from '../models/profile.model';

export class VaultController {
  // ===========================
  // HELPER METHODS
  // ===========================

  /**
   * Get user's primary profile ID
   */
  private async getUserProfileId(user: any): Promise<string> {
    // First check if user has a profileId field (legacy)
    if (user.profileId) {
      return user.profileId;
    }

    // Check if user has profiles array and get the first one
    if (user.profiles && user.profiles.length > 0) {
      return user.profiles[0].toString();
    }

    // If no profiles found, look for profiles created by this user
    const userProfile = await ProfileModel.findOne({
      'profileInformation.creator': user._id
    }).sort({ createdAt: 1 }); // Get the oldest/first profile

    if (userProfile) {
      return userProfile._id.toString();
    }

    throw new Error('No profile found for user');
  }

  // ===========================
  // GENERAL VAULT OPERATIONS
  // ===========================

  /**
   * Get all vault items for a profile with filtering and pagination
   */
  async getVaultItems(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const profileId = await this.getUserProfileId(req.user);

      const {
        category,
        subcategory,
        tags,
        search,
        isFavorite,
        limit = 50,
        offset = 0,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const options = {
        category: category as 'wallet' | 'documents' | 'media' | undefined,
        subcategory: subcategory as string | undefined,
        tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined,
        search: search as string | undefined,
        isFavorite: isFavorite === 'true' ? true : isFavorite === 'false' ? false : undefined,
        limit: Math.min(parseInt(limit as string) || 50, 100),
        offset: parseInt(offset as string) || 0,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc'
      };

      const items = await vaultService.getVaultItems(profileId, options);

      res.json({
        success: true,
        data: items,
        pagination: {
          limit: options.limit,
          offset: options.offset,
          total: items.length
        }
      });
    } catch (error) {
      console.error('Error getting vault items:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve vault items'
      });
    }
  }

  /**
   * Get a specific vault item by ID
   */
  async getVaultItem(req: Request, res: Response) {
    try {
      const profileId = await this.getUserProfileId(req.user!);
      const { itemId } = req.params;

      const item = await vaultService.getVaultItem(profileId, itemId);

      res.json({
        success: true,
        data: item
      });
    } catch (error) {
      console.error('Error getting vault item:', error);
      if (error instanceof Error && error.message === 'Vault item not found') {
        return res.status(404).json({
          success: false,
          error: 'Vault item not found'
        });
      }
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve vault item'
      });
    }
  }

  /**
   * Delete a vault item
   */
  async deleteVaultItem(req: Request, res: Response) {
    try {
      const profileId = await this.getUserProfileId(req.user!);
      const { itemId } = req.params;

      const result = await vaultService.deleteVaultItem(profileId, itemId);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Error deleting vault item:', error);
      if (error instanceof Error && error.message === 'Vault item not found') {
        return res.status(404).json({
          success: false,
          error: 'Vault item not found'
        });
      }
      res.status(500).json({
        success: false,
        error: 'Failed to delete vault item'
      });
    }
  }

  // ===========================
  // WALLET OPERATIONS
  // ===========================

  /**
   * Create a new wallet item
   */
  async createWalletItem(req: Request, res: Response) {
    try {
      const profileId = await this.getUserProfileId(req.user!);

      const walletData = req.body;
      const item = await vaultService.createWalletItem(profileId, walletData);

      res.status(201).json({
        success: true,
        message: 'Wallet item created successfully',
        data: item
      });
    } catch (error) {
      console.error('Error creating wallet item:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create wallet item'
      });
    }
  }

  /**
   * Update a wallet item
   */
  async updateWalletItem(req: Request, res: Response) {
    try {
      const profileId = await this.getUserProfileId(req.user!);
      const { itemId } = req.params;

      const updates = req.body;
      const item = await vaultService.updateWalletItem(profileId, itemId, updates);

      res.json({
        success: true,
        message: 'Wallet item updated successfully',
        data: item
      });
    } catch (error) {
      console.error('Error updating wallet item:', error);
      if (error instanceof Error && error.message === 'Wallet item not found') {
        return res.status(404).json({
          success: false,
          error: 'Wallet item not found'
        });
      }
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update wallet item'
      });
    }
  }

  /**
   * Upload card image (front or back)
   */
  async uploadCardImage(req: Request, res: Response) {
    try {
      const profileId = await this.getUserProfileId(req.user!);
      const { itemId } = req.params;
      const { side } = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Image file is required'
        });
      }

      if (!side || !['front', 'back'].includes(side)) {
        return res.status(400).json({
          success: false,
          error: 'Side must be either "front" or "back"'
        });
      }

      const result = await vaultService.uploadCardImage(profileId, itemId, req.file, side);

      res.json({
        success: true,
        message: `Card ${side} image uploaded successfully`,
        data: result
      });
    } catch (error) {
      console.error('Error uploading card image:', error);
      if (error instanceof Error && error.message === 'Wallet item not found') {
        return res.status(404).json({
          success: false,
          error: 'Wallet item not found'
        });
      }
      res.status(500).json({
        success: false,
        error: 'Failed to upload card image'
      });
    }
  }

  // ===========================
  // DOCUMENT OPERATIONS
  // ===========================

  /**
   * Create a new document item
   */
  async createDocumentItem(req: Request, res: Response) {
    try {
      const profileId = await this.getUserProfileId(req.user!);

      const documentData = req.body;
      const file = req.file;

      const item = await vaultService.createDocumentItem(profileId, documentData, file);

      res.status(201).json({
        success: true,
        message: 'Document item created successfully',
        data: item
      });
    } catch (error) {
      console.error('Error creating document item:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create document item'
      });
    }
  }

  /**
   * Update a document item
   */
  async updateDocumentItem(req: Request, res: Response) {
    try {
      const profileId = await this.getUserProfileId(req.user!);
      const { itemId } = req.params;

      const updates = req.body;
      const item = await vaultService.updateDocumentItem(profileId, itemId, updates);

      res.json({
        success: true,
        message: 'Document item updated successfully',
        data: item
      });
    } catch (error) {
      console.error('Error updating document item:', error);
      if (error instanceof Error && error.message === 'Document item not found') {
        return res.status(404).json({
          success: false,
          error: 'Document item not found'
        });
      }
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update document item'
      });
    }
  }

  /**
   * Link document to existing scan
   */
  async linkDocumentToScan(req: Request, res: Response) {
    try {
      const profileId = await this.getUserProfileId(req.user!);
      const { itemId } = req.params;
      const { scanId } = req.body;

      if (!scanId) {
        return res.status(400).json({
          success: false,
          error: 'Scan ID is required'
        });
      }

      const item = await vaultService.linkDocumentToScan(profileId, itemId, scanId);

      res.json({
        success: true,
        message: 'Document linked to scan successfully',
        data: item
      });
    } catch (error) {
      console.error('Error linking document to scan:', error);
      if (error instanceof Error && error.message === 'Document item not found') {
        return res.status(404).json({
          success: false,
          error: 'Document item not found'
        });
      }
      res.status(400).json({
        success: false,
        error: 'Failed to link document to scan'
      });
    }
  }

  // ===========================
  // MEDIA OPERATIONS
  // ===========================

  /**
   * Create a new media item
   */
  async createMediaItem(req: Request, res: Response) {
    try {
      const profileId = await this.getUserProfileId(req.user!);

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Media file is required'
        });
      }

      const mediaData = req.body;
      const item = await vaultService.createMediaItem(profileId, mediaData, req.file);

      res.status(201).json({
        success: true,
        message: 'Media item created successfully',
        data: item
      });
    } catch (error) {
      console.error('Error creating media item:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create media item'
      });
    }
  }

  /**
   * Update a media item
   */
  async updateMediaItem(req: Request, res: Response) {
    try {
      const profileId = await this.getUserProfileId(req.user!);
      const { itemId } = req.params;

      const updates = req.body;
      const item = await vaultService.updateMediaItem(profileId, itemId, updates);

      res.json({
        success: true,
        message: 'Media item updated successfully',
        data: item
      });
    } catch (error) {
      console.error('Error updating media item:', error);
      if (error instanceof Error && error.message === 'Media item not found') {
        return res.status(404).json({
          success: false,
          error: 'Media item not found'
        });
      }
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update media item'
      });
    }
  }

  // ===========================
  // ALBUM OPERATIONS
  // ===========================

  /**
   * Create a new album
   */
  async createAlbum(req: Request, res: Response) {
    try {
      const profileId = await this.getUserProfileId(req.user!);

      const albumData = req.body;
      const album = await vaultService.createAlbum(profileId, albumData);

      res.status(201).json({
        success: true,
        message: 'Album created successfully',
        data: album
      });
    } catch (error) {
      console.error('Error creating album:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create album'
      });
    }
  }

  /**
   * Get all albums for a profile
   */
  async getAlbums(req: Request, res: Response) {
    try {
      const profileId = await this.getUserProfileId(req.user!);

      const albums = await vaultService.getAlbums(profileId);

      res.json({
        success: true,
        data: albums
      });
    } catch (error) {
      console.error('Error getting albums:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve albums'
      });
    }
  }

  /**
   * Update an album
   */
  async updateAlbum(req: Request, res: Response) {
    try {
      const profileId = await this.getUserProfileId(req.user!);
      const { albumId } = req.params;

      const updates = req.body;
      const album = await vaultService.updateAlbum(profileId, albumId, updates);

      res.json({
        success: true,
        message: 'Album updated successfully',
        data: album
      });
    } catch (error) {
      console.error('Error updating album:', error);
      if (error instanceof Error && error.message === 'Album not found') {
        return res.status(404).json({
          success: false,
          error: 'Album not found'
        });
      }
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update album'
      });
    }
  }

  /**
   * Delete an album
   */
  async deleteAlbum(req: Request, res: Response) {
    try {
      const profileId = await this.getUserProfileId(req.user!);
      const { albumId } = req.params;

      const result = await vaultService.deleteAlbum(profileId, albumId);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Error deleting album:', error);
      if (error instanceof Error && error.message === 'Album not found') {
        return res.status(404).json({
          success: false,
          error: 'Album not found'
        });
      }
      res.status(500).json({
        success: false,
        error: 'Failed to delete album'
      });
    }
  }

  // ===========================
  // ANALYTICS & STATISTICS
  // ===========================

  /**
   * Get vault statistics for a profile
   */
  async getVaultStats(req: Request, res: Response) {
    try {
      const profileId = await this.getUserProfileId(req.user!);

      const stats = await vaultService.getVaultStats(profileId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting vault stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve vault statistics'
      });
    }
  }

  /**
   * Get vault activity log
   */
  async getVaultActivity(req: Request, res: Response) {
    try {
      const profileId = await this.getUserProfileId(req.user!);

      const {
        itemId,
        action,
        limit = 50,
        offset = 0
      } = req.query;

      const options = {
        itemId: itemId as string | undefined,
        action: action as string | undefined,
        limit: Math.min(parseInt(limit as string) || 50, 100),
        offset: parseInt(offset as string) || 0
      };

      const activities = await vaultService.getVaultActivity(profileId, options);

      res.json({
        success: true,
        data: activities,
        pagination: {
          limit: options.limit,
          offset: options.offset,
          total: activities.length
        }
      });
    } catch (error) {
      console.error('Error getting vault activity:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve vault activity'
      });
    }
  }

  // ===========================
  // SHARING & ACCESS CONTROL
  // ===========================

  /**
   * Share a vault item with other profiles
   */
  async shareVaultItem(req: Request, res: Response) {
    try {
      const profileId = await this.getUserProfileId(req.user!);
      const { itemId } = req.params;
      const { shareWithProfileIds, accessLevel = 'shared' } = req.body;

      if (!shareWithProfileIds || !Array.isArray(shareWithProfileIds)) {
        return res.status(400).json({
          success: false,
          error: 'shareWithProfileIds must be an array'
        });
      }

      const item = await vaultService.shareVaultItem(
        profileId,
        itemId,
        shareWithProfileIds,
        accessLevel
      );

      res.json({
        success: true,
        message: 'Item shared successfully',
        data: item
      });
    } catch (error) {
      console.error('Error sharing vault item:', error);
      if (error instanceof Error && error.message === 'Vault item not found') {
        return res.status(404).json({
          success: false,
          error: 'Vault item not found'
        });
      }
      res.status(400).json({
        success: false,
        error: 'Failed to share vault item'
      });
    }
  }

  /**
   * Get items shared with current profile
   */
  async getSharedItems(req: Request, res: Response) {
    try {
      const profileId = await this.getUserProfileId(req.user!);

      const items = await vaultService.getSharedItems(profileId);

      res.json({
        success: true,
        data: items
      });
    } catch (error) {
      console.error('Error getting shared items:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve shared items'
      });
    }
  }

  // ===========================
  // SEARCH FUNCTIONALITY
  // ===========================

  /**
   * Search vault items
   */
  async searchVault(req: Request, res: Response) {
    try {
      const profileId = await this.getUserProfileId(req.user!);

      const {
        q: query,
        categories,
        tags,
        dateFrom,
        dateTo
      } = req.query;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
      }

      const filters = {
        categories: categories ? (Array.isArray(categories) ? categories as string[] : [categories as string]) : undefined,
        tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined
      };

      const results = await vaultService.searchVault(profileId, query, filters);

      res.json({
        success: true,
        data: results,
        count: results.length
      });
    } catch (error) {
      console.error('Error searching vault:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search vault'
      });
    }
  }
}

// Export wrapped controller for consistent interface
export const vaultController = {
  // General operations
  getVaultItems: new VaultController().getVaultItems.bind(new VaultController()),
  getVaultItem: new VaultController().getVaultItem.bind(new VaultController()),
  deleteVaultItem: new VaultController().deleteVaultItem.bind(new VaultController()),

  // Wallet operations
  createWalletItem: new VaultController().createWalletItem.bind(new VaultController()),
  updateWalletItem: new VaultController().updateWalletItem.bind(new VaultController()),
  uploadCardImage: new VaultController().uploadCardImage.bind(new VaultController()),

  // Document operations
  createDocumentItem: new VaultController().createDocumentItem.bind(new VaultController()),
  updateDocumentItem: new VaultController().updateDocumentItem.bind(new VaultController()),
  linkDocumentToScan: new VaultController().linkDocumentToScan.bind(new VaultController()),

  // Media operations
  createMediaItem: new VaultController().createMediaItem.bind(new VaultController()),
  updateMediaItem: new VaultController().updateMediaItem.bind(new VaultController()),

  // Album operations
  createAlbum: new VaultController().createAlbum.bind(new VaultController()),
  getAlbums: new VaultController().getAlbums.bind(new VaultController()),
  updateAlbum: new VaultController().updateAlbum.bind(new VaultController()),
  deleteAlbum: new VaultController().deleteAlbum.bind(new VaultController()),

  // Analytics
  getVaultStats: new VaultController().getVaultStats.bind(new VaultController()),
  getVaultActivity: new VaultController().getVaultActivity.bind(new VaultController()),

  // Sharing
  shareVaultItem: new VaultController().shareVaultItem.bind(new VaultController()),
  getSharedItems: new VaultController().getSharedItems.bind(new VaultController()),

  // Search
  searchVault: new VaultController().searchVault.bind(new VaultController())
};

export default vaultController;
