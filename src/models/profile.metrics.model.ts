import mongoose, { Schema, Document } from 'mongoose';

export interface IProfileMetricEntry extends Document {
  profileId: mongoose.Types.ObjectId;
  profileType: string;
  category: string; // e.g., 'analytics.Usage' or 'analytics.Engagement' or 'analytics.Mypts' or any other category
  metric: string;   // e.g., 'mypts'
  value: number;
  timestamp: Date;
}

const ProfileMetricEntrySchema = new Schema<IProfileMetricEntry>({
  profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
  profileType: { type: String, required: true },
  category: { type: String, required: true },
  metric: { type: String, required: true },
  value: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model<IProfileMetricEntry>('ProfileMetricEntry', ProfileMetricEntrySchema);



// example data 

// [
//   { "timestamp": "2024-05-01T00:00:00Z", "value": 120 , "category": "analytics.Usage", "metric": "mypts" },
//   { "timestamp": "2024-05-02T00:00:00Z", "value": 143 , "category": "analytics.Usage", "metric": "mypts" },
//   { "timestamp": "2024-05-03T00:00:00Z", "value": 132 , "category": "analytics.Usage", "metric": "mypts" }
// ]

