const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const clients = require('../models/clients');
const interactions = require('../models/interactions');

// Global search across clients (name/company/email) and notes (spec 3.8).
router.get('/', requireLogin, (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.render('search', { q: '', clientResults: [], noteResults: [] });
  }
  res.render('search', {
    q,
    clientResults: clients.globalSearch(q),
    noteResults: interactions.searchNotes(q),
  });
});

module.exports = router;
