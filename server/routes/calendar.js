// server/routes/calendar.js
const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const supabase = require('../db');
const auth = require('../middleware/auth');

// ─── HELPER: GET CALENDAR CLIENT ─────────────────────────────────────────────

async function getCalendarClient(userId) {
  const googleRoute = require('./google');

  const { data: account } = await supabase
    .from('crm_google_accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('account_type', 'personal')
    .eq('is_active', true)
    .single();

  if (!account) throw new Error('No connected Google account');

  const { oauth2Client } = await googleRoute.getAuthenticatedClient(account.id);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  return { calendar, googleAccountId: account.id };
}

// ─── GET CALENDAR EVENTS ─────────────────────────────────────────────────────

// GET /api/calendar/events?start=...&end=...
router.get('/events', auth, async (req, res) => {
  try {
    const { start, end } = req.query;
    const { calendar } = await getCalendarClient(req.user.id);

    // Fetch from Google Calendar
    const { data } = await calendar.events.list({
      calendarId: 'primary',
      timeMin: start || new Date().toISOString(),
      timeMax: end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });

    const googleEvents = (data.items || []).map(event => ({
      id: event.id,
      title: event.summary || '(No title)',
      description: event.description || '',
      start_time: event.start?.dateTime || event.start?.date,
      end_time: event.end?.dateTime || event.end?.date,
      location: event.location || '',
      meet_link: event.hangoutLink || '',
      attendees: (event.attendees || []).map(a => ({
        email: a.email,
        name: a.displayName || '',
        status: a.responseStatus || 'needsAction',
        self: a.self || false,
      })),
      status: event.status,
      source: 'google',
      html_link: event.htmlLink,
    }));

    // Also fetch CRM meetings for this period to enrich with CRM data
    let crmQuery = supabase
      .from('crm_meetings')
      .select('*, crm_companies(company_name), crm_clients(business_name), crm_people(first_name, last_name), crm_users!crm_meetings_created_by_fkey(name)')
      .eq('created_by', req.user.id);

    if (start) crmQuery = crmQuery.gte('start_time', start);
    if (end) crmQuery = crmQuery.lte('start_time', end);

    const { data: crmMeetings } = await crmQuery;

    // Merge: enrich Google events with CRM data
    const crmByGoogleId = {};
    (crmMeetings || []).forEach(m => {
      if (m.google_event_id) crmByGoogleId[m.google_event_id] = m;
    });

    const enrichedEvents = googleEvents.map(ge => {
      const crm = crmByGoogleId[ge.id];
      if (crm) {
        return {
          ...ge,
          crm_meeting_id: crm.id,
          meeting_type: crm.meeting_type,
          company_id: crm.company_id,
          client_id: crm.client_id,
          person_id: crm.person_id,
          company_name: crm.crm_companies?.company_name || crm.crm_clients?.business_name || '',
          person_name: crm.crm_people ? `${crm.crm_people.first_name} ${crm.crm_people.last_name}` : '',
          is_internal: crm.is_internal,
          crm_status: crm.status,
          notes: crm.notes,
          source: 'crm',
        };
      }
      return ge;
    });

    res.json(enrichedEvents);
  } catch (err) {
    if (err.message === 'No connected Google account') {
      return res.status(404).json({ error: 'No connected Google account. Connect Gmail in Settings.' });
    }
    console.error('Calendar events error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── CREATE MEETING ──────────────────────────────────────────────────────────

// POST /api/calendar/meetings
router.post('/meetings', auth, async (req, res) => {
  try {
    const {
      title, description, meeting_type, start_time, end_time,
      company_id, client_id, person_id,
      attendee_emails, is_internal,
    } = req.body;

    if (!title || !start_time || !end_time) {
      return res.status(400).json({ error: 'Title, start_time, and end_time are required' });
    }

    const { calendar, googleAccountId } = await getCalendarClient(req.user.id);

    // Build Google Calendar event
    const eventBody = {
      summary: title,
      description: description || '',
      start: { dateTime: start_time, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: { dateTime: end_time, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      attendees: (attendee_emails || []).map(email => ({ email })),
    };

    // Add Google Meet if meeting type is google_meet
    if (meeting_type === 'google_meet') {
      eventBody.conferenceData = {
        createRequest: {
          requestId: `crm-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    // Create in Google Calendar
    const { data: googleEvent } = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventBody,
      conferenceDataVersion: meeting_type === 'google_meet' ? 1 : 0,
      sendUpdates: 'all',
    });

    const meetLink = googleEvent.hangoutLink || '';

    // Save to CRM database
    const { data: meeting, error } = await supabase
      .from('crm_meetings')
      .insert([{
        google_event_id: googleEvent.id,
        google_account_id: googleAccountId,
        company_id: company_id || null,
        client_id: client_id || null,
        person_id: person_id || null,
        created_by: req.user.id,
        title,
        description: description || '',
        meeting_type: meeting_type || 'google_meet',
        status: 'scheduled',
        start_time,
        end_time,
        location: meetLink || googleEvent.location || '',
        meet_link: meetLink,
        attendees: (googleEvent.attendees || []).map(a => ({
          email: a.email,
          name: a.displayName || '',
          status: a.responseStatus || 'needsAction',
        })),
        is_internal: is_internal || false,
      }])
      .select()
      .single();

    if (error) {
      console.error('CRM meeting insert error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    // Log to activity timeline
    if (company_id || client_id) {
      await supabase.from('crm_activity_log').insert([{
        company_id: company_id || null,
        client_id: client_id || null,
        person_id: person_id || null,
        user_id: req.user.id,
        action: 'Meeting Scheduled',
        details: `${meeting_type === 'google_meet' ? '📹 Google Meet' : '📞 Phone call'}: "${title}" on ${new Date(start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      }]);
    }

    res.json({ ...meeting, html_link: googleEvent.htmlLink });
  } catch (err) {
    if (err.message === 'No connected Google account') {
      return res.status(404).json({ error: 'No connected Google account. Connect Gmail in Settings.' });
    }
    console.error('Create meeting error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── UPDATE MEETING ──────────────────────────────────────────────────────────

// PUT /api/calendar/meetings/:id
router.put('/meetings/:id', auth, async (req, res) => {
  try {
    const { data: meeting } = await supabase
      .from('crm_meetings')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const { title, description, start_time, end_time, status, notes } = req.body;

    // Update Google Calendar event if we have a google_event_id
    if (meeting.google_event_id) {
      try {
        const { calendar } = await getCalendarClient(req.user.id);
        const updateBody = {};
        if (title) updateBody.summary = title;
        if (description !== undefined) updateBody.description = description;
        if (start_time) updateBody.start = { dateTime: start_time, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
        if (end_time) updateBody.end = { dateTime: end_time, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };

        if (Object.keys(updateBody).length > 0) {
          await calendar.events.patch({
            calendarId: 'primary',
            eventId: meeting.google_event_id,
            requestBody: updateBody,
            sendUpdates: 'all',
          });
        }
      } catch (calErr) {
        console.warn('Google Calendar update failed:', calErr.message);
      }
    }

    // Update CRM record
    const updates = { updated_at: new Date().toISOString() };
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (start_time) updates.start_time = start_time;
    if (end_time) updates.end_time = end_time;
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;

    const { data, error } = await supabase
      .from('crm_meetings')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Log status changes
    if (status && status !== meeting.status) {
      const companyId = meeting.company_id || null;
      const clientId = meeting.client_id || null;
      if (companyId || clientId) {
        await supabase.from('crm_activity_log').insert([{
          company_id: companyId,
          client_id: clientId,
          user_id: req.user.id,
          action: status === 'completed' ? 'Meeting Completed' : status === 'cancelled' ? 'Meeting Cancelled' : 'Meeting Rescheduled',
          details: `Meeting "${meeting.title}" ${status === 'completed' ? 'completed' : status === 'cancelled' ? 'cancelled' : 'rescheduled'}${notes ? ` — Notes: ${notes}` : ''}`,
        }]);
      }
    }

    res.json(data);
  } catch (err) {
    console.error('Update meeting error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── CANCEL MEETING ──────────────────────────────────────────────────────────

// DELETE /api/calendar/meetings/:id
router.delete('/meetings/:id', auth, async (req, res) => {
  try {
    const { data: meeting } = await supabase
      .from('crm_meetings')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    // Cancel in Google Calendar
    if (meeting.google_event_id) {
      try {
        const { calendar } = await getCalendarClient(req.user.id);
        await calendar.events.delete({
          calendarId: 'primary',
          eventId: meeting.google_event_id,
          sendUpdates: 'all',
        });
      } catch (calErr) {
        console.warn('Google Calendar delete failed:', calErr.message);
      }
    }

    // Mark as cancelled in CRM
    await supabase
      .from('crm_meetings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    // Log activity
    if (meeting.company_id || meeting.client_id) {
      await supabase.from('crm_activity_log').insert([{
        company_id: meeting.company_id,
        client_id: meeting.client_id,
        user_id: req.user.id,
        action: 'Meeting Cancelled',
        details: `Meeting "${meeting.title}" cancelled`,
      }]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Cancel meeting error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET UPCOMING MEETINGS (for Dashboard) ───────────────────────────────────

// GET /api/calendar/upcoming
router.get('/upcoming', auth, async (req, res) => {
  try {
    const now = new Date();
    const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let googleEvents = [];

    // Try to fetch from Google Calendar
    try {
      const { calendar } = await getCalendarClient(req.user.id);
      const { data } = await calendar.events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        timeMax: weekOut.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 20,
      });

      googleEvents = (data.items || []).map(event => ({
        id: event.id,
        title: event.summary || '(No title)',
        description: event.description || '',
        start_time: event.start?.dateTime || event.start?.date,
        end_time: event.end?.dateTime || event.end?.date,
        location: event.location || '',
        meet_link: event.hangoutLink || '',
        meeting_type: event.hangoutLink ? 'google_meet' : 'phone',
        attendees: (event.attendees || []).map(a => ({
          email: a.email,
          name: a.displayName || '',
          status: a.responseStatus || 'needsAction',
        })),
        source: 'google',
        html_link: event.htmlLink,
      }));
    } catch (calErr) {
      // No Google account connected — fall back to CRM only
      console.warn('Google Calendar fetch failed for upcoming:', calErr.message);
    }

    // Also fetch CRM meetings to enrich with company/client data
    const { data: crmMeetings } = await supabase
      .from('crm_meetings')
      .select('*, crm_companies(company_name), crm_clients(business_name), crm_people(first_name, last_name)')
      .eq('created_by', req.user.id)
      .in('status', ['scheduled', 'confirmed'])
      .gte('start_time', now.toISOString())
      .lte('start_time', weekOut.toISOString())
      .order('start_time', { ascending: true });

    // Build lookup of CRM meetings by google_event_id
    const crmByGoogleId = {};
    (crmMeetings || []).forEach(m => {
      if (m.google_event_id) crmByGoogleId[m.google_event_id] = m;
    });

    // Merge: enrich Google events with CRM data, avoid duplicates
    const merged = googleEvents.map(ge => {
      const crm = crmByGoogleId[ge.id];
      if (crm) {
        return {
          ...ge,
          crm_meeting_id: crm.id,
          company_id: crm.company_id,
          client_id: crm.client_id,
          person_id: crm.person_id,
          company_name: crm.crm_companies?.company_name || crm.crm_clients?.business_name || '',
          meeting_type: crm.meeting_type,
          source: 'crm',
        };
      }
      return ge;
    });

    // Sort by start_time
    merged.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    res.json(merged);
  } catch (err) {
    console.error('Upcoming meetings error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET MEETINGS FOR A COMPANY ──────────────────────────────────────────────

// GET /api/calendar/meetings/company/:companyId
router.get('/meetings/company/:companyId', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('crm_meetings')
      .select('*, crm_users!crm_meetings_created_by_fkey(name)')
      .eq('company_id', req.params.companyId)
      .order('start_time', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET MEETINGS FOR A CLIENT ───────────────────────────────────────────────

// GET /api/calendar/meetings/client/:clientId
router.get('/meetings/client/:clientId', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('crm_meetings')
      .select('*, crm_users!crm_meetings_created_by_fkey(name)')
      .eq('client_id', req.params.clientId)
      .order('start_time', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;