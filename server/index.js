// server/index.js
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
console.log('OPENAI KEY:', process.env.OPENAI_API_KEY?.slice(0, 10));

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── RAW BODY FOR SENDGRID WEBHOOK ───────────────────────────────────────────
app.use('/api/marketing/webhook', express.raw({ type: '*/*' }));

// ─── GLOBAL JSON PARSER ───────────────────────────────────────────────────────
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/emails', require('./routes/emails'));
app.use('/api/users', require('./routes/users'));
app.use('/api/marketing', require('./routes/marketing'));
app.use('/api/thoughts', require('./routes/thoughts'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/google', require('./routes/google'));
app.use('/api/sync', require('./routes/sync'));
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/waitlist', require('./routes/waitlist'));
app.use('/api/design-templates', require('./routes/designTemplates'));
app.use('/api/drip', require('./routes/drip'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/insights', require('./routes/insights'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/settings', require('./routes/settings'));




const PORT = process.env.PORT || 5000;

// ─── GMAIL AUTO-SYNC (every 3 minutes) ───────────────────────────────────────
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

// ─── CALENDLY POLLING (every 5 minutes) ──────────────────────────────────────
const { syncCalendly } = require('./services/calendlySync');
let calendlySyncRunning = false;

const runCalendlySync = async () => {
  if (calendlySyncRunning) return;
  calendlySyncRunning = true;
  try {
    await syncCalendly();
  } catch (err) {
    console.error('Calendly sync error:', err);
  }
  calendlySyncRunning = false;
};

setTimeout(runCalendlySync, 30 * 1000); // first run 30s after startup
setInterval(runCalendlySync, 5 * 60 * 1000); // then every 5 minutes

// ─── AUTO-RECORD CHECK (every 60 seconds) ────────────────────────────────────
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
          const { botId } = await recallService.createBot(meeting.meet_link, 'Chap Assistant');
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

// ─── DRIP SEQUENCE RUNNER (every hour) ───────────────────────────────────────
const { runDripSequences } = require('./services/dripRunner');
let dripRunning = false;

const runDrip = async () => {
  if (dripRunning) return;
  dripRunning = true;
  try {
    await runDripSequences();
  } catch (err) {
    console.error('Drip runner error:', err.message);
  }
  dripRunning = false;
};

setTimeout(runDrip, 60 * 1000); // first run 60s after startup
setInterval(runDrip, 60 * 60 * 1000); // then every hour

// ─── RAG INGESTION (every 6 hours) ───────────────────────────────────────────
const { runFullIngestion } = require('./services/ragIngestion');
let ragRunning = false;

const runRag = async () => {
  if (ragRunning) return;
  ragRunning = true;
  try {
    await runFullIngestion();
  } catch (err) {
    console.error('RAG ingestion error:', err.message);
  }
  ragRunning = false;
};

setTimeout(runRag, 2 * 60 * 1000); // first run 2 minutes after startup
setInterval(runRag, 6 * 60 * 60 * 1000); // then every 6 hours

// ─── TEAM SUPERBRAIN (daily) ──────────────────────────────────────────────────
const { generateTeamInsight } = require('./services/teamBrain');
let teamBrainRunning = false;

const runTeamBrain = async () => {
  if (teamBrainRunning) return;
  teamBrainRunning = true;
  try {
    await generateTeamInsight();
  } catch (err) {
    console.error('Team Superbrain error:', err.message);
  }
  teamBrainRunning = false;
};

setTimeout(runTeamBrain, 5 * 60 * 1000); // first run 5 min after startup
setInterval(runTeamBrain, 24 * 60 * 60 * 1000); // then every 24 hours

// ─── START SERVER ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Start Slack bot after server is up (optional — only if credentials are configured)
  if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_BOT_TOKEN !== 'your-slack-bot-token') {
    const { startSlackBot } = require('./services/slackBot');
    startSlackBot();
  }
});