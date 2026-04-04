// server/routes/waitlist.js
const express = require('express');
const router = express.Router();
const supabase = require('../db');

const SENDGRID_API_KEY = process.env.SENDGRID_MARKETING_KEY || process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL;
const WAITLIST_LIST_NAME = 'Waitlist Couples';

// ─── HELPER: GET OR CREATE SENDGRID LIST ─────────────────────────────────────

async function getOrCreateSendGridList() {
  // Fetch all lists
  const res = await fetch('https://api.sendgrid.com/v3/marketing/lists?page_size=100', {
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await res.json();
  const lists = data.result || [];

  // Check if list already exists
  const existing = lists.find(l => l.name === WAITLIST_LIST_NAME);
  if (existing) return existing.id;

  // Create new list
  const createRes = await fetch('https://api.sendgrid.com/v3/marketing/lists', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: WAITLIST_LIST_NAME }),
  });
  const created = await createRes.json();
  return created.id;
}

// ─── HELPER: ADD CONTACT TO SENDGRID ─────────────────────────────────────────

async function addToSendGrid(email, first_name, last_name, listId) {
  const contact = { email };
  if (first_name) contact.first_name = first_name;
  if (last_name) contact.last_name = last_name;

  const res = await fetch('https://api.sendgrid.com/v3/marketing/contacts', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      list_ids: [listId],
      contacts: [contact],
    }),
  });
  const data = await res.json();
  return data.job_id || null;
}

// ─── HELPER: SEND CONFIRMATION EMAIL ─────────────────────────────────────────

async function sendConfirmationEmail(email, first_name) {
  try {
    // Fetch the Waitlist Confirmation template from CRM
    const { data: template } = await supabase
      .from('crm_email_templates')
      .select('subject, body_html')
      .eq('name', 'Waitlist Confirmation')
      .single();

    const unsubscribeUrl = `https://crm-api.planfor.io/api/waitlist/unsubscribe?email=${encodeURIComponent(email)}`;

    let subject = "You're on the list ✨";
    let html = '';

    if (template) {
      // Use CRM template — replace merge tags
      subject = template.subject || subject;
      html = (template.body_html || '')
        .replace(/{{first_name}}/g, first_name || 'there')
        .replace(/{{name}}/g, first_name || 'there')
        .replace(/{{email}}/g, email);

      // Append unsubscribe footer if not already present
      if (!html.includes('unsubscribe')) {
        html += `<p style="font-size:11px;color:#AAAABC;text-align:center;margin-top:32px;">
          <a href="${unsubscribeUrl}" style="color:#AAAABC;">Unsubscribe</a>
        </p>`;
      }
    } else {
      // Fallback if template not found
      console.warn('Waitlist Confirmation template not found — using fallback');
      html = `<p>Hi ${first_name || 'there'},</p><p>You're on the Planfor waitlist. We'll be in touch soon.</p>`;
    }

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email, name: first_name || '' }] }],
        from: { email: 'noreply@planfor.io', name: 'Planfor' },
        reply_to: { email: 'hello@planfor.io', name: 'Planfor' },
        subject,
        content: [{ type: 'text/html', value: html }],
        tracking_settings: {
          click_tracking: { enable: true },
          open_tracking: { enable: true },
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('SendGrid confirmation email error:', err);
    }
  } catch (err) {
    console.error('sendConfirmationEmail error:', err.message);
  }
}

// ─── POST /api/waitlist/subscribe ─────────────────────────────────────────────

router.post('/subscribe', async (req, res) => {
  try {
    const { email, name, first_name, last_name, marketing_consent } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email address required.' });
    }
    if (!marketing_consent) {
      return res.status(400).json({ error: 'Marketing consent is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check for duplicate
    const { data: existing } = await supabase
      .from('waitlist_couples')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    if (existing) {
      return res.status(409).json({ error: "You're already on the list! We'll be in touch soon." });
    }

    // Insert into Supabase
    const { error: insertError } = await supabase
      .from('waitlist_couples')
      .insert([{
        email: normalizedEmail,
        name: first_name && last_name ? `${first_name} ${last_name}` : (name?.trim() || null),
        first_name: first_name?.trim() || null,
        last_name: last_name?.trim() || null,
        marketing_consent: true,
        consent_at: new Date().toISOString(),
        ip_address: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || null,
        user_agent: req.headers['user-agent'] || null,
        consent_text: 'I agree to receive updates and marketing emails from Planfor. Unsubscribe anytime.',
      }]);

    if (insertError) {
      console.error('Waitlist insert error:', insertError.message);
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }

    // Add to SendGrid (async — don't block response)
    getOrCreateSendGridList()
      .then(listId => addToSendGrid(normalizedEmail, first_name, last_name, listId))
      .catch(err => console.error('SendGrid add contact error:', err.message));

    // Send confirmation email (async — don't block response)
    sendConfirmationEmail(normalizedEmail, first_name)
      .catch(err => console.error('Confirmation email error:', err.message));

    res.json({ success: true, message: "You're on the list!" });

  } catch (err) {
    console.error('Waitlist subscribe error:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ─── GET /api/waitlist/unsubscribe ────────────────────────────────────────────

router.get('/unsubscribe', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).send('Invalid unsubscribe link.');

    await supabase
      .from('waitlist_couples')
      .update({ marketing_consent: false })
      .eq('email', email.toLowerCase().trim());

    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#F0EDE8;">
        <h2 style="color:#3E423D;">You've been unsubscribed.</h2>
        <p style="color:#717182;">You won't receive any more emails from Planfor.</p>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send('Something went wrong.');
  }
});

module.exports = router;