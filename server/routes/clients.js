// server/routes/clients.js
const express = require('express');
const router = express.Router();
const supabase = require('../db');
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// ─── CLIENTS CRUD ────────────────────────────────────────────────────────────

// List all clients
router.get('/', auth, async (req, res) => {
  const { stage, category, owner_id, search } = req.query;
  let query = supabase
    .from('crm_clients')
    .select('*, crm_users!crm_clients_owner_id_fkey(name)')
    .order('created_at', { ascending: false });

  if (stage) query = query.eq('stage', stage);
  if (category) query = query.eq('category', category);
  if (owner_id) query = query.eq('owner_id', owner_id);
  if (search) query = query.or(`business_name.ilike.%${search}%,contact_first_name.ilike.%${search}%,contact_last_name.ilike.%${search}%,contact_email.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── DASHBOARD AGGREGATIONS ──────────────────────────────────────────────────
// IMPORTANT: these MUST be declared before `/:id` so that `/dashboard-stats`,
// `/services-all`, and `/activity/combined` aren't swallowed by the :id matcher.

// GET /api/clients/dashboard-stats?since=YYYY-MM-DD
// Single aggregation endpoint for the Dashboard. `since` filters revenue +
// top_by_revenue; counts and services-* are always current-state.
router.get('/dashboard-stats', auth, async (req, res) => {
  const since = req.query.since || null;
  try {
    const [
      companiesRes, clientsCountRes, peopleRes,
      svcRes, finRes, clientsListRes,
    ] = await Promise.all([
      supabase.from('crm_companies').select('id', { count: 'exact', head: true }),
      supabase.from('crm_clients').select('id', { count: 'exact', head: true }),
      supabase.from('crm_people').select('id', { count: 'exact', head: true }),
      supabase.from('crm_customer_services').select('client_id, owner_id, status, contract_amount'),
      (() => {
        let q = supabase.from('crm_client_finance').select('client_id, type, status, amount, date');
        if (since) q = q.gte('date', since);
        return q;
      })(),
      supabase.from('crm_clients').select('id, business_name'),
    ]);

    const services = svcRes.data || [];
    const finance  = finRes.data  || [];
    const nameById = Object.fromEntries((clientsListRes.data || []).map(c => [c.id, c.business_name]));

    const byStatus = { active: 0, prospect: 0, past: 0, lost: 0 };
    let prospectSum = 0;
    const activeByOwner = {};
    const activeByClient = {};
    for (const s of services) {
      if (byStatus[s.status] != null) byStatus[s.status]++;
      if (s.status === 'prospect' && s.contract_amount != null) prospectSum += Number(s.contract_amount);
      if (s.status === 'active') {
        if (s.owner_id)  activeByOwner[s.owner_id]   = (activeByOwner[s.owner_id]   || 0) + 1;
        if (s.client_id) activeByClient[s.client_id] = (activeByClient[s.client_id] || 0) + 1;
      }
    }
    const servicesTotal = byStatus.active + byStatus.prospect + byStatus.past + byStatus.lost;

    // Revenue: inflow (anything not Refund) minus refunds. Paid + Pending tracked separately.
    let revenuePaid = 0, revenuePending = 0;
    const revByClient = new Map();
    for (const r of finance) {
      const amt = Number(r.amount) || 0;
      const signed = r.type === 'Refund' ? -amt : amt;
      if (r.status === 'Paid') {
        revenuePaid += signed;
        if (r.client_id) revByClient.set(r.client_id, (revByClient.get(r.client_id) || 0) + signed);
      } else if (r.status === 'Pending' && r.type !== 'Refund') {
        revenuePending += amt;
      }
    }

    const topByRevenue = [...revByClient.entries()]
      .map(([id, value]) => ({ id, business_name: nameById[id] || '—', value }))
      .filter(t => t.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const topByServices = Object.entries(activeByClient)
      .map(([id, value]) => ({ id, business_name: nameById[id] || '—', value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    res.json({
      counts: {
        companies:         companiesRes.count   || 0,
        clients:           clientsCountRes.count || 0,
        people:            peopleRes.count       || 0,
        services_total:    servicesTotal,
        services_active:   byStatus.active,
        services_prospect: byStatus.prospect,
        services_past:     byStatus.past,
        services_lost:     byStatus.lost,
      },
      revenue:                  { paid: revenuePaid, pending: revenuePending },
      services_prospect_sum:    prospectSum,
      active_services_by_owner: activeByOwner,
      top_by_revenue:           topByRevenue,
      top_by_services:          topByServices,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clients/services-all?status=prospect
// Flat list of customer-service rows across all clients, for drill-down views.
router.get('/services-all', auth, async (req, res) => {
  const { status } = req.query;
  let query = supabase
    .from('crm_customer_services')
    .select(`
      id, client_id, owner_id, status, contract_amount, contract_currency, created_at,
      crm_clients(id, business_name),
      crm_services(name_en, name_he, sort_order),
      crm_users!crm_customer_services_owner_id_fkey(name)
    `)
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/clients/activity/combined?limit=10
// Activity log entries from both company and client paths, newest first.
router.get('/activity/combined', auth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const { data, error } = await supabase
    .from('crm_activity_log')
    .select(`
      id, action, details, company_id, client_id, person_id, user_id, created_at,
      crm_companies(company_name),
      crm_clients(business_name),
      crm_users(name)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Get single client with all related data
router.get('/:id', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_clients')
    .select('*, crm_users!crm_clients_owner_id_fkey(name), crm_people(*)')
    .eq('id', req.params.id)
    .order('created_at', { ascending: true, foreignTable: 'crm_people' })
    .single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Client not found' });
  res.json(data);
});

// Create client (admin only)
router.post('/', auth, checkPermission('company:edit'), async (req, res) => {
  const { data, error } = await supabase
    .from('crm_clients')
    .insert([{ ...req.body, created_by: req.user.id }])
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Update client
router.put('/:id', auth, checkPermission('company:edit'), async (req, res) => {
  const { data, error } = await supabase
    .from('crm_clients')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PUT /api/clients/:id/owner — change owner; logs a clean Owner Changed entry
router.put('/:id/owner', auth, checkPermission('company:assign'), async (req, res) => {
  const { owner_id } = req.body;
  if (owner_id !== null && typeof owner_id !== 'string') {
    return res.status(400).json({ error: 'owner_id must be a UUID string or null' });
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('crm_clients')
    .select('owner_id')
    .eq('id', req.params.id)
    .single();
  if (fetchErr || !existing) return res.status(404).json({ error: 'Client not found' });

  const ids = [existing.owner_id, owner_id].filter(Boolean);
  const { data: users } = ids.length
    ? await supabase.from('crm_users').select('id, name').in('id', ids)
    : { data: [] };
  const nameById = Object.fromEntries((users || []).map(u => [u.id, u.name]));
  const oldName = existing.owner_id ? (nameById[existing.owner_id] || 'unknown user') : 'Unassigned';
  const newName = owner_id          ? (nameById[owner_id]          || 'unknown user') : 'Unassigned';

  const { data, error } = await supabase
    .from('crm_clients')
    .update({ owner_id, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select('*, crm_users!crm_clients_owner_id_fkey(name)')
    .single();
  if (error) return res.status(500).json({ error: error.message });

  if (oldName !== newName) {
    await supabase.from('crm_activity_log').insert([{
      client_id: req.params.id,
      user_id:   req.user.id,
      action:    'Owner Changed',
      details:   `Owner changed from ${oldName} to ${newName}`,
    }]);
  }
  res.json(data);
});

// POST /api/clients/:id/people — add a person under a client (NOT company)
router.post('/:id/people', auth, checkPermission('people:edit'), async (req, res) => {
  // Duplicate check scoped to this client
  if (req.body.email) {
    const { data: existing } = await supabase
      .from('crm_people')
      .select('id')
      .eq('email', req.body.email.toLowerCase().trim())
      .eq('client_id', req.params.id)
      .maybeSingle();
    if (existing) return res.status(409).json({ error: 'duplicate', existing });
  }

  // Strip any caller-supplied parent FKs — XOR check requires exactly one parent.
  const { company_id: _ignoredCompany, client_id: _ignoredClient, ...safe } = req.body;

  const { data, error } = await supabase
    .from('crm_people')
    .insert([{
      ...safe,
      client_id:  req.params.id,
      company_id: null,
      user_id:    req.user.id,
    }])
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('crm_activity_log').insert([{
    client_id: req.params.id,
    user_id:   req.user.id,
    action:    'Contact Added',
    details:   `Added: ${(req.body.first_name || '').trim()} ${(req.body.last_name || '').trim()}`.trim(),
  }]);

  res.json(data);
});

// Delete client (admin only)
router.delete('/:id', auth, checkPermission('company:delete'), async (req, res) => {
  const { error } = await supabase
    .from('crm_clients')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── CONVERSION ──────────────────────────────────────────────────────────────

// Convert a company (contact) into a client
router.post('/convert/:companyId', auth, checkPermission('company:edit'), async (req, res) => {
  const { companyId } = req.params;
  const { contract_type, commission_rate, contract_amount, contract_signed_date, notes } = req.body;

  // Get the company
  const { data: company, error: companyErr } = await supabase
    .from('crm_companies')
    .select('*, crm_people(first_name, last_name, email, work_phone, mobile_phone)')
    .eq('id', companyId)
    .single();

  if (companyErr || !company) return res.status(404).json({ error: 'Company not found' });

  // Get primary contact (first person)
  const primaryContact = company.crm_people?.[0];

  // Create the client record
  const { data: client, error: clientErr } = await supabase
    .from('crm_clients')
    .insert([{
      converted_from: companyId,
      owner_id: company.assigned_to || req.user.id,
      business_name: company.company_name,
      contact_first_name: primaryContact?.first_name || '',
      contact_last_name: primaryContact?.last_name || '',
      contact_email: primaryContact?.email || '',
      contact_phone: primaryContact?.work_phone || primaryContact?.mobile_phone || '',
      website: company.website,
      category: company.category || '',
      business_type: company.business_type,
      address: company.company_address,
      city: company.city,
      state: company.state,
      country: company.country || 'US',
      stage: 'Onboarding',
      contract_type: contract_type || 'RevShare',
      commission_rate: commission_rate || 5.0,
      contract_amount: contract_amount || null,
      contract_signed_date: contract_signed_date || null,
      notes: notes || '',
      created_by: req.user.id,
    }])
    .select()
    .single();

  if (clientErr) return res.status(500).json({ error: clientErr.message });

  // (vendor page creation removed — not applicable for all business types)

  // Update company stage to "Converted"
  await supabase
    .from('crm_companies')
    .update({ stage: 'Converted' })
    .eq('id', companyId);

// Copy documents from company to client
const { data: companyDocs } = await supabase
.from('crm_documents')
.select('*')
.eq('company_id', companyId);

if (companyDocs && companyDocs.length > 0) {
await supabase.from('crm_documents').insert(
  companyDocs.map(doc => ({
    title: doc.title,
    file_url: doc.file_url,
    type: doc.type,
    notes: doc.notes,
    company_id: companyId,
    client_id: client.id,
    uploaded_by: doc.uploaded_by,
    created_at: doc.created_at,
  }))
);
}

  // Log activity on the company
  await supabase.from('crm_activity_log').insert([{
    company_id: companyId,
    user_id: req.user.id,
    action: 'Converted to Client',
    details: `${company.company_name} converted to client. Contract: ${contract_type || 'RevShare'}, Commission: ${commission_rate || 5}%`,
  }]);

  // Log activity on the client
  await supabase.from('crm_activity_log').insert([{
    client_id: client.id,
    user_id: req.user.id,
    action: 'Client Created',
    details: `Client created from contact: ${company.company_name}`,
  }]);

  res.json(client);
});

// ─── DOCUMENTS ───────────────────────────────────────────────────────────────

router.get('/:id/documents', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_client_documents')
    .select('*, crm_users!crm_client_documents_uploaded_by_fkey(name)')
    .eq('client_id', req.params.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/:id/documents', auth, checkPermission('company:edit'), async (req, res) => {
  const { data, error } = await supabase
    .from('crm_client_documents')
    .insert([{ ...req.body, client_id: req.params.id, uploaded_by: req.user.id }])
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('crm_activity_log').insert([{
    client_id: req.params.id,
    user_id: req.user.id,
    action: 'Document Added',
    details: `Document "${req.body.title}" (${req.body.doc_type || 'Contract'}) added`,
  }]);

  res.json(data);
});

router.put('/documents/:docId', auth, checkPermission('company:edit'), async (req, res) => {
  const { data, error } = await supabase
    .from('crm_client_documents')
    .update(req.body)
    .eq('id', req.params.docId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/documents/:docId', auth, checkPermission('company:delete'), async (req, res) => {
  const { error } = await supabase
    .from('crm_client_documents')
    .delete()
    .eq('id', req.params.docId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── CUSTOMER SERVICES ───────────────────────────────────────────────────────

// Sort: status priority (active=1, prospect=2, past=3, lost=4) then crm_services.sort_order.
// Postgres lacks a one-liner for that across a join via PostgREST, so we sort in JS.
const STATUS_PRIORITY = { active: 1, prospect: 2, past: 3, lost: 4 };
function sortCustomerServices(rows) {
  return [...(rows || [])].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 99;
    const pb = STATUS_PRIORITY[b.status] ?? 99;
    if (pa !== pb) return pa - pb;
    const sa = a.crm_services?.sort_order ?? 9999;
    const sb = b.crm_services?.sort_order ?? 9999;
    return sa - sb;
  });
}

const CUSTOMER_SERVICE_SELECT =
  '*, crm_services(id, name_en, name_he, sort_order), crm_users!crm_customer_services_owner_id_fkey(id, name)';

// GET /api/clients/:id/services — list services attached to this client
router.get('/:id/services', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_customer_services')
    .select(CUSTOMER_SERVICE_SELECT)
    .eq('client_id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json(sortCustomerServices(data));
});

// POST /api/clients/:id/services — attach a service to a client (idempotent via UNIQUE)
router.post('/:id/services', auth, checkPermission('company:edit'), async (req, res) => {
  const {
    service_id, status, owner_id,
    contract_amount, contract_currency,
    commission_rate, start_date, end_date, renewal_date, notes,
  } = req.body;
  if (!service_id) return res.status(400).json({ error: 'service_id required' });

  // Pre-check duplicate for friendly 409 (UNIQUE constraint is the real guard)
  const { data: existing } = await supabase
    .from('crm_customer_services')
    .select('id')
    .eq('client_id', req.params.id)
    .eq('service_id', service_id)
    .maybeSingle();
  if (existing) return res.status(409).json({ error: 'duplicate', existing });

  const { data, error } = await supabase
    .from('crm_customer_services')
    .insert([{
      client_id:         req.params.id,
      service_id,
      status:            status || 'active',
      owner_id:          owner_id || null,
      contract_amount:   contract_amount ?? null,
      contract_currency: contract_currency || 'ILS',
      commission_rate:   commission_rate ?? null,
      start_date:        start_date || null,
      end_date:          end_date || null,
      renewal_date:      renewal_date || null,
      notes:             notes || null,
    }])
    .select(CUSTOMER_SERVICE_SELECT)
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('crm_activity_log').insert([{
    client_id: req.params.id,
    user_id:   req.user.id,
    action:    'Service Added',
    details:   `Service added: ${data.crm_services?.name_en || service_id}`,
  }]);

  res.json(data);
});

// PUT /api/clients/:id/services/:csId — update one field at a time (cell edits)
router.put('/:id/services/:csId', auth, checkPermission('company:edit'), async (req, res) => {
  // Strip immutable / join fields from body
  const {
    id: _ignoredId, client_id: _ignoredClient, service_id: _ignoredSvc,
    crm_services: _ignoredJoin1, crm_users: _ignoredJoin2, created_at: _ignoredCreated,
    ...safe
  } = req.body;
  if (Object.keys(safe).length === 0) {
    return res.status(400).json({ error: 'No editable fields supplied' });
  }
  safe.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('crm_customer_services')
    .update(safe)
    .eq('id', req.params.csId)
    .eq('client_id', req.params.id)
    .select(CUSTOMER_SERVICE_SELECT)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Customer-service row not found' });

  const changedFields = Object.keys(safe).filter(k => k !== 'updated_at');
  await supabase.from('crm_activity_log').insert([{
    client_id: req.params.id,
    user_id:   req.user.id,
    action:    'Service Updated',
    details:   `Service updated: ${data.crm_services?.name_en || ''} (${changedFields.join(', ')})`,
  }]);

  res.json(data);
});

// DELETE /api/clients/:id/services/:csId — detach service from client
router.delete('/:id/services/:csId', auth, checkPermission('company:edit'), async (req, res) => {
  // Fetch the service name for the activity log before we lose the row
  const { data: existing } = await supabase
    .from('crm_customer_services')
    .select('crm_services(name_en)')
    .eq('id', req.params.csId)
    .eq('client_id', req.params.id)
    .maybeSingle();

  const { error } = await supabase
    .from('crm_customer_services')
    .delete()
    .eq('id', req.params.csId)
    .eq('client_id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('crm_activity_log').insert([{
    client_id: req.params.id,
    user_id:   req.user.id,
    action:    'Service Removed',
    details:   `Service removed: ${existing?.crm_services?.name_en || req.params.csId}`,
  }]);

  res.json({ success: true });
});

// ─── VENDOR PAGE ─────────────────────────────────────────────────────────────

router.get('/:id/vendor-page', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_client_vendor_page')
    .select('*')
    .eq('client_id', req.params.id)
    .single();
  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
  res.json(data || {});
});

router.put('/:id/vendor-page', auth, checkPermission('company:edit'), async (req, res) => {
  // Upsert — create if not exists, update if exists
  const { data: existing } = await supabase
    .from('crm_client_vendor_page')
    .select('id')
    .eq('client_id', req.params.id)
    .single();

  let result;
  if (existing) {
    result = await supabase
      .from('crm_client_vendor_page')
      .update(req.body)
      .eq('client_id', req.params.id)
      .select()
      .single();
  } else {
    result = await supabase
      .from('crm_client_vendor_page')
      .insert([{ ...req.body, client_id: req.params.id }])
      .select()
      .single();
  }

  if (result.error) return res.status(500).json({ error: result.error.message });

  await supabase.from('crm_activity_log').insert([{
    client_id: req.params.id,
    user_id: req.user.id,
    action: 'Vendor Page Updated',
    details: `Marketplace listing updated`,
  }]);

  res.json(result.data);
});

// ─── FINANCE ─────────────────────────────────────────────────────────────────

router.get('/:id/finance', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_client_finance')
    .select('*, crm_users!crm_client_finance_created_by_fkey(name)')
    .eq('client_id', req.params.id)
    .order('date', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/:id/finance', auth, checkPermission('finance:general'), async (req, res) => {
  const { data, error } = await supabase
    .from('crm_client_finance')
    .insert([{ ...req.body, client_id: req.params.id, created_by: req.user.id }])
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('crm_activity_log').insert([{
    client_id: req.params.id,
    user_id: req.user.id,
    action: 'Transaction Added',
    details: `${req.body.type || 'Transaction'}: $${req.body.amount} — ${req.body.description || ''}`,
  }]);

  res.json(data);
});

router.put('/finance/:txId', auth, checkPermission('finance:general'), async (req, res) => {
  const { data, error } = await supabase
    .from('crm_client_finance')
    .update(req.body)
    .eq('id', req.params.txId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/finance/:txId', auth, checkPermission('finance:general'), async (req, res) => {
  const { error } = await supabase
    .from('crm_client_finance')
    .delete()
    .eq('id', req.params.txId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── ACTIVITY ────────────────────────────────────────────────────────────────

router.get('/:id/activity', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_activity_log')
    .select('*, crm_users!crm_activity_log_user_id_fkey(name)')
    .eq('client_id', req.params.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/:id/note', auth, async (req, res) => {
  const { note } = req.body;
  const { data, error } = await supabase
    .from('crm_activity_log')
    .insert([{
      client_id: req.params.id,
      user_id: req.user.id,
      action: 'Note Added',
      details: note,
    }])
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;