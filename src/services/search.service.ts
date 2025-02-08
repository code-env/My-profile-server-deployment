import mongoose from 'mongoose';
import { ProfileModel } from '../models/profile.model';
import { Connection } from '../models/Connection';
import { logger } from '../utils/logger';

export class SearchService {
  static async searchProfiles(
    query: string,
    userId?: string,
    options: {
      page?: number;
      limit?: number;
      filters?: {
        profileType?: string[];
        skills?: string[];
        location?: string;
        industry?: string[];
      };
    } = {}
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 10;
      const skip = (page - 1) * limit;

      // Base search criteria
      const searchCriteria: any = {
        'privacySettings.searchable': true,
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { 'skills.name': { $regex: query, $options: 'i' } },
          { 'personalInfo.location': { $regex: query, $options: 'i' } }
        ]
      };

      // Add filters if provided
      if (options.filters) {
        if (options.filters.profileType) {
          searchCriteria.profileType = { $in: options.filters.profileType };
        }
        if (options.filters.skills) {
          searchCriteria['skills.name'] = { $in: options.filters.skills };
        }
        if (options.filters.location) {
          searchCriteria['personalInfo.location'] = { 
            $regex: options.filters.location, 
            $options: 'i' 
          };
        }
        if (options.filters.industry) {
          searchCriteria.industry = { $in: options.filters.industry };
        }
      }

      // If user is logged in, include private profiles they're connected to
      if (userId) {
        const userConnections = await Connection.find({
          fromUser: userId,
          status: 'accepted'
        }).select('toProfile');

        const connectedProfileIds = userConnections.map(conn => conn.toProfile);

        searchCriteria.$or.push({
          $and: [
            { _id: { $in: connectedProfileIds } },
            { 'privacySettings.visibility': 'connections' }
          ]
        });
      }

      // Only include public profiles or profiles the user is connected to
      searchCriteria.$and = [{
        $or: [
          { 'privacySettings.visibility': 'public' },
          ...(userId ? [{
            $and: [
              { 'privacySettings.visibility': 'connections' },
              { _id: { $in: await this.getConnectedProfileIds(userId) } }
            ]
          }] : [])
        ]
      }];

      // Execute search
      const profiles = await ProfileModel.find(searchCriteria)
        .select(this.getVisibleFields(userId))
        .skip(skip)
        .limit(limit)
        .populate('owner', 'username email')
        .lean();

      // Get total count for pagination
      const total = await ProfileModel.countDocuments(searchCriteria);

      return {
        profiles,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit
        }
      };
    } catch (error) {
      logger.error('Error in searchProfiles:', error);
      throw error;
    }
  }

  private static async getConnectedProfileIds(userId: string): Promise<mongoose.Types.ObjectId[]> {
    const connections = await Connection.find({
      fromUser: userId,
      status: 'accepted'
    }).select('toProfile');
    
    return connections.map(conn => conn.toProfile);
  }

  private static getVisibleFields(userId?: string) {
    // Base fields that are always visible
    const baseFields = [
      'name',
      'description',
      'profileType',
      'industry',
      'skills',
      'stats',
      'privacySettings.visibility',
      'personalInfo.location'
    ];

    // Additional fields for authenticated users
    if (userId) {
      baseFields.push(
        'personalInfo.firstName',
        'personalInfo.lastName',
        'personalInfo.headline',
        'personalInfo.bio',
        'education',
        'experience'
      );
    }

    return baseFields.join(' ');
  }
}
