import { Schema, Types } from 'mongoose';
import { IPlan, PlanModel } from './Plan';

interface IAppointment extends IPlan {
  serviceProvider: {
    profileId: Types.ObjectId;
    role: string;
    organization?: Types.ObjectId;
  };
  preparationItems: [
    {
      _id: Types.ObjectId;
      description: string;
      completed: boolean;
    }
  ];
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
  insuranceInfo?: {
    provider: string;
    memberId: string;
  };
  billingCode?: string;
}

const AppointmentSchema = new Schema<IAppointment>({
  serviceProvider: {
    profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
    role: { type: String, required: true },
    organization: { type: Schema.Types.ObjectId, ref: 'Organization' }
  },
  preparationItems: [{
    description: { type: String, required: true },
    completed: { type: Boolean, default: false }
  }],
  status: { 
    type: String, 
    enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'no-show'], 
    default: 'scheduled' 
  },
  insuranceInfo: {
    provider: { type: String },
    memberId: { type: String }
  },
  billingCode: { type: String }
}, { discriminatorKey: 'planType' });

// Add instance methods
AppointmentSchema.methods.addPreparationItem = function(description: string): Types.ObjectId {
  const item = {
    _id: new Types.ObjectId(),
    description,
    completed: false
  };
  this.preparationItems.push(item);
  return item._id;
};

AppointmentSchema.methods.confirmAppointment = function(): void {
  this.status = 'confirmed';
};

export const AppointmentModel = PlanModel.discriminator<IAppointment>('appointment', AppointmentSchema);
export type IAppointmentModel = typeof AppointmentModel;