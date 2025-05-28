import mongoose, { Document, Schema, Model } from 'mongoose';
import { IAnalyticsDashboard } from '../../interfaces/gamification.interface';

export type AnalyticsDashboardDocument = IAnalyticsDashboard & Document;

const AnalyticsDashboardSchema = new Schema<IAnalyticsDashboard>(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
      unique: true,
      index: true
    },
    myPts: {
      currentBalance: {
        type: Number,
        default: 0
      },
      lifetimeEarned: {
        type: Number,
        default: 0
      },
      lifetimeSpent: {
        type: Number,
        default: 0
      },
      transactions: [
        {
          date: {
            type: Date,
            required: true
          },
          amount: {
            type: Number,
            required: true
          },
          type: {
            type: String,
            required: true
          }
        }
      ]
    },
    usage: {
      loginStamps: {
        type: Number,
        default: 0
      },
      rewardsClaimed: {
        type: Number,
        default: 0
      },
      badgesEarned: {
        type: Number,
        default: 0
      },
      milestonesReached: {
        type: Number,
        default: 0
      },
      activityHistory: [
        {
          date: {
            type: Date,
            required: true
          },
          activityType: {
            type: String,
            required: true
          },
          pointsEarned: {
            type: Number,
            required: true
          }
        }
      ]
    },
    profiling: {
      completionPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      activeCategories: {
        type: Number,
        default: 0
      },
      totalLinks: {
        type: Number,
        default: 0
      },
      contentItems: {
        type: Number,
        default: 0
      }
    },
    products: {
      accessories: {
        type: Number,
        default: 0
      },
      devices: {
        type: Number,
        default: 0
      },
      taps: {
        type: Number,
        default: 0
      },
      scans: {
        type: Number,
        default: 0
      }
    },
    networking: {
      shares: {
        type: Number,
        default: 0
      },
      profileViews: {
        type: Number,
        default: 0
      },
      contacts: {
        type: Number,
        default: 0
      },
      relationships: {
        type: Number,
        default: 0
      }
    },
    circle: {
      contacts: {
        type: Number,
        default: 0
      },
      connections: {
        type: Number,
        default: 0
      },
      followers: {
        type: Number,
        default: 0
      },
      following: {
        type: Number,
        default: 0
      },
      affiliations: {
        type: Number,
        default: 0
      }
    },
    engagement: {
      chats: {
        type: Number,
        default: 0
      },
      calls: {
        type: Number,
        default: 0
      },
      posts: {
        type: Number,
        default: 0
      },
      comments: {
        type: Number,
        default: 0
      }
    },
    plans: {
      interactions: {
        type: Number,
        default: 0
      },
      tasks: {
        type: Number,
        default: 0
      },
      events: {
        type: Number,
        default: 0
      },
      schedules: {
        type: Number,
        default: 0
      }
    },
    data: {
      entries: {
        type: Number,
        default: 0
      },
      dataPoints: {
        type: Number,
        default: 0
      },
      tracking: {
        type: Number,
        default: 0
      },
      correlations: {
        type: Number,
        default: 0
      }
    },
    vault: {
      dataUsage: {
        type: Number,
        default: 0
      },
      cards: {
        type: Number,
        default: 0
      },
      documents: {
        type: Number,
        default: 0
      },
      media: {
        type: Number,
        default: 0
      }
    },
    discover: {
      searches: {
        type: Number,
        default: 0
      },
      reviews: {
        type: Number,
        default: 0
      },
      surveys: {
        type: Number,
        default: 0
      },
      videos: {
        type: Number,
        default: 0
      }
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Create indexes for better query performance
AnalyticsDashboardSchema.index({ 'myPts.currentBalance': -1 });
AnalyticsDashboardSchema.index({ 'usage.badgesEarned': -1 });
AnalyticsDashboardSchema.index({ lastUpdated: -1 });

export interface IAnalyticsDashboardModel extends Model<IAnalyticsDashboard> {
  findOrCreate(profileId: mongoose.Types.ObjectId): Promise<AnalyticsDashboardDocument>;
  updateMyPtsData(profileId: mongoose.Types.ObjectId): Promise<AnalyticsDashboardDocument>;
}

// Static methods
AnalyticsDashboardSchema.statics.findOrCreate = async function(
  profileId: mongoose.Types.ObjectId
): Promise<AnalyticsDashboardDocument> {
  let dashboard = await this.findOne({ profileId });

  if (!dashboard) {
    dashboard = await this.create({
      profileId,
      lastUpdated: new Date()
    });
  }

  return dashboard;
};

export const AnalyticsDashboardModel = mongoose.model<IAnalyticsDashboard, IAnalyticsDashboardModel>(
  'AnalyticsDashboard',
  AnalyticsDashboardSchema
);
