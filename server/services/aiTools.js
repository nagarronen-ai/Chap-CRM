const supabase = require('../db');

// ─── TOOL DEFINITIONS (sent to OpenAI) ───────────────────────────────────────

const toolDefinitions = [
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
          period: { type: 'string', enum: ['today', 'tomorrow', 'this_week', 'next_week', 'recent'], description: 'Time period to fetch meetings for' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_contacts',
      description: 'Search for a company or contact person by name',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Name to search for — company name or person name' },
        },
        required: ['query'],
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
      name:'get_client_status',
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
      name: 'add_note',
      description: 'Add a note to a company or client',
      parameters: {
        type: 'object',
        properties: {
          entity_type: { type: 'string', enum: ['company', 'client'], description: 'Whether this is a company or client' },
          entity_id: { type: 'string', description: 'The company or client UUID' },
          note: { type: 'string', description: 'The note text to add' },
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
          company_id: { type: 'string', description: 'The company UUID' },
          stage: { type: 'string', description: 'New stage name', enum: ['New', 'Contacted', 'No Reply', 'Follow-up', 'Meeting Scheduled', 'Proposal Offered', 'Agreement Sent', 'Closed Won', 'Closed Lost', 'Not Interested'] },
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
          client_id: { type: 'string', description: 'The client UUID' },
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
          company_id: { type: 'string', description: 'The company UUID' },
          next_action: { type: 'string', description: 'The next action text' },
        },
        required: ['company_id', 'next_action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'Send an email to a contact or client — REQUIRES USER CONFIRMATION',
      parameters: {
        type: 'object',
        properties: {
          recipient_email: { type: 'string', description: 'Email address of recipient' },
          recipient_name: { type: 'string', description: 'Name of recipient' },
          subject: { type: 'string', description: 'Email subject' },
          body: { type: 'string', description: 'Email body in plain text' },
          company_id: { type: 'string', description: 'Company UUID if sending to a contact' },
          client_id: { type: 'string', description: 'Client UUID if sending to a client' },
        },
        required: ['recipient_email', 'recipient_name', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_meeting',
      description: 'Book a meeting and send a Google Calendar invite — REQUIRES USER CONFIRMATION',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Meeting title' },
          company_id: { type: 'string', description: 'Company UUID' },
          client_id: { type: 'string', description: 'Client UUID' },
          person_id: { type: 'string', description: 'Person UUID to invite' },
          attendee_email: { type: 'string', description: 'Email of person to invite' },
          date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
          start_hour: { type: 'number', description: 'Start hour in 24h format' },
          start_min: { type: 'number', description: 'Start minute' },
          end_hour: { type: 'number', description: 'End hour in 24h format' },
          end_min: { type: 'number', description: 'End minute' },
          meeting_type: { type: 'string', enum: ['google_meet', 'phone'], description: 'Type of meeting' },
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
          meeting_id: { type: 'string', description: 'The meeting UUID' },
        },
        required: ['meeting_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reschedule_meeting',
      description: 'Reschedule a meeting to a new date/time — REQUIRES USER CONFIRMATION',
      parameters: {
        type: 'object',
        properties: {
          meeting_id: { type: 'string', description: 'The meeting UUID' },
          date: { type: 'string', description: 'New date in YYYY-MM-DD format' },
          start_hour: { type: 'number', description: 'New start hour in 24h format' },
          start_min: { type: 'number', description: 'New start minute' },
          end_hour: { type: 'number', description: 'New end hour in 24h format' },
          end_min: { type: 'number', description: 'New end minute' },
        },
        required: ['meeting_id', 'date', 'start_hour', 'start_min', 'end_hour', 'end_min'],
      },
    },
  },
];

// ─── TOOL EXECUTORS (read tools only — write tools go through confirmation) ──

const CONFIRMATION_REQUIRED = ['send_email', 'book_meeting', 'cancel_meeting', 'reschedule_meeting'];

async function executeTool(toolName, args, userId) {
  switch (toolName) {
    case 'get_pipeline_summary': return await getPipelineSummary(userId);
    case 'get_stale_leads': return await getStaleLeads(userId, args.days || 7);
    case 'get_my_meetings': return await getMyMeetings(userId, args.period || 'this_week');
    case 'search_contacts': return await searchContacts(userId, args.query);
    case 'get_company_brief': return await getCompanyBrief(userId, args.company_id);
    case 'get_client_status': return await getClientStatus(userId, args.client_id);
    case 'get_finance_summary': return await getFinanceSummary(userId);
    case 'add_note': return await addNote(userId, args.entity_type, args.entity_id, args.note);
    case 'update_pipeline_stage': return await updatePipelineStage(userId, args.company_id, args.stage);
    case 'update_client_stage': return await updateClientStage(userId, args.client_id, args.stage);
    case 'update_next_action': return await updateNextAction(userId, args.company_id, args.next_action);
    case 'get_marketing_history': return await getMarketingHistory(userId, args.company_id);
    default: return { error: `Unknown tool: ${toolName}` };
  }
}

// ─── READ TOOL IMPLEMENTATIONS ────────────────────────────────────────────────

async function getPipelineSummary(userId) {
  const { data } = await supabase
    .from('crm_companies')
    .select('stage, created_at')
    .order('created_at', { ascending: false });

  const stages = {};
  (data || []).forEach(c => {
    stages[c.stage] = (stages[c.stage] || 0) + 1;
  });

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

async function getMyMeetings(userId, period) {
  const now = new Date();
  let start, end;

  if (period === 'today') {
    start = new Date(now); start.setHours(0,0,0,0);
    end = new Date(now); end.setHours(23,59,59,999);
  } else if (period === 'tomorrow') {
    start = new Date(now); start.setDate(start.getDate() + 1); start.setHours(0,0,0,0);
    end = new Date(start); end.setHours(23,59,59,999);
  } else if (period === 'this_week') {
    start = new Date(now);
    end = new Date(now); end.setDate(end.getDate() + 7);
  } else if (period === 'next_week') {
    start = new Date(now); start.setDate(start.getDate() + 7);
    end = new Date(start); end.setDate(end.getDate() + 7);
  } else {
    start = new Date(now); start.setDate(start.getDate() - 7);
    end = new Date(now);
  }

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
  const [companies, clients, people] = await Promise.all([
    supabase.from('crm_companies').select('id, company_name, stage, city, state').ilike('company_name', `%${query}%`).limit(5),
    supabase.from('crm_clients').select('id, business_name, stage, contact_email, contact_first_name, contact_last_name')
      .or(`business_name.ilike.%${query}%,contact_first_name.ilike.%${query}%,contact_last_name.ilike.%${query}%`).limit(5),
    supabase.from('crm_people').select('id, first_name, last_name, email, company_id, crm_companies(id, company_name, stage, city, state)')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`).limit(5),
  ]);

  // If people found, also include their companies in results
  const peopleCompanies = (people.data || [])
    .filter(p => p.crm_companies)
    .map(p => p.crm_companies);

  // Merge company results — deduplicate by id
  const allCompanies = [...(companies.data || []), ...peopleCompanies];
  const uniqueCompanies = allCompanies.filter((c, index, self) =>
    index === self.findIndex(x => x.id === c.id)
  );

  return {
    companies: uniqueCompanies,
    clients: clients.data || [],
    people: people.data || [],
  };
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
  const { data } = await supabase
    .from('crm_clients')
    .select('*')
    .eq('id', clientId)
    .single();

  const { data: finance } = await supabase
    .from('crm_client_finance')
    .select('type, amount, status')
    .eq('client_id', clientId)
    .limit(10);

  // Fetch all people from original company
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
      mobile_phone: p.mobile_phone 
    }))
  };
}

async function getFinanceSummary(userId) {
  const { data } = await supabase
    .from('crm_client_finance')
    .select('amount, status, type, date');

  const now = new Date();
  const thisMonth = data?.filter(f => new Date(f.date).getMonth() === now.getMonth()) || [];
  const thisYear = data?.filter(f => new Date(f.date).getFullYear() === now.getFullYear()) || [];
  const pending = data?.filter(f => f.status === 'Pending') || [];

  const sum = arr => arr.reduce((acc, f) => acc + (parseFloat(f.amount) || 0), 0);

  return {
    total: sum(data || []),
    this_month: sum(thisMonth),
    this_year: sum(thisYear),
    pending: sum(pending),
  };
}

// ─── WRITE TOOL IMPLEMENTATIONS (instant — no confirmation needed) ────────────

async function addNote(userId, entityType, entityId, note) {
  const insert = {
    user_id: userId,
    action: 'Note Added',
    details: note,
    created_at: new Date().toISOString(),
  };
  if (entityType === 'company') insert.company_id = entityId;
  if (entityType === 'client') insert.client_id = entityId;

  await supabase.from('crm_activity_log').insert([insert]);
  return { success: true, message: `Note added to ${entityType}` };
}

async function updatePipelineStage(userId, companyId, stage) {
  await supabase.from('crm_companies').update({ stage, updated_at: new Date().toISOString() }).eq('id', companyId);
  await supabase.from('crm_activity_log').insert([{
    company_id: companyId, user_id: userId,
    action: 'Stage Updated', details: `Stage moved to "${stage}" by AI Assistant`,
  }]);
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

module.exports = { toolDefinitions, executeTool, CONFIRMATION_REQUIRED };