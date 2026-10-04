import { Activity, ActivityLog } from '../types';
import { toDateString, getDaysBetween } from './dates';

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function isDueToday(activity: Activity): boolean {
  const today = new Date();
  const todayStr = toDateString(today);
  const dow = today.getDay();
  const dom = today.getDate();
  const month = today.getMonth();

  if (activity.frequencyType === 'once') {
    return activity.targetDate === todayStr;
  }

  // periodic
  switch (activity.periodicType) {
    case 'daily':
      return true;

    case 'weekly':
      return (activity.frequencyDays ?? []).includes(dow);

    case 'fortnightly': {
      const selectedDow = (activity.frequencyDays ?? [])[0];
      if (dow !== selectedDow) return false;
      // Find first occurrence of selectedDow on or after creation date
      const anchorStr = activity.createdAt.split('T')[0];
      const anchor = new Date(anchorStr + 'T00:00:00');
      while (anchor.getDay() !== selectedDow) {
        anchor.setDate(anchor.getDate() + 1);
      }
      const daysSinceFirst = getDaysBetween(toDateString(anchor), todayStr);
      return daysSinceFirst >= 0 && daysSinceFirst % 14 === 0;
    }

    case 'monthly': {
      const target = activity.frequencyDayOfMonth === -1
        ? lastDayOfMonth(today.getFullYear(), month)
        : activity.frequencyDayOfMonth;
      return dom === target;
    }

    case 'quarterly': {
      // frequencyMonth: 0 = first month of quarter (Jan/Apr/Jul/Oct)
      //                 1 = second month of quarter (Feb/May/Aug/Nov)
      //                 2 = third month of quarter  (Mar/Jun/Sep/Dec)
      if (month % 3 !== activity.frequencyMonth) return false;
      const target = activity.frequencyDayOfMonth === -1
        ? lastDayOfMonth(today.getFullYear(), month)
        : activity.frequencyDayOfMonth;
      return dom === target;
    }

    case 'yearly': {
      if (month !== activity.frequencyMonth) return false;
      const target = activity.frequencyDayOfMonth === -1
        ? lastDayOfMonth(today.getFullYear(), month)
        : activity.frequencyDayOfMonth;
      return dom === target;
    }

    default:
      return false;
  }
}

export function calculateStreak(activity: Activity, logs: ActivityLog[]): number {
  if (logs.length === 0) return 0;

  const logDates = new Set(logs.map(l => l.completedAt.split('T')[0]));
  const today = new Date();
  const todayStr = toDateString(today);

  if (activity.frequencyType === 'periodic' && activity.periodicType === 'daily') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toDateString(yesterday);

    const startStr = logDates.has(todayStr) ? todayStr
                   : logDates.has(yesterdayStr) ? yesterdayStr
                   : null;
    if (!startStr) return 0;

    let streak = 0;
    const cur = new Date(startStr + 'T00:00:00');
    while (logDates.has(toDateString(cur))) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    }
    return streak;
  }

  if (activity.frequencyType === 'periodic' && activity.periodicType === 'weekly') {
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

  // For all other types, return total completions as the streak indicator
  return logs.length;
}

export function getCompletionDates(logs: ActivityLog[], days: number): string[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return logs
    .filter(l => new Date(l.completedAt) >= cutoff)
    .map(l => l.completedAt.split('T')[0]);
}
