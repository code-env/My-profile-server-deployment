import Client from 'socket.io-client';
import { Types } from 'mongoose';
import { ProfileModel } from '../models/profile.model';

interface SocialInteractionData {
    type: 'like' | 'comment' | 'share' | 'connection';
    profile: string | Types.ObjectId;
    targetProfile: string | Types.ObjectId;
    contentId: string | Types.ObjectId;
    content?: string;
}

const validateInteractionData = (data: SocialInteractionData) => {
    const errors: string[] = [];

    if (!data.profile) errors.push('profileId is required');
    if (!data.targetProfile) errors.push('targetProfileId is required');
    if (!data.contentId) errors.push('contentId is required');
    if (!['like', 'comment', 'share', 'connection'].includes(data.type)) {
        errors.push('type must be one of: like, comment, share, connection');
    }
    if (data.type === 'comment' && !data.content) {
        errors.push('content is required for comment type');
    }

    if (errors.length > 0) {
        throw new Error(errors.join('; '));
    }
};

const validateProfilesExist = async (profileId: string | Types.ObjectId, targetProfileId: string | Types.ObjectId): Promise<boolean> => {
    try {
        // Check if both profiles exist
        const [profile, targetProfile] = await Promise.all([
            ProfileModel.findById(profileId),
            ProfileModel.findById(targetProfileId)
        ]);

        if (!profile) {
            console.warn(`Profile not found: ${profileId}`);
            return false;
        }

        if (!targetProfile) {
            console.warn(`Target profile not found: ${targetProfileId}`);
            return false;
        }

        // Prevent self-interaction
        if (profile._id.toString() === targetProfile._id.toString()) {
            console.warn(`Self-interaction prevented: ${profileId} -> ${targetProfileId}`);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error validating profiles:', error);
        return false;
    }
};

// Get socket URL from environment or config
const getSocketUrl = () => {
    // if its dev mode use socket_io_url2 else use socket_io_url
    const url = process.env.NODE_ENV === 'development' ? process.env.SOCKET_IO_URL2 : process.env.SOCKET_IO_URL;
    console.log('Socket URL being used:', url);
    return url;
};

export const emitSocialInteraction = async (
    userId: string | Types.ObjectId,
    data: SocialInteractionData,
    serverUrl?: string
): Promise<void> => {
    try {
        // Validate the interaction data
        validateInteractionData(data);

        // Validate that profiles exist before emitting
        const profilesValid = await validateProfilesExist(data.profile, data.targetProfile);
        if (!profilesValid) {
            console.warn('Skipping social interaction emission due to invalid profiles');
            return;
        }

        const socketUrl = getSocketUrl();
        if (!socketUrl) {
            throw new Error('Socket URL not found');
        }
        console.log('Creating socket connection to', socketUrl);
        const socket = Client(socketUrl, {
            query: { userId: userId.toString() }
        });

        return new Promise((resolve, reject) => {
            socket.on('connect', () => {
                console.log('Socket connected with ID:', socket.id);
                console.log('User ID in query:', userId.toString());

                const eventData = {
                    type: data.type,
                    profile: data.profile.toString(),
                    targetProfile: data.targetProfile.toString(),
                    contentId: data.contentId.toString(),
                    content: data.content
                };
                console.log('Emitting social:interaction event with data:', eventData);

                socket.emit('social:interaction', eventData);

                setTimeout(() => {
                    console.log('Disconnecting socket...');
                    socket.disconnect();
                    resolve();
                }, 1000);
            });

            socket.on('connect_error', (error: { message: any; }) => {
                console.error('Socket connection error:', error.message);
                console.error('Error details:', error);
                reject(error);
            });

            socket.on('error', (error: any) => {
                console.error('Socket general error:', error);
                reject(error);
            });
        });
    } catch (error) {
        console.error('Error in emitSocialInteraction:', error);
        // Don't throw the error to prevent breaking the main flow
        return;
    }
};
