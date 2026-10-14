// Session-based auth guards.
function requireLogin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || req.session.role !== 'admin') {
    return res.status(403).render('error', { message: 'Admin access required.' });
  }
  next();
}

// Makes current user + flash messages available to every view without
// having to pass them explicitly from each route.
function attachLocals(req, res, next) {
  res.locals.currentUser = req.session && req.session.userId
    ? { id: req.session.userId, name: req.session.userName, role: req.session.role }
    : null;
  res.locals.flash = req.session.flash || null;
  if (req.session) req.session.flash = null;
  next();
}

module.exports = { requireLogin, requireAdmin, attachLocals };
