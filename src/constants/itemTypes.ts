import { ItemType } from '../types';

export interface ItemTypeConfig {
  label: string;
  pluralLabel: string;
  icon: string;
  color: string;
  description: string;
  isRecurring: boolean;   // default for new items of this type
}

export const ITEM_TYPE_CONFIG: Record<ItemType, ItemTypeConfig> = {
  major_activity: {
    label: 'Major Activity',
    pluralLabel: 'Major Activities',
    icon: 'star-outline',
    color: '#8B5CF6',
    description: 'Significant recurring activities like sport, classes, or big commitments',
    isRecurring: true,
  },
  minor_activity: {
    label: 'Minor Activity',
    pluralLabel: 'Minor Activities',
    icon: 'ellipse-outline',
    color: '#3B82F6',
    description: 'Smaller recurring activities like errands, appointments, or routines',
    isRecurring: true,
  },
  repeating_task: {
    label: 'Repeating Task',
    pluralLabel: 'Repeating Tasks',
    icon: 'refresh-outline',
    color: '#F59E0B',
    description: 'Tasks that repeat on a schedule, like paying bills or filing reports',
    isRecurring: true,
  },
  event: {
    label: 'Event',
    pluralLabel: 'Events',
    icon: 'calendar-outline',
    color: '#EF4444',
    description: 'One-off events with a specific date and time',
    isRecurring: false,
  },
  duty: {
    label: 'Duty',
    pluralLabel: 'Duties',
    icon: 'shield-outline',
    color: '#10B981',
    description: 'Obligations or responsibilities that appear on your schedule',
    isRecurring: false,
  },
  habit: {
    label: 'Habit',
    pluralLabel: 'Habits',
    icon: 'checkmark-circle-outline',
    color: '#5B5FEF',
    description: 'Daily or regular habits you want to build and track with streaks',
    isRecurring: true,
  },
  checklist: {
    label: 'Checklist',
    pluralLabel: 'Checklists',
    icon: 'list-outline',
    color: '#06B6D4',
    description: 'A set of tasks to check off, either standalone or as part of an activity',
    isRecurring: false,
  },
  project: {
    label: 'Project',
    pluralLabel: 'Projects',
    icon: 'folder-open-outline',
    color: '#EC4899',
    description: 'Multi-task projects with status tracking and milestones',
    isRecurring: false,
  },
};

export const ITEM_TYPE_ORDER: ItemType[] = [
  'habit',
  'major_activity',
  'minor_activity',
  'repeating_task',
  'event',
  'duty',
  'checklist',
  'project',
];
