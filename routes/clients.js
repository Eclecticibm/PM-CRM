const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { parse: csvParse } = require('csv-parse/sync');
const { stringify: csvStringify } = require('csv-stringify/sync');

const { requireLogin } = require('../middleware/auth');
const clients = require('../models/clients');
const interactions = require('../models/interactions');
const tasks = require('../models/tasks');
const attachments = require('../models/attachments');
const users = require('../models/users');

router.use(requireLogin);

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${unique}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB cap

// ---- List / filter ----
router.get('/', (req, res) => {
  const { q, status, tag, owner } = req.query;
  const rows = clients.list({ search: q, status, tag, owner });
  res.render('clients/list', {
    clients: rows,
    filters: { q: q || '', status: status || '', tag: tag || '', owner: owner || '' },
    allUsers: users.all(),
    allTags: clients.distinctTags(),
  });
});

// ---- CSV export (must come before /:id routes) ----
router.get('/export/csv', (req, res) => {
  const rows = clients.list({});
  const csvRows = rows.map((c) => ({
    name: c.name,
    company: c.company || '',
    email: c.email || '',
    phone: c.phone || '',
    address: c.address || '',
    status: c.status,
    source: c.source || '',
    owner: c.owner_name || '',
    tags: c.tags || '',
    notes: c.notes || '',
    created_at: c.created_at,
  }));
  const out = csvStringify(csvRows, {
    header: true,
    columns: ['name', 'company', 'email', 'phone', 'address', 'status', 'source', 'owner', 'tags', 'notes', 'created_at'],
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="clients-export.csv"');
  res.send(out);
});

// ---- CSV import ----
router.get('/import/csv', (req, res) => {
  res.render('clients/import', { result: null, allUsers: users.all() });
});

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/import/csv', csvUpload.single('file'), (req, res) => {
  if (!req.file) {
    return res.render('clients/import', { result: { error: 'No file uploaded.' }, allUsers: users.all() });
  }
  let records;
  try {
    records = csvParse(req.file.buffer.toString('utf8'), { columns: true, skip_empty_lines: true, trim: true });
  } catch (e) {
    return res.render('clients/import', { result: { error: 'Could not parse CSV: ' + e.message }, allUsers: users.all() });
  }

  // Fixed column headers documented in README: name,company,email,phone,address,status,source,tags,notes
  let created = 0;
  let skipped = 0;
  const errors = [];
  records.forEach((r, idx) => {
    const name = (r.name || '').trim();
    if (!name) {
      skipped += 1;
      errors.push(`Row ${idx + 2}: missing required "name" field, skipped.`);
      return;
    }
    const status = ['lead', 'active', 'inactive', 'churned'].includes((r.status || '').toLowerCase())
      ? r.status.toLowerCase() : 'lead';
    clients.create({
      name,
      company: r.company,
      email: r.email,
      phone: r.phone,
      address: r.address,
      status,
      source: r.source,
      tags: r.tags,
      notes: r.notes,
      owner_id: req.session.userId,
    });
    created += 1;
  });

  res.render('clients/import', { result: { created, skipped, errors }, allUsers: users.all() });
});

// ---- Create ----
router.get('/new', (req, res) => {
  // NOTE: the render-data key is `clientRecord`, not `client` — EJS reserves
  // a top-level `client` key as a compile OPTION (client-side precompile),
  // which silently breaks `include()` inside the view if we used that name.
  res.render('clients/form', { clientRecord: null, allUsers: users.all(), duplicates: [], errors: [] });
});

router.post('/', (req, res) => {
  const body = req.body;
  const errors = [];
  if (!body.name || !body.name.trim()) errors.push('Name is required.');
  if (body.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) errors.push('Email format looks invalid.');

  // Duplicate detection by email/phone (spec 3.2). A confirm flag bypasses the warning.
  const duplicates = (!body.confirm_duplicate && (body.email || body.phone))
    ? clients.findDuplicates({ email: body.email, phone: body.phone })
    : [];

  if (errors.length || duplicates.length) {
    return res.render('clients/form', {
      clientRecord: body, allUsers: users.all(), duplicates, errors,
    });
  }

  const client = clients.create({
    name: body.name.trim(),
    company: body.company,
    email: body.email,
    phone: body.phone,
    address: body.address,
    status: body.status,
    source: body.source,
    tags: body.tags,
    notes: body.notes,
    owner_id: body.owner_id || null,
  });
  res.redirect('/clients/' + client.id);
});

// ---- Detail ----
router.get('/:id', (req, res) => {
  const client = clients.findById(req.params.id);
  if (!client) return res.status(404).render('error', { message: 'Client not found.' });
  res.render('clients/detail', {
    clientRecord: client,
    interactions: interactions.listForClient(client.id),
    tasks: tasks.listForClient(client.id),
    attachments: attachments.listForClient(client.id),
    allUsers: users.all(),
  });
});

// ---- Edit ----
router.get('/:id/edit', (req, res) => {
  const client = clients.findById(req.params.id);
  if (!client) return res.status(404).render('error', { message: 'Client not found.' });
  res.render('clients/form', { clientRecord: client, allUsers: users.all(), duplicates: [], errors: [] });
});

router.put('/:id', (req, res) => {
  const body = req.body;
  const errors = [];
  if (!body.name || !body.name.trim()) errors.push('Name is required.');
  if (errors.length) {
    return res.render('clients/form', {
      clientRecord: { ...body, id: req.params.id }, allUsers: users.all(), duplicates: [], errors,
    });
  }
  clients.update(req.params.id, {
    name: body.name.trim(),
    company: body.company,
    email: body.email,
    phone: body.phone,
    address: body.address,
    status: body.status,
    source: body.source,
    tags: body.tags,
    notes: body.notes,
    owner_id: body.owner_id || null,
  });
  res.redirect('/clients/' + req.params.id);
});

// ---- Archive / unarchive (soft delete, spec 3.2) ----
router.post('/:id/archive', (req, res) => {
  clients.archive(req.params.id);
  res.redirect('/clients');
});

router.post('/:id/unarchive', (req, res) => {
  clients.unarchive(req.params.id);
  res.redirect('/clients/' + req.params.id);
});

router.get('/archived/list', (req, res) => {
  res.render('clients/archived', { clients: clients.listArchived() });
});

// ---- Interactions (timeline) ----
router.post('/:id/interactions', (req, res) => {
  const body = req.body;
  interactions.create({
    client_id: req.params.id,
    type: body.type,
    occurred_at: body.occurred_at ? new Date(body.occurred_at).toISOString() : new Date().toISOString(),
    summary: body.summary,
    outcome: body.outcome,
    logged_by: req.session.userId,
  });
  res.redirect('/clients/' + req.params.id);
});

router.post('/:id/interactions/:interactionId/pin', (req, res) => {
  const current = interactions.findById(req.params.interactionId);
  interactions.setPinned(req.params.interactionId, current ? !current.pinned : true);
  res.redirect('/clients/' + req.params.id);
});

// ---- Tasks tied to a client ----
router.post('/:id/tasks', (req, res) => {
  const body = req.body;
  tasks.create({
    client_id: req.params.id,
    title: body.title,
    due_date: body.due_date,
    priority: body.priority,
    assignee_id: body.assignee_id || req.session.userId,
  });
  res.redirect('/clients/' + req.params.id);
});

// ---- Attachments ----
router.post('/:id/attachments', upload.single('file'), (req, res) => {
  if (req.file) {
    attachments.create({
      client_id: req.params.id,
      filename: req.file.filename,
      original_name: req.file.originalname,
      filepath: path.join('uploads', req.file.filename),
      uploaded_by: req.session.userId,
    });
  }
  res.redirect('/clients/' + req.params.id);
});

router.get('/:id/attachments/:attachmentId/download', (req, res) => {
  const att = attachments.findById(req.params.attachmentId);
  if (!att || String(att.client_id) !== req.params.id) {
    return res.status(404).render('error', { message: 'File not found.' });
  }
  const fullPath = path.join(__dirname, '..', att.filepath);
  res.download(fullPath, att.original_name);
});

module.exports = router;
