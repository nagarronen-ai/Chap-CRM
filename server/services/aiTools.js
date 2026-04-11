const supabase = require('../db');

const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'search_contacts',
      description: 'Search for a company, client, or contact person by name or email. After finding results, extract person_id, company_id, client_id — pass these to all subsequent tools.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Name or email to search — full name like "Dan Sitbon", company name, role, or email' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_company_people',
      description: 'Get all people at a company with their names, emails, and titles. Use this before sending to all contacts or when user asks about company team members.',
      parameters: {
        type: 'object',
        properties: {
          company_id: { type: 'string', description: 'Company UUID' },
        },
        required: ['company_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pipeline_summary',
      description: 'Get a summary of the sales pipeline — stages, counts, and recent activity',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_marketing_history',
      description: 'Get marketing campaign emails sent to a company or client contacts',
      parameters: {
        type: 'object',
        properties: {
          company_id: { type: 'string', description: 'Company UUID' },
        },
        required: ['company_id'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_all_campaigns',
      description: 'Get a list of all marketing campaigns with their stats — sent count, open rate, click rate, status. Use when user asks for a campaign overview or review of all campaigns.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },

  {
    type: 'function',
    function: {
      name: 'search_conversation_history',
      description: 'Search past Chappie conversations by date or topic keyword. Use when user references a past conversation — e.g. "last Thursday we spoke about X", "what did we discuss about QualifAI last week", "find our conversation about the Houston campaign".',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Topic or keyword to search for in past conversations' },
          date_hint: { type: 'string', description: 'Date reference like "last Thursday", "last week", "April 1", "yesterday". Optional.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_waitlist_stats',
      description: 'Get Planfor couples waitlist stats — total subscribers, consented, joined this week, joined today',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_waitlist_list',
      description: 'Get the list of couples on the Planfor waitlist — name, email, consent status, date joined',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max number of subscribers to return. Default 20.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_campaign_stats',
      description: 'Get full stats for a marketing campaign by name — opens, clicks, bounces, unsubscribes, and recipient list',
      parameters: {
        type: 'object',
        properties: {
          campaign_name: { type: 'string', description: 'Campaign name to search for' },
        },
        required: ['campaign_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_memory',
      description: 'Semantic search over all CRM history — emails, notes, meetings, thoughts, sent emails. Use when the user asks about past interactions, what was discussed, what happened with a contact, or anything that requires searching historical context. Examples: "what did QualifAI say about pricing?", "did we ever discuss partnerships?", "what were my thoughts on the Houston campaign?"',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Natural language search query' },
          source: { type: 'string', description: 'Optional — filter by source: crm_synced_emails, crm_activity, crm_thoughts, crm_emails_sent, crm_meetings', },
        },
        required: ['query'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_stale_leads',
      description: 'Get contacts/companies with no activity in the last X days',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Number of days of inactivity. Default 7.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_meetings',
      description: 'Get upcoming and recent meetings',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['today', 'tomorrow', 'this_week', 'next_week', 'recent'] },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_company_brief',
      description: 'Get full details about a specific company including people, stage, last activity',
      parameters: {
        type: 'object',
        properties: {
          company_id: { type: 'string', description: 'The company UUID' },
        },
        required: ['company_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_client_status',
      description: 'Get full details about a specific client including stage, contract, finance',
      parameters: {
        type: 'object',
        properties: {
          client_id: { type: 'string', description: 'The client UUID' },
        },
        required: ['client_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_finance_summary',
      description: 'Get finance summary — total earned, pending, this month, this year',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_last_thread',
      description: 'Get the most recent email thread with a specific person or company — returns gmail_thread_id for replying',
      parameters: {
        type: 'object',
        properties: {
          person_id: { type: 'string', description: 'Person UUID' },
          company_id: { type: 'string', description: 'Company UUID' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_email_thread',
      description: 'Get the actual content of an email thread — use when user asks what someone said, what was the reply, or wants to read email content',
      parameters: {
        type: 'object',
        properties: {
          thread_id: { type: 'string', description: 'Gmail thread ID' },
          company_id: { type: 'string', description: 'Company UUID to find thread if no thread_id' },
          person_id: { type: 'string', description: 'Person UUID to find thread if no thread_id' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_note',
      description: 'Add a note to a company or client. If the entity is a converted client, always pass entity_type: company and the company UUID — the system will automatically log it to the client record too.',
      parameters: {
        type: 'object',
        properties: {
          entity_type: { type: 'string', enum: ['company', 'client'] },
          entity_id: { type: 'string', description: 'The company or client UUID — prefer company UUID for converted clients' },
          note: { type: 'string', description: 'The note text' },
        },
        required: ['entity_type', 'entity_id', 'note'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_pipeline_stage',
      description: 'Move a company to a different pipeline stage',
      parameters: {
        type: 'object',
        properties: {
          company_id: { type: 'string' },
          stage: { type: 'string', enum: ['New', 'Contacted', 'No Reply', 'Follow-up', 'Meeting Scheduled', 'Proposal Offered', 'Agreement Sent', 'Closed Won', 'Closed Lost', 'Not Interested'] },
        },
        required: ['company_id', 'stage'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_client_stage',
      description: 'Move a client to a different stage',
      parameters: {
        type: 'object',
        properties: {
          client_id: { type: 'string' },
          stage: { type: 'string', enum: ['Onboarding', 'Active', 'Paused', 'Churned'] },
        },
        required: ['client_id', 'stage'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_next_action',
      description: 'Set the next action reminder on a company',
      parameters: {
        type: 'object',
        properties: {
          company_id: { type: 'string' },
          next_action: { type: 'string' },
        },
        required: ['company_id', 'next_action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'Send a single email to one person — REQUIRES USER CONFIRMATION. ALWAYS include person_id (from people array in search_contacts), company_id, and real UUIDs. Never omit person_id when you found the person via search_contacts.',      parameters: {
        type: 'object',
        properties: {
          recipient_email: { type: 'string' },
          recipient_name: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string' },
          company_id: { type: 'string', description: 'Company UUID — must be real UUID from search_contacts' },
          client_id: { type: 'string', description: 'Client UUID — must be real UUID from search_contacts' },
          person_id: { type: 'string', description: 'Person UUID — must be real UUID from search_contacts' },
          thread_id: { type: 'string', description: 'Gmail thread ID for replies — get from get_last_thread' },
          cc: { type: 'array', items: { type: 'string' }, description: 'Array of CC email addresses' },
        },
        required: ['recipient_email', 'recipient_name', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_bulk_email',
      description: 'Send the same email to multiple people at a company — REQUIRES USER CONFIRMATION. Use when user says "send to all contacts" or "send to the whole team".',
      parameters: {
        type: 'object',
        properties: {
          recipients: {
            type: 'array',
            description: 'List of recipients',
            items: {
              type: 'object',
              properties: {
                email: { type: 'string' },
                name: { type: 'string' },
                person_id: { type: 'string' },
              },
            },
          },
          company_id: { type: 'string', description: 'Company UUID' },
          subject: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['recipients', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pending_proposals',
      description: 'Get pending meeting proposals that have been sent but not yet accepted or declined. Use when user asks about outstanding proposals or who has not replied to a meeting request.',
      parameters: {
        type: 'object',
        properties: {
          company_id: { type: 'string', description: 'Filter by company UUID (optional)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_meeting',
      description: 'Send an email proposing a meeting time AND store the proposal for tracking. Use this when user says "propose a meeting", "propose meeting", "suggest a time", "send a meeting proposal", or any variation of suggesting a meeting to someone who has not yet confirmed. REQUIRES USER CONFIRMATION. This sends an email — it does NOT create a calendar invite.',
      parameters: {
        type: 'object',
        properties: {
          recipient_email: { type: 'string' },
          recipient_name: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string', description: 'Email body — must include the proposed date and time clearly' },
          company_id: { type: 'string', description: 'Company UUID from search_contacts' },
          client_id: { type: 'string', description: 'Client UUID from search_contacts' },
          person_id: { type: 'string', description: 'Person UUID from search_contacts' },
          thread_id: { type: 'string', description: 'Gmail thread ID if replying to existing thread' },
          cc: { type: 'array', items: { type: 'string' } },
          proposed_date: { type: 'string', description: 'YYYY-MM-DD of the proposed meeting' },
          proposed_start_hour: { type: 'number', description: 'Proposed start hour (24h, in YOUR timezone)' },
          proposed_start_min: { type: 'number', description: 'Proposed start minute' },
          proposed_end_hour: { type: 'number', description: 'Proposed end hour (24h, in YOUR timezone)' },
          proposed_end_min: { type: 'number', description: 'Proposed end minute' },
        },
        required: ['recipient_email', 'recipient_name', 'subject', 'body', 'proposed_date', 'proposed_start_hour', 'proposed_start_min', 'proposed_end_hour', 'proposed_end_min'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_meeting',
      description: 'Book a meeting and send a Google Calendar invite — REQUIRES USER CONFIRMATION. Use ONLY when the contact has already agreed to meet. Do NOT use when the user says "propose", "suggest a meeting", or "propose a meeting" — use propose_meeting instead.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          company_id: { type: 'string' },
          client_id: { type: 'string' },
          person_id: { type: 'string' },
          attendee_email: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          start_hour: { type: 'number' },
          start_min: { type: 'number' },
          end_hour: { type: 'number' },
          end_min: { type: 'number' },
          meeting_type: { type: 'string', enum: ['google_meet', 'phone'] },
        },
        required: ['title', 'date', 'start_hour', 'start_min', 'end_hour', 'end_min'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_meeting',
      description: 'Cancel a meeting — REQUIRES USER CONFIRMATION',
      parameters: {
        type: 'object',
        properties: {
          meeting_id: { type: 'string' },
        },
        required: ['meeting_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reschedule_meeting',
      description: 'Reschedule a meeting — REQUIRES USER CONFIRMATION',
      parameters: {
        type: 'object',
        properties: {
          meeting_id: { type: 'string' },
          date: { type: 'string' },
          start_hour: { type: 'number' },
          start_min: { type: 'number' },
          end_hour: { type: 'number' },
          end_min: { type: 'number' },
        },
        required: ['meeting_id', 'date', 'start_hour', 'start_min', 'end_hour', 'end_min'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_calendar_conflicts',
      description: 'Check if there are any calendar conflicts for a proposed meeting time. ALWAYS call this before book_meeting or reschedule_meeting. Returns any overlapping events and suggests the next available slot of the same duration.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          start_hour: { type: 'number', description: 'Proposed start hour (24h)' },
          start_min: { type: 'number', description: 'Proposed start minute' },
          end_hour: { type: 'number', description: 'Proposed end hour (24h)' },
          end_min: { type: 'number', description: 'Proposed end minute' },
        },
        required: ['date', 'start_hour', 'start_min', 'end_hour', 'end_min'],
      },
    },
  },
];

const CONFIRMATION_REQUIRED = ['send_email', 'send_bulk_email', 'propose_meeting', 'book_meeting', 'cancel_meeting', 'reschedule_meeting'];

async function executeTool(toolName, args, userId) {
  switch (toolName) {
    case 'get_pipeline_summary': return await getPipelineSummary(userId);
    case 'get_stale_leads': return await getStaleLeads(userId, args.days || 7);
    case 'get_my_meetings': return await getMyMeetings(userId, args.period || 'this_week');
    case 'search_contacts': return await searchContacts(userId, args.query);
    case 'get_company_people': return await getCompanyPeople(userId, args.company_id);
    case 'get_company_brief': return await getCompanyBrief(userId, args.company_id);
    case 'get_client_status': return await getClientStatus(userId, args.client_id);
    case 'get_finance_summary': return await getFinanceSummary(userId);
    case 'get_last_thread': return await getLastThread(userId, args.person_id, args.company_id);
    case 'get_email_thread': return await getEmailThread(userId, args.thread_id, args.company_id, args.person_id);
    case 'get_all_campaigns': return await getAllCampaigns();
    case 'get_waitlist_stats': return await getWaitlistStats();
    case 'get_waitlist_list': return await getWaitlistList(args.limit || 20);
    case 'search_memory': return await searchMemory(args.query, args.source);
    case 'get_campaign_stats': return await getCampaignStats(userId, args.campaign_name);
    case 'add_note': return await addNote(userId, args.entity_type, args.entity_id, args.note);
    case 'update_pipeline_stage': return await updatePipelineStage(userId, args.company_id, args.stage);
    case 'update_client_stage': return await updateClientStage(userId, args.client_id, args.stage);
    case 'update_next_action': return await updateNextAction(userId, args.company_id, args.next_action);
    case 'get_marketing_history': return await getMarketingHistory(userId, args.company_id);
    case 'check_calendar_conflicts': return await checkCalendarConflicts(userId, args.date, args.start_hour, args.start_min, args.end_hour, args.end_min);
    case 'get_pending_proposals': return await getPendingProposals(userId, args.company_id);
    default: return { error: `Unknown tool: ${toolName}` };
  }
}

async function getPipelineSummary(userId) {
  const { data } = await supabase.from('crm_companies').select('stage, created_at').order('created_at', { ascending: false });
  const stages = {};
  (data || []).forEach(c => { stages[c.stage] = (stages[c.stage] || 0) + 1; });
  return { total: data?.length || 0, by_stage: stages };
}

async function getStaleLeads(userId, days) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('crm_companies')
    .select('id, company_name, stage, last_activity_at')
    .lt('last_activity_at', cutoff)
    .not('stage', 'in', '("Closed Won","Closed Lost","Not Interested","Converted")')
    .order('last_activity_at', { ascending: true })
    .limit(20);
  return { stale_leads: data || [], days_threshold: days };
}

async function getMarketingHistory(userId, companyId) {
  const { data } = await supabase
    .from('crm_campaign_recipients')
    .select('status, opened_at, clicked_at, email, crm_campaigns(name, sent_at), crm_people(first_name, last_name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(20);
  return { campaigns: data || [], total: data?.length || 0 };
}

async function getAllCampaigns() {
  const { data: campaigns } = await supabase
    .from('crm_campaigns')
    .select('id, name, subject, status, sent_at, from_email')
    .order('created_at', { ascending: false });

  if (!campaigns || campaigns.length === 0) return { total: 0, campaigns: [] };

  const withStats = await Promise.all(campaigns.map(async (c) => {
    const { data: recipients } = await supabase
      .from('crm_campaign_recipients')
      .select('status, opened_at, clicked_at')
      .eq('campaign_id', c.id);

    const sent = recipients?.length || 0;
    const opened = recipients?.filter(r => r.opened_at || ['opened','clicked'].includes(r.status)).length || 0;
    const clicked = recipients?.filter(r => r.clicked_at || r.status === 'clicked').length || 0;
    const bounced = recipients?.filter(r => r.status === 'bounced').length || 0;

    return {
      name: c.name,
      subject: c.subject,
      status: c.status,
      sent_at: c.sent_at ? new Date(c.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not sent',
      sent,
      opened,
      clicked,
      bounced,
      open_rate: sent > 0 ? `${Math.round((opened / sent) * 100)}%` : '0%',
      click_rate: sent > 0 ? `${Math.round((clicked / sent) * 100)}%` : '0%',
    };
  }));

  return { total: campaigns.length, campaigns: withStats };
}

async function searchConversationHistory(userId, query, dateHint) {
  // Resolve date hint to a date range
  let dateFrom = null;
  if (dateHint) {
    const now = new Date();
    const hint = dateHint.toLowerCase();

    if (hint.includes('yesterday')) {
      dateFrom = new Date(now);
      dateFrom.setDate(now.getDate() - 1);
      dateFrom.setHours(0, 0, 0, 0);
    } else if (hint.includes('last week')) {
      dateFrom = new Date(now);
      dateFrom.setDate(now.getDate() - 7);
    } else if (hint.includes('last thursday') || hint.includes('thursday')) {
      dateFrom = new Date(now);
      const day = now.getDay();
      const diff = (day >= 4) ? (day - 4) : (day + 3);
      dateFrom.setDate(now.getDate() - diff - (day >= 4 ? 0 : 7));
      dateFrom.setHours(0, 0, 0, 0);
    } else if (hint.includes('last monday') || hint.includes('monday')) {
      dateFrom = new Date(now);
      const day = now.getDay();
      const diff = (day >= 1) ? (day - 1) : 6;
      dateFrom.setDate(now.getDate() - diff - (day >= 1 ? 0 : 7));
      dateFrom.setHours(0, 0, 0, 0);
    } else if (hint.includes('last month')) {
      dateFrom = new Date(now);
      dateFrom.setMonth(now.getMonth() - 1);
    } else {
      // Try to parse as a date
      const parsed = new Date(dateHint);
      if (!isNaN(parsed)) dateFrom = parsed;
    }
  }

  // Fetch conversations
  let queryBuilder = supabase
    .from('crm_ai_conversations')
    .select('id, messages, last_message, actions_taken, updated_at, created_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (dateFrom) {
    queryBuilder = queryBuilder.gte('updated_at', dateFrom.toISOString());
  }

  const { data: conversations } = await queryBuilder;

  if (!conversations || conversations.length === 0) {
    return { found: false, message: 'No past conversations found for that time period.' };
  }

  // Search messages for the query keyword
  const queryLower = query.toLowerCase();
  const matches = [];

  for (const conv of conversations) {
    const messages = conv.messages || [];
    const matchingMessages = messages.filter(m =>
      typeof m.content === 'string' &&
      m.content.toLowerCase().includes(queryLower)
    );

    if (matchingMessages.length > 0 || (conv.last_message || '').toLowerCase().includes(queryLower)) {
      // Get a relevant excerpt
      const relevantMsg = matchingMessages[0] || messages[messages.length - 1];
      matches.push({
        date: new Date(conv.updated_at).toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
        }),
        excerpt: relevantMsg?.content?.substring(0, 200) || conv.last_message || '',
        actions: (conv.actions_taken || []).map(a => a.tool).filter(Boolean),
        message_count: messages.length,
      });
    }
  }

  if (matches.length === 0) {
    return {
      found: false,
      message: `No conversations found mentioning "${query}"${dateHint ? ` around ${dateHint}` : ''}.`,
    };
  }

  return {
    found: true,
    count: matches.length,
    conversations: matches.slice(0, 5), // Return top 5 matches
  };
}

async function searchMemory(query, source = null) {
  const { searchMemory: ragSearch } = require('./ragSearch');
  try {
    const results = await ragSearch(query, {
      matchThreshold: 0.5,
      matchCount: 8,
      sourceTable: source || null,
    });

    if (!results || results.length === 0) {
      return { found: false, message: 'No relevant memory found for that query.' };
    }

    return {
      found: true,
      count: results.length,
      results: results.map(r => ({
        source: r.source,
        text: r.text,
        metadata: r.metadata,
        similarity: r.similarity,
      })),
    };
  } catch (err) {
    console.error('search_memory error:', err.message);
    return { error: err.message };
  }
}

async function getWaitlistStats() {
  const { data } = await supabase
    .from('waitlist_couples')
    .select('id, marketing_consent, created_at');

  const total = data?.length || 0;
  const consented = data?.filter(w => w.marketing_consent).length || 0;
  const thisWeek = data?.filter(w => new Date(w.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length || 0;
  const today = data?.filter(w => new Date(w.created_at).toDateString() === new Date().toDateString()).length || 0;

  return { total, consented, this_week: thisWeek, today };
}

async function getWaitlistList(limit = 20) {
  const { data } = await supabase
    .from('waitlist_couples')
    .select('name, email, marketing_consent, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  return {
    count: data?.length || 0,
    subscribers: (data || []).map(w => ({
      name: w.name || 'No name',
      email: w.email,
      consented: w.marketing_consent,
      joined: new Date(w.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    })),
  };
}

async function getCampaignStats(userId, campaignName) {
  const { data: campaigns } = await supabase
    .from('crm_campaigns')
    .select('id, name, subject, status, sent_at, recipients_count')
    .ilike('name', `%${campaignName}%`)
    .limit(3);

  if (!campaigns || campaigns.length === 0) {
    return { error: `No campaign found matching "${campaignName}"` };
  }

  const campaign = campaigns[0];

  const { data: recipients } = await supabase
    .from('crm_campaign_recipients')
    .select('email, status, opened_at, clicked_at, bounced_at, unsubscribed_at, crm_people(first_name, last_name)')
    .eq('campaign_id', campaign.id);

  const total = recipients?.length || 0;
  const opened = recipients?.filter(r => r.opened_at).length || 0;
  const clicked = recipients?.filter(r => r.clicked_at).length || 0;
  const bounced = recipients?.filter(r => r.bounced_at).length || 0;
  const unsubscribed = recipients?.filter(r => r.unsubscribed_at).length || 0;

  return {
    campaign: {
      name: campaign.name,
      subject: campaign.subject,
      status: campaign.status,
      sent_at: campaign.sent_at,
    },
    stats: {
      total,
      opened,
      clicked,
      bounced,
      unsubscribed,
      open_rate: total > 0 ? `${Math.round((opened / total) * 100)}%` : '0%',
      click_rate: total > 0 ? `${Math.round((clicked / total) * 100)}%` : '0%',
    },
    recipients: (recipients || []).map(r => ({
      name: r.crm_people ? `${r.crm_people.first_name} ${r.crm_people.last_name}` : r.email,
      email: r.email,
      opened: !!r.opened_at,
      clicked: !!r.clicked_at,
      bounced: !!r.bounced_at,
    })),
  };
}

async function getMyMeetings(userId, period) {
  const now = new Date();
  let start, end;
  if (period === 'today') { start = new Date(now); start.setHours(0,0,0,0); end = new Date(now); end.setHours(23,59,59,999); }
  else if (period === 'tomorrow') { start = new Date(now); start.setDate(start.getDate() + 1); start.setHours(0,0,0,0); end = new Date(start); end.setHours(23,59,59,999); }
  else if (period === 'this_week') { start = new Date(now); end = new Date(now); end.setDate(end.getDate() + 7); }
  else if (period === 'next_week') { start = new Date(now); start.setDate(start.getDate() + 7); end = new Date(start); end.setDate(end.getDate() + 7); }
  else { start = new Date(now); start.setDate(start.getDate() - 7); end = new Date(now); }

  const { data } = await supabase
    .from('crm_meetings')
    .select('*, crm_companies(company_name), crm_clients(business_name), crm_people(first_name, last_name, email)')
    .eq('created_by', userId)
    .gte('start_time', start.toISOString())
    .lte('start_time', end.toISOString())
    .order('start_time', { ascending: true });
  return { meetings: data || [], period };
}

async function searchContacts(userId, query) {
  const parts = query.trim().split(' ');
  const firstName = parts[0] || '';
  const lastName = parts[parts.length - 1] || '';

  const [companies, clients, people] = await Promise.all([
    supabase.from('crm_companies').select('id, company_name, stage, city, state').ilike('company_name', `%${query}%`).limit(5),
    supabase.from('crm_clients').select('id, business_name, stage, contact_email, contact_first_name, contact_last_name, converted_from')
      .or(`business_name.ilike.%${query}%,contact_first_name.ilike.%${firstName}%,contact_last_name.ilike.%${lastName}%`).limit(5),
    supabase.from('crm_people').select('id, first_name, last_name, email, title, company_id, crm_companies(id, company_name, stage, city, state)')
      .or(`first_name.ilike.%${firstName}%,last_name.ilike.%${lastName}%,email.ilike.%${query}%`).limit(5),
  ]);

  const peopleCompanies = (people.data || []).filter(p => p.crm_companies).map(p => p.crm_companies);
  const allCompanies = [...(companies.data || []), ...peopleCompanies];
  const uniqueCompanies = allCompanies.filter((c, index, self) => index === self.findIndex(x => x.id === c.id));

  return {
    companies: uniqueCompanies,
    clients: clients.data || [],
    people: (people.data || []).map(p => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      title: p.title,
      person_id: p.id,
      company_id: p.company_id, // This is the real crm_companies UUID
      company_name: p.crm_companies?.company_name || null,
    })),
  };
}

async function getCompanyPeople(userId, companyId) {
  const { data } = await supabase
    .from('crm_people')
    .select('id, first_name, last_name, email, title, work_phone, mobile_phone')
    .eq('company_id', companyId)
    .not('email', 'is', null);
  return { people: data || [], total: data?.length || 0 };
}

async function getCompanyBrief(userId, companyId) {
  const { data } = await supabase
    .from('crm_companies')
    .select('*, crm_people(first_name, last_name, email, title), crm_users(name)')
    .eq('id', companyId)
    .single();

  const { data: recentActivity } = await supabase
    .from('crm_activity_log')
    .select('action, details, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(5);

  return { company: data, recent_activity: recentActivity || [] };
}

async function getClientStatus(userId, clientId) {
  const { data } = await supabase.from('crm_clients').select('*').eq('id', clientId).single();
  const { data: finance } = await supabase.from('crm_client_finance').select('type, amount, status').eq('client_id', clientId).limit(10);

  let people = [];
  if (data?.converted_from) {
    const { data: company } = await supabase
      .from('crm_companies')
      .select('crm_people(id, first_name, last_name, email, title, work_phone, mobile_phone)')
      .eq('id', data.converted_from)
      .single();
    people = company?.crm_people || [];
  }

  return {
    client: data,
    finance: finance || [],
    people: people.map(p => ({
      name: `${p.first_name} ${p.last_name}`,
      title: p.title || 'No title',
      email: p.email,
      work_phone: p.work_phone,
      mobile_phone: p.mobile_phone,
    })),
  };
}

async function getFinanceSummary(userId) {
  const { data } = await supabase.from('crm_client_finance').select('amount, status, type, date');
  const now = new Date();
  const thisMonth = data?.filter(f => new Date(f.date).getMonth() === now.getMonth()) || [];
  const thisYear = data?.filter(f => new Date(f.date).getFullYear() === now.getFullYear()) || [];
  const pending = data?.filter(f => f.status === 'Pending') || [];
  const sum = arr => arr.reduce((acc, f) => acc + (parseFloat(f.amount) || 0), 0);
  return { total: sum(data || []), this_month: sum(thisMonth), this_year: sum(thisYear), pending: sum(pending) };
}

async function getLastThread(userId, personId, companyId) {
  // Resolve company_id from person if needed
  let resolvedCompanyId = companyId;
  if (!resolvedCompanyId && personId) {
    const { data: person } = await supabase
      .from('crm_people')
      .select('company_id')
      .eq('id', personId)
      .single();
    if (person) resolvedCompanyId = person.company_id;
  }

  // Check sent emails
  let sentQuery = supabase
    .from('crm_emails_sent')
    .select('gmail_thread_id, subject, sent_at')
    .not('gmail_thread_id', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(5);

  if (personId) sentQuery = sentQuery.eq('person_id', personId);
  else if (resolvedCompanyId) sentQuery = sentQuery.eq('company_id', resolvedCompanyId);

  const { data: sent } = await sentQuery;

  // Check synced emails (inbound)
  let syncQuery = supabase
    .from('crm_synced_emails')
    .select('gmail_thread_id, subject, email_date, from_email')
    .not('gmail_thread_id', 'is', null)
    .order('email_date', { ascending: false })
    .limit(5);

  if (resolvedCompanyId) syncQuery = syncQuery.eq('company_id', resolvedCompanyId);

  const { data: synced } = await syncQuery;

  const allThreads = [
    ...(sent || []).map(t => ({ ...t, date: new Date(t.sent_at), source: 'sent' })),
    ...(synced || []).map(t => ({ ...t, date: new Date(t.email_date), source: 'received' })),
  ].filter(t => t.gmail_thread_id);

  if (allThreads.length === 0) return { thread_id: null, message: 'No previous email thread found' };

  allThreads.sort((a, b) => b.date - a.date);
  const latest = allThreads[0];

  return {
    thread_id: latest.gmail_thread_id,
    subject: latest.subject,
    source: latest.source,
    message: `Found thread: "${latest.subject}"`,
  };
}

async function getEmailThread(userId, threadId, companyId, personId) {
  // Resolve company_id from person if needed
  let resolvedCompanyId = companyId;
  if (!resolvedCompanyId && personId) {
    const { data: person } = await supabase
      .from('crm_people')
      .select('company_id')
      .eq('id', personId)
      .single();
    if (person) resolvedCompanyId = person.company_id;
  }

  let received = [];

  if (threadId) {
    const { data: byThread } = await supabase
      .from('crm_synced_emails')
      .select('subject, from_email, body_html, email_date')
      .eq('gmail_thread_id', threadId)
      .order('email_date', { ascending: false })
      .limit(10);
    received = byThread || [];
  }

  // If no results by thread_id, fall back to company_id
  if (received.length === 0 && resolvedCompanyId) {
    const { data: byCompany } = await supabase
      .from('crm_synced_emails')
      .select('subject, from_email, body_html, email_date')
      .eq('company_id', resolvedCompanyId)
      .order('email_date', { ascending: false })
      .limit(10);
    received = byCompany || [];
  }

  let sentQuery = supabase
    .from('crm_emails_sent')
    .select('subject, body_html, sent_at')
    .order('sent_at', { ascending: false })
    .limit(10);

  if (threadId) sentQuery = sentQuery.eq('gmail_thread_id', threadId);
  else if (personId) sentQuery = sentQuery.eq('person_id', personId);
  else if (resolvedCompanyId) sentQuery = sentQuery.eq('company_id', resolvedCompanyId);

  const { data: sent } = await sentQuery;

  return {
    received_messages: received.map(m => ({
      from: m.from_email,
      subject: m.subject,
      date: m.email_date,
      body: m.body_html?.replace(/<[^>]*>/g, '').slice(0, 800) || '',
    })),
    sent_messages: (sent || []).map(m => ({
      subject: m.subject,
      date: m.sent_at,
      body: m.body_html?.replace(/<[^>]*>/g, '').slice(0, 800) || '',
    })),
  };
}

async function addNote(userId, entityType, entityId, note) {
  const insert = { user_id: userId, action: 'Note Added', details: note, created_at: new Date().toISOString() };
  
  if (entityType === 'company') {
    insert.company_id = entityId;
    // If company has been converted to a client, also log to client
    const { data: client } = await supabase
      .from('crm_clients')
      .select('id')
      .eq('converted_from', entityId)
      .single();
    if (client) {
      insert.client_id = client.id;
    }
  }
  
  if (entityType === 'client') insert.client_id = entityId;
  
  await supabase.from('crm_activity_log').insert([insert]);
  return { success: true, message: `Note added to ${entityType}` };
}

async function updatePipelineStage(userId, companyId, stage) {
  await supabase.from('crm_companies').update({ stage, updated_at: new Date().toISOString() }).eq('id', companyId);
  await supabase.from('crm_activity_log').insert([{ company_id: companyId, user_id: userId, action: 'Stage Updated', details: `Stage moved to "${stage}" by AI Assistant` }]);
  return { success: true, message: `Company moved to ${stage}` };
}

async function updateClientStage(userId, clientId, stage) {
  await supabase.from('crm_clients').update({ stage, updated_at: new Date().toISOString() }).eq('id', clientId);
  return { success: true, message: `Client moved to ${stage}` };
}

async function updateNextAction(userId, companyId, nextAction) {
  await supabase.from('crm_companies').update({ next_action: nextAction, updated_at: new Date().toISOString() }).eq('id', companyId);
  return { success: true, message: `Next action set: "${nextAction}"` };
}

// ─── GET PENDING PROPOSALS ───────────────────────────────────────────────────

async function getPendingProposals(userId, companyId) {
  let query = supabase
    .from('crm_meeting_proposals')
    .select('*, crm_people(first_name, last_name, email), crm_companies(company_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10);

  if (companyId) query = query.eq('company_id', companyId);

  const { data, error } = await query;
  if (error) return { error: error.message };

  return {
    proposals: (data || []).map(p => ({
      id: p.id,
      company_name: p.crm_companies?.company_name,
      contact: p.crm_people ? `${p.crm_people.first_name} ${p.crm_people.last_name}` : null,
      proposed_start: p.proposed_start,
      proposed_end: p.proposed_end,
      gmail_thread_id: p.gmail_thread_id,
      status: p.status,
      created_at: p.created_at,
    })),
    total: data?.length || 0,
  };
}

// ─── CHECK CALENDAR CONFLICTS ────────────────────────────────────────────────

async function checkCalendarConflicts(userId, date, startHour, startMin, endHour, endMin) {
    // uses supabase (already required at top of file) + googleapis


  // Build proposed window
  const proposedStart = new Date(`${date}T${String(startHour).padStart(2,'0')}:${String(startMin || 0).padStart(2,'0')}:00`);
  const proposedEnd   = new Date(`${date}T${String(endHour).padStart(2,'0')}:${String(endMin || 0).padStart(2,'0')}:00`);
  const durationMs    = proposedEnd - proposedStart;

  // Fetch window: full day of the proposed date to catch all same-day events
  const windowStart = new Date(`${date}T00:00:00`).toISOString();
  const windowEnd   = new Date(`${date}T23:59:59`).toISOString();

  // Get Google account for this user
  const { data: account } = await supabase
    .from('crm_google_accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('account_type', 'personal')
    .eq('is_active', true)
    .single();

  if (!account) {
    return { conflict: false, message: 'No Google Calendar connected — cannot check conflicts.' };
  }

  // Get authenticated calendar client
  const { google } = require('googleapis');
  const googleRouteModule = require('../routes/google');
  const { oauth2Client } = await googleRouteModule.getAuthenticatedClient(account.id);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Fetch events for that day
  const { data: gcalData } = await calendar.events.list({
    calendarId: 'primary',
    timeMin: windowStart,
    timeMax: windowEnd,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 50,
  });

  const events = (gcalData.items || []).filter(e => e.status !== 'cancelled');

  // Find overlapping events
  const conflicts = events.filter(e => {
    const eStart = new Date(e.start?.dateTime || e.start?.date);
    const eEnd   = new Date(e.end?.dateTime   || e.end?.date);
    // Overlap: proposed starts before event ends AND proposed ends after event starts
    return proposedStart < eEnd && proposedEnd > eStart;
  });

  if (conflicts.length === 0) {
    return {
      conflict: false,
      proposed_start: proposedStart.toISOString(),
      proposed_end: proposedEnd.toISOString(),
      message: 'No conflicts. Time slot is free.',
    };
  }

  // Format conflict details
  const conflictDetails = conflicts.map(e => {
    const eStart = new Date(e.start?.dateTime || e.start?.date);
    const eEnd   = new Date(e.end?.dateTime   || e.end?.date);
    const attendeeNames = (e.attendees || [])
      .filter(a => !a.self)
      .map(a => a.displayName || a.email)
      .join(', ');
    return {
      title: e.summary || '(No title)',
      start: eStart.toISOString(),
      end: eEnd.toISOString(),
      with: attendeeNames || null,
    };
  });

  // Find next available slot of same duration after all conflicts end
  const allEventsToday = events.map(e => ({
    start: new Date(e.start?.dateTime || e.start?.date),
    end:   new Date(e.end?.dateTime   || e.end?.date),
  })).sort((a, b) => a.start - b.start);

  // Walk forward from the end of the last conflicting event
  const lastConflictEnd = conflicts.reduce((latest, e) => {
    const eEnd = new Date(e.end?.dateTime || e.end?.date);
    return eEnd > latest ? eEnd : latest;
  }, proposedEnd);

  // Round up to next 15-min boundary
  const minutes = lastConflictEnd.getMinutes();
  const roundedMinutes = Math.ceil(minutes / 15) * 15;
  const candidateStart = new Date(lastConflictEnd);
  candidateStart.setMinutes(roundedMinutes, 0, 0);
  if (roundedMinutes === 60) {
    candidateStart.setHours(candidateStart.getHours() + 1);
    candidateStart.setMinutes(0);
  }

  // Check the candidate slot doesn't itself conflict with other events
  let nextStart = candidateStart;
  let attempts = 0;
  while (attempts < 8) {
    const nextEnd = new Date(nextStart.getTime() + durationMs);
    const blocked = allEventsToday.some(e => nextStart < e.end && nextEnd > e.start);
    if (!blocked) break;
    // Push past this blocking event
    const blocker = allEventsToday.find(e => nextStart < e.end && nextEnd > e.start);
    nextStart = new Date(blocker.end);
    const m = nextStart.getMinutes();
    const rm = Math.ceil(m / 15) * 15;
    nextStart.setMinutes(rm === 60 ? 0 : rm, 0, 0);
    if (rm === 60) nextStart.setHours(nextStart.getHours() + 1);
    attempts++;
  }

  const nextEnd = new Date(nextStart.getTime() + durationMs);

  return {
    conflict: true,
    conflicts: conflictDetails,
    suggested_start: nextStart.toISOString(),
    suggested_end: nextEnd.toISOString(),
    suggested_date: date,
    suggested_start_hour: nextStart.getHours(),
    suggested_start_min: nextStart.getMinutes(),
    suggested_end_hour: nextEnd.getHours(),
    suggested_end_min: nextEnd.getMinutes(),
    message: `Conflict detected. ${conflictDetails.length} event(s) overlap with the proposed time. Next available slot starts at ${nextStart.getHours()}:${String(nextStart.getMinutes()).padStart(2,'0')}.`,
  };
}

module.exports = { toolDefinitions, executeTool, CONFIRMATION_REQUIRED };
