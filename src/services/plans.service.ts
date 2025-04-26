import { validate } from './../middleware/requestValidator';
import { Types } from 'mongoose';
import { AppointmentModel } from '../models/plans/appointment.schema';
import { CelebrationModel } from '../models/plans/celebration.schema';
import { EventModel } from '../models/plans/event.schema';
import { MeetingModel } from '../models/plans/meeting.schema';
import { TaskModel } from '../models/plans/task.schema';
import  { PlanModel, PlanType } from '../models/plans/Plan';
import { PlanValidator } from '../validators/plan.validators';


class PlanService {
    private getModel(planType: PlanType) {
        switch (planType) {
          case PlanType.APPOINTMENT: return AppointmentModel;
          case PlanType.CELEBRATION: return CelebrationModel;
          case PlanType.EVENT: return EventModel;
          case PlanType.MEETING: return MeetingModel;
          case PlanType.TASK: return TaskModel;
          default: throw new Error(`Invalid plan type: ${planType}`);
        }
      }
    
      async validatePlan(planType: PlanType, data: any, isPartial: boolean = false) {
        if (isPartial) {
          return PlanValidator.validatePartialPlan(planType, data);
        }
        return PlanValidator.validatePlan(planType, data);
      }
    

    async createPlan(planType: PlanType, planData: any) {
        // Validate input
        const { error, value } = await this.validatePlan(planType, planData);
        if (error) {
            throw new Error(`Validation failed: ${error.details.map((d: { message: string }) => d.message).join(', ')}`);
        }

        // Create and save plan
        const Model = this.getModel(planType);
        const plan = new Model(value);
        return await plan.save();
    }

    async getPlanById(planId: string | Types.ObjectId) {
        return await PlanModel.findById(planId).exec();
    }

    async updatePlan(planId: string | Types.ObjectId, updateData: any) {
        // First get the existing plan to determine its type
        const existingPlan = await PlanModel.findById(planId).exec();
        if (!existingPlan) {
            throw new Error('Plan not found');
        }

        // Validate against the appropriate schema
        const { error, value } = await this.validatePlan(
            existingPlan.planType as PlanType,
            updateData
        );

        if (error) {
            throw new Error(`Validation failed: ${error.details.map(d => d.message).join(', ')}`);
        }

        // Update the plan
        return await PlanModel.findByIdAndUpdate(
            planId,
            { $set: value },
            { new: true }
        ).exec();
    }

    async deletePlan(planId: string | Types.ObjectId) {
        return await PlanModel.findByIdAndDelete(planId).exec();
    }

    async listPlans(filter: any = {}, options: {
        page?: number;
        limit?: number;
        sort?: any;
    } = {}) {
        const { page = 1, limit = 10, sort = { startTime: 1 } } = options;
        const skip = (page - 1) * limit;

        const [plans, total] = await Promise.all([
            PlanModel.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .exec(),
            PlanModel.countDocuments(filter)
        ]);

        return {
            plans,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    // Type-specific methods with proper typing
    async addSubTask(taskId: string | Types.ObjectId, description: string) {
        const task = await TaskModel.findById(taskId).exec();
        if (!task) throw new Error('Task not found');

        const subTask = {
            _id: new Types.ObjectId(),
            description,
            completed: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        task.subTasks.push(subTask);
        await task.save();
        return subTask._id;
    }



    // Similar methods for other plan types...
    async addAgendaItem(meetingId: string | Types.ObjectId, title: string, order: number, description?: string) {
        const meeting = await MeetingModel.findById(meetingId).exec();
        if (!meeting) throw new Error('Meeting not found');

        const agendaItem = {
            _id: new Types.ObjectId(),
            title,
            order,
            description: description || '',
            completed: false
        };

        meeting.agenda.push(agendaItem);
        await meeting.save();
        return agendaItem._id;
    }

    async recordDecision(meetingId: string | Types.ObjectId, description: string, agreedBy: (string | Types.ObjectId)[]) {
        const meeting = await MeetingModel.findById(meetingId).exec();
        if (!meeting) throw new Error('Meeting not found');

        const decision = {
            _id: new Types.ObjectId(),
            description,
            agreedBy: agreedBy.map(id => new Types.ObjectId(id))
        };

        meeting.decisions.push(decision);
        await meeting.save();
        return decision._id;
    }


    async toggleSubTask(taskId: string | Types.ObjectId, subTaskId: string | Types.ObjectId) {
        const task = await TaskModel.findById(taskId).exec();
        if (!task) throw new Error('Task not found');

        const subTask = task.subTasks.find(subTask => subTask._id.equals(subTaskId));
        if (!subTask) throw new Error('Subtask not found');

        subTask.completed = !subTask.completed;
        subTask.updatedAt = new Date();
        await task.save();
        return subTask.completed;
    }

    async updateSubTask(
        taskId: string | Types.ObjectId,
        subTaskId: string | Types.ObjectId,
        update: { description?: string; completed?: boolean }
    ): Promise<void> {
        const task = await TaskModel.findById(taskId).exec();
        if (!task) throw new Error('Task not found');

        const subTask = task.subTasks.find(subTask => subTask._id.equals(subTaskId));
        if (!subTask) throw new Error('Subtask not found');

        if (update.description) subTask.description = update.description;
        if (update.completed !== undefined) subTask.completed = update.completed;
        subTask.updatedAt = new Date();

        await task.save();
    }


    async toggleAgendaItem(
        meetingId: string | Types.ObjectId,
        agendaItemId: string | Types.ObjectId
    ): Promise<boolean> {
        const meeting = await MeetingModel.findById(meetingId).exec();
        if (!meeting) throw new Error('Meeting not found');

        const agendaItem = meeting.agenda.find(item => item._id.equals(agendaItemId));
        if (!agendaItem) throw new Error('Agenda item not found');

        agendaItem.completed = !agendaItem.completed;
        await meeting.save();
        return agendaItem.completed;
    }

    async updateMeetingMinutes(
        meetingId: string | Types.ObjectId,
        minutes: string
    ): Promise<void> {
        await MeetingModel.findByIdAndUpdate(
            meetingId,
            { $set: { minutes } },
            { new: true }
        ).exec();
    }

    // ========== APPOINTMENT METHODS ==========
    async confirmAppointment(appointmentId: string | Types.ObjectId): Promise<void> {
        await AppointmentModel.findByIdAndUpdate(
            appointmentId,
            { $set: { status: 'confirmed' } },
            { new: true }
        ).exec();
    }

    async addPreparationItem(
        appointmentId: string | Types.ObjectId,
        description: string
    ): Promise<Types.ObjectId> {
        const appointment = await AppointmentModel.findById(appointmentId).exec();
        if (!appointment) throw new Error('Appointment not found');

        const item = {
            _id: new Types.ObjectId(),
            description,
            completed: false
        };

        appointment.preparationItems.push(item);
        await appointment.save();
        return item._id;
    }

    async togglePreparationItem(
        appointmentId: string | Types.ObjectId,
        itemId: string | Types.ObjectId
    ): Promise<boolean> {
        const appointment = await AppointmentModel.findById(appointmentId).exec();
        if (!appointment) throw new Error('Appointment not found');

        const item = appointment.preparationItems.find(item => item._id.equals(itemId));
        if (!item) throw new Error('Preparation item not found');

        item.completed = !item.completed;
        await appointment.save();
        return item.completed;
    }

    async updateAppointmentStatus(
        appointmentId: string | Types.ObjectId,
        status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show'
    ): Promise<void> {
        await AppointmentModel.findByIdAndUpdate(
            appointmentId,
            { $set: { status } },
            { new: true }
        ).exec();
    }

    // ========== EVENT METHODS ==========
    async registerParticipant(
        eventId: string | Types.ObjectId,
        profileId: string | Types.ObjectId
    ): Promise<boolean> {
        const event = await EventModel.findById(eventId).exec();
        if (!event) throw new Error('Event not found');

        const participantId = new Types.ObjectId(profileId);

        // Check if already registered
        if (event.participants.includes(participantId)) {
            return false;
        }

        // Check capacity if maxAttendees is set
        if (event.maxAttendees && event.participants.length >= event.maxAttendees) {
            return false;
        }

        event.participants.push(participantId);
        await event.save();
        return true;
    }

    async unregisterParticipant(
        eventId: string | Types.ObjectId,
        profileId: string | Types.ObjectId
    ): Promise<boolean> {
        const event = await EventModel.findById(eventId).exec();
        if (!event) throw new Error('Event not found');

        const participantId = new Types.ObjectId(profileId);
        const index = event.participants.indexOf(participantId);

        if (index === -1) return false;

        event.participants.splice(index, 1);
        await event.save();
        return true;
    }

    async updateEventLocation(
        eventId: string | Types.ObjectId,
        location: {
            name?: string;
            address?: string;
            coordinates?: { lat: number; lng: number };
            online: boolean;
            meetingUrl?: string;
        }
    ): Promise<void> {
        await EventModel.findByIdAndUpdate(
            eventId,
            { $set: { location } },
            { new: true }
        ).exec();
    }

    // ========== CELEBRATION METHODS ==========
    async addGift(
        celebrationId: string | Types.ObjectId,
        description: string,
        requestedBy?: string | Types.ObjectId
    ): Promise<Types.ObjectId> {
        const celebration = await CelebrationModel.findById(celebrationId).exec();
        if (!celebration) throw new Error('Celebration not found');

        const gift = {
            _id: new Types.ObjectId(),
            description,
            requestedBy: requestedBy ? new Types.ObjectId(requestedBy) : undefined,
            received: false
        };

        celebration.gifts.push(gift);
        await celebration.save();
        return gift._id;
    }

    async markGiftReceived(
        celebrationId: string | Types.ObjectId,
        giftId: string | Types.ObjectId
    ): Promise<boolean> {
        const celebration = await CelebrationModel.findById(celebrationId).exec();
        if (!celebration) throw new Error('Celebration not found');

        const gift = celebration.gifts.find(g => g._id.equals(giftId));
        if (!gift) throw new Error('Gift not found');

        gift.received = true;
        await celebration.save();
        return true;
    }

    async addSocialMediaPost(
        celebrationId: string | Types.ObjectId,
        platform: string,
        postId: string,
        url: string
    ): Promise<void> {
        await CelebrationModel.findByIdAndUpdate(
            celebrationId,
            {
                $push: {
                    socialMediaPosts: {
                        platform,
                        postId,
                        url
                    }
                }
            },
            { new: true }
        ).exec();
    }

    async updateCelebrationStatus(
        celebrationId: string | Types.ObjectId,
        status: 'planning' | 'upcoming' | 'completed' | 'cancelled'
    ): Promise<void> {
        await CelebrationModel.findByIdAndUpdate(
            celebrationId,
            { $set: { status } },
            { new: true }
        ).exec();
    }

    // ========== COMMON PLAN METHODS ==========
    async addComment(
        planId: string | Types.ObjectId,
        text: string,
        postedBy: string | Types.ObjectId
    ): Promise<Types.ObjectId> {
        const comment = {
            _id: new Types.ObjectId(),
            text,
            postedBy: new Types.ObjectId(postedBy),
            postedAt: new Date()
        };

        await PlanModel.findByIdAndUpdate(
            planId,
            { $push: { comments: comment } },
            { new: true }
        ).exec();

        return comment._id;
    }

    async addReplyToComment(
        planId: string | Types.ObjectId,
        commentId: string | Types.ObjectId,
        text: string,
        postedBy: string | Types.ObjectId
    ): Promise<Types.ObjectId> {
        const reply = {
            _id: new Types.ObjectId(),
            text,
            postedBy: new Types.ObjectId(postedBy),
            postedAt: new Date()
        };

        await PlanModel.findByIdAndUpdate(
            planId,
            {
                $push: {
                    'comments.$[comment].replies': reply
                }
            },
            {
                new: true,
                arrayFilters: [{ 'comment._id': new Types.ObjectId(commentId) }]
            }
        ).exec();

        return reply._id;
    }

    async addAttachment(
        planId: string | Types.ObjectId,
        fileType: string,
        url: string,
        name: string,
        uploadedBy: string | Types.ObjectId
    ): Promise<Types.ObjectId> {
        const attachment = {
            _id: new Types.ObjectId(),
            fileType,
            url,
            name,
            uploadedBy: new Types.ObjectId(uploadedBy),
            uploadedAt: new Date()
        };

        await PlanModel.findByIdAndUpdate(
            planId,
            { $push: { attachments: attachment } },
            { new: true }
        ).exec();

        return attachment._id;
    }

    async likePlan(
        planId: string | Types.ObjectId,
        userId: string | Types.ObjectId
    ): Promise<Types.ObjectId> {
        const like = {
            _id: new Types.ObjectId(),
            userId: new Types.ObjectId(userId),
            createdAt: new Date()
        };

        await PlanModel.findByIdAndUpdate(
            planId,
            { $push: { likes: like } },
            { new: true }
        ).exec();

        return like._id;
    }
}

export default new PlanService();