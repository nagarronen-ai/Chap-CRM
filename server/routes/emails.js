// server/routes/emails.js
const express = require('express');
const router = express.Router();
const supabase = require('../db');
const auth = require('../middleware/auth');
const sgMail = require('@sendgrid/mail');
const { google } = require('googleapis');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ─── GMAIL SEND HELPER ───────────────────────────────────────────────────────

async function sendViaGmail(googleAccountId, { to, toName, from, fromName, subject, htmlBody }) {
  const googleRoute = require('./google');
  const { oauth2Client, account } = await googleRoute.getAuthenticatedClient(googleAccountId);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Build RFC 2822 email
  const messageParts = [
    `From: ${fromName} <${from}>`,
    `To: ${toName ? `${toName} <${to}>` : to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody,
  ];
  const rawMessage = messageParts.join('\r\n');
  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage },
  });

  return {
    messageId: result.data.id,
    threadId: result.data.threadId,
  };
}

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
  const { name, category, subject, body_html, signature_html, visibility } = req.body;

  // Finance users can only create private templates
  const finalVisibility = role === 'finance' ? 'private' : (visibility || 'team');

  const { data, error } = await supabase
    .from('crm_email_templates')
    .insert([{ name, category, subject, body_html, signature_html, visibility: finalVisibility, created_by: userId }])
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.put('/templates/:id', auth, async (req, res) => {
  const { role, id: userId } = req.user;
  const { data: existing } = await supabase.from('crm_email_templates').select('created_by, visibility').eq('id', req.params.id).single();
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
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/templates/:id', auth, async (req, res) => {
  const { role, id: userId } = req.user;
  const { data: existing } = await supabase.from('crm_email_templates').select('created_by, visibility').eq('id', req.params.id).single();
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

// ─── SEND EMAIL (Gmail API or SendGrid fallback) ─────────────────────────────

router.post('/send', auth, async (req, res) => {
  const { role, id: userId } = req.user;
  if (role === 'finance') return res.status(403).json({ error: 'Forbidden' });

  const { company_id, person_id, template_id, subject, body_html, recipient_email, recipient_name } = req.body;

  const { data: sender } = await supabase
    .from('crm_users')
    .select('name, email')
    .eq('id', userId)
    .single();

// Build HTML email bodies — Gmail gets clean HTML, SendGrid gets table wrapper
const gmailHtml = body_html;

const sendgridHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
<tr><td style="padding:32px 40px;font-size:15px;line-height:1.6;color:#222222;">
${body_html}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  let sendSuccess = false;
  let sendMethod = 'draft';
  let gmailMessageId = null;
  let gmailThreadId = null;

  if (recipient_email) {
    // Check if user has a connected Gmail account
    const { data: googleAccount } = await supabase
      .from('crm_google_accounts')
      .select('id, email')
      .eq('user_id', userId)
      .eq('account_type', 'personal')
      .eq('is_active', true)
      .single();

    if (googleAccount) {
      // ─── SEND VIA GMAIL API ───
      try {
        console.log('📧 Sending via Gmail API | TO:', recipient_email, '| FROM:', googleAccount.email);
        const result = await sendViaGmail(googleAccount.id, {
          to: recipient_email,
          toName: recipient_name || '',
          from: googleAccount.email,
          fromName: sender.name,
          subject,
          htmlBody: gmailHtml,
        });
        sendSuccess = true;
        sendMethod = 'gmail';
        gmailMessageId = result.messageId;
        gmailThreadId = result.threadId;
        console.log('✅ Gmail send success | Message ID:', result.messageId);
      } catch (err) {
        console.error('❌ Gmail send error:', err.message);
        // Fall back to SendGrid
        try {
          console.log('📧 Falling back to SendGrid | TO:', recipient_email);
          await sgMail.send({
            to: { email: recipient_email, name: recipient_name || '' },
            from: { email: sender.email, name: sender.name },
            subject,
            html: sendgridHtml,
            trackingSettings: {
              clickTracking: { enable: true, enableText: true },
              openTracking: { enable: true },
            },
            customArgs: {
              email_type: 'direct',
              company_id,
              user_id: userId,
            }
          });
          sendSuccess = true;
          sendMethod = 'sendgrid';
        } catch (sgErr) {
          console.error('❌ SendGrid fallback also failed:', sgErr.response?.body || sgErr.message);
        }
      }
    } else {
      // ─── NO GMAIL CONNECTED — USE SENDGRID ───
      try {
        console.log('📧 Sending via SendGrid (no Gmail connected) | TO:', recipient_email, '| FROM:', sender?.email);
        await sgMail.send({
          to: { email: recipient_email, name: recipient_name || '' },
          from: { email: sender.email, name: sender.name },
          subject,
          html: sendgridHtml,
          trackingSettings: {
            clickTracking: { enable: true, enableText: true },
            openTracking: { enable: true },
          },
          customArgs: {
            email_type: 'direct',
            company_id,
            user_id: userId,
          }
        });
        sendSuccess = true;
        sendMethod = 'sendgrid';
      } catch (err) {
        console.error('❌ SendGrid error:', err.response?.body || err.message);
      }
    }
  }

  const status = sendSuccess ? 'sent' : 'draft';

  const { data, error } = await supabase
    .from('crm_emails_sent')
    .insert([{
      user_id: userId,
      company_id, person_id, template_id,
      subject, body_html,
      status,
      send_method: sendMethod,
      gmail_message_id: gmailMessageId,
      gmail_thread_id: gmailThreadId,
      sent_at: sendSuccess ? new Date() : null,
      created_at: new Date()
    }])
    .select().single();
  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('crm_activity_log').insert([{
    company_id,
    person_id: person_id || null,
    user_id: userId,
    action: sendSuccess ? 'Email Sent' : 'Email Draft Saved',
    details: sendSuccess
      ? `Email sent to ${recipient_email} via ${sendMethod === 'gmail' ? 'Gmail' : 'SendGrid'}: "${subject}"`
      : `Draft saved: "${subject}"`
  }]);

  res.json({ ...data, sendSuccess, sendMethod });
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

// ─── CHECK GMAIL STATUS (for UI indicator) ───────────────────────────────────

router.get('/gmail-status', auth, async (req, res) => {
  const { data } = await supabase
    .from('crm_google_accounts')
    .select('id, email')
    .eq('user_id', req.user.id)
    .eq('account_type', 'personal')
    .eq('is_active', true)
    .single();

  res.json({
    connected: !!data,
    email: data?.email || null,
  });
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
      .select('id, email_status')
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

      const priority = { sent: 0, delivered: 1, opened: 2, clicked: 3, bounced: 4 };
      const currentPriority = priority[emailRecord.email_status] || 0;
      const newPriority = priority[updateData.email_status] || 0;

      if (newPriority >= currentPriority) {
        await supabase
          .from('crm_emails_sent')
          .update(updateData)
          .eq('id', emailRecord.id);
      }
    }
  }

  res.sendStatus(200);
});

module.exports = router;