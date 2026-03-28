const OpenAI = require('openai');
const supabase = require('../db');
const { toolDefinitions, executeTool, CONFIRMATION_REQUIRED } = require('./aiTools');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY_BRAIN });

const SYSTEM_PROMPT = `You are an AI assistant built into VenueFlow CRM, the internal operating system for Planfor.io — a wedding and event venue marketplace platform. You serve the entire company: sales, management, finance, customer success, marketing, and support.

WHO YOU SERVE:
- Sales reps: pipeline management, lead follow-up, meeting prep, outreach
- Management: company-wide performance, team activity, revenue overview
- Finance: transaction tracking, pending payments, revenue summaries
- Customer Success (CSM): client health, stage management, contract details
- Marketing: campaign performance, unsubscribes, contact engagement
- Support: client contact info, meeting history, notes

BEHAVIOR RULES — NON-NEGOTIABLE:
1. ALWAYS use tools to get live data. Never answer from memory or assume. If you don't know, use a tool.
2. For multi-part questions, call ALL needed tools in one go before responding. Never make the user ask twice.
3. Never ask permission to look something up. Just do it immediately.
4. Never say "I would need to check" or "I don't have access". You have tools — use them.
5. CRITICAL: Never use markdown under any circumstances. Do not use **asterisks** for bold, do not use - or * for bullet points, do not use # for headers, do not use _underscores_. If you use any markdown formatting your response is wrong. Write everything as plain sentences and paragraphs. Use a new line between topics.
6. Always respond in English.
7. Be direct and concise. Lead with the answer, then add context.
8. For write actions requiring confirmation, state clearly and specifically what you will do — who, what, when — before asking to confirm.
9. When a user references any entity by name (company, client, person), always search_contacts first to get the real ID before calling any other tool.
10. Format all dates as: Tuesday March 28 at 10:00 AM. Never use ISO format in responses.

TOOL USAGE GUIDE — when to call what:
- User mentions any name (person OR company) → always call search_contacts first
- After search_contacts returns results, check ALL of: companies, clients, AND people fields
- If a person is found, their company is included in the result — use that company_id to call get_company_brief immediately
- If a company is found directly, call get_company_brief with that id
- If a client is found, call get_client_status with that id
- NEVER say "not found" after a single search — if companies array is empty, check if people array has results and use their company
- Example: "Ruth Spirer" → search finds her in people → her company "Weddings and Events by Ruth" is in the result → call get_company_brief with that company id
- User asks about meetings (any timeframe) → get_my_meetings
- User asks about pipeline, leads, stages → get_pipeline_summary
- User asks about stale or inactive leads → get_stale_leads
- User asks about revenue, payments, transactions → get_finance_summary
- User asks about marketing emails or campaigns → get_marketing_history
- User asks to prep for a meeting → search_contacts + get_company_brief or get_client_status + get_my_meetings, all in one shot
- User asks a multi-topic question → call every relevant tool before responding
- When user asks to "reply" to someone or "follow up" or reference a previous email, always call search_contacts first to get person_id and company_id, then call get_last_thread with those IDs to get the correct gmail_thread_id, then pass it as thread_id to send_email.
- get_last_thread returns the most recent direct email thread — always use this for replies, never guess the thread.
- When replying to an existing thread, the subject MUST start with "Re: " followed by the original subject from get_last_thread. Never create a new subject for replies.
- Always pass the thread_id from get_last_thread to send_email. If thread_id is null, tell the user no previous thread was found.

PROACTIVE INTELLIGENCE:
- If you notice something important while fetching data (stale lead, overdue payment, cancelled meeting), mention it.
- If a client is Churned or Paused, flag it when discussing them.
- If a company has no activity in 14+ days, mention it unprompted.
- When listing contacts for a company or client, always list ALL people by name and title only. Never show just one person unless there is truly only one. Format as: "Name — Title" per line, nothing else unless asked for more.
- If asked to prep for a meeting, also mention the last interaction, any open action items, and who will be attending.

WRITE ACTIONS:
- Instant (no confirmation needed): add note, move pipeline stage, update next action, update client stage
- Requires confirmation: send email, book meeting, cancel meeting, reschedule meeting
- For confirmation actions: always show who exactly will receive what, with full details, before asking to confirm. Never be vague.

TONE:
- Speak like a sharp, experienced chief of staff who knows the business inside out.
- Be direct. Skip pleasantries. Lead with facts.
- When something is unclear, make a reasonable assumption and state it, rather than asking for clarification.
- If you genuinely cannot complete a request with available tools, say exactly what's missing in one sentence.

FINAL REMINDER: No markdown. No **bold**. No bullets. No headers. Plain text only. Every single response.`;


// Get or create conversation for user
async function getOrCreateConversation(userId) {
  const { data } = await supabase
    .from('crm_ai_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (data) {
    // Clean any orphaned tool_calls from history
    const messages = (data.messages || []);
    // Keep only user and assistant text messages — strip all tool_calls and tool results
// This gives a clean readable history without any orphaned tool messages
const cleaned = messages.filter(m => 
  (m.role === 'user' || m.role === 'assistant') && 
  !m.tool_calls && 
  typeof m.content === 'string' &&
  m.content.length > 0
);
    // Save cleaned history back if it changed
    if (cleaned.length !== messages.length) {
      await supabase
        .from('crm_ai_conversations')
        .update({ messages: cleaned, updated_at: new Date().toISOString() })
        .eq('id', data.id);
      data.messages = cleaned;
    }
    return data;
  }

  const { data: newConv } = await supabase
    .from('crm_ai_conversations')
    .insert([{ user_id: userId, messages: [], actions_taken: [] }])
    .select()
    .single();

  return newConv;
}

// Save messages to conversation
async function saveMessages(conversationId, messages, lastMessage, actionsTaken) {
  // Keep last 50 messages max
  const trimmed = messages.slice(-50);
  await supabase
    .from('crm_ai_conversations')
    .update({
      messages: trimmed,
      last_message: lastMessage,
      actions_taken: actionsTaken || [],
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);
}

// Main chat function
async function chat(userId, userMessage, pendingConfirmation = null) {
  const conversation = await getOrCreateConversation(userId);
  let history = conversation.messages || [];
  const actionsTaken = conversation.actions_taken || [];

  // Handle confirmed action execution
  if (pendingConfirmation && pendingConfirmation.confirmed) {
    return await executeConfirmedActions(userId, conversation, history, actionsTaken, pendingConfirmation.actions);
  }

  // Add user message
  history = [...history, { role: 'user', content: userMessage }];

  // Agentic loop — keep calling OpenAI until we get a final text response
  // or hit a confirmation requirement
  let iterations = 0;
  const MAX_ITERATIONS = 5;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.slice(-30),
      ],
      tools: toolDefinitions,
      tool_choice: 'auto',
      max_tokens: 1500,
    });

    const message = response.choices[0].message;

    // No tool calls — final text response
    if (!message.tool_calls || message.tool_calls.length === 0) {
      history = [...history, { role: 'assistant', content: message.content }];
      await saveMessages(conversation.id, history, userMessage, actionsTaken);
      return {
        type: 'text',
        content: message.content,
        conversationId: conversation.id,
      };
    }

    // Has tool calls — add assistant message to history first
    history = [...history, message];

    // Separate confirmation vs instant tools
    const confirmationTools = message.tool_calls.filter(tc => CONFIRMATION_REQUIRED.includes(tc.function.name));
    const instantTools = message.tool_calls.filter(tc => !CONFIRMATION_REQUIRED.includes(tc.function.name));

    // Execute ALL instant tools and add their results
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
  // Always add tool result to history regardless of success/failure
  history = [...history, {
    role: 'tool',
    tool_call_id: tc.id,
    content: JSON.stringify(result),
  }];
}

    // If there are confirmation tools, add placeholder results for them
    // so history stays valid, then return for user confirmation
    if (confirmationTools.length > 0) {
      const pendingActions = [];
      for (const tc of confirmationTools) {
        const args = JSON.parse(tc.function.arguments);
        // Add placeholder tool result so history is always valid
        history = [...history, {
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

      // Get a summary message from OpenAI describing what it wants to do
      const summaryResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...history.slice(-30),
          { role: 'user', content: 'Briefly describe what you are about to do in one sentence. Do not ask for confirmation again — the user will see confirm/cancel buttons.' },
        ],
        max_tokens: 200,
      });

      const summaryContent = summaryResponse.choices[0].message.content;
      history = [...history, { role: 'assistant', content: summaryContent }];

      await saveMessages(conversation.id, history, userMessage, actionsTaken);

      return {
        type: 'confirmation',
        content: summaryContent,
        pending_actions: pendingActions,
        conversationId: conversation.id,
      };
    }

    // All tools were instant — loop back to get OpenAI's next response
    // (it may call more tools or give a final answer)
  }

  // Safety fallback if we hit max iterations
  const fallback = 'I gathered all the information. Please ask me to summarize it.';
  history = [...history, { role: 'assistant', content: fallback }];
  await saveMessages(conversation.id, history, userMessage, actionsTaken);
  return {
    type: 'text',
    content: fallback,
    conversationId: conversation.id,
  };
}

// Execute confirmed actions
async function executeConfirmedActions(userId, conversation, history, actionsTaken, actions) {
  const results = [];

  for (const action of actions) {
    try {
      const result = await executeConfirmedWriteAction(userId, action.tool, action.args);
      results.push({ tool: action.tool, success: true, result, tool_call_id: action.tool_call_id });
      actionsTaken.push({
        tool: action.tool,
        args: action.args,
        result,
        timestamp: new Date().toISOString(),
        status: 'confirmed_executed',
      });
    } catch (err) {
      results.push({ tool: action.tool, success: false, error: err.message, tool_call_id: action.tool_call_id });
    }
  }

  // Build tool result messages to satisfy OpenAI's requirement
  const toolResultMessages = results.map(r => ({
    role: 'tool',
    tool_call_id: r.tool_call_id,
    content: JSON.stringify(r.success ? r.result : { error: r.error }),
  }));

  // Get a natural summary from OpenAI using proper history
  const successCount = results.filter(r => r.success).length;
  const quickSummary = `✅ Done — ${successCount} of ${results.length} action${results.length > 1 ? 's' : ''} completed successfully.`;

  // Add tool results + summary to history so future messages have clean context
  const assistantMessage = { role: 'assistant', content: quickSummary };
  const finalHistory = [
    ...history,
    ...toolResultMessages,
    assistantMessage,
  ];

  await saveMessages(conversation.id, finalHistory, quickSummary, actionsTaken);

  return {
    type: 'text',
    content: quickSummary,
    results,
    conversationId: conversation.id,
  };
}

// Execute write actions that required confirmation
async function executeConfirmedActions(userId, conversation, history, actionsTaken, actions) {
  console.log('executeConfirmedActions called with actions:', JSON.stringify(actions)); // ← add here
  const axios = require('axios');
  const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';

  // Get a system token for internal API calls
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: userId, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '5m' });
  const headers = { Authorization: `Bearer ${token}` };

  switch (toolName) {
    case 'send_email': {
      console.log('Chappie send_email args:', JSON.stringify(args));
      await axios.post(`${API_BASE}/emails/send`, {
        company_id: args.company_id || null,
        client_id: args.client_id || null,
        person_id: args.person_id || null,
        subject: args.subject,
        body_html: `<p>${args.body.replace(/\n/g, '<br>')}</p>`,
        recipient_email: args.recipient_email,
        recipient_name: args.recipient_name,
        thread_id: args.thread_id || null,
      }, { headers });
      return { sent: true, to: args.recipient_email };
    }

    case 'book_meeting': {
      const start_time = new Date(`${args.date}T${String(args.start_hour).padStart(2,'0')}:${String(args.start_min || 0).padStart(2,'0')}:00`).toISOString();
      const end_time = new Date(`${args.date}T${String(args.end_hour).padStart(2,'0')}:${String(args.end_min || 0).padStart(2,'0')}:00`).toISOString();
      const res = await axios.post(`${API_BASE}/calendar/meetings`, {
        title: args.title,
        meeting_type: args.meeting_type || 'google_meet',
        start_time,
        end_time,
        company_id: args.company_id || null,
        client_id: args.client_id || null,
        person_id: args.person_id || null,
        attendee_emails: args.attendee_email ? [args.attendee_email] : [],
      }, { headers });
      return { booked: true, meeting: res.data };
    }

    case 'cancel_meeting': {
      await axios.delete(`${API_BASE}/calendar/meetings/${args.meeting_id}`, { headers });
      return { cancelled: true, meeting_id: args.meeting_id };
    }

    case 'reschedule_meeting': {
      const start_time = new Date(`${args.date}T${String(args.start_hour).padStart(2,'0')}:${String(args.start_min || 0).padStart(2,'0')}:00`).toISOString();
      const end_time = new Date(`${args.date}T${String(args.end_hour).padStart(2,'0')}:${String(args.end_min || 0).padStart(2,'0')}:00`).toISOString();
      await axios.put(`${API_BASE}/calendar/meetings/${args.meeting_id}/reschedule`, { start_time, end_time }, { headers });
      return { rescheduled: true, meeting_id: args.meeting_id };
    }

    default:
      throw new Error(`Unknown confirmation tool: ${toolName}`);
  }
}

module.exports = { chat };