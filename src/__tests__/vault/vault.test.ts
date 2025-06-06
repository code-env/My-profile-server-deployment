import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import express from 'express';
import { Vault, VaultCategory, VaultSubcategory, VaultItem } from '../../models/Vault';
import { VaultVersion } from '../../models/VaultVersion';
import { VaultItemVersion } from '../../models/VaultItemVersion';
import { VaultAuditLog } from '../../models/VaultAuditLog';
import { User } from '../../models/User';
import { ProfileModel } from '../../models/profile.model';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';

// Mock external dependencies first
jest.mock('../../services/cloudinary.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    configure: jest.fn(),
    uploadFile: jest.fn().mockResolvedValue({
      secure_url: 'https://example.com/test-file.jpg',
      public_id: 'test-public-id',
      bytes: 1024,
      format: 'jpg'
    }),
    uploadAndReturnAllInfo: jest.fn().mockResolvedValue({
      secure_url: 'https://example.com/test-file.jpg',
      public_id: 'test-public-id',
      bytes: 1024,
      format: 'jpg',
      resource_type: 'image'
    }),
    delete: jest.fn().mockResolvedValue({ result: 'ok' }),
    moveToArchive: jest.fn().mockResolvedValue(undefined)
  }))
}));

jest.mock('../../services/notification.service', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotification: jest.fn().mockResolvedValue(true)
  }))
}));

// Mock the SettingsService to prevent errors
jest.mock('../../services/settings.service', () => {
  return {
    SettingsService: jest.fn().mockImplementation(() => ({
      getSettings: jest.fn().mockResolvedValue({
        specificSettings: {
          vaultStorageLimit: 104857600,
          vaultCompressionEnabled: true,
          vaultEncryptionEnabled: false,
          vaultMaxFileSize: 104857600,
          vaultAllowedFileTypes: ['*'],
          vaultAutoDeleteOldFiles: false,
          vaultAutoDeleteDays: 365
        },
        dataSettings: {
          autoDataBackup: true
        },
        privacy: {
          Visibility: {
            profile: { vault: 'public' },
            vault: { 
              wallet: 'public',
              documents: 'private',
              media: 'connections'
            }
          },
          permissions: {
            share: { enabled: true, level: 'connections' },
            export: { enabled: false },
            download: { enabled: true, level: 'owner' }
          }
        },
        notifications: {
          Account: { storageLevel: { email: true, push: false } }
        }
      }),
      updateSettings: jest.fn().mockResolvedValue({
        success: true,
        data: {
          specificSettings: {
            vaultStorageLimit: 104857600,
            vaultCompressionEnabled: true,
            vaultEncryptionEnabled: false
          }
        }
      })
    }))
  };
});

// Import services after mocks
import { vaultService } from '../../services/vault.service';
import * as vaultController from '../../controllers/vault.controller';

describe('Vault System Tests', () => {
  let mongoServer: MongoMemoryServer;
  let app: express.Application;
  let testUser: any;
  let testProfile: any;
  let authToken: string;
  let testVault: any;
  let walletCategoryId: string;
  let documentsCategoryId: string;
  let mediaCategoryId: string;
  let myProfileSubcategoryId: string;
  let documentsSubcategoryId: string;
  let photosSubcategoryId: string;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Setup Express app
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware - set req.user properly
    app.use((req: any, res, next) => {
      if (testUser) {
        req.user = { 
          id: testUser._id,
          _id: testUser._id,
          ...testUser?.toObject()
        };
      }
      next();
    });

    // Setup routes based on actual vault routes
    app.get('/vault', vaultController.getUserVault);
    app.get('/vault/items', vaultController.getItems);
    app.post('/vault/items', vaultController.addItem);
    app.get('/vault/items/:itemId', vaultController.trackAccess, vaultController.getItemById);
    app.put('/vault/items/:itemId', vaultController.trackAccess, vaultController.updateItem);
    app.delete('/vault/items/:itemId', vaultController.trackAccess, vaultController.deleteItem);
    app.get('/vault/categories', vaultController.getCategories);
    app.post('/vault/categories', vaultController.createCategory);
    app.post('/vault/subcategories', vaultController.createSubcategory);
    app.get('/vault/subcategories', vaultController.getSubcategories);
    app.get('/vault/subcategories/nested', vaultController.getNestedSubcategories);
    app.post('/vault/subcategories/move', vaultController.moveSubcategory);
    app.delete('/vault/subcategories', vaultController.deleteSubcategory);
    app.get('/vault/settings/:profileId', vaultController.getVaultSettings);
    app.put('/vault/settings/:profileId', vaultController.updateVaultSettings);

    // Add new routes for advanced features
    app.post('/vault/search', vaultController.advancedSearch);
    app.get('/vault/analytics/:profileId', vaultController.getVaultAnalytics);
    app.get('/vault/items/:itemId/audit-trail', vaultController.getAuditTrail);
    app.get('/vault/items/:itemId/versions', vaultController.getVersions);
    app.post('/vault/items/:itemId/versions/restore', vaultController.restoreVersion);
    app.post('/vault/batch/update', vaultController.batchUpdate);
    app.post('/vault/batch/delete', vaultController.batchDelete);
    app.post('/vault/batch/move', vaultController.batchMove);

    // Add proper error handling middleware that matches the app structure
    app.use((err: any, req: any, res: any, next: any) => {
      console.error('Test error caught:', err.message);
      
      // Check if it's an HTTP error with status
      if (err.status || err.statusCode) {
        return res.status(err.status || err.statusCode).json({ 
          success: false,
          message: err.message 
        });
      }
      
      // Default error handling
      res.status(500).json({ 
        success: false,
        message: err.message || 'Internal server error' 
      });
    });
  });

  beforeEach(async () => {
    // Clear all collections
    await Promise.all([
      Vault.deleteMany({}),
      VaultCategory.deleteMany({}),
      VaultSubcategory.deleteMany({}),
      VaultItem.deleteMany({}),
      VaultVersion.deleteMany({}),
      VaultItemVersion.deleteMany({}),
      VaultAuditLog.deleteMany({}),
      User.deleteMany({}),
      ProfileModel.deleteMany({})
    ]);

    // Create test user
    testUser = await User.create({
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      fullName: 'Test User',
      username: 'testuser',
      dateOfBirth: new Date('1990-01-01'),
      countryOfResidence: 'US',
      phoneNumber: '+1234567890',
      accountType: 'MYSELF',
      accountCategory: 'PRIMARY_ACCOUNT',
      verificationMethod: 'EMAIL',
      signupType: 'email',
      password: 'hashedpassword'
    });

    // Create test profile
    testProfile = await ProfileModel.create({
      profileInformation: {
        username: 'testprofile',
        profileLink: 'test-profile-link',
        connectLink: 'test-connect-link',
        followLink: 'test-follow-link',
        creator: testUser._id
      },
      templatedId: new mongoose.Types.ObjectId(),
      profileType: 'personal',
      profileCategory: 'individual'
    });

    // Create test vault
    testVault = await Vault.create({
      userId: testUser._id,
      profileId: testProfile._id,
      storageUsed: 0,
      storageLimit: 104857600 // 100MB
    });

    // Create categories using the vault service
    const walletCategory = await VaultCategory.create({
      vaultId: testVault._id,
      name: 'Wallet',
      order: 0
    });

    const documentsCategory = await VaultCategory.create({
      vaultId: testVault._id,
      name: 'Documents',
      order: 1
    });

    const mediaCategory = await VaultCategory.create({
      vaultId: testVault._id,
      name: 'Media',
      order: 2
    });

    walletCategoryId = walletCategory._id.toString();
    documentsCategoryId = documentsCategory._id.toString();
    mediaCategoryId = mediaCategory._id.toString();

    // Create subcategories
    const myProfileSub = await VaultSubcategory.create({
      vaultId: testVault._id,
      categoryId: walletCategory._id,
      name: 'MyProfile',
      order: 0
    });

    const documentsSub = await VaultSubcategory.create({
      vaultId: testVault._id,
      categoryId: documentsCategory._id,
      name: 'Documents',
      order: 0
    });

    const photosSub = await VaultSubcategory.create({
      vaultId: testVault._id,
      categoryId: mediaCategory._id,
      name: 'Photos',
      order: 0
    });

    myProfileSubcategoryId = myProfileSub._id.toString();
    documentsSubcategoryId = documentsSub._id.toString();
    photosSubcategoryId = photosSub._id.toString();

    // Generate auth token
    authToken = jwt.sign({ userId: testUser._id }, 'test-secret');
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('Vault Controller Tests', () => {
    describe('GET /vault - Get User Vault', () => {
      it('should get user vault successfully', async () => {
        const response = await request(app)
          .get('/vault')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ profileId: testProfile._id.toString() });

        console.log('Vault response:', response.status, response.body);
        expect(response.status).toBe(200);
        expect(response.body.message).toBeDefined();
        expect(response.body.vault).toBeDefined();
      });

      it('should require profileId', async () => {
        const response = await request(app)
          .get('/vault')
          .set('Authorization', `Bearer ${authToken}`);

        console.log('No profileId response:', response.status, response.body);
        expect(response.status).toBe(400);
        expect(response.body.message || response.body.error).toContain('Profile ID is required');
      });
    });

    describe('POST /vault/items - Add Item', () => {
      it('should add a wallet item successfully', async () => {
        const itemData = {
          profileId: testProfile._id.toString(),
          category: 'Wallet',
          subcategoryId: myProfileSubcategoryId,
          type: 'card',
          title: 'Test Credit Card',
          description: 'Test card description',
          card: {
            number: '4111111111111111',
            expiryDate: '2025-12-31',
            holderName: 'Test User',
            issuer: 'Test Bank'
          }
        };

        const response = await request(app)
          .post('/vault/items')
          .set('Authorization', `Bearer ${authToken}`)
          .send(itemData);

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('Item added successfully');
        expect(response.body.item).toBeDefined();
        expect(response.body.item.title).toBe(itemData.title);
      });

      it('should add a document item successfully', async () => {
        const itemData = {
          profileId: testProfile._id.toString(),
          category: 'Documents',
          subcategoryId: documentsSubcategoryId,
          type: 'document',
          title: 'Test Document',
          description: 'Test document description',
          document: {
            type: 'passport',
            number: 'P123456789',
            issueDate: '2020-01-01',
            expiryDate: '2030-01-01',
            authority: 'Government Agency'
          }
        };

        const response = await request(app)
          .post('/vault/items')
          .set('Authorization', `Bearer ${authToken}`)
          .send(itemData);

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('Item added successfully');
        expect(response.body.item).toBeDefined();
        expect(response.body.item.title).toBe(itemData.title);
      });

      it('should require profileId', async () => {
        const itemData = {
          category: 'Wallet',
          subcategoryId: myProfileSubcategoryId,
          title: 'Test Card'
        };

        const response = await request(app)
          .post('/vault/items')
          .set('Authorization', `Bearer ${authToken}`)
          .send(itemData);

        console.log('Add item no profileId response:', response.status, response.body);
        expect(response.status).toBe(400);
        expect(response.body.message || response.body.error).toContain('Profile ID is required');
      });

      it('should require category and subcategoryId', async () => {
        const itemData = {
          profileId: testProfile._id.toString(),
          title: 'Test Item'
        };

        const response = await request(app)
          .post('/vault/items')
          .set('Authorization', `Bearer ${authToken}`)
          .send(itemData);

        console.log('Add item missing fields response:', response.status, response.body);
        expect(response.status).toBe(400);
        expect(response.body.message || response.body.error).toContain('Category and subcategory ID are required');
      });

      it('should validate card number format', async () => {
        const itemData = {
          profileId: testProfile._id.toString(),
          category: 'Wallet',
          subcategoryId: myProfileSubcategoryId,
          type: 'card',
          title: 'Invalid Card',
          card: {
            number: '123', // Invalid format
            holderName: 'Test User'
          }
        };

        const response = await request(app)
          .post('/vault/items')
          .set('Authorization', `Bearer ${authToken}`)
          .send(itemData);

        console.log('Invalid card response:', response.status, response.body);
        expect(response.status).toBe(400);
        expect(response.body.message || response.body.error).toContain('Invalid card number format');
      });
    });

    describe('GET /vault/items - Get Items', () => {
      beforeEach(async () => {
        // Add test items with required fields
        await VaultItem.create({
          vaultId: testVault._id,
          profileId: testProfile._id,
          categoryId: walletCategoryId,
          subcategoryId: myProfileSubcategoryId,
          category: 'Wallet',
          title: 'Card 1',
          type: 'card',
          metadata: {}
        });

        await VaultItem.create({
          vaultId: testVault._id,
          profileId: testProfile._id,
          categoryId: documentsCategoryId,
          subcategoryId: documentsSubcategoryId,
          category: 'Documents',
          title: 'Document 1',
          type: 'document',
          metadata: {}
        });
      });

      it('should get all items', async () => {
        const response = await request(app)
          .get('/vault/items')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ profileId: testProfile._id.toString() });

        console.log('Get items response:', response.status, response.body);
        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Items fetched successfully');
        expect(response.body.items).toBeDefined();
        expect(Array.isArray(response.body.items)).toBe(true);
      });

      it('should filter items by category', async () => {
        const response = await request(app)
          .get('/vault/items')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ 
            profileId: testProfile._id.toString(),
            categoryId: walletCategoryId
          });

        console.log('Filter items response:', response.status, response.body);
        expect(response.status).toBe(200);
        expect(response.body.items).toBeDefined();
      });

      it('should require profileId', async () => {
        const response = await request(app)
          .get('/vault/items')
          .set('Authorization', `Bearer ${authToken}`);

        console.log('Get items no profileId response:', response.status, response.body);
        expect(response.status).toBe(400);
        expect(response.body.message || response.body.error).toContain('Profile ID is required');
      });
    });

    describe('GET /vault/items/:itemId - Get Item by ID', () => {
      let testItemId: string;

      beforeEach(async () => {
        const item = await VaultItem.create({
          vaultId: testVault._id,
          profileId: testProfile._id,
          categoryId: walletCategoryId,
          subcategoryId: myProfileSubcategoryId,
          category: 'Wallet',
          title: 'Test Item',
          type: 'card',
          metadata: {}
        });
        testItemId = item._id.toString();
      });

      it('should get item by ID successfully', async () => {
        const response = await request(app)
          .get(`/vault/items/${testItemId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ profileId: testProfile._id.toString() });

        expect(response.status).toBe(200);
        expect(response.body.item).toBeDefined();
        expect(response.body.item.title).toBe('Test Item');
      });

      it('should return 404 for non-existent item', async () => {
        const nonExistentId = new mongoose.Types.ObjectId();
        
        const response = await request(app)
          .get(`/vault/items/${nonExistentId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ profileId: testProfile._id.toString() });

        expect(response.status).toBe(404);
      });
    });

    describe('PUT /vault/items/:itemId - Update Item', () => {
      let testItemId: string;

      beforeEach(async () => {
        const item = await VaultItem.create({
          vaultId: testVault._id,
          profileId: testProfile._id,
          categoryId: walletCategoryId,
          subcategoryId: myProfileSubcategoryId,
          category: 'Wallet',
          title: 'Original Title',
          type: 'card',
          metadata: {}
        });
        testItemId = item._id.toString();
      });

      it('should update item successfully', async () => {
        const updateData = {
          profileId: testProfile._id.toString(),
          title: 'Updated Title',
          description: 'Updated description'
        };

        const response = await request(app)
          .put(`/vault/items/${testItemId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Item updated successfully');
        expect(response.body.item.title).toBe('Updated Title');

        // Verify version was created
        const versions = await VaultVersion.find({ itemId: testItemId });
        expect(versions).toHaveLength(1);
        expect(versions[0].data.title).toBe('Original Title');
        expect(versions[0].metadata.changedBy).toBe(testProfile._id.toString());
      });

      it('should require profileId', async () => {
        const updateData = {
          title: 'Updated Title'
        };

        const response = await request(app)
          .put(`/vault/items/${testItemId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Profile ID is required');
      });

      it('should handle file updates', async () => {
        const updateData = {
          profileId: testProfile._id.toString(),
          fileData: Buffer.from('test-file-data').toString('base64'),
          type: 'document',
          title: 'Test Document',
          document: {
            type: 'passport',
            number: 'P123456789'
          }
        };

        const response = await request(app)
          .put(`/vault/items/${testItemId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.item.fileUrl).toBeDefined();
        expect(response.body.item.fileSize).toBeDefined();

        // Verify version was created with original state
        const versions = await VaultVersion.find({ itemId: testItemId });
        expect(versions).toHaveLength(1);
        expect(versions[0].data.fileUrl).toBeUndefined();
      });

      it('should handle card image updates', async () => {
        const updateData = {
          profileId: testProfile._id.toString(),
          type: 'card',
          title: 'Test Card',
          card: {
            number: '4111111111111111',
            holderName: 'Test User',
            images: {
              front: { fileData: Buffer.from('test-front-image').toString('base64') },
              back: { fileData: Buffer.from('test-back-image').toString('base64') }
            }
          }
        };

        const response = await request(app)
          .put(`/vault/items/${testItemId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.item.card.images.front.url).toBeDefined();
        expect(response.body.item.card.images.back.url).toBeDefined();

        // Verify version was created with original state
        const versions = await VaultVersion.find({ itemId: testItemId });
        expect(versions).toHaveLength(1);
        expect(versions[0].data.card?.images).toBeUndefined();
      });

      it('should handle document image updates', async () => {
        const updateData = {
          profileId: testProfile._id.toString(),
          type: 'document',
          title: 'Test Document',
          document: {
            type: 'passport',
            number: 'P123456789',
            images: {
              front: { fileData: Buffer.from('test-front-image').toString('base64') },
              back: { fileData: Buffer.from('test-back-image').toString('base64') },
              additional: [
                { fileData: Buffer.from('test-additional-1').toString('base64'), description: 'Additional 1' },
                { fileData: Buffer.from('test-additional-2').toString('base64'), description: 'Additional 2' }
              ]
            }
          }
        };

        const response = await request(app)
          .put(`/vault/items/${testItemId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.item.document.images.front.url).toBeDefined();
        expect(response.body.item.document.images.back.url).toBeDefined();
        expect(response.body.item.document.images.additional).toHaveLength(2);
        expect(response.body.item.document.images.additional[0].url).toBeDefined();
        expect(response.body.item.document.images.additional[1].url).toBeDefined();

        // Verify version was created with original state
        const versions = await VaultVersion.find({ itemId: testItemId });
        expect(versions).toHaveLength(1);
        expect(versions[0].data.document?.images).toBeUndefined();
      });

      it('should handle identification image updates', async () => {
        const updateData = {
          profileId: testProfile._id.toString(),
          type: 'identification',
          title: 'Test ID',
          identification: {
            type: 'passport',
            number: 'P123456789',
            images: {
              front: { fileData: Buffer.from('test-front-image').toString('base64') },
              back: { fileData: Buffer.from('test-back-image').toString('base64') },
              additional: [
                { fileData: Buffer.from('test-additional-1').toString('base64'), description: 'Additional 1' }
              ]
            }
          }
        };

        const response = await request(app)
          .put(`/vault/items/${testItemId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.item.identification.images.front.url).toBeDefined();
        expect(response.body.item.identification.images.back.url).toBeDefined();
        expect(response.body.item.identification.images.additional).toHaveLength(1);
        expect(response.body.item.identification.images.additional[0].url).toBeDefined();

        // Verify version was created with original state
        const versions = await VaultVersion.find({ itemId: testItemId });
        expect(versions).toHaveLength(1);
        expect(versions[0].data.identification?.images).toBeUndefined();
      });
    });

    describe('DELETE /vault/items/:itemId - Delete Item', () => {
      let testItemId: string;

      beforeEach(async () => {
        const item = await VaultItem.create({
          vaultId: testVault._id,
          profileId: testProfile._id,
          categoryId: walletCategoryId,
          subcategoryId: myProfileSubcategoryId,
          category: 'Wallet',
          title: 'Item to Delete',
          type: 'card',
          metadata: {}
        });
        testItemId = item._id.toString();
      });

      it('should delete item successfully', async () => {
        const response = await request(app)
          .delete(`/vault/items/${testItemId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ profileId: testProfile._id.toString() });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Item deleted successfully');

        // Verify item is deleted
        const deletedItem = await VaultItem.findById(testItemId);
        expect(deletedItem).toBeNull();
      });

      it('should require profileId', async () => {
        const response = await request(app)
          .delete(`/vault/items/${testItemId}`)
          .set('Authorization', `Bearer ${authToken}`);

        console.log('Delete item no profileId response:', response.status, response.body);
        expect(response.status).toBe(400);
        expect(response.body.message || response.body.error).toContain('Profile ID is required');
      });
    });

    describe('GET /vault/categories - Get Categories', () => {
      it('should get categories successfully', async () => {
        const response = await request(app)
          .get('/vault/categories')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ profileId: testProfile._id.toString() });

        console.log('Get categories response:', response.status, response.body);
        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Categories fetched successfully');
        expect(response.body.categories).toBeDefined();
        expect(Array.isArray(response.body.categories)).toBe(true);
      });
    });

    describe('POST /vault/categories - Create Category', () => {
      it('should create category successfully', async () => {
        const categoryData = {
          profileId: testProfile._id.toString(),
          name: 'New Category',
          subcategories: ['Sub1', 'Sub2']
        };

        const response = await request(app)
          .post('/vault/categories')
          .set('Authorization', `Bearer ${authToken}`)
          .send(categoryData);

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('Category created successfully');
        expect(response.body.category).toBeDefined();
      });

      it('should require category name', async () => {
        const categoryData = {
          profileId: testProfile._id.toString(),
          subcategories: ['Sub1']
        };

        const response = await request(app)
          .post('/vault/categories')
          .set('Authorization', `Bearer ${authToken}`)
          .send(categoryData);

        console.log('Create category no name response:', response.status, response.body);
        expect(response.status).toBe(400);
        expect(response.body.message || response.body.error).toContain('Category name is required');
      });
    });

    describe('Vault Settings', () => {
      it('should get vault settings', async () => {
        const response = await request(app)
          .get(`/vault/settings/${testProfile._id.toString()}`)
          .set('Authorization', `Bearer ${authToken}`);

        console.log('Get vault settings response:', response.status, response.body);
        expect(response.status).toBe(200);
        expect(response.body.data || response.body.settings).toBeDefined();
      });

      it('should update vault settings', async () => {
        const settingsData = {
          autoBackup: false,
          compressionEnabled: true
        };

        const response = await request(app)
          .put(`/vault/settings/${testProfile._id.toString()}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(settingsData);

        console.log('Update vault settings response:', response.status, response.body);
        expect(response.status).toBe(200);
        expect(response.body.data || response.body.message).toBeDefined();
      });
    });
  });

  describe('Vault Service Tests', () => {
    it('should create user vault', async () => {
      const vault = await vaultService.getUserVault(testProfile._id.toString());
      expect(vault).toBeDefined();
    });

    it('should add item through service', async () => {
      const itemData = {
        title: 'Service Test Item',
        type: 'card',
        description: 'Test description'
      };

      const item = await vaultService.addItem(
        testUser._id.toString(), 
        testProfile._id.toString(), 
        'Wallet', 
        myProfileSubcategoryId, 
        itemData
      );

      expect(item).toBeDefined();
      expect(item.item.title).toBe('Service Test Item');
    });

    it('should get items through service', async () => {
      // Add test item first
      await vaultService.addItem(
        testUser._id.toString(), 
        testProfile._id.toString(), 
        'Wallet', 
        myProfileSubcategoryId, 
        { title: 'Test Item', type: 'card' }
      );

      const result = await vaultService.getItems(testProfile._id.toString(), {});
      expect(result).not.toBeNull();
      expect(result!.items).toBeDefined();
      expect(Array.isArray(result!.items)).toBe(true);
    });

    it('should update item through service', async () => {
      const addResult = await vaultService.addItem(
        testUser._id.toString(), 
        testProfile._id.toString(), 
        'Wallet', 
        myProfileSubcategoryId, 
        { title: 'Original Title', type: 'card' }
      );

      const updatedItem = await vaultService.updateItem(
        testUser._id.toString(), 
        testProfile._id.toString(),
        addResult.item._id.toString(), 
        { title: 'Updated Title' }
      );

      expect(updatedItem).not.toBeNull();
      expect(updatedItem!.title).toBe('Updated Title');

      // Verify version was created
      const versions = await VaultVersion.find({ itemId: addResult.item._id });
      expect(versions).toHaveLength(1);
      expect(versions[0].data.title).toBe('Original Title');
    });

    it('should delete item through service', async () => {
      const addResult = await vaultService.addItem(
        testUser._id.toString(), 
        testProfile._id.toString(), 
        'Wallet', 
        myProfileSubcategoryId, 
        { title: 'Item to Delete', type: 'card' }
      );

      await vaultService.deleteItem(testProfile._id.toString(), addResult.item._id.toString());

      // Verify item is deleted
      const deletedItem = await VaultItem.findById(addResult.item._id);
      expect(deletedItem).toBeNull();
    });

    it('should create categories and subcategories', async () => {
      const categories = await vaultService.createCategory(
        testProfile._id.toString(), 
        'Test Category', 
        ['Sub1', 'Sub2']
      );

      expect(categories).toBeDefined();
      expect(categories.subcategories).toHaveLength(2);
    });
  });

  describe('Vault Model Tests', () => {
    it('should create vault with required fields', async () => {
      const vaultData = {
        userId: testUser._id,
        profileId: testProfile._id,
        storageUsed: 0,
        storageLimit: 104857600
      };

      const vault = new Vault(vaultData);
      await vault.save();

      expect(vault.userId).toEqual(testUser._id);
      expect(vault.profileId).toEqual(testProfile._id);
      expect(vault.storageUsed).toBe(0);
      expect(vault.storageLimit).toBe(104857600);
    });

    it('should validate required fields', async () => {
      const vault = new Vault({});
      await expect(vault.save()).rejects.toThrow();
    });

    it('should create vault items with proper relationships', async () => {
      const item = new VaultItem({
        vaultId: testVault._id,
        profileId: testProfile._id,
        categoryId: walletCategoryId,
        subcategoryId: myProfileSubcategoryId,
        category: 'Wallet',
        title: 'Test Item',
        type: 'card',
        metadata: {}
      });

      await item.save();

      expect(item.vaultId).toEqual(testVault._id);
      expect(item.categoryId.toString()).toBe(walletCategoryId);
      expect(item.subcategoryId.toString()).toBe(myProfileSubcategoryId);
    });

    it('should create categories and subcategories with proper relationships', async () => {
      const category = new VaultCategory({
        vaultId: testVault._id,
        name: 'Test Category',
        order: 0
      });
      await category.save();

      const subcategory = new VaultSubcategory({
        vaultId: testVault._id,
        categoryId: category._id,
        name: 'Test Subcategory',
        order: 0
      });
      await subcategory.save();

      expect(subcategory.categoryId).toEqual(category._id);
      expect(subcategory.vaultId).toEqual(testVault._id);
    });
  });

  describe('Advanced Search and Analytics', () => {
    let testItems: any[];

    beforeEach(async () => {
      // Create test items with various properties
      testItems = await Promise.all([
        VaultItem.create({
          profileId: testProfile._id,
          vaultId: testVault._id,
          categoryId: walletCategoryId,
          subcategoryId: myProfileSubcategoryId,
          category: 'Wallet',
          title: 'Credit Card',
          type: 'card',
          isEncrypted: true,
          isFavorite: true,
          tags: ['finance', 'credit'],
          metadata: { issuer: 'Bank A', expiryDate: '2025-12-31' }
        }),
        VaultItem.create({
          profileId: testProfile._id,
          vaultId: testVault._id,
          categoryId: documentsCategoryId,
          subcategoryId: documentsSubcategoryId,
          category: 'Documents',
          title: 'Passport',
          type: 'document',
          isEncrypted: true,
          isFavorite: false,
          tags: ['travel', 'identity'],
          metadata: { country: 'US', expiryDate: '2026-12-31' }
        })
      ]);
    });

    describe('Advanced Search', () => {
      it('should search by text query', async () => {
        const response = await request(app)
          .post('/vault/search')
          .query({ profileId: testProfile._id.toString() })
          .send({ query: 'credit' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.items).toHaveLength(1);
        expect(response.body.data.items[0].title).toBe('Credit Card');
      });

      it('should filter by category and tags', async () => {
        const response = await request(app)
          .post('/vault/search')
          .query({ profileId: testProfile._id.toString() })
          .send({
            categories: ['Wallet'],
            tags: ['finance']
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.items).toHaveLength(1);
        expect(response.body.data.items[0].category).toBe('Wallet');
      });

      it('should filter by metadata', async () => {
        const response = await request(app)
          .post('/vault/search')
          .query({ profileId: testProfile._id.toString() })
          .send({
            metadata: { issuer: 'Bank A' }
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.items).toHaveLength(1);
        expect(response.body.data.items[0].metadata.issuer).toBe('Bank A');
      });

      it('should sort results', async () => {
        const response = await request(app)
          .post('/vault/search')
          .query({ profileId: testProfile._id.toString() })
          .send({
            sortBy: 'title',
            sortOrder: 'asc'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.items).toHaveLength(2);
        expect(response.body.data.items[0].title).toBe('Credit Card');
      });
    });

    describe('Analytics', () => {
      it('should return vault statistics', async () => {
        const response = await request(app)
          .get(`/vault/analytics/${testProfile._id}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.stats).toBeDefined();
        expect(response.body.data.stats.totalItems).toBe(2);
        expect(response.body.data.stats.encryptedItems).toBe(2);
        expect(response.body.data.stats.favoriteItems).toBe(1);
      });

      it('should return recent activity', async () => {
        const response = await request(app)
          .get(`/vault/analytics/${testProfile._id}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.recentActivity).toBeDefined();
        expect(response.body.data.recentActivity).toHaveLength(2);
      });

      it('should return storage usage by category', async () => {
        const response = await request(app)
          .get(`/vault/analytics/${testProfile._id}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.storageByCategory).toBeDefined();
        expect(response.body.data.storageByCategory).toHaveLength(2);
      });
    });

    describe('Audit Trail', () => {
      it('should track item access', async () => {
        const itemId = testItems[0]._id;
        
        const response = await request(app)
          .get(`/vault/items/${itemId}`)
          .query({ profileId: testProfile._id.toString() });

        expect(response.status).toBe(200);

        // Check audit log
        const auditResponse = await request(app)
          .get(`/vault/items/${itemId}/audit-trail`)
          .query({ profileId: testProfile._id.toString() });

        expect(auditResponse.status).toBe(200);
        expect(auditResponse.body.success).toBe(true);
        expect(auditResponse.body.data.logs).toHaveLength(1);
        expect(auditResponse.body.data.logs[0].action).toBe('view');
      });

      it('should track item updates', async () => {
        const itemId = testItems[0]._id;
        
        const response = await request(app)
          .put(`/vault/items/${itemId}`)
          .query({ profileId: testProfile._id.toString() })
          .send({ 
            profileId: testProfile._id.toString(),
            title: 'Updated Card' 
          });

        expect(response.status).toBe(200);

        // Check audit log
        const auditResponse = await request(app)
          .get(`/vault/items/${itemId}/audit-trail`)
          .query({ profileId: testProfile._id.toString() });

        expect(auditResponse.status).toBe(200);
        expect(auditResponse.body.success).toBe(true);
        expect(auditResponse.body.data.logs).toHaveLength(2);
        expect(auditResponse.body.data.logs[0].action).toBe('update');
      });

      it('should paginate audit trail', async () => {
        const itemId = testItems[0]._id;
        
        // Create multiple audit entries
        for (let i = 0; i < 3; i++) {
          await request(app)
            .get(`/vault/items/${itemId}`)
            .query({ profileId: testProfile._id.toString() });
        }

        const response = await request(app)
          .get(`/vault/items/${itemId}/audit-trail`)
          .query({
            profileId: testProfile._id.toString(),
            limit: 2,
            offset: 0
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.logs).toHaveLength(2);
        expect(response.body.data.hasMore).toBe(true);
      });
    });
  });

  describe('Version Control', () => {
    let testItem: any;

    beforeEach(async () => {
      // Create a test item
      testItem = await VaultItem.create({
        profileId: testProfile._id,
        vaultId: testVault._id,
        categoryId: walletCategoryId,
        subcategoryId: myProfileSubcategoryId,
        category: 'Wallet',
        title: 'Test Item',
        type: 'card',
        isEncrypted: true,
        metadata: { issuer: 'Test Bank', expiryDate: '2025-12-31' }
      });
    });

    it('should create a version when updating an item', async () => {
      const updateData = {
        profileId: testProfile._id.toString(),
        title: 'Updated Title',
        metadata: { issuer: 'New Bank' }
      };

      const response = await request(app)
        .put(`/vault/items/${testItem._id}`)
        .query({ profileId: testProfile._id.toString() })
        .send(updateData);

      expect(response.status).toBe(200);

      // Check version history
      const versionsResponse = await request(app)
        .get(`/vault/items/${testItem._id}/versions`)
        .query({ profileId: testProfile._id.toString() });

      expect(versionsResponse.status).toBe(200);
      expect(versionsResponse.body.success).toBe(true);
      expect(versionsResponse.body.data.versions).toHaveLength(1);
      expect(versionsResponse.body.data.versions[0].data.title).toBe('Test Item');
      expect(versionsResponse.body.data.versions[0].metadata.changedBy).toBe(testProfile._id.toString());
    });

    it('should restore a previous version', async () => {
      // First update the item
      await request(app)
        .put(`/vault/items/${testItem._id}`)
        .query({ profileId: testProfile._id.toString() })
        .send({ 
          profileId: testProfile._id.toString(),
          title: 'Updated Title' 
        });

      // Get the version number
      const versionsResponse = await request(app)
        .get(`/vault/items/${testItem._id}/versions`)
        .query({ profileId: testProfile._id.toString() });

      const versionNumber = versionsResponse.body.data.versions[0].versionNumber;

      // Then restore to that version
      const response = await request(app)
        .post(`/vault/items/${testItem._id}/versions/restore`)
        .query({ profileId: testProfile._id.toString() })
        .send({ version: versionNumber });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Test Item');

      // Verify version history includes the restoration
      const updatedVersionsResponse = await request(app)
        .get(`/vault/items/${testItem._id}/versions`)
        .query({ profileId: testProfile._id.toString() });

      expect(updatedVersionsResponse.body.data.versions).toHaveLength(2);
      expect(updatedVersionsResponse.body.data.versions[0].data.title).toBe('Updated Title');
    });

    it('should paginate version history', async () => {
      // Create multiple versions
      for (let i = 0; i < 3; i++) {
        await request(app)
          .put(`/vault/items/${testItem._id}`)
          .query({ profileId: testProfile._id.toString() })
          .send({ 
            profileId: testProfile._id.toString(),
            title: `Version ${i + 1}` 
          });
      }

      const response = await request(app)
        .get(`/vault/items/${testItem._id}/versions`)
        .query({
          profileId: testProfile._id.toString(),
          limit: 2,
          offset: 0
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.versions).toHaveLength(2);
      expect(response.body.data.hasMore).toBe(true);
    });

    it('should track metadata changes in version history', async () => {
      const updateData = {
        profileId: testProfile._id.toString(),
        metadata: {
          issuer: 'New Bank',
          expiryDate: '2026-12-31',
          customField: 'test value'
        }
      };

      await request(app)
        .put(`/vault/items/${testItem._id}`)
        .query({ profileId: testProfile._id.toString() })
        .send(updateData);

      const versionsResponse = await request(app)
        .get(`/vault/items/${testItem._id}/versions`)
        .query({ profileId: testProfile._id.toString() });

      expect(versionsResponse.status).toBe(200);
      expect(versionsResponse.body.data.versions[0].data.metadata).toEqual({
        issuer: 'Test Bank',
        expiryDate: '2025-12-31'
      });
    });

    it('should handle concurrent version creation', async () => {
      const updatePromises = [
        request(app)
          .put(`/vault/items/${testItem._id}`)
          .query({ profileId: testProfile._id.toString() })
          .send({ 
            profileId: testProfile._id.toString(),
            title: 'Update 1' 
          }),
        request(app)
          .put(`/vault/items/${testItem._id}`)
          .query({ profileId: testProfile._id.toString() })
          .send({ 
            profileId: testProfile._id.toString(),
            title: 'Update 2' 
          })
      ];

      await Promise.all(updatePromises);

      const versionsResponse = await request(app)
        .get(`/vault/items/${testItem._id}/versions`)
        .query({ profileId: testProfile._id.toString() });

      expect(versionsResponse.status).toBe(200);
      expect(versionsResponse.body.data.versions).toHaveLength(2);
    });
  });

  describe('Batch Operations', () => {
    let testItems: any[];

    beforeEach(async () => {
      // Create multiple test items
      testItems = await Promise.all([
        VaultItem.create({
          profileId: testProfile._id,
          vaultId: testVault._id,
          categoryId: walletCategoryId,
          subcategoryId: myProfileSubcategoryId,
          category: 'Wallet',
          title: 'Item 1',
          type: 'card',
          isEncrypted: true
        }),
        VaultItem.create({
          profileId: testProfile._id,
          vaultId: testVault._id,
          categoryId: walletCategoryId,
          subcategoryId: myProfileSubcategoryId,
          category: 'Wallet',
          title: 'Item 2',
          type: 'card',
          isEncrypted: true
        }),
        VaultItem.create({
          profileId: testProfile._id,
          vaultId: testVault._id,
          categoryId: documentsCategoryId,
          subcategoryId: documentsSubcategoryId,
          category: 'Documents',
          title: 'Item 3',
          type: 'document',
          isEncrypted: false
        })
      ]);
    });

    it('should perform batch update', async () => {
      const updates = testItems.map(item => ({
        itemId: item._id.toString(),
        updates: { isFavorite: true }
      }));

      const response = await request(app)
        .post('/vault/batch/update')
        .query({ profileId: testProfile._id.toString() })
        .send({ updates });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.successful).toHaveLength(3);
      expect(response.body.data.failed).toHaveLength(0);

      // Verify updates
      const updatedItems = await VaultItem.find({
        _id: { $in: testItems.map(item => item._id) }
      });
      expect(updatedItems.every(item => item.isFavorite)).toBe(true);
    });

    it('should handle partial batch update failures', async () => {
      const updates = [
        {
          itemId: testItems[0]._id.toString(),
          updates: { isFavorite: true }
        },
        {
          itemId: 'invalid-id',
          updates: { isFavorite: true }
        }
      ];

      const response = await request(app)
        .post('/vault/batch/update')
        .query({ profileId: testProfile._id.toString() })
        .send({ updates });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.successful).toHaveLength(1);
      expect(response.body.data.failed).toHaveLength(1);
    });

    it('should perform batch delete', async () => {
      const itemIds = testItems.slice(0, 2).map(item => item._id.toString());

      const response = await request(app)
        .post('/vault/batch/delete')
        .query({ profileId: testProfile._id.toString() })
        .send({ itemIds });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.successful).toHaveLength(2);
      expect(response.body.data.failed).toHaveLength(0);

      // Verify deletion
      const remainingItems = await VaultItem.find({
        _id: { $in: itemIds }
      });
      expect(remainingItems).toHaveLength(0);
    });

    it('should perform batch move', async () => {
      const items = testItems.slice(0, 2).map(item => ({
        itemId: item._id.toString(),
        categoryId: documentsCategoryId.toString(),
        subcategoryId: documentsSubcategoryId.toString()
      }));

      const response = await request(app)
        .post('/vault/batch/move')
        .query({ profileId: testProfile._id.toString() })
        .send({ items });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.successful).toHaveLength(2);
      expect(response.body.data.failed).toHaveLength(0);

      // Verify moves
      const movedItems = await VaultItem.find({
        _id: { $in: items.map(item => item.itemId) }
      });
      expect(movedItems.every(item => 
        item.categoryId.toString() === documentsCategoryId.toString() &&
        item.subcategoryId.toString() === documentsSubcategoryId.toString()
      )).toBe(true);
    });

    it('should handle validation errors in batch operations', async () => {
      const invalidUpdates = [
        {
          itemId: 'invalid-id',
          updates: { isFavorite: true }
        }
      ];

      const response = await request(app)
        .post('/vault/batch/update')
        .query({ profileId: testProfile._id.toString() })
        .send({ updates: invalidUpdates });

      expect(response.status).toBe(200);
      expect(response.body.data.successful).toHaveLength(0);
      expect(response.body.data.failed).toHaveLength(1);
      expect(response.body.data.failed[0].error).toBeDefined();
    });

    it('should handle batch operations with validation errors', async () => {
      const updates = [
        {
          itemId: testItems[0]._id.toString(),
          updates: { 
            card: { number: 'invalid-card-number' } // Invalid card number format
          }
        },
        {
          itemId: testItems[1]._id.toString(),
          updates: { isFavorite: true }
        }
      ];

      const response = await request(app)
        .post('/vault/batch/update')
        .query({ profileId: testProfile._id.toString() })
        .send({ updates });

      expect(response.status).toBe(200);
      expect(response.body.data.successful).toHaveLength(1);
      expect(response.body.data.failed).toHaveLength(1);
      expect(response.body.data.failed[0].error).toContain('Invalid card number format');
    });
  });

  describe('Nested Subcategory Operations', () => {
    let categoryResult: any;
    let parentSubcategory: any;
    let childSubcategory: any;
    let grandchildSubcategory: any;

    beforeEach(async () => {
      // Create a category with subcategories first
      categoryResult = await vaultService.createCategory(testProfile._id, 'Banking', ['Checking', 'Savings']);
      
      // Create parent subcategory
      const parentResponse = await request(app)
        .post('/vault/subcategories')
        .send({
          subcategoryName: 'Online Banking',
          categoryName: categoryResult.name,
          profileId: testProfile._id
        });
      parentSubcategory = parentResponse.body;

      // Create child subcategory
      const childResponse = await request(app)
        .post('/vault/subcategories')
        .send({
          subcategoryName: 'Child Banking',
          categoryName: categoryResult.name,
          parentId: parentSubcategory._id,
          profileId: testProfile._id
        });
      childSubcategory = childResponse.body;
    });

    describe('Creating Nested Subcategories', () => {
      it('should create a child subcategory under a parent', async () => {
        const response = await request(app)
          .post('/vault/subcategories')
          .send({
            subcategoryName: 'New Child Banking',
            categoryName: categoryResult.name,
            parentId: parentSubcategory._id,
            profileId: testProfile._id
          });

        expect(response.status).toBe(201);
        expect(response.body._id).toBeDefined();
        expect(response.body.parentId.toString()).toBe(parentSubcategory._id.toString());
        expect(response.body.name).toBe('New Child Banking');
      });

      it('should create multiple levels of nesting', async () => {
        // Create grandchild subcategory
        const grandchildResponse = await request(app)
          .post('/vault/subcategories')
          .send({
            subcategoryName: 'Grandchild Banking',
            categoryName: categoryResult.name,
            parentId: childSubcategory._id,
            profileId: testProfile._id
          });

        expect(grandchildResponse.status).toBe(201);
        expect(grandchildResponse.body._id).toBeDefined();
        expect(grandchildResponse.body.parentId.toString()).toBe(childSubcategory._id.toString());
        expect(grandchildResponse.body.name).toBe('Grandchild Banking');
        
        grandchildSubcategory = grandchildResponse.body;
      });

      it('should reject creation with invalid parent ID', async () => {
        const response = await request(app)
          .post('/vault/subcategories')
          .send({
            subcategoryName: 'Invalid Child',
            categoryName: categoryResult.name,
            parentId: new Types.ObjectId().toString(),
            profileId: testProfile._id
          });

        expect(response.status).toBe(500); // Parent subcategory not found error
      });

      it('should reject creation without required fields', async () => {
        const response = await request(app)
          .post('/vault/subcategories')
          .send({
            categoryName: categoryResult.name,
            profileId: testProfile._id
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Subcategory name is required');
      });
    });

    describe('Getting Nested Subcategories', () => {
      it('should get nested subcategories for a parent', async () => {
        const response = await request(app)
          .get(`/vault/subcategories/nested?profileId=${testProfile._id}&subcategoryId=${parentSubcategory._id}`);

        expect(response.status).toBe(200);
        expect(response.body.subcategories).toBeDefined();
        expect(Array.isArray(response.body.subcategories)).toBe(true);
      });

      it('should return hierarchical structure', async () => {
        // Create grandchild for testing hierarchy
        const grandchildResponse = await request(app)
          .post('/vault/subcategories')
          .send({
            subcategoryName: 'Grandchild Banking',
            categoryName: categoryResult.name,
            parentId: childSubcategory._id,
            profileId: testProfile._id
          });
        grandchildSubcategory = grandchildResponse.body;

        const response = await request(app)
          .get(`/vault/subcategories/nested?profileId=${testProfile._id}&subcategoryId=${parentSubcategory._id}`);

        expect(response.status).toBe(200);
        // Should include child subcategories in the hierarchy
        const subcategories = response.body.subcategories;
        expect(subcategories.length).toBeGreaterThan(0);
        
        // Find our created child and check it has the grandchild
        const foundChild = subcategories.find((sub: any) => sub._id.toString() === childSubcategory._id.toString());
        expect(foundChild).toBeDefined();
      });

      it('should handle empty nested subcategories', async () => {
        // Create a subcategory with no children
        const emptyParentResponse = await request(app)
          .post('/vault/subcategories')
          .send({
            subcategoryName: 'Empty Parent',
            categoryName: categoryResult.name,
            profileId: testProfile._id
          });

        const response = await request(app)
          .get(`/vault/subcategories/nested?profileId=${testProfile._id}&subcategoryId=${emptyParentResponse.body._id}`);

        expect(response.status).toBe(200);
        expect(response.body.subcategories).toBeDefined();
        expect(response.body.subcategories).toHaveLength(0);
      });

      it('should require profile ID and subcategory ID', async () => {
        const response = await request(app)
          .get('/vault/subcategories/nested');

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Profile ID and Subcategory ID are required');
      });
    });

    describe('Moving Subcategories', () => {
      beforeEach(async () => {
        // Always create a fresh grandchild for moving tests to avoid test interdependencies
        const grandchildResponse = await request(app)
          .post('/vault/subcategories')
          .send({
            subcategoryName: 'Grandchild Banking',
            categoryName: categoryResult.name,
            parentId: childSubcategory._id,
            profileId: testProfile._id
          });
        grandchildSubcategory = grandchildResponse.body;
      });

      it('should move subcategory to a new parent', async () => {
        // Create a new parent to move to
        const newParentResponse = await request(app)
          .post('/vault/subcategories')
          .send({
            subcategoryName: 'New Parent',
            categoryName: categoryResult.name,
            profileId: testProfile._id
          });

        const response = await request(app)
          .post('/vault/subcategories/move')
          .send({
            subcategoryId: childSubcategory._id,
            newCategoryId: categoryResult._id,
            newParentSubcategoryId: newParentResponse.body._id,
            profileId: testProfile._id
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Subcategory moved successfully');
      });

      it('should move subcategory to root level (no parent)', async () => {
        const response = await request(app)
          .post('/vault/subcategories/move')
          .send({
            subcategoryId: childSubcategory._id,
            newCategoryId: categoryResult._id,
            profileId: testProfile._id
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Subcategory moved successfully');
      });

      it('should reject moving with missing required fields', async () => {
        const response = await request(app)
          .post('/vault/subcategories/move')
          .send({
            subcategoryId: childSubcategory._id,
            profileId: testProfile._id
            // Missing newCategoryId which is required by controller
          });

        expect(response.status).toBe(400); // Controller validation should catch this
        expect(response.body.message).toContain('New Category ID is required');
      });

      it('should prevent circular references', async () => {
        const response = await request(app)
          .post('/vault/subcategories/move')
          .send({
            subcategoryId: parentSubcategory._id,
            newCategoryId: categoryResult._id,
            newParentSubcategoryId: grandchildSubcategory._id,
            profileId: testProfile._id
          });

        expect(response.status).toBe(500); // Service throws Error for circular reference
        expect(response.body.message).toContain('Cannot move subcategory to its own descendant');
      });

      it('should require profile ID and subcategory ID', async () => {
        const response = await request(app)
          .post('/vault/subcategories/move')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Profile ID is required');
      });
    });

    describe('Deleting Nested Subcategories', () => {
      it('should delete subcategory and cascade to children', async () => {
        const response = await request(app)
          .delete('/vault/subcategories')
          .send({
            profileId: testProfile._id,
            subcategoryId: parentSubcategory._id
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Subcategory and its items deleted successfully');

        // The service archives subcategories, so they still exist but are marked as archived
        // Verify child subcategory access returns error due to archival
        const childResponse = await request(app)
          .get(`/vault/subcategories/nested?profileId=${testProfile._id}&subcategoryId=${childSubcategory._id}`);
        // Since it's archived, it should not appear in normal queries or return error
        expect(childResponse.status).toBe(404); // createHttpError(404) returns 404 status
      });

      it('should delete leaf subcategory without affecting siblings', async () => {
        // Create sibling subcategory
        const siblingResponse = await request(app)
          .post('/vault/subcategories')
          .send({
            subcategoryName: 'Sibling Banking',
            categoryName: categoryResult.name,
            parentId: parentSubcategory._id,
            profileId: testProfile._id
          });

        // Create grandchild under sibling to delete
        const grandchildToDeleteResponse = await request(app)
          .post('/vault/subcategories')
          .send({
            subcategoryName: 'Grandchild to delete',
            categoryName: categoryResult.name,
            parentId: siblingResponse.body._id,
            profileId: testProfile._id
          });

        // Delete the grandchild
        const deleteResponse = await request(app)
          .delete('/vault/subcategories')
          .send({
            profileId: testProfile._id,
            subcategoryId: grandchildToDeleteResponse.body._id
          });

        expect(deleteResponse.status).toBe(200);

        // Verify sibling still exists and can be accessed
        const siblingCheckResponse = await request(app)
          .get(`/vault/subcategories/nested?profileId=${testProfile._id}&subcategoryId=${siblingResponse.body._id}`);
        expect(siblingCheckResponse.status).toBe(200);
      });

      it('should require profile ID and subcategory ID', async () => {
        const response = await request(app)
          .delete('/vault/subcategories')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Profile ID is required');
      });

      it('should handle deletion of non-existent subcategory', async () => {
        const response = await request(app)
          .delete('/vault/subcategories')
          .send({
            profileId: testProfile._id,
            subcategoryId: new Types.ObjectId().toString()
          });

        expect(response.status).toBe(404); // createHttpError(404) returns 404 status
        expect(response.body.message).toContain('Subcategory not found');
      });
    });

    describe('Edge Cases and Validation', () => {
      it('should handle deep nesting (10+ levels)', async () => {
        let currentParent = parentSubcategory;
        
        // Create 10 levels of nesting
        for (let i = 0; i < 10; i++) {
          const nestedResponse = await request(app)
            .post('/vault/subcategories')
            .send({
              subcategoryName: `Deep Level ${i + 1}`,
              categoryName: categoryResult.name,
              parentId: currentParent._id,
              profileId: testProfile._id
            });
          
          expect(nestedResponse.status).toBe(201);
          currentParent = nestedResponse.body;
        }

        // Verify we can retrieve the deep structure
        const deepResponse = await request(app)
          .get(`/vault/subcategories/nested?profileId=${testProfile._id}&subcategoryId=${parentSubcategory._id}`);
        
        expect(deepResponse.status).toBe(200);
      });

      it('should handle concurrent operations on nested subcategories', async () => {
        const promises: Promise<request.Response>[] = [];
        
        // Create multiple subcategories concurrently
        for (let i = 0; i < 5; i++) {
          promises.push(
            request(app)
              .post('/vault/subcategories')
              .send({
                subcategoryName: `Concurrent ${i}`,
                categoryName: categoryResult.name,
                parentId: parentSubcategory._id,
                profileId: testProfile._id
              })
          );
        }

        const responses = await Promise.all(promises);
        responses.forEach(response => {
          expect(response.status).toBe(201);
        });
      });

      it('should maintain referential integrity during complex operations', async () => {
        // Create a complex hierarchy
        const level1Response = await request(app)
          .post('/vault/subcategories')
          .send({
            subcategoryName: 'Level 1',
            categoryName: categoryResult.name,
            parentId: parentSubcategory._id,
            profileId: testProfile._id
          });

        const level2Response = await request(app)
          .post('/vault/subcategories')
          .send({
            subcategoryName: 'Level 2',
            categoryName: categoryResult.name,
            parentId: level1Response.body._id,
            profileId: testProfile._id
          });

        // Delete parent and verify cascading
        const deleteResponse = await request(app)
          .delete('/vault/subcategories')
          .send({
            profileId: testProfile._id,
            subcategoryId: level1Response.body._id
          });

        expect(deleteResponse.status).toBe(200);

        // Verify level 2 is also deleted (archived in service implementation)
        const checkResponse = await request(app)
          .get(`/vault/subcategories/nested?profileId=${testProfile._id}&subcategoryId=${level2Response.body._id}`);
        expect(checkResponse.status).toBe(404); // createHttpError(404) returns 404 status
      });
    });
  });
}); 