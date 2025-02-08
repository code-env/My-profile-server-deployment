"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupTestData = exports.generateTestInteractions = exports.createTestMessage = exports.createTestConnection = exports.createTestProfile = exports.createTestUser = void 0;
const User_1 = require("../../models/User");
const profile_model_1 = require("../../models/profile.model");
const Connection_1 = require("../../models/Connection");
const Message_1 = require("../../models/Message");
const createTestUser = async (data = {}) => {
    return User_1.User.create({
        email: `test${Date.now()}@example.com`,
        password: 'password123',
        username: `testuser${Date.now()}`,
        ...data
    });
};
exports.createTestUser = createTestUser;
const createTestProfile = async (userId, data = {}) => {
    return profile_model_1.ProfileModel.create({
        owner: userId,
        name: `Test Profile ${Date.now()}`,
        bio: 'Test bio',
        skills: ['JavaScript', 'Node.js', 'MongoDB'],
        industries: ['Technology', 'Software'],
        ...data
    });
};
exports.createTestProfile = createTestProfile;
const createTestConnection = async (fromUserId, toProfileId, data = {}) => {
    return Connection_1.Connection.create({
        fromUser: fromUserId,
        toProfile: toProfileId,
        connectionType: 'connect',
        status: 'accepted',
        ...data
    });
};
exports.createTestConnection = createTestConnection;
const createTestMessage = async (senderId, recipientId, data = {}) => {
    return Message_1.Message.create({
        sender: senderId,
        recipient: recipientId,
        content: 'Test message',
        ...data
    });
};
exports.createTestMessage = createTestMessage;
const generateTestInteractions = async (connection, count = 10, daysAgo = 30) => {
    const messages = [];
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - daysAgo);
    for (let i = 0; i < count; i++) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() + i);
        messages.push({
            sender: connection.fromUser,
            recipient: connection.toProfile,
            content: `Test message ${i}`,
            createdAt: date
        });
    }
    return Message_1.Message.insertMany(messages);
};
exports.generateTestInteractions = generateTestInteractions;
const cleanupTestData = async () => {
    await Promise.all([
        User_1.User.deleteMany({ email: /test.*@example.com/ }),
        profile_model_1.ProfileModel.deleteMany({ name: /Test Profile.*/ }),
        Connection_1.Connection.deleteMany({ message: /Test connection.*/ }),
        Message_1.Message.deleteMany({ content: /Test message.*/ })
    ]);
};
exports.cleanupTestData = cleanupTestData;
