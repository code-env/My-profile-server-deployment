import type { IUser, User } from './../models/User';
import ContactService from '../services/contacts.service';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ContactCategory, Gender, PhoneType } from '../models/Contact';
import { handleBase64ImageUpload } from '../utils/fileUploads';

// Helper function to validate user authentication
const validateAuthenticatedUser = (req: Request): { userId: string, user: IUser } => {
  if (!req.user) {
    throw new Error('Authentication required');
  }
  const user = req.user as IUser;
  return {
    userId: user._id.toString(), // Convert ObjectId to string
    user: user
  };
};


// Helper function to validate contact data
const validateContactData = (data: any) => {
  const errors: string[] = [];

  if (!data.firstName) errors.push('firstName is required');
  if (!data.phoneNumber) errors.push('phoneNumber is required');

  if (data.gender && !Object.values(Gender).includes(data.gender)) {
    errors.push(`gender must be one of: ${Object.values(Gender).join(', ')}`);
  }

  if (data.phoneType && !Object.values(PhoneType).includes(data.phoneType)) {
    errors.push(`phoneType must be one of: ${Object.values(PhoneType).join(', ')}`);
  }

  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }
};

export const createContact = async (req: Request, res: Response) => {
  try {
    const { userId } = validateAuthenticatedUser(req);
    validateContactData(req.body);

    if (req.body.photo && typeof req.body.photo === 'string') {
      try {
        const uploadedPath = handleBase64ImageUpload(req.body.photo, 'contacts');
        req.body.photo = uploadedPath;
      } catch (uploadErr) {
        return res.status(400).json({ error: 'Invalid image upload', details: (uploadErr as Error).message });
      }
    }

    const contact = await ContactService.createContact(userId, req.body);
    res.status(201).json(contact);
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return res.status(401).json({ error: error.message });
    }

    res.status(400).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred',
      details: error instanceof Error ? error.stack : undefined,
    });
  }
};

export const getContactById = async ( req: Request, res: Response) => {
  try {
    const { userId } = validateAuthenticatedUser(req);

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    console.log('Incoming request to get contact by ID:', req.params.id);
    const contact = await ContactService.getContactById(req.params.id, userId);

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(contact);
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const getUserContacts = async (req: Request, res: Response) => {
  try {
    const { userId } = validateAuthenticatedUser(req);

    console.log('Incoming query params:', req.query);

    const {
      isRegistered,
      category,
      search,
      isFavorite,
      gender,
      phoneType,
      indicatorType
    } = req.query;

    // Validation & filter sanitization
    const filters: any = {};

    // Validate and assign isRegistered
    if (typeof isRegistered !== 'undefined') {
      if (isRegistered === 'true') {
        filters.isRegistered = true;
      } else if (isRegistered === 'false') {
        filters.isRegistered = false;
      } else {
        return res.status(400).json({ error: 'isRegistered must be "true" or "false"' });
      }
    }

    // Validate and assign isFavorite
    if (typeof isFavorite !== 'undefined') {
      if (isFavorite === 'true') {
        filters.isFavorite = true;
      } else if (isFavorite === 'false') {
        filters.isFavorite = false;
      } else {
        return res.status(400).json({ error: 'isFavorite must be "true" or "false"' });
      }
    }

    // Validate and assign category
    if (category) {
      if (!Object.values(ContactCategory).includes(category as ContactCategory)) {
        return res.status(400).json({ error: 'Invalid category' });
      }
      filters.category = category;
    }

    // Optional filters
    if (search && typeof search === 'string' && search.trim() !== '') {
      filters.search = search;
    }

    if (gender && typeof gender === 'string') {
      filters.gender = gender as Gender;
    }

    if (phoneType && typeof phoneType === 'string') {
      filters.phoneType = phoneType as PhoneType;
    }

    if (indicatorType && typeof indicatorType === 'string') {
      filters.indicatorType = indicatorType;
    }

    // Debug final filters
    console.log('Final filters sent to service:', JSON.stringify(filters, null, 2));

    // Fetch contacts with clean filters
    const contacts = await ContactService.getUserContacts(userId, filters);

    return successResponse(res, contacts, 'Contacts fetched successfully');
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const updateContact = async (req: Request, res: Response) => {
  try {
    const { userId } = validateAuthenticatedUser(req);

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    // Handle photo upload if present
    if (req.body.photo && typeof req.body.photo === 'string') {
      try {
        const uploadedPath = handleBase64ImageUpload(req.body.photo, 'contacts');
        req.body.photo = uploadedPath;
      } catch (uploadErr) {
        return res.status(400).json({ error: 'Invalid image upload', details: (uploadErr as Error).message });
      }
    }

    // Validate enum fields if provided
    if (req.body.gender && !Object.values(Gender).includes(req.body.gender)) {
      return res.status(400).json({ error: 'Invalid gender' });
    }

    if (req.body.phoneType && !Object.values(PhoneType).includes(req.body.phoneType)) {
      return res.status(400).json({ error: 'Invalid phoneType' });
    }

    if (req.body.category && !Object.values(ContactCategory).includes(req.body.category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const updatedContact = await ContactService.updateContact(
      req.params.id,
      userId,
      req.body
    );

    if (!updatedContact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    return successResponse(res, updatedContact, 'Contact updated successfully');

  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const deleteContact = async (req: Request, res: Response) => {
  try {
    const { userId } = validateAuthenticatedUser(req);

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    const result = await ContactService.deleteContact(req.params.id, userId);

    if (!result) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    return successResponse(res, result, 'Contact deleted successfully');

  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const toggleFavorite = async (req: Request, res: Response) => {
  try {
    const { userId } = validateAuthenticatedUser(req);

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    const contact = await ContactService.toggleFavorite(req.params.id, userId);

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(contact);
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const syncContacts = async (req: Request, res: Response) => {
  try {
    const { userId } = validateAuthenticatedUser(req);
    const { contacts } = req.body;

    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({ error: 'Invalid contacts data' });
    }

    // Enhanced validation for sync contacts
    const validationErrors = contacts
      .map((contact, index) => {
        const errors: string[] = [];
        if (!contact.phoneNumber) errors.push('phoneNumber is required');
        if (!contact.firstName) errors.push('firstName is required');
        return errors.length ? `Contact ${index}: ${errors.join(', ')}` : null;
      })
      .filter(Boolean);

    if (validationErrors.length > 0) {
      return res.status(400).json({ error: validationErrors.join('; ') });
    }

    const syncedContacts = await ContactService.syncContacts(userId, contacts);
    res.json(syncedContacts);
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const getRegisteredContacts = async (req: Request, res: Response) => {
  try {
    const { userId } = validateAuthenticatedUser(req);
    const contacts = await ContactService.getRegisteredContacts(userId);
    res.json(contacts);
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const updateLastContacted = async (req: Request, res: Response) => {
  try {
    const { userId } = validateAuthenticatedUser(req);

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    const contact = await ContactService.updateLastContacted(req.params.id, userId);

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    return successResponse(res, contact, 'Last contacted date updated successfully');
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const bulkUpdateCategories = async (req: Request, res: Response) => {
  try {
    const { userId } = validateAuthenticatedUser(req);
    const { contactIds, category } = req.body;

    if (!contactIds || !Array.isArray(contactIds)) {
      return res.status(400).json({ error: 'Invalid contact IDs' });
    }

    for (const id of contactIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: `Invalid contact ID: ${id}` });
      }
    }

    if (!category || !Object.values(ContactCategory).includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const modifiedCount = await ContactService.bulkUpdateCategories(
      userId,
      contactIds,
      category
    );

    res.json({ modifiedCount });
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

// New endpoint for handling contact photo upload
export const uploadContactPhoto = async (req: Request, res: Response) => {
  try {
    const { userId } = validateAuthenticatedUser(req);

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    if (!req.body.photo || typeof req.body.photo !== 'string') {
      return res.status(400).json({ error: 'Invalid photo data' });
    }

    // Handle photo upload
    try {
      const uploadedPath = handleBase64ImageUpload(req.body.photo, 'contacts');
      req.body.photo = uploadedPath;
    } catch (uploadErr) {
      return res.status(400).json({ error: 'Invalid image upload', details: (uploadErr as Error).message });
    }

    const updatedContact = await ContactService.updateContact(
      req.params.id,
      userId,
      { photo: req.body.photo }
    );

    if (!updatedContact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    return successResponse(res, updatedContact, 'Contact photo updated successfully');
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

// Helper function to handle error responses consistently
function handleErrorResponse(error: unknown, res: Response) {
  if (error instanceof Error && error.message === 'Authentication required') {
    return res.status(401).json({ error: error.message });
  }

  const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
  res.status(statusCode).json({
    error: error instanceof Error ? error.message : 'An unknown error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: error instanceof Error ? error.stack : undefined })
  });
}

export function successResponse(res: Response, data: any, message: string) {
  res.status(200).json({
    message: message,
    success: true,
    data
  });
}