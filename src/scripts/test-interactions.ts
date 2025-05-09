import Client from 'socket.io-client';
import { Types } from 'mongoose';

const SERVER_URL = 'http://localhost:3000';

async function testInteractions() {
    // Create two test clients
    const user1Socket = Client(SERVER_URL, {
        query: { userId: new Types.ObjectId().toString() }
    });

    const user2Socket = Client(SERVER_URL, {
        query: { userId: new Types.ObjectId().toString() }
    });

    // Setup event listeners for both clients
    const setupListeners = (socket: any, userName: string) => {
        socket.on('connect', () => {
            console.log(`${userName} connected`);
        });

        socket.on('interaction:new', (data: any) => {
            console.log(`${userName} received new interaction:`, data);
        });

        socket.on('interaction:received', (data: any) => {
            console.log(`${userName} received interaction notification:`, data);
        });

        socket.on('interaction:qr:success', (data: any) => {
            console.log(`${userName} QR scan successful:`, data);
        });

        socket.on('interaction:chat:recorded', (data: any) => {
            console.log(`${userName} chat recorded:`, data);
        });

        socket.on('interaction:social:recorded', (data: any) => {
            console.log(`${userName} social interaction recorded:`, data);
        });
    };

    setupListeners(user1Socket, 'User1');
    setupListeners(user2Socket, 'User2');

    // Wait for connections
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 1: QR Scan
    console.log('\n=== Testing QR Scan ===');
    user1Socket.emit('qr:scan', {
        profileId: new Types.ObjectId().toString(),
        scannedProfileId: new Types.ObjectId().toString(),
        location: {
            lat: 40.7128,
            lng: -74.0060,
            address: 'New York, NY'
        }
    });

    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Chat Message
    console.log('\n=== Testing Chat Message ===');
    user1Socket.emit('chat:message', {
        senderId: new Types.ObjectId().toString(),
        receiverId: new Types.ObjectId().toString(),
        messageId: new Types.ObjectId().toString(),
        content: 'Hello, this is a test message!'
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Social Interaction - Like
    console.log('\n=== Testing Social Interaction - Like ===');
    user2Socket.emit('social:interaction', {
        type: 'like',
        profileId: new Types.ObjectId().toString(),
        targetProfileId: new Types.ObjectId().toString(),
        contentId: new Types.ObjectId().toString()
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 4: Social Interaction - Comment
    console.log('\n=== Testing Social Interaction - Comment ===');
    user2Socket.emit('social:interaction', {
        type: 'comment',
        profileId: new Types.ObjectId().toString(),
        targetProfileId: new Types.ObjectId().toString(),
        contentId: new Types.ObjectId().toString(),
        content: 'Great post!'
    });

    // Wait for all events to process
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Cleanup
    user1Socket.close();
    user2Socket.close();
    console.log('\nTest completed');
}

// Run the tests
testInteractions().catch(console.error);
