import type { IUser, User } from './../models/User';
import ContactService from '../services/contacts.service';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ProfileType, Gender, PhoneType } from '../models/Contact';
import CloudinaryService from '../services/cloudinary.service';

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

  if(!data.profileId) errors.push('profileId is required');
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
    validateContactData(req.body);

    const profileId = req.body.profileId;
    if (req.body.photo && typeof req.body.photo === 'string') {
      try {
        // Use CloudinaryService instead of handleBase64ImageUpload
        const imageUrl = await new CloudinaryService().uploadImage(req.body.photo, {
          folder: 'contacts',
          transformation: { width: 500, height: 500, crop: 'limit' } // Optional transformations
        });
        req.body.photo = imageUrl; // Store the Cloudinary URL instead of local path
      } catch (uploadErr) {
        return res.status(400).json({
          error: 'Invalid image upload',
          details: (uploadErr as Error).message
        });
      }
    }

    const contact = await ContactService.createContact(profileId as string, req.body);
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

export const getContactById = async (req: Request, res: Response) => {
  try {
    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    console.log('Incoming request to get contact by ID:', req.params.id);
    const contact = await ContactService.getContactById(req.params.id);

    if (!contact) {
      handleErrorResponse(new Error('Contact not found'), res);
      return;
    }

    res.json(contact);
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const getUserProfileContacts = async (req: Request, res: Response) => {
  try {
    console.log('Incoming query params:', req.query);

    const {
      profileId,
      isRegistered,
      profileType,
      search,
      isFavorite,
      gender,
      phoneType,
      indicatorType
    } = req.query;

    // Validation & filter sanitization
    const filters: any = {};

    if (!profileId || !mongoose.Types.ObjectId.isValid(profileId as string)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }
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

    // Validate and assign profileType
    if (profileType) {
      if (!Object.values(ProfileType).includes(profileType as ProfileType)) {
        return res.status(400).json({ error: 'Invalid profileType' });
      }
      filters.profileType = profileType;
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
    const contacts = await ContactService.getUserContacts(profileId as string, filters);

    return successResponse(res, contacts, 'Contacts fetched successfully');
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const updateContact = async (req: Request, res: Response) => {
  try {
    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    if (!req.body.profileId || !mongoose.Types.ObjectId.isValid(req.body.profileId)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }

    // Handle photo upload if present
    if (req.body.photo && typeof req.body.photo === 'string') {
      try {
        const uploadedPath = await new CloudinaryService().uploadImage(req.body.photo, {
          folder: 'contacts',
          transformation: { width: 500, height: 500, crop: 'limit' } // Optional transformations
        });
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

    if (req.body.profileType && !Object.values(ProfileType).includes(req.body.profileType)) {
      return res.status(400).json({ error: 'Invalid profileType' });
    }

    const updatedContact = await ContactService.updateContact(
      req.params.id,
      req.body.profileId,
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
    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    if (!req.body.profileId || !mongoose.Types.ObjectId.isValid(req.body.profileId)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }

    // Validate if the contact exists
    const contactExists = await ContactService.getContactById(req.params.id);
    if (!contactExists) {
      handleErrorResponse(new Error('Contact not found'), res);
      return;
    }

    if (contactExists.photo) {
      // Delete the photo from Cloudinary if it exists
      try {
        await new CloudinaryService().delete(contactExists.photo);
      } catch (deleteErr) {
        return res.status(400).json({ error: 'Failed to delete contact photo', details: (deleteErr as Error).message });
      }
    }
    const result = await ContactService.deleteContact(req.params.id, req.body.profileId);

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
    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    if (!req.body.profileId || !mongoose.Types.ObjectId.isValid(req.body.profileId)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }

    // Validate if the contact exists
    const contactExists = await ContactService.getContactById(req.params.id);
    if (!contactExists) {
      handleErrorResponse(new Error('Contact not found'), res);
      return;
    }
    const contact = await ContactService.toggleFavorite(req.params.id, req.body.profileId);

    return successResponse(res, contact, 'Contact favorite status updated successfully');
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const syncContacts = async (req: Request, res: Response) => {
  try {
    const { contacts, profileId } = req.body;

    if (!profileId || !mongoose.Types.ObjectId.isValid(profileId)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }

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

    const syncedContacts = await ContactService.syncContacts(profileId, contacts);
    res.json(syncedContacts);
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const getRegisteredContacts = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.query;

    if (!profileId || !mongoose.Types.ObjectId.isValid(profileId as string)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }

    const contacts = await ContactService.getRegisteredContacts(profileId as string);
    res.json(contacts);
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const updateLastContacted = async (req: Request, res: Response) => {
  try {
    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    if (!req.body.profileId || !mongoose.Types.ObjectId.isValid(req.body.profileId)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }

    const contact = await ContactService.updateLastContacted(req.params.id, req.body.profileId);

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
    const { contactIds, profileType, profileId } = req.body;

    if (!profileId || !mongoose.Types.ObjectId.isValid(profileId)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }

    if (!contactIds || !Array.isArray(contactIds)) {
      return res.status(400).json({ error: 'Invalid contact IDs' });
    }

    for (const id of contactIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: `Invalid contact ID: ${id}` });
      }
    }

    if (!profileType || !Object.values(ProfileType).includes(profileType)) {
      return res.status(400).json({ error: 'Invalid profileType' });
    }

    const modifiedCount = await ContactService.bulkUpdateCategories(
      profileId,
      contactIds,
      profileType
    );

    res.json({ modifiedCount });
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

export const uploadContactPhoto = async (req: Request, res: Response) => {
  try {
    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    if (!req.body.profileId || !mongoose.Types.ObjectId.isValid(req.body.profileId)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }

    if (!req.body.photo || typeof req.body.photo !== 'string') {
      return res.status(400).json({ error: 'Invalid photo data' });
    }

    // Handle photo upload
    try {
      const uploadedPath = await new CloudinaryService().uploadImage(req.body.photo, {
        folder: 'contacts',
        transformation: { width: 500, height: 500, crop: 'limit' } // Optional transformations
      });
      req.body.photo = uploadedPath;
    } catch (uploadErr) {
      return res.status(400).json({ error: 'Invalid image upload', details: (uploadErr as Error).message });
    }

    const updatedContact = await ContactService.updateContact(
      req.params.id,
      req.body.profileId,
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

export const bulkDeleteContacts = async (req: Request, res: Response) => {
  try {
    const { contactIds, profileId } = req.body;

    if (!profileId || !mongoose.Types.ObjectId.isValid(profileId)) {
      return res.status(400).json({ error: 'Invalid profile ID' });
    }

    if (!contactIds || !Array.isArray(contactIds)) {
      return res.status(400).json({ error: 'Invalid contact IDs' });
    }

    for (const id of contactIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: `Invalid contact ID: ${id}` });
      }
    }

    const deletedCount = await ContactService.bulkDeleteContacts(profileId, contactIds);

    return successResponse(res, { deletedCount }, 'Contacts deleted successfully');
  } catch (error) {
    handleErrorResponse(error, res);
  }
}

// Helper function to handle error responses consistently
function handleErrorResponse(error: unknown, res: Response) {
  if (error instanceof Error && error.message === 'Authentication required') {
    return res.status(401).json({ error: error.message });
  }

  const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
  res.status(statusCode).json({
    success: false,
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