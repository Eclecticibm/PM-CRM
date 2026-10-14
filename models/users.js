const db = require('../db');
const bcrypt = require('bcryptjs'); // pure-JS, no native compile step needed

const BCRYPT_ROUNDS = 10;

function findByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase());
}

function findById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function all() {
  return db.prepare('SELECT id, name, email, role, active, created_at FROM users ORDER BY name').all();
}

function create({ name, email, password, role = 'user' }) {
  const password_hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  const stmt = db.prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  );
  const info = stmt.run(name, String(email).toLowerCase(), password_hash, role);
  return findById(info.lastInsertRowid);
}

function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password_hash);
}

function setActive(id, active) {
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
}

function count() {
  return db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
}

module.exports = { findByEmail, findById, all, create, verifyPassword, setActive, count };
