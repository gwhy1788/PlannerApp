import { Activity } from '../types';

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayString(): string {
  return toDateString(new Date());
}

export function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function getDaysBetween(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00').getTime();
  const b = new Date(to + 'T00:00:00').getTime();
  return Math.round((b - a) / 86400000);
}

export function subtractDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - n);
  return toDateString(d);
}

export const DAY_SHORT  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_FULL   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_FULL  = ['January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'];

const QUARTER_MONTHS = [
  ['Jan', 'Apr', 'Jul', 'Oct'],
  ['Feb', 'May', 'Aug', 'Nov'],
  ['Mar', 'Jun', 'Sep', 'Dec'],
];

function ordinal(n: number): string {
  if (n === -1) return 'last day';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function frequencyLabel(activity: Activity): string {
  if (activity.frequencyType === 'once') {
    return activity.targetDate ? `Due ${formatDisplayDate(activity.targetDate)}` : 'One-off';
  }

  switch (activity.periodicType) {
    case 'daily':
      return 'Every day';

    case 'weekly': {
      const days = activity.frequencyDays ?? [];
      if (days.length === 0) return 'Weekly';
      if (days.length === 7) return 'Every day';
      if (days.length <= 3) return 'Every ' + days.map(d => DAY_SHORT[d]).join(', ');
      return `${days.length} days/week`;
    }

    case 'fortnightly': {
      const day = DAY_FULL[(activity.frequencyDays ?? [])[0]] ?? 'day';
      return `Every other ${day}`;
    }

    case 'monthly':
      return `Monthly on the ${ordinal(activity.frequencyDayOfMonth)}`;

    case 'quarterly': {
      const months = QUARTER_MONTHS[activity.frequencyMonth] ?? QUARTER_MONTHS[0];
      return `Quarterly · ${months.join('/')} ${ordinal(activity.frequencyDayOfMonth)}`;
    }

    case 'yearly': {
      const month = MONTH_SHORT[activity.frequencyMonth] ?? '';
      return `Yearly · ${month} ${ordinal(activity.frequencyDayOfMonth)}`;
    }

    default:
      return '';
  }
}
