import contactsService from '../services/contacts.service';
import type { User } from '../models/User';
import { Request, Response } from 'express';

// Helper function to validate user authentication
const validateAuthenticatedUser = (req: Request): string => {
  if (!req.user || !req.user._id) {
    throw new Error('Authentication required');
  }
  return req.user._id;
};

export const createContact = async (req: Request, res: Response) => {
  try {
    const userId = validateAuthenticatedUser(req);
    
    // Validate required fields
    if (!req.body.firstName || !req.body.phoneNumber) {
      return res.status(400).json({ error: 'firstName and phoneNumber are required' });
    }

    const contact = await contactsService.createContact(userId, req.body);
    res.status(201).json(contact);
  } catch (error instanceof Error) {
    if (error.message === 'Authentication required') {
      return res.status(401).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
};

export const getContactById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = validateAuthenticatedUser(req);
    
    // Validate contact ID
    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    const contact = await ContactService.getContactById(req.params.id, userId);
    
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.json(contact);
  } catch (error) {
    if (error.message === 'Authentication required') {
      return res.status(401).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

export const getUserContacts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = validateAuthenticatedUser(req);
    const { isRegistered, category, search, isFavorite } = req.query;
    
    // Validate category if provided
    if (category && !Object.values(ContactCategory).includes(category as ContactCategory)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const contacts = await ContactService.getUserContacts(userId, {
      isRegistered: isRegistered === 'true',
      category: category as string,
      search: search as string,
      isFavorite: isFavorite === 'true'
    });
    
    res.json(contacts);
  } catch (error) {
    if (error.message === 'Authentication required') {
      return res.status(401).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

export const updateContact = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = validateAuthenticatedUser(req);
    
    // Validate contact ID
    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    // Validate category if provided in update
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
    
    res.json(updatedContact);
  } catch (error) {
    if (error.message === 'Authentication required') {
      return res.status(401).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
};

export const deleteContact = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = validateAuthenticatedUser(req);
    
    // Validate contact ID
    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    const result = await ContactService.deleteContact(req.params.id, userId);
    
    if (!result) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    if (error.message === 'Authentication required') {
      return res.status(401).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
};

export const toggleFavorite = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = validateAuthenticatedUser(req);
    
    // Validate contact ID
    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    const contact = await ContactService.toggleFavorite(req.params.id, userId);
    
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.json(contact);
  } catch (error) {
    if (error.message === 'Authentication required') {
      return res.status(401).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
};

export const syncContacts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = validateAuthenticatedUser(req);
    const { contacts } = req.body;
    
    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({ error: 'Invalid contacts data' });
    }
    
    // Validate each contact in the array
    for (const contact of contacts) {
      if (!contact.phoneNumber || typeof contact.phoneNumber !== 'string') {
        return res.status(400).json({ error: 'Each contact must have a phoneNumber' });
      }
    }

    const syncedContacts = await ContactService.syncContacts(userId, contacts);
    res.json(syncedContacts);
  } catch (error) {
    if (error.message === 'Authentication required') {
      return res.status(401).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

export const getRegisteredContacts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = validateAuthenticatedUser(req);
    const contacts = await ContactService.getRegisteredContacts(userId);
    res.json(contacts);
  } catch (error) {
    if (error.message === 'Authentication required') {
      return res.status(401).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

export const updateLastContacted = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = validateAuthenticatedUser(req);
    
    // Validate contact ID
    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    const contact = await ContactService.updateLastContacted(req.params.id, userId);
    
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.json(contact);
  } catch (error) {
    if (error.message === 'Authentication required') {
      return res.status(401).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
};

export const bulkUpdateCategories = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = validateAuthenticatedUser(req);
    const { contactIds, category } = req.body;
    
    if (!contactIds || !Array.isArray(contactIds)) {
      return res.status(400).json({ error: 'Invalid contact IDs' });
    }
    
    // Validate each contact ID
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
    if (error.message === 'Authentication required') {
      return res.status(401).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
};