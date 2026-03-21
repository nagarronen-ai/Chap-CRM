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
app.use('/api/calendar', require('./routes/Calendar'));

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

// Auto-record: Send bot to meetings with auto_record enabled
const supabase = require('./db');

const autoRecordCheck = async () => {
  try {
    const now = new Date();
    const twoMinLater = new Date(now.getTime() + 2 * 60000);
    
    const { data: meetings } = await supabase
      .from('crm_meetings')
      .select('id, meet_link, title')
      .eq('auto_record', true)
      .is('recall_bot_id', null)
      .gte('start_time', now.toISOString())
      .lte('start_time', twoMinLater.toISOString())
      .in('status', ['scheduled', 'confirmed']);

    if (meetings && meetings.length > 0) {
      const recallService = require('./services/recallService');
      for (const meeting of meetings) {
        if (!meeting.meet_link) continue;
        try {
          const { botId } = await recallService.createBot(meeting.meet_link, 'Planfor Assistant');
          await supabase
            .from('crm_meetings')
            .update({ recall_bot_id: botId, recording_status: 'sending_bot', updated_at: new Date().toISOString() })
            .eq('id', meeting.id);
          console.log('🤖 Auto-record: bot sent for', meeting.title);
        } catch (err) {
          console.error('Auto-record failed for', meeting.title, err.message);
        }
      }
    }
  } catch (err) {
    console.error('Auto-record check error:', err.message);
  }
};

setInterval(autoRecordCheck, 60000);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));