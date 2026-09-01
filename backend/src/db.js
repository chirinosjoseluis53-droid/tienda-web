import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(join(DATA_DIR, 'minimarket.db'));

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS store_settings (
  store_id INTEGER PRIMARY KEY,
  store_name TEXT NOT NULL DEFAULT 'Mi Minimarket',
  currency TEXT NOT NULL DEFAULT '$',
  tax_rate REAL NOT NULL DEFAULT 0,
  low_stock_alert INTEGER NOT NULL DEFAULT 1,
  initial_fund REAL NOT NULL DEFAULT 100,
  box_open_time TEXT DEFAULT '08:00',
  box_close_time TEXT DEFAULT '18:00'
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  store_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'empleado' CHECK (role IN ('superadmin', 'admin', 'empleado')),
  active INTEGER NOT NULL DEFAULT 1,
  store_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  barcode TEXT DEFAULT '',
  price REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 5,
  category_id INTEGER,
  image TEXT DEFAULT '',
  store_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  cedula TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  store_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  client_id INTEGER,
  total REAL NOT NULL DEFAULT 0,
  store_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  store_name TEXT NOT NULL DEFAULT 'Mi Minimarket',
  currency TEXT NOT NULL DEFAULT '$',
  tax_rate REAL NOT NULL DEFAULT 0,
  low_stock_alert INTEGER NOT NULL DEFAULT 1,
  initial_fund REAL NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS cash_closes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  turn TEXT NOT NULL DEFAULT 'Matutino',
  date TEXT NOT NULL,
  store_id INTEGER,
  system_cash REAL NOT NULL DEFAULT 0,
  system_card REAL NOT NULL DEFAULT 0,
  system_transfer REAL NOT NULL DEFAULT 0,
  system_initial_fund REAL NOT NULL DEFAULT 0,
  system_total REAL NOT NULL DEFAULT 0,
  declared_cash REAL NOT NULL DEFAULT 0,
  declared_card REAL NOT NULL DEFAULT 0,
  declared_transfer REAL NOT NULL DEFAULT 0,
  declared_initial_fund REAL NOT NULL DEFAULT 0,
  declared_total REAL NOT NULL DEFAULT 0,
  difference REAL NOT NULL DEFAULT 0,
  explanation TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`);

if (!get('SELECT id FROM settings WHERE id = 1')) {
  run('INSERT INTO settings (id) VALUES (1)');
}

function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}
ensureColumn('clients', 'cedula', "cedula TEXT DEFAULT ''");
ensureColumn('clients', 'store_id', 'store_id INTEGER');
ensureColumn('products', 'image', "image TEXT DEFAULT ''");
ensureColumn('products', 'serial', "serial TEXT DEFAULT ''");
ensureColumn('products', 'expiration_date', "expiration_date TEXT DEFAULT ''");
ensureColumn('products', 'store_id', 'store_id INTEGER');
ensureColumn('categories', 'store_id', 'store_id INTEGER');
ensureColumn('sales', 'payment_method', "payment_method TEXT DEFAULT 'efectivo'");
ensureColumn('sales', 'payment_detail', "payment_detail TEXT DEFAULT '{}'");
ensureColumn('sales', 'store_id', 'store_id INTEGER');
ensureColumn('cash_closes', 'store_id', 'store_id INTEGER');
ensureColumn('users', 'store_id', 'store_id INTEGER');
ensureColumn('settings', 'initial_fund', 'initial_fund REAL NOT NULL DEFAULT 100');
ensureColumn('settings', 'box_open_time', "box_open_time TEXT DEFAULT '08:00'");
ensureColumn('settings', 'box_close_time', "box_close_time TEXT DEFAULT '18:00'");

export function query(sql, params = []) {
  return db.prepare(sql).all(...params);
}

export function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}

export function run(sql, params = []) {
  const r = db.prepare(sql).run(...params);
  return { id: Number(r.lastInsertRowid), changes: Number(r.changes) };
}

export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}