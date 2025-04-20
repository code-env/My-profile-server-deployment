import mongoose from 'mongoose';
import { Contact, ProfileType, ContactRelationship, Gender, PhoneType } from '../models/Contact';
import CloudinaryService from './cloudinary.service';
import { ProfileModel } from '../models/profile.model';

class ContactService {
  /**
   * Create a new contact with all the new fields
   */
  async createContact(profileId: string, contactData: Partial<Contact>) {
    // Validate profile exists
    const profile = await ProfileModel.findById(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    // Check if contact phone number matches any registered profile
    const registeredProfile = await ProfileModel.findOne({
      'connections.phoneNumber': contactData.phoneNumber
    }).populate('owner');

    if (registeredProfile) {
      contactData.isRegistered = true;
      contactData.profile = registeredProfile._id as mongoose.Types.ObjectId;
    }

    const contact = new Contact({
      owner: profileId,
      isRegistered: contactData.isRegistered || false,
      profile: contactData.profile || null,
      isFavorite: false,
      profileType: contactData.profileType || ProfileType.Personal,
      relationshipType: contactData.relationshipType,
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
  async getContactById(contactId: string) {
    return Contact.findOne({ _id: contactId })
      .populate({
        path: 'relationshipType',
        model: 'RelationshipType'
      })
      .populate({
        path: 'owner',
        select: 'name profileType profileImage',
        model: 'Profile'
      })
  }

  /**
   * Get all contacts for a profile with strict filter enforcement
   */
  async getUserContacts(
    profileId: string,
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
    // Base query
    const query: any = { owner: profileId };

    // Apply provided filters
    if (filters.isRegistered !== undefined) {
      query.isRegistered = filters.isRegistered;
    }

    if (filters.profileType !== undefined) {
      query.profileType = filters.profileType;
    }

    if (filters.isFavorite !== undefined) {
      query.isFavorite = filters.isFavorite;
    }

    if (filters.gender !== undefined) {
      query.gender = filters.gender;
    }

    if (filters.phoneType !== undefined) {
      query.phoneType = filters.phoneType;
    }

    if (filters.indicatorType !== undefined) {
      query.indicatorType = filters.indicatorType;
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
    }

    const results = await Contact.find(query)
      .sort({ isFavorite: -1, displayName: 1 })
      .populate({
        path: 'relationshipType',
        model: 'RelationshipType',
        select: 'name profileType'
      })
      .populate({
        path: 'owner',
        select: 'name profileType profileImage',
        model: 'Profile'
      });

    return results;
  }

  /**
   * Update a contact with all fields
   */
  async updateContact(contactId: string, profileId: string, updateData: Partial<Contact>) {
    // Handle address updates separately
    if (updateData.address) {
      const contact = await Contact.findOne({ _id: contactId, ownerProfile: profileId });
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
          const typedKey = key as keyof Contact;
          if (key in contact.toObject()) {
            (contact as any)[key] = updateData[key as keyof Contact];
          }
        }
      });

      await contact.save();
      return contact;
    }

    // Standard update for non-address changes
    const contact = await Contact.findOneAndUpdate(
      { _id: contactId, ownerProfile: profileId },
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
  async deleteContact(contactId: string, profileId: string) {
    const result = await Contact.deleteOne({ _id: contactId, ownerProfile: profileId });
    if (result.deletedCount === 0) {
      throw new Error('Contact not found or access denied');
    }
    return true;
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(contactId: string, profileId: string) {
    const contact = await Contact.findOne({ _id: contactId, owner: profileId });
    
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
    profileId: string,
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
        filter: { ownerProfile: profileId, phoneNumber: contact.phoneNumber },
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
            profileType: 'Personal',
          },
          $set: {
            lastSynced: new Date(),
            ...(contact.firstName && { firstName: contact.firstName }),
            ...(contact.lastName && { lastName: contact.lastName })
          }
        },
        upsert: true
      }
    }));

    await Contact.bulkWrite(operations);

    // Update registration status for all synced contacts
    const profileContacts = await Contact.find({ ownerProfile: profileId });
    await Promise.all(profileContacts.map(contact => this.checkContactRegistration(contact)));

    return this.getUserContacts(profileId);
  }

  /**
   * Enhanced contact registration check
   */
  private async checkContactRegistration(contact: Contact) {
    let isRegistered = false;
    let profileId = null;

    // Check by phone number
    const profileByPhone = await ProfileModel.findOne({
      'connections.phoneNumber': contact.phoneNumber
    });
    if (profileByPhone) {
      isRegistered = true;
      profileId = profileByPhone._id;
    } else if (contact.email) {
      // Check by email if phone number didn't match
      const profileByEmail = await ProfileModel.findOne({
        'connections.email': contact.email
      });
      if (profileByEmail) {
        isRegistered = true;
        profileId = profileByEmail._id;
      }
    }

    // Only update if status changed
    if (contact.isRegistered !== isRegistered || contact.profile?.toString() !== profileId?.toString()) {
      contact.isRegistered = isRegistered;
      contact.profile = profileId ? new mongoose.Types.ObjectId(profileId.toString()) : undefined;
      contact.lastSynced = new Date();
      await contact.save();
    }

    return contact;
  }

  /**
   * Get all registered contacts with enhanced data
   */
  async getRegisteredContacts(profileId: string) {
    return Contact.find({ ownerProfile: profileId, isRegistered: true })
      .populate('profile', 'name profileType profileImage')
      .populate('ownerProfile', 'name profileType profileImage');
  }

  /**
   * Update last contacted timestamp
   */
  async updateLastContacted(contactId: string, profileId: string) {
    return Contact.findOneAndUpdate(
      { _id: contactId, ownerProfile: profileId },
      { lastContacted: new Date() },
      { new: true }
    );
  }

  /**
   * Bulk update contact categories
   */
  async bulkUpdateCategories(profileId: string, contactIds: string[], profileType: string) {
    if (!Object.values(ProfileType).includes(profileType as ProfileType)) {
      throw new Error('Invalid profileType');
    }

    const result = await Contact.updateMany(
      { _id: { $in: contactIds }, ownerProfile: profileId },
      { profileType }
    );

    return result.modifiedCount;
  }

  /**
   * Add or update additional indicators
   */
  async updateAdditionalIndicators(contactId: string, profileId: string, indicators: string[]) {
    const contact = await Contact.findOneAndUpdate(
      { _id: contactId, ownerProfile: profileId },
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
   */
  async bulkDeleteContacts(profileId: string, contactIds: string[]) {
    // Validate input
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      throw new Error('No contact IDs provided for deletion');
    }

    // Get contacts with their photo URLs before deletion
    const contactsToDelete = await Contact.find({
      _id: { $in: contactIds },
      ownerProfile: profileId
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
      ownerProfile: profileId
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