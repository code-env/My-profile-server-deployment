import mongoose from 'mongoose';
import { Contact, ProfileType, ContactRelationship, Gender, PhoneType } from '../models/Contact';
import { IContact } from '../models/Contact';
import { User } from '../models/User';
import CloudinaryService from './cloudinary.service';

class ContactService {
  /**
   * Create a new contact with all the new fields
   */
  async createContact(userId: string, contactData: Partial<IContact>) {

    // look for existing profile by phone number
    const profile = await User.findOne({ phoneNumber: contactData.phoneNumber });

    console.log('profile:', profile);
    if (profile) {
      contactData.isRegistered = true;
      contactData.profile = profile._id;
    }


    const contact = new Contact({
      owner: userId,
      isRegistered: contactData.isRegistered || false,
      profile: contactData.profile || null,
      isFavorite: false,
      profileType: contactData.profileType || ProfileType.Personal,
      relationShip: contactData.relationshipType,

      source: 'Manual',
      ...contactData,
      // Handle address subdocument
      address: contactData.address ? {
        street: contactData.address.street,
        city: contactData.address.city,
        state: contactData.address.state,
        postalCode: contactData.address.postalCode,
        country: contactData.address.country
      } : undefined
    });

    await contact.save();
    return contact;
  }

  /**
   * Get a contact by ID with all fields
   */
  async getContactById(contactId: string, userId: string) {
    console.log('Fetching contact with ID:', contactId, 'for user:', userId);
    return Contact.findOne({ _id: contactId, owner: userId })
      //load the user that is having the owner
      .populate({
        'path': 'relationshipType',
        'model': 'RelationshipType'
      })
      .populate({
        'path': 'owner',
        'select': 'firstName lastName email phoneNumber',
        'model': 'Users'
      })
      .populate({
        'path': 'profile',
        'select': 'firstName lastName email phoneNumber',
        'model': 'Users'
      })
  }

  /**
 * Get all contacts for a user with strict filter enforcement.
 * Only explicitly provided filters will be applied.
 */
  async getUserContacts(
    userId: string,
    filters: {
      isRegistered?: boolean;
      profileType?: string;
      search?: string;
      isFavorite?: boolean;
      gender?: Gender;
      phoneType?: PhoneType;
      indicatorType?: string;
    } = {}
  ) {
    // 1. Start with base query
    const query: any = { owner: userId };

    // 2. Log incoming filters for debugging
    console.log('Incoming filters:', JSON.stringify(filters, null, 2));

    // 3. Apply ONLY provided filters
    if (filters.isRegistered !== undefined) {
      query.isRegistered = filters.isRegistered;
      console.log('Applied isRegistered filter:', filters.isRegistered);
    }

    if (filters.profileType !== undefined) {
      query.profileType = filters.profileType;
      console.log('Applied profileType filter:', filters.profileType);
    }

    if (filters.isFavorite !== undefined) {
      query.isFavorite = filters.isFavorite;
      console.log('Applied isFavorite filter:', filters.isFavorite);
    }

    if (filters.gender !== undefined) {
      query.gender = filters.gender;
      console.log('Applied gender filter:', filters.gender);
    }

    if (filters.phoneType !== undefined) {
      query.phoneType = filters.phoneType;
      console.log('Applied phoneType filter:', filters.phoneType);
    }

    if (filters.indicatorType !== undefined) {
      query.indicatorType = filters.indicatorType;
      console.log('Applied indicatorType filter:', filters.indicatorType);
    }

    if (filters.search !== undefined && filters.search.trim() !== '') {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { displayName: searchRegex },
        { phoneNumber: searchRegex },
        { email: searchRegex }
      ];
      console.log('Applied search filter:', filters.search);
    }

    console.log('Final MongoDB query:', JSON.stringify(query, null, 2));

    const results = await Contact.find(query)
      .sort({ isFavorite: -1, displayName: 1 })
      .populate({
        path: 'relationshipType',
        model: 'RelationshipType',
        select: 'name profileType'
      })
      .populate({
        path: 'owner',
        select: 'firstName lastName email phoneNumber',
        model: 'Users'
      })
      .populate({
        path: 'profile',
        select: 'firstName lastName email phoneNumber',
        model: 'Users'
      });

    return results;
  }

  /**
   * Update a contact with all fields
   */
  async updateContact(contactId: string, userId: string, updateData: Partial<IContact>) {
    // Handle address updates separately
    if (updateData.address) {
      const contact = await Contact.findOne({ _id: contactId, owner: userId });
      if (!contact) {
        throw new Error('Contact not found or access denied');
      }

      // Merge existing address with updates
      contact.address = {
        ...(contact.address || {}),
        ...updateData.address
      };

      // Update other fields
      Object.keys(updateData).forEach((key) => {
        if (key !== 'address' && key !== '_id') {
          const typedKey = key as keyof IContact;
          if (key in contact.toObject()) {
            (contact as any)[key] = updateData[key as keyof IContact];
          }
        }
      });

      await contact.save();
      return contact;
    }

    // Standard update for non-address changes
    const contact = await Contact.findOneAndUpdate(
      { _id: contactId, owner: userId },
      updateData,
      { new: true, runValidators: true }
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

    console.log("Contact Found:", contact);
    
    if (!contact) {
      throw new Error('Contact not found or access denied');
    }

    contact.isFavorite = !contact.isFavorite;
    await contact.save();
    return contact;
  }

  /**
   * Enhanced sync contacts with all fields
   */
  async syncContacts(
    userId: string,
    contacts: Array<{
      firstName: string;
      middleName?: string;
      lastName?: string;
      suffix?: string;
      phoneNumber: string;
      phoneType?: PhoneType;
      email?: string;
      gender?: Gender;
      address?: {
        street?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
      };
    }>
  ) {
    const operations = contacts.map(contact => ({
      updateOne: {
        filter: { owner: userId, phoneNumber: contact.phoneNumber },
        update: {
          $setOnInsert: {
            firstName: contact.firstName,
            middleName: contact.middleName,
            lastName: contact.lastName,
            suffix: contact.suffix,
            phoneNumber: contact.phoneNumber,
            phoneType: contact.phoneType,
            email: contact.email,
            gender: contact.gender,
            address: contact.address,
            source: 'Synced',
            isRegistered: false,
            prfileType: 'Personal',
          },
          $set: {
            lastSynced: new Date(),
            // Update these fields if they exist in the incoming contact
            ...(contact.firstName && { firstName: contact.firstName }),
            ...(contact.lastName && { lastName: contact.lastName })
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
   * Enhanced contact registration check
   */
  private async checkContactRegistration(contact: IContact) {
    let isRegistered = false;
    let profileId = null;

    // Check by phone number
    const userByPhone = await User.findOne({ phoneNumber: contact.phoneNumber });
    if (userByPhone) {
      isRegistered = true;
      profileId = userByPhone.profiles[0];
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
   * Get all registered contacts with enhanced data
   */
  async getRegisteredContacts(userId: string) {
    return Contact.find({ owner: userId, isRegistered: true })
      .populate('profile')
      .populate('owner', '-password');
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
  async bulkUpdateCategories(userId: string, contactIds: string[], profileType: string) {
    if (!Object.values(ProfileType).includes(profileType as ProfileType)) {
      throw new Error('Invalid profileTYpe');
    }

    const result = await Contact.updateMany(
      { _id: { $in: contactIds }, owner: userId },
      { profileType }
    );

    return result.modifiedCount;
  }

  /**
   * Add or update additional indicators
   */
  async updateAdditionalIndicators(contactId: string, userId: string, indicators: string[]) {
    const contact = await Contact.findOneAndUpdate(
      { _id: contactId, owner: userId },
      { additionalIndicators: indicators },
      { new: true }
    );

    if (!contact) {
      throw new Error('Contact not found or access denied');
    }

    return contact;
  }

   /**
   * Bulk delete contacts and their associated images from Cloudinary
   * @param userId The owner's user ID
   * @param contactIds Array of contact IDs to delete
   * @returns Object containing deletion stats
   */
   async bulkDeleteContacts(userId: string, contactIds: string[]) {
    // Validate input
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      throw new Error('No contact IDs provided for deletion');
    }

    // Get contacts with their photo URLs before deletion
    const contactsToDelete = await Contact.find({
      _id: { $in: contactIds },
      owner: userId
    }).select('_id photo');

    if (contactsToDelete.length === 0) {
      throw new Error('No matching contacts found for deletion');
    }

    // Extract photo URLs for contacts that have them
    const photosToDelete = contactsToDelete
      .filter(contact => contact.photo && typeof contact.photo === 'string')
      .map(contact => contact.photo as string);

    // Delete contacts from database
    const deleteResult = await Contact.deleteMany({
      _id: { $in: contactIds },
      owner: userId
    });

    // Delete associated images from Cloudinary (if any)
    if (photosToDelete.length > 0) {
      try {
        const cloudinary = new CloudinaryService();
        await Promise.all(
          photosToDelete.map(url => cloudinary.delete(url))
        );
        console.log(`Successfully deleted ${photosToDelete.length} images from Cloudinary`);
      } catch (cloudinaryError) {
        console.error('Error deleting images from Cloudinary:', cloudinaryError);
        // We don't throw here because the contacts were already deleted
        // You might want to log this to an error tracking system
      }
    }

    return {
      deletedCount: deleteResult.deletedCount,
      imageDeleteCount: photosToDelete.length,
      message: `Successfully deleted ${deleteResult.deletedCount} contacts and ${photosToDelete.length} associated images`
    };
  }
}

export default new ContactService();