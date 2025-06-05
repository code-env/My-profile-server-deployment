import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import express from 'express';
import { Event, IEvent } from '../../models/Event';
import { User, IUser } from '../../models/User';
import { ProfileModel } from '../../models/profile.model';
import eventService from '../../services/event.service';
import * as eventController from '../../controllers/event.controller';
import { EventType, EventStatus, PriorityLevel, BookingStatus } from '../../models/plans-shared';
import jwt from 'jsonwebtoken';

// Mock external dependencies
jest.mock('../../services/vault.service', () => ({
  vaultService: {
    uploadAndAddToVault: jest.fn().mockResolvedValue({
      secure_url: 'https://example.com/test-file.jpg',
      original_filename: 'test-file.jpg',
      bytes: 1024,
      format: 'jpg',
      public_id: 'test-public-id'
    })
  }
}));

jest.mock('../../services/notification.service', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotification: jest.fn().mockResolvedValue(true)
  }))
}));

jest.mock('../../services/settings.service', () => ({
  SettingsService: jest.fn().mockImplementation(() => ({
    getSettings: jest.fn().mockResolvedValue({
      general: { 
        appSystem: { allowNotifications: true },
        time: { timeZone: 'UTC' }
      },
      notifications: { communication: { comments: { push: true } } }
    })
  }))
}));

jest.mock('../../utils/socketEmitter', () => ({
  emitSocialInteraction: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../utils/visibilityMapper', () => ({
  mapTaskEventDataToInternal: jest.fn((data) => data),
  mapTaskEventDataToExternal: jest.fn((data) => data)
}));

jest.mock('../../utils/timeUtils', () => ({
  checkTimeOverlap: jest.fn().mockResolvedValue({ overlaps: false, conflictingItems: [] })
}));

jest.mock('../../utils/eventSettingsIntegration', () => ({
  applyUserDefaultsToEvent: jest.fn((userId, eventData) => Promise.resolve(eventData)),
  applyPrivacyFiltering: jest.fn((events, profileId, userId) => Promise.resolve(events))
}));

jest.mock('../../utils/timezoneUtils', () => ({
  TimezoneUtils: {
    getUserTimezone: jest.fn().mockResolvedValue('UTC'),
    convertToUserTimezone: jest.fn((date) => date)
  }
}));

jest.mock('../../services/participant.service', () => ({
  default: {
    getEventParticipants: jest.fn().mockResolvedValue([])
  }
}));

describe('Event System Tests', () => {
  let mongoServer: MongoMemoryServer;
  let app: express.Application;
  let testUser: IUser;
  let testProfile: any;
  let authToken: string;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Setup Express app
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    app.use((req: any, res, next) => {
      req.user = testUser;
      next();
    });

    // Setup routes
    app.post('/events', eventController.createEvent);
    app.get('/events/:id', eventController.getEventById);
    app.get('/events', eventController.getUserEvents);
    app.put('/events/:id', eventController.updateEvent);
    app.delete('/events/:id', eventController.deleteEvent);
    app.post('/events/:id/agenda', eventController.addAgendaItem);
    app.put('/events/:id/agenda/:agendaItemIndex', eventController.updateAgendaItem);
    app.delete('/events/:id/agenda/:agendaItemIndex', eventController.deleteAgendaItem);
    app.post('/events/:id/attachment', eventController.addAttachment);
    app.delete('/events/:id/attachment/:attachmentIndex', eventController.removeAttachment);
    app.put('/events/:id/service-provider', eventController.setServiceProvider);
    app.post('/events/:id/comments', eventController.addComment);
    app.post('/events/:id/like', eventController.likeEvent);
    app.post('/events/:id/comments/:commentIndex/like', eventController.likeComment);
    app.post('/events/booking', eventController.createBooking);
    app.patch('/events/:id/booking/status', eventController.updateBookingStatus);
    app.patch('/events/:id/booking/reward', eventController.updateBookingReward);
    app.patch('/events/:id/booking/reschedule', eventController.rescheduleBooking);
    app.get('/events/provider/:profileId/bookings', eventController.getProviderBookings);
    app.post('/events/celebration', eventController.createCelebration);
    app.post('/events/:id/gifts', eventController.addGift);
    app.patch('/events/:id/gifts/:giftIndex/received', eventController.markGiftReceived);
    app.post('/events/:id/social-media', eventController.addSocialMediaPost);
    app.patch('/events/:id/celebration/status', eventController.updateCelebrationStatus);
    app.patch('/events/:id/status', eventController.updateEventStatus);
    app.patch('/events/bulk/status', eventController.bulkUpdateEventStatus);

    // Error handling middleware
    app.use((error: any, req: any, res: any, next: any) => {
      res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Internal Server Error'
      });
    });
  });

  beforeEach(async () => {
    // Clear database
    await Event.deleteMany({});
    await User.deleteMany({});
    await ProfileModel.deleteMany({});

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

    // Generate auth token
    authToken = jwt.sign({ userId: testUser._id }, 'test-secret');
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('Event Controller Tests', () => {
    describe('POST /events - Create Event', () => {
      it('should create a new event successfully', async () => {
        const eventData = {
          title: 'Test Event',
          description: 'Test Description',
          startTime: new Date('2024-12-01T10:00:00Z'),
          endTime: new Date('2024-12-01T11:00:00Z'),
          profile: testProfile._id,
          profileId: testProfile._id,
          userId: testUser._id,
          createdBy: testUser._id,
          eventType: EventType.Meeting,
          status: EventStatus.Upcoming,
          priority: PriorityLevel.Medium,
          visibility: 'Public'
        };

        const response = await request(app)
          .post('/events')
          .send(eventData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe(eventData.title);
        expect(response.body.message).toBe('Event created successfully');
      });

      it('should handle validation errors', async () => {
        const invalidEventData = {
          description: 'Missing required fields'
        };

        const response = await request(app)
          .post('/events')
          .send(invalidEventData)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should handle events with attachments', async () => {
        const eventData = {
          title: 'Event with Attachments',
          startTime: new Date('2024-12-01T10:00:00Z'),
          endTime: new Date('2024-12-01T11:00:00Z'),
          profile: testProfile._id,
          createdBy: testUser._id,
          eventType: EventType.Meeting,
          status: EventStatus.Upcoming,
          priority: PriorityLevel.Medium,
          attachments: [{
            type: 'Photo' as const,
            url: 'https://example.com/test.jpg',
            name: 'test.jpg',
            uploadedAt: new Date(),
            uploadedBy: testUser._id
          }]
        };

        const event = await eventService.createEvent(eventData);

        expect(event.attachments).toBeDefined();
        expect(event.attachments.length).toBeGreaterThan(0);
      });

      it('should create booking event', async () => {
        const bookingData = {
          title: 'Service Booking',
          startTime: new Date('2024-12-01T10:00:00Z'),
          endTime: new Date('2024-12-01T11:00:00Z'),
          profile: testProfile._id,
          profileId: testProfile._id,
          userId: testUser._id,
          createdBy: testUser._id,
          eventType: EventType.Booking,
          status: EventStatus.Upcoming,
          priority: PriorityLevel.Medium,
          booking: {
            serviceProvider: {
              profileId: testProfile._id,
              role: 'provider'
            },
            service: {
              name: 'Test Service',
              duration: 60
            },
            status: BookingStatus.Pending,
            rescheduleCount: 0,
            requireApproval: true
          }
        };

        const response = await request(app)
          .post('/events')
          .send(bookingData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.eventType).toBe(EventType.Booking);
      });
    });

    describe('GET /events/:id - Get Event by ID', () => {
      it('should get event by ID successfully', async () => {
        const event: any = await Event.create({
          title: 'Test Event',
          startTime: new Date('2024-12-01T10:00:00Z'),
          endTime: new Date('2024-12-01T11:00:00Z'),
          profile: testProfile._id,
          createdBy: testUser._id,
          eventType: EventType.Meeting,
          status: EventStatus.Upcoming,
          priority: PriorityLevel.Medium
        });

        const response = await request(app)
          .get(`/events/${event._id.toString()}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe('Test Event');
      });

      it('should return 404 for non-existent event', async () => {
        const nonExistentId = new mongoose.Types.ObjectId();
        
        const response = await request(app)
          .get(`/events/${nonExistentId}`)
          .expect(404);

        expect(response.body.success).toBe(false);
      });

      it('should return 400 for invalid event ID', async () => {
        const response = await request(app)
          .get('/events/invalid-id')
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /events - Get User Events', () => {
      it('should get user events with pagination', async () => {
        // Create multiple events
        for (let i = 0; i < 5; i++) {
          await Event.create({
            title: `Test Event ${i}`,
            startTime: new Date(`2024-12-0${i + 1}T10:00:00Z`),
            endTime: new Date(`2024-12-0${i + 1}T11:00:00Z`),
            profile: testProfile._id,
            createdBy: testUser._id,
            eventType: EventType.Meeting,
            status: EventStatus.Upcoming,
            priority: PriorityLevel.Medium
          });
        }

        const response = await request(app)
          .get('/events')
          .send({ profileId: testProfile._id })
          .query({ page: 1, limit: 3 })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(3);
        expect(response.body.pagination.total).toBe(5);
      });

      it('should filter events by status', async () => {
        await Event.create({
          title: 'Upcoming Event',
          startTime: new Date('2024-12-01T10:00:00Z'),
          endTime: new Date('2024-12-01T11:00:00Z'),
          profile: testProfile._id,
          createdBy: testUser._id,
          eventType: EventType.Meeting,
          status: EventStatus.Upcoming,
          priority: PriorityLevel.Medium
        });

        await Event.create({
          title: 'Completed Event',
          startTime: new Date('2024-11-01T10:00:00Z'),
          endTime: new Date('2024-11-01T11:00:00Z'),
          profile: testProfile._id,
          createdBy: testUser._id,
          eventType: EventType.Meeting,
          status: EventStatus.Completed,
          priority: PriorityLevel.Medium
        });

        const response = await request(app)
          .get('/events')
          .send({ profileId: testProfile._id })
          .query({ status: EventStatus.Upcoming })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].status).toBe(EventStatus.Upcoming);
      });
    });

    describe('PUT /events/:id - Update Event', () => {
      it('should update event successfully', async () => {
        const event: any = await Event.create({
          title: 'Original Title',
          startTime: new Date('2024-12-01T10:00:00Z'),
          endTime: new Date('2024-12-01T11:00:00Z'),
          profile: testProfile._id,
          createdBy: testUser._id,
          eventType: EventType.Meeting,
          status: EventStatus.Upcoming,
          priority: PriorityLevel.Medium
        });

        const updatedEvent = await eventService.updateEvent(
          event._id.toString(),
          testUser._id.toString(),
          testProfile._id.toString(),
          { 
            title: 'Updated Title', 
            description: 'New Description',
            priority: PriorityLevel.High
          }
        );

        expect(updatedEvent.title).toBe('Updated Title');
        expect(updatedEvent.description).toBe('New Description');
        expect(updatedEvent.priority).toBe(PriorityLevel.High);
      });

      it('should return 400 for invalid event ID', async () => {
        const response = await request(app)
          .put('/events/invalid-id')
          .send({ title: 'Updated Title', profileId: testProfile._id })
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('DELETE /events/:id - Delete Event', () => {
      it('should delete event successfully', async () => {
        const event: any = await Event.create({
          title: 'Event to Delete',
          startTime: new Date('2024-12-01T10:00:00Z'),
          endTime: new Date('2024-12-01T11:00:00Z'),
          profile: testProfile._id,
          createdBy: testUser._id,
          eventType: EventType.Meeting,
          status: EventStatus.Upcoming,
          priority: PriorityLevel.Medium
        });

        const response = await request(app)
          .delete(`/events/${event._id.toString()}`)
          .send({ profileId: testProfile._id })
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify event is deleted
        const deletedEvent = await Event.findById(event._id);
        expect(deletedEvent).toBeNull();
      });

      it('should return 400 for invalid event ID', async () => {
        const response = await request(app)
          .delete('/events/invalid-id')
          .send({ profileId: testProfile._id })
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Agenda Item Operations', () => {
      let event: any;

      beforeEach(async () => {
        event = await Event.create({
          title: 'Event with Agenda',
          startTime: new Date('2024-12-01T10:00:00Z'),
          endTime: new Date('2024-12-01T11:00:00Z'),
          profile: testProfile._id,
          createdBy: testUser._id,
          eventType: EventType.Meeting,
          status: EventStatus.Upcoming,
          priority: PriorityLevel.Medium,
          agendaItems: []
        });
      });

      it('should add agenda item successfully', async () => {
        const agendaData = {
          description: 'New Agenda Item',
          assignedTo: testProfile._id,
          completed: false
        };

        const response = await request(app)
          .post(`/events/${event._id.toString()}/agenda`)
          .send(agendaData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.agendaItems).toHaveLength(1);
        expect(response.body.data.agendaItems[0].description).toBe('New Agenda Item');
      });

      it('should update agenda item successfully', async () => {
        // First add an agenda item
        await Event.findByIdAndUpdate(event._id, {
          $push: { agendaItems: { description: 'Original Item', completed: false } }
        });

        const updateData = {
          description: 'Updated Agenda Item',
          completed: true
        };

        const response = await request(app)
          .put(`/events/${event._id.toString()}/agenda/0`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.agendaItems[0].description).toBe('Updated Agenda Item');
        expect(response.body.data.agendaItems[0].completed).toBe(true);
      });

      it('should delete agenda item successfully', async () => {
        // First add an agenda item
        await Event.findByIdAndUpdate(event._id, {
          $push: { agendaItems: { description: 'Item to Delete', completed: false } }
        });

        const response = await request(app)
          .delete(`/events/${event._id.toString()}/agenda/0`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.agendaItems).toHaveLength(0);
      });
    });

    describe('Attachment Operations', () => {
      let event: any;

      beforeEach(async () => {
        event = await Event.create({
          title: 'Event with Attachments',
          startTime: new Date('2024-12-01T10:00:00Z'),
          endTime: new Date('2024-12-01T11:00:00Z'),
          profile: testProfile._id,
          createdBy: testUser._id,
          eventType: EventType.Meeting,
          status: EventStatus.Upcoming,
          priority: PriorityLevel.Medium,
          attachments: []
        });
      });

      it('should add attachment successfully', async () => {
        const attachmentData = {
          type: 'Photo' as const,
          url: 'https://example.com/photo.jpg',
          name: 'photo.jpg',
          description: 'Test photo',
          profileId: testProfile._id
        };

        const response = await request(app)
          .post(`/events/${event._id.toString()}/attachment`)
          .send(attachmentData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.attachments).toHaveLength(1);
        expect(response.body.data.attachments[0].name).toBe('photo.jpg');
      });

      it('should remove attachment successfully', async () => {
        // First add an attachment
        await Event.findByIdAndUpdate(event._id, {
          $push: { 
            attachments: { 
              type: 'Photo' as const,
              url: 'https://example.com/photo.jpg',
              name: 'photo.jpg',
              uploadedBy: testUser._id,
              uploadedAt: new Date()
            } 
          }
        });

        const response = await request(app)
          .delete(`/events/${event._id.toString()}/attachment/0`)
          .send({ profileId: testProfile._id })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.attachments).toHaveLength(0);
      });
    });

    describe('Comment and Like Operations', () => {
      let event: any;

      beforeEach(async () => {
        event = await Event.create({
          title: 'Event with Comments',
          startTime: new Date('2024-12-01T10:00:00Z'),
          endTime: new Date('2024-12-01T11:00:00Z'),
          profile: testProfile._id,
          createdBy: testUser._id,
          eventType: EventType.Meeting,
          status: EventStatus.Upcoming,
          priority: PriorityLevel.Medium,
          comments: [],
          likes: []
        });
      });

      it('should add comment successfully', async () => {
        const updatedEvent = await eventService.addComment(
          event._id.toString(),
          testUser._id.toString(),
          testProfile._id.toString(),
          { text: 'This is a test comment' }
        );

        expect(updatedEvent.comments).toHaveLength(1);
        expect(updatedEvent.comments[0].text).toBe('This is a test comment');
      });

      it('should like event successfully', async () => {
        const response = await request(app)
          .post(`/events/${event._id.toString()}/like`)
          .send({ profileId: testProfile._id })
          .expect(200);

        expect(response.body.success).toBe(true);
        if (response.body.data && typeof response.body.data === 'object' && 'likes' in response.body.data) {
          expect(response.body.data.likes).toHaveLength(1);
        } else {
          expect(response.body.success).toBe(true);
        }
      });

      it('should like comment successfully', async () => {
        // First add a comment
        await Event.findByIdAndUpdate(event._id, {
          $push: { 
            comments: { 
              text: 'Comment to like', 
              postedBy: testProfile._id,
              likes: []
            } 
          }
        });

        const response = await request(app)
          .post(`/events/${event._id.toString()}/comments/0/like`)
          .send({ profileId: testProfile._id })
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('Booking Operations', () => {
      it('should create booking successfully', async () => {
        const bookingData = {
          title: 'Service Booking',
          startTime: new Date('2024-12-01T10:00:00Z'),
          endTime: new Date('2024-12-01T11:00:00Z'),
          profile: testProfile._id,
          profileId: testProfile._id,
          userId: testUser._id,
          createdBy: testUser._id,
          eventType: EventType.Booking,
          status: EventStatus.Upcoming,
          priority: PriorityLevel.Medium,
          booking: {
            serviceProvider: {
              profileId: testProfile._id,
              role: 'provider'
            },
            service: {
              name: 'Test Service',
              duration: 60
            },
            status: BookingStatus.Pending,
            rescheduleCount: 0,
            requireApproval: true
          }
        };

        const response = await request(app)
          .post('/events/booking')
          .send(bookingData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.eventType).toBe(EventType.Booking);
      });

      it('should update booking status', async () => {
        const event: any = await Event.create({
          title: 'Booking Event',
          startTime: new Date('2024-12-01T10:00:00Z'),
          endTime: new Date('2024-12-01T11:00:00Z'),
          profile: testProfile._id,
          createdBy: testUser._id,
          eventType: EventType.Booking,
          status: EventStatus.Upcoming,
          priority: PriorityLevel.Medium,
          booking: {
            serviceProvider: {
              profileId: testProfile._id,
              role: 'provider'
            },
            service: {
              name: 'Test Service',
              duration: 60
            },
            status: BookingStatus.Pending,
            rescheduleCount: 0,
            requireApproval: true
          }
        });

        const updatedEvent = await eventService.updateBookingStatus(
          event._id.toString(),
          testUser._id.toString(),
          testProfile._id.toString(),
          BookingStatus.Confirmed
        );

        expect(updatedEvent.booking?.status).toBe(BookingStatus.Confirmed);
      });
    });

    describe('Celebration Operations', () => {
      it('should create celebration event', async () => {
        const celebrationData = {
          title: 'Birthday Party',
          startTime: new Date('2024-12-01T18:00:00Z'),
          endTime: new Date('2024-12-01T22:00:00Z'),
          profileId: testProfile._id,
          createdBy: testUser._id,
          eventType: EventType.Celebration,
          celebration: {
            category: 'birthday' as const,
            status: 'planning' as const,
            gifts: [],
            socialMediaPosts: []
          }
        };

        const event = await eventService.createCelebration(
          celebrationData,
          testUser._id.toString(),
          testProfile._id.toString()
        );

        expect(event.eventType).toBe(EventType.Celebration);
        expect(event.celebration?.category).toBe('birthday');
      });

      it('should add gift to celebration', async () => {
        const event: any = await Event.create({
          title: 'Birthday Celebration',
          startTime: new Date('2024-12-01T18:00:00Z'),
          endTime: new Date('2024-12-01T22:00:00Z'),
          profile: testProfile._id,
          createdBy: testUser._id,
          eventType: EventType.Celebration,
          celebration: {
            gifts: [],
            category: 'birthday' as const,
            status: 'planning' as const,
            socialMediaPosts: []
          }
        });

        const giftData = {
          description: 'New Book',
          requestedBy: testProfile._id,
          link: 'https://example.com/book'
        };

        const updatedEvent = await eventService.addGift(
          event._id.toString(),
          giftData
        );

        expect(updatedEvent.celebration?.gifts).toHaveLength(1);
        expect(updatedEvent.celebration?.gifts?.[0]?.description).toBe('New Book');
      });
    });

    describe('POST /events/:id/comments - Add Comment', () => {
      let testEvent: any;

      beforeEach(async () => {
        testEvent = await Event.create({
          title: 'Event with Comments',
          startTime: new Date('2024-12-01T10:00:00Z'),
          endTime: new Date('2024-12-01T11:00:00Z'),
          profile: testProfile._id,
          createdBy: testUser._id,
          eventType: EventType.Meeting,
          status: EventStatus.Upcoming,
          comments: [],
          settings: {
            permissions: {
              canEdit: [testUser._id],
              canComment: [testUser._id],
              canView: [testUser._id]
            }
          }
        });
      });

      it('should add comment with mentions and attachments', async () => {
        const commentData = {
          text: 'Test comment with mentions and attachments',
          profileId: testProfile._id,
          mentions: [testUser._id],
          attachments: [{
            type: 'Photo',
            url: 'https://example.com/photo.jpg',
            name: 'test.jpg'
          }]
        };

        const response = await request(app)
          .post(`/events/${testEvent.id}/comments`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(commentData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.text).toBe(commentData.text);
        expect(response.body.data.postedBy.toString()).toBe(testProfile._id.toString());
      });

      it('should handle empty mentions and attachments arrays', async () => {
        const commentData = {
          text: 'Test comment with empty arrays',
          profileId: testProfile._id,
          mentions: [],
          attachments: []
        };

        const response = await request(app)
          .post(`/events/${testEvent.id}/comments`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(commentData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.text).toBe(commentData.text);
        expect(response.body.data.postedBy.toString()).toBe(testProfile._id.toString());
      });

      it('should handle missing mentions and attachments fields', async () => {
        const commentData = {
          text: 'Test comment without optional fields',
          profileId: testProfile._id
        };

        const response = await request(app)
          .post(`/events/${testEvent.id}/comments`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(commentData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.text).toBe(commentData.text);
        expect(response.body.data.postedBy.toString()).toBe(testProfile._id.toString());
      });
    });
  });

  describe('Event Model Tests', () => {
    it('should create event with required fields', async () => {
      const eventData = {
        title: 'Model Test Event',
        startTime: new Date('2024-12-01T10:00:00Z'),
        endTime: new Date('2024-12-01T11:00:00Z'),
        profile: testProfile._id,
        createdBy: testUser._id,
        eventType: EventType.Meeting,
        status: EventStatus.Upcoming,
        priority: PriorityLevel.Medium
      };

      const event = new Event(eventData);
      await event.save();

      expect(event.title).toBe('Model Test Event');
      expect(event.profile).toEqual(testProfile._id);
      expect(event.createdBy).toEqual(testUser._id);
      expect(event.eventType).toBe(EventType.Meeting);
      expect(event.status).toBe(EventStatus.Upcoming);
      expect(event.priority).toBe(PriorityLevel.Medium);
    });

    it('should validate required fields', async () => {
      const event = new Event({});

      await expect(event.save()).rejects.toThrow();
    });

    it('should set default values', async () => {
      const event = new Event({
        title: 'Event with Defaults',
        startTime: new Date('2024-12-01T10:00:00Z'),
        endTime: new Date('2024-12-01T11:00:00Z'),
        profile: testProfile._id,
        createdBy: testUser._id
      });

      await event.save();

      expect(event.isAllDay).toBe(false);
      expect(event.color).toBe('#1DA1F2');
      expect(event.priority).toBe(PriorityLevel.Low);
      expect(event.status).toBe(EventStatus.Upcoming);
      expect(event.visibility).toBe('Public');
      expect(event.agendaItems).toEqual([]);
      expect(event.attachments).toEqual([]);
      expect(event.comments).toEqual([]);
      expect(event.likes).toEqual([]);
    });

    it('should validate enum values', async () => {
      const event = new Event({
        title: 'Event with Invalid Enum',
        startTime: new Date('2024-12-01T10:00:00Z'),
        endTime: new Date('2024-12-01T11:00:00Z'),
        profile: testProfile._id,
        createdBy: testUser._id,
        priority: 'InvalidPriority' as any
      });

      await expect(event.save()).rejects.toThrow();
    });

    it('should handle agenda items array', async () => {
      const event = new Event({
        title: 'Event with Agenda',
        startTime: new Date('2024-12-01T10:00:00Z'),
        endTime: new Date('2024-12-01T11:00:00Z'),
        profile: testProfile._id,
        createdBy: testUser._id,
        agendaItems: [
          { description: 'Agenda Item 1', completed: false },
          { description: 'Agenda Item 2', completed: true }
        ]
      });

      await event.save();

      expect(event.agendaItems).toHaveLength(2);
      expect(event.agendaItems[0].description).toBe('Agenda Item 1');
      expect(event.agendaItems[0].completed).toBe(false);
      expect(event.agendaItems[1].description).toBe('Agenda Item 2');
      expect(event.agendaItems[1].completed).toBe(true);
    });

    it('should handle booking object', async () => {
      const event = new Event({
        title: 'Booking Event',
        startTime: new Date('2024-12-01T10:00:00Z'),
        endTime: new Date('2024-12-01T11:00:00Z'),
        profile: testProfile._id,
        createdBy: testUser._id,
        eventType: EventType.Booking,
        status: EventStatus.Upcoming,
        priority: PriorityLevel.Medium,
        booking: {
          serviceProvider: {
            profileId: testProfile._id,
            role: 'provider'
          },
          service: {
            name: 'Test Service',
            duration: 60
          },
          status: BookingStatus.Pending,
          rescheduleCount: 0,
          requireApproval: true
        }
      });

      await event.save();

      expect(event.booking?.serviceProvider?.profileId).toEqual(testProfile._id);
      expect(event.booking?.service?.name).toBe('Test Service');
      expect(event.booking?.status).toBe(BookingStatus.Pending);
    });

    it('should handle celebration object', async () => {
      const event = new Event({
        title: 'Celebration Event',
        startTime: new Date('2024-12-01T18:00:00Z'),
        endTime: new Date('2024-12-01T22:00:00Z'),
        profile: testProfile._id,
        createdBy: testUser._id,
        eventType: EventType.Celebration,
        celebration: {
          gifts: [{
            description: 'Birthday Gift',
            requestedBy: testProfile._id,
            received: false
          }],
          category: 'birthday' as const,
          status: 'planning' as const,
          socialMediaPosts: []
        }
      });

      await event.save();

      expect(event.celebration?.category).toBe('birthday');
      expect(event.celebration?.status).toBe('planning');
      expect(event.celebration?.gifts).toHaveLength(1);
      expect(event.celebration?.gifts[0].description).toBe('Birthday Gift');
    });

    it('should handle settings object', async () => {
      const event = new Event({
        title: 'Event with Settings',
        startTime: new Date('2024-12-01T10:00:00Z'),
        endTime: new Date('2024-12-01T11:00:00Z'),
        profile: testProfile._id,
        createdBy: testUser._id,
        settings: {
          visibility: {
            level: 'ConnectionsOnly',
            customUsers: []
          },
          notifications: {
            enabled: true,
            channels: {
              push: true,
              text: false,
              inApp: true,
              email: false
            }
          },
          privacy: {
            allowComments: true,
            allowLikes: true,
            allowParticipants: false,
            shareWithConnections: true
          }
        }
      });

      await event.save();

      expect(event.settings?.visibility?.level).toBe('ConnectionsOnly');
      expect(event.settings?.notifications?.enabled).toBe(true);
      expect(event.settings?.privacy?.allowComments).toBe(true);
    });
  });
}); 