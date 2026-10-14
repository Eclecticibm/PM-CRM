const db = require('../db');

function withComputedStatus(row) {
  // "overdue" is derived, not stored, so it always reflects current date.
  if (row.status === 'open' && row.due_date < todayStr()) {
    return { ...row, computed_status: 'overdue' };
  }
  return { ...row, computed_status: row.status };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function listForClient(clientId) {
  const rows = db.prepare(`
    SELECT t.*, u.name AS assignee_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.client_id = ?
    ORDER BY t.status ASC, t.due_date ASC
  `).all(clientId);
  return rows.map(withComputedStatus);
}

// 'My Tasks' view: bucket into today / this week / overdue / later (spec 3.4).
function listForUser(userId) {
  const rows = db.prepare(`
    SELECT t.*, c.name AS client_name
    FROM tasks t
    LEFT JOIN clients c ON c.id = t.client_id
    WHERE t.assignee_id = ?
    ORDER BY t.due_date ASC
  `).all(userId);
  return rows.map(withComputedStatus);
}

function dashboardCounts(userId = null) {
  const today = todayStr();
  // weekEnd = today + 7 days
  const d = new Date();
  d.setDate(d.getDate() + 7);
  const weekEnd = d.toISOString().slice(0, 10);

  const base = 'FROM tasks WHERE status = \'open\'' + (userId ? ' AND assignee_id = ?' : '');
  const params = userId ? [userId] : [];

  const todayCount = db.prepare(`SELECT COUNT(*) AS c ${base} AND due_date = ?`)
    .get(...params, today).c;
  const weekCount = db.prepare(`SELECT COUNT(*) AS c ${base} AND due_date > ? AND due_date <= ?`)
    .get(...params, today, weekEnd).c;
  const overdueCount = db.prepare(`SELECT COUNT(*) AS c ${base} AND due_date < ?`)
    .get(...params, today).c;

  return { today: todayCount, week: weekCount, overdue: overdueCount };
}

function create(data) {
  const stmt = db.prepare(`
    INSERT INTO tasks (client_id, title, due_date, priority, assignee_id, status)
    VALUES (@client_id, @title, @due_date, @priority, @assignee_id, 'open')
  `);
  const info = stmt.run({
    client_id: data.client_id || null,
    title: data.title,
    due_date: data.due_date,
    priority: data.priority || 'medium',
    assignee_id: data.assignee_id || null,
  });
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
}

function findById(id) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

function markDone(id) {
  db.prepare('UPDATE tasks SET status = \'done\', completed_at = datetime(\'now\') WHERE id = ?').run(id);
}

module.exports = { listForClient, listForUser, dashboardCounts, create, findById, markDone, todayStr };
