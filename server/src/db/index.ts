import initSqlJs, { Database as SqlJsDb } from 'sql.js';
import path from 'path';
import fs from 'fs';

function getDbPath() {
  return process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'todos.db');
}

let db: SqlJsDb;

export async function initDb(): Promise<SqlJsDb> {
  const SQL = await initSqlJs();
  const dbPath = getDbPath();

  if (dbPath === ':memory:') {
    db = new SQL.Database();
  } else {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }
  }

  db.exec('PRAGMA foreign_keys = ON');
  initSchema(db);
  runMigrations(db);
  save();
  return db;
}

export function getDb(): SqlJsDb {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

export function save() {
  const dbPath = getDbPath();
  if (!db || dbPath === ':memory:') return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(getDbPath(), buffer);
}

// For tests: reset the in-memory DB so initDb creates a fresh one
export function resetForTest() {
  if (db) {
    try { db.close(); } catch (_) {}
  }
  db = undefined as any;
}

// Helper: run a query and return all rows as objects
export function all(sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper: run a query and return first row
export function get(sql: string, params: any[] = []): any | undefined {
  const rows = all(sql, params);
  return rows[0];
}

// Helper: execute a write statement
export function run(sql: string, params: any[] = []): { changes: number; lastId: number } {
  db.run(sql, params);
  const changes = db.getRowsModified();
  const lastIdRow = all('SELECT last_insert_rowid() as id');
  const lastId = lastIdRow[0]?.id ?? 0;
  save();
  return { changes, lastId };
}

function initSchema(db: SqlJsDb) {
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      due_date TEXT,
      collapsed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      priority INTEGER NOT NULL DEFAULT 5,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      notes TEXT,
      estimate_hours REAL,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS ado_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ado_work_item_id INTEGER NOT NULL UNIQUE,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      sprint_name TEXT,
      state TEXT,
      assigned_to TEXT,
      last_synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS todo_ado_links (
      todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      ado_item_id INTEGER NOT NULL REFERENCES ado_items(id) ON DELETE CASCADE,
      PRIMARY KEY (todo_id, ado_item_id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS project_ado_links (
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      ado_item_id INTEGER NOT NULL REFERENCES ado_items(id) ON DELETE CASCADE,
      PRIMARY KEY (project_id, ado_item_id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS copilot_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      todo_id INTEGER REFERENCES todos(id) ON DELETE SET NULL,
      session_url TEXT,
      session_id TEXT,
      task_prompt TEXT,
      notes TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'logged',
      repo TEXT,
      branch TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS todo_copilot_sessions (
      todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      session_id INTEGER NOT NULL REFERENCES copilot_sessions(id) ON DELETE CASCADE,
      PRIMARY KEY (todo_id, session_id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS github_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      github_id INTEGER NOT NULL UNIQUE,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      repo TEXT NOT NULL,
      state TEXT,
      labels TEXT,
      created_at_gh TEXT,
      updated_at_gh TEXT,
      last_synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS session_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES copilot_sessions(id) ON DELETE CASCADE,
      line TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function runMigrations(db: SqlJsDb) {
  // Get existing columns for copilot_sessions
  const cols = new Set<string>();
  try {
    const stmt = db.prepare("PRAGMA table_info(copilot_sessions)");
    while (stmt.step()) {
      const row = stmt.getAsObject();
      cols.add(row.name as string);
    }
    stmt.free();
  } catch (_) {
    return; // table doesn't exist yet, schema will create it
  }

  const migrations: [string, string][] = [
    ['project_id', 'ALTER TABLE copilot_sessions ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL'],
    ['todo_id', 'ALTER TABLE copilot_sessions ADD COLUMN todo_id INTEGER REFERENCES todos(id) ON DELETE SET NULL'],
    ['task_prompt', 'ALTER TABLE copilot_sessions ADD COLUMN task_prompt TEXT'],
    ['status', "ALTER TABLE copilot_sessions ADD COLUMN status TEXT NOT NULL DEFAULT 'logged'"],
  ];

  for (const [col, sql] of migrations) {
    if (!cols.has(col)) {
      try { db.run(sql); } catch (_) {}
    }
  }

  // Projects migrations
  const projCols = new Set<string>();
  try {
    const stmt2 = db.prepare("PRAGMA table_info(projects)");
    while (stmt2.step()) {
      const row = stmt2.getAsObject();
      projCols.add(row.name as string);
    }
    stmt2.free();
  } catch (_) { return; }

  if (!projCols.has('priority')) {
    try { db.run('ALTER TABLE projects ADD COLUMN priority INTEGER NOT NULL DEFAULT 5'); } catch (_) {}
  }

  // Todos migrations
  const todoCols = new Set<string>();
  try {
    const stmt3 = db.prepare("PRAGMA table_info(todos)");
    while (stmt3.step()) {
      const row = stmt3.getAsObject();
      todoCols.add(row.name as string);
    }
    stmt3.free();
  } catch (_) { return; }

  if (!todoCols.has('notes')) {
    try { db.run('ALTER TABLE todos ADD COLUMN notes TEXT'); } catch (_) {}
  }
  if (!todoCols.has('scheduled_date')) {
    try { db.run('ALTER TABLE todos ADD COLUMN scheduled_date TEXT'); } catch (_) {}
  }
}
