const db = require('../db');

function listForClient(clientId) {
  return db.prepare(`
    SELECT a.*, u.name AS uploader_name
    FROM attachments a
    LEFT JOIN users u ON u.id = a.uploaded_by
    WHERE a.client_id = ?
    ORDER BY a.uploaded_at DESC
  `).all(clientId);
}

function create(data) {
  const stmt = db.prepare(`
    INSERT INTO attachments (client_id, filename, original_name, filepath, uploaded_by)
    VALUES (@client_id, @filename, @original_name, @filepath, @uploaded_by)
  `);
  const info = stmt.run(data);
  return db.prepare('SELECT * FROM attachments WHERE id = ?').get(info.lastInsertRowid);
}

function findById(id) {
  return db.prepare('SELECT * FROM attachments WHERE id = ?').get(id);
}

module.exports = { listForClient, create, findById };
