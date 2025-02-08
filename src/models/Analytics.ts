import mongoose, { Document, Schema } from 'mongoose';

// Interface for profile view events
interface IProfileView {
  timestamp: Date;
  viewer?: mongoose.Types.ObjectId;
  location?: {
    country?: string;
    city?: string;
  };
  device?: {
    type: string;
    browser: string;
    os: string;
  };
  duration?: number;
  isUnique: boolean;
}

// Interface for profile engagement events
interface IEngagement {
  type: 'like' | 'comment' | 'share' | 'download' | 'connect' | 'message';
  timestamp: Date;
  user: mongoose.Types.ObjectId;
  metadata?: Record<string, any>;
}

// Main Analytics interface
export interface IAnalytics extends Document {
  profileId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  views: IProfileView[];
  engagements: IEngagement[];
  metrics: {
    totalViews: number;
    uniqueViews: number;
    totalEngagements: number;
    avgViewDuration: number;
    connectionRate: number;
    responseRate: number;
    popularSections: Record<string, number>;
  };
  dailyStats: {
    date: Date;
    views: number;
    uniqueViews: number;
    engagements: Record<string, number>;
  }[];
  lastUpdated: Date;
  updateMetrics(): Promise<void>;
}

const analyticsSchema = new Schema<IAnalytics>({
  profileId: {
    type: Schema.Types.ObjectId,
    ref: 'Profile',
    required: true,
    index: true,
  },
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  views: [{
    timestamp: { type: Date, required: true },
    viewer: { type: Schema.Types.ObjectId, ref: 'User' },
    location: {
      country: String,
      city: String,
    },
    device: {
      type: String,
      browser: String,
      os: String,
    },
    duration: Number,
    isUnique: { type: Boolean, default: true },
  }],
  engagements: [{
    type: {
      type: String,
      enum: ['like', 'comment', 'share', 'download', 'connect', 'message'],
      required: true,
    },
    timestamp: { type: Date, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    metadata: Schema.Types.Mixed,
  }],
  metrics: {
    totalViews: { type: Number, default: 0 },
    uniqueViews: { type: Number, default: 0 },
    totalEngagements: { type: Number, default: 0 },
    avgViewDuration: { type: Number, default: 0 },
    connectionRate: { type: Number, default: 0 },
    responseRate: { type: Number, default: 0 },
    popularSections: { type: Map, of: Number },
  },
  dailyStats: [{
    date: { type: Date, required: true },
    views: { type: Number, default: 0 },
    uniqueViews: { type: Number, default: 0 },
    engagements: { type: Map, of: Number },
  }],
  lastUpdated: { type: Date, default: Date.now },
});

// Indexes for better query performance
analyticsSchema.index({ 'views.timestamp': -1 });
analyticsSchema.index({ 'engagements.timestamp': -1 });
analyticsSchema.index({ 'dailyStats.date': -1 });
analyticsSchema.index({ profileId: 1, 'views.timestamp': -1 });
analyticsSchema.index({ ownerId: 1, 'metrics.totalViews': -1 });

// Method to update metrics
analyticsSchema.methods.updateMetrics = async function() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

  // Calculate metrics
const recentViews = this.views.filter((v: { timestamp: any; }) => v.timestamp >= thirtyDaysAgo);
  const recentEngagements = this.engagements.filter((e: { timestamp: any; }) => e.timestamp >= thirtyDaysAgo);

  this.metrics = {
    totalViews: this.views.length,
    uniqueViews: this.views.filter((v: { isUnique: any; }) => v.isUnique).length,
    totalEngagements: this.engagements.length,
    avgViewDuration: this.calculateAverageViewDuration(recentViews),
    connectionRate: this.calculateConnectionRate(recentEngagements),
    responseRate: this.calculateResponseRate(recentEngagements),
    popularSections: this.calculatePopularSections(),
  };

  this.lastUpdated = new Date();
  await this.save();
};

// Helper methods for metric calculations
analyticsSchema.methods.calculateAverageViewDuration = function(views: IProfileView[]) {
  const viewsWithDuration = views.filter(v => v.duration);
  if (viewsWithDuration.length === 0) return 0;
  const totalDuration = viewsWithDuration.reduce((sum, v) => sum + (v.duration || 0), 0);
  return totalDuration / viewsWithDuration.length;
};

analyticsSchema.methods.calculateConnectionRate = function(engagements: IEngagement[]) {
  const uniqueViewers = new Set(this.views.filter((v: { viewer: any; }) => v.viewer).map((v: { viewer: { toString: () => any; }; }) => v.viewer?.toString()));
  const connections = engagements.filter(e => e.type === 'connect');
  return uniqueViewers.size ? (connections.length / uniqueViewers.size) * 100 : 0;
};

analyticsSchema.methods.calculateResponseRate = function(engagements: IEngagement[]) {
  const messages = engagements.filter(e => e.type === 'message');
  const uniqueSenders = new Set(messages.map(m => m.user.toString()));
  return messages.length ? (uniqueSenders.size / messages.length) * 100 : 0;
};

analyticsSchema.methods.calculatePopularSections = function() {
  // Implementation depends on how section views are tracked
  return {};
};

export const Analytics = mongoose.model<IAnalytics>('Analytics', analyticsSchema);
