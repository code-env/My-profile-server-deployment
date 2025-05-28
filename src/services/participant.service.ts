import { Event } from '../models/Event';
import { IEvent, IParticipant } from '../models/Event';
import { NotificationService } from './notification.service';
import mongoose from 'mongoose';

class ParticipantService {
    private notificationService: NotificationService;

    constructor() {
        this.notificationService = new NotificationService();
    }

    /**
     * Add participants to an event
     */
    async addParticipants(
        eventId: string,
        userId: string,
        profileIds: string[],
        role: 'attendee' | 'organizer' | 'speaker' = 'attendee'
    ): Promise<IEvent> {
        const event = await Event.findOne({ _id: eventId, createdBy: userId });
        if (!event) {
            throw new Error('Event not found or access denied');
        }

        // Check if adding participants would exceed max attendees
        if (event.maxAttendees && (event.participants.length + profileIds.length) > event.maxAttendees) {
            throw new Error('Adding these participants would exceed the maximum number of attendees');
        }

        // Add participants with their roles
        const newParticipants: IParticipant[] = profileIds.map(profileId => ({
            profile: new mongoose.Types.ObjectId(profileId),
            role,
            status: 'pending' as const,
            joinedAt: null
        }));

        event.participants.push(...newParticipants);
        await event.save();

        // Send invitations to new participants
        await this.sendInvitations(event, newParticipants);

        return event;
    }

    /**
     * Update participant status
     */
    async updateParticipantStatus(
        eventId: string,
        profileId: string,
        status: 'pending' | 'accepted' | 'declined' | 'maybe'
    ): Promise<IEvent> {
        const event = await Event.findById(eventId);
        if (!event) {
            throw new Error('Event not found');
        }

        const participant = event.participants.find(p => p.profile.toString() === profileId);
        if (!participant) {
            throw new Error('Participant not found');
        }

        participant.status = status;
        if (status === 'accepted') {
            participant.joinedAt = new Date();
        }

        await event.save();

        // Notify event creator about status change
        await this.notifyStatusChange(event, profileId, status);

        return event;
    }

    /**
     * Remove participant from event
     */
    async removeParticipant(
        eventId: string,
        userId: string,
        profileId: string
    ): Promise<IEvent> {
        const event = await Event.findOne({ _id: eventId, createdBy: userId });
        if (!event) {
            throw new Error('Event not found or access denied');
        }

        const participantIndex = event.participants.findIndex(p => p.profile.toString() === profileId);
        if (participantIndex === -1) {
            throw new Error('Participant not found');
        }

        event.participants.splice(participantIndex, 1);
        await event.save();

        // Notify removed participant
        await this.notifyParticipantRemoved(event, profileId);

        return event;
    }

    /**
     * Get all participants for an event
     */
    async getEventParticipants(
        eventId: string,
        filters: {
            status?: 'pending' | 'accepted' | 'declined' | 'maybe';
            role?: 'attendee' | 'organizer' | 'speaker';
        } = {}
    ): Promise<any[]> {
        const event = await Event.findById(eventId)
            .populate('participants.profile', 'profileInformation.username profileType')
            .lean();

        if (!event) {
            throw new Error('Event not found');
        }

        let participants = event.participants;

        // Apply filters
        if (filters.status) {
            participants = participants.filter(p => p.status === filters.status);
        }
        if (filters.role) {
            participants = participants.filter(p => p.role === filters.role);
        }

        return participants;
    }

    /**
     * Update participant role
     */
    async updateParticipantRole(
        eventId: string,
        userId: string,
        profileId: string,
        newRole: 'attendee' | 'organizer' | 'speaker'
    ): Promise<IEvent> {
        const event = await Event.findOne({ _id: eventId, createdBy: userId });
        if (!event) {
            throw new Error('Event not found or access denied');
        }

        const participant = event.participants.find(p => p.profile.toString() === profileId);
        if (!participant) {
            throw new Error('Participant not found');
        }

        participant.role = newRole;
        await event.save();

        // Notify participant about role change
        await this.notifyRoleChange(event, profileId, newRole);

        return event;
    }

    /**
     * Send invitations to participants
     */
    private async sendInvitations(event: IEvent, participants: IParticipant[]): Promise<void> {
        for (const participant of participants) {
            await this.notificationService.createNotification({
                recipient: participant.profile,
                type: 'event_invitation',
                title: `Invitation to ${event.title}`,
                message: `You have been invited to ${event.title}`,
                relatedTo: {
                    model: 'Event',
                    id: event._id
                },
                priority: 'high',
                isRead: false,
                isArchived: false,
                metadata: {
                    eventId: event._id,
                    eventTitle: event.title,
                    startTime: event.startTime,
                    role: participant.role
                }
            });
        }
    }

    /**
     * Notify about participant status change
     */
    private async notifyStatusChange(
        event: IEvent,
        profileId: string,
        status: string
    ): Promise<void> {
        // Notify event creator
        await this.notificationService.createNotification({
            recipient: event.createdBy,
            type: 'participant_status',
            title: 'Participant Status Update',
            message: `A participant has ${status} your event "${event.title}"`,
            relatedTo: {
                model: 'Event',
                id: event._id
            },
            priority: 'medium',
            isRead: false,
            isArchived: false,
            metadata: {
                eventId: event._id,
                eventTitle: event.title,
                profileId,
                status
            }
        });
    }

    /**
     * Notify about participant removal
     */
    private async notifyParticipantRemoved(event: IEvent, profileId: string): Promise<void> {
        await this.notificationService.createNotification({
            recipient: new mongoose.Types.ObjectId(profileId),
            type: 'event_removal',
            title: 'Removed from Event',
            message: `You have been removed from "${event.title}"`,
            relatedTo: {
                model: 'Event',
                id: event._id
            },
            priority: 'high',
            isRead: false,
            isArchived: false,
            metadata: {
                eventId: event._id,
                eventTitle: event.title
            }
        });
    }

    /**
     * Notify about role change
     */
    private async notifyRoleChange(
        event: IEvent,
        profileId: string,
        newRole: string
    ): Promise<void> {
        await this.notificationService.createNotification({
            recipient: new mongoose.Types.ObjectId(profileId),
            type: 'role_change',
            title: 'Role Update',
            message: `Your role in "${event.title}" has been changed to ${newRole}`,
            relatedTo: {
                model: 'Event',
                id: event._id
            },
            priority: 'medium',
            isRead: false,
            isArchived: false,
            metadata: {
                eventId: event._id,
                eventTitle: event.title,
                newRole
            }
        });
    }
}

export default new ParticipantService(); 