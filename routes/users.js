const express = require('express');
const router = express.Router();
const { requireLogin, requireAdmin } = require('../middleware/auth');
const users = require('../models/users');

router.use(requireLogin, requireAdmin); // admin-only user management page (spec: admin creates users)

router.get('/', (req, res) => {
  res.render('users/list', { users: users.all(), error: null });
});

router.post('/', (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.render('users/list', { users: users.all(), error: 'Name, email, and password are required.' });
  }
  if (users.findByEmail(email)) {
    return res.render('users/list', { users: users.all(), error: 'A user with that email already exists.' });
  }
  users.create({ name, email, password, role: role === 'admin' ? 'admin' : 'user' });
  res.redirect('/users');
});

router.post('/:id/deactivate', (req, res) => {
  users.setActive(req.params.id, false);
  res.redirect('/users');
});

router.post('/:id/activate', (req, res) => {
  users.setActive(req.params.id, true);
  res.redirect('/users');
});

module.exports = router;
