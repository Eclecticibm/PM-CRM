const express = require('express');
const router = express.Router();
const users = require('../models/users');

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('auth/login', { error: null });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.findByEmail(String(email || '').trim());
  if (!user || !user.active || !users.verifyPassword(user, password || '')) {
    return res.status(401).render('auth/login', { error: 'Invalid email or password.' });
  }
  req.session.userId = user.id;
  req.session.userName = user.name;
  req.session.role = user.role;
  res.redirect('/');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
