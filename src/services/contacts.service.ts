import mongoose from 'mongoose';
import { Contact, ContactCategory } from '../models/Contact';
import { IContact } from '../models/Contact';
import { User } from '../models/User';

class ContactService {
  /**
   * Create a new contact
   */
  async createContact(userId: string, contactData: Partial<IContact>) {
    const contact = new Contact({
      owner: userId,
      ...contactData,
      source: contactData.source || 'Manual'
    });

    await contact.save();
    return contact;
  }

  /**
   * Get a contact by ID
   */
  async getContactById(contactId: string, userId: string) {
    return Contact.findOne({ _id: contactId, owner: userId });
  }

  /**
   * Get all contacts for a user with optional filters
   */
  async getUserContacts(
    userId: string,
    filters: {
      isRegistered?: boolean;
      category?: string;
      search?: string;
      isFavorite?: boolean;
    } = {}
  ) {
    const query: any = { owner: userId };

    if (filters.isRegistered !== undefined) {
      query.isRegistered = filters.isRegistered;
    }

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.isFavorite !== undefined) {
      query.isFavorite = filters.isFavorite;
    }

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    return Contact.find(query).sort({ isFavorite: -1, displayName: 1 });
  }

  /**
   * Update a contact
   */
  async updateContact(contactId: string, userId: string, updateData: Partial<IContact>) {
    const contact = await Contact.findOneAndUpdate(
      { _id: contactId, owner: userId },
      updateData,
      { new: true }
    );

    if (!contact) {
      throw new Error('Contact not found or access denied');
    }

    return contact;
  }

  /**
   * Delete a contact
   */
  async deleteContact(contactId: string, userId: string) {
    const result = await Contact.deleteOne({ _id: contactId, owner: userId });
    if (result.deletedCount === 0) {
      throw new Error('Contact not found or access denied');
    }
    return true;
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(contactId: string, userId: string) {
    const contact = await Contact.findOne({ _id: contactId, owner: userId });
    if (!contact) {
      throw new Error('Contact not found or access denied');
    }

    contact.isFavorite = !contact.isFavorite;
    await contact.save();
    return contact;
  }

  /**
   * Sync contacts with external source (e.g., phone contacts)
   */
  async syncContacts(
    userId: string,
    contacts: Array<{
      firstName: string;
      lastName?: string;
      phoneNumber: string;
      email?: string;
    }>
  ) {
    const operations = contacts.map(contact => ({
      updateOne: {
        filter: { owner: userId, phoneNumber: contact.phoneNumber },
        update: {
          $setOnInsert: {
            firstName: contact.firstName,
            lastName: contact.lastName || '',
            phoneNumber: contact.phoneNumber,
            email: contact.email,
            source: 'Synced',
            isRegistered: false,
            category: 'Other'
          },
          $set: {
            lastSynced: new Date()
          }
        },
        upsert: true
      }
    }));

    await Contact.bulkWrite(operations);

    // Update registration status for all synced contacts
    const userContacts = await Contact.find({ owner: userId });
    await Promise.all(userContacts.map(contact => this.checkContactRegistration(contact)));

    return this.getUserContacts(userId);
  }

  /**
   * Check if a contact is registered in the system
   */
  private async checkContactRegistration(contact: IContact) {
    let isRegistered = false;
    let profileId = null;

    // Check by phone number
    const userByPhone = await User.findOne({ phoneNumber: contact.phoneNumber });
    if (userByPhone) {
      isRegistered = true;
      profileId = userByPhone.profiles[0]; // Or find appropriate profile
    } else if (contact.email) {
      // Check by email if phone number didn't match
      const userByEmail = await User.findOne({ email: contact.email });
      if (userByEmail) {
        isRegistered = true;
        profileId = userByEmail.profiles[0];
      }
    }

    // Only update if status changed
    if (contact.isRegistered !== isRegistered || contact.profile?.toString() !== profileId?.toString()) {
      contact.isRegistered = isRegistered;
      contact.profile = profileId ?? undefined;
      contact.lastSynced = new Date();
      await contact.save();
    }

    return contact;
  }

  /**
   * Get all registered contacts (contacts that have profiles in the system)
   */
  async getRegisteredContacts(userId: string) {
    return Contact.find({ owner: userId, isRegistered: true }).populate('profile');
  }

  /**
   * Update last contacted timestamp
   */
  async updateLastContacted(contactId: string, userId: string) {
    return Contact.findOneAndUpdate(
      { _id: contactId, owner: userId },
      { lastContacted: new Date() },
      { new: true }
    );
  }

  /**
   * Bulk update contact categories
   */
  async bulkUpdateCategories(userId: string, contactIds: string[], category: string) {
    if (!Object.values(ContactCategory).includes(category as ContactCategory)) {
      throw new Error('Invalid category');
    }

    const result = await Contact.updateMany(
      { _id: { $in: contactIds }, owner: userId },
      { category }
    );

    return result.modifiedCount;
  }
}

export default new ContactService();