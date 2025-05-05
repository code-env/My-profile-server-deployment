// server.ts
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { InteractionService } from '../services/interaction.service';
import { Interaction } from '../models/Interaction';

const app = express();
const server = http.createServer(app);

console.log('Initializing Socket.IO server...');
const io = new Server(server, {
    cors: {
        origin: "*", // Adjust for production
    },
    transports: ['websocket', 'polling']
});

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/interactions')
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

console.log('Creating InteractionService instance...');
// Initialize the service with the Interaction model and socket server
const interactionService = new InteractionService(Interaction);
console.log('Setting up socket server in InteractionService...');
interactionService.setSocketServer(io);

// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log('Socket.IO connection received:', socket.id);
    const userId = socket.handshake.query.userId as string;
    console.log('Connection query:', socket.handshake.query);
    
    if (userId) {
        console.log(`User ${userId} connected to socket server`);
        interactionService.registerUserSocket(userId, socket);
    } else {
        console.log('No userId provided in connection');
    }

    socket.on('disconnect', (reason) => {
        console.log(`Socket ${socket.id} disconnected. Reason: ${reason}`);
    });

    // Debug: log all events
    socket.onAny((eventName, ...args) => {
        console.log(`Received event "${eventName}" on socket ${socket.id}:`, args);
    });
});

// Express middleware
app.use(express.json());

// Example route for comments
app.post('/api/comments', async (req, res) => {
    try {
        const { commenterId, commenterProfileId, targetProfileId, postId, content } = req.body;

        // Generate the interaction
        const interaction = await interactionService.generateInteraction(
            new mongoose.Types.ObjectId(commenterId),
            new mongoose.Types.ObjectId(commenterProfileId),
            new mongoose.Types.ObjectId(targetProfileId),
            'comment', // Using string literal for simplicity
            {
                entityType: 'Post',
                entityId: postId,
                action: 'comment',
                content: content
            }
        );

        res.status(201).json({ interaction });
    } catch (error: unknown) {
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'An unknown error occurred' 
        });
    }
});

server.listen(3000, () => {
    console.log('Server running on port 3000');
});