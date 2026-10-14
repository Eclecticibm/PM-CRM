// Creates the default admin account on first run if no users exist yet.
// Safe to run multiple times (no-op if users already exist).
require('../db'); // ensure schema is migrated first
const users = require('../models/users');

const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function run() {
  if (users.count() > 0) {
    console.log('[seed] Users already exist, skipping default admin creation.');
    return;
  }
  users.create({
    name: 'Administrator',
    email: DEFAULT_ADMIN_EMAIL,
    password: DEFAULT_ADMIN_PASSWORD,
    role: 'admin',
  });
  console.log('========================================');
  console.log(' Default admin account created:');
  console.log('   email:    ' + DEFAULT_ADMIN_EMAIL);
  console.log('   password: ' + DEFAULT_ADMIN_PASSWORD);
  console.log(' Please log in and change the password (via Users admin page) soon.');
  console.log('========================================');
}

if (require.main === module) {
  run();
}

module.exports = run;
