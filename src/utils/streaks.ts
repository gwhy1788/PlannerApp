import { ScheduleItem, ItemLog } from '../types';
import { toDateString, getDaysBetween } from './dates';

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function isDueOnDate(item: ScheduleItem, dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00');
  const dow = date.getDay();
  const dom = date.getDate();
  const month = date.getMonth();

  if (!item.isRecurring) {
    return item.targetDate === dateStr;
  }

  switch (item.periodicType) {
    case 'daily':
      return true;

    case 'weekly':
      return (item.frequencyDays ?? []).includes(dow);

    case 'fortnightly': {
      const anchorStr = item.createdAt.split('T')[0];
      const daysSinceAnchor = getDaysBetween(anchorStr, dateStr);
      if (daysSinceAnchor < 0) return false;
      const weekInCycle = Math.floor(daysSinceAnchor / 7) % 2; // 0 = week 1, 1 = week 2
      const daysForThisWeek = weekInCycle === 0
        ? (item.frequencyDays ?? [])
        : (item.frequencyDays2 ?? []);
      return daysForThisWeek.includes(dow);
    }

    case 'monthly': {
      const target = item.frequencyDayOfMonth === -1
        ? lastDayOfMonth(date.getFullYear(), month)
        : item.frequencyDayOfMonth;
      return dom === target;
    }

    case 'quarterly': {
      if (month % 3 !== item.frequencyMonth) return false;
      const target = item.frequencyDayOfMonth === -1
        ? lastDayOfMonth(date.getFullYear(), month)
        : item.frequencyDayOfMonth;
      return dom === target;
    }

    case 'yearly': {
      if (month !== item.frequencyMonth) return false;
      const target = item.frequencyDayOfMonth === -1
        ? lastDayOfMonth(date.getFullYear(), month)
        : item.frequencyDayOfMonth;
      return dom === target;
    }

    default:
      return false;
  }
}

export function isDueToday(item: ScheduleItem): boolean {
  return isDueOnDate(item, toDateString(new Date()));
}

export function calculateStreak(item: ScheduleItem, logs: ItemLog[]): number {
  if (logs.length === 0) return 0;

  const logDates = new Set(logs.map(l => l.completedAt.split('T')[0]));
  const today = new Date();
  const todayStr = toDateString(today);

  if (item.isRecurring && item.periodicType === 'daily') {
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

  if (item.isRecurring && item.periodicType === 'weekly') {
    const days = item.frequencyDays ?? [];
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

  // For all other types, return total completions
  return logs.length;
}

export function getCompletionDates(logs: ItemLog[], days: number): string[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return logs
    .filter(l => new Date(l.completedAt) >= cutoff)
    .map(l => l.completedAt.split('T')[0]);
}
