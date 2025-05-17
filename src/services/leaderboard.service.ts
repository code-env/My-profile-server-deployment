import mongoose from 'mongoose';
import { LeaderboardEntryModel } from '../models/gamification/leaderboard.model';
import { ProfileMilestoneModel } from '../models/gamification/profile-milestone.model';
import { ProfileBadgeModel } from '../models/gamification/profile-badge.model';
import { MyPtsModel } from '../models/my-pts.model';
import { ProfileModel } from '../models/profile.model';
import { MilestoneLevel } from '../interfaces/gamification.interface';
import { logger } from '../utils/logger';

export class LeaderboardService {
  /**
   * Update the entire leaderboard
   * This should be run periodically (e.g., daily) as a scheduled job
   */
  async updateLeaderboard(): Promise<void> {
    try {
      logger.info('Starting leaderboard update');
      
      // Get current leaderboard for tracking rank changes
      const currentLeaderboard = await LeaderboardEntryModel.find().sort({ rank: 1 });
      const currentRanks = new Map<string, number>();
      
      currentLeaderboard.forEach((entry) => {
        currentRanks.set(entry.profileId.toString(), entry.rank);
      });
      
      // Get all profiles with MyPts
      const myPtsProfiles = await MyPtsModel.find()
        .sort({ balance: -1 })
        .populate('profileId', 'profileInformation.username ProfileFormat.profileImage');
      
      // Create new leaderboard entries
      const newEntries = [];
      let rank = 1;
      
      for (const myPts of myPtsProfiles) {
        if (!myPts.profileId) continue;
        
        const profileId = myPts.profileId._id;
        const profile = myPts.profileId as any;
        
        // Get milestone level
        const milestone = await ProfileMilestoneModel.findOne({ profileId });
        const milestoneLevel = milestone?.currentLevel || MilestoneLevel.STARTER;
        
        // Count badges
        const badgeCount = await ProfileBadgeModel.countDocuments({
          profileId,
          isCompleted: true
        });
        
        // Get previous rank
        const previousRank = currentRanks.get(profileId.toString());
        
        // Create or update leaderboard entry
        const entry = {
          profileId,
          username: profile.profileInformation?.username || 'Unknown',
          profileImage: profile.ProfileFormat?.profileImage || null,
          myPtsBalance: myPts.balance,
          milestoneLevel,
          rank,
          previousRank,
          badgeCount
        };
        
        newEntries.push(entry);
        rank++;
      }
      
      // Clear existing leaderboard and insert new entries
      await LeaderboardEntryModel.deleteMany({});
      
      if (newEntries.length > 0) {
        await LeaderboardEntryModel.insertMany(newEntries);
      }
      
      logger.info(`Leaderboard updated with ${newEntries.length} entries`);
    } catch (error) {
      logger.error('Error updating leaderboard:', error);
      throw error;
    }
  }

  /**
   * Get the top entries from the leaderboard
   * @param limit Maximum number of entries to return
   * @returns Top leaderboard entries
   */
  async getTopEntries(limit: number = 100): Promise<any[]> {
    try {
      const entries = await LeaderboardEntryModel.getTopEntries(limit);
      
      // Enrich with additional profile data
      return await this.enrichLeaderboardEntries(entries);
    } catch (error) {
      logger.error('Error getting top leaderboard entries:', error);
      throw error;
    }
  }

  /**
   * Get leaderboard entries for a specific milestone level
   * @param level Milestone level
   * @param limit Maximum number of entries to return
   * @returns Leaderboard entries for the milestone
   */
  async getEntriesByMilestone(level: MilestoneLevel, limit: number = 100): Promise<any[]> {
    try {
      const entries = await LeaderboardEntryModel.getEntriesByMilestone(level, limit);
      
      // Enrich with additional profile data
      return await this.enrichLeaderboardEntries(entries);
    } catch (error) {
      logger.error(`Error getting leaderboard entries for milestone ${level}:`, error);
      throw error;
    }
  }

  /**
   * Get a profile's rank on the leaderboard
   * @param profileId Profile ID
   * @returns The profile's leaderboard entry, or null if not ranked
   */
  async getProfileRank(profileId: mongoose.Types.ObjectId | string): Promise<any | null> {
    try {
      const profileObjectId = new mongoose.Types.ObjectId(profileId.toString());
      const entry = await LeaderboardEntryModel.getProfileRank(profileObjectId);
      
      if (!entry) {
        return null;
      }
      
      // Get surrounding entries for context
      const surroundingEntries = await LeaderboardEntryModel.find({
        rank: { $gte: Math.max(1, entry.rank - 2), $lte: entry.rank + 2 }
      }).sort({ rank: 1 });
      
      // Enrich entries
      const enrichedEntries = await this.enrichLeaderboardEntries(surroundingEntries);
      
      // Find the profile's entry in the enriched list
      const enrichedEntry = enrichedEntries.find(
        (e) => e.profileId.toString() === profileObjectId.toString()
      );
      
      return {
        entry: enrichedEntry,
        surroundingEntries: enrichedEntries
      };
    } catch (error) {
      logger.error(`Error getting rank for profile ${profileId}:`, error);
      throw error;
    }
  }

  /**
   * Enrich leaderboard entries with additional profile data
   * @param entries Leaderboard entries to enrich
   * @returns Enriched entries
   */
  private async enrichLeaderboardEntries(entries: any[]): Promise<any[]> {
    try {
      return entries.map((entry) => {
        const rankChange = entry.previousRank
          ? entry.previousRank - entry.rank
          : 0;
        
        return {
          ...entry.toObject(),
          rankChange
        };
      });
    } catch (error) {
      logger.error('Error enriching leaderboard entries:', error);
      throw error;
    }
  }
}
