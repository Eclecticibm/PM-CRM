const db = require('../db');

const LIST_COLUMNS = `
  c.*, u.name AS owner_name
`;

function buildFilters({ search, status, tag, owner }) {
  const clauses = ['c.archived = 0'];
  const params = {};

  if (search) {
    clauses.push('(c.name LIKE @search OR c.company LIKE @search OR c.email LIKE @search)');
    params.search = `%${search}%`;
  }
  if (status) {
    clauses.push('c.status = @status');
    params.status = status;
  }
  if (tag) {
    clauses.push('c.tags LIKE @tag');
    params.tag = `%${tag}%`;
  }
  if (owner) {
    clauses.push('c.owner_id = @owner');
    params.owner = owner;
  }
  return { where: clauses.join(' AND '), params };
}

function list(filters = {}) {
  const { where, params } = buildFilters(filters);
  const sql = `
    SELECT ${LIST_COLUMNS}
    FROM clients c
    LEFT JOIN users u ON u.id = c.owner_id
    WHERE ${where}
    ORDER BY c.name ASC
  `;
  return db.prepare(sql).all(params);
}

function listArchived() {
  return db.prepare(`
    SELECT ${LIST_COLUMNS}
    FROM clients c
    LEFT JOIN users u ON u.id = c.owner_id
    WHERE c.archived = 1
    ORDER BY c.name ASC
  `).all();
}

function findById(id) {
  return db.prepare(`
    SELECT ${LIST_COLUMNS}
    FROM clients c
    LEFT JOIN users u ON u.id = c.owner_id
    WHERE c.id = ?
  `).get(id);
}

// Duplicate detection by email or phone (spec 3.2) - used before create.
function findDuplicates({ email, phone }) {
  const clauses = [];
  const params = {};
  if (email) {
    clauses.push('email = @email');
    params.email = email;
  }
  if (phone) {
    clauses.push('phone = @phone');
    params.phone = phone;
  }
  if (clauses.length === 0) return [];
  return db.prepare(`
    SELECT * FROM clients WHERE archived = 0 AND (${clauses.join(' OR ')})
  `).all(params);
}

function create(data) {
  const stmt = db.prepare(`
    INSERT INTO clients (name, company, email, phone, address, status, source, owner_id, tags, notes)
    VALUES (@name, @company, @email, @phone, @address, @status, @source, @owner_id, @tags, @notes)
  `);
  const info = stmt.run({
    name: data.name,
    company: data.company || null,
    email: data.email || null,
    phone: data.phone || null,
    address: data.address || null,
    status: data.status || 'lead',
    source: data.source || null,
    owner_id: data.owner_id || null,
    tags: data.tags || null,
    notes: data.notes || null,
  });
  return findById(info.lastInsertRowid);
}

function update(id, data) {
  db.prepare(`
    UPDATE clients SET
      name = @name, company = @company, email = @email, phone = @phone,
      address = @address, status = @status, source = @source,
      owner_id = @owner_id, tags = @tags, notes = @notes,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({
    id,
    name: data.name,
    company: data.company || null,
    email: data.email || null,
    phone: data.phone || null,
    address: data.address || null,
    status: data.status || 'lead',
    source: data.source || null,
    owner_id: data.owner_id || null,
    tags: data.tags || null,
    notes: data.notes || null,
  });
  return findById(id);
}

function archive(id) {
  db.prepare("UPDATE clients SET archived = 1, updated_at = datetime('now') WHERE id = ?").run(id);
}

function unarchive(id) {
  db.prepare("UPDATE clients SET archived = 0, updated_at = datetime('now') WHERE id = ?").run(id);
}

// Dashboard stats (spec 3.6).
function totalCount() {
  return db.prepare('SELECT COUNT(*) AS c FROM clients WHERE archived = 0').get().c;
}

function newThisMonth() {
  return db.prepare(`
    SELECT COUNT(*) AS c FROM clients
    WHERE archived = 0 AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
  `).get().c;
}

function breakdownByStatus() {
  return db.prepare(`
    SELECT status, COUNT(*) AS c FROM clients WHERE archived = 0 GROUP BY status
  `).all();
}

function breakdownBySource() {
  return db.prepare(`
    SELECT COALESCE(source, 'Unknown') AS source, COUNT(*) AS c
    FROM clients WHERE archived = 0 GROUP BY source
  `).all();
}

// Distinct tags for the filter dropdown; tags are stored comma-separated.
function distinctTags() {
  const rows = db.prepare("SELECT tags FROM clients WHERE archived = 0 AND tags IS NOT NULL AND tags != ''").all();
  const set = new Set();
  rows.forEach((r) => {
    r.tags.split(',').map((t) => t.trim()).filter(Boolean).forEach((t) => set.add(t));
  });
  return Array.from(set).sort();
}

function globalSearch(q) {
  return db.prepare(`
    SELECT * FROM clients
    WHERE archived = 0 AND (name LIKE @q OR company LIKE @q OR email LIKE @q)
    ORDER BY name LIMIT 25
  `).all({ q: `%${q}%` });
}

module.exports = {
  list, listArchived, findById, findDuplicates, create, update, archive, unarchive,
  totalCount, newThisMonth, breakdownByStatus, breakdownBySource, distinctTags, globalSearch,
};
