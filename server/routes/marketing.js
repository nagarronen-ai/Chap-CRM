// server/routes/marketing.js
const express = require('express');
const router = express.Router();
const supabase = require('../db');
const auth = require('../middleware/auth');
const crypto = require('crypto');
const { EventWebhook } = require('@sendgrid/eventwebhook');

// ─── RECIPIENT BUILDER ────────────────────────────────────────────────────────

router.get('/recipients', auth, async (req, res) => {
  const { stage, origin, city, category, source } = req.query;

  const recipients = [];

  if (!source || source === 'contacts' || source === 'all') {
    let query = supabase
      .from('crm_companies')
      .select('id, company_name, city, state, stage, origin, category, crm_people(id, first_name, last_name, email, marketing_unsubscribed)')
      .neq('stage', 'Converted');

    if (stage) query = query.eq('stage', stage);
    if (origin) query = query.eq('origin', origin);
    if (city) query = query.ilike('city', `%${city}%`);
    if (category) query = query.eq('category', category);

    const { data } = await query;
    for (const company of (data || [])) {
      const people = company.crm_people?.filter(p => p.email && !p.marketing_unsubscribed) || [];
      for (const person of people) {
        recipients.push({
          company_id: company.id,
          company_name: company.company_name,
          person_id: person.id,
          first_name: person.first_name,
          last_name: person.last_name,
          email: person.email,
          city: company.city,
          stage: company.stage,
          origin: company.origin,
          source: 'Contact',
        });
      }
    }
  }

  if (source === 'clients' || source === 'all') {
    let query = supabase
      .from('crm_clients')
      .select('id, business_name, contact_first_name, contact_last_name, contact_email, city, state, stage, category, converted_from');

    if (stage) query = query.eq('stage', stage);
    if (city) query = query.ilike('city', `%${city}%`);
    if (category) query = query.eq('category', category);

    const { data } = await query;
    for (const client of (data || [])) {
      if (client.converted_from) {
        const { data: companyData } = await supabase
          .from('crm_companies')
          .select('crm_people(id, first_name, last_name, email, marketing_unsubscribed)')
          .eq('id', client.converted_from)
          .single();

        const people = companyData?.crm_people?.filter(p => p.email && !p.marketing_unsubscribed) || [];
        for (const person of people) {
          recipients.push({
            company_id: client.converted_from,
            client_id: client.id,
            company_name: client.business_name,
            person_id: person.id,
            first_name: person.first_name,
            last_name: person.last_name,
            email: person.email,
            city: client.city,
            stage: client.stage,
            origin: 'Client',
            source: 'Client',
          });
        }
      } else if (client.contact_email) {
        recipients.push({
          company_id: null,
          client_id: client.id,
          company_name: client.business_name,
          person_id: null,
          first_name: client.contact_first_name,
          last_name: client.contact_last_name,
          email: client.contact_email,
          city: client.city,
          stage: client.stage,
          origin: 'Client',
          source: 'Client',
        });
      }
    }
  }

  const recipientRows = recipients.map(r => {
    const token = crypto.randomBytes(16).toString('hex');
    recipientTokens[r.email] = token;
    return {
      campaign_id: campaign.id,
      company_id: r.company_id || null,
      person_id: r.person_id || null,
      email: r.email,
      status: 'pending',
      unsubscribe_token: token,
      recipient_type: r.source === 'Waitlist' ? 'waitlist' : 'contact',
    };
  });

  res.json({ count: recipients.length, recipients });
});

router.get('/recipients/excluded', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_people')
    .select('id', { count: 'exact' })
    .eq('marketing_unsubscribed', true);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ excluded_count: data?.length || 0 });
});

// ─── CAMPAIGNS ────────────────────────────────────────────────────────────────

router.get('/campaigns', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_campaigns')
    .select('*, crm_users!crm_campaigns_created_by_fkey(name)')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const campaignsWithStats = await Promise.all(data.map(async (campaign) => {
    const { data: recipients } = await supabase
      .from('crm_campaign_recipients')
      .select('status')
      .eq('campaign_id', campaign.id);

    const stats = {
      sent: recipients?.length || 0,
      delivered: recipients?.filter(r => ['delivered', 'opened', 'clicked'].includes(r.status)).length || 0,
      opened: recipients?.filter(r => ['opened', 'clicked'].includes(r.status)).length || 0,
      clicked: recipients?.filter(r => r.status === 'clicked').length || 0,
      bounced: recipients?.filter(r => r.status === 'bounced').length || 0,
      unsubscribed: recipients?.filter(r => r.status === 'unsubscribed').length || 0,
    };
    stats.open_rate = stats.sent > 0 ? Math.round((stats.opened / stats.sent) * 100) : 0;
    stats.ctr = stats.sent > 0 ? Math.round((stats.clicked / stats.sent) * 100) : 0;

    return { ...campaign, stats };
  }));

  res.json(campaignsWithStats);
});

router.get('/campaigns/:id', auth, async (req, res) => {
  const { data: campaign, error } = await supabase
    .from('crm_campaigns')
    .select('*, crm_users!crm_campaigns_created_by_fkey(name)')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: 'Campaign not found' });

  const { data: recipients } = await supabase
    .from('crm_campaign_recipients')
    .select('*, crm_companies(company_name), crm_people(first_name, last_name)')
    .eq('campaign_id', req.params.id)
    .order('created_at', { ascending: false });

  const stats = {
    sent: recipients?.length || 0,
    delivered: recipients?.filter(r => ['delivered', 'opened', 'clicked'].includes(r.status)).length || 0,
    opened: recipients?.filter(r => ['opened', 'clicked'].includes(r.status)).length || 0,
    clicked: recipients?.filter(r => r.status === 'clicked').length || 0,
    bounced: recipients?.filter(r => r.status === 'bounced').length || 0,
    unsubscribed: recipients?.filter(r => r.status === 'unsubscribed').length || 0,
  };
  stats.open_rate = stats.sent > 0 ? Math.round((stats.opened / stats.sent) * 100) : 0;
  stats.ctr = stats.sent > 0 ? Math.round((stats.clicked / stats.sent) * 100) : 0;
  stats.bounce_rate = stats.sent > 0 ? Math.round((stats.bounced / stats.sent) * 100) : 0;
  stats.unsub_rate = stats.sent > 0 ? Math.round((stats.unsubscribed / stats.sent) * 100) : 0;

  res.json({ ...campaign, recipients, stats });
});

router.post('/campaigns', auth, async (req, res) => {
  const { role } = req.user;
  if (!['admin', 'marketing'].includes(role)) return res.status(403).json({ error: 'Forbidden' });

  const { name, subject, body_html, template_id, from_name, from_email, design_template_id } = req.body;
  const { data, error } = await supabase
    .from('crm_campaigns')
    .insert([{
      name, subject, body_html, template_id: template_id || null,
      design_template_id: design_template_id || null,
      from_name: from_name || 'Planfor',
      from_email: from_email || 'marketing@planfor.io',
      status: 'draft',
      created_by: req.user.id,
    }])
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.put('/campaigns/:id', auth, async (req, res) => {
  const { role } = req.user;
  if (!['admin', 'marketing'].includes(role)) return res.status(403).json({ error: 'Forbidden' });

  const { data, error } = await supabase
    .from('crm_campaigns')
    .update({ ...req.body })
    .eq('id', req.params.id)
    .eq('status', 'draft')
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/campaigns/:id', auth, async (req, res) => {
  const { role } = req.user;
  if (!['admin', 'marketing'].includes(role)) return res.status(403).json({ error: 'Forbidden' });

  const { error } = await supabase
    .from('crm_campaigns')
    .delete()
    .eq('id', req.params.id)
    .eq('status', 'draft');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.post('/campaigns/:id/send', auth, async (req, res) => {
  const { role } = req.user;
  if (!['admin', 'marketing'].includes(role)) return res.status(403).json({ error: 'Forbidden' });

  const { data: campaign, error: campError } = await supabase
    .from('crm_campaigns')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (campError || !campaign) return res.status(404).json({ error: 'Campaign not found' });
  if (campaign.status !== 'draft') return res.status(400).json({ error: 'Campaign already sent' });

  const { recipients } = req.body;
  if (!recipients || recipients.length === 0) return res.status(400).json({ error: 'No recipients' });

  await supabase.from('crm_campaigns').update({ status: 'sending', recipients_count: recipients.length }).eq('id', campaign.id);

  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

  const resolveBody = (html, recipient) => {
    return html
      .replace(/{{first_name}}/g, recipient.first_name || '')
      .replace(/{{last_name}}/g, recipient.last_name || '')
      .replace(/{{company_name}}/g, recipient.company_name || '')
      .replace(/{{city}}/g, recipient.city || '');
  };

  // Generate tokens and insert in one step
  const recipientTokens = {};
  const recipientRows = recipients.map(r => {
    const token = crypto.randomBytes(16).toString('hex');
    recipientTokens[r.email] = token;
    return {
      campaign_id: campaign.id,
      company_id: r.company_id,
      person_id: r.person_id || null,
      email: r.email,
      status: 'pending',
      unsubscribe_token: token,
    };
  });
  await supabase.from('crm_campaign_recipients').insert(recipientRows);

  const { wrapWithDesignTemplate, wrapWithDesignTemplateById } = require('../services/emailWrapper');

  const messages = [];
  for (const r of recipients) {
    const unsubscribeUrl = 'https://crm-api.planfor.io/api/marketing/unsubscribe/' + recipientTokens[r.email];
    const body = resolveBody(campaign.body_html, r).replace(/\{\{\{unsubscribe\}\}\}/g, unsubscribeUrl);
    const wrapped = campaign.design_template_id
    ? await wrapWithDesignTemplateById(body, campaign.design_template_id)
    : await wrapWithDesignTemplate(body, 'campaign');
  const html = wrapped.replace('{{unsubscribe_url}}', unsubscribeUrl);
    messages.push({
      to: r.email,
      from: { name: campaign.from_name, email: campaign.from_email },
      subject: campaign.subject
        .replace(/{{first_name}}/g, r.first_name || '')
        .replace(/{{company_name}}/g, r.company_name || ''),
      html,
      headers: {
        'List-Unsubscribe': '<' + unsubscribeUrl + '>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      customArgs: {
        campaign_id: campaign.id,
        company_id: r.company_id,
        person_id: r.person_id || '',
      },
    });
  }

  try {
    for (const m of messages) {
      await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + SENDGRID_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: m.to }],
            custom_args: m.customArgs,
          }],
          from: { email: m.from.email, name: m.from.name },
          subject: m.subject,
          content: [{ type: 'text/html', value: m.html }],
          headers: m.headers,
          tracking_settings: {
            click_tracking: { enable: true },
            open_tracking: { enable: true },
          },
        }),
      });
    }
    await supabase.from('crm_campaigns').update({ status: 'sent', sent_at: new Date() }).eq('id', campaign.id);
    res.json({ success: true, sent: recipients.length });
  } catch (err) {
    await supabase.from('crm_campaigns').update({ status: 'draft' }).eq('id', campaign.id);
    console.error('SendGrid error:', err.message);
    res.status(500).json({ error: 'SendGrid send failed' });
  }
});

router.post('/webhook', async (req, res) => {
  const publicKey = process.env.SENDGRID_WEBHOOK_KEY_MARKETING;

  if (publicKey) {
    try {
      const wh = new EventWebhook();
      const key = wh.convertPublicKeyToECDSA(publicKey);
      const signature = req.headers['x-twilio-email-event-webhook-signature'];
      const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'];

      const isValid = wh.verifySignature(key, req.body, signature, timestamp);

      if (!isValid) {
        console.warn('⚠️ SendGrid webhook signature verification FAILED');
        return res.sendStatus(403);
      }
    } catch (err) {
      console.error('SendGrid signature verification error:', err.message);
      return res.sendStatus(403);
    }
  }

  let events;
  try {
    events = JSON.parse(req.body.toString());
  } catch {
    return res.sendStatus(400);
  }

  console.log('📣 Marketing webhook hit:', JSON.stringify(events).slice(0, 500));

  if (!Array.isArray(events)) return res.sendStatus(200);

  for (const event of events) {
    const { campaign_id, company_id, email, email_type, user_id, event: eventType, timestamp, sg_message_id, custom_args } = event;

// Handle drip email events
if (!campaign_id && email_type === 'drip') {
  const eventTime = new Date(timestamp * 1000).toISOString();
  const updateData = { status: eventType === 'bounce' ? 'bounced' : eventType === 'open' ? 'opened' : eventType === 'click' ? 'clicked' : null };

  if (updateData.status) {
    if (eventType === 'open') updateData.opened_at = eventTime;
    if (eventType === 'click') updateData.clicked_at = eventTime;
    if (eventType === 'bounce') updateData.bounced_at = eventTime;

    if (sg_message_id) {
      await supabase
        .from('crm_drip_sends')
        .update(updateData)
        .eq('sendgrid_message_id', sg_message_id.split('.')[0]);
    } else if (email) {
      await supabase
        .from('crm_drip_sends')
        .update(updateData)
        .eq('email', email)
        .eq('status', 'sent')
        .order('sent_at', { ascending: false })
        .limit(1);
    }
  }
  continue;
}

// Handle waitlist confirmation email events
const { message_ref } = event.custom_args || {};
if (message_ref && !campaign_id && email_type !== 'drip' && email_type !== 'direct') {
  const eventTime = new Date(timestamp * 1000).toISOString();
  const updateData = {};

  if (eventType === 'delivered') {
    updateData.email_status = 'delivered';
    updateData.email_delivered_at = eventTime;
  } else if (eventType === 'open') {
    updateData.email_status = 'opened';
    updateData.email_opened_at = eventTime;
  } else if (eventType === 'bounce') {
    updateData.email_status = 'bounced';
    updateData.email_bounced_at = eventTime;
  }

  if (Object.keys(updateData).length > 0) {
    await supabase
      .from('waitlist_couples')
      .update(updateData)
      .eq('sendgrid_message_id', message_ref);
  }
  continue;
}

    if (!campaign_id && email_type === 'direct') {
      const eventTime = new Date(timestamp * 1000).toISOString();
      const updateData = {};

      if (eventType === 'delivered') updateData.email_status = 'delivered';
      if (eventType === 'open') { updateData.email_status = 'opened'; updateData.opened_at = eventTime; }
      if (eventType === 'click') { updateData.email_status = 'clicked'; updateData.clicked_at = eventTime; }
      if (eventType === 'bounce') { updateData.email_status = 'bounced'; updateData.bounced_at = eventTime; }

      if (Object.keys(updateData).length > 0) {
        if (sg_message_id) updateData.sendgrid_message_id = sg_message_id.split('.')[0];

        let emailRecord = null;

        if (sg_message_id) {
          const { data } = await supabase
            .from('crm_emails_sent')
            .select('id')
            .eq('sendgrid_message_id', sg_message_id.split('.')[0])
            .single();
          emailRecord = data;
        }

        if (!emailRecord) {
          const { data } = await supabase
            .from('crm_emails_sent')
            .select('id')
            .eq('company_id', company_id)
            .eq('user_id', user_id)
            .eq('status', 'sent')
            .order('sent_at', { ascending: false })
            .limit(1)
            .single();
          emailRecord = data;
        }

        if (emailRecord) {
          const priority = { sent: 0, delivered: 1, opened: 2, clicked: 3, bounced: 4 };
          const { data: current } = await supabase.from('crm_emails_sent').select('email_status').eq('id', emailRecord.id).single();
          const currentPriority = priority[current?.email_status] || 0;
          const newPriority = priority[updateData.email_status] || 0;

          if (newPriority >= currentPriority) {
            await supabase.from('crm_emails_sent').update(updateData).eq('id', emailRecord.id);
          }

          if (['open', 'click', 'bounce'].includes(eventType)) {
            const { data: existingLog } = await supabase
              .from('crm_activity_log')
              .select('id')
              .eq('company_id', company_id)
              .ilike('action', `Email ${eventType === 'open' ? 'Opened' : eventType === 'click' ? 'Clicked' : 'Bounced'}`)
              .limit(1);

            if (!existingLog || existingLog.length === 0) {
              await supabase.from('crm_activity_log').insert([{
                company_id,
                user_id,
                action: `Email ${eventType === 'open' ? 'Opened' : eventType === 'click' ? 'Clicked' : 'Bounced'}`,
                details: `Recipient ${eventType === 'bounce' ? 'bounced' : eventType + 'ed'} the email`,
              }]);
            }
          }

          console.log('📣 Updated direct email:', emailRecord.id, eventType);
        } else {
          console.log('📣 No matching email record found for direct event:', eventType, company_id, user_id);
        }
      }
      continue;
    }

    if (!campaign_id) continue;

    const eventTime = new Date(timestamp * 1000).toISOString();

    const statusMap = {
      delivered: 'delivered',
      open: 'opened',
      click: 'clicked',
      bounce: 'bounced',
      unsubscribe: 'unsubscribed',
      spamreport: 'bounced',
    };

    const newStatus = statusMap[eventType];
    if (!newStatus) continue;

    const updateData = { status: newStatus };
    if (eventType === 'open') updateData.opened_at = eventTime;
    if (eventType === 'click') updateData.clicked_at = eventTime;
    if (eventType === 'bounce') updateData.bounced_at = eventTime;
    if (eventType === 'unsubscribe') updateData.unsubscribed_at = eventTime;

    await supabase
      .from('crm_campaign_recipients')
      .update(updateData)
      .eq('campaign_id', campaign_id)
      .eq('email', email);

    if (eventType === 'unsubscribe' && email) {
      await supabase
        .from('crm_people')
        .update({ marketing_unsubscribed: true, marketing_unsubscribed_at: eventTime })
        .eq('email', email);
    }
  }

  res.sendStatus(200);
});

// ─── GLOBAL STATS ─────────────────────────────────────────────────────────────

router.get('/stats', auth, async (req, res) => {
  const { data: campaigns } = await supabase
    .from('crm_campaigns')
    .select('id, name, status')
    .eq('status', 'sent');

  const { data: allRecipients } = await supabase
    .from('crm_campaign_recipients')
    .select('status, campaign_id');

  const { data: unsubscribed } = await supabase
    .from('crm_companies')
    .select('id', { count: 'exact' })
    .eq('marketing_unsubscribed', true);

  const total_sent = allRecipients?.length || 0;
  const total_opened = allRecipients?.filter(r => ['opened', 'clicked'].includes(r.status)).length || 0;
  const total_clicked = allRecipients?.filter(r => r.status === 'clicked').length || 0;
  const avg_open_rate = total_sent > 0 ? Math.round((total_opened / total_sent) * 100) : 0;
  const avg_ctr = total_sent > 0 ? Math.round((total_clicked / total_sent) * 100) : 0;

  res.json({
    total_campaigns: campaigns?.length || 0,
    total_sent,
    avg_open_rate,
    avg_ctr,
    total_unsubscribed: unsubscribed?.length || 0,
  });
});

router.get('/company/:companyId', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_campaign_recipients')
    .select('*, crm_campaigns(name, sent_at, status), crm_people(first_name, last_name)')
    .eq('company_id', req.params.companyId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/resubscribe/:personId', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_people')
    .update({ marketing_unsubscribed: false, marketing_unsubscribed_at: null })
    .eq('id', req.params.personId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/unsubscribed', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_people')
    .select('id, first_name, last_name, email, marketing_unsubscribed_at, unsubscribe_ip, unsubscribe_user_agent, unsubscribe_campaign_id, company_id, crm_companies(id, company_name, stage)')
    .eq('marketing_unsubscribed', true)
    .order('marketing_unsubscribed_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/resubscribe-bulk', auth, async (req, res) => {
  const { person_ids } = req.body;
  if (!person_ids?.length) return res.status(400).json({ error: 'No person IDs provided' });
  const { data, error } = await supabase
    .from('crm_people')
    .update({ marketing_unsubscribed: false, marketing_unsubscribed_at: null })
    .in('id', person_ids)
    .select();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ resubscribed: data.length });
});

// GET /api/marketing/unsubscribe/:token — one-click unsubscribe from campaigns
router.get('/unsubscribe/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).send('Invalid unsubscribe link.');

    const { data: recipient } = await supabase
      .from('crm_campaign_recipients')
      .select('email, campaign_id, recipient_type')
      .eq('unsubscribe_token', token)
      .single();

    if (!recipient) return res.status(400).send('Invalid or expired unsubscribe link.');

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    const now = new Date().toISOString();

    if (recipient.recipient_type === 'waitlist') {
      await supabase
        .from('waitlist_couples')
        .update({
          marketing_consent: false,
          unsubscribed_at: now,
          unsubscribe_ip: ip,
          unsubscribe_user_agent: userAgent,
        })
        .eq('email', recipient.email);
    } else {
      await supabase
        .from('crm_people')
        .update({
          marketing_unsubscribed: true,
          marketing_unsubscribed_at: now,
          unsubscribe_ip: ip,
          unsubscribe_user_agent: userAgent,
          unsubscribe_campaign_id: recipient.campaign_id || null,
        })
        .eq('email', recipient.email);
    }

    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#F5F3EF;">
        <h2 style="color:#3E423D;">You've been unsubscribed.</h2>
        <p style="color:#717182;">You won't receive any more marketing emails from Planfor.</p>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send('Something went wrong.');
  }
});

// ─── WAITLIST ─────────────────────────────────────────────────────────────────

router.get('/waitlist', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('waitlist_couples')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/waitlist/:id', auth, async (req, res) => {
  const { error } = await supabase
    .from('waitlist_couples')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;