import { Schema, Types } from 'mongoose';
import { IPlan, PlanModel } from './Plan';

interface ITask extends IPlan {
  subTasks: {
    [x: string]: any;
    description: string;
    completed: boolean;
    createdAt: Date;
    updatedAt: Date;
  }[];
  status: 'upcoming' | 'in-progress' | 'completed' | 'cancelled';
  parentTask?: Types.ObjectId;
  dependencies: Types.ObjectId[];
}

const TaskSchema = new Schema<ITask>({
  subTasks: [{
    description: { type: String, required: true },
    completed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }],
  status: { 
    type: String, 
    enum: ['upcoming', 'in-progress', 'completed', 'cancelled'], 
    default: 'upcoming' 
  },
  parentTask: { type: Schema.Types.ObjectId, ref: 'Plan' },
  dependencies: [{ type: Schema.Types.ObjectId, ref: 'Plan' }]
}, { discriminatorKey: 'planType' });

// Add instance methods
TaskSchema.methods.addSubTask = function(description: string): Types.ObjectId {
  const newSubTask = {
    _id: new Types.ObjectId(),
    description,
    completed: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  this.subTasks.push(newSubTask);
  return newSubTask._id;
};

TaskSchema.methods.toggleSubTask = function(subTaskId: Types.ObjectId): boolean {
  const subTask = this.subTasks.id(subTaskId);
  if (subTask) {
    subTask.completed = !subTask.completed;
    subTask.updatedAt = new Date();
    return true;
  }
  return false;
};

export const TaskModel = PlanModel.discriminator<ITask>('task', TaskSchema);
export type ITaskModel = typeof TaskModel;