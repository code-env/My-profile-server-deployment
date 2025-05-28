import { Types } from 'mongoose';
import taskService from './task.service';
import eventService from './event.service';
import listService from './list.service';
import { PriorityLevel, TaskCategory } from '../models/plans-shared';
import { TaskStatus } from '../models/plans-shared/enums';
import { ListType, ImportanceLevel } from '../models/List';

interface PlansFilter {
    status?: TaskStatus;
    priority?: PriorityLevel;
    category?: TaskCategory;
    search?: string;
    isAllDay?: boolean;
    profile?: string;
    fromDate?: Date;
    toDate?: Date;
    type?: 'Task' | 'Event' | 'List' | 'All';
    listType?: ListType;
    importance?: ImportanceLevel;
}

// Separate filter type for tasks to avoid Twilio conflict
interface TaskFilter {
    status?: any; // Using any to bypass Twilio's TaskStatus
    priority?: PriorityLevel;
    category?: TaskCategory;
    search?: string;
    isAllDay?: boolean;
    profile?: string;
    fromDate?: Date;
    toDate?: Date;
}

interface PlanItem {
    _id: Types.ObjectId;
    type: 'Task' | 'Event' | 'List';
    title: string;
    description?: string;
    startTime?: Date;
    endTime?: Date;
    isAllDay: boolean;
    priority: PriorityLevel;
    status: TaskStatus;
    category: TaskCategory;
    profile: Types.ObjectId;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
    [key: string]: any; // For additional fields specific to tasks, events, or lists
}

class PlansService {
    /**
     * Get all plans (tasks and events) with filters
     */
    async getPlans(userId: string, profileId: string, filters: PlansFilter = {}): Promise<PlanItem[]> {
        const query: any = { createdBy: userId };

        // Apply common filters
        if (filters.status) query.status = filters.status;
        if (filters.priority) query.priority = filters.priority;
        if (filters.category) query.category = filters.category;
        if (filters.isAllDay !== undefined) query.isAllDay = filters.isAllDay;
        if (filters.profile) query.profile = filters.profile;

        // Date range filtering
        if (filters.fromDate || filters.toDate) {
            query.$and = [];
            if (filters.fromDate) {
                query.$and.push({
                    $or: [
                        { startTime: { $gte: filters.fromDate } },
                        { endTime: { $gte: filters.fromDate } },
                        { 'repeat.nextRun': { $gte: filters.fromDate } }
                    ]
                });
            }
            if (filters.toDate) {
                query.$and.push({
                    $or: [
                        { startTime: { $lte: filters.toDate } },
                        { endTime: { $lte: filters.toDate } },
                        { 'repeat.nextRun': { $lte: filters.toDate } }
                    ]
                });
            }
        }

        // Search across multiple fields
        if (filters.search) {
            const searchRegex = new RegExp(filters.search, 'i');
            query.$or = [
                { title: searchRegex },
                { description: searchRegex },
                { notes: searchRegex },
            ];
        }

        // Fetch tasks, events, and lists based on type filter
        const tasksPromise = filters.type !== 'Event' && filters.type !== 'List' 
            ? taskService.getUserTasks(userId, profileId, filters as TaskFilter)
            : Promise.resolve({ tasks: [], pagination: { page: 1, limit: 20, total: 0, pages: 0, hasNext: false, hasPrev: false } });
        
        const eventsPromise = filters.type !== 'Task' && filters.type !== 'List' 
            ? eventService.getUserEvents(userId, profileId, filters).then(result => result.events)
            : Promise.resolve([]);
        
        const listsPromise = filters.type !== 'Task' && filters.type !== 'Event' 
            ? listService.getUserLists(userId, {
                type: filters.listType,
                importance: filters.importance,
                search: filters.search
            }) 
            : Promise.resolve([]);

        const [tasksResult, events, lists] = await Promise.all([
            tasksPromise,
            eventsPromise,
            listsPromise
        ]);

        // Extract tasks array from the result
        const tasks = tasksResult.tasks || [];

        // Combine and sort results
        const allPlans = [
            ...tasks.map((task: any) => ({
                _id: task._id as Types.ObjectId,
                type: 'Task' as const,
                title: task.title,
                description: task.description,
                startTime: task.startTime,
                endTime: task.endTime,
                isAllDay: task.isAllDay,
                priority: task.priority,
                status: task.status,
                category: task.category,
                profile: task.profile as Types.ObjectId,
                createdBy: task.createdBy as Types.ObjectId,
                createdAt: task.createdAt,
                updatedAt: task.updatedAt
            })),
            ...events.map(event => ({
                _id: event._id as Types.ObjectId,
                type: 'Event' as const,
                title: event.title,
                description: event.description,
                startTime: event.startTime,
                endTime: event.endTime,
                isAllDay: event.isAllDay,
                priority: event.priority,
                status: event.status as any,
                category: event.category as TaskCategory,
                profile: event.profile as Types.ObjectId,
                createdBy: event.createdBy as Types.ObjectId,
                createdAt: event.createdAt || new Date(),
                updatedAt: event.updatedAt || new Date()
            })),
            ...lists.map(list => ({
                _id: list._id as Types.ObjectId,
                type: 'List' as const,
                title: list.name,
                description: list.notes,
                priority: list.importance as unknown as PriorityLevel,
                status: 'Upcoming' as TaskStatus,
                category: 'Personal' as TaskCategory,
                profile: list.profile as Types.ObjectId,
                createdBy: list.createdBy as Types.ObjectId,
                createdAt: list.createdAt,
                updatedAt: list.updatedAt,
                items: list.items,
                listType: list.type,
                isAllDay: false,
                startTime: undefined,
                endTime: undefined
            }))
        ];

        // Sort by priority, then start time
        return allPlans.sort((a, b) => {
            // First by priority
            const priorityOrder: { [key: string]: number } = { High: 0, Medium: 1, Low: 2 };
            const aPriority = a.priority as string;
            const bPriority = b.priority as string;
            const priorityDiff = priorityOrder[aPriority] - priorityOrder[bPriority];
            if (priorityDiff !== 0) return priorityDiff;

            // Then by start time
            if (a.startTime && b.startTime) {
                return a.startTime.getTime() - b.startTime.getTime();
            }
            return 0;
        });
    }

    /**
     * Get a single plan item by ID
     */
    async getPlanById(planId: string, type: 'Task' | 'Event' | 'List'): Promise<PlanItem | null> {
        if (type === 'Task') {
            const task = await taskService.getTaskById(planId);
            return task ? {
                _id: task._id as Types.ObjectId,
                type: 'Task' as const,
                title: task.title,
                description: task.description,
                startTime: task.startTime,
                endTime: task.endTime,
                isAllDay: task.isAllDay,
                priority: task.priority,
                status: task.status,
                category: task.category,
                profile: task.profile as Types.ObjectId,
                createdBy: task.createdBy as Types.ObjectId,
                createdAt: task.createdAt,
                updatedAt: task.updatedAt
            } : null;
        } else if (type === 'Event') {
            const event = await eventService.getEventById(planId);
            return event ? {
                _id: event._id as Types.ObjectId,
                type: 'Event' as const,
                title: event.title,
                description: event.description,
                startTime: event.startTime,
                endTime: event.endTime,
                isAllDay: event.isAllDay,
                priority: event.priority,
                status: event.status as any,
                category: event.category as TaskCategory,
                profile: event.profile as Types.ObjectId,
                createdBy: event.createdBy as Types.ObjectId,
                createdAt: event.createdAt || new Date(),
                updatedAt: event.updatedAt || new Date()
            } : null;
        } else {
            const list = await listService.getListById(planId);
            return list ? {
                _id: list._id as Types.ObjectId,
                type: 'List' as const,
                title: list.name,
                description: list.notes,
                priority: list.importance as unknown as PriorityLevel,
                status: 'Upcoming' as TaskStatus,
                category: 'Personal' as TaskCategory,
                profile: list.profile as Types.ObjectId,
                createdBy: list.createdBy as Types.ObjectId,
                createdAt: list.createdAt,
                updatedAt: list.updatedAt,
                items: list.items,
                listType: list.type,
                isAllDay: false,
                startTime: undefined,
                endTime: undefined
            } : null;
        }
    }
}

export default new PlansService(); 