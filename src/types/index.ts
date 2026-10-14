// ── Item Types ────────────────────────────────────────────────────────────────

export type ItemType =
  | 'major_activity'
  | 'minor_activity'
  | 'repeating_task'
  | 'event'
  | 'duty'
  | 'habit'
  | 'checklist'
  | 'project';

// ── Schedule / Frequency ──────────────────────────────────────────────────────

export type PeriodicType =
  | 'daily'
  | 'weekly'
  | 'fortnightly'
  | 'monthly'
  | 'quarterly'
  | 'yearly';

// ── Core Item ─────────────────────────────────────────────────────────────────

export interface ScheduleItem {
  id: string;
  itemType: ItemType;
  name: string;
  description: string;

  // Category
  categoryId: string;
  subcategoryId: string;

  // Schedule — only used when isRecurring = true
  isRecurring: boolean;
  periodicType: PeriodicType;
  // weekly / fortnightly week-1
  frequencyDays: number[];
  // fortnightly week-2
  frequencyDays2: number[];
  // monthly / quarterly / yearly: day-of-month (or -1 for last day)
  frequencyDayOfMonth: number;
  // quarterly: 0/1/2 = which month in the quarter
  // yearly: 0-11 = calendar month
  frequencyMonth: number;

  // One-off / event target date
  targetDate: string;
  targetTime: string;

  // Reminder
  reminderTime: string;

  // Appearance
  color: string;
  icon: string;

  // State
  isActive: boolean;
  isCompleted: boolean;     // for one-off items
  completedAt: string;      // ISO string, for one-off completion

  createdAt: string;
}

// ── Log ───────────────────────────────────────────────────────────────────────

export interface ItemLog {
  id: string;
  itemId: string;
  completedAt: string;
  note: string;
}

// ── Checklist ─────────────────────────────────────────────────────────────────

export interface ChecklistTask {
  id: string;
  itemId: string;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
}

// ── Project ───────────────────────────────────────────────────────────────────

export type ProjectTaskStatus = 'todo' | 'in_progress' | 'done';

export interface ProjectTask {
  id: string;
  itemId: string;
  title: string;
  description: string;
  status: ProjectTaskStatus;
  dueDate: string;
  sortOrder: number;
  createdAt: string;
}

// ── Category ──────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  parentId: string;   // '' for top-level
}
