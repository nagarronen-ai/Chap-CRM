// server/routes/emails.js
const express = require('express');
const router = express.Router();
const supabase = require('../db');
const auth = require('../middleware/auth');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ─── TEMPLATES ───────────────────────────────────────────────────────────────

router.get('/templates', auth, async (req, res) => {
  const { id: userId, role } = req.user;

  if (role === 'finance') {
    const { data, error } = await supabase
      .from('crm_email_templates')
      .select('*')
      .eq('created_by', userId)
      .eq('visibility', 'private')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (role === 'admin') {
    const { data, error } = await supabase
      .from('crm_email_templates')
      .select('*, crm_users!crm_email_templates_created_by_fkey(name)')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  const { data, error } = await supabase
    .from('crm_email_templates')
    .select('*, crm_users!crm_email_templates_created_by_fkey(name)')
    .or(`visibility.eq.team,and(visibility.eq.private,created_by.eq.${userId})`)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/templates', auth, async (req, res) => {
  const { role, id: userId } = req.user;
  let { visibility } = req.body;

  if (['sales', 'csm', 'support', 'finance'].includes(role)) {
    visibility = 'private';
  }

  const { data, error } = await supabase
    .from('crm_email_templates')
    .insert([{ ...req.body, visibility, created_by: userId, user_id: userId }])
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.put('/templates/:id', auth, async (req, res) => {
  const { role, id: userId } = req.user;

  const { data: existing } = await supabase
    .from('crm_email_templates')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (!existing) return res.status(404).json({ error: 'Template not found' });

  const canEdit =
    role === 'admin' ||
    (role === 'marketing' && (existing.visibility === 'team' || existing.created_by === userId)) ||
    existing.created_by === userId;

  if (!canEdit) return res.status(403).json({ error: 'Forbidden' });

  const { data, error } = await supabase
    .from('crm_email_templates')
    .update({ ...req.body, updated_at: new Date() })
    .eq('id', req.params.id)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/templates/:id', auth, async (req, res) => {
  const { role, id: userId } = req.user;

  const { data: existing } = await supabase
    .from('crm_email_templates')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (!existing) return res.status(404).json({ error: 'Template not found' });

  const canDelete =
    role === 'admin' ||
    (role === 'marketing' && (existing.visibility === 'team' || existing.created_by === userId)) ||
    existing.created_by === userId;

  if (!canDelete) return res.status(403).json({ error: 'Forbidden' });

  const { error } = await supabase
    .from('crm_email_templates')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── SENT EMAILS ─────────────────────────────────────────────────────────────

router.get('/sent', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_emails_sent')
    .select('*, crm_companies(company_name), crm_people(first_name, last_name)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/sent/company/:companyId', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_emails_sent')
    .select('*, crm_people(first_name, last_name)')
    .eq('company_id', req.params.companyId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/send', auth, async (req, res) => {
  const { role, id: userId } = req.user;
  if (role === 'finance') return res.status(403).json({ error: 'Forbidden' });

  const { company_id, person_id, template_id, subject, body_html, recipient_email, recipient_name } = req.body;

  const { data: sender } = await supabase
    .from('crm_users')
    .select('name, email')
    .eq('id', userId)
    .single();

  let sendGridSuccess = false;

  if (recipient_email) {
    try {
      console.log('TO:', recipient_email, '| FROM:', sender?.email, '| SENDER:', JSON.stringify(sender));
      await sgMail.send({
        to: { email: recipient_email, name: recipient_name || '' },
        from: { email: sender.email, name: sender.name },
        subject,
        html: body_html,
        customArgs: {
          email_type: 'direct',
          company_id,
          user_id: userId,
        }
      });
      sendGridSuccess = true;
    } catch (err) {
      console.error('SendGrid error:', err.response?.body || err.message);
    }
  }

  const status = sendGridSuccess ? 'sent' : 'draft';

  const { data, error } = await supabase
    .from('crm_emails_sent')
    .insert([{
      user_id: userId,
      company_id, person_id, template_id,
      subject, body_html,
      status,
      sent_at: sendGridSuccess ? new Date() : null,
      created_at: new Date()
    }])
    .select().single();
  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('crm_activity_log').insert([{
    company_id,
    person_id: person_id || null,
    user_id: userId,
    action: sendGridSuccess ? 'Email Sent' : 'Email Draft Saved',
    details: sendGridSuccess
      ? `Email sent to ${recipient_email}: "${subject}"`
      : `Draft saved: "${subject}"`
  }]);

  res.json({ ...data, sendGridSuccess });
});

router.delete('/sent/:id', auth, async (req, res) => {
  const { error } = await supabase
    .from('crm_emails_sent')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── SENDGRID WEBHOOK FOR DIRECT EMAILS ──────────────────────────────────────

router.post('/webhook', async (req, res) => {
  console.log('📨 Direct email webhook hit - full payload:', JSON.stringify(req.body).slice(0, 500));

  let events = req.body;
  if (Buffer.isBuffer(events)) events = JSON.parse(events.toString());
  if (typeof events === 'string') events = JSON.parse(events);
  if (!Array.isArray(events)) return res.sendStatus(200);

  for (const event of events) {
    const { email_type, company_id, user_id, event: eventType, timestamp, sg_message_id } = event;

    if (email_type !== 'direct') continue;

    const eventTime = new Date(timestamp * 1000).toISOString();

    const { data: emailRecord } = await supabase
      .from('crm_emails_sent')
      .select('id')
      .eq('company_id', company_id)
      .eq('user_id', user_id)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(1)
      .single();

    if (!emailRecord) continue;

    const updateData = {};

    if (eventType === 'delivered') updateData.email_status = 'delivered';
    if (eventType === 'open') { updateData.email_status = 'opened'; updateData.opened_at = eventTime; }
    if (eventType === 'click') { updateData.email_status = 'clicked'; updateData.clicked_at = eventTime; }
    if (eventType === 'bounce') { updateData.email_status = 'bounced'; updateData.bounced_at = eventTime; }

    if (Object.keys(updateData).length > 0) {
      if (sg_message_id) updateData.sendgrid_message_id = sg_message_id;

      await supabase
        .from('crm_emails_sent')
        .update(updateData)
        .eq('id', emailRecord.id);

      if (['open', 'click', 'bounce'].includes(eventType)) {
        await supabase.from('crm_activity_log').insert([{
          company_id,
          user_id,
          action: `Email ${eventType === 'open' ? 'Opened' : eventType === 'click' ? 'Clicked' : 'Bounced'}`,
          details: `Recipient ${eventType === 'bounce' ? 'bounced' : eventType + 'ed'} the email`
        }]);
      }
    }
  }

  res.sendStatus(200);
});

module.exports = router;