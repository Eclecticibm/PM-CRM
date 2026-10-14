// Database connection + first-run migration.
// Isolated here so the rest of the app only talks to models/*, never to
// the sqlite driver directly. Swapping to Postgres later means rewriting
// this file (and the model files) without touching routes/views.
//
// NOTE: uses Node's built-in `node:sqlite` module (stable as of Node 22.5+,
// no native compilation needed) instead of better-sqlite3. The API is
// deliberately very similar (prepare/run/get/all, named @params), so this
// is a drop-in choice. See README "Deviations from spec" for why.
require('dotenv').config(); // load .env even when this module is required standalone (e.g. scripts/seed.js)
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'crm.sqlite');
const db = new DatabaseSync(DB_PATH);
// WAL mode needs shared-memory mmap which some sandboxed/network filesystems
// don't support (causes "disk I/O error"); DELETE mode is slower under heavy
// concurrency but works everywhere and is plenty for a small-team local CRM.
db.exec("PRAGMA journal_mode = DELETE");
db.exec('PRAGMA foreign_keys = ON');

function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
}

migrate();

module.exports = db;
