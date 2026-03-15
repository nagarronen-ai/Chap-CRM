// server/routes/marketing.js
const express = require('express');
const router = express.Router();
const supabase = require('../db');
const auth = require('../middleware/auth');

// ─── RECIPIENT BUILDER ────────────────────────────────────────────────────────

router.get('/recipients', auth, async (req, res) => {
  const { stage, origin, city, category } = req.query;

  let query = supabase
    .from('crm_companies')
    .select('id, company_name, city, state, stage, origin, category, marketing_unsubscribed, crm_people(id, first_name, last_name, email)')
    .eq('marketing_unsubscribed', false);

  if (stage) query = query.eq('stage', stage);
  if (origin) query = query.eq('origin', origin);
  if (city) query = query.ilike('city', `%${city}%`);
  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const recipients = [];
  for (const company of data) {
    const people = company.crm_people?.filter(p => p.email) || [];
    if (people.length > 0) {
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
        });
      }
    }
  }

  res.json({ count: recipients.length, recipients });
});

router.get('/recipients/excluded', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_companies')
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

  const { name, subject, body_html, template_id, from_name, from_email } = req.body;
  const { data, error } = await supabase
    .from('crm_campaigns')
    .insert([{
      name, subject, body_html, template_id: template_id || null,
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

  const recipientRows = recipients.map(r => ({
    campaign_id: campaign.id,
    company_id: r.company_id,
    person_id: r.person_id || null,
    email: r.email,
    status: 'pending',
  }));
  await supabase.from('crm_campaign_recipients').insert(recipientRows);

  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const resolveBody = (html, recipient) => {
    return html
      .replace(/{{first_name}}/g, recipient.first_name || '')
      .replace(/{{last_name}}/g, recipient.last_name || '')
      .replace(/{{company_name}}/g, recipient.company_name || '')
      .replace(/{{city}}/g, recipient.city || '');
  };

  const messages = recipients.map(r => ({
    to: r.email,
    from: { name: campaign.from_name, email: campaign.from_email },
    subject: campaign.subject
      .replace(/{{first_name}}/g, r.first_name || '')
      .replace(/{{company_name}}/g, r.company_name || ''),
      html: resolveBody(campaign.body_html, r) + '<div style="text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #eee;font-size:12px;color:#999;">You received this email because you are in our vendor network.<br><a href="{{{unsubscribe}}}" style="color:#999;text-decoration:underline;">Unsubscribe</a></div>',
    trackingSettings: {
      clickTracking: { enable: true },
      openTracking: { enable: true },
    },
    customArgs: {
      campaign_id: campaign.id,
      company_id: r.company_id,
      person_id: r.person_id || '',
    },
  }));

  try {
    await sgMail.send(messages);
    await supabase.from('crm_campaigns').update({ status: 'sent', sent_at: new Date() }).eq('id', campaign.id);
    res.json({ success: true, sent: recipients.length });
  } catch (err) {
    await supabase.from('crm_campaigns').update({ status: 'draft' }).eq('id', campaign.id);
    console.error('SendGrid error:', err.response?.body || err.message);
    res.status(500).json({ error: 'SendGrid send failed', details: err.response?.body });
  }
});

// ─── SENDGRID WEBHOOK ─────────────────────────────────────────────────────────

router.post('/webhook', async (req, res) => {
  console.log('📣 Marketing webhook hit:', JSON.stringify(req.body).slice(0, 500));

  let events = req.body;
  if (Buffer.isBuffer(events)) events = JSON.parse(events.toString());
  if (typeof events === 'string') events = JSON.parse(events);
  if (!Array.isArray(events)) return res.sendStatus(200);

  for (const event of events) {
    const { campaign_id, company_id, email, email_type, user_id, event: eventType, timestamp, sg_message_id } = event;

    // Handle direct email events (no campaign_id)
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
        
        // Try matching by sendgrid_message_id first (most accurate)
        if (sg_message_id) {
          const { data } = await supabase
            .from('crm_emails_sent')
            .select('id')
            .eq('sendgrid_message_id', sg_message_id.split('.')[0])
            .single();
          emailRecord = data;
        }
        
        // Fallback: match by company + user + most recent
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
            // Only update if it's a higher-priority status (avoid downgrading clicked → opened)
            const priority = { sent: 0, delivered: 1, opened: 2, clicked: 3, bounced: 4 };
            const { data: current } = await supabase.from('crm_emails_sent').select('email_status').eq('id', emailRecord.id).single();
            const currentPriority = priority[current?.email_status] || 0;
            const newPriority = priority[updateData.email_status] || 0;
  
            if (newPriority >= currentPriority) {
              await supabase.from('crm_emails_sent').update(updateData).eq('id', emailRecord.id);
            }
  
            // Only log activity once per event type per email
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
                  details: `Recipient ${eventType === 'bounce' ? 'bounced' : eventType + 'ed'} the email`
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

    if (eventType === 'unsubscribe' && company_id) {
      await supabase
        .from('crm_companies')
        .update({ marketing_unsubscribed: true, marketing_unsubscribed_at: eventTime })
        .eq('id', company_id);
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
    .select('*, crm_campaigns(name, sent_at, status)')
    .eq('company_id', req.params.companyId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;