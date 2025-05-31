import { SettingsService } from '../services/settings.service';
import logger from './logger';

/**
 * Utility functions for handling timezone conversions and formatting
 */
export class TimezoneUtils {
    private static settingsService = new SettingsService();

    /**
     * Get user's timezone from settings, fallback to UTC
     */
    static async getUserTimezone(userId: string): Promise<string> {
        try {
            const userSettings = await this.settingsService.getSettings(userId);
            return userSettings?.general?.time?.timeZone || 'UTC';
        } catch (error) {
            logger.logger.warn(`Failed to get user timezone for user ${userId}, using UTC: ${error}`);
            return 'UTC';
        }
    }

    /**
     * Convert a date to user's timezone
     */
    static convertToUserTimezone(date: Date, userTimezone: string): Date {
        if (userTimezone === 'UTC') {
            return new Date(date);
        }

        try {
            const userTimeString = date.toLocaleString('en-US', { timeZone: userTimezone });
            return new Date(userTimeString);
        } catch (error) {
            logger.logger.warn(`Invalid timezone ${userTimezone}, falling back to UTC`);
            return new Date(date);
        }
    }

    /**
     * Format date according to user's timezone and preferences
     */
    static async formatDateForUser(
        date: Date, 
        userId: string, 
        options?: {
            includeTime?: boolean;
            includeDate?: boolean;
            includeTimezone?: boolean;
        }
    ): Promise<string> {
        try {
            const userSettings = await this.settingsService.getSettings(userId);
            const userTimezone = userSettings?.general?.time?.timeZone || 'UTC';
            const timeFormat = userSettings?.general?.time?.timeFormat || '24h';
            const dateFormat = userSettings?.general?.time?.dateFormat || 'MM/DD/YYYY';

            const formatOptions: Intl.DateTimeFormatOptions = {
                timeZone: userTimezone,
            };

            if (options?.includeDate !== false) {
                formatOptions.year = 'numeric';
                formatOptions.month = 'short';
                formatOptions.day = 'numeric';
            }

            if (options?.includeTime !== false) {
                formatOptions.hour = 'numeric';
                formatOptions.minute = '2-digit';
                formatOptions.hour12 = timeFormat === '12h';
            }

            if (options?.includeTimezone) {
                formatOptions.timeZoneName = 'short';
            }

            return date.toLocaleString('en-US', formatOptions);
        } catch (error) {
            logger.logger.warn(`Error formatting date for user ${userId}: ${error}`);
            return date.toISOString();
        }
    }

    /**
     * Calculate time difference in user's timezone
     */
    static calculateTimeDifferenceInUserTimezone(
        startTime: Date, 
        endTime: Date, 
        userTimezone: string
    ): {
        milliseconds: number;
        minutes: number;
        hours: number;
        days: number;
        humanReadable: string;
    } {
        const adjustedStartTime = this.convertToUserTimezone(startTime, userTimezone);
        const adjustedEndTime = this.convertToUserTimezone(endTime, userTimezone);
        
        const timeDiff = adjustedEndTime.getTime() - adjustedStartTime.getTime();
        const minutes = Math.floor(timeDiff / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        let humanReadable = '';
        if (days > 0) {
            humanReadable = `${days} day${days > 1 ? 's' : ''}`;
        } else if (hours > 0) {
            humanReadable = `${hours} hour${hours > 1 ? 's' : ''}`;
        } else {
            humanReadable = `${minutes} minute${minutes > 1 ? 's' : ''}`;
        }

        return {
            milliseconds: timeDiff,
            minutes,
            hours,
            days,
            humanReadable
        };
    }

    /**
     * Check if a time is in the past relative to user's timezone
     */
    static isTimeInPast(time: Date, userTimezone: string): boolean {
        const now = new Date();
        const adjustedTime = this.convertToUserTimezone(time, userTimezone);
        const adjustedNow = this.convertToUserTimezone(now, userTimezone);
        
        return adjustedTime.getTime() < adjustedNow.getTime();
    }

    /**
     * Get current time in user's timezone
     */
    static getCurrentTimeInUserTimezone(userTimezone: string): Date {
        const now = new Date();
        return this.convertToUserTimezone(now, userTimezone);
    }

    /**
     * Parse a date string in user's timezone
     */
    static parseDateInUserTimezone(dateString: string, userTimezone: string): Date {
        try {
            // Create a date object and then convert to user's timezone
            const date = new Date(dateString);
            return this.convertToUserTimezone(date, userTimezone);
        } catch (error) {
            logger.logger.warn(`Error parsing date ${dateString} in timezone ${userTimezone}: ${error}`);
            return new Date();
        }
    }

    /**
     * Get timezone offset for a specific timezone
     */
    static getTimezoneOffset(timezone: string): number {
        try {
            const now = new Date();
            const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
            const targetTime = new Date(utcTime + (this.getTimezoneOffsetMinutes(timezone) * 60000));
            return targetTime.getTimezoneOffset();
        } catch (error) {
            logger.logger.warn(`Error getting timezone offset for ${timezone}: ${error}`);
            return 0;
        }
    }

    /**
     * Get timezone offset in minutes
     */
    private static getTimezoneOffsetMinutes(timezone: string): number {
        try {
            const now = new Date();
            const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
            const target = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
            return (target.getTime() - utc.getTime()) / (1000 * 60);
        } catch (error) {
            logger.logger.warn(`Error calculating timezone offset for ${timezone}: ${error}`);
            return 0;
        }
    }

    /**
     * Validate timezone string
     */
    static isValidTimezone(timezone: string): boolean {
        try {
            Intl.DateTimeFormat(undefined, { timeZone: timezone });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get list of common timezones
     */
    static getCommonTimezones(): string[] {
        return [
            'UTC',
            'America/New_York',
            'America/Chicago',
            'America/Denver',
            'America/Los_Angeles',
            'Europe/London',
            'Europe/Paris',
            'Europe/Berlin',
            'Asia/Tokyo',
            'Asia/Shanghai',
            'Asia/Kolkata',
            'Australia/Sydney',
            'Pacific/Auckland'
        ];
    }
} 