import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { List, IList, ListType, ImportanceLevel } from '../../models/List';
import { User, IUser } from '../../models/User';
import { ProfileModel, ProfileDocument } from '../../models/profile.model';
import { Task, ITask } from '../../models/Tasks';
import { Event, IEvent } from '../../models/Event';
import jwt from 'jsonwebtoken';
import * as listController from '../../controllers/list.controller';
import listRoutes from '../../routes/list.routes';

// Mock the social interaction system
jest.mock('../../utils/socketEmitter', () => ({
  emitSocialInteraction: jest.fn().mockResolvedValue(undefined)
}));

// Mock the auth middleware for tests
const mockAuthMiddleware = (req: any, res: any, next: any) => {
  req.user = {
    _id: new mongoose.Types.ObjectId(),
    email: 'test@example.com',
    fullName: 'Test User'
  };
  next();
};

// Mock the auth middleware module
jest.mock('../../middleware/authMiddleware', () => ({
  authenticateToken: mockAuthMiddleware
}));

const app = express();
app.use(express.json());
// Add the auth middleware before the routes
app.use('/api/lists', mockAuthMiddleware, listRoutes);

describe('List Tests', () => {
  let mongoServer: MongoMemoryServer;
  let testUser: IUser;
  let testProfile: ProfileDocument;
  let testTask: ITask;
  let testEvent: IEvent;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create test user
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword',
      fullName: 'Test User',
      dateOfBirth: new Date('1990-01-01'),
      countryOfResidence: 'US',
      phoneNumber: '+1234567890',
      accountType: 'MYSELF',
      accountCategory: 'PRIMARY_ACCOUNT',
      verificationMethod: 'EMAIL',
      isEmailVerified: true,
      isPhoneVerified: false,
      registrationStep: 'VERIFICATION'
    });

    // Create test profile
    testProfile = await ProfileModel.create({
      profileCategory: 'individual',
      profileType: 'personal',
      ProfileFormat: {
        updatedAt: new Date()
      },
      profileInformation: {
        username: 'testuser',
        profileLink: 'test-profile',
        creator: testUser._id,
        connectLink: 'connect-test',
        followLink: 'follow-test',
        followers: [],
        following: [],
        connectedProfiles: [],
        affiliatedProfiles: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      ProfileQrCode: {},
      templatedId: new mongoose.Types.ObjectId(),
      sections: [],
      specificSettings: {}
    });

    // Create test task for list integration
    testTask = await Task.create({
      title: 'Test Task',
      description: 'Test task description',
      createdBy: testUser._id,
      profile: testProfile._id,
      subTasks: [
        { description: 'Subtask 1', isCompleted: false },
        { description: 'Subtask 2', isCompleted: true }
      ]
    });

    // Create test event for list integration
    testEvent = await Event.create({
      title: 'Test Event',
      description: 'Test event description',
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000), // 1 hour later
      createdBy: testUser._id,
      profile: testProfile._id,
      agendaItems: [
        { description: 'Agenda item 1', completed: false },
        { description: 'Agenda item 2', completed: true }
      ]
    });

    // Mock the auth middleware to use our test user
    app.use((req: any, res: any, next: any) => {
      req.user = testUser;
      next();
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clean up lists before each test
    await List.deleteMany({});
  });

  describe('List Model', () => {
    it('should create a basic list', async () => {
      const listData = {
        name: 'Shopping List',
        type: ListType.Shopping,
        importance: ImportanceLevel.Medium,
        createdBy: testUser._id,
        profile: testProfile._id,
        color: '#FF5733',
        items: []
      };

      const list = await List.create(listData);
      expect(list.name).toBe('Shopping List');
      expect(list.type).toBe(ListType.Shopping);
      expect(list.importance).toBe(ImportanceLevel.Medium);
    });

    it('should create a list with items', async () => {
      const listData = {
        name: 'Todo List',
        type: ListType.Todo,
        importance: ImportanceLevel.High,
        createdBy: testUser._id,
        profile: testProfile._id,
        items: [
          {
            _id: new mongoose.Types.ObjectId(),
            name: 'Complete project',
            isCompleted: false,
            createdAt: new Date()
          },
          {
            _id: new mongoose.Types.ObjectId(),
            name: 'Review code',
            isCompleted: true,
            createdAt: new Date(),
            completedAt: new Date()
          }
        ]
      };

      const list = await List.create(listData);
      expect(list.items).toHaveLength(2);
      expect(list.items[0].name).toBe('Complete project');
      expect(list.items[1].isCompleted).toBe(true);
    });

    it('should create list items with sub-items (subtasks)', async () => {
      const listData = {
        name: 'Project List',
        type: ListType.Todo,
        importance: ImportanceLevel.High,
        createdBy: testUser._id,
        profile: testProfile._id,
        items: [
          {
            _id: new mongoose.Types.ObjectId(),
            name: 'Plan project',
            isCompleted: false,
            createdAt: new Date(),
            subTasks: [
              {
                _id: new mongoose.Types.ObjectId(),
                name: 'Research requirements',
                isCompleted: true,
                createdAt: new Date(),
                completedAt: new Date()
              },
              {
                _id: new mongoose.Types.ObjectId(),
                name: 'Create timeline',
                isCompleted: false,
                createdAt: new Date()
              }
            ]
          }
        ]
      };

      const list = await List.create(listData);
      expect(list.items[0].subTasks).toHaveLength(2);
      expect(list.items[0].subTasks![0].name).toBe('Research requirements');
      expect(list.items[0].subTasks![0].isCompleted).toBe(true);
      expect(list.items[0].subTasks![1].isCompleted).toBe(false);
    });

    it('should calculate completion percentage correctly', async () => {
      const listData = {
        name: 'Progress List',
        type: ListType.Todo,
        createdBy: testUser._id,
        profile: testProfile._id,
        items: [
          {
            _id: new mongoose.Types.ObjectId(),
            name: 'Task 1',
            isCompleted: true,
            createdAt: new Date()
          },
          {
            _id: new mongoose.Types.ObjectId(),
            name: 'Task 2',
            isCompleted: true,
            createdAt: new Date()
          },
          {
            _id: new mongoose.Types.ObjectId(),
            name: 'Task 3',
            isCompleted: false,
            createdAt: new Date()
          },
          {
            _id: new mongoose.Types.ObjectId(),
            name: 'Task 4',
            isCompleted: false,
            createdAt: new Date()
          }
        ]
      };

      const list = await List.create(listData);
      expect((list as any).completionPercentage).toBe(50); // 2 out of 4 completed
    });

    it('should relate list to a task', async () => {
      const listData = {
        name: 'Task-related List',
        type: ListType.Todo,
        createdBy: testUser._id,
        profile: testProfile._id,
        relatedTask: testTask._id,
        items: []
      };

      const list = await List.create(listData);
      await list.populate('relatedTask');
      
      expect(list.relatedTask).toBeDefined();
      expect((list.relatedTask as any).title).toBe('Test Task');
    });
  });

  describe('List Controller', () => {
    describe('POST /api/lists', () => {
      it('should create a new list', async () => {
        const listData = {
          name: 'New Shopping List',
          type: ListType.Shopping,
          importance: ImportanceLevel.Low,
          profileId: testProfile._id.toString(),
          color: '#00FF00'
        };

        const response = await request(app)
          .post('/api/lists')
          .send(listData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('New Shopping List');
        expect(response.body.data.type).toBe(ListType.Shopping);
      });

      it('should fail to create list without required fields', async () => {
        const response = await request(app)
          .post('/api/lists')
          .send({})
          .expect(500);

        expect(response.body.error || response.body.message).toBeDefined();
      });
    });

    describe('GET /api/lists', () => {
      beforeEach(async () => {
        // Create test lists
        await List.create([
          {
            name: 'Shopping List',
            type: ListType.Shopping,
            importance: ImportanceLevel.Medium,
            createdBy: testUser._id,
            profile: testProfile._id
          },
          {
            name: 'Todo List',
            type: ListType.Todo,
            importance: ImportanceLevel.High,
            createdBy: testUser._id,
            profile: testProfile._id
          }
        ]);
      });

      it('should get all lists for a profile', async () => {
        const response = await request(app)
          .get('/api/lists')
          .query({ profileId: testProfile._id.toString() })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
      });

      it('should filter lists by type', async () => {
        const response = await request(app)
          .get('/api/lists')
          .query({ 
            profileId: testProfile._id.toString(),
            type: ListType.Shopping
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].type).toBe(ListType.Shopping);
      });
    });

    describe('PUT /api/lists/:id', () => {
      let testList: IList;

      beforeEach(async () => {
        testList = await List.create({
          name: 'Original List',
          type: ListType.Todo,
          createdBy: testUser._id,
          profile: testProfile._id
        });
      });

      it('should update a list', async () => {
        const updateData = {
          name: 'Updated List',
          importance: ImportanceLevel.High,
          profileId: testProfile._id.toString()
        };

        const response = await request(app)
          .put(`/api/lists/${testList._id}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('Updated List');
        expect(response.body.data.importance).toBe(ImportanceLevel.High);
      });
    });

    describe('List Items Management', () => {
      let testList: IList;

      beforeEach(async () => {
        testList = await List.create({
          name: 'Test List',
          type: ListType.Todo,
          createdBy: testUser._id,
          profile: testProfile._id,
          items: []
        });
      });

      describe('POST /api/lists/:id/items', () => {
        it('should add an item to the list', async () => {
          const itemData = {
            name: 'New list item',
            profileId: testProfile._id.toString(),
            profile: testProfile._id.toString(),
            category: 'Work',
            notes: 'Important task'
          };

          const response = await request(app)
            .post(`/api/lists/${testList._id}/items`)
            .send(itemData)
            .expect(200);

          expect(response.body.success).toBe(true);
          expect(response.body.data.items).toHaveLength(1);
          expect(response.body.data.items[0].name).toBe('New list item');
        });

        it('should add an item with sub-items', async () => {
          const itemData = {
            name: 'Complex task',
            profileId: testProfile._id.toString(),
            profile: testProfile._id.toString(),
            subTasks: [
              {
                _id: new mongoose.Types.ObjectId(),
                name: 'Subtask 1',
                isCompleted: false,
                createdAt: new Date()
              },
              {
                _id: new mongoose.Types.ObjectId(),
                name: 'Subtask 2',
                isCompleted: true,
                createdAt: new Date(),
                completedAt: new Date()
              }
            ]
          };

          const response = await request(app)
            .post(`/api/lists/${testList._id}/items`)
            .send(itemData)
            .expect(200);

          expect(response.body.success).toBe(true);
          expect(response.body.data.items[0].subTasks).toHaveLength(2);
          expect(response.body.data.items[0].subTasks[0].name).toBe('Subtask 1');
          expect(response.body.data.items[0].subTasks[1].isCompleted).toBe(true);
        });
      });

      describe('PUT /api/lists/:id/items/:itemId', () => {
        let listWithItem: IList;

        beforeEach(async () => {
          const itemId = new mongoose.Types.ObjectId();
          listWithItem = await List.create({
            name: 'Test List',
            type: ListType.Todo,
            createdBy: testUser._id,
            profile: testProfile._id,
            items: [{
              _id: itemId,
              name: 'Original item',
              isCompleted: false,
              createdAt: new Date()
            }]
          });
        });

        it('should update a list item', async () => {
          const itemId = listWithItem.items[0]._id;
          const updateData = {
            name: 'Updated item',
            isCompleted: true,
            profileId: testProfile._id.toString(),
            notes: 'Completed successfully'
          };

          const response = await request(app)
            .put(`/api/lists/${listWithItem._id}/items/${itemId}`)
            .send(updateData)
            .expect(200);

          expect(response.body.success).toBe(true);
          expect(response.body.data.items[0].name).toBe('Updated item');
          expect(response.body.data.items[0].isCompleted).toBe(true);
        });
      });

      describe('POST /api/lists/:id/items/:itemId/subtasks', () => {
        let listWithItem: IList;

        beforeEach(async () => {
          const itemId = new mongoose.Types.ObjectId();
          listWithItem = await List.create({
            name: 'Test List',
            type: ListType.Todo,
            createdBy: testUser._id,
            profile: testProfile._id,
            items: [{
              _id: itemId,
              name: 'Parent item',
              isCompleted: false,
              createdAt: new Date(),
              subTasks: []
            }]
          });
        });

        it('should add a subtask to a list item', async () => {
          const itemId = listWithItem.items[0]._id;
          const subtaskData = {
            subTask: { name: 'New subtask' },
            profileId: testProfile._id.toString()
          };

          const response = await request(app)
            .patch(`/api/lists/${listWithItem._id}/items/${itemId}/subtasks`)
            .send(subtaskData)
            .expect(200);

          expect(response.body.success).toBe(true);
          expect(response.body.data.items[0].subTasks).toHaveLength(1);
          expect(response.body.data.items[0].subTasks[0].name).toBe('New subtask');
        });
      });
    });

    describe('List Integration with Events and Tasks', () => {
      it('should create list items from event agenda items', async () => {
        const listData = {
          name: 'Event Agenda List',
          type: ListType.Todo,
          profileId: testProfile._id.toString(),
          items: testEvent.agendaItems.map(item => ({
            _id: new mongoose.Types.ObjectId(),
            name: item.description,
            isCompleted: item.completed,
            createdAt: new Date(),
            category: 'Event Planning'
          }))
        };

        const response = await request(app)
          .post('/api/lists')
          .send(listData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.items).toHaveLength(2);
        expect(response.body.data.items[0].name).toBe('Agenda item 1');
        expect(response.body.data.items[1].isCompleted).toBe(true);
      });

      it('should create list items from task subtasks', async () => {
        const listData = {
          name: 'Task Breakdown List',
          type: ListType.Todo,
          profileId: testProfile._id.toString(),
          relatedTask: (testTask._id as mongoose.Types.ObjectId).toString(),
          items: testTask.subTasks.map(subtask => ({
            _id: new mongoose.Types.ObjectId(),
            name: subtask.description || 'Unnamed subtask',
            isCompleted: subtask.isCompleted,
            createdAt: new Date(),
            completedAt: subtask.completedAt,
            category: 'Task Management'
          }))
        };

        const response = await request(app)
          .post('/api/lists')
          .send(listData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.items).toHaveLength(2);
        expect(response.body.data.relatedTask).toBe((testTask._id as mongoose.Types.ObjectId).toString());
        expect(response.body.data.items[1].isCompleted).toBe(true);
      });
    });

    describe('List Comments and Likes', () => {
      let testList: IList;

      beforeEach(async () => {
        testList = await List.create({
          name: 'Social List',
          type: ListType.Todo,
          createdBy: testUser._id,
          profile: testProfile._id,
          comments: [],
          likes: []
        });
      });

      describe('POST /api/lists/:id/comments', () => {
        it('should add a comment to the list', async () => {
          const commentData = {
            text: 'Great list!',
            profileId: testProfile._id.toString()
          };

          const response = await request(app)
            .post(`/api/lists/${testList._id}/comments`)
            .send(commentData)
            .expect(200);

          expect(response.body.success).toBe(true);
          expect(response.body.data.comments).toHaveLength(1);
          expect(response.body.data.comments[0].text).toBe('Great list!');
        });
      });

      describe('POST /api/lists/:id/like', () => {
        it('should like a list', async () => {
          const response = await request(app)
            .post(`/api/lists/${testList._id}/like`)
            .send({ profileId: testProfile._id.toString() })
            .expect(200);

          expect(response.body.success).toBe(true);
          expect(response.body.data.likes).toHaveLength(1);
        });
      });

      describe('DELETE /api/lists/:id/like', () => {
        beforeEach(async () => {
          // Add a like first
          await List.findByIdAndUpdate(testList._id, {
            $push: { likes: { profile: testProfile._id, createdAt: new Date() } }
          });
        });

        it('should unlike a list', async () => {
          const response = await request(app)
            .delete(`/api/lists/${testList._id}/like`)
            .send({ profileId: testProfile._id.toString() })
            .expect(200);

          expect(response.body.success).toBe(true);
          expect(response.body.data.likes).toHaveLength(0);
        });
      });
    });

    describe('Advanced List Operations', () => {
      let testList: IList;

      beforeEach(async () => {
        testList = await List.create({
          name: 'Advanced List',
          type: ListType.Todo,
          createdBy: testUser._id,
          profile: testProfile._id,
          items: [
            {
              _id: new mongoose.Types.ObjectId(),
              name: 'Task 1',
              isCompleted: false,
              createdAt: new Date()
            },
            {
              _id: new mongoose.Types.ObjectId(),
              name: 'Task 2',
              isCompleted: false,
              createdAt: new Date()
            }
          ]
        });
      });

      describe('POST /api/lists/:id/check-all', () => {
        it('should mark all items as completed', async () => {
          const response = await request(app)
            .patch(`/api/lists/${testList._id}/check-all`)
            .send({ profileId: testProfile._id.toString() })
            .expect(200);

          expect(response.body.success).toBe(true);
          expect(response.body.data.items.every((item: any) => item.isCompleted)).toBe(true);
        });
      });

      describe('POST /api/lists/:id/uncheck-all', () => {
        beforeEach(async () => {
          // Mark all items as completed first
          await List.findByIdAndUpdate(testList._id, {
            $set: { 'items.$[].isCompleted': true }
          });
        });

        it('should mark all items as incomplete', async () => {
          const response = await request(app)
            .patch(`/api/lists/${testList._id}/uncheck-all`)
            .send({ profileId: testProfile._id.toString() })
            .expect(200);

          expect(response.body.success).toBe(true);
          expect(response.body.data.items.every((item: any) => !item.isCompleted)).toBe(true);
        });
      });

      describe('POST /api/lists/:id/duplicate', () => {
        it('should duplicate a list', async () => {
          const response = await request(app)
            .post(`/api/lists/${testList._id}/duplicate`)
            .send({ profileId: testProfile._id.toString() })
            .expect(200);

          expect(response.body.success).toBe(true);
          expect(response.body.data.name).toBe('Advanced List (Copy)');
          expect(response.body.data.items).toHaveLength(2);
        });
      });
    });
  });

  describe('Shareable Link Functionality', () => {
    let testList: IList;

    beforeEach(async () => {
      testList = await List.create({
        name: 'Test List',
        type: ListType.Todo,
        importance: ImportanceLevel.Medium,
        createdBy: testUser._id,
        profile: testProfile._id,
        items: []
      });
    });

    it('should generate a shareable link with view access', async () => {
      const response = await request(app)
        .post(`/api/lists/${testList._id}/shareable-link`)
        .send({
          profileId: testProfile._id,
          access: 'view'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.shareableLink).toBeDefined();
      expect(response.body.data.linkAccess).toBe('view');
    });

    it('should generate a shareable link with edit access', async () => {
      const response = await request(app)
        .post(`/api/lists/${testList._id}/shareable-link`)
        .send({
          profileId: testProfile._id,
          access: 'edit'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.shareableLink).toBeDefined();
      expect(response.body.data.linkAccess).toBe('edit');
    });

    it('should disable a shareable link', async () => {
      // First generate a link
      await request(app)
        .post(`/api/lists/${testList._id}/shareable-link`)
        .send({
          profileId: testProfile._id,
          access: 'view'
        });

      // Then disable it
      const response = await request(app)
        .delete(`/api/lists/${testList._id}/shareable-link`)
        .send({
          profileId: testProfile._id
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.shareableLink).toBe('');
      expect(response.body.data.linkAccess).toBe('none');
    });

    it('should get a list by shareable link', async () => {
      // First generate a link
      const generateResponse = await request(app)
        .post(`/api/lists/${testList._id}/shareable-link`)
        .send({
          profileId: testProfile._id,
          access: 'view'
        });

      const shareableLink = generateResponse.body.data.shareableLink;

      // Then get the list using the link
      const response = await request(app)
        .get(`/api/lists/shared/${shareableLink}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data._id.toString()).toBe((testList._id as mongoose.Types.ObjectId).toString());
    });

    it('should return 404 for invalid shareable link', async () => {
      const response = await request(app)
        .get('/api/lists/shareable/invalid-link');

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid access type', async () => {
      const response = await request(app)
        .post(`/api/lists/${testList._id}/shareable-link`)
        .send({
          profileId: testProfile._id,
          access: 'invalid'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid list ID', async () => {
      const response = await request(app)
        .get('/api/lists/invalid-id')
        .expect(400);

      expect(response.body.error).toContain('Invalid list ID');
    });

    it('should handle non-existent list', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/lists/${nonExistentId}`)
        .expect(404);

      expect(response.body.error).toContain('not found');
    });

    it('should handle missing profile ID', async () => {
      const response = await request(app)
        .post('/api/lists')
        .send({ name: 'Test List' })
        .expect(400);

      expect(response.body.error).toContain('Profile ID is required');
    });
  });
}); 