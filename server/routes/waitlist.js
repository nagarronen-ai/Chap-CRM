// server/routes/waitlist.js
const express = require('express');
const router = express.Router();
const supabase = require('../db');

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
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

async function addToSendGrid(email, name, listId) {
  const contact = { email };
  if (name) {
    const parts = name.trim().split(' ');
    contact.first_name = parts[0] || '';
    contact.last_name = parts.slice(1).join(' ') || '';
  }

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

async function sendConfirmationEmail(email, name) {
  const firstName = name ? name.trim().split(' ')[0] : null;
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';

  const logoUrl = 'https://comingsoon.planfor.io/planfor_logo_without_slogan_colored_background.png';
  const igUrl = 'https://instagram.com/planfor.wedding';
  const unsubscribeUrl = `https://crm-api.planfor.io/api/waitlist/unsubscribe?email=${encodeURIComponent(email)}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're on the list — Planfor</title>
</head>
<body style="margin:0;padding:0;background:#F0EDE8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F0EDE8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <img src="${logoUrl}" alt="Planfor" width="160" style="display:block;border:0;" />
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#FAFAF8;border:1px solid rgba(142,155,139,0.25);border-radius:2px;padding:40px 40px 36px;">

              <!-- Ornament -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td style="border-bottom:1px solid rgba(142,155,139,0.2);font-size:1px;">&nbsp;</td>
                  <td align="center" style="padding:0 14px;white-space:nowrap;font-family:Georgia,serif;font-size:14px;color:#8E9B8B;letter-spacing:0.2em;">✦</td>
                  <td style="border-bottom:1px solid rgba(142,155,139,0.2);font-size:1px;">&nbsp;</td>
                </tr>
              </table>

              <!-- Headline -->
              <p style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:300;font-style:italic;color:#3E423D;text-align:center;margin:0 0 20px;line-height:1.3;">
                You're on the list.
              </p>

              <!-- Body -->
              <p style="font-size:14px;color:#717182;line-height:1.8;margin:0 0 16px;">
                ${greeting}
              </p>
              <p style="font-size:14px;color:#717182;line-height:1.8;margin:0 0 16px;">
                Thank you for joining the Planfor waitlist. We're building something beautiful for couples who want to plan their wedding, their way.
              </p>
              <p style="font-size:14px;color:#717182;line-height:1.8;margin:0 0 28px;">
                We'll be in touch as soon as we launch.
              </p>

              <!-- Instagram CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                <tr>
                  <td align="center">
                    <a href="${igUrl}" target="_blank"
                       style="display:inline-block;background:transparent;border:1px solid #8E9B8B;color:#6B7A68;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;font-weight:400;letter-spacing:0.18em;text-transform:uppercase;text-decoration:none;padding:13px 28px;border-radius:1px;">
                      Follow us on Instagram
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-size:12px;color:#AAAABC;text-align:center;margin:10px 0 0;letter-spacing:0.05em;">
                Don't miss our updates, behind the scenes and launch news.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 0 0;text-align:center;">
              <p style="font-size:11px;color:#AAAABC;line-height:1.9;margin:0;letter-spacing:0.05em;">
                Planfor Ltd. &nbsp;·&nbsp; 31 Street Gordon, Tel Aviv, Israel<br />
                <a href="mailto:hello@planfor.io" style="color:#AAAABC;text-decoration:none;">hello@planfor.io</a>
                &nbsp;·&nbsp;
                <a href="${unsubscribeUrl}" style="color:#AAAABC;text-decoration:none;">Unsubscribe</a>
              </p>
              <p style="font-size:10px;color:#AAAABC;margin:10px 0 0;opacity:0.7;">
                © 2026 Planfor. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email, name: name || '' }] }],
      from: { email: 'noreply@planfor.io', name: 'Planfor' },
      reply_to: { email: 'hello@planfor.io', name: 'Planfor' },
      subject: "You're on the list ✨",
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
}

// ─── POST /api/waitlist/subscribe ─────────────────────────────────────────────

router.post('/subscribe', async (req, res) => {
  try {
    const { email, name, marketing_consent } = req.body;

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
        name: name?.trim() || null,
        marketing_consent: true,
        consent_at: new Date().toISOString(),
        ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress || null,
      }]);

    if (insertError) {
      console.error('Waitlist insert error:', insertError.message);
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }

    // Add to SendGrid (async — don't block response)
    getOrCreateSendGridList()
      .then(listId => addToSendGrid(normalizedEmail, name, listId))
      .catch(err => console.error('SendGrid add contact error:', err.message));

    // Send confirmation email (async — don't block response)
    sendConfirmationEmail(normalizedEmail, name)
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