import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { IUser } from '../models/User';
import { PlanType } from '../models/plans/Plan';
import plansService from '../services/plans.service';

// Helper functions (similar to your contact controller)
const validateAuthenticatedUser = (req: Request): { userId: string, user: IUser } => {
  if (!req.user) {
    throw new Error('Authentication required');
  }
  return {
    userId: (req.user as IUser)._id.toString(),
    user: req.user as IUser
  };
};

const handleErrorResponse = (error: unknown, res: Response) => {
  if (error instanceof Error && error.message === 'Authentication required') {
    return res.status(401).json({ error: error.message });
  }

  const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 400;
  res.status(statusCode).json({
    success: false,
    error: error instanceof Error ? error.message : 'An unknown error occurred',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error instanceof Error ? error.stack : undefined 
    })
  });
};

const successResponse = (res: Response, data: any, message: string) => {
  res.status(200).json({
    message,
    success: true,
    data
  });
};

// Main controller methods
export const createPlan = async (req: Request, res: Response) => {
  try {
    const { user } = validateAuthenticatedUser(req);
    const { planType } = req.params;
    
    if (!Object.values(PlanType).includes(planType as PlanType)) {
      throw new Error('Invalid plan type');
    }

    // Add creator info to the plan data

    console.log('createdBy', user._id);
    const planData = {
      ...req.body,
      createdBy: user._id.toString(),
      updatedBy: user._id.toString()
    };

    const plan = await plansService.createPlan(planType as PlanType, planData);
    successResponse(res, plan, 'Plan created successfully');
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const getPlanById = async (req: Request, res: Response) => {
  try {
    validateAuthenticatedUser(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid plan ID');
    }

    const plan = await plansService.getPlanById(id);
    if (!plan) {
      throw new Error('Plan not found');
    }

    successResponse(res, plan, 'Plan retrieved successfully');
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const updatePlan = async (req: Request, res: Response) => {
  try {
    const { user } = validateAuthenticatedUser(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid plan ID');
    }

    const updateData = {
      ...req.body,
      updatedBy: user._id
    };

    const updatedPlan = await plansService.updatePlan(id, updateData);
    if (!updatedPlan) {
      throw new Error('Plan not found');
    }

    successResponse(res, updatedPlan, 'Plan updated successfully');
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const deletePlan = async (req: Request, res: Response) => {
  try {
    validateAuthenticatedUser(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid plan ID');
    }

    const deletedPlan = await plansService.deletePlan(id);
    if (!deletedPlan) {
      throw new Error('Plan not found');
    }

    successResponse(res, deletedPlan, 'Plan deleted successfully');
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const listPlans = async (req: Request, res: Response) => {
  try {
    const { user } = validateAuthenticatedUser(req);
    const { page = 1, limit = 10 } = req.query;

    const options = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      sort: req.query.sort || { startTime: 1 }
    };

    // Add filter for user's plans by default
    const filter = {
      ...req.query.filter && typeof req.query.filter === 'string' 
        ? JSON.parse(req.query.filter) 
        : {},
      $or: [
        { createdBy: user._id },
        { participants: user._id }
      ]
    };

    const result = await plansService.listPlans(filter, options);
    successResponse(res, result, 'Plans retrieved successfully');
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

// Type-specific controllers
export const addSubTask = async (req: Request, res: Response) => {
  try {
    validateAuthenticatedUser(req);
    const { taskId } = req.params;
    const { description } = req.body;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      throw new Error('Invalid task ID');
    }

    if (!description) {
      throw new Error('Description is required');
    }

    const subTaskId = await plansService.addSubTask(taskId, description);
    successResponse(res, { subTaskId }, 'Subtask added successfully');
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const toggleSubTask = async (req: Request, res: Response) => {
  try {
    validateAuthenticatedUser(req);
    const { taskId, subTaskId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(taskId) || !mongoose.Types.ObjectId.isValid(subTaskId)) {
      throw new Error('Invalid IDs provided');
    }

    const completed = await plansService.toggleSubTask(taskId, subTaskId);
    successResponse(res, { completed }, 'Subtask toggled successfully');
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const addAgendaItem = async (req: Request, res: Response) => {
  try {
    validateAuthenticatedUser(req);
    const { meetingId } = req.params;
    const { title, order, description } = req.body;

    if (!mongoose.Types.ObjectId.isValid(meetingId)) {
      throw new Error('Invalid meeting ID');
    }

    if (!title || !order) {
      throw new Error('Title and order are required');
    }

    const agendaItemId = await plansService.addAgendaItem(meetingId, title, order, description);
    successResponse(res, { agendaItemId }, 'Agenda item added successfully');
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const confirmAppointment = async (req: Request, res: Response) => {
  try {
    validateAuthenticatedUser(req);
    const { appointmentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      throw new Error('Invalid appointment ID');
    }

    await plansService.confirmAppointment(appointmentId);
    successResponse(res, null, 'Appointment confirmed successfully');
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const registerForEvent = async (req: Request, res: Response) => {
  try {
    const { user } = validateAuthenticatedUser(req);
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      throw new Error('Invalid event ID');
    }

    const registered = await plansService.registerParticipant(eventId, user._id);
    if (!registered) {
      throw new Error('Registration failed - may be already registered or event full');
    }

    successResponse(res, null, 'Successfully registered for event');
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

// Comments and attachments
export const addComment = async (req: Request, res: Response) => {
  try {
    const { user } = validateAuthenticatedUser(req);
    const { planId } = req.params;
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(planId)) {
      throw new Error('Invalid plan ID');
    }

    if (!text) {
      throw new Error('Comment text is required');
    }

    const commentId = await plansService.addComment(planId, text, user._id);
    successResponse(res, { commentId }, 'Comment added successfully');
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const addAttachment = async (req: Request, res: Response) => {
  try {
    const { user } = validateAuthenticatedUser(req);
    const { planId } = req.params;
    const { fileType, url, name } = req.body;

    if (!mongoose.Types.ObjectId.isValid(planId)) {
      throw new Error('Invalid plan ID');
    }

    if (!fileType || !url || !name) {
      throw new Error('File type, URL and name are required');
    }

    const attachmentId = await plansService.addAttachment(
      planId, 
      fileType, 
      url, 
      name, 
      user._id
    );
    successResponse(res, { attachmentId }, 'Attachment added successfully');
  } catch (error) {
    handleErrorResponse(error, res);
  }
};


export const likePlan = async (req: Request, res: Response) => {
  try {
    const { user } = validateAuthenticatedUser(req);
    const { planId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(planId)) {
      throw new Error('Invalid plan ID');
    }

    const liked = await plansService.likePlan(planId, user._id);
    successResponse(res, { liked }, 'Plan liked successfully');
  } catch (error) {
    handleErrorResponse(error, res);
  }
}


// // Bulk operations
// export const bulkUpdatePlans = async (req: Request, res: Response) => {
//   try {
//     const { user } = validateAuthenticatedUser(req);
//     const { planIds, updates } = req.body;

//     if (!Array.isArray(planIds) || planIds.some(id => !mongoose.Types.ObjectId.isValid(id))) {
//       throw new Error('Invalid plan IDs');
//     }

//     // Add updatedBy to all updates
//     const updatesWithUser = {
//       ...updates,
//       updatedBy: user._id
//     };

//     const results = await Promise.all(
//       planIds.map(id => 
//         plansService.updatePlan(id, updatesWithUser)
//           .catch((e: unknown) => ({ id, error: e instanceof Error ? e.message : 'Unknown error' }))
//       )
//     );
//     const successful = results.filter((r): r is { id: string; success: boolean; error?: string } => r !== null && typeof r === 'object' && 'success' in r && r.success === true);
//     const failed = results.filter((r): r is { id: string; error: string } => r !== null && 'error' in r && typeof r.error === 'string');

//     successResponse(res, { successful, failed }, 'Bulk update completed');
//   } catch (error) {
//     handleErrorResponse(error, res);
//   }
// };

// export const bulkDeletePlans = async (req: Request, res: Response) => {
//   try {
//     validateAuthenticatedUser(req);
//     const { planIds } = req.body;

//     if (!Array.isArray(planIds)) {
//       throw new Error('planIds must be an array');
//     }

//     const invalidIds = planIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
//     if (invalidIds.length > 0) {
//       throw new Error(`Invalid plan IDs: ${invalidIds.join(', ')}`);
//     }

//     const deleteResults: { id: string; success: boolean; error?: string }[] = await Promise.all(
//       planIds.map(id => 
//         plansService.deletePlan(id)
//           .then((deleted: boolean) => ({ id, success: !!deleted }))
//           .catch((e: Error) => ({ id, success: false, error: e.message }))
//       )
//     );

//     const successful = deleteResults.filter((r: { id: string; success: boolean; error?: string }) => r.success);
//     const failed = deleteResults.filter(r => !r.success);

//     successResponse(res, { successful, failed }, 'Bulk deletion completed');
//   } catch (error) {
//     handleErrorResponse(error, res);
//   }
// };