import { SettingsService } from '../services/settings.service';
import { IEvent } from '../models/Event';
import { SettingsDocument } from '../models/settings';
import { Types } from 'mongoose';

/**
 * Utility functions for integrating event settings with user settings
 */
export class EventSettingsIntegration {
    private settingsService = new SettingsService();

    /**
     * Apply user's default settings to a new event
     */
    async applyUserDefaultsToEvent(userId: string, eventData: Partial<IEvent>): Promise<Partial<IEvent>> {
        const userSettings = await this.settingsService.getSettings(userId);
        
        if (!userSettings) {
            return eventData;
        }

        const enhancedEventData = { ...eventData };

        // Apply time zone and duration settings
        if (userSettings.general?.time) {
            const timeSettings = userSettings.general.time;
            
            if (!enhancedEventData.settings) {
                enhancedEventData.settings = {};
            }

            if (!enhancedEventData.settings.timeSettings) {
                enhancedEventData.settings.timeSettings = {
                    useUserTimezone: true,
                    bufferTime: timeSettings.bufferTimeMinutes || 15,
                    defaultDuration: timeSettings.slotDurationMinutes || 60
                };
            }

            // Apply default duration if not specified
            if (!enhancedEventData.duration && timeSettings.slotDurationMinutes) {
                enhancedEventData.duration = {
                    hours: Math.floor(timeSettings.slotDurationMinutes / 60),
                    minutes: timeSettings.slotDurationMinutes % 60
                };
            }
        }

        // Apply privacy/visibility settings for calendar events - only if not explicitly provided
        if (userSettings.privacy?.Visibility?.engagement?.calender) { // Note: keeping the typo from the model
            const calendarVisibility = userSettings.privacy.Visibility.engagement.calender;
            
            if (!enhancedEventData.settings) {
                enhancedEventData.settings = {};
            }

            // Only apply user's default visibility if no explicit visibility was provided
            if (!enhancedEventData.settings.visibility) {
                enhancedEventData.settings.visibility = {
                    level: calendarVisibility.level || 'ConnectionsOnly',
                    customUsers: calendarVisibility.customUsers?.map(id => new Types.ObjectId(id)) || []
                };
            } else if (!enhancedEventData.settings.visibility.level) {
                // If visibility object exists but level is not set, apply user's default
                enhancedEventData.settings.visibility.level = calendarVisibility.level || 'ConnectionsOnly';
            }
            // If visibility.level is explicitly set, preserve it and don't override
        }

        // Apply notification preferences
        if (userSettings.notifications?.calendar) {
            const calendarNotifications = userSettings.notifications.calendar;
            
            if (!enhancedEventData.settings) {
                enhancedEventData.settings = {};
            }

            if (!enhancedEventData.settings.notifications) {
                enhancedEventData.settings.notifications = {
                    enabled: true,
                    channels: {
                        push: calendarNotifications.reminder?.push !== false,
                        text: calendarNotifications.reminder?.text === true,
                        inApp: calendarNotifications.reminder?.inApp !== false,
                        email: calendarNotifications.reminder?.email === true
                    },
                    reminderSettings: {
                        defaultReminders: [15, 60], // 15 min and 1 hour before
                        allowCustomReminders: true
                    }
                };
            }
        }

        // Apply booking-specific settings if this is a booking event
        if (eventData.eventType === 'booking' && userSettings.general?.time) {
            if (!enhancedEventData.settings) {
                enhancedEventData.settings = {};
            }

            if (!enhancedEventData.settings.booking) {
                enhancedEventData.settings.booking = {
                    allowRescheduling: true,
                    maxReschedules: 3,
                    cancellationWindow: 24, // hours before event
                    requireApproval: false,
                    autoConfirm: false
                };
            }
        }

        // Apply celebration-specific settings if this is a celebration event
        if (eventData.eventType === 'celebration') {
            if (!enhancedEventData.settings) {
                enhancedEventData.settings = {};
            }

            if (!enhancedEventData.settings.celebration) {
                enhancedEventData.settings.celebration = {
                    allowGiftRequests: true,
                    allowSocialSharing: true,
                    autoCreatePhotoAlbum: true
                };
            }
        }

        // Apply general behavior settings
        if (userSettings.general?.behaviorAndAlerts) {
            const behaviorSettings = userSettings.general.behaviorAndAlerts;
            
            if (!enhancedEventData.settings) {
                enhancedEventData.settings = {};
            }

            if (!enhancedEventData.settings.notifications) {
                enhancedEventData.settings.notifications = {
                    enabled: true,
                    channels: {
                        push: true,
                        text: false,
                        inApp: true,
                        email: false
                    }
                };
            }

            // Override notification settings based on user's behavior preferences
            if (!behaviorSettings.soundsEnabled) {
                enhancedEventData.settings.notifications.channels.push = false;
            }
        }

        // Apply privacy settings for interactions
        if (userSettings.privacy?.permissions) {
            if (!enhancedEventData.settings) {
                enhancedEventData.settings = {};
            }

            if (!enhancedEventData.settings.privacy) {
                enhancedEventData.settings.privacy = {
                    allowComments: userSettings.privacy.permissions.chatWithMe?.level !== 'NoOne',
                    allowLikes: true,
                    allowParticipants: userSettings.privacy.permissions.request?.level !== 'NoOne',
                    shareWithConnections: userSettings.privacy.permissions.share?.level === 'ConnectionsOnly' || userSettings.privacy.permissions.share?.level === 'Public',
                    requireApprovalToJoin: userSettings.privacy.permissions.request?.level === 'Custom'
                };
            }
        }

        return enhancedEventData;
    }

    /**
     * Check if an event is visible to a specific profile
     */
    async isEventVisibleToProfile(event: IEvent, viewerProfileId: string, eventOwnerSettings?: SettingsDocument | null): Promise<boolean> {
        // If the event belongs to the viewer's profile, always show it
        if (event.profile?.toString() === viewerProfileId) {
            return true;
        }

        // Check event-specific visibility settings first
        if (event.settings?.visibility) {
            const visibility = event.settings.visibility;
            
            switch (visibility.level) {
                case 'Public':
                    return true;
                case 'OnlyMe':
                    return false;
                case 'ConnectionsOnly':
                    // Would need to check if profiles are connected
                    // For now, return false - this would be implemented with a connection service
                    return false;
                case 'Custom':
                    // Check if the viewer's profile is in the custom list
                    return visibility.customUsers?.some(userId => userId.toString() === viewerProfileId) || false;
                default:
                    return false;
            }
        }

        // Fall back to event owner's general calendar visibility settings
        if (!eventOwnerSettings) {
            // Get settings using the user ID (createdBy), not profile ID
            eventOwnerSettings = await this.settingsService.getSettings(event.createdBy.toString());
        }

        if (eventOwnerSettings?.privacy?.Visibility?.engagement?.calender) { // Note: keeping the typo from the model
            const calendarVisibility = eventOwnerSettings.privacy.Visibility.engagement.calender;
            
            switch (calendarVisibility.level) {
                case 'Public':
                    return true;
                case 'OnlyMe':
                    return false;
                case 'ConnectionsOnly':
                    // Would need to check if profiles are connected
                    return false;
                case 'Custom':
                    // Check if the viewer's profile is in the custom list
                    return calendarVisibility.customUsers?.includes(viewerProfileId) || false;
                default:
                    return false;
            }
        }

        // Default to public if no settings found
        return event.visibility === 'Public';
    }

    /**
     * Get notification preferences for an event based on user settings
     */
    async getEventNotificationPreferences(userId: string, eventId?: string): Promise<{
        enabled: boolean;
        channels: {
            push: boolean;
            text: boolean;
            inApp: boolean;
            email: boolean;
        };
        reminderDefaults: number[];
    }> {
        const userSettings = await this.settingsService.getSettings(userId);
        
        const defaults = {
            enabled: true,
            channels: {
                push: true,
                text: false,
                inApp: true,
                email: false
            },
            reminderDefaults: [15, 60] // 15 minutes and 1 hour before
        };

        if (!userSettings) {
            return defaults;
        }

        // Apply user's calendar notification settings
        if (userSettings.notifications?.calendar?.reminder) {
            const reminderSettings = userSettings.notifications.calendar.reminder;
            defaults.channels = {
                push: reminderSettings.push !== false,
                text: reminderSettings.text === true,
                inApp: reminderSettings.inApp !== false,
                email: reminderSettings.email === true
            };
        }

        // Apply general notification settings
        if (userSettings.notifications?.general) {
            const generalSettings = userSettings.notifications.general;
            defaults.enabled = generalSettings.allNotifications !== false;
        }

        return defaults;
    }

    /**
     * Apply privacy filtering to events based on user settings
     */
    async applyPrivacyFiltering(events: IEvent[], viewerProfileId: string, requestingUserId?: string): Promise<IEvent[]> {
        const filteredEvents: IEvent[] = [];

        for (const event of events) {
            // Always include events created by the requesting user or associated with their profile
            const isOwnEvent = event.createdBy.toString() === requestingUserId || event.profile?.toString() === viewerProfileId;
            
            if (isOwnEvent) {
                filteredEvents.push(event);
                continue;
            }

            // Check visibility for other events
            const isVisible = await this.isEventVisibleToProfile(event, viewerProfileId);
            if (isVisible) {
                filteredEvents.push(event);
            }
        }

        return filteredEvents;
    }

    /**
     * Format event time for user based on their timezone and format preferences
     */
    async formatEventTimeForUser(event: IEvent, userId: string): Promise<{
        startTime?: string;
        endTime?: string;
        duration?: string;
        timezone?: string;
    }> {
        const userSettings = await this.settingsService.getSettings(userId);
        
        const result: any = {};

        if (userSettings?.general?.time) {
            const timeSettings = userSettings.general.time;
            
            // Apply user's timezone
            result.timezone = timeSettings.timeZone;
            
            // Format dates according to user's preferences
            const dateFormat = timeSettings.dateFormat || 'MM/DD/YYYY';
            const timeFormat = timeSettings.timeFormat || '12h';
            
            if (event.startTime) {
                const startDate = new Date(event.startTime);
                result.startTime = this.formatDateTime(startDate, dateFormat, timeFormat);
            }
            
            if (event.endTime) {
                const endDate = new Date(event.endTime);
                result.endTime = this.formatDateTime(endDate, dateFormat, timeFormat);
            }
            
            // Calculate duration
            if (event.startTime && event.endTime) {
                const durationMs = new Date(event.endTime).getTime() - new Date(event.startTime).getTime();
                const hours = Math.floor(durationMs / (1000 * 60 * 60));
                const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                result.duration = `${hours}h ${minutes}m`;
            }
        }

        return result;
    }

    /**
     * Helper method to format date and time according to user preferences
     */
    private formatDateTime(date: Date, dateFormat: string, timeFormat: string): string {
        // This is a simplified implementation
        // In a real application, you'd use a proper date formatting library like date-fns or moment.js
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        
        let formattedDate = '';
        switch (dateFormat) {
            case 'DD/MM/YYYY':
                formattedDate = `${day}/${month}/${year}`;
                break;
            case 'YYYY-MM-DD':
                formattedDate = `${year}-${month}-${day}`;
                break;
            default: // MM/DD/YYYY
                formattedDate = `${month}/${day}/${year}`;
                break;
        }
        
        const hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        
        let formattedTime = '';
        if (timeFormat === '24h') {
            formattedTime = `${hours.toString().padStart(2, '0')}:${minutes}`;
        } else {
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12;
            formattedTime = `${displayHours}:${minutes} ${ampm}`;
        }
        
        return `${formattedDate} ${formattedTime}`;
    }
}

export default new EventSettingsIntegration(); 