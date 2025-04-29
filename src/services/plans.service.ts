import { validate } from './../middleware/requestValidator';
import { Types } from 'mongoose';
import { AppointmentModel } from '../models/plans/appointment.schema';
import { CelebrationModel } from '../models/plans/celebration.schema';
import { EventModel } from '../models/plans/event.schema';
import { MeetingModel } from '../models/plans/meeting.schema';
import { TaskModel } from '../models/plans/task.schema';
import { PlanModel, PlanType } from '../models/plans/Plan';
import { PlanValidator } from '../validators/plan.validators';
import { InteractionMode } from '../models/plans/interaction.schema';
import { InteractionModel } from '../models/plans/interaction.schema';
import { InteractionCategory } from '../models/plans/interaction.schema';
import { IBooking } from '../models/plans/booking.schema';


class PlanService {
    private getModel(planType: PlanType) {
        switch (planType) {
            case PlanType.APPOINTMENT: return AppointmentModel;
            case PlanType.CELEBRATION: return CelebrationModel;
            case PlanType.EVENT: return EventModel;
            case PlanType.MEETING: return MeetingModel;
            case PlanType.TASK: return TaskModel;
            case PlanType.INTERACTION: return InteractionModel;
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

    async listPlans(
        filter: {
            // Common plan filters
            planType?: PlanType | PlanType[];
            createdBy?: string | Types.ObjectId;
            participants?: string | Types.ObjectId | Array<string | Types.ObjectId>;
            startTime?: {
                from?: Date;
                to?: Date;
            };
            endTime?: {
                from?: Date;
                to?: Date;
            };
            priority?: 'low' | 'medium' | 'high' | 'critical';
            status?: string;
            search?: string;
            color?: string;
            visibility?: 'public' | 'private' | 'selected';

            // Type-specific filters
            interaction?: {
                mode?: InteractionMode | InteractionMode[];
                category?: InteractionCategory | InteractionCategory[];
                profile?: string | Types.ObjectId;
                relationship?: string | Types.ObjectId;
                nextContact?: {
                    from?: Date;
                    to?: Date;
                };
            };
            appointment?: {
                serviceProvider?: string | Types.ObjectId;
                status?: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
            };
            event?: {
                isGroupEvent?: boolean;
                registrationRequired?: boolean;
                location?: {
                    online?: boolean;
                };
            };
            task?: {
                status?: 'upcoming' | 'in-progress' | 'completed' | 'cancelled';
                hasSubTasks?: boolean;
            };
            meeting?: {
                hasMinutes?: boolean;
                requiredAttendees?: string | Types.ObjectId;
            };

            booking?: {
                hasBookings?: boolean;
                status?: 'pending' | 'confirmed' | 'cancelled';
                fromDate?: Date;
                toDate?: Date;
            };
        } = {},
        options: {
            page?: number;
            limit?: number;
            sort?: Record<string, 1 | -1>;
            populate?: string[];
        } = {}
    ) {
        const {
            page = 1,
            limit = 10,
            sort = { startTime: 1 },
            populate = []
        } = options;

        const skip = (page - 1) * limit;

        // Build the base query
        const query: any = {};

        // Common plan filters
        if (filter.planType) {
            if (Array.isArray(filter.planType)) {
                query.planType = { $in: filter.planType };
            } else {
                query.planType = filter.planType;
            }
        }

        if (filter.createdBy) {
            query.createdBy = new Types.ObjectId(filter.createdBy);
        }

        if (filter.participants) {
            if (Array.isArray(filter.participants)) {
                query.participants = {
                    $in: filter.participants.map(id => new Types.ObjectId(id))
                };
            } else {
                query.participants = new Types.ObjectId(filter.participants);
            }
        }

        if (filter.startTime) {
            query.startTime = {};
            if (filter.startTime.from) query.startTime.$gte = new Date(filter.startTime.from);
            if (filter.startTime.to) query.startTime.$lte = new Date(filter.startTime.to);
        }

        if (filter.endTime) {
            query.endTime = {};
            if (filter.endTime.from) query.endTime.$gte = new Date(filter.endTime.from);
            if (filter.endTime.to) query.endTime.$lte = new Date(filter.endTime.to);
        }

        if (filter.priority) {
            query.priority = filter.priority;
        }

        if (filter.status) {
            query.status = filter.status;
        }

        if (filter.color) {
            query.color = filter.color;
        }

        if (filter.visibility) {
            query.visibility = filter.visibility;
        }

        if (filter.search) {
            query.$text = { $search: filter.search };
        }

        // Type-specific filters
        if (filter.interaction) {
            if (filter.interaction.mode) {
                if (Array.isArray(filter.interaction.mode)) {
                    query['mode'] = { $in: filter.interaction.mode };
                } else {
                    query['mode'] = filter.interaction.mode;
                }
            }

            if (filter.interaction.category) {
                if (Array.isArray(filter.interaction.category)) {
                    query['category'] = { $in: filter.interaction.category };
                } else {
                    query['category'] = filter.interaction.category;
                }
            }

            if (filter.interaction.profile) {
                query['profile'] = new Types.ObjectId(filter.interaction.profile);
            }

            if (filter.interaction.relationship) {
                query['relationship'] = new Types.ObjectId(filter.interaction.relationship);
            }

            if (filter.interaction.nextContact) {
                query['nextContact'] = {};
                if (filter.interaction.nextContact.from) {
                    query['nextContact'].$gte = new Date(filter.interaction.nextContact.from);
                }
                if (filter.interaction.nextContact.to) {
                    query['nextContact'].$lte = new Date(filter.interaction.nextContact.to);
                }
            }
        }

        if (filter.appointment) {
            if (filter.appointment.serviceProvider) {
                query['serviceProvider.profileId'] = new Types.ObjectId(filter.appointment.serviceProvider);
            }
            if (filter.appointment.status) {
                query['status'] = filter.appointment.status;
            }
        }

        if (filter.event) {
            if (filter.event.isGroupEvent !== undefined) {
                query['isGroupEvent'] = filter.event.isGroupEvent;
            }
            if (filter.event.registrationRequired !== undefined) {
                query['registrationRequired'] = filter.event.registrationRequired;
            }
            if (filter.event.location?.online !== undefined) {
                query['location.online'] = filter.event.location.online;
            }
        }

        if (filter.task) {
            if (filter.task.status) {
                query['status'] = filter.task.status;
            }
            if (filter.task.hasSubTasks !== undefined) {
                if (filter.task.hasSubTasks) {
                    query['subTasks.0'] = { $exists: true };
                } else {
                    query['subTasks'] = { $size: 0 };
                }
            }
        }

        if (filter.meeting) {
            if (filter.meeting.hasMinutes !== undefined) {
                if (filter.meeting.hasMinutes) {
                    query['minutes'] = { $exists: true, $ne: '' };
                } else {
                    query.$or = [
                        { minutes: { $exists: false } },
                        { minutes: '' }
                    ];
                }
            }
            if (filter.meeting.requiredAttendees) {
                query['requiredAttendees'] = new Types.ObjectId(filter.meeting.requiredAttendees);
            }
        }

        // Add booking filters
    if (filter.booking) {
        if (filter.booking.hasBookings !== undefined) {
            if (filter.booking.hasBookings) {
                query['bookings.0'] = { $exists: true };
            } else {
                query['bookings'] = { $size: 0 };
            }
        }

        if (filter.booking.status) {
            query['bookings.status'] = filter.booking.status;
        }

        if (filter.booking.fromDate || filter.booking.toDate) {
            query['bookings.slot.start'] = {};
            if (filter.booking.fromDate) {
                query['bookings.slot.start'].$gte = new Date(filter.booking.fromDate);
            }
            if (filter.booking.toDate) {
                query['bookings.slot.start'].$lte = new Date(filter.booking.toDate);
            }
        }
    }


        const [plans, total] = await Promise.all([
            PlanModel.find(query)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .populate(populate)
                .exec(),
            PlanModel.countDocuments(query)
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

    async logInteraction(
        profileId: string | Types.ObjectId,
        relationship: string,
        mode: InteractionMode,
        category: InteractionCategory,
        options: {
            title?: string;
            notes?: string;
            location?: {
                address?: string;
                coordinates?: { lat: number; lng: number };
            };
            nextContact?: Date;
            frequency?: string;
        } = {}
    ) {
        const interaction = new InteractionModel({
            title: options.title || `Interaction with ${relationship}`,
            profile: new Types.ObjectId(profileId),
            relationship,
            lastContact: new Date(),
            nextContact: options.nextContact,
            frequency: options.frequency,
            mode,
            category,
            physicalLocation: options.location,
            notes: options.notes,
            isAllDay: false,
            startTime: new Date(),
            participants: [new Types.ObjectId(profileId)],
            priority: 'medium',
            visibility: 'private'
        });

        await interaction.save();
        return interaction._id;
    }

    async updateInteractionContact(
        interactionId: string | Types.ObjectId,
        newContactDate: Date
    ): Promise<void> {
        await InteractionModel.findByIdAndUpdate(
            interactionId,
            {
                $set: {
                    lastContact: new Date(),
                    nextContact: newContactDate
                }
            },
            { new: true }
        ).exec();
    }

    async changeInteractionMode(
        interactionId: string | Types.ObjectId,
        newMode: InteractionMode
    ): Promise<void> {
        await InteractionModel.findByIdAndUpdate(
            interactionId,
            { $set: { mode: newMode } },
            { new: true }
        ).exec();
    }

    async getUpcomingInteractions(
        profileId: string | Types.ObjectId,
        daysAhead: number = 7
    ) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + daysAhead);

        return InteractionModel.find({
            profile: new Types.ObjectId(profileId),
            nextContact: { $lte: endDate }
        })
            .sort({ nextContact: 1 })
            .exec();
    }

    async getInteractionHistory(
        profileId: string | Types.ObjectId,
        daysBack: number = 30
    ) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        return InteractionModel.find({
            profile: new Types.ObjectId(profileId),
            lastContact: { $gte: startDate }
        })
            .sort({ lastContact: -1 })
            .exec();
    }

    async updateInteractionRelationship(
        interactionId: string | Types.ObjectId,
        newRelationship: string
    ): Promise<void> {
        await InteractionModel.findByIdAndUpdate(
            interactionId,
            { $set: { relationship: newRelationship } },
            { new: true }
        ).exec();
    }

    async createBooking(
        planId: string | Types.ObjectId,
        bookedBy: string | Types.ObjectId,
        startTime: Date,
        endTime: Date,
        options: {
            requireApproval?: boolean;
            paymentInfo?: {
                amount: number;
                currency?: string;
                gateway?: string;
            };
        } = {}
    ) {
        const plan = await PlanModel.findById(planId).exec();
        if (!plan) throw new Error('Plan not found');
    
        // Check if plan has booking settings
        if (!plan.bookingSettings) {
            throw new Error('This plan type does not support bookings');
        }
    
        // Convert to proper types
        const bookedById = new Types.ObjectId(bookedBy);
        const start = new Date(startTime);
        const end = new Date(endTime);
    
        // Validate time slot
        if (start >= end) {
            throw new Error('End time must be after start time');
        }
    
        // Check for conflicting bookings
        const hasConflict = plan.bookings?.some(booking => 
            !(end <= booking.slot.start || start >= booking.slot.end)
        );
    
        if (hasConflict) {
            throw new Error('The requested time slot is already booked');
        }
    
        // Create new booking
        const newBooking: IBooking = {
            _id: new Types.ObjectId(),
            bookedBy: bookedById,
            status: options.requireApproval ? 'pending' : 'confirmed',
            slot: {
                start,
                end,
                timeZone: plan.bookingSettings.timeZone || 'UTC'
            },
            payment: options.paymentInfo ? {
                required: false,
                status: 'pending',
                amount: options.paymentInfo.amount,
                currency: options.paymentInfo.currency || 'USD',
                gateway: options.paymentInfo.gateway
            } : {
                required: false,
                status: 'paid',
                amount: 0,
                currency: 'USD'
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };
    
        // Add to plan's bookings array
        if (!plan.bookings) plan.bookings = [];
        plan.bookings.push(newBooking);
    
        // Add to participants if not already there
        if (!plan.participants.includes(bookedById)) {
            plan.participants.push(bookedById);
        }
    
        await plan.save();
        return newBooking._id;
    }
    
    async confirmBooking(
        planId: string | Types.ObjectId,
        bookingId: string | Types.ObjectId,
        approvedBy: string | Types.ObjectId
    ) {
        return PlanModel.findOneAndUpdate(
            {
                _id: planId,
                'bookings._id': bookingId
            },
            {
                $set: {
                    'bookings.$.status': 'confirmed',
                    'bookings.$.approvedBy': new Types.ObjectId(approvedBy),
                    'bookings.$.updatedAt': new Date()
                }
            },
            { new: true }
        ).exec();
    }
    
    async cancelBooking(
        planId: string | Types.ObjectId,
        bookingId: string | Types.ObjectId,
        reason?: string
    ) {
        return PlanModel.findOneAndUpdate(
            {
                _id: planId,
                'bookings._id': bookingId
            },
            {
                $set: {
                    'bookings.$.status': 'cancelled',
                    'bookings.$.cancellationReason': reason,
                    'bookings.$.updatedAt': new Date()
                }
            },
            { new: true }
        ).exec();
    }
    
    async rescheduleBooking(
        planId: string | Types.ObjectId,
        bookingId: string | Types.ObjectId,
        newStartTime: Date,
        newEndTime: Date
    ) {
        const plan = await PlanModel.findById(planId).exec();
        if (!plan) throw new Error('Plan not found');
    
        const booking = plan.bookings?.find(b => b?._id?.equals(bookingId));
        if (!booking) throw new Error('Booking not found');
    
        // Check max reschedules
        const maxReschedules = plan.bookingSettings?.maxReschedules || 3;
        if ((booking.rescheduleCount || 0) >= maxReschedules) {
            throw new Error('Maximum reschedule limit reached');
        }
    
        // Check new slot availability
        const hasConflict = plan.bookings?.some(b => 
            b._id && !b._id.equals(bookingId) && // Exclude current booking
            !(newEndTime <= b.slot.start || newStartTime >= b.slot.end)
        );
    
        if (hasConflict) {
            throw new Error('The new time slot is not available');
        }
    
        // Update booking
        booking.slot.start = newStartTime;
        booking.slot.end = newEndTime;
        booking.status = 'rescheduled';
        booking.rescheduleCount = (booking.rescheduleCount || 0) + 1;
        booking.updatedAt = new Date();
    
        await plan.save();
        return booking._id;
    }
    
    async getAvailableSlots(
        planId: string | Types.ObjectId,
        date: Date,
        duration?: number // Optional override of plan's slotDuration
    ) {
        const plan = await PlanModel.findById(planId).exec();
        if (!plan || !plan.bookingSettings) {
            throw new Error('Plan not found or does not support bookings');
        }
    
        const day = date.getDay();
        const availability = plan.bookingSettings.availability.find(a => a.day === day);
        if (!availability) return [];
    
        const slotDuration = duration || plan.bookingSettings.slotDuration;
        const bufferTime = plan.bookingSettings.bufferTime || 0;
        const [startHour, startMin] = availability.startTime.split(':').map(Number);
        const [endHour, endMin] = availability.endTime.split(':').map(Number);
    
        const slots: Array<{start: Date, end: Date}> = [];
        let current = new Date(date);
        current.setHours(startHour, startMin, 0, 0);
    
        const endTime = new Date(date);
        endTime.setHours(endHour, endMin, 0, 0);
    
        while (current < endTime) {
            const slotEnd = new Date(current);
            slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);
    
            if (slotEnd <= endTime) {
                // Check if slot is available
                const isAvailable = !plan.bookings?.some(booking => 
                    !(slotEnd <= booking.slot.start || current >= booking.slot.end)
                );
    
                if (isAvailable) {
                    slots.push({
                        start: new Date(current),
                        end: new Date(slotEnd)
                    });
                }
            }
    
            current.setMinutes(current.getMinutes() + slotDuration + bufferTime);
        }
    
        return slots;
    }
    
    async getPlanBookings(
        planId: string | Types.ObjectId,
        filter: {
            status?: string;
            fromDate?: Date;
            toDate?: Date;
        } = {}
    ) {
        const plan = await PlanModel.findById(planId)
            .populate('bookings.bookedBy', 'name email avatar')
            .exec();
    
        if (!plan) throw new Error('Plan not found');
    
        if (!plan.bookings) return [];
    
        return plan.bookings.filter(booking => {
            if (filter.status && booking.status !== filter.status) return false;
            if (filter.fromDate && booking.slot.start < filter.fromDate) return false;
            if (filter.toDate && booking.slot.start > filter.toDate) return false;
            return true;
        });
    }
    
}


export default new PlanService();