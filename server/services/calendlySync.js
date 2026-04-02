// server/services/calendlySync.js
const supabase = require('../db');

const CALENDLY_API_TOKEN = process.env.CALENDLY_API_TOKEN;
const CALENDLY_USER_URI = process.env.CALENDLY_USER_URI;
const API_BASE = 'https://api.calendly.com';

// ─── HELPER: CALENDLY API CALL ───────────────────────────────────────────────

async function calendlyGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${CALENDLY_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Calendly API error: ${res.status} ${await res.text()}`);
  return res.json();
}

// ─── MATCH INVITEE TO CRM ────────────────────────────────────────────────────

async function matchInviteeToCRM(email) {
  if (!email) return { person: null, company_id: null, client_id: null };

  const { data: person } = await supabase
    .from('crm_people')
    .select('id, company_id, first_name, last_name')
    .eq('email', email.toLowerCase())
    .single();

  if (!person) return { person: null, company_id: null, client_id: null };

  // Check if company is converted to client
  let client_id = null;
  if (person.company_id) {
    const { data: client } = await supabase
      .from('crm_clients')
      .select('id')
      .eq('converted_from', person.company_id)
      .single();
    if (client) client_id = client.id;
  }

  return { person, company_id: person.company_id, client_id };
}

// ─── PROCESS A SINGLE CALENDLY EVENT ─────────────────────────────────────────

async function processCalendlyEvent(event) {
  try {
    const eventUri = event.uri;

    // Dedup — skip if already processed
    const { data: existing } = await supabase
      .from('crm_meetings')
      .select('id')
      .eq('calendly_event_uri', eventUri)
      .single();

    if (existing) return null;

    // Only process active events
    if (event.status !== 'active') return null;

    const title = event.name || 'Calendly Meeting';
    const startTime = event.start_time;
    const endTime = event.end_time;
    const meetLink = event.location?.join_url || event.location?.data?.join_url || null;

    // Get invitees for this event
    const eventUUID = eventUri.split('/').pop();
    const inviteesData = await calendlyGet(`/scheduled_events/${eventUUID}/invitees?count=10`);
    const invitees = inviteesData.collection || [];

    // Match first invitee to CRM
    let company_id = null;
    let client_id = null;
    let person_id = null;
    let inviteeName = '';
    let inviteeEmail = '';

    if (invitees.length > 0) {
      const invitee = invitees[0];
      inviteeName = invitee.name || '';
      inviteeEmail = invitee.email || '';

      const match = await matchInviteeToCRM(inviteeEmail);
      company_id = match.company_id;
      client_id = match.client_id;
      person_id = match.person?.id || null;
    }

    // Get the CRM user who owns this Calendly account
    const { data: crmUser } = await supabase
      .from('crm_users')
      .select('id')
      .eq('email', 'dan.s@planfor.io')
      .single();

    const createdBy = crmUser?.id || null;

    // Get Google account for this user (for meet link + recall)
    const { data: googleAccount } = await supabase
      .from('crm_google_accounts')
      .select('id')
      .eq('user_id', createdBy)
      .eq('account_type', 'personal')
      .eq('is_active', true)
      .single();

    // Insert CRM meeting
    const { data: meeting, error } = await supabase
      .from('crm_meetings')
      .insert([{
        calendly_event_uri: eventUri,
        google_account_id: googleAccount?.id || null,
        company_id,
        client_id,
        person_id,
        created_by: createdBy,
        title: inviteeName ? `${title} with ${inviteeName}` : title,
        description: `Booked via Calendly by ${inviteeName} (${inviteeEmail})`,
        meeting_type: meetLink ? 'google_meet' : 'phone',
        status: 'scheduled',
        start_time: startTime,
        end_time: endTime,
        meet_link: meetLink || '',
        attendees: invitees.map(i => ({ email: i.email, name: i.name })),
        is_internal: false,
        auto_record: true,
      }])
      .select()
      .single();

    if (error) {
      console.error('  ❌ Calendly meeting insert error:', error.message);
      return null;
    }

    console.log(`  ✅ Calendly meeting created: ${meeting.title}`);

    // Log activity
    if (company_id || client_id) {
      await supabase.from('crm_activity_log').insert([{
        company_id,
        client_id,
        person_id,
        user_id: createdBy,
        action: 'Meeting Scheduled',
        details: `Calendly booking: "${meeting.title}" on ${new Date(startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      }]);
    }

// Try to find and link the Google Calendar event ID
if (googleAccount?.id && startTime) {
    try {
      const googleRoute = require('../routes/google');
      const { google } = require('googleapis');
      const { oauth2Client } = await googleRoute.getAuthenticatedClient(googleAccount.id);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const searchStart = new Date(new Date(startTime).getTime() - 60000).toISOString();
      const searchEnd = new Date(new Date(startTime).getTime() + 60000).toISOString();

      const { data: gcalEvents } = await calendar.events.list({
        calendarId: 'primary',
        timeMin: searchStart,
        timeMax: searchEnd,
        singleEvents: true,
        maxResults: 5,
      });

      const matched = (gcalEvents.items || []).find(e =>
        e.start?.dateTime && Math.abs(new Date(e.start.dateTime) - new Date(startTime)) < 60000
      );

      if (matched) {
        const realMeetLink = matched.hangoutLink || meetLink;
        await supabase
          .from('crm_meetings')
          .update({
            google_event_id: matched.id,
            meet_link: realMeetLink,
            updated_at: new Date().toISOString(),
          })
          .eq('id', meeting.id);

        meeting.google_event_id = matched.id;
        meeting.meet_link = realMeetLink;
        console.log(`  🔗 Linked Google Calendar event: ${matched.id}`);
      }
    } catch (gcalErr) {
      console.warn('  ⚠️ Could not link Google Calendar event:', gcalErr.message);
    }
  }

    // Recall.ai bot will be sent automatically 2 minutes before the meeting
    // by the autoRecordCheck interval in server/index.js
    console.log(`  🤖 Recall.ai bot scheduled — will auto-send 2 min before meeting`);

    // Post Slack alert
    try {
      const { postAlert } = require('./slackBot');
      await postAlert(`📅 New Calendly booking: *${meeting.title}*\n🕐 ${new Date(startTime).toLocaleString('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}\n👤 ${inviteeName} (${inviteeEmail})${meetLink ? `\n📹 ${meetLink}` : ''}`);
    } catch (slackErr) {
      console.error('  ⚠️ Slack alert failed:', slackErr.message);
    }

    return meeting;

  } catch (err) {
    console.error('  ❌ processCalendlyEvent error:', err.message);
    return null;
  }
}

// ─── MAIN SYNC FUNCTION ───────────────────────────────────────────────────────

async function syncCalendly() {
  if (!CALENDLY_API_TOKEN || !CALENDLY_USER_URI) {
    console.log('  ⚠️ Calendly not configured — skipping');
    return;
  }

  console.log('\n📅 Calendly Sync — Starting...');

  try {
    // Fetch events from last 24 hours to next 30 days
    const minStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const maxStart = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const data = await calendlyGet(
      `/scheduled_events?user=${encodeURIComponent(CALENDLY_USER_URI)}&min_start_time=${minStart}&max_start_time=${maxStart}&count=50&status=active`
    );

    const events = data.collection || [];
    console.log(`  Found ${events.length} active Calendly events`);

    let created = 0;
    for (const event of events) {
      const result = await processCalendlyEvent(event);
      if (result) created++;
    }

    console.log(`  ✅ Calendly sync complete — ${created} new meetings created`);
  } catch (err) {
    console.error('  ❌ Calendly sync failed:', err.message);
  }
}

module.exports = { syncCalendly };