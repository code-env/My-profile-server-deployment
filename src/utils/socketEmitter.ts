import { io as Client } from 'socket.io-client';
import { Types } from 'mongoose';

interface SocialInteractionData {
    type: 'like' | 'comment' | 'share';
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
    if (!['like', 'comment', 'share'].includes(data.type)) {
        errors.push('type must be one of: like, comment, share');
    }
    if (data.type === 'comment' && !data.content) {
        errors.push('content is required for comment type');
    }

    if (errors.length > 0) {
        throw new Error(errors.join('; '));
    }
};

// Get socket URL from environment or config
const getSocketUrl = () => {
    return process.env.SOCKET_SERVER_URL || 'http://localhost:3000';
};

export const emitSocialInteraction = async (
    userId: string | Types.ObjectId,
    data: SocialInteractionData,
    serverUrl?: string
): Promise<void> => {
    // Validate the interaction data
    validateInteractionData(data);

    const socketUrl = serverUrl || getSocketUrl();
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

        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error.message);
            console.error('Error details:', error);
            reject(error);
        });

        socket.on('error', (error) => {
            console.error('Socket general error:', error);
            reject(error);
        });
    });
}; 