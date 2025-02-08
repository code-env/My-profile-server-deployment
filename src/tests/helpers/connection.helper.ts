import mongoose from 'mongoose';
import { User } from '../../models/User';
import { ProfileModel } from '../../models/profile.model';
import { Connection } from '../../models/Connection';
import { Message } from '../../models/Message';

export const createTestUser = async (data: Partial<any> = {}) => {
  return User.create({
    email: `test${Date.now()}@example.com`,
    password: 'password123',
    username: `testuser${Date.now()}`,
    ...data
  });
};

export const createTestProfile = async (userId: mongoose.Types.ObjectId, data: Partial<any> = {}) => {
  return ProfileModel.create({
    owner: userId,
    name: `Test Profile ${Date.now()}`,
    bio: 'Test bio',
    skills: ['JavaScript', 'Node.js', 'MongoDB'],
    industries: ['Technology', 'Software'],
    ...data
  });
};

export const createTestConnection = async (
  fromUserId: mongoose.Types.ObjectId,
  toProfileId: mongoose.Types.ObjectId,
  data: Partial<any> = {}
) => {
  return Connection.create({
    fromUser: fromUserId,
    toProfile: toProfileId,
    connectionType: 'connect',
    status: 'accepted',
    ...data
  });
};

export const createTestMessage = async (
  senderId: mongoose.Types.ObjectId,
  recipientId: mongoose.Types.ObjectId,
  data: Partial<any> = {}
) => {
  return Message.create({
    sender: senderId,
    recipient: recipientId,
    content: 'Test message',
    ...data
  });
};

export const generateTestInteractions = async (
  connection: any,
  count: number = 10,
  daysAgo: number = 30
) => {
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

  return Message.insertMany(messages);
};

export const cleanupTestData = async () => {
  await Promise.all([
    User.deleteMany({ email: /test.*@example.com/ }),
    ProfileModel.deleteMany({ name: /Test Profile.*/ }),
    Connection.deleteMany({ message: /Test connection.*/ }),
    Message.deleteMany({ content: /Test message.*/ })
  ]);
};
