export enum VisibilityType {
  Public = 'Public',
  Private = 'Private',
  OnlyMe = 'OnlyMe'
}

export enum PriorityLevel {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High'
}

export enum TaskStatus {
  Todo = 'Todo',
  InProgress = 'InProgress',
  Revision = 'Revision',
  Completed = 'Completed',
  Upcoming = 'Upcoming'
}

export enum EndCondition {
  Never = 'Never',
  UntilDate = 'UntilDate',
  AfterOccurrences = 'AfterOccurrences'
}

export enum ReminderType {
  None = 'None',
  AtEventTime = 'AtEventTime',
  Minutes15 = 'Minutes15',
  Minutes30 = 'Minutes30',
  Hours1 = 'Hours1',
  Hours2 = 'Hours2',
  Days1 = 'Days1',
  Days2 = 'Days2',
  Weeks1 = 'Weeks1',
  Custom = 'Custom'
}

export enum RepeatFrequency {
  None = 'None',
  Daily = 'Daily',
  Weekdays = 'Weekdays',
  Weekends = 'Weekends',
  Weekly = 'Weekly',
  BiWeekly = 'BiWeekly',
  Monthly = 'Monthly',
  Yearly = 'Yearly',
  Custom = 'Custom'
}

export enum TaskType {
  Chores = 'Chores',
  Routine = 'Routine',
  Assignment = 'Assignment',
  Todo = 'Todo',
  Shift = 'Shift',
  Checkup = 'Checkup',
  Event = 'Event',
  Other = 'Other'
}

export enum ReminderUnit {
  Minutes = 'Minutes',
  Hours = 'Hours',
  Days = 'Days',
  Weeks = 'Weeks'
}

export enum TaskCategory {
  Personal = 'Personal',
  Family = 'Family',
  Dependent = 'Dependent'
}