// server/index.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/emails', require('./routes/emails'));
app.use('/api/users', require('./routes/users'));
app.use('/api/marketing', require('./routes/marketing'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/google', require('./routes/google'));
app.use('/api/sync', require('./routes/sync'));
app.use('/api/calendar', require('./routes/calendar'));

const PORT = process.env.PORT || 5000;

// Auto-sync Gmail every 3 minutes
const { syncAllAccounts } = require('./services/gmailSync');
let syncRunning = false;

const runSync = async () => {
  if (syncRunning) return;
  syncRunning = true;
  try {
    await syncAllAccounts();
  } catch (err) {
    console.error('Sync error:', err);
  }
  syncRunning = false;
};

setTimeout(runSync, 10 * 1000);
setInterval(runSync, 3 * 60 * 1000);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));