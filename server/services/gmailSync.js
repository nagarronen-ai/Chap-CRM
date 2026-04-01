// server/services/gmailSync.js
const { google } = require('googleapis');
const supabase = require('../db');
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY_BRAIN });

// ─── HELPER: GET AUTHENTICATED GMAIL CLIENT ──────────────────────────────────

async function getGmailClient(googleAccountId) {
  const googleRoute = require('../routes/google');
  const { oauth2Client } = await googleRoute.getAuthenticatedClient(googleAccountId);
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// ─── HELPER: EXTRACT EMAIL ADDRESSES FROM HEADER ─────────────────────────────

function extractEmails(headerValue) {
  if (!headerValue) return [];
  const emailRegex = /[\w.+-]+@[\w.-]+\.\w+/g;
  return (headerValue.match(emailRegex) || []).map(e => e.toLowerCase());
}

// ─── HELPER: DECODE GMAIL MESSAGE BODY ───────────────────────────────────────

function decodeBody(payload) {
  // Try to get HTML body first, then plain text
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    const text = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    return text.replace(/\n/g, '<br>');
  }
  // Multipart — search parts recursively
  if (payload.parts) {
    // Prefer HTML
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
    }
    // Fallback to plain text
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        const text = Buffer.from(part.body.data, 'base64').toString('utf-8');
        return text.replace(/\n/g, '<br>');
      }
    }
    // Check nested multipart
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = decodeBody(part);
        if (nested) return nested;
      }
    }
  }
  return null;
}

// ─── HELPER: GET HEADER VALUE ────────────────────────────────────────────────

function getHeader(headers, name) {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header?.value || '';
}

// ─── HELPER: MATCH EMAIL TO CRM CONTACT ──────────────────────────────────────

async function matchEmailToCRM(emailAddresses, ownerEmail) {
    const externalEmails = emailAddresses.filter(e => e !== ownerEmail.toLowerCase());
    if (externalEmails.length === 0) return null;
  
    // Check crm_people first (contacts linked to companies)
    for (const email of externalEmails) {
      const { data: person } = await supabase
        .from('crm_people')
        .select('id, company_id, first_name, last_name, email')
        .eq('email', email)
        .limit(1)
        .single();
  
      if (person) {
        // Check if this company has been converted to a client
        let clientId = null;
        if (person.company_id) {
          const { data: client } = await supabase
            .from('crm_clients')
            .select('id')
            .eq('converted_from', person.company_id)
            .single();
          if (client) clientId = client.id;
        }
  
        return {
          person_id: person.id,
          company_id: person.company_id,
          client_id: clientId,
          matched_email: email,
        };
      }
    }
  
    // Check crm_clients (signed clients with contact_email)
    for (const email of externalEmails) {
      const { data: client } = await supabase
        .from('crm_clients')
        .select('id, converted_from, contact_email, business_name')
        .eq('contact_email', email)
        .limit(1)
        .single();
  
      if (client) {
        return {
          person_id: null,
          company_id: client.converted_from || null,
          client_id: client.id,
          matched_email: email,
        };
      }
    }
  
    return null;
  }

// ─── HELPER: CHECK IF ALREADY SYNCED ─────────────────────────────────────────

async function isAlreadySynced(googleAccountId, gmailMessageId) {
  const { data } = await supabase
    .from('crm_synced_emails')
    .select('id')
    .eq('google_account_id', googleAccountId)
    .eq('gmail_message_id', gmailMessageId)
    .single();
  return !!data;
}

// ─── HELPER: CHECK IF SENT FROM CRM ─────────────────────────────────────────

async function isSentFromCRM(gmailMessageId) {
  const { data } = await supabase
    .from('crm_emails_sent')
    .select('id')
    .eq('gmail_message_id', gmailMessageId)
    .single();
  return !!data;
}

// ─── PROCESS A SINGLE GMAIL MESSAGE ──────────────────────────────────────────

async function processMessage(gmail, googleAccountId, messageId, accountEmail) {
  try {
    // Skip if already synced
    if (await isAlreadySynced(googleAccountId, messageId)) return null;

    // Skip if sent from CRM (deduplication)
    if (await isSentFromCRM(messageId)) return null;

    // Fetch full message
    const { data: message } = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const headers = message.payload.headers;
    const from = getHeader(headers, 'From');
    const to = getHeader(headers, 'To');
    const cc = getHeader(headers, 'Cc');
    const subject = getHeader(headers, 'Subject');
    const date = getHeader(headers, 'Date');

    // Collect all email addresses involved
    const allEmails = [
      ...extractEmails(from),
      ...extractEmails(to),
      ...extractEmails(cc),
    ];

    // Match against CRM contacts
    const match = await matchEmailToCRM(allEmails, accountEmail);
    if (!match) return null; // No CRM contact found — skip

    // Determine direction
    const fromEmails = extractEmails(from);
    const isFromOwner = fromEmails.includes(accountEmail.toLowerCase());
    const direction = isFromOwner ? 'outbound' : 'inbound';

    // Decode body
    const bodyHtml = decodeBody(message.payload);
    const snippet = message.snippet || '';

    // Check attachments
    const hasAttachments = (message.payload.parts || []).some(
      p => p.filename && p.filename.length > 0
    );
    const attachmentCount = (message.payload.parts || []).filter(
      p => p.filename && p.filename.length > 0
    ).length;

    // Extract sender name
    const fromMatch = from.match(/^"?([^"<]*)"?\s*<?/);
    const fromName = fromMatch ? fromMatch[1].trim() : '';

    // Build to_emails array
    const toEmails = extractEmails(to).map(e => ({ email: e }));

    // Insert into crm_synced_emails
    const { data: synced, error } = await supabase
      .from('crm_synced_emails')
      .insert([{
        google_account_id: googleAccountId,
        gmail_message_id: messageId,
        gmail_thread_id: message.threadId,
        company_id: match.company_id,
        client_id: match.client_id,
        person_id: match.person_id,
        direction,
        from_email: fromEmails[0] || '',
        from_name: fromName,
        to_emails: toEmails,
        subject,
        body_snippet: snippet.substring(0, 500),
        body_html: bodyHtml,
        has_attachments: hasAttachments,
        attachment_count: attachmentCount,
        is_read: !message.labelIds?.includes('UNREAD'),
        email_date: date ? new Date(date).toISOString() : new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      // Unique constraint violation = already synced, skip
      if (error.code === '23505') return null;
      console.error('  ❌ Insert error:', error.message);
      return null;
    }

    // Log to activity timeline
    if (direction === 'inbound') {
        // Check if company has been converted to a client
        let logToClient = false;
        if (match.company_id) {
          const { data: client } = await supabase
            .from('crm_clients')
            .select('id')
            .eq('converted_from', match.company_id)
            .single();
          if (client) {
            logToClient = true;
            // Update the synced email record to point to the client
            await supabase
              .from('crm_synced_emails')
              .update({ client_id: client.id })
              .eq('id', synced.id);
  
            await supabase.from('crm_activity_log').insert([{
              client_id: client.id,
              company_id: match.company_id,
              person_id: match.person_id,
              user_id: null,
              action: 'Email Received',
              details: `Email received from ${fromName || fromEmails[0]}: "${subject}"`,
            }]);
          }
        }
  
        if (match.client_id && !logToClient) {
          await supabase.from('crm_activity_log').insert([{
            client_id: match.client_id,
            person_id: null,
            user_id: null,
            action: 'Email Received',
            details: `Email received from ${fromName || fromEmails[0]}: "${subject}"`,
          }]);
        }
  
        if (!logToClient && !match.client_id && match.company_id) {
          await supabase.from('crm_activity_log').insert([{
            company_id: match.company_id,
            person_id: match.person_id,
            user_id: null,
            action: 'Email Received',
            details: `Email received from ${fromName || fromEmails[0]}: "${subject}"`,
          }]);
        }
      }

    // ─── PHASE 4: CHECK IF THIS IS A REPLY TO A PENDING PROPOSAL ─────────
    if (direction === 'inbound' && message.threadId) {
      await checkProposalReply(message.threadId, bodyHtml, subject, googleAccountId);
    }

    return synced;
  } catch (err) {
    console.error(`  ❌ Error processing message ${messageId}:`, err.message);
    return null;
  }
}

// ─── PHASE 4: PROPOSAL REPLY DETECTION ──────────────────────────────────────

async function checkProposalReply(threadId, bodyHtml, subject, googleAccountId) {
  try {
    // Check if this thread matches a pending proposal
    const { data: proposal } = await supabase
      .from('crm_meeting_proposals')
      .select('*, crm_people(first_name, last_name, email), crm_companies(company_name)')
      .eq('gmail_thread_id', threadId)
      .eq('status', 'pending')
      .single();

    if (!proposal) return; // No pending proposal for this thread

    console.log(`  🎯 Proposal reply detected for thread ${threadId} — classifying intent...`);

    // Strip HTML for GPT
    const plainText = (bodyHtml || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 1000);

    // Classify intent with GPT
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 50,
      messages: [
        {
          role: 'system',
          content: `You classify email replies to meeting proposals. Respond with exactly one word: confirmed, declined, reschedule, or unclear.
- confirmed: they agree to the meeting (yes, sure, works for me, sounds good, etc.)
- declined: they cannot make it or reject the meeting (no, can't make it, not available, etc.)
- reschedule: they want a different time (can we do X instead, how about Y, different time, etc.)
- unclear: anything else`,
        },
        {
          role: 'user',
          content: `Subject: ${subject}\n\nEmail: ${plainText}`,
        },
      ],
    });

    const intent = completion.choices[0]?.message?.content?.trim().toLowerCase();
    console.log(`  🧠 Intent classified: ${intent}`);

    if (intent === 'confirmed') {
      await handleProposalConfirmed(proposal, googleAccountId);
    } else if (intent === 'declined') {
      await handleProposalDeclined(proposal);
    } else if (intent === 'reschedule') {
      await handleProposalReschedule(proposal);
    } else {
      console.log(`  ⏳ Intent unclear — leaving proposal as pending`);
    }

  } catch (err) {
    console.error('  ❌ Proposal reply check failed:', err.message);
  }
}

// ─── HANDLE CONFIRMED ────────────────────────────────────────────────────────

async function handleProposalConfirmed(proposal, googleAccountId) {
  try {
    console.log(`  ✅ Proposal confirmed — auto-booking meeting...`);

    const contactName = proposal.crm_people
      ? `${proposal.crm_people.first_name} ${proposal.crm_people.last_name}`
      : proposal.crm_companies?.company_name || 'Contact';

    const title = `Meeting with ${contactName}`;

    // Get authenticated Google Calendar client
    const googleRoute = require('../routes/google');
    const { oauth2Client } = await googleRoute.getAuthenticatedClient(googleAccountId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Build Google Calendar event
    const eventBody = {
      summary: title,
      description: `Auto-booked from meeting proposal — contact confirmed via email.`,
      start: { dateTime: proposal.proposed_start, timeZone: 'Asia/Jerusalem' },
      end: { dateTime: proposal.proposed_end, timeZone: 'Asia/Jerusalem' },
      attendees: proposal.crm_people?.email ? [{ email: proposal.crm_people.email }] : [],
      conferenceData: {
        createRequest: {
          requestId: `crm-proposal-${proposal.id}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    const { data: googleEvent } = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventBody,
      conferenceDataVersion: 1,
      sendUpdates: 'all',
    });

    const meetLink = googleEvent.conferenceData?.entryPoints?.[0]?.uri || '';

    // Get the user who created the proposal
    const { data: googleAccount } = await supabase
      .from('crm_google_accounts')
      .select('user_id')
      .eq('id', googleAccountId)
      .single();

    const createdBy = googleAccount?.user_id || proposal.created_by;

    // Insert CRM meeting record
    const { data: meeting } = await supabase
      .from('crm_meetings')
      .insert([{
        google_event_id: googleEvent.id,
        google_account_id: googleAccountId,
        company_id: proposal.company_id,
        client_id: proposal.client_id,
        person_id: proposal.person_id,
        created_by: createdBy,
        title,
        description: `Auto-booked — contact confirmed via email reply to proposal.`,
        meeting_type: 'google_meet',
        status: 'scheduled',
        start_time: proposal.proposed_start,
        end_time: proposal.proposed_end,
        meet_link: meetLink,
        attendees: proposal.crm_people?.email ? [{ email: proposal.crm_people.email, name: contactName }] : [],
        is_internal: false,
      }])
      .select()
      .single();

    // Update proposal status to accepted
    await supabase
      .from('crm_meeting_proposals')
      .update({ status: 'accepted' })
      .eq('id', proposal.id);

    // Log to activity
    const logEntry = {
      user_id: createdBy,
      action: 'Meeting Auto-Booked',
      details: `Meeting auto-booked after ${contactName} confirmed proposal via email. Meet: ${meetLink}`,
    };
    if (proposal.company_id) logEntry.company_id = proposal.company_id;
    if (proposal.client_id) logEntry.client_id = proposal.client_id;
    if (proposal.person_id) logEntry.person_id = proposal.person_id;

    await supabase.from('crm_activity_log').insert([logEntry]);

    console.log(`  🎉 Meeting auto-booked: ${title} | Meet: ${meetLink}`);

  } catch (err) {
    console.error('  ❌ Auto-book failed:', err.message);
  }
}

// ─── HANDLE DECLINED ─────────────────────────────────────────────────────────

async function handleProposalDeclined(proposal) {
  try {
    const contactName = proposal.crm_people
      ? `${proposal.crm_people.first_name} ${proposal.crm_people.last_name}`
      : proposal.crm_companies?.company_name || 'Contact';

    await supabase
      .from('crm_meeting_proposals')
      .update({ status: 'declined' })
      .eq('id', proposal.id);

    const logEntry = {
      user_id: proposal.created_by,
      action: 'Meeting Proposal Declined',
      details: `${contactName} declined the meeting proposal.`,
    };
    if (proposal.company_id) logEntry.company_id = proposal.company_id;
    if (proposal.client_id) logEntry.client_id = proposal.client_id;

    await supabase.from('crm_activity_log').insert([logEntry]);
    console.log(`  ❌ Proposal declined by ${contactName}`);
  } catch (err) {
    console.error('  ❌ Handle declined failed:', err.message);
  }
}

// ─── HANDLE RESCHEDULE REQUEST ───────────────────────────────────────────────

async function handleProposalReschedule(proposal) {
  try {
    const contactName = proposal.crm_people
      ? `${proposal.crm_people.first_name} ${proposal.crm_people.last_name}`
      : proposal.crm_companies?.company_name || 'Contact';

    await supabase
      .from('crm_meeting_proposals')
      .update({ status: 'declined' })
      .eq('id', proposal.id);

    const logEntry = {
      user_id: proposal.created_by,
      action: 'Meeting Reschedule Requested',
      details: `${contactName} replied to the meeting proposal requesting a different time. Check the email thread and propose a new time.`,
    };
    if (proposal.company_id) logEntry.company_id = proposal.company_id;
    if (proposal.client_id) logEntry.client_id = proposal.client_id;

    await supabase.from('crm_activity_log').insert([logEntry]);
    console.log(`  🔄 Reschedule requested by ${contactName}`);
  } catch (err) {
    console.error('  ❌ Handle reschedule failed:', err.message);
  }
}

// ─── SYNC A SINGLE GOOGLE ACCOUNT ───────────────────────────────────────────

async function syncAccount(account) {
  console.log(`\n📬 Syncing account: ${account.email} (${account.account_type})`);

  try {
    const gmail = await getGmailClient(account.id);
    let messagesProcessed = 0;
    let messagesMatched = 0;

    if (account.last_history_id) {
      // ─── INCREMENTAL SYNC (using history) ───
      try {
        const { data: history } = await gmail.users.history.list({
          userId: 'me',
          startHistoryId: account.last_history_id,
          historyTypes: ['messageAdded'],
        });

        if (history.history) {
          const messageIds = new Set();
          for (const entry of history.history) {
            for (const msg of (entry.messagesAdded || [])) {
              messageIds.add(msg.message.id);
            }
          }

          console.log(`  📥 Incremental sync: ${messageIds.size} new messages`);

          for (const msgId of messageIds) {
            messagesProcessed++;
            const result = await processMessage(gmail, account.id, msgId, account.email);
            if (result) messagesMatched++;
          }
        } else {
          console.log('  ✅ No new messages since last sync');
        }

        // Update history ID
        if (history.historyId) {
          await supabase
            .from('crm_google_accounts')
            .update({ last_history_id: history.historyId, last_sync_at: new Date().toISOString() })
            .eq('id', account.id);
        }
      } catch (histErr) {
        // History ID might be expired — do a full scan
        if (histErr.code === 404 || histErr.message?.includes('notFound')) {
          console.log('  ⚠️ History expired, doing full scan...');
          await fullScan(gmail, account);
        } else {
          throw histErr;
        }
      }
    } else {
      // ─── INITIAL FULL SCAN ───
      await fullScan(gmail, account);
    }

    console.log(`  ✅ Done: ${messagesProcessed} processed, ${messagesMatched} matched to CRM`);
  } catch (err) {
    console.error(`  ❌ Sync failed for ${account.email}:`, err.message);
  }
}

// ─── FULL SCAN (initial sync or history expired) ─────────────────────────────

async function fullScan(gmail, account) {
  console.log('  📥 Full scan: fetching last 30 days of emails...');

  // Get current profile for historyId
  const { data: profile } = await gmail.users.getProfile({ userId: 'me' });

  // Fetch messages from last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const afterDate = Math.floor(thirtyDaysAgo.getTime() / 1000);

  let allMessageIds = [];
  let pageToken = null;

  do {
    const params = {
      userId: 'me',
      q: `after:${afterDate}`,
      maxResults: 100,
    };
    if (pageToken) params.pageToken = pageToken;

    const { data } = await gmail.users.messages.list(params);
    if (data.messages) {
      allMessageIds.push(...data.messages.map(m => m.id));
    }
    pageToken = data.nextPageToken;
  } while (pageToken && allMessageIds.length < 500); // Cap at 500 for initial scan

  console.log(`  📥 Found ${allMessageIds.length} messages in last 30 days`);

  let matched = 0;
  for (const msgId of allMessageIds) {
    const result = await processMessage(gmail, account.id, msgId, account.email);
    if (result) matched++;
  }

  console.log(`  ✅ Full scan complete: ${matched} emails matched to CRM contacts`);

  // Save history ID for future incremental syncs
  await supabase
    .from('crm_google_accounts')
    .update({
      last_history_id: profile.historyId,
      last_sync_at: new Date().toISOString(),
    })
    .eq('id', account.id);
}

// ─── MAIN SYNC FUNCTION (syncs all active accounts) ─────────────────────────

async function syncAllAccounts() {
  console.log('\n═══════════════════════════════════════');
  console.log('📬 Gmail Sync — Starting sync cycle');
  console.log('═══════════════════════════════════════');

  const { data: accounts, error } = await supabase
    .from('crm_google_accounts')
    .select('*')
    .eq('is_active', true);

  if (error || !accounts || accounts.length === 0) {
    console.log('  No active Google accounts to sync');
    return;
  }

  console.log(`  Found ${accounts.length} active account(s)`);

  for (const account of accounts) {
    await syncAccount(account);
  }

  console.log('\n═══════════════════════════════════════');
  console.log('📬 Gmail Sync — Cycle complete');
  console.log('═══════════════════════════════════════\n');
}

// ─── SYNC SINGLE ACCOUNT BY ID ──────────────────────────────────────────────

async function syncSingleAccount(googleAccountId) {
  const { data: account, error } = await supabase
    .from('crm_google_accounts')
    .select('*')
    .eq('id', googleAccountId)
    .eq('is_active', true)
    .single();

  if (error || !account) {
    console.log('Account not found or inactive');
    return;
  }

  await syncAccount(account);
}

module.exports = {
  syncAllAccounts,
  syncSingleAccount,
  syncAccount,
};