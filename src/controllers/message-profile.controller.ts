import { Request, Response } from 'express';
import sendEmail from '../services/email.service';
import { User } from '../models/User';
import Handlebars from 'handlebars';
import { config } from '../config/config';
import path from 'path';
import fs from 'fs';

/**
 * POST /api/message-profile/:userId
 * Sends a message to the email of the selected profile user.
 * Body: { subject: string, message: string }
 */
export const messageProfile = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { subject, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required.' });
    }
    console.log('messageProfile: Looking up user by ID:', userId);
    const user = await User.findById(userId);
    console.log('messageProfile: User query result:', user);
    if (!user || !user.email) {
      return res.status(404).json({ error: 'User or email not found.', userId, user });
    }
    // Load and compile the message-profile template
    const templatePath = path.join(__dirname, '../templates/emails/message-profile.hbs');
    const templateContent = await fs.promises.readFile(templatePath, 'utf-8');
    const template = Handlebars.compile(templateContent);
    const html = template({
      subject,
      message,
      appName: config.APP_NAME || 'MyProfile',
      year: new Date().getFullYear(),
    });
    await sendEmail.sendEmail(user.email, subject, html);
    return res.json({ success: true, message: 'Message sent to user.' });
  } catch (error) {
    // Log the error and return details for debugging
    console.log('Failed to send message:', error);
    return res.status(500).json({ error: 'Failed to send message.', details: error instanceof Error ? error.message : error });
  }
};
