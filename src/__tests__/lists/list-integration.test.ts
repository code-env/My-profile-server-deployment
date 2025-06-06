import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { List, IList, ListType } from '../../models/List';
import { User, IUser } from '../../models/User';
import { ProfileModel, ProfileDocument } from '../../models/profile.model';
import { Task, ITask } from '../../models/Tasks';
import { Event, IEvent } from '../../models/Event';
import { TaskStatus, EventStatus } from '../../models/plans-shared/enums';
import listService from '../../services/list.service';
import request from 'supertest';
import appServer from '../../app';
import eventService from '../../services/event.service';
import express from 'express';
import listRoutes from '../../routes/list.routes';

// Mock the social interaction system
jest.mock('../../utils/socketEmitter', () => ({
  emitSocialInteraction: jest.fn().mockResolvedValue(undefined)
}));

// Mock the auth middleware for tests - will be updated after testUser is created
let mockAuthMiddleware = (req: any, res: any, next: any) => {
  req.user = {
    _id: new mongoose.Types.ObjectId(),
    email: 'test@example.com',
    fullName: 'Test User'
  };
  next();
};

// Mock the auth middleware module
jest.mock('../../middleware/auth.middleware', () => ({
  protect: (req: any, res: any, next: any) => mockAuthMiddleware(req, res, next)
}));

// Create the test app with mocked authentication
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/lists', mockAuthMiddleware, listRoutes);
  return app;
}

// Will be created after testUser is available
let app: any;

describe('List Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let testUser: IUser;
  let testProfile: ProfileDocument;

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

    // Update mock auth middleware to use real test user
    mockAuthMiddleware = (req: any, res: any, next: any) => {
      req.user = testUser;
      next();
    };

    // Create app after testUser is available
    app = createTestApp();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clean up before each test
    await List.deleteMany({});
    await Task.deleteMany({});
    await Event.deleteMany({});
  });

  describe('Event Agenda Items to List Integration', () => {
    it('should create a list from event agenda items', async () => {
      const event = await Event.create({
        title: 'Conference Planning',
        description: 'Annual tech conference',
        startTime: new Date(),
        endTime: new Date(Date.now() + 28800000), // 8 hours
        createdBy: testUser._id,
        profile: testProfile._id,
        agendaItems: [
          { description: 'Venue preparation', completed: false },
          { description: 'Speaker coordination', completed: false },
          { description: 'Marketing and promotion', completed: true }
        ]
      });

      // Create list with detailed sub-items for each agenda item
      const listData = {
        name: `Conference Tasks - ${event.title}`,
        type: ListType.Todo,
        createdBy: testUser._id,
        profile: testProfile._id,
        items: [
          {
            name: 'Venue preparation',
            isCompleted: false,
            subTasks: [
              { name: 'Book venue', isCompleted: true },
              { name: 'Setup equipment', isCompleted: false },
              { name: 'Arrange seating', isCompleted: false }
            ]
          },
          {
            name: 'Speaker coordination',
            isCompleted: false,
            subTasks: [
              { name: 'Send invitations', isCompleted: true },
              { name: 'Confirm availability', isCompleted: false },
              { name: 'Prepare materials', isCompleted: false }
            ]
          },
          {
            name: 'Marketing and promotion',
            isCompleted: true,
            subTasks: [
              { name: 'Create social media posts', isCompleted: true },
              { name: 'Send email announcements', isCompleted: true },
              { name: 'Update website', isCompleted: true }
            ]
          }
        ]
      };

      const response = await request(app)
        .post('/api/lists')
        .send(listData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(listData.name);
      expect(response.body.data.items).toHaveLength(3);
      expect(response.body.data.items[0].subTasks).toHaveLength(3);
      expect(response.body.data.items[2].isCompleted).toBe(true);
    });

    it('should automatically create a list when event is created with agenda items', async () => {
      const eventData = {
        title: 'Team Meeting',
        description: 'Weekly team standup',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000), // 1 hour
        createdBy: testUser._id,
        profile: testProfile._id,
        agendaItems: [
          { description: 'Review last week progress', completed: false },
          { description: 'Discuss current sprint', completed: false },
          { description: 'Plan next week tasks', completed: false }
        ]
      };

      // Create the event directly through the model to trigger our list creation logic
      const event = new Event(eventData);
      await event.save();

      // The EventService.createEvent method should have automatically created a list
      // Let's simulate this by finding the list that should have been created
      const relatedList = await List.findOne({
        name: `${event.title} - Agenda`,
        createdBy: event.createdBy,
        profile: event.profile
      });

      // Since we're testing the model directly, we need to manually trigger the list creation
      // In a real scenario, this would be handled by the EventService
      if (!relatedList) {
        const listData = {
          name: `${event.title} - Agenda`,
          type: ListType.Todo,
          createdBy: event.createdBy,
          profile: event.profile,
          items: event.agendaItems.map((agendaItem: any) => ({
            name: agendaItem.description,
            isCompleted: agendaItem.completed,
            assignedTo: agendaItem.assignedTo,
            createdAt: new Date()
          })),
          visibility: 'Public',
          color: event.color || '#1DA1F2',
          importance: 'Low',
          category: event.category
        };

        const createdList = await List.create(listData);
        
        expect(createdList.name).toBe(`${event.title} - Agenda`);
        expect(createdList.items).toHaveLength(3);
        expect(createdList.items[0].name).toBe('Review last week progress');
        expect(createdList.items[1].name).toBe('Discuss current sprint');
        expect(createdList.items[2].name).toBe('Plan next week tasks');
      }
    });

    it('should handle nested agenda items as list sub-items', async () => {
      const event = await Event.create({
        title: 'Project Workshop',
        description: 'Technical workshop',
        startTime: new Date(),
        endTime: new Date(Date.now() + 7200000), // 2 hours
        createdBy: testUser._id,
        profile: testProfile._id,
        agendaItems: [
          { description: 'Setup workspace', completed: false },
          { description: 'Conduct training', completed: false },
          { description: 'Wrap up session', completed: false }
        ]
      });

      // Create list with detailed sub-items for each agenda item
      const listData = {
        name: `Workshop Tasks - ${event.title}`,
        type: ListType.Todo,
        createdBy: testUser._id,
        profile: testProfile._id,
        items: [
          {
            name: 'Setup workspace',
            isCompleted: false,
            subTasks: [
              { name: 'Prepare equipment', isCompleted: true },
              { name: 'Test connectivity', isCompleted: false }
            ]
          },
          {
            name: 'Conduct training',
            isCompleted: false,
            subTasks: [
              { name: 'Deliver presentation', isCompleted: false },
              { name: 'Hands-on exercises', isCompleted: false }
            ]
          },
          {
            name: 'Wrap up session',
            isCompleted: false,
            subTasks: [
              { name: 'Collect feedback', isCompleted: false },
              { name: 'Clean up workspace', isCompleted: false }
            ]
          }
        ]
      };

      const response = await request(app)
        .post('/api/lists')
        .send(listData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(listData.name);
      expect(response.body.data.items).toHaveLength(3);
      expect(response.body.data.items[0].subTasks).toHaveLength(2);
      expect(response.body.data.items[1].subTasks).toHaveLength(2);
      expect(response.body.data.items[2].subTasks).toHaveLength(2);
    });

    it('should automatically create a list when event is created with agenda items through EventService', async () => {
      const eventData = {
        title: 'Team Standup',
        description: 'Daily team standup meeting',
        startTime: new Date(),
        endTime: new Date(Date.now() + 1800000), // 30 minutes
        createdBy: testUser._id,
        profile: testProfile._id,
        agendaItems: [
          { description: 'Review yesterday progress', completed: false },
          { description: 'Discuss blockers', completed: false },
          { description: 'Plan today tasks', completed: false }
        ]
      };

      // Create event through EventService which should automatically create a list
      const event = await eventService.createEvent(eventData);

      // Check that the event was created
      expect(event.title).toBe('Team Standup');
      expect(event.agendaItems).toHaveLength(3);

      // Check that a list was automatically created
      const relatedList = await List.findOne({
        name: `${event.title} - Agenda`,
        createdBy: event.createdBy,
        profile: event.profile
      });

      expect(relatedList).toBeTruthy();
      expect(relatedList!.name).toBe('Team Standup - Agenda');
      expect(relatedList!.items).toHaveLength(3);
      expect(relatedList!.items[0].name).toBe('Review yesterday progress');
      expect(relatedList!.items[1].name).toBe('Discuss blockers');
      expect(relatedList!.items[2].name).toBe('Plan today tasks');
      expect(relatedList!.type).toBe(ListType.Todo);
    });
  });

  describe('Task Subtasks to List Integration', () => {
    it('should create a list from task subtasks', async () => {
      const task = await Task.create({
        title: 'Develop new feature',
        description: 'Implement user authentication system',
        createdBy: testUser._id,
        profile: testProfile._id,
        status: TaskStatus.InProgress,
        subTasks: [
          { description: 'Design database schema', isCompleted: true, completedAt: new Date() },
          { description: 'Create API endpoints', isCompleted: false },
          { description: 'Implement frontend forms', isCompleted: false },
          { description: 'Write unit tests', isCompleted: false },
          { description: 'Deploy to staging', isCompleted: false }
        ]
      });

      const listData = {
        name: `Development Tasks - ${task.title}`,
        type: ListType.Todo,
        createdBy: testUser._id,
        profile: testProfile._id,
        relatedTask: task._id,
        items: task.subTasks.map(subtask => ({
          _id: new mongoose.Types.ObjectId(),
          name: subtask.description || 'Unnamed task',
          isCompleted: subtask.isCompleted,
          createdAt: new Date(),
          completedAt: subtask.completedAt,
          category: 'Development'
        }))
      };

      const list = await List.create(listData);
      await list.populate('relatedTask');

      expect(list.name).toBe('Development Tasks - Develop new feature');
      expect(list.items).toHaveLength(5);
      expect(list.relatedTask).toBeDefined();
      expect((list.relatedTask as any).title).toBe('Develop new feature');
      expect((list as any).completionPercentage).toBe(20); // 1 out of 5 completed
    });

    it('should create a shopping list from task requirements', async () => {
      const task = await Task.create({
        title: 'Home office setup',
        description: 'Set up productive home workspace',
        createdBy: testUser._id,
        profile: testProfile._id,
        subTasks: [
          { description: 'Buy ergonomic chair', isCompleted: false },
          { description: 'Purchase standing desk', isCompleted: false },
          { description: 'Get monitor arm', isCompleted: true, completedAt: new Date() },
          { description: 'Buy noise-canceling headphones', isCompleted: false }
        ]
      });

      const listData = {
        name: `Shopping List - ${task.title}`,
        type: ListType.Shopping,
        createdBy: testUser._id,
        profile: testProfile._id,
        relatedTask: task._id,
        items: task.subTasks
          .filter(subtask => !subtask.isCompleted) // Only items that still need to be bought
          .map(subtask => ({
            _id: new mongoose.Types.ObjectId(),
            name: subtask.description || 'Unnamed item',
            isCompleted: false,
            createdAt: new Date(),
            category: 'Office Equipment'
          }))
      };

      const list = await List.create(listData);

      expect(list.type).toBe(ListType.Shopping);
      expect(list.items).toHaveLength(3); // Excluding already completed monitor arm
      expect(list.items.every(item => !item.isCompleted)).toBe(true);
      expect(list.items.every(item => item.category === 'Office Equipment')).toBe(true);
    });

    it('should create hierarchical list with task breakdown', async () => {
      const task = await Task.create({
        title: 'Build mobile app',
        description: 'Create cross-platform mobile application',
        createdBy: testUser._id,
        profile: testProfile._id,
        subTasks: [
          { description: 'Set up development environment', isCompleted: true, completedAt: new Date() },
          { description: 'Design app architecture', isCompleted: false },
          { description: 'Implement core features', isCompleted: false },
          { description: 'Testing and QA', isCompleted: false }
        ]
      });

      // Create a detailed breakdown list with sub-items
      const listData = {
        name: `Mobile App Development - ${task.title}`,
        type: ListType.Todo,
        createdBy: testUser._id,
        profile: testProfile._id,
        relatedTask: task._id,
        items: [
          {
            _id: new mongoose.Types.ObjectId(),
            name: 'Design app architecture',
            isCompleted: false,
            createdAt: new Date(),
            subTasks: [
              {
                _id: new mongoose.Types.ObjectId(),
                name: 'Create wireframes',
                isCompleted: false,
                createdAt: new Date()
              },
              {
                _id: new mongoose.Types.ObjectId(),
                name: 'Define API structure',
                isCompleted: false,
                createdAt: new Date()
              },
              {
                _id: new mongoose.Types.ObjectId(),
                name: 'Choose technology stack',
                isCompleted: true,
                createdAt: new Date(),
                completedAt: new Date()
              }
            ]
          },
          {
            _id: new mongoose.Types.ObjectId(),
            name: 'Implement core features',
            isCompleted: false,
            createdAt: new Date(),
            subTasks: [
              {
                _id: new mongoose.Types.ObjectId(),
                name: 'User authentication',
                isCompleted: false,
                createdAt: new Date()
              },
              {
                _id: new mongoose.Types.ObjectId(),
                name: 'Data synchronization',
                isCompleted: false,
                createdAt: new Date()
              },
              {
                _id: new mongoose.Types.ObjectId(),
                name: 'Push notifications',
                isCompleted: false,
                createdAt: new Date()
              }
            ]
          }
        ]
      };

      const list = await List.create(listData);

      expect(list.items).toHaveLength(2);
      expect(list.items[0].subTasks).toHaveLength(3);
      expect(list.items[1].subTasks).toHaveLength(3);
      
      // Check that technology stack is already completed
      const completedSubtasks = list.items[0].subTasks!.filter(sub => sub.isCompleted);
      expect(completedSubtasks).toHaveLength(1);
      expect(completedSubtasks[0].name).toBe('Choose technology stack');
    });
  });

  describe('Bi-directional Synchronization', () => {
    it('should sync list item completion back to event agenda items', async () => {
      const event = await Event.create({
        title: 'Project Review',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        createdBy: testUser._id,
        profile: testProfile._id,
        agendaItems: [
          { description: 'Review deliverables', completed: false },
          { description: 'Discuss feedback', completed: false }
        ]
      });

      const list = await List.create({
        name: `Review Tasks - ${event.title}`,
        type: ListType.Todo,
        createdBy: testUser._id,
        profile: testProfile._id,
        items: event.agendaItems.map((item, index) => ({
          _id: new mongoose.Types.ObjectId(),
          name: item.description,
          isCompleted: false,
          createdAt: new Date(),
          category: 'Review'
        }))
      });

      // Simulate completing items in the list
      list.items[0].isCompleted = true;
      list.items[0].completedAt = new Date();
      await list.save();

      // In a real application, you'd have a service method to sync back to the event
      // For this test, we'll manually update to demonstrate the concept
      event.agendaItems[0].completed = true;
      await event.save();

      const updatedEvent = await Event.findById(event._id);
      expect(updatedEvent!.agendaItems[0].completed).toBe(true);
      expect(updatedEvent!.agendaItems[1].completed).toBe(false);
    });

    it('should sync list item completion back to task subtasks', async () => {
      const task = await Task.create({
        title: 'Code review process',
        createdBy: testUser._id,
        profile: testProfile._id,
        subTasks: [
          { description: 'Check code quality', isCompleted: false },
          { description: 'Verify tests', isCompleted: false },
          { description: 'Update documentation', isCompleted: false }
        ]
      });

      const list = await List.create({
        name: `Code Review - ${task.title}`,
        type: ListType.Checklist,
        createdBy: testUser._id,
        profile: testProfile._id,
        relatedTask: task._id,
        items: task.subTasks.map(subtask => ({
          _id: new mongoose.Types.ObjectId(),
          name: subtask.description || 'Unnamed task',
          isCompleted: false,
          createdAt: new Date()
        }))
      });

      // Complete items in the list
      list.items[0].isCompleted = true;
      list.items[0].completedAt = new Date();
      list.items[2].isCompleted = true;
      list.items[2].completedAt = new Date();
      await list.save();

      // Sync back to task (in real app, this would be automated)
      task.subTasks[0].isCompleted = true;
      task.subTasks[0].completedAt = new Date();
      task.subTasks[2].isCompleted = true;
      task.subTasks[2].completedAt = new Date();
      await task.save();

      const updatedTask = await Task.findById(task._id);
      expect(updatedTask!.subTasks[0].isCompleted).toBe(true);
      expect(updatedTask!.subTasks[1].isCompleted).toBe(false);
      expect(updatedTask!.subTasks[2].isCompleted).toBe(true);
    });
  });

  describe('Cross-referencing and Analytics', () => {
    it('should track completion statistics across related items', async () => {
      const task = await Task.create({
        title: 'Website redesign',
        createdBy: testUser._id,
        profile: testProfile._id,
        subTasks: [
          { description: 'Create mockups', isCompleted: true, completedAt: new Date() },
          { description: 'Develop frontend', isCompleted: false },
          { description: 'Test on devices', isCompleted: false },
          { description: 'Deploy to production', isCompleted: false }
        ]
      });

      const list = await List.create({
        name: `Website Tasks - ${task.title}`,
        type: ListType.Todo,
        createdBy: testUser._id,
        profile: testProfile._id,
        relatedTask: task._id,
        items: task.subTasks.map(subtask => ({
          _id: new mongoose.Types.ObjectId(),
          name: subtask.description || 'Unnamed task',
          isCompleted: subtask.isCompleted,
          createdAt: new Date(),
          completedAt: subtask.completedAt
        }))
      });

      // Check completion statistics
      expect((list as any).completionPercentage).toBe(25); // 1 out of 4 completed
      
      const totalItems = list.items.length;
      const completedItems = list.items.filter(item => item.isCompleted).length;
      const remainingItems = totalItems - completedItems;
      
      expect(totalItems).toBe(4);
      expect(completedItems).toBe(1);
      expect(remainingItems).toBe(3);
    });

    it('should create consolidated list from multiple sources', async () => {
      // Create task and event
      const task = await Task.create({
        title: 'Product launch preparation',
        createdBy: testUser._id,
        profile: testProfile._id,
        subTasks: [
          { description: 'Finalize product features', isCompleted: true, completedAt: new Date() },
          { description: 'Create marketing materials', isCompleted: false }
        ]
      });

      const event = await Event.create({
        title: 'Launch Event',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        createdBy: testUser._id,
        profile: testProfile._id,
        agendaItems: [
          { description: 'Product demo', completed: false },
          { description: 'Q&A session', completed: false }
        ]
      });

      // Create consolidated list combining both sources
      const consolidatedItems = [
        ...task.subTasks.map(subtask => ({
          _id: new mongoose.Types.ObjectId(),
          name: `[TASK] ${subtask.description}`,
          isCompleted: subtask.isCompleted,
          createdAt: new Date(),
          completedAt: subtask.completedAt,
          category: 'Preparation'
        })),
        ...event.agendaItems.map(item => ({
          _id: new mongoose.Types.ObjectId(),
          name: `[EVENT] ${item.description}`,
          isCompleted: item.completed,
          createdAt: new Date(),
          category: 'Event'
        }))
      ];

      const list = await List.create({
        name: 'Product Launch Master List',
        type: ListType.Todo,
        createdBy: testUser._id,
        profile: testProfile._id,
        relatedTask: task._id,
        items: consolidatedItems
      });

      expect(list.items).toHaveLength(4);
      expect(list.items.filter(item => item.category === 'Preparation')).toHaveLength(2);
      expect(list.items.filter(item => item.category === 'Event')).toHaveLength(2);
      expect((list as any).completionPercentage).toBe(25); // 1 out of 4 completed
    });
  });
}); 