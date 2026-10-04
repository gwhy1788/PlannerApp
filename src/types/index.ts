export type FrequencyType = 'daily' | 'weekly' | 'interval' | 'once';

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
  frequencyType: FrequencyType;
  frequencyDays: number[];    // weekly: [0-6] where 0=Sun
  frequencyInterval: number;  // interval: every N days
  targetDate: string;         // once: "YYYY-MM-DD"
  reminderTime: string;       // "HH:MM" or ""
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
