const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const tasks = require('../models/tasks');

router.use(requireLogin);

// 'My Tasks' view bucketed into today / this week / overdue / later (spec 3.4).
router.get('/', (req, res) => {
  const rows = tasks.listForUser(req.session.userId);
  const today = tasks.todayStr();
  const d = new Date();
  d.setDate(d.getDate() + 7);
  const weekEnd = d.toISOString().slice(0, 10);

  const buckets = { overdue: [], today: [], week: [], later: [], done: [] };
  rows.forEach((t) => {
    if (t.status === 'done') return buckets.done.push(t);
    if (t.computed_status === 'overdue') return buckets.overdue.push(t);
    if (t.due_date === today) return buckets.today.push(t);
    if (t.due_date <= weekEnd) return buckets.week.push(t);
    return buckets.later.push(t);
  });

  res.render('tasks/my-tasks', { buckets });
});

router.post('/:id/done', (req, res) => {
  tasks.markDone(req.params.id);
  res.redirect(req.get('Referrer') || '/tasks');
});

module.exports = router;
