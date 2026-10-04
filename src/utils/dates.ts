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

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function frequencyLabel(
  type: string,
  days: number[],
  interval: number,
  targetDate: string
): string {
  if (type === 'daily') return 'Every day';
  if (type === 'weekly') {
    if (days.length === 7) return 'Every day';
    if (days.length === 0) return 'No days set';
    if (days.length <= 3) return days.map(d => DAY_SHORT[d]).join(', ');
    return `${days.length} days/week`;
  }
  if (type === 'interval') return `Every ${interval} day${interval !== 1 ? 's' : ''}`;
  if (type === 'once') return targetDate ? `Due ${formatDisplayDate(targetDate)}` : 'One-off';
  return '';
}
