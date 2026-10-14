const db = require('../db');

function listForClient(clientId) {
  // Pinned items first, then newest first (spec 3.3).
  return db.prepare(`
    SELECT i.*, u.name AS logged_by_name
    FROM interactions i
    LEFT JOIN users u ON u.id = i.logged_by
    WHERE i.client_id = ?
    ORDER BY i.pinned DESC, i.occurred_at DESC, i.id DESC
  `).all(clientId);
}

function create(data) {
  const stmt = db.prepare(`
    INSERT INTO interactions (client_id, type, occurred_at, summary, outcome, logged_by)
    VALUES (@client_id, @type, @occurred_at, @summary, @outcome, @logged_by)
  `);
  const info = stmt.run({
    client_id: data.client_id,
    type: data.type,
    occurred_at: data.occurred_at || new Date().toISOString(),
    summary: data.summary,
    outcome: data.outcome || null,
    logged_by: data.logged_by || null,
  });
  return db.prepare('SELECT * FROM interactions WHERE id = ?').get(info.lastInsertRowid);
}

function setPinned(id, pinned) {
  db.prepare('UPDATE interactions SET pinned = ? WHERE id = ?').run(pinned ? 1 : 0, id);
}

function findById(id) {
  return db.prepare('SELECT * FROM interactions WHERE id = ?').get(id);
}

// Activity volume per user, used by dashboard (spec 3.6).
function activityByUser(sinceDays = 30) {
  return db.prepare(`
    SELECT u.name AS user_name, COUNT(i.id) AS c
    FROM interactions i
    JOIN users u ON u.id = i.logged_by
    WHERE i.occurred_at >= datetime('now', ?)
    GROUP BY u.id
    ORDER BY c DESC
  `).all(`-${sinceDays} days`);
}

// Simple cross-client search over note/summary text (spec 3.8).
function searchNotes(q) {
  return db.prepare(`
    SELECT i.*, c.name AS client_name, c.id AS client_id
    FROM interactions i
    JOIN clients c ON c.id = i.client_id
    WHERE c.archived = 0 AND i.summary LIKE ?
    ORDER BY i.occurred_at DESC
    LIMIT 25
  `).all(`%${q}%`);
}

module.exports = { listForClient, create, setPinned, findById, activityByUser, searchNotes };
