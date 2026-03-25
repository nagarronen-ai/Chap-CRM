// server/routes/sync.js
const express = require('express');
const router = express.Router();
const supabase = require('../db');
const auth = require('../middleware/auth');
const { syncAllAccounts, syncSingleAccount } = require('../services/gmailSync');

// ─── TRIGGER SYNC ────────────────────────────────────────────────────────────

router.post('/gmail', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      syncAllAccounts();
      res.json({ success: true, message: 'Sync started for all accounts' });
    } else {
      const { data: account } = await supabase
        .from('crm_google_accounts')
        .select('id')
        .eq('user_id', req.user.id)
        .eq('account_type', 'personal')
        .eq('is_active', true)
        .single();

      if (!account) return res.status(404).json({ error: 'No connected Gmail account' });

      syncSingleAccount(account.id);
      res.json({ success: true, message: 'Sync started for your account' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SYNC STATUS ─────────────────────────────────────────────────────────────

router.get('/status', auth, async (req, res) => {
  try {
    let query = supabase
      .from('crm_google_accounts')
      .select('id, email, account_type, last_sync_at, last_history_id, is_active')
      .eq('is_active', true);

    if (req.user.role !== 'admin') {
      query = query.or(`user_id.eq.${req.user.id},account_type.eq.shared`);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SYNCED EMAILS FOR A COMPANY ─────────────────────────────────────────────

router.get('/emails/company/:companyId', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('crm_synced_emails')
      .select('*')
      .eq('company_id', req.params.companyId)
      .order('email_date', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SYNCED EMAILS FOR A CLIENT ──────────────────────────────────────────────

router.get('/emails/client/:clientId', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('crm_synced_emails')
      .select('*')
      .eq('client_id', req.params.clientId)
      .order('email_date', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ALL SYNCED EMAILS FOR CURRENT USER (Inbox Page) ─────────────────────────

router.get('/inbox', auth, async (req, res) => {
  try {
    const { data: accounts } = await supabase
      .from('crm_google_accounts')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('is_active', true);

    if (!accounts || accounts.length === 0) return res.json([]);

    const accountIds = accounts.map(a => a.id);
    const { filter, search } = req.query;

    let query = supabase
      .from('crm_synced_emails')
      .select('*, crm_companies(company_name), crm_people(first_name, last_name), crm_clients(business_name)')
      .in('google_account_id', accountIds)
      .order('email_date', { ascending: false })
      .limit(100);

    if (filter === 'unread') query = query.eq('is_read', false);
    if (filter === 'inbound') query = query.eq('direction', 'inbound');
    if (filter === 'outbound') query = query.eq('direction', 'outbound');

    if (search) {
      query = query.or(`subject.ilike.%${search}%,from_name.ilike.%${search}%,from_email.ilike.%${search}%,body_snippet.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MARK MULTIPLE AS READ (bulk) — MUST be before /:id route ────────────────

router.put('/emails/bulk-read', auth, async (req, res) => {
  try {
    const { email_ids } = req.body;
    if (!email_ids?.length) return res.status(400).json({ error: 'No email IDs provided' });

    const { data: emailRecords } = await supabase
      .from('crm_synced_emails')
      .select('id, gmail_message_id, google_account_id')
      .in('id', email_ids);

    await supabase
      .from('crm_synced_emails')
      .update({ is_read: true })
      .in('id', email_ids);

    const googleRouter = require('./google');
    const { google } = require('googleapis');
    for (const email of (emailRecords || [])) {
      try {
        const { oauth2Client } = await googleRouter.getAuthenticatedClient(email.google_account_id);
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        await gmail.users.messages.modify({
          userId: 'me',
          id: email.gmail_message_id,
          requestBody: { removeLabelIds: ['UNREAD'] },
        });
      } catch (gmailErr) {
        console.warn('Gmail bulk mark-as-read failed for:', email.gmail_message_id, gmailErr.message);
      }
    }

    res.json({ marked: email_ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MARK AS READ (single) — MUST be after bulk-read ─────────────────────────

router.put('/emails/:id/read', auth, async (req, res) => {
  try {
    const { data: email, error: fetchError } = await supabase
      .from('crm_synced_emails')
      .select('gmail_message_id, google_account_id')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !email) return res.status(404).json({ error: 'Email not found' });

    const { data, error } = await supabase
      .from('crm_synced_emails')
      .update({ is_read: true })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    try {
      const googleRouter = require('./google');
      const { oauth2Client } = await googleRouter.getAuthenticatedClient(email.google_account_id);
      const { google } = require('googleapis');
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      await gmail.users.messages.modify({
        userId: 'me',
        id: email.gmail_message_id,
        requestBody: { removeLabelIds: ['UNREAD'] },
      });
    } catch (gmailErr) {
      console.warn('Gmail mark-as-read failed:', gmailErr.message);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── UNREAD COUNT ────────────────────────────────────────────────────────────

router.get('/unread-count', auth, async (req, res) => {
  try {
    const { data: accounts } = await supabase
      .from('crm_google_accounts')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('is_active', true);

    if (!accounts || accounts.length === 0) return res.json({ count: 0 });

    const accountIds = accounts.map(a => a.id);

    const { count, error } = await supabase
      .from('crm_synced_emails')
      .select('id', { count: 'exact', head: true })
      .in('google_account_id', accountIds)
      .eq('is_read', false)
      .eq('direction', 'inbound');

    if (error) return res.status(500).json({ error: error.message });
    res.json({ count: count || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;