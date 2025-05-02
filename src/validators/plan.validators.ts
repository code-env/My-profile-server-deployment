import Joi from 'joi';
import { PlanType } from '../models/plans/Plan';

// Helper function for ObjectId validation
const objectId = () => Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

// Base validation schema for common fields
const basePlanSchema = Joi.object({
  // Required fields
  title: Joi.string().required().max(100),
  startTime: Joi.date().iso().required(),
  createdBy: objectId().required(),
  updatedBy: objectId().required(),
  planType: Joi.string().valid(...Object.values(PlanType)).required(),

  // Optional fields
  description: Joi.string().allow('').max(500),
  isAllDay: Joi.boolean().default(false),
  endTime: Joi.date().iso().greater(Joi.ref('startTime')).when('isAllDay', {
    is: false,
    then: Joi.date().iso()
  }),
  duration: Joi.number().positive(),
  repeat: Joi.object({
    frequency: Joi.string().valid('none', 'daily', 'weekly', 'monthly', 'yearly', 'custom').default('none'),
    interval: Joi.number().integer().min(1).default(1),
    daysOfWeek: Joi.array().items(Joi.number().integer().min(0).max(6)),
    endDate: Joi.date().iso(),
    endAfterOccurrences: Joi.number().integer().positive()
  }).default({ frequency: 'none', interval: 1 }),
  reminders: Joi.array().items(Joi.object({
    timeBefore: Joi.number().required(),
    type: Joi.string().valid('before', 'after', 'at time').default('before'),
    status: Joi.string().valid('pending', 'sent', 'failed').default('pending'),
    method: Joi.string().valid('notification', 'email', 'sms', 'call').default('notification')
  })).default([]),
  visibility: Joi.string().valid('public', 'private', 'selected').default('private'),
  participants: Joi.array().items(objectId()).default([]),
  color: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/).default('#1DA1F2'),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
  notes: Joi.string().allow('').max(1000),
  reward: Joi.object({
    points: Joi.number().default(0),
    description: Joi.string().allow('').max(200)
  }),
  attachments: Joi.array().items(Joi.object({
    fileType: Joi.string().required(),
    url: Joi.string().uri().required(),
    name: Joi.string().required(),
    uploadedBy: objectId().required()
  })).default([]),
  comments: Joi.array().items(Joi.object({
    text: Joi.string().required().max(500),
    postedBy: objectId().required(),
    replies: Joi.array().items(Joi.object({
      text: Joi.string().required().max(500),
      postedBy: objectId().required()
    })).default([]),
    reactions: Joi.object().pattern(
      Joi.string(),
      Joi.array().items(objectId())
    ).default({})
  })).default([]),
  links: Joi.array().items(Joi.object({
    url: Joi.string().uri().required(),
    title: Joi.string().required(),
    createdBy: objectId().required()
  })).default([])
});

// Task-specific validation schema
const taskSchema = basePlanSchema.keys({
  planType: Joi.string().valid(PlanType.TASK).required(),
  subTasks: Joi.array().items(Joi.object({
    description: Joi.string().required().max(200),
    completed: Joi.boolean().default(false),
    createdAt: Joi.date().default(Date.now),
    updatedAt: Joi.date().default(Date.now)
  })).default([]),
  status: Joi.string().valid('upcoming', 'in-progress', 'completed', 'cancelled').default('upcoming'),
  parentTask: objectId(),
  dependencies: Joi.array().items(objectId()).default([])
});

// Meeting-specific validation schema
const meetingSchema = basePlanSchema.keys({
  planType: Joi.string().valid(PlanType.MEETING).required(),
  agenda: Joi.array().items(Joi.object({
    title: Joi.string().required().max(100),
    description: Joi.string().allow('').max(200),
    order: Joi.number().required(),
    completed: Joi.boolean().default(false)
  })).default([]),
  minutes: Joi.string().allow('').max(5000),
  decisions: Joi.array().items(Joi.object({
    description: Joi.string().required().max(500),
    agreedBy: Joi.array().items(objectId()).required()
  })).default([]),
  status: Joi.string().valid('scheduled', 'in-progress', 'completed', 'cancelled').default('scheduled'),
  requiredAttendees: Joi.array().items(objectId()).default([]),
  optionalAttendees: Joi.array().items(objectId()).default([])
});

// Appointment-specific validation schema
const appointmentSchema = basePlanSchema.keys({
  planType: Joi.string().valid(PlanType.APPOINTMENT).required(),
  serviceProvider: Joi.object({
    profileId: objectId().required(),
    role: Joi.string().required(),
    organization: objectId()
  }).required(),
  preparationItems: Joi.array().items(Joi.object({
    description: Joi.string().required(),
    completed: Joi.boolean().default(false)
  })).default([]),
  status: Joi.string().valid('scheduled', 'confirmed', 'completed', 'cancelled', 'no-show').default('scheduled'),
  insuranceInfo: Joi.object({
    provider: Joi.string(),
    memberId: Joi.string()
  }),
  billingCode: Joi.string()
});

// Event-specific validation schema
const eventSchema = basePlanSchema.keys({
  planType: Joi.string().valid(PlanType.EVENT).required(),
  location: Joi.object({
    name: Joi.string(),
    address: Joi.string(),
    coordinates: Joi.object({
      lat: Joi.number(),
      lng: Joi.number()
    }),
    online: Joi.boolean().default(false),
    meetingUrl: Joi.string().uri()
  }),
  isGroupEvent: Joi.boolean().default(true),
  status: Joi.string().valid('upcoming', 'in-progress', 'completed', 'cancelled').default('upcoming'),
  maxAttendees: Joi.number().positive(),
  registrationRequired: Joi.boolean().default(false)
});

// Celebration-specific validation schema
const celebrationSchema = basePlanSchema.keys({
  planType: Joi.string().valid(PlanType.CELEBRATION).required(),
  gifts: Joi.array().items(Joi.object({
    description: Joi.string().required(),
    requestedBy: objectId(),
    promisedBy: objectId(),
    received: Joi.boolean().default(false),
    link: Joi.string().uri()
  })).default([]),
  category: Joi.string().valid('birthday', 'anniversary', 'holiday', 'achievement', 'other').default('birthday'),
  status: Joi.string().valid('planning', 'upcoming', 'completed', 'cancelled').default('planning'),
  photoAlbum: objectId(),
  socialMediaPosts: Joi.array().items(Joi.object({
    platform: Joi.string().required(),
    postId: Joi.string().required(),
    url: Joi.string().uri().required()
  })).default([])
});

// Interaction-specific validation schema
const interactionSchema = basePlanSchema.keys({
  planType: Joi.string().valid(PlanType.INTERACTION).required(),
  profile: objectId().required(),
  relationship: Joi.string().required(),
  lastContact: Joi.date().iso().required(),
  nextContact: Joi.date().iso(),
  frequency: Joi.string(),
  mode: Joi.string().valid('call', 'email', 'meeting', 'chat').required(),
  physicalLocation: Joi.object({
    address: Joi.string(),
    coordinates: Joi.object({
      lat: Joi.number(),
      lng: Joi.number()
    })
  }),
  category: Joi.string().valid('business', 'personal', 'networking').required()
});

export class PlanValidator {
  static validatePlan(planType: PlanType, data: any) {
    let schema;
    switch(planType) {
      case PlanType.TASK: schema = taskSchema; break;
      case PlanType.MEETING: schema = meetingSchema; break;
      case PlanType.APPOINTMENT: schema = appointmentSchema; break;
      case PlanType.EVENT: schema = eventSchema; break;
      case PlanType.CELEBRATION: schema = celebrationSchema; break;
      case PlanType.INTERACTION: schema = interactionSchema; break;
      default: throw new Error(`Invalid plan type: ${planType}`);
    }

    const validationOptions = {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false,
      convert: true
    };

    return schema.validate(data, validationOptions);
  }

  static validatePartialPlan(planType: PlanType, data: any) {
    const { error, value } = this.validatePlan(planType, data);
    
    if (error) {
      // For partial updates, we don't require all fields
      return { 
        error: error.details.length > 0 ? error : null,
        value 
      };
    }
    
    return { error, value };
  }
}