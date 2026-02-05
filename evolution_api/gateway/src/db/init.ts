/**
 * Database initialization and migrations
 * Uses SQLite for local storage (separate from Evolution's MariaDB)
 */

import Database from 'better-sqlite3';
import path from 'path';

export function initDatabase(dataPath: string): Database.Database {
  const dbPath = path.join(dataPath, 'gateway.db');
  const db = new Database(dbPath);
  
  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');
  
  // Run migrations
  runMigrations(db);
  
  console.log(`[DB] Database initialized at ${dbPath}`);
  
  return db;
}

function runMigrations(db: Database.Database): void {
  // Create migrations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  const migrations: Array<{ name: string; sql: string }> = [
    {
      name: '001_create_chats',
      sql: `
        CREATE TABLE IF NOT EXISTS wa_chat (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL CHECK(type IN ('group', 'direct')),
          name TEXT NOT NULL,
          enabled INTEGER DEFAULT 1,
          last_message_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_wa_chat_enabled ON wa_chat(enabled);
        CREATE INDEX IF NOT EXISTS idx_wa_chat_type ON wa_chat(type);
      `,
    },
    {
      name: '002_create_messages',
      sql: `
        CREATE TABLE IF NOT EXISTS wa_message (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          provider_message_id TEXT UNIQUE,
          chat_id TEXT NOT NULL,
          sender_id TEXT,
          sender_name TEXT,
          text TEXT,
          message_type TEXT DEFAULT 'text',
          raw_payload TEXT,
          received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          processed INTEGER DEFAULT 0,
          FOREIGN KEY (chat_id) REFERENCES wa_chat(id)
        );
        CREATE INDEX IF NOT EXISTS idx_wa_message_chat ON wa_message(chat_id);
        CREATE INDEX IF NOT EXISTS idx_wa_message_sender ON wa_message(sender_id);
        CREATE INDEX IF NOT EXISTS idx_wa_message_received ON wa_message(received_at);
        CREATE INDEX IF NOT EXISTS idx_wa_message_processed ON wa_message(processed);
      `,
    },
    {
      name: '003_create_ruleset',
      sql: `
        CREATE TABLE IF NOT EXISTS wa_ruleset (
          id INTEGER PRIMARY KEY CHECK(id = 1),
          yaml_text TEXT NOT NULL,
          parsed_json TEXT,
          version INTEGER DEFAULT 1,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT OR IGNORE INTO wa_ruleset (id, yaml_text, parsed_json, version)
        VALUES (1, 'version: 1\nrules: []', '{"version":1,"rules":[]}', 1);
      `,
    },
    {
      name: '004_create_rule_fires',
      sql: `
        CREATE TABLE IF NOT EXISTS wa_rule_fire (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          rule_id TEXT NOT NULL,
          rule_name TEXT,
          message_id INTEGER,
          chat_id TEXT,
          sender_id TEXT,
          matched_text TEXT,
          actions_executed TEXT,
          success INTEGER DEFAULT 1,
          error_message TEXT,
          fired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (message_id) REFERENCES wa_message(id)
        );
        CREATE INDEX IF NOT EXISTS idx_rule_fire_rule ON wa_rule_fire(rule_id);
        CREATE INDEX IF NOT EXISTS idx_rule_fire_fired ON wa_rule_fire(fired_at);
        CREATE INDEX IF NOT EXISTS idx_rule_fire_success ON wa_rule_fire(success);
      `,
    },
    {
      name: '005_create_cooldowns',
      sql: `
        CREATE TABLE IF NOT EXISTS wa_cooldown (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          rule_id TEXT NOT NULL,
          scope_key TEXT NOT NULL,
          expires_at DATETIME NOT NULL,
          UNIQUE(rule_id, scope_key)
        );
        CREATE INDEX IF NOT EXISTS idx_cooldown_expires ON wa_cooldown(expires_at);
      `,
    },
    {
      name: '006_create_settings',
      sql: `
        CREATE TABLE IF NOT EXISTS gateway_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `,
    },
  ];
  
  const appliedMigrations = new Set(
    db.prepare('SELECT name FROM migrations').all().map((row: any) => row.name)
  );
  
  for (const migration of migrations) {
    if (!appliedMigrations.has(migration.name)) {
      console.log(`[DB] Running migration: ${migration.name}`);
      db.exec(migration.sql);
      db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration.name);
    }
  }
}

// Helper types for database rows
export interface DBChat {
  id: string;
  type: 'group' | 'direct';
  name: string;
  enabled: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DBMessage {
  id: number;
  provider_message_id: string | null;
  chat_id: string;
  sender_id: string | null;
  sender_name: string | null;
  text: string | null;
  message_type: string;
  raw_payload: string | null;
  received_at: string;
  processed: number;
}

export interface DBRuleFire {
  id: number;
  rule_id: string;
  rule_name: string | null;
  message_id: number | null;
  chat_id: string | null;
  sender_id: string | null;
  matched_text: string | null;
  actions_executed: string | null;
  success: number;
  error_message: string | null;
  fired_at: string;
}
