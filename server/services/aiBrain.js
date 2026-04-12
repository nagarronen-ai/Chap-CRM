const OpenAI = require('openai');
const supabase = require('../db');
const { toolDefinitions, executeTool, CONFIRMATION_REQUIRED } = require('./aiTools');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY_BRAIN });

const getSystemPrompt = () => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Jerusalem' });
  return `You are Chappie, the AI assistant built into VenueFlow CRM — the internal operating system for Planfor.io, a wedding and event venue marketplace. You serve the entire company: sales, management, finance, customer success, marketing, and support.

WHO YOU SERVE:
Sales reps: pipeline management, lead follow-up, meeting prep, outreach.
Management: company-wide performance, team activity, revenue overview.
Finance: transaction tracking, pending payments, revenue summaries.
Customer Success (CSM): client health, stage management, contract details.
Marketing: campaign performance, engagement tracking.
Support: client contact info, meeting history, notes.

BEHAVIOR RULES — NON-NEGOTIABLE:
1. ALWAYS use tools to get live data. Never answer from memory or assumptions.
2. For multi-part questions, call ALL needed tools before responding. Never make the user ask twice.
3. Never ask permission to look something up. Just do it immediately.
4. Never say "I would need to check" or "I don't have access". You have tools — use them.
5. CRITICAL FORMATTING: Never use markdown. No **bold**, no - bullets, no # headers, no _underscores_. Plain conversational text only. Use line breaks between topics.
6. Always respond in English.
7. Be direct and concise. Lead with the answer, then context.
8. For confirmation actions, state exactly what will happen — who, what, when — before the user sees confirm/cancel buttons.
9. Always call search_contacts first before any action involving a person or company name.
10. Format all dates as: Tuesday March 28 at 10:00 AM. Never ISO format.

EMAIL RULES — READ CAREFULLY:
- Send to a named person: search_contacts to get email + person_id + company_id → send_email. Always pass person_id.
- Send to a company role (e.g. "CEO of QualifAI"): search_contacts to find company → get_company_people → match by title → send_email with that person's person_id.
- Send to all contacts at a company: search_contacts → get_company_people → send_bulk_email with the full list.
- Send to one person CC rest of team: search_contacts → get_company_people → send_email with TO = named person, cc = array of all other emails at that company.
- Reply to last email: search_contacts → get_last_thread → send_email with thread_id from get_last_thread and subject starting "Re: [original subject]".
- New email (not a reply): do NOT call get_last_thread. Do NOT add "Re:" to subject.
- CRITICAL: person_id and company_id MUST be real UUIDs from tool results. Never guess or invent IDs. If not found, pass null.
- Always pass person_id when sending to a named person — it is in the people array of search_contacts results.
- When sending email, the company_id to use is the person's company_id field from the people array in search_contacts results — NOT from the companies array or clients array. The people array has the correct company_id that links to crm_companies.
- When user says "CC the CEO" or any role, always call get_company_people first to get the full team list with titles, then match the exact person by title for CC. Never guess who holds a role from memory.


EMAIL READING RULES:
- "Did X reply?" → search_contacts → get_last_thread → get_email_thread → check received_messages for replies. Never answer yes/no without reading the thread.
- "What did X say?" / "What was the reply?" / "Read the email" → search_contacts → get_last_thread → get_email_thread → summarize received_messages. Never say you cannot find it after get_last_thread succeeds.

CAMPAIGN ANALYTICS:
- "How many opened campaign X?" → get_campaign_stats with campaign name.
- "Who clicked?" / "Full report?" → get_campaign_stats, present all stats clearly.

OTHER TOOL RULES:
- User asks about meetings → get_my_meetings.
- User asks about pipeline/leads/stages → get_pipeline_summary.
- User asks about stale leads → get_stale_leads.
- User asks about revenue/payments → get_finance_summary.
- User asks for campaign overview or all campaigns → get_all_campaigns.
- User asks about past interactions, historical context, what was discussed with a contact, anything requiring memory search → search_memory with a natural language query. This searches emails, notes, meetings, and thoughts semantically.
- User asks about waitlist, couples list, how many signed up → get_waitlist_stats or get_waitlist_list.
- Prep for a meeting → search_contacts + get_company_brief or get_client_status + get_my_meetings all at once.
- Multi-topic question → call every relevant tool before responding.
FILE HANDLING RULES:
- When a message contains "[File attached:" — the file has already been uploaded. Extract the url from the message.
- If the user says "add to X" or "attach to X" with a file → search_contacts → attach_document with the file_url from the message.
- Always ask for document type if not specified: Contract, Invoice, Proposal, NDA, Presentation, or Other.
- Never use add_note to store file URLs — always use attach_document.
- If no instruction given with a file → ask: "What should I do with this file? I can attach it to a contact or client, or add it as an expense if it's an invoice."
- After search_contacts: check companies, clients, AND people arrays. If person found, use their company. Never say not found without checking all three.

WRITE ACTIONS:
Instant (no confirmation): add note, attach document, update pipeline stage, update next action, update client stage.
Requires confirmation: send_email, send_bulk_email, propose_meeting, book_meeting, cancel_meeting, reschedule_meeting.
- For book_meeting: always calculate exact dates from today (${dateStr}). "This Thursday" = April 2 2026. "Tomorrow" = April 1 2026. Never guess or use past dates. Always show the exact calculated date in the confirmation card so the user can verify before confirming.
- If any detail is ambiguous — show your assumption clearly. Never silently guess.

MEETING PROPOSAL RULES — NON-NEGOTIABLE:
- CRITICAL: "propose a meeting", "propose meeting", "suggest a meeting" → ALWAYS use propose_meeting. NEVER use book_meeting. This is non-negotiable.
- book_meeting = only when user says "book", "schedule", "set up a meeting" AND the contact has already confirmed they are available. book_meeting sends a Google Calendar invite immediately.
- propose_meeting = sends an email suggesting a time to a contact who has NOT yet confirmed. No calendar invite is created. Used for outreach.
- "Propose a meeting with X for Monday at 2pm" → propose_meeting. The contact has not agreed yet.
- "Book a meeting with X for Monday at 2pm" → book_meeting. Assumes agreement.
- When in doubt → propose_meeting. Never assume agreement unless explicitly stated.
- Always call check_calendar_conflicts before propose_meeting.
- After propose_meeting confirms, tell the user: "Proposal sent and tracked. I'll detect their reply when they respond."
- "Any pending proposals?" / "Who hasn't replied?" → call get_pending_proposals.

SCHEDULING RULES — NON-NEGOTIABLE:
- ALWAYS call check_calendar_conflicts before book_meeting or reschedule_meeting. No exceptions.
- If check_calendar_conflicts returns conflict: false — proceed to book_meeting immediately.
- If check_calendar_conflicts returns conflict: true — DO NOT call book_meeting. Instead:
  1. Tell the user exactly which event conflicts (title, time, and who it is with if available).
  2. Tell the user the suggested next available slot (use suggested_start_hour, suggested_start_min, suggested_end_hour, suggested_end_min from the result).
  3. Ask if they want to book the suggested slot or pick a different time.
  4. Only call book_meeting after the user confirms a specific conflict-free time.
- When reporting a conflict, format times as human-readable: "You already have X with Y from 2:15 PM to 3:00 PM. Next available slot is 3:00 PM to 3:30 PM — want me to book that instead?"

TONE:
Speak like a sharp experienced chief of staff. Direct, no pleasantries, lead with facts. Make reasonable assumptions rather than asking for clarification. If you genuinely cannot complete a request, say exactly what is missing in one sentence.

FINAL REMINDER: ABSOLUTELY NO MARKDOWN EVER. No **bold**, no *italic*, no - bullets, no • bullets, no # headers, no numbered lists with dashes. When presenting data like campaigns or lists, use plain conversational sentences and line breaks only. Example of WRONG format: "**Campaign Name:** X". Example of RIGHT format: "Campaign Name: X". This rule has zero exceptions.`;
};

// ─── UUID VALIDATOR ───────────────────────────────────────────────────────────
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validUUID = (val) => val && uuidRegex.test(val) ? val : null;

// ─── GET OR CREATE CONVERSATION ───────────────────────────────────────────────
async function getConversationById(conversationId) {
  const { data } = await supabase
    .from('crm_ai_conversations')
    .select('*')
    .eq('id', conversationId)
    .single();
  return data;
}
async function getOrCreateConversation(userId) {
  try {
    const { data } = await supabase
      .from('crm_ai_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      // Strip all tool_calls and tool result messages — keep only clean text messages
      const messages = (data.messages || []);
      const cleaned = messages.filter(m =>
        (m.role === 'user' || m.role === 'assistant') &&
        !m.tool_calls &&
        typeof m.content === 'string' &&
        m.content.length > 0
      );

      if (cleaned.length !== messages.length) {
        await supabase
          .from('crm_ai_conversations')
          .update({ messages: cleaned, updated_at: new Date().toISOString() })
          .eq('id', data.id);
        data.messages = cleaned;
      }
      return data;
    }
  } catch (err) {
    // No existing conversation — create one
  }

  const { data: newConv } = await supabase
    .from('crm_ai_conversations')
    .insert([{ user_id: userId, messages: [], actions_taken: [] }])
    .select()
    .single();

  return newConv;
}

// ─── SAVE MESSAGES ────────────────────────────────────────────────────────────
async function saveMessages(conversationId, messages, lastMessage, actionsTaken) {
  // Only save clean text messages — strip any tool_calls or tool results before saving
  const cleaned = messages.filter(m =>
    (m.role === 'user' || m.role === 'assistant') &&
    !m.tool_calls &&
    typeof m.content === 'string' &&
    m.content.length > 0
  );

  const trimmed = cleaned.slice(-50);

  await supabase
    .from('crm_ai_conversations')
    .update({
      messages: trimmed,
      last_message: lastMessage || null,
      actions_taken: actionsTaken || [],
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);
}

// ─── MAIN CHAT FUNCTION ───────────────────────────────────────────────────────
async function chat(userId, userMessage, pendingConfirmation = null, conversationId = null) {
  const conversation = conversationId
    ? await getConversationById(conversationId)
    : await getOrCreateConversation(userId);
  const actionsTaken = conversation.actions_taken || [];

  // Load history — only clean text messages for OpenAI
  let history = (conversation.messages || []).filter(m =>
    (m.role === 'user' || m.role === 'assistant') &&
    !m.tool_calls &&
    typeof m.content === 'string' &&
    m.content.length > 0
  );

  // ── Handle confirmed action execution ──
  if (pendingConfirmation && pendingConfirmation.confirmed) {
    if (!pendingConfirmation.actions || pendingConfirmation.actions.length === 0) {
      return { type: 'text', content: '❌ No actions to execute.', conversationId: conversation.id };
    }
    return await executeConfirmedActions(userId, conversation, history, actionsTaken, pendingConfirmation.actions);
  }

  // ── Regular chat message ──
  if (!userMessage) {
    return { type: 'text', content: '❌ No message provided.', conversationId: conversation.id };
  }

  // Build working history with tool messages (not saved to DB, only used for this session)
  let workingHistory = [...history, { role: 'user', content: userMessage }];

  let iterations = 0;
  const MAX_ITERATIONS = 6;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: getSystemPrompt() },
        ...workingHistory.slice(-30),
      ],
      tools: toolDefinitions,
      tool_choice: 'auto',
      max_tokens: 1500,
    });

    const message = response.choices[0].message;

    // ── No tool calls — final text response ──
    if (!message.tool_calls || message.tool_calls.length === 0) {
      const raw = message.content || '';
      // Strip markdown — GPT ignores formatting instructions for structured data
      const content = raw
        .replace(/\*\*(.*?)\*\*/g, '$1')   // **bold**
        .replace(/\*(.*?)\*/g, '$1')        // *italic*
        .replace(/^#{1,6}\s+/gm, '')        // # headers
        .replace(/^[-•]\s+/gm, '')          // - bullets
        .replace(/^\d+\.\s+/gm, '')         // 1. numbered lists
        .replace(/`{1,3}(.*?)`{1,3}/gs, '$1') // `code`
        .trim();
        const now = new Date().toISOString();
        const savedHistory = [...history, { role: 'user', content: userMessage, timestamp: now }, { role: 'assistant', content, timestamp: now }];
      await saveMessages(conversation.id, savedHistory, userMessage, actionsTaken);
      return { type: 'text', content, conversationId: conversation.id };
    }

    // ── Has tool calls ──
    workingHistory = [...workingHistory, message];

    const confirmationTools = message.tool_calls.filter(tc => CONFIRMATION_REQUIRED.includes(tc.function.name));
    const instantTools = message.tool_calls.filter(tc => !CONFIRMATION_REQUIRED.includes(tc.function.name));

    // Execute all instant tools
    for (const tc of instantTools) {
      let result;
      try {
        const args = JSON.parse(tc.function.arguments);
        result = await executeTool(tc.function.name, args, userId);
        actionsTaken.push({
          tool: tc.function.name,
          args,
          result,
          timestamp: new Date().toISOString(),
          status: 'executed',
        });
      } catch (err) {
        console.error(`Tool ${tc.function.name} failed:`, err.message);
        result = { error: err.message };
      }
      workingHistory = [...workingHistory, {
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      }];
    }

    // ── Confirmation required ──
    if (confirmationTools.length > 0) {
      const pendingActions = [];

      for (const tc of confirmationTools) {
        let args;
        try {
          args = JSON.parse(tc.function.arguments);
        } catch (err) {
          console.error('Failed to parse tool arguments:', err.message);
          args = {};
        }

        // Add placeholder tool result so history stays valid
        workingHistory = [...workingHistory, {
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({ status: 'pending_confirmation' }),
        }];

        pendingActions.push({
          tool: tc.function.name,
          args,
          tool_call_id: tc.id,
        });
      }

      // Get a one-sentence summary of what Chappie is about to do
      let summaryContent = '';
      try {
        const summaryResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: getSystemPrompt() },
            ...workingHistory.slice(-20),
            { role: 'user', content: 'In one short sentence, describe exactly what you are about to do. Do not ask for confirmation — the user will see confirm/cancel buttons.' },
          ],
          max_tokens: 150,
        });
        summaryContent = summaryResponse.choices[0].message.content || '';
      } catch (err) {
        console.error('Summary generation failed:', err.message);
        summaryContent = 'Ready to execute the requested action.';
      }

      // Save clean history with the summary
      const savedHistory = [
        ...history,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: summaryContent },
      ];
      await saveMessages(conversation.id, savedHistory, userMessage, actionsTaken);

      return {
        type: 'confirmation',
        content: summaryContent,
        pending_actions: pendingActions,
        conversationId: conversation.id,
      };
    }

    // All instant — loop back for next response
  }

  // Max iterations reached
  const fallback = 'I gathered the information. What would you like me to do with it?';
  const savedHistory = [...history, { role: 'user', content: userMessage }, { role: 'assistant', content: fallback }];
  await saveMessages(conversation.id, savedHistory, userMessage, actionsTaken);
  return { type: 'text', content: fallback, conversationId: conversation.id };
}

// ─── EXECUTE CONFIRMED ACTIONS ────────────────────────────────────────────────
async function executeConfirmedActions(userId, conversation, history, actionsTaken, actions) {
  console.log('executeConfirmedActions called with', actions.length, 'action(s)');

  const results = [];

  for (const action of actions) {
    console.log('Executing:', action.tool, JSON.stringify(action.args));
    try {
      const result = await executeConfirmedWriteAction(userId, action.tool, action.args);
      console.log('Success:', action.tool, JSON.stringify(result));
      results.push({ tool: action.tool, success: true, result });
      actionsTaken.push({
        tool: action.tool,
        args: action.args,
        result,
        timestamp: new Date().toISOString(),
        status: 'confirmed_executed',
      });
    } catch (err) {
      console.error('Failed:', action.tool, err.message);
      results.push({ tool: action.tool, success: false, error: err.message });
    }
  }

  console.log('Results:', JSON.stringify(results));

  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  let summary;
  if (successCount === totalCount) {
    const meetLink = results.find(r => r.result?.meeting?.meet_link)?.result?.meeting?.meet_link;
    summary = totalCount === 1
      ? `✅ Done — action completed successfully.${meetLink ? `\n\nMeet link: ${meetLink}` : ''}`
      : `✅ Done — all ${totalCount} actions completed successfully.`;
  } else {
    summary = `✅ Done — ${successCount} of ${totalCount} actions completed successfully.`;
  }

  const savedHistory = [...history, { role: 'assistant', content: summary }];
  await saveMessages(conversation.id, savedHistory, summary, actionsTaken);

  return {
    type: 'text',
    content: summary,
    results,
    conversationId: conversation.id,
  };
}

// ─── EXECUTE WRITE ACTIONS ────────────────────────────────────────────────────
async function executeConfirmedWriteAction(userId, toolName, args) {
  console.log('executeConfirmedWriteAction:', toolName);
  const axios = require('axios');
  const jwt = require('jsonwebtoken');

  const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';
  const token = jwt.sign({ id: userId, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '5m' });
  const headers = { Authorization: `Bearer ${token}` };

  switch (toolName) {

    case 'send_email': {
      // Auto-lookup client_id from company_id so email appears in client emails tab
      let clientId = validUUID(args.client_id);
      if (!clientId && validUUID(args.company_id)) {
        const { data: clientRecord } = await supabase
          .from('crm_clients')
          .select('id')
          .eq('converted_from', args.company_id)
          .single();
        if (clientRecord) clientId = clientRecord.id;
      }
    
      const payload = {
        company_id: validUUID(args.company_id),
        client_id: clientId,
        person_id: validUUID(args.person_id),
        subject: args.subject,
        body_html: `<p>${(args.body || '').replace(/\n/g, '<br>')}</p>`,
        recipient_email: args.recipient_email,
        recipient_name: args.recipient_name,
        thread_id: args.thread_id || null,
        cc: Array.isArray(args.cc) ? args.cc : [],
      };
      console.log('send_email payload:', JSON.stringify(payload));
      const res = await axios.post(`${API_BASE}/emails/send`, payload, { headers });
      return { sent: true, to: args.recipient_email, method: res.data?.sendMethod };
    }

    case 'send_bulk_email': {
      const recipients = Array.isArray(args.recipients) ? args.recipients : [];
      const sendResults = [];

      for (const recipient of recipients) {
        try {
          const payload = {
            company_id: validUUID(args.company_id),
            person_id: validUUID(recipient.person_id),
            subject: args.subject,
            body_html: `<p>${(args.body || '').replace(/\n/g, '<br>')}</p>`,
            recipient_email: recipient.email,
            recipient_name: recipient.name,
          };
          await axios.post(`${API_BASE}/emails/send`, payload, { headers });
          sendResults.push({ email: recipient.email, sent: true });
          console.log('Bulk sent to:', recipient.email);
        } catch (err) {
          console.error('Bulk send failed for', recipient.email, ':', err.message);
          sendResults.push({ email: recipient.email, sent: false, error: err.message });
        }
      }

      const sentCount = sendResults.filter(r => r.sent).length;
      return { sent_count: sentCount, total: sendResults.length, results: sendResults };
    }

    case 'book_meeting': {
      const start_time = new Date(
        `${args.date}T${String(args.start_hour).padStart(2, '0')}:${String(args.start_min || 0).padStart(2, '0')}:00`
      ).toISOString();
      const end_time = new Date(
        `${args.date}T${String(args.end_hour).padStart(2, '0')}:${String(args.end_min || 0).padStart(2, '0')}:00`
      ).toISOString();

      const res = await axios.post(`${API_BASE}/calendar/meetings`, {
        title: args.title,
        meeting_type: args.meeting_type || 'google_meet',
        start_time,
        end_time,
        company_id: validUUID(args.company_id),
        client_id: validUUID(args.client_id),
        person_id: validUUID(args.person_id),
        attendee_emails: args.attendee_email ? [args.attendee_email] : [],
      }, { headers });

      return { booked: true, meeting: res.data };
    }

    case 'cancel_meeting': {
      await axios.delete(`${API_BASE}/calendar/meetings/${args.meeting_id}`, { headers });
      return { cancelled: true, meeting_id: args.meeting_id };
    }

    case 'reschedule_meeting': {
      const start_time = new Date(
        `${args.date}T${String(args.start_hour).padStart(2, '0')}:${String(args.start_min || 0).padStart(2, '0')}:00`
      ).toISOString();
      const end_time = new Date(
        `${args.date}T${String(args.end_hour).padStart(2, '0')}:${String(args.end_min || 0).padStart(2, '0')}:00`
      ).toISOString();

      await axios.put(
        `${API_BASE}/calendar/meetings/${args.meeting_id}/reschedule`,
        { start_time, end_time },
        { headers }
      );

      return { rescheduled: true, meeting_id: args.meeting_id };
    }

    case 'propose_meeting': {
      // 1. Send the email
      const emailRes = await axios.post(`${API_BASE}/emails/send`, {
        recipient_email: args.recipient_email,
        recipient_name: args.recipient_name,
        subject: args.subject,
        body_html: args.body,
        company_id: args.company_id || null,
        client_id: args.client_id || null,
        person_id: args.person_id || null,
        thread_id: args.thread_id || null,
        cc: args.cc || [],
      }, { headers });

      // 2. Build proposed times (args times are in user's timezone — store as-is in ISO)
      const proposed_start = new Date(
        `${args.proposed_date}T${String(args.proposed_start_hour).padStart(2, '0')}:${String(args.proposed_start_min || 0).padStart(2, '0')}:00`
      ).toISOString();
      const proposed_end = new Date(
        `${args.proposed_date}T${String(args.proposed_end_hour).padStart(2, '0')}:${String(args.proposed_end_min || 0).padStart(2, '0')}:00`
      ).toISOString();

      // 3. Get the gmail_thread_id from the sent email response
      const gmail_thread_id = emailRes.data?.gmail_thread_id || args.thread_id || null;

      // 4. Store the proposal in DB
      const { data: proposal, error } = await supabase
        .from('crm_meeting_proposals')
        .insert([{
          company_id: args.company_id || null,
          client_id: args.client_id || null,
          person_id: args.person_id || null,
          gmail_thread_id,
          proposed_start,
          proposed_end,
          status: 'pending',
          email_subject: args.subject,
          created_by: userId,
        }])
        .select()
        .single();

      if (error) console.error('Failed to store proposal:', error.message);

      return {
        proposed: true,
        proposal_id: proposal?.id || null,
        gmail_thread_id,
        proposed_start,
        proposed_end,
      };
    }

    default:
      throw new Error(`Unknown confirmation tool: ${toolName}`);
  }
}

module.exports = { chat };