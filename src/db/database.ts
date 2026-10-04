import * as SQLite from 'expo-sqlite';
import { Activity, ActivityLog, Category } from '../types';

const SCHEMA_VERSION = 2;

export async function initDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion < SCHEMA_VERSION) {
    await db.execAsync(`
      DROP TABLE IF EXISTS activity_logs;
      DROP TABLE IF EXISTS activities;
      DROP TABLE IF EXISTS categories;
    `);
  }

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA user_version = ${SCHEMA_VERSION};

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#5B5FEF',
      icon TEXT NOT NULL DEFAULT 'folder-outline'
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category_id TEXT NOT NULL,
      frequency_type TEXT NOT NULL DEFAULT 'periodic',
      periodic_type TEXT NOT NULL DEFAULT 'daily',
      frequency_days TEXT NOT NULL DEFAULT '[]',
      frequency_day_of_month INTEGER NOT NULL DEFAULT 1,
      frequency_month INTEGER NOT NULL DEFAULT 0,
      target_date TEXT NOT NULL DEFAULT '',
      reminder_time TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#5B5FEF',
      icon TEXT NOT NULL DEFAULT 'checkmark-circle-outline',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY NOT NULL,
      activity_id TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT ''
    );
  `);

  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );
  if (existing && existing.count === 0) {
    await seedCategories(db);
  }
}

async function seedCategories(db: SQLite.SQLiteDatabase): Promise<void> {
  const defaults: Category[] = [
    { id: 'cat-health', name: 'Health & Fitness', color: '#10B981', icon: 'fitness-outline' },
    { id: 'cat-mind',   name: 'Mind & Learning',  color: '#3B82F6', icon: 'book-outline' },
    { id: 'cat-home',   name: 'Home & Life',       color: '#F59E0B', icon: 'home-outline' },
    { id: 'cat-work',   name: 'Work & Goals',      color: '#8B5CF6', icon: 'briefcase-outline' },
  ];
  for (const c of defaults) {
    await db.runAsync(
      'INSERT INTO categories (id, name, color, icon) VALUES (?, ?, ?, ?)',
      [c.id, c.name, c.color, c.icon]
    );
  }
}

// ── Categories ───────────────────────────────────────────────────────────────

export async function getCategories(db: SQLite.SQLiteDatabase): Promise<Category[]> {
  return db.getAllAsync<Category>('SELECT * FROM categories ORDER BY name');
}

export async function upsertCategory(db: SQLite.SQLiteDatabase, cat: Category): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO categories (id, name, color, icon) VALUES (?, ?, ?, ?)',
    [cat.id, cat.name, cat.color, cat.icon]
  );
}

// ── Activities ───────────────────────────────────────────────────────────────

type ActivityRow = {
  id: string; name: string; description: string; category_id: string;
  frequency_type: string; periodic_type: string; frequency_days: string;
  frequency_day_of_month: number; frequency_month: number;
  target_date: string; reminder_time: string; color: string; icon: string;
  is_active: number; created_at: string;
};

function rowToActivity(r: ActivityRow): Activity {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    categoryId: r.category_id,
    frequencyType: r.frequency_type as Activity['frequencyType'],
    periodicType: (r.periodic_type ?? 'daily') as Activity['periodicType'],
    frequencyDays: JSON.parse(r.frequency_days || '[]'),
    frequencyDayOfMonth: r.frequency_day_of_month ?? 1,
    frequencyMonth: r.frequency_month ?? 0,
    targetDate: r.target_date,
    reminderTime: r.reminder_time,
    color: r.color,
    icon: r.icon,
    isActive: r.is_active === 1,
    createdAt: r.created_at,
  };
}

export async function getActivities(db: SQLite.SQLiteDatabase): Promise<Activity[]> {
  const rows = await db.getAllAsync<ActivityRow>(
    'SELECT * FROM activities WHERE is_active = 1 ORDER BY created_at DESC'
  );
  return rows.map(rowToActivity);
}

export async function getActivity(
  db: SQLite.SQLiteDatabase, id: string
): Promise<Activity | null> {
  const row = await db.getFirstAsync<ActivityRow>(
    'SELECT * FROM activities WHERE id = ?', [id]
  );
  return row ? rowToActivity(row) : null;
}

export async function upsertActivity(
  db: SQLite.SQLiteDatabase, a: Activity
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO activities
       (id, name, description, category_id, frequency_type, periodic_type,
        frequency_days, frequency_day_of_month, frequency_month,
        target_date, reminder_time, color, icon, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      a.id, a.name, a.description, a.categoryId,
      a.frequencyType, a.periodicType,
      JSON.stringify(a.frequencyDays),
      a.frequencyDayOfMonth, a.frequencyMonth,
      a.targetDate, a.reminderTime,
      a.color, a.icon, a.isActive ? 1 : 0, a.createdAt,
    ]
  );
}

export async function softDeleteActivity(
  db: SQLite.SQLiteDatabase, id: string
): Promise<void> {
  await db.runAsync('UPDATE activities SET is_active = 0 WHERE id = ?', [id]);
}

// ── Activity Logs ─────────────────────────────────────────────────────────────

type LogRow = { id: string; activity_id: string; completed_at: string; note: string };

function rowToLog(r: LogRow): ActivityLog {
  return { id: r.id, activityId: r.activity_id, completedAt: r.completed_at, note: r.note };
}

export async function getLogsForActivity(
  db: SQLite.SQLiteDatabase, activityId: string, limit = 90
): Promise<ActivityLog[]> {
  const rows = await db.getAllAsync<LogRow>(
    'SELECT * FROM activity_logs WHERE activity_id = ? ORDER BY completed_at DESC LIMIT ?',
    [activityId, limit]
  );
  return rows.map(rowToLog);
}

export async function getTodayLogForActivity(
  db: SQLite.SQLiteDatabase, activityId: string
): Promise<ActivityLog | null> {
  const today = new Date().toISOString().split('T')[0];
  const row = await db.getFirstAsync<LogRow>(
    'SELECT * FROM activity_logs WHERE activity_id = ? AND completed_at LIKE ? LIMIT 1',
    [activityId, `${today}%`]
  );
  return row ? rowToLog(row) : null;
}

export async function getAllRecentLogs(
  db: SQLite.SQLiteDatabase, days = 30
): Promise<ActivityLog[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const rows = await db.getAllAsync<LogRow>(
    'SELECT * FROM activity_logs WHERE completed_at >= ? ORDER BY completed_at DESC',
    [cutoff.toISOString()]
  );
  return rows.map(rowToLog);
}

export async function logCompletion(
  db: SQLite.SQLiteDatabase, activityId: string, note = ''
): Promise<ActivityLog> {
  const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const completedAt = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO activity_logs (id, activity_id, completed_at, note) VALUES (?, ?, ?, ?)',
    [id, activityId, completedAt, note]
  );
  return { id, activityId, completedAt, note };
}

export async function removeLog(
  db: SQLite.SQLiteDatabase, logId: string
): Promise<void> {
  await db.runAsync('DELETE FROM activity_logs WHERE id = ?', [logId]);
}
