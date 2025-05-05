export enum RepeatFrequency {
    None = 'None',
    OneTime = 'One time only',
    Daily = 'Every Day',
    Weekdays = 'Every Weekdays',
    Weekends = 'Every Weekend',
    Weekly = 'Every Week',
    BiWeekly = 'Every 2 weeks',
    Monthly = 'Every month',
    Yearly = 'Every year',
    Custom = 'Custom'
  }
  
  export enum EndCondition {
    Never = 'No end repeat',
    UntilDate = 'On date',
    AfterOccurrences = 'After number of events'
  }
  
  export enum ReminderType {
    None = 'No reminder',
    AtEventTime = 'At time of event',
    Minutes15 = '15 minutes before',
    Minutes30 = '30 minutes before',
    Hours1 = '1 hour before',
    Hours2 = '2 hours before',
    Days1 = '1 day before',
    Days2 = '2 days before',
    Weeks1 = '1 week before',
    Custom = 'Custom'
  }
  
  export enum ReminderUnit {
    Minutes = 'Minutes',
    Hours = 'Hours',
    Days = 'Days',
    Weeks = 'Weeks'
  }
  
  export enum VisibilityType {
    Everyone = 'Everyone (Public)',
    Connections = 'Connections only (Private)',
    OnlyMe = 'Only me (Hidden)'
  }
  
  export enum TaskCategory {
    Personal = 'Personal',
    Family = 'Family',
    Dependent = 'Dependent'
  }
  
  export enum PriorityLevel {
    LOW = 'Low',
    MEDIUM = 'Medium',
    HIGH = 'High'
  }
  
  export enum TaskStatus {
    Todo = 'To-do',
    InProgress = 'In Progress',
    Revision = 'Revision',
    Completed = 'Completed',
    Upcoming = 'Upcoming'
  }