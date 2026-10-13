import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

export let db: Database<sqlite3.Database, sqlite3.Statement>;

export const initDb = async () => {
  try {
    db = await open({
      filename: './database.sqlite',
      driver: sqlite3.Database
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS boards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS columns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_id INTEGER REFERENCES boards(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        order_index INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        column_id INTEGER REFERENCES columns(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        order_index INTEGER NOT NULL
      );
    `);
    
    // Soft-delete and board association migrations
    try {
      await db.exec('ALTER TABLE tasks ADD COLUMN is_deleted INTEGER DEFAULT 0;');
    } catch (e) {}
    try {
      await db.exec('ALTER TABLE tasks ADD COLUMN board_id INTEGER;');
    } catch (e) {}
    try {
      await db.exec('ALTER TABLE tasks ADD COLUMN original_column_id INTEGER;');
    } catch (e) {}

    // Backfill board_id for any existing tasks
    await db.exec(`
      UPDATE tasks 
      SET board_id = (SELECT board_id FROM columns WHERE columns.id = tasks.column_id) 
      WHERE board_id IS NULL AND column_id IS NOT NULL;
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS task_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        user_id INTEGER,
        username TEXT,
        change_type TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON task_history(task_id);
`);
    console.log("SQLite Database initialized with User Auth schema, soft-delete, and task_history table.");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
};