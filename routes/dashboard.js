const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const clients = require('../models/clients');
const tasks = require('../models/tasks');
const interactions = require('../models/interactions');

router.get('/', requireLogin, (req, res) => {
  const taskCounts = tasks.dashboardCounts(); // org-wide, shown alongside "my tasks" counts
  const myTaskCounts = tasks.dashboardCounts(req.session.userId);
  res.render('dashboard', {
    totalClients: clients.totalCount(),
    newThisMonth: clients.newThisMonth(),
    taskCounts,
    myTaskCounts,
    statusBreakdown: clients.breakdownByStatus(),
    sourceBreakdown: clients.breakdownBySource(),
    activityByUser: interactions.activityByUser(30),
  });
});

module.exports = router;
