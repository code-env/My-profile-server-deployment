import { ITask } from '../models/Tasks';
import { IEvent } from '../models/Event';

interface TimeRange {
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
}

interface ConflictingItem {
  type: 'task' | 'event';
  title: string;
}

/**
 * Checks if two time ranges overlap
 */
export function doTimeRangesOverlap(range1: TimeRange, range2: TimeRange): boolean {
  // If either is an all-day event, they overlap
  if (range1.isAllDay || range2.isAllDay) {
    return true;
  }

  // Convert to Date objects if they're strings
  const start1 = typeof range1.startTime === 'string'
    ? new Date(range1.startTime).getTime()
    : range1.startTime.getTime();

  const end1 = typeof range1.endTime === 'string'
    ? new Date(range1.endTime).getTime()
    : range1.endTime.getTime();

  const start2 = typeof range2.startTime === 'string'
    ? new Date(range2.startTime).getTime()
    : range2.startTime.getTime();

  const end2 = typeof range2.endTime === 'string'
    ? new Date(range2.endTime).getTime()
    : range2.endTime.getTime();

  // Check if one range starts before the other ends and ends after the other starts
  return (start1 < end2 && end1 > start2);
}
/**
 * Checks if a new time range overlaps with any existing tasks or events
 */
export async function checkTimeOverlap(
  userId: string,
  profile: string,
  newRange: TimeRange,
  excludeId?: string
): Promise<{ overlaps: boolean; conflictingItems: ConflictingItem[] }> {
  const Task = require('../models/Tasks').Task;
  const Event = require('../models/Event').Event;

  // Find all tasks and events for the user that could overlap
  const tasks = await Task.find({
    createdBy: userId,
    profile: profile,
    _id: { $ne: excludeId },
    $or: [
      { isAllDay: true },
      {
        startTime: { $lt: newRange.endTime },
        endTime: { $gt: newRange.startTime }
      }
    ]
  }).select('name startTime endTime isAllDay');

  const events = await Event.find({
    createdBy: userId,
    _id: { $ne: excludeId },
    $or: [
      { isAllDay: true },
      {
        startTime: { $lt: newRange.endTime },
        endTime: { $gt: newRange.startTime }
      }
    ]
  }).select('title startTime endTime isAllDay');

  const conflictingItems: ConflictingItem[] = [];

  // Check tasks for overlap
  for (const task of tasks) {
    if (doTimeRangesOverlap(newRange, {
      startTime: task.startTime,
      endTime: task.endTime,
      isAllDay: task.isAllDay
    })) {
      conflictingItems.push({
        type: 'task' as const,
        title: task.title
      });
    }
  }

  // Check events for overlap
  for (const event of events) {
    if (doTimeRangesOverlap(newRange, {
      startTime: event.startTime,
      endTime: event.endTime,
      isAllDay: event.isAllDay
    })) {
      conflictingItems.push({
        type: 'event' as const,
        title: event.title
      });
    }
  }

  return {
    overlaps: conflictingItems.length > 0,
    conflictingItems
  };
} 