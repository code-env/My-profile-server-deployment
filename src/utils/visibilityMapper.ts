/**
 * Utility for mapping visibility values between external API format and internal database format
 */

export type ExternalVisibility = 'Public' | 'Private' | 'Hidden' | 'Custom';
export type InternalVisibility = 'Public' | 'ConnectionsOnly' | 'OnlyMe' | 'Custom';

/**
 * Maps external visibility values to internal database format
 * - 'Public' -> 'Public'
 * - 'Private' -> 'ConnectionsOnly'
 * - 'Hidden' -> 'OnlyMe'
 * - 'Custom' -> 'Custom'
 */
export function mapExternalToInternal(externalVisibility: ExternalVisibility): InternalVisibility {
    switch (externalVisibility) {
        case 'Public':
            return 'Public';
        case 'Private':
            return 'ConnectionsOnly';
        case 'Hidden':
            return 'OnlyMe';
        case 'Custom':
            return 'Custom';
        default:
            // Fallback to ConnectionsOnly for any unexpected values
            return 'ConnectionsOnly';
    }
}

/**
 * Maps internal visibility values to external API format
 * - 'Public' -> 'Public'
 * - 'ConnectionsOnly' -> 'Private'
 * - 'OnlyMe' -> 'Hidden'
 * - 'Custom' -> 'Custom'
 */
export function mapInternalToExternal(internalVisibility: InternalVisibility): ExternalVisibility {
    switch (internalVisibility) {
        case 'Public':
            return 'Public';
        case 'ConnectionsOnly':
            return 'Private';
        case 'OnlyMe':
            return 'Hidden';
        case 'Custom':
            return 'Custom';
        default:
            // Fallback to Private for any unexpected values
            return 'Private';
    }
}

/**
 * Maps visibility settings object from external to internal format
 */
export function mapVisibilitySettingsToInternal(visibilitySettings: any): any {
    if (!visibilitySettings) return visibilitySettings;
    
    if (visibilitySettings.level) {
        return {
            ...visibilitySettings,
            level: mapExternalToInternal(visibilitySettings.level)
        };
    }
    
    return visibilitySettings;
}

/**
 * Maps visibility settings object from internal to external format
 */
export function mapVisibilitySettingsToExternal(visibilitySettings: any): any {
    if (!visibilitySettings) return visibilitySettings;
    
    if (visibilitySettings.level) {
        return {
            ...visibilitySettings,
            level: mapInternalToExternal(visibilitySettings.level)
        };
    }
    
    return visibilitySettings;
}

/**
 * Maps task/event data visibility from external to internal format
 */
export function mapTaskEventDataToInternal(data: any): any {
    if (!data) return data;
    
    const mappedData = { ...data };
    
    // Map direct visibility field
    if (mappedData.visibility) {
        mappedData.visibility = mapExternalToInternal(mappedData.visibility);
    }
    
    // Map settings.visibility
    if (mappedData.settings?.visibility) {
        mappedData.settings.visibility = mapVisibilitySettingsToInternal(mappedData.settings.visibility);
    }
    
    return mappedData;
}

/**
 * Maps task/event data visibility from internal to external format
 */
export function mapTaskEventDataToExternal(data: any): any {
    if (!data) return data;
    
    const mappedData = { ...data };
    
    // Map direct visibility field
    if (mappedData.visibility) {
        mappedData.visibility = mapInternalToExternal(mappedData.visibility);
    }
    
    // Map settings.visibility
    if (mappedData.settings?.visibility) {
        mappedData.settings.visibility = mapVisibilitySettingsToExternal(mappedData.settings.visibility);
    }
    
    return mappedData;
} 