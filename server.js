/*
Team Code Blooded: Noah McGarry, Saul Bravo, Maeve Davis

GUI DEMO

Instead of a login system, there is a role picker in the navbar with three
buttons (Admin / Staff / Student). Clicking one flips the "current user"
in memory so you can show the same page from each perspective

Form submissions (Send Notification, role change) update in-memory arrays
and flash a fake success message so the UI behaves normally for demo

Nothing persists, and restarting the server resets everything

Run with "npm install" then "npm start", then visit http://localhost:5000
 */
const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 5000;


// In-memory "database" - everything lives in these two arrays. Restart
// the server and they reset to the defaults below

// The roster shown on the Manage Users page, one of these users is also
// used as the "current user" based on the selected role in the navbar
const users = [
  { id: 1, first_name: 'Noah',    last_name: 'McGarry', email: 'noah@pcc.edu',    role: 'admin'   },
  { id: 2, first_name: 'Saul',    last_name: 'Bravo',   email: 'saul@pcc.edu',    role: 'staff'   },
  { id: 3, first_name: 'Maeve',   last_name: 'Davis',   email: 'maeve@pcc.edu',   role: 'staff'   },
  { id: 4, first_name: 'Stevie',  last_name: 'Wonder',     email: 'stevie.wonder@pcc.edu',  role: 'student' },
  { id: 5, first_name: 'Miles',   last_name: 'Davis',  email: 'miles.davis@pcc.edu',   role: 'student' },
  { id: 6, first_name: 'Ozzy',  last_name: 'Osbourne',   email: 'ozzy.osbourne@pcc.edu',  role: 'student' },
  { id: 7, first_name: 'Beyonce',  last_name: 'Knowles',   email: 'beyonce.knowles@pcc.edu',  role: 'student' },
];

// Seed notifications so the log page is not empty on first load
const notifications = [
  {
    id: 1,
    sender_email: 'noah.mcgarry@pcc.edu',
    subject: 'Pantry hours updated for spring quarter',
    body: 'The food pantry will now be open Mon-Fri from 10am-5pm. Closed on holidays and weekends.',
    sent_at: '2026-04-15T14:00:00.000Z',
    recipient_count: 7
  },
  {
    id: 2,
    sender_email: 'noah.mcgarry@pcc.edu',
    subject: 'Fresh produce arriving Thursday',
    body: 'We just got a large produce donation. Come by Thursday afternoon while supplies last!',
    sent_at: '2026-04-18T09:30:00.000Z',
    recipient_count: 7
  }
];

// The role the navbar picker is currently set to, runs which mock user
// is treated as "logged in" for every request
let currentRole = 'admin';

// Simple flash buffer. Full app would use express-session + connect-flash
// to keep this for each user across redirects
let pendingFlash = { success: [], error: [] };

function flash(type, message) {
  pendingFlash[type].push(message);
}

function drainFlash() {
  const out = pendingFlash;
  pendingFlash = { success: [], error: [] };
  return out;
}

// Returns the mock user that matches the current navbar role
function getCurrentUser() {
  return users.find((u) => u.role === currentRole) || users[0];
}

// Formats an ISO timestamp the same way the log view expects it
function formatSentAt(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
}

// Express setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Makes currentUser, currentRole, and flash messages available to every view
app.use((req, res, next) => {
  res.locals.currentUser = getCurrentUser();
  res.locals.currentRole = currentRole;
  res.locals.messages = drainFlash();
  next();
});

// Temporary Role picker
// Clicking one of the navbar role links POSTs here and we flip the mock user
app.post('/demo/role', (req, res) => {
  const next = req.body.role;
  if (next === 'admin' || next === 'staff' || next === 'student') {
    currentRole = next;
    flash('success', `Switched view to ${next}.`);
  }
  // Send the user back to whichever page they were on so the picker
  // feels like it toggles in place
  res.redirect(303, req.get('Referer') || '/');
});

// Home
app.get('/', (req, res) => {
  res.render('home', { title: 'Home' });
});

// Notification send
app.get('/notifications/send', (req, res) => {
  const role = getCurrentUser().role;
  if (role !== 'admin' && role !== 'staff') {
    flash('error', 'That page is only available to staff.');
    return res.redirect(303, '/');
  }
  res.render('notification-send', { title: 'Send Notification' });
});

app.post('/notifications/send', (req, res) => {
  const role = getCurrentUser().role;
  if (role !== 'admin' && role !== 'staff') {
    flash('error', 'That page is only available to staff.');
    return res.redirect(303, '/');
  }

  const subject = (req.body.subject || '').trim();
  const body = (req.body.body || '').trim();
  if (!subject || !body) {
    flash('error', 'Subject and body are required.');
    return res.redirect(303, '/notifications/send');
  }

  // Everyone receives notifications, so the recipient count is the full user list
  const recipientCount = users.length;

  notifications.push({
    id: notifications.length + 1,
    sender_email: getCurrentUser().email,
    subject,
    body,
    sent_at: new Date().toISOString(),
    recipient_count: recipientCount
  });

  flash(
    'success',
    `Notification sent to ${recipientCount} user${recipientCount === 1 ? '' : 's'}.`
  );
  res.redirect(303, '/notifications/log');
});

// Notification log
app.get('/notifications/log', (req, res) => {
  const role = getCurrentUser().role;
  if (role !== 'admin' && role !== 'staff') {
    flash('error', 'That page is only available to staff.');
    return res.redirect(303, '/');
  }

  // date filter for inputs
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  const fromRaw = (req.query.from || '').trim();
  const toRaw = (req.query.to || '').trim();
  const from = isoDate.test(fromRaw) ? fromRaw : '';
  const to = isoDate.test(toRaw) ? toRaw : '';

  const filtered = notifications.filter((n) => {
    const day = n.sent_at.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });

  // Sort newest first, then add the display timestamp
  const display = filtered
    .slice()
    .sort((a, b) => b.sent_at.localeCompare(a.sent_at))
    .map((n) => ({
      ...n,
      sent_at_display: formatSentAt(n.sent_at)
    }));

  res.render('notification-log', {
    title: 'Notification Log',
    notifications: display,
    filters: { from, to }
  });
});

// Manage Users (admin-only)
app.get('/admin/users', (req, res) => {
  if (getCurrentUser().role !== 'admin') {
    flash('error', 'That page is only available to admins.');
    return res.redirect(303, '/');
  }

  const orderIndex = { admin: 0, staff: 1, student: 2 };
  const sorted = users.slice().sort((a, b) => {
    if (orderIndex[a.role] !== orderIndex[b.role]) {
      return orderIndex[a.role] - orderIndex[b.role];
    }
    const ln = a.last_name.localeCompare(b.last_name);
    if (ln !== 0) return ln;
    return a.first_name.localeCompare(b.first_name);
  });

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const staffCount = users.filter((u) => u.role === 'staff').length;

  res.render('admin-users', {
    title: 'Manage Users',
    users: sorted,
    adminCount,
    staffCount
  });
});

app.post('/admin/users/:id/role', (req, res) => {
  if (getCurrentUser().role !== 'admin') {
    flash('error', 'That page is only available to admins.');
    return res.redirect(303, '/');
  }

  const targetId = parseInt(req.params.id, 10);
  const newRole = req.body.role;

  if (!Number.isInteger(targetId)) {
    flash('error', 'Invalid user.');
    return res.redirect(303, '/admin/users');
  }
  if (newRole !== 'admin' && newRole !== 'staff' && newRole !== 'student') {
    flash('error', 'Invalid role.');
    return res.redirect(303, '/admin/users');
  }

  const target = users.find((u) => u.id === targetId);
  if (!target) {
    flash('error', 'User not found.');
    return res.redirect(303, '/admin/users');
  }

  const me = getCurrentUser();
  if (target.id === me.id && newRole !== 'admin') {
    flash('error', 'You cannot change your own role.');
    return res.redirect(303, '/admin/users');
  }

  const adminCount = users.filter((u) => u.role === 'admin').length;
  if (target.role === 'admin' && newRole !== 'admin' && adminCount <= 1) {
    flash('error', 'At least one admin account must remain.');
    return res.redirect(303, '/admin/users');
  }

  if (target.role === newRole) {
    flash('success', `${target.first_name} is already ${newRole}.`);
    return res.redirect(303, '/admin/users');
  }

  target.role = newRole;
  flash('success', `${target.first_name} ${target.last_name} is now ${newRole}.`);
  res.redirect(303, '/admin/users');
});

// 404 catch-all (must stay last)
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

app.listen(PORT, () => {
  console.log(`Demo server running at http://localhost:${PORT}`);
});
