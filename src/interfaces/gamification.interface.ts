import mongoose from 'mongoose';

/**
 * Milestone levels for user progression based on MyPts accumulation
 */
export enum MilestoneLevel {
  STARTER = 'Starter',
  EXPLORER = 'Explorer',
  ACHIEVER = 'Achiever',
  LEADER = 'Leader',
  VISIONARY = 'Visionary',
  LEGEND = 'Legend'
}

/**
 * MyPts thresholds for each milestone level
 */
export const MILESTONE_THRESHOLDS = {
  [MilestoneLevel.STARTER]: 0,
  [MilestoneLevel.EXPLORER]: 10000,
  [MilestoneLevel.ACHIEVER]: 500000,
  [MilestoneLevel.LEADER]: 1000000,
  [MilestoneLevel.VISIONARY]: 5000000,
  [MilestoneLevel.LEGEND]: 10000000
};

/**
 * Badge categories
 */
export enum BadgeCategory {
  MYPTS = 'MyPts',
  PLATFORM_USAGE = 'Platform Usage',
  PROFILE_COMPLETION = 'Profile Completion',
  PRODUCTS = 'Products',
  NETWORKING = 'Networking',
  CIRCLE = 'Circle',
  ENGAGEMENT = 'Engagement',
  PLANS = 'Plans',
  DATA = 'Data',
  VAULT = 'Vault',
  DISCOVER = 'Discover'
}

/**
 * Badge rarity levels
 */
export enum BadgeRarity {
  COMMON = 'Common',
  UNCOMMON = 'Uncommon',
  RARE = 'Rare',
  EPIC = 'Epic',
  LEGENDARY = 'Legendary'
}

/**
 * Badge interface
 */
export interface IBadge {
  _id?: mongoose.Types.ObjectId;
  name: string;
  description: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  icon: string;
  requirements: {
    type: string;
    threshold: number;
    condition?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * User badge progress interface
 */
export interface IUserBadge {
  badgeId: mongoose.Types.ObjectId;
  progress: number;
  isCompleted: boolean;
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Profile milestone interface
 */
export interface IProfileMilestone {
  profileId: mongoose.Types.ObjectId;
  currentLevel: MilestoneLevel;
  currentPoints: number;
  nextLevel: MilestoneLevel | null;
  nextLevelThreshold: number | null;
  progress: number; // Percentage to next level (0-100)
  milestoneHistory: {
    level: MilestoneLevel;
    achievedAt: Date;
  }[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Leaderboard entry interface
 */
export interface ILeaderboardEntry {
  profileId: mongoose.Types.ObjectId;
  username: string;
  profileImage?: string;
  myPtsBalance: number;
  milestoneLevel: MilestoneLevel;
  rank: number;
  previousRank?: number;
  badgeCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Activity reward configuration interface
 */
export interface IActivityReward {
  activityType: string;
  description: string;
  category: BadgeCategory;
  pointsRewarded: number;
  cooldownPeriod?: number; // In hours, 0 means one-time only
  maxRewardsPerDay?: number; // Limit per day, null means unlimited
  isEnabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * User activity tracking interface
 */
export interface IUserActivity {
  profileId: mongoose.Types.ObjectId;
  activityType: string;
  timestamp: Date;
  pointsEarned: number;
  metadata?: Record<string, any>;
}

/**
 * Analytics dashboard data interface
 */
export interface IAnalyticsDashboard {
  profileId: mongoose.Types.ObjectId;
  myPts: {
    currentBalance: number;
    lifetimeEarned: number;
    lifetimeSpent: number;
    transactions: {
      date: Date;
      amount: number;
      type: string;
    }[];
  };
  usage: {
    loginStamps: number;
    rewardsClaimed: number;
    badgesEarned: number;
    milestonesReached: number;
    activityHistory: {
      date: Date;
      activityType: string;
      pointsEarned: number;
    }[];
  };
  profiling: {
    completionPercentage: number;
    activeCategories: number;
    totalLinks: number;
    contentItems: number;
  };
  products: {
    accessories: number;
    devices: number;
    taps: number;
    scans: number;
  };
  networking: {
    shares: number;
    profileViews: number;
    contacts: number;
    relationships: number;
  };
  circle: {
    contacts: number;
    connections: number;
    followers: number;
    following: number;
    affiliations: number;
  };
  engagement: {
    chats: number;
    calls: number;
    posts: number;
    comments: number;
  };
  plans: {
    interactions: number;
    tasks: number;
    events: number;
    schedules: number;
  };
  data: {
    entries: number;
    dataPoints: number;
    tracking: number;
    correlations: number;
  };
  vault: {
    dataUsage: number;
    cards: number;
    documents: number;
    media: number;
  };
  discover: {
    searches: number;
    reviews: number;
    surveys: number;
    videos: number;
  };
  lastUpdated: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
