import { SettingsService } from '../services/settings.service';
import { ITask } from '../models/Tasks';
import { SettingsDocument } from '../models/settings';

/**
 * Utility functions for integrating task settings with user settings
 */
export class TaskSettingsIntegration {
    private settingsService = new SettingsService();

    /**
     * Apply user's default settings to a new task
     */
    async applyUserDefaultsToTask(userId: string, taskData: Partial<ITask>): Promise<Partial<ITask>> {
        const userSettings = await this.settingsService.getSettings(userId);
        
        if (!userSettings) {
            return taskData;
        }

        const enhancedTaskData = { ...taskData };

        // Apply time zone and duration settings
        if (userSettings.general?.time) {
            const timeSettings = userSettings.general.time;
            
            if (!enhancedTaskData.settings) {
                enhancedTaskData.settings = {};
            }

            if (!enhancedTaskData.settings.timeSettings) {
                enhancedTaskData.settings.timeSettings = {
                    useUserTimezone: true,
                    bufferTime: timeSettings.bufferTimeMinutes || 15,
                    defaultDuration: timeSettings.slotDurationMinutes || 60
                };
            }

            // Apply default duration if not specified
            if (!enhancedTaskData.duration && timeSettings.slotDurationMinutes) {
                enhancedTaskData.duration = {
                    hours: Math.floor(timeSettings.slotDurationMinutes / 60),
                    minutes: timeSettings.slotDurationMinutes % 60
                };
            }
        }

        // Apply privacy/visibility settings - only if not explicitly provided
        if (userSettings.privacy?.Visibility?.engagement?.schedules) {
            const scheduleVisibility = userSettings.privacy.Visibility.engagement.schedules;
            
            if (!enhancedTaskData.settings) {
                enhancedTaskData.settings = {};
            }

            // Only apply user's default visibility if no explicit visibility was provided
            if (!enhancedTaskData.settings.visibility) {
                enhancedTaskData.settings.visibility = {
                    level: scheduleVisibility.level || 'ConnectionsOnly',
                    customUsers: scheduleVisibility.customUsers || []
                };
            } else if (!enhancedTaskData.settings.visibility.level) {
                // If visibility object exists but level is not set, apply user's default
                enhancedTaskData.settings.visibility.level = scheduleVisibility.level || 'ConnectionsOnly';
            }
            // If visibility.level is explicitly set, preserve it and don't override
        }

        // Apply notification preferences
        if (userSettings.notifications?.calendar) {
            const calendarNotifications = userSettings.notifications.calendar;
            
            if (!enhancedTaskData.settings) {
                enhancedTaskData.settings = {};
            }

            if (!enhancedTaskData.settings.notifications) {
                enhancedTaskData.settings.notifications = {
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

        // Apply general behavior settings
        if (userSettings.general?.behaviorAndAlerts) {
            const behaviorSettings = userSettings.general.behaviorAndAlerts;
            
            if (!enhancedTaskData.settings) {
                enhancedTaskData.settings = {};
            }

            if (!enhancedTaskData.settings.notifications) {
                enhancedTaskData.settings.notifications = {
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
                enhancedTaskData.settings.notifications.channels.push = false;
            }
        }

        // Apply privacy settings for interactions
        if (userSettings.privacy?.permissions) {
            if (!enhancedTaskData.settings) {
                enhancedTaskData.settings = {};
            }

            if (!enhancedTaskData.settings.privacy) {
                enhancedTaskData.settings.privacy = {
                    allowComments: userSettings.privacy.permissions.chatWithMe?.level !== 'NoOne',
                    allowLikes: true,
                    allowParticipants: userSettings.privacy.permissions.request?.level !== 'NoOne',
                    shareWithConnections: userSettings.privacy.permissions.share?.level === 'ConnectionsOnly' || userSettings.privacy.permissions.share?.level === 'Public'
                };
            }
        }

        return enhancedTaskData;
    }

    /**
     * Check if a task is visible to a specific profile
     */
    async isTaskVisibleToProfile(task: ITask, viewerProfileId: string, taskOwnerSettings?: SettingsDocument | null): Promise<boolean> {
        // If the task belongs to the viewer's profile, always show it
        if (task.profile.toString() === viewerProfileId) {
            return true;
        }

        // Check task-specific visibility settings first
        if (task.settings?.visibility) {
            const visibility = task.settings.visibility;
            
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
                    // Check if the viewer's profile is in the custom list (which contains profile IDs)
                    return visibility.customUsers?.includes(viewerProfileId) || false;
                default:
                    return false;
            }
        }

        // Fall back to task owner's general schedule visibility settings
        if (!taskOwnerSettings) {
            // Get settings using the user ID (createdBy), not profile ID
            taskOwnerSettings = await this.settingsService.getSettings(task.createdBy.toString());
        }

        if (taskOwnerSettings?.privacy?.Visibility?.engagement?.schedules) {
            const scheduleVisibility = taskOwnerSettings.privacy.Visibility.engagement.schedules;
            
            switch (scheduleVisibility.level) {
                case 'Public':
                    return true;
                case 'OnlyMe':
                    return false;
                case 'ConnectionsOnly':
                    // Would need to check if profiles are connected
                    return false;
                case 'Custom':
                    // Check if the viewer's profile is in the custom list (which contains profile IDs)
                    return scheduleVisibility.customUsers?.includes(viewerProfileId) || false;
                default:
                    return false;
            }
        }

        // Default to public if no settings found
        return task.visibility === 'Public';
    }

    /**
     * Get notification preferences for a task based on user settings
     */
    async getTaskNotificationPreferences(userId: string, taskId?: string): Promise<{
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
     * Format task time based on user's regional settings
     */
    async formatTaskTimeForUser(task: ITask, userId: string): Promise<{
        startTime?: string;
        endTime?: string;
        duration?: string;
        timezone?: string;
    }> {
        const userSettings = await this.settingsService.getSettings(userId);
        
        const result: any = {};

        if (!userSettings?.general?.time) {
            // Default formatting
            if (task.startTime) result.startTime = task.startTime.toISOString();
            if (task.endTime) result.endTime = task.endTime.toISOString();
            if (task.duration) result.duration = `${task.duration.hours}h ${task.duration.minutes}m`;
            return result;
        }

        const timeSettings = userSettings.general.time;
        const timeFormat = timeSettings.timeFormat || '24h';
        const dateFormat = timeSettings.dateFormat || 'YYYY-MM-DD';
        const timezone = timeSettings.timeZone || 'UTC';

        // Format times according to user preferences
        if (task.startTime) {
            const date = new Date(task.startTime);
            // Here you would apply the user's preferred formatting
            // For now, just return ISO string with timezone info
            result.startTime = date.toLocaleString('en-US', { 
                timeZone: timezone,
                hour12: timeFormat === '12h'
            });
        }

        if (task.endTime) {
            const date = new Date(task.endTime);
            result.endTime = date.toLocaleString('en-US', { 
                timeZone: timezone,
                hour12: timeFormat === '12h'
            });
        }

        if (task.duration) {
            result.duration = `${task.duration.hours}h ${task.duration.minutes}m`;
        }

        result.timezone = timezone;

        return result;
    }
}

export const taskSettingsIntegration = new TaskSettingsIntegration(); 