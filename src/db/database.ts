import * as SQLite from 'expo-sqlite';
import { ScheduleItem, ItemLog, ChecklistTask, ProjectTask, Category } from '../types';

// ── Schema init ───────────────────────────────────────────────────────────────

// Bump this whenever item types or table structure changes.
// On mismatch all data tables are dropped and reseeded from scratch.
const SCHEMA_VERSION = 2;

export async function initDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');

  // Version table — created once, never dropped
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)
  `);
  const vRow = await db.getFirstAsync<{ version: number }>('SELECT version FROM schema_version LIMIT 1');
  const currentVersion = vRow?.version ?? 0;

  if (currentVersion < SCHEMA_VERSION) {
    // Breaking schema change — wipe all data tables so stale rows can't crash the app
    await db.execAsync(`
      DROP TABLE IF EXISTS schedule_items;
      DROP TABLE IF EXISTS item_logs;
      DROP TABLE IF EXISTS checklist_tasks;
      DROP TABLE IF EXISTS project_tasks;
      DROP TABLE IF EXISTS categories;
      DROP TABLE IF EXISTS activity_logs;
      DROP TABLE IF EXISTS activities;
    `);
    if (vRow) {
      await db.runAsync('UPDATE schema_version SET version = ?', [SCHEMA_VERSION]);
    } else {
      await db.runAsync('INSERT INTO schema_version (version) VALUES (?)', [SCHEMA_VERSION]);
    }
  }

  // Core tables
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id         TEXT PRIMARY KEY NOT NULL,
      name       TEXT NOT NULL,
      color      TEXT NOT NULL DEFAULT '#5B5FEF',
      icon       TEXT NOT NULL DEFAULT 'folder-outline',
      parent_id  TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS schedule_items (
      id                     TEXT PRIMARY KEY NOT NULL,
      item_type              TEXT NOT NULL DEFAULT 'habit',
      name                   TEXT NOT NULL,
      description            TEXT NOT NULL DEFAULT '',
      category_id            TEXT NOT NULL DEFAULT '',
      subcategory_id         TEXT NOT NULL DEFAULT '',
      is_recurring           INTEGER NOT NULL DEFAULT 1,
      periodic_type          TEXT NOT NULL DEFAULT 'daily',
      frequency_days         TEXT NOT NULL DEFAULT '[]',
      frequency_days_2       TEXT NOT NULL DEFAULT '[]',
      frequency_day_of_month INTEGER NOT NULL DEFAULT 1,
      frequency_month        INTEGER NOT NULL DEFAULT 0,
      target_date            TEXT NOT NULL DEFAULT '',
      target_time            TEXT NOT NULL DEFAULT '',
      reminder_time          TEXT NOT NULL DEFAULT '',
      color                  TEXT NOT NULL DEFAULT '#5B5FEF',
      icon                   TEXT NOT NULL DEFAULT 'checkmark-circle-outline',
      is_active              INTEGER NOT NULL DEFAULT 1,
      is_completed           INTEGER NOT NULL DEFAULT 0,
      completed_at           TEXT NOT NULL DEFAULT '',
      created_at             TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS item_logs (
      id           TEXT PRIMARY KEY NOT NULL,
      item_id      TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      note         TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS checklist_tasks (
      id           TEXT PRIMARY KEY NOT NULL,
      item_id      TEXT NOT NULL,
      title        TEXT NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0,
      sort_order   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS project_tasks (
      id          TEXT PRIMARY KEY NOT NULL,
      item_id     TEXT NOT NULL,
      title       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'todo',
      due_date    TEXT NOT NULL DEFAULT '',
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL
    );
  `);

  // Migrate categories table: add parent_id if missing (handles existing installs)
  const catCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(categories)');
  const catColNames = new Set(catCols.map(c => c.name));
  if (!catColNames.has('parent_id')) {
    await db.execAsync(`ALTER TABLE categories ADD COLUMN parent_id TEXT NOT NULL DEFAULT '';`);
  }

  // Seed categories if empty
  const existing = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM categories');
  if (existing && existing.count === 0) {
    await seedCategories(db);
  }
}

// ── Seed ──────────────────────────────────────────────────────────────────────

async function seedCategories(db: SQLite.SQLiteDatabase): Promise<void> {
  type Seed = { id: string; name: string; color: string; icon: string; subs: { id: string; name: string }[] };

  const TOP: Seed[] = [
    {
      id: 'cat-health', name: 'Health & Fitness', color: '#10B981', icon: 'fitness-outline',
      subs: [
        { id: 'sub-exercise',   name: 'Exercise' },
        { id: 'sub-nutrition',  name: 'Nutrition' },
        { id: 'sub-sleep',      name: 'Sleep' },
        { id: 'sub-mental',     name: 'Mental Health' },
        { id: 'sub-medical',    name: 'Medical' },
      ],
    },
    {
      id: 'cat-mind', name: 'Mind & Learning', color: '#3B82F6', icon: 'book-outline',
      subs: [
        { id: 'sub-study',    name: 'Study' },
        { id: 'sub-reading',  name: 'Reading' },
        { id: 'sub-skills',   name: 'Skills' },
        { id: 'sub-creative', name: 'Creative' },
      ],
    },
    {
      id: 'cat-home', name: 'Home & Life', color: '#F59E0B', icon: 'home-outline',
      subs: [
        { id: 'sub-chores',    name: 'Chores' },
        { id: 'sub-errands',   name: 'Errands' },
        { id: 'sub-finance',   name: 'Finance' },
        { id: 'sub-family',    name: 'Family' },
        { id: 'sub-social',    name: 'Social' },
      ],
    },
    {
      id: 'cat-work', name: 'Work & Goals', color: '#8B5CF6', icon: 'briefcase-outline',
      subs: [
        { id: 'sub-projects',  name: 'Projects' },
        { id: 'sub-admin',     name: 'Admin' },
        { id: 'sub-career',    name: 'Career' },
        { id: 'sub-meetings',  name: 'Meetings' },
      ],
    },
    {
      id: 'cat-spiritual', name: 'Spiritual & Purpose', color: '#EC4899', icon: 'heart-outline',
      subs: [
        { id: 'sub-reflection', name: 'Reflection' },
        { id: 'sub-faith',      name: 'Faith' },
        { id: 'sub-gratitude',  name: 'Gratitude' },
      ],
    },
    {
      id: 'cat-leisure', name: 'Leisure & Hobbies', color: '#EF4444', icon: 'game-controller-outline',
      subs: [
        { id: 'sub-hobbies',   name: 'Hobbies' },
        { id: 'sub-sport',     name: 'Sport' },
        { id: 'sub-travel',    name: 'Travel' },
        { id: 'sub-media',     name: 'Media' },
      ],
    },
    {
      id: 'cat-community', name: 'Community & Service', color: '#06B6D4', icon: 'people-outline',
      subs: [
        { id: 'sub-volunteer',  name: 'Volunteering' },
        { id: 'sub-civic',      name: 'Civic' },
        { id: 'sub-giving',     name: 'Giving' },
      ],
    },
  ];

  for (const top of TOP) {
    await db.runAsync(
      'INSERT INTO categories (id, name, color, icon, parent_id) VALUES (?, ?, ?, ?, ?)',
      [top.id, top.name, top.color, top.icon, '']
    );
    for (const sub of top.subs) {
      await db.runAsync(
        'INSERT INTO categories (id, name, color, icon, parent_id) VALUES (?, ?, ?, ?, ?)',
        [sub.id, sub.name, top.color, top.icon, top.id]
      );
    }
  }
}

// ── Categories ────────────────────────────────────────────────────────────────

type CategoryRow = { id: string; name: string; color: string; icon: string; parent_id: string };

function rowToCategory(r: CategoryRow): Category {
  return { id: r.id, name: r.name, color: r.color, icon: r.icon, parentId: r.parent_id };
}

export async function getCategories(db: SQLite.SQLiteDatabase): Promise<Category[]> {
  const rows = await db.getAllAsync<CategoryRow>('SELECT * FROM categories ORDER BY parent_id, name');
  return rows.map(rowToCategory);
}

export async function upsertCategory(db: SQLite.SQLiteDatabase, cat: Category): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO categories (id, name, color, icon, parent_id) VALUES (?, ?, ?, ?, ?)',
    [cat.id, cat.name, cat.color, cat.icon, cat.parentId]
  );
}

export async function deleteCategory(db: SQLite.SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM categories WHERE id = ? OR parent_id = ?', [id, id]);
}

// ── Schedule Items ────────────────────────────────────────────────────────────

type ItemRow = {
  id: string; item_type: string; name: string; description: string;
  category_id: string; subcategory_id: string;
  is_recurring: number; periodic_type: string;
  frequency_days: string; frequency_days_2: string;
  frequency_day_of_month: number; frequency_month: number;
  target_date: string; target_time: string; reminder_time: string;
  color: string; icon: string;
  is_active: number; is_completed: number; completed_at: string;
  created_at: string;
};

function rowToItem(r: ItemRow): ScheduleItem {
  return {
    id: r.id,
    itemType: r.item_type as ScheduleItem['itemType'],
    name: r.name,
    description: r.description,
    categoryId: r.category_id,
    subcategoryId: r.subcategory_id,
    isRecurring: r.is_recurring === 1,
    periodicType: (r.periodic_type ?? 'daily') as ScheduleItem['periodicType'],
    frequencyDays: JSON.parse(r.frequency_days || '[]'),
    frequencyDays2: JSON.parse(r.frequency_days_2 || '[]'),
    frequencyDayOfMonth: r.frequency_day_of_month ?? 1,
    frequencyMonth: r.frequency_month ?? 0,
    targetDate: r.target_date,
    targetTime: r.target_time,
    reminderTime: r.reminder_time,
    color: r.color,
    icon: r.icon,
    isActive: r.is_active === 1,
    isCompleted: r.is_completed === 1,
    completedAt: r.completed_at,
    createdAt: r.created_at,
  };
}

export async function getItems(db: SQLite.SQLiteDatabase): Promise<ScheduleItem[]> {
  const rows = await db.getAllAsync<ItemRow>(
    'SELECT * FROM schedule_items WHERE is_active = 1 ORDER BY created_at DESC'
  );
  return rows.map(rowToItem);
}

export async function getItemsByType(
  db: SQLite.SQLiteDatabase, itemType: string
): Promise<ScheduleItem[]> {
  const rows = await db.getAllAsync<ItemRow>(
    'SELECT * FROM schedule_items WHERE is_active = 1 AND item_type = ? ORDER BY name ASC',
    [itemType]
  );
  return rows.map(rowToItem);
}

export async function getItem(
  db: SQLite.SQLiteDatabase, id: string
): Promise<ScheduleItem | null> {
  const row = await db.getFirstAsync<ItemRow>(
    'SELECT * FROM schedule_items WHERE id = ?', [id]
  );
  return row ? rowToItem(row) : null;
}

export async function upsertItem(
  db: SQLite.SQLiteDatabase, item: ScheduleItem
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO schedule_items
       (id, item_type, name, description, category_id, subcategory_id,
        is_recurring, periodic_type, frequency_days, frequency_days_2,
        frequency_day_of_month, frequency_month,
        target_date, target_time, reminder_time,
        color, icon, is_active, is_completed, completed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id, item.itemType, item.name, item.description,
      item.categoryId, item.subcategoryId,
      item.isRecurring ? 1 : 0, item.periodicType,
      JSON.stringify(item.frequencyDays),
      JSON.stringify(item.frequencyDays2),
      item.frequencyDayOfMonth, item.frequencyMonth,
      item.targetDate, item.targetTime, item.reminderTime,
      item.color, item.icon,
      item.isActive ? 1 : 0,
      item.isCompleted ? 1 : 0,
      item.completedAt,
      item.createdAt,
    ]
  );
}

export async function softDeleteItem(
  db: SQLite.SQLiteDatabase, id: string
): Promise<void> {
  await db.runAsync('UPDATE schedule_items SET is_active = 0 WHERE id = ?', [id]);
}

// ── Item Logs ─────────────────────────────────────────────────────────────────

type LogRow = { id: string; item_id: string; completed_at: string; note: string };

function rowToLog(r: LogRow): ItemLog {
  return { id: r.id, itemId: r.item_id, completedAt: r.completed_at, note: r.note };
}

export async function getLogsForItem(
  db: SQLite.SQLiteDatabase, itemId: string, limit = 90
): Promise<ItemLog[]> {
  const rows = await db.getAllAsync<LogRow>(
    'SELECT * FROM item_logs WHERE item_id = ? ORDER BY completed_at DESC LIMIT ?',
    [itemId, limit]
  );
  return rows.map(rowToLog);
}

export async function getLogForItemOnDate(
  db: SQLite.SQLiteDatabase, itemId: string, dateStr: string
): Promise<ItemLog | null> {
  const row = await db.getFirstAsync<LogRow>(
    'SELECT * FROM item_logs WHERE item_id = ? AND completed_at LIKE ? LIMIT 1',
    [itemId, `${dateStr}%`]
  );
  return row ? rowToLog(row) : null;
}

export async function getAllRecentLogs(
  db: SQLite.SQLiteDatabase, days = 30
): Promise<ItemLog[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const rows = await db.getAllAsync<LogRow>(
    'SELECT * FROM item_logs WHERE completed_at >= ? ORDER BY completed_at DESC',
    [cutoff.toISOString()]
  );
  return rows.map(rowToLog);
}

export async function logCompletion(
  db: SQLite.SQLiteDatabase, itemId: string, note = ''
): Promise<ItemLog> {
  const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const completedAt = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO item_logs (id, item_id, completed_at, note) VALUES (?, ?, ?, ?)',
    [id, itemId, completedAt, note]
  );
  return { id, itemId, completedAt, note };
}

export async function removeLog(
  db: SQLite.SQLiteDatabase, logId: string
): Promise<void> {
  await db.runAsync('DELETE FROM item_logs WHERE id = ?', [logId]);
}

// ── Checklist Tasks ───────────────────────────────────────────────────────────

type ChecklistRow = { id: string; item_id: string; title: string; is_completed: number; sort_order: number };

function rowToChecklistTask(r: ChecklistRow): ChecklistTask {
  return { id: r.id, itemId: r.item_id, title: r.title, isCompleted: r.is_completed === 1, sortOrder: r.sort_order };
}

export async function getChecklistTasks(
  db: SQLite.SQLiteDatabase, itemId: string
): Promise<ChecklistTask[]> {
  const rows = await db.getAllAsync<ChecklistRow>(
    'SELECT * FROM checklist_tasks WHERE item_id = ? ORDER BY sort_order ASC',
    [itemId]
  );
  return rows.map(rowToChecklistTask);
}

export async function upsertChecklistTask(
  db: SQLite.SQLiteDatabase, task: ChecklistTask
): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO checklist_tasks (id, item_id, title, is_completed, sort_order) VALUES (?, ?, ?, ?, ?)',
    [task.id, task.itemId, task.title, task.isCompleted ? 1 : 0, task.sortOrder]
  );
}

export async function deleteChecklistTask(
  db: SQLite.SQLiteDatabase, id: string
): Promise<void> {
  await db.runAsync('DELETE FROM checklist_tasks WHERE id = ?', [id]);
}

// ── Project Tasks ─────────────────────────────────────────────────────────────

type ProjectTaskRow = {
  id: string; item_id: string; title: string; description: string;
  status: string; due_date: string; sort_order: number; created_at: string;
};

function rowToProjectTask(r: ProjectTaskRow): ProjectTask {
  return {
    id: r.id, itemId: r.item_id, title: r.title, description: r.description,
    status: r.status as ProjectTask['status'], dueDate: r.due_date,
    sortOrder: r.sort_order, createdAt: r.created_at,
  };
}

export async function getProjectTasks(
  db: SQLite.SQLiteDatabase, itemId: string
): Promise<ProjectTask[]> {
  const rows = await db.getAllAsync<ProjectTaskRow>(
    'SELECT * FROM project_tasks WHERE item_id = ? ORDER BY sort_order ASC',
    [itemId]
  );
  return rows.map(rowToProjectTask);
}

export async function upsertProjectTask(
  db: SQLite.SQLiteDatabase, task: ProjectTask
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO project_tasks
       (id, item_id, title, description, status, due_date, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [task.id, task.itemId, task.title, task.description, task.status, task.dueDate, task.sortOrder, task.createdAt]
  );
}

export async function deleteProjectTask(
  db: SQLite.SQLiteDatabase, id: string
): Promise<void> {
  await db.runAsync('DELETE FROM project_tasks WHERE id = ?', [id]);
}
