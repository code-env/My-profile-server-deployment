import { trackableProfileData, NestedDataMap, DataFieldType } from '../types/data.types'
import {ProfileModel, ProfileDocument as profileDocument} from '../models/profile.model'
import ProfileMetricEntry from '../models/profile.metrics.model'
import mongoose from 'mongoose';
import { Interaction } from '../models/Interaction';

export class ProfileDataService {
  constructor(private profileId: string) {}

 async getProfileData(range: '7d' | '30d' | '1y' = '7d'): Promise<any> {
  const profile = await ProfileModel.findById(this.profileId).lean();

  console.log('profile', this.profileId);
  if (!profile) {
    throw new Error('Profile not found');
  }

  const profileType = profile.profileType;

  const generalSchema = trackableProfileData['general'];
  const typeSchema = trackableProfileData[profileType];

  const data: Record<string, any> = {
    general: await this.extract(profile, generalSchema),
  };

  if (typeSchema) {
    data[profileType] = await this.extract(profile, typeSchema);
  }

  // Collect plottable metrics
  const allMetrics = [
    ...this.collectMetricKeys(generalSchema),
    ...this.collectMetricKeys(typeSchema),
  ];

  const plottableData = await this.getPlottableMetricBatch(allMetrics, range);

  // get interaction stats 
  data.interaction = await this.getInteractionStats(this.profileId);

  // Inject under each category
  data._plottableData = plottableData;

  return {
    profileId: this.profileId,
    profileType,
    data,
  };
}



async getPlottableMetrics(metricKey: string, range: '7d' | '30d' | '1y') {
  const dateRange = this.getDateRange(range);

  const entries = await ProfileMetricEntry.find({
    profileId: this.profileId,
    metric: metricKey,
    timestamp: { $gte: dateRange }
  }).sort({ timestamp: 1 });

  return entries.map(e => ({
    timestamp: e.timestamp,
    value: e.value
  }));
}

private collectMetricKeys(schema: NestedDataMap, prefix = ''): string[] {
  const metrics: string[] = [];

  for (const key in schema) {
    const value = schema[key];
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      metrics.push(fullKey); // e.g., 'Profile.mypts.pointsEarned'
    } else if (typeof value === 'object') {
      metrics.push(...this.collectMetricKeys(value, fullKey));
    }
  }

  return metrics;
}

private async getPlottableMetricBatch(metrics: string[], range: '7d' | '30d' | '1y') {
  const startDate = this.getDateRange(range);
  const entries = await ProfileMetricEntry.find({
    profileId: this.profileId,
    metric: { $in: metrics },
    timestamp: { $gte: startDate },
  }).sort({ timestamp: 1 });

  const grouped: Record<string, Array<{ timestamp: Date; value: number }>> = {};

  for (const metric of metrics) {
    grouped[metric] = entries
      .filter(e => e.metric === metric)
      .map(e => ({ timestamp: e.timestamp, value: e.value }));
  }

  return grouped;
}


private getDateRange(range: string): Date {
  const now = new Date();
  switch (range) {
    case '7d': return new Date(now.setDate(now.getDate() - 7));
    case '30d': return new Date(now.setDate(now.getDate() - 30));
    case '1y': return new Date(now.setFullYear(now.getFullYear() - 1));
    default: return new Date(now.setDate(now.getDate() - 7));
  }
}


  private async extract(profile: any, schema: NestedDataMap): Promise<any> {
    const result: Record<string, any> = {};

    for (const key in schema) {
      const typeOrNested = schema[key];

      if (typeof typeOrNested === 'string') {
        result[key] = this.resolveValue(profile, key, typeOrNested);
      } else if (typeof typeOrNested === 'object') {
        result[key] = await this.extract(profile, typeOrNested);
      }
    }

    return result;
  }

  private resolveValue(profile: any, key: string, type: DataFieldType): any {
    const defaultValue = this.getDefaultValue(type);

    // Preferred lookup order
    const sources = [
      profile.analytics?.Mypts,
      profile.analytics?.Usage,
      profile.analytics?.Profiling,
      profile.analytics?.Products,
      profile.analytics?.Networking,
      profile.analytics?.Circles,
      profile.analytics?.engagement,
      profile.analytics?.plans,
      profile.analytics?.data,
      profile.analytics?.discover,

      profile.ProfileMypts,
      profile.ProfileBadges,
      profile.ProfileCompletion,
      profile.profileInformation,
      profile.ProfileReferal,
      profile.privacySettings,
      profile.ProfileProducts,
      profile.ProfileContactInfo,
      profile.profileLocation,
      profile.ProfileQrCode,
      profile.ProfileFormat,
      profile,
    ];

    for (const source of sources) {
      if (source && key in source) {
        return source[key];
      }
    }

    return defaultValue;
  }

  private getDefaultValue(type: DataFieldType): any {
    switch (type) {
      case 'integer':
      case 'float':
        return 0;
      case 'string':
        return null;
      case 'boolean':
        return false;
      default:
        return null;
    }
  }

  private async getInteractionStats(profileId: string) {
    const profileObjectId = new mongoose.Types.ObjectId(profileId);

    const interactions = await Interaction.find({ profile: profileObjectId }).lean();

    const stats = {
      totalInteractions: 0,
      upcomingInteractions: 0,
      completedInteractions: 0,
    cancelledInteractions: 0,
    autoGeneratedInteractions: 0,

    personalInteractions: 0,
    workInteractions: 0,
    businessInteractions: 0,
    networkingInteractions: 0,

    inPersonInteractions: 0,
    virtualInteractions: 0,

    interactionsWithRewards: 0,
    interactionsWithReminders: 0,
    interactionsWithAttachments: 0,
    interactionsWithLocation: 0,
    interactionsWithContextualEntity: 0,

    mostUsedInteractionMode: '',
    uniqueInteractionPartners: 0,

    averageDaysBetweenContacts: 0,
    lastInteractionDate: null,
    nextScheduledInteractionDate: null,
  };

  const modeCount: Record<string, number> = {};
  const partnerSet = new Set<string>();
  const contactIntervals: number[] = [];
  let lastContactDate = null;
  let nextContactDate = null;

  for (const interaction of interactions) {
    stats.totalInteractions++;

    // Status counts
    switch (interaction.status) {
      case 'upcoming':
        stats.upcomingInteractions++;
        break;
      case 'completed':
        stats.completedInteractions++;
        break;
      case 'cancelled':
        stats.cancelledInteractions++;
        break;
    }

    if (interaction.isAutoGenerated) stats.autoGeneratedInteractions++;

    // Categories
    switch (interaction.category) {
      case 'personal':
        stats.personalInteractions++;
        break;
      case 'work':
        stats.workInteractions++;
        break;
      case 'business':
        stats.businessInteractions++;
        break;
      case 'networking':
        stats.networkingInteractions++;
        break;
    }

    // Mode counts
    if (!modeCount[interaction.mode]) modeCount[interaction.mode] = 0;
    modeCount[interaction.mode]++;

    // Mode categorization
    if (interaction.isPhysical || interaction.mode === 'in_person') {
      stats.inPersonInteractions++;
    } else {
      stats.virtualInteractions++;
    }

    // Target profiles
    if (interaction.targetProfile) {
      partnerSet.add(interaction.targetProfile.toString());
    }

    // Data presence
    if (interaction.reward) stats.interactionsWithRewards++;
    if (interaction.reminders && interaction.reminders.length > 0) stats.interactionsWithReminders++;
    if (interaction.attachments && interaction.attachments.length > 0) stats.interactionsWithAttachments++;
    if (interaction.location?.address || interaction.location?.coordinates?.lat) stats.interactionsWithLocation++;
    if (interaction.context?.entityId) stats.interactionsWithContextualEntity++;

    // Dates
    if (!lastContactDate || new Date(interaction.lastContact) > new Date(lastContactDate)) {
      lastContactDate = interaction.lastContact;
    }

    if (
      interaction.nextContact &&
      (!nextContactDate || new Date(interaction.nextContact) < new Date(nextContactDate))
    ) {
      nextContactDate = interaction.nextContact;
    }

    if (interaction.lastContact && interaction.nextContact) {
      const days = Math.abs(
        (new Date(interaction.nextContact).getTime() - new Date(interaction.lastContact).getTime()) / (1000 * 60 * 60 * 24)
      );
      contactIntervals.push(days);
    }
  }

  // Post-process
  const mostUsed = Object.entries(modeCount).sort((a, b) => b[1] - a[1])[0];
  stats.mostUsedInteractionMode = mostUsed ? mostUsed[0] : '';
  stats.uniqueInteractionPartners = partnerSet.size;
  stats.averageDaysBetweenContacts = contactIntervals.length
    ? parseFloat((contactIntervals.reduce((a, b) => a + b) / contactIntervals.length).toFixed(1))
    : 0;
  stats.lastInteractionDate = lastContactDate ? new Date(lastContactDate).toISOString() : null as any ;
  stats.nextScheduledInteractionDate = nextContactDate ? new Date(nextContactDate).toISOString() : null as any;

  return stats;
}

}


// example response structure for getProfileData

// {
//   "profileId": "665afbc27f9f3e98b9e4123a",
//   "profileType": "academic",
//   "data": {
//     "general": {
//       "Profile": {
//         "profileViews": 1234,
//         "profileCompletionPercentage": 94,
//         "numberOfBadges": 7,
//         "engagement": {
//           "numberOfLikes": 420,
//           "numberOfShares": 185,
//           "numberOfComments": 90,
//           "numberOfPosts": 36,
//           "numberOfGroupsJoined": 3,
//           "numberOfEventsAttended": 12,
//           "numberOfMessagesSent": 150,
//           "numberOfMessagesReceived": 140,
//           "numberOfFollowing": 98
//         },
//         "mypts": {
//           "pointsEarned": 860,
//           "pointsSpent": 120,
//           "pointsRedeemed": 180,
//           "pointsBalance": 560
//         },
//         "LinkedProducts": {
//           "numberOfProducts": 5,
//           "numberOfActiveProducts": 3,
//           "numberOfSoldProducts": 1,
//           "numberOfReturnedProducts": 0,
//           "numberOfReviewedProducts": 4
//         },
//         "Circles": {
//           "numberOfConnections": 42,
//           "numberofAffiliations": 6,
//           "numberofPendingConnections": 2,
//           "numberOfPendingAffiliations": 1,
//           "numberOfPendingInvitations": 3,
//           "numberOfContacts": 87
//         }
//       },
//       "Plans": {
//         "numberOfPlans": 12,
//         "numberOfActivePlans": 6,
//         "numberOfEvents": 8,
//         "numberOfTasks": 14,
//         "numberOfReminders": 7,
//         "numberOfNotes": 9,
//         "numberOfActiveTasters": 3,
//         "numberOfPendingEvents": 2,
//         "numberOfCancelledEvents": 1,
//         "numberOfCompletedEvents": 5,
//         "numberOfPastEvents": 4
//       },
//       "Vault": {
//         "numberofDocuments": 48,
//         "numberOfImages": 12,
//         "numberOfVideos": 3,
//         "numberOfAudioFiles": 1,
//         "numberOfFiles": 64,
//         "amountOfStorageUsed": 250.75,
//         "amountOfStorageAvailable": 749.25
//       }
//     },
//     "academic": {
//       "gpa": 3.87,
//       "numberOfCoursesTaken": 42,
//       "certifications": 5,
//       "languagesSpoken": 3,
//       "awards": 4,
//       "examsTaken": 12,
//       "academicPublications": 6
//     },
//     "interaction": {
//       "totalInteractions": 31,
//       "upcomingInteractions": 3,
//       "completedInteractions": 21,
//       "cancelledInteractions": 2,
//       "autoGeneratedInteractions": 5,
//       "personalInteractions": 6,
//       "workInteractions": 9,
//       "businessInteractions": 10,
//       "networkingInteractions": 6,
//       "inPersonInteractions": 13,
//       "virtualInteractions": 18,
//       "interactionsWithRewards": 4,
//       "interactionsWithReminders": 11,
//       "interactionsWithAttachments": 9,
//       "interactionsWithLocation": 6,
//       "interactionsWithContextualEntity": 5,
//       "mostUsedInteractionMode": "email",
//       "uniqueInteractionPartners": 17,
//       "averageDaysBetweenContacts": 10.4,
//       "lastInteractionDate": "2024-05-19T15:45:00.000Z",
//       "nextScheduledInteractionDate": "2024-06-05T09:00:00.000Z"
//     },
//     "_plottableData": {
//       "Profile.mypts.pointsEarned": {
//         "label": "MyPts Earned",
//         "unit": "pts",
//         "data": [
//           { "timestamp": "2024-05-15T00:00:00Z", "label": "15 May", "value": 45 },
//           { "timestamp": "2024-05-16T00:00:00Z", "label": "16 May", "value": 70 },
//           { "timestamp": "2024-05-17T00:00:00Z", "label": "17 May", "value": 60 },
//           { "timestamp": "2024-05-18T00:00:00Z", "label": "18 May", "value": 90 },
//           { "timestamp": "2024-05-19T00:00:00Z", "label": "19 May", "value": 100 }
//         ]
//       },
//       "Profile.mypts.pointsRedeemed": {
//         "label": "MyPts Redeemed",
//         "unit": "pts",
//         "data": [
//           { "timestamp": "2024-05-16T00:00:00Z", "label": "16 May", "value": 10 },
//           { "timestamp": "2024-05-17T00:00:00Z", "label": "17 May", "value": 20 },
//           { "timestamp": "2024-05-18T00:00:00Z", "label": "18 May", "value": 15 },
//           { "timestamp": "2024-05-19T00:00:00Z", "label": "19 May", "value": 25 }
//         ]
//       }
//     }
//   }
// }
