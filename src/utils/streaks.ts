import { Activity, ActivityLog } from '../types';
import { toDateString, getDaysBetween } from './dates';

export function isDueToday(activity: Activity, lastCompletionDate?: string): boolean {
  const today = new Date();
  const todayStr = toDateString(today);
  const dow = today.getDay();

  switch (activity.frequencyType) {
    case 'daily':
      return true;
    case 'weekly':
      return (activity.frequencyDays ?? []).includes(dow);
    case 'interval': {
      const interval = activity.frequencyInterval ?? 1;
      const base = lastCompletionDate ?? activity.createdAt.split('T')[0];
      const daysSince = getDaysBetween(base, todayStr);
      return daysSince >= interval;
    }
    case 'once':
      return activity.targetDate === todayStr;
    default:
      return false;
  }
}

export function calculateStreak(activity: Activity, logs: ActivityLog[]): number {
  if (logs.length === 0) return 0;

  const logDates = new Set(logs.map(l => l.completedAt.split('T')[0]));
  const today = new Date();
  const todayStr = toDateString(today);

  if (activity.frequencyType === 'daily') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toDateString(yesterday);

    const startStr = logDates.has(todayStr) ? todayStr : logDates.has(yesterdayStr) ? yesterdayStr : null;
    if (!startStr) return 0;

    let streak = 0;
    const cur = new Date(startStr + 'T00:00:00');
    while (logDates.has(toDateString(cur))) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    }
    return streak;
  }

  if (activity.frequencyType === 'weekly') {
    const days = activity.frequencyDays ?? [];
    if (days.length === 0) return 0;

    let streak = 0;
    const cur = new Date(today);
    for (let i = 0; i < 365; i++) {
      const dow = cur.getDay();
      const dateStr = toDateString(cur);
      if (days.includes(dow)) {
        if (logDates.has(dateStr)) {
          streak++;
        } else if (dateStr !== todayStr) {
          break;
        }
      }
      cur.setDate(cur.getDate() - 1);
    }
    return streak;
  }

  return logs.length;
}

export function getCompletionDates(logs: ActivityLog[], days: number): string[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return logs
    .filter(l => new Date(l.completedAt) >= cutoff)
    .map(l => l.completedAt.split('T')[0]);
}
