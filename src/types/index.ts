export type FrequencyType = 'periodic' | 'once';
export type PeriodicType = 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface Activity {
  id: string;
  name: string;
  description: string;
  categoryId: string;

  frequencyType: FrequencyType;       // 'periodic' | 'once'
  periodicType: PeriodicType;         // only used when frequencyType === 'periodic'

  frequencyDays: number[];            // weekly/fortnightly: day(s) of week [0=Sun..6=Sat]
  frequencyDayOfMonth: number;        // monthly/quarterly/yearly: 1-28, or -1 = last day
  frequencyMonth: number;             // quarterly: 0-2 (position in quarter); yearly: 0-11

  targetDate: string;                 // once: "YYYY-MM-DD"
  reminderTime: string;               // "HH:MM" or ""
  color: string;
  icon: string;
  isActive: boolean;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  activityId: string;
  completedAt: string;
  note: string;
}
