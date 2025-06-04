import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import express from 'express';
import { Vault, VaultCategory, VaultSubcategory, VaultItem } from '../../models/Vault';
import { User } from '../../models/User';
import { ProfileModel } from '../../models/profile.model';
import jwt from 'jsonwebtoken';

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
    delete: jest.fn().mockResolvedValue({ result: 'ok' })
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
    app.get('/vault/items/:itemId', vaultController.getItemById);
    app.put('/vault/items/:itemId', vaultController.updateItem);
    app.delete('/vault/items/:itemId', vaultController.deleteItem);
    app.get('/vault/categories', vaultController.getCategories);
    app.post('/vault/categories', vaultController.createCategory);
    app.post('/vault/subcategories', vaultController.createSubcategory);
    // Fix the vault settings routes - use params instead of query
    app.get('/vault/settings/:profileId', vaultController.getVaultSettings);
    app.put('/vault/settings/:profileId', vaultController.updateVaultSettings);

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
      });

      it('should require profileId', async () => {
        const updateData = {
          title: 'Updated Title'
        };

        const response = await request(app)
          .put(`/vault/items/${testItemId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData);

        console.log('Update item no profileId response:', response.status, response.body);
        expect(response.status).toBe(400);
        expect(response.body.message || response.body.error).toContain('Profile ID is required');
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
      expect(item.title).toBe('Service Test Item');
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
      const item = await vaultService.addItem(
        testUser._id.toString(), 
        testProfile._id.toString(), 
        'Wallet', 
        myProfileSubcategoryId, 
        { title: 'Original Title', type: 'card' }
      );

      const updatedItem = await vaultService.updateItem(
        testUser._id.toString(), 
        item._id.toString(), 
        { title: 'Updated Title' }
      );

      expect(updatedItem).not.toBeNull();
      expect(updatedItem!.title).toBe('Updated Title');
    });

    it('should delete item through service', async () => {
      const item = await vaultService.addItem(
        testUser._id.toString(), 
        testProfile._id.toString(), 
        'Wallet', 
        myProfileSubcategoryId, 
        { title: 'Item to Delete', type: 'card' }
      );

      await vaultService.deleteItem(testProfile._id.toString(), item._id.toString());

      // Verify item is deleted
      const deletedItem = await VaultItem.findById(item._id);
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
}); 