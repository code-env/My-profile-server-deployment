import mongoose from "mongoose";

/**
 * Milestone levels for user progression based on MyPts accumulation
 */
export enum MilestoneLevel {
  STARTER = "Starter",
  EXPLORER = "Explorer",
  ACHIEVER = "Achiever",
  LEADER = "Leader",
  VISIONARY = "Visionary",
  LEGEND = "Legend",
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
  [MilestoneLevel.LEGEND]: 10000000,
};

/**
 * Badge categories
 */
export enum BadgeCategory {
  MYPTS = "MyPts",
  PLATFORM_USAGE = "Platform Usage",
  PROFILE_COMPLETION = "Profile Completion",
  PRODUCTS = "Products",
  NETWORKING = "Networking",
  CIRCLE = "Circle",
  ENGAGEMENT = "Engagement",
  PLANS = "Plans",
  DATA = "Data",
  VAULT = "Vault",
  DISCOVER = "Discover",
}

/**
 * Badge rarity levels
 */
export enum BadgeRarity { //change to scarcity (to be updated)
  COMMON = "Common",
  UNCOMMON = "Uncommon",
  RARE = "Rare",
  EPIC = "Epic",
  LEGENDARY = "Legendary",
}

/**
 * Badge activity interface
 */
export interface IBadgeActivity {
  activityId: string;
  name: string;
  description: string;
  myPtsReward: number;
  isRequired: boolean;
  completionCriteria: {
    type: string;
    threshold: number; // more review => status: percent
    condition?: string;
  };
}

/**
 * Badge interface
 */
export interface IBadge {
  _id?: mongoose.Types.ObjectId;
  name: string;
  description: string;
  category: BadgeCategory;
  rarity: BadgeRarity; //update scarcity => A,B,C,D,E, & Z
  icon: string;
  requirements: {
    type: string;
    threshold: number; // => change to status: percent
    condition?: string;
  };
  activities?: IBadgeActivity[];
  requiredActivitiesCount?: number; // Number of required activities to complete to earn the badge
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * User badge activity progress interface
 */
export interface IUserBadgeActivityProgress {
  activityId: string;
  progress: number;
  isCompleted: boolean;
  completedAt?: Date;
}

/**
 * User badge progress interface
 */
export interface IUserBadge {
  badgeId: mongoose.Types.ObjectId;
  progress: number;
  isCompleted: boolean;
  completedAt?: Date;
  activityProgress?: IUserBadgeActivityProgress[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Profile milestone interface
 */
export interface IProfileMilestone {
  profileId: mongoose.Types.ObjectId;
  currentLevel: MilestoneLevel;
  currentPoints: number; // life-time MyPts
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
  myPtsBalance: number; // => life-time MyPts
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
  cooldownPeriod?: number; // =>  down-time (depend on subscribtion tier [free, basic, plus, premium])
  maxRewardsPerDay?: number; // (depend on subscribtion tier [free, basic, plus, premium])
  isEnabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Badge suggestion status enum
 */
export enum BadgeSuggestionStatus {
  PENDING = "Pending",
  APPROVED = "Approved",
  REJECTED = "Rejected",
  IMPLEMENTED = "Implemented",
}

/**
 * Badge suggestion interface
 */
export interface IBadgeSuggestion {
  // migrate to (badge creation & badge edith)
  _id?: mongoose.Types.ObjectId;
  profileId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  category: BadgeCategory;
  // rarity?: BadgeRarity;
  suggestedActivities?: string[]; // migrate to (badge creation & badge edith)
  status: BadgeSuggestionStatus;
  adminFeedback?: string;
  implementedBadgeId?: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * User activity tracking interface
 */
export interface IUserActivity {
  profileId: mongoose.Types.ObjectId;
  activityType: string;
  timestamp: Date; // => base on timezoon (reset at every 12:00 noon)
  MyPtsEarned: number; // => MyPts
  metadata?: Record<string, any>;
}

/**
 * Analytics dashboard data interface
 */
export interface IAnalyticsDashboard {
  profileId: mongoose.Types.ObjectId;
  myPts: {
    currentBalance: number; // => MyPts:: current (balance = lifetime acquired - lifetime spent)
    lifetimeEarned: number; // => MyPts:: lifetime acquired || earn, awarded, trade, bonus, purchase, win, compensated, pool.
    lifetimeSpent: number; // => MyPts:: lifetime spent || spend, redeem, buy products, pay for services, subscriptions, upgrade, gift, donate.
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
    activityHistory?: {
      date: Date;
      activityType: string;
      pointsEarned: number;
    }[];
  };
  profiling: {
    completionPercentage: number; // => (contentItems / activeCategories) * 100
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
    contacts: number; // saved contact
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
    chats: number; // => individuals (1:1)
    calls: number; // => individuals (1:1)
    posts: number;
    comments: number; // => like, text, Emojs.
  };
  plans: {
    interactions: number; // => how many times a profile interact with another profile *(get list of interactions)*
    tasks: number; //
    events: number; // appointments, meetings, *(get list)*
    schedules: number;
  };
  data: {
    entries: number;
    dataPoints: number; //
    tracking: number;
    correlations: number;
  };
  vault: {
    dataUsage: number; // percentage
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
