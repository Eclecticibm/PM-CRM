require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');

const seedAdmin = require('./scripts/seed');
const { attachLocals } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const clientRoutes = require('./routes/clients');
const taskRoutes = require('./routes/tasks');
const userRoutes = require('./routes/users');
const searchRoutes = require('./routes/search');

const app = express();
const PORT = process.env.PORT || 3000;

// Run once at startup: creates the default admin if the users table is empty.
seedAdmin();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method')); // lets <form> submit PUT/DELETE via a hidden field
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // not public per se; download route also exists, this is a simple fallback
app.use('/public', express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }, // 8 hours
  // NOTE: default MemoryStore is fine for local/single-process dev use.
  // For public hosting, swap in a persistent store (e.g. connect-pg-simple
  // once on Postgres). See README.
}));

app.use(attachLocals);

app.use('/', authRoutes);
app.use('/', dashboardRoutes);
app.use('/clients', clientRoutes);
app.use('/tasks', taskRoutes);
app.use('/users', userRoutes);
app.use('/search', searchRoutes);

app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { message: 'Something went wrong: ' + err.message });
});

app.listen(PORT, () => {
  console.log(`CRM app listening on http://localhost:${PORT}`);
});
