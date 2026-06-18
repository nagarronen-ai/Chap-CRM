// server/routes/opportunities.js
// Unified Opportunities pipeline — 3 source tables surfaced under one endpoint.
//
//   new_customer : crm_companies (pre-conversion leads, stage != closed/converted)
//   new_service  : crm_customer_service_providers WHERE po_number IS NULL
//   upsell       : crm_customer_services WHERE status='prospect'
//
const express = require('express');
const router  = express.Router();
const supabase = require('../db');
const auth    = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

const CLOSED_STAGES = ['Closed Won', 'Closed Lost', 'Not Interested', 'Converted'];

// Type 2: junction-row select shape
const OPP_SELECT = `
  id, customer_service_id, service_provider_id, po_amount, commission_rate, commission_source, notes, created_at,
  crm_service_providers(name),
  crm_customer_services(
    owner_id,
    crm_clients(id, business_name),
    crm_services(name_en, name_he),
    crm_users!crm_customer_services_owner_id_fkey(id, name)
  )
`;

// ─── Row → unified shape mappers ─────────────────────────────────────────────
const mapNewCustomer = (c) => ({
  id:                  c.id,
  opportunity_type:    'new_customer',
  description:         c.company_name,
  customer_name:       null,
  customer_id:         null,
  provider_name:       null,
  service_provider_id: null,
  service_name_en:     null,
  service_name_he:     null,
  owner_id:            c.assigned_to,
  owner_name:          c.crm_users?.name || null,
  po_amount:           null,
  commission_rate:     null,
  commission_source:   null,
  notes:               c.next_action,
  stage:               c.stage,
  created_at:          c.created_at,
});

const mapNewService = (j) => ({
  id:                  j.id,
  opportunity_type:    'new_service',
  description:         j.notes,
  customer_service_id: j.customer_service_id,
  customer_id:         j.crm_customer_services?.crm_clients?.id          || null,
  customer_name:       j.crm_customer_services?.crm_clients?.business_name || '—',
  service_provider_id: j.service_provider_id,
  provider_name:       j.crm_service_providers?.name                     || '—',
  service_name_en:     j.crm_customer_services?.crm_services?.name_en    || '',
  service_name_he:     j.crm_customer_services?.crm_services?.name_he    || '',
  owner_id:            j.crm_customer_services?.crm_users?.id            || null,
  owner_name:          j.crm_customer_services?.crm_users?.name          || null,
  po_amount:           j.po_amount,
  commission_rate:     j.commission_rate,
  commission_source:   j.commission_source,
  notes:               j.notes,
  stage:               null,
  created_at:          j.created_at,
});

const mapUpsell = (cs) => ({
  id:                  cs.id,
  opportunity_type:    'upsell',
  description:         null,
  customer_id:         cs.client_id,
  customer_name:       cs.crm_clients?.business_name || '—',
  service_id:          cs.service_id,
  provider_name:       null,
  service_provider_id: null,
  service_name_en:     cs.crm_services?.name_en || '',
  service_name_he:     cs.crm_services?.name_he || '',
  owner_id:            cs.owner_id,
  owner_name:          cs.crm_users?.name || null,
  po_amount:           cs.contract_amount,
  commission_rate:     cs.commission_rate,
  commission_source:   null,
  notes:               cs.notes,
  stage:               null,
  created_at:          cs.created_at,
});

// ─── GET /api/opportunities ──────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const [companiesRes, junctionRes, upsellRes] = await Promise.all([
      supabase.from('crm_companies')
        .select('id, company_name, next_action, assigned_to, stage, created_at, crm_users!crm_companies_assigned_to_fkey(id, name)')
        .order('created_at', { ascending: false }),
      supabase.from('crm_customer_service_providers')
        .select(OPP_SELECT)
        .is('po_number', null)
        .order('created_at', { ascending: false }),
      supabase.from('crm_customer_services')
        .select(`
          id, client_id, service_id, contract_amount, commission_rate, notes, owner_id, created_at,
          crm_clients(id, business_name),
          crm_services(name_en, name_he),
          crm_users!crm_customer_services_owner_id_fkey(id, name)
        `)
        .eq('status', 'prospect')
        .order('created_at', { ascending: false }),
    ]);
    if (companiesRes.error) return res.status(500).json({ error: companiesRes.error.message });
    if (junctionRes.error)  return res.status(500).json({ error: junctionRes.error.message });
    if (upsellRes.error)    return res.status(500).json({ error: upsellRes.error.message });

    const companies = (companiesRes.data || []).filter(c => !CLOSED_STAGES.includes(c.stage));

    const unified = [
      ...companies.map(mapNewCustomer),
      ...(junctionRes.data || []).map(mapNewService),
      ...(upsellRes.data   || []).map(mapUpsell),
    ];
    unified.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(unified);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/opportunities ─────────────────────────────────────────────────
router.post('/', auth, checkPermission('company:edit'), async (req, res) => {
  const { opportunity_type } = req.body;
  if (opportunity_type === 'new_customer') return createNewCustomer(req, res);
  if (opportunity_type === 'new_service')  return createNewService(req, res);
  if (opportunity_type === 'upsell')       return createUpsell(req, res);
  return res.status(400).json({ error: 'opportunity_type must be one of: new_customer, new_service, upsell' });
});

async function createNewCustomer(req, res) {
  const { name, contact_name, contact_email, contact_phone, segment, interested_services, owner_id, notes } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  // Build the company's next_action text: notes + interested services list.
  let nextAction = notes || null;
  if (Array.isArray(interested_services) && interested_services.length > 0) {
    const { data: svcRows } = await supabase
      .from('crm_services')
      .select('name_en')
      .in('id', interested_services);
    const svcNames = (svcRows || []).map(s => s.name_en).filter(Boolean).join(', ');
    if (svcNames) nextAction = `${nextAction ? nextAction + '\n\n' : ''}Interested in: ${svcNames}`;
  }

  const { data: company, error: cErr } = await supabase
    .from('crm_companies')
    .insert([{
      company_name: name.trim(),
      category:     segment || null,            // segment stored as category — no schema change
      stage:        'New',
      assigned_to:  owner_id || null,
      user_id:      req.user.id,
      next_action:  nextAction,
    }])
    .select('*, crm_users!crm_companies_assigned_to_fkey(id, name)')
    .single();
  if (cErr) return res.status(500).json({ error: cErr.message });

  // Optional contact person
  if (contact_name || contact_email || contact_phone) {
    const [first_name, ...lastParts] = (contact_name || '').trim().split(/\s+/);
    await supabase.from('crm_people').insert([{
      company_id:   company.id,
      first_name:   first_name || null,
      last_name:    lastParts.join(' ') || null,
      email:        contact_email || null,
      mobile_phone: contact_phone || null,
      user_id:      req.user.id,
    }]);
  }

  await supabase.from('crm_activity_log').insert([{
    company_id: company.id,
    user_id:    req.user.id,
    action:     'Opportunity Created',
    details:    `New customer opportunity: ${company.company_name}`,
  }]);

  res.json(mapNewCustomer(company));
}

async function createNewService(req, res) {
  const { client_id, service_id, service_provider_id, notes, po_amount, commission_rate, commission_source, owner_id } = req.body;
  if (!client_id)           return res.status(400).json({ error: 'client_id is required' });
  if (!service_id)          return res.status(400).json({ error: 'service_id is required' });
  if (!service_provider_id) return res.status(400).json({ error: 'service_provider_id is required' });

  const { data: client }   = await supabase.from('crm_clients').select('id, business_name').eq('id', client_id).maybeSingle();
  if (!client)   return res.status(404).json({ error: 'Client not found' });
  const { data: provider } = await supabase.from('crm_service_providers').select('id, name').eq('id', service_provider_id).maybeSingle();
  if (!provider) return res.status(404).json({ error: 'Service provider not found' });
  const { data: service }  = await supabase.from('crm_services').select('id, name_en').eq('id', service_id).maybeSingle();
  if (!service)  return res.status(404).json({ error: 'Service not found' });

  // Find or create customer_service row
  const { data: existingCs } = await supabase
    .from('crm_customer_services')
    .select('id')
    .eq('client_id', client_id).eq('service_id', service_id).maybeSingle();

  let csId;
  if (existingCs) {
    csId = existingCs.id;
  } else {
    const { data: newCs, error: csErr } = await supabase
      .from('crm_customer_services')
      .insert([{ client_id, service_id, status: 'prospect', contract_currency: 'ILS', owner_id: owner_id || null }])
      .select('id').single();
    if (csErr) return res.status(500).json({ error: csErr.message });
    csId = newCs.id;
  }

  const { data: inserted, error: jErr } = await supabase
    .from('crm_customer_service_providers')
    .insert([{
      customer_service_id: csId,
      service_provider_id,
      po_number:         null,
      po_amount:         po_amount       ?? null,
      commission_rate:   commission_rate ?? null,
      commission_source: commission_source || null,
      notes:             notes || null,
      created_by:        req.user.id,
    }])
    .select(OPP_SELECT)
    .single();
  if (jErr) return res.status(500).json({ error: jErr.message });

  await supabase.from('crm_activity_log').insert([{
    client_id,
    user_id: req.user.id,
    action:  'Opportunity Created',
    details: `New opportunity: ${provider.name} for ${service.name_en}`,
  }]);

  res.json(mapNewService(inserted));
}

async function createUpsell(req, res) {
  const { client_id, service_id, notes, po_amount, commission_rate, owner_id } = req.body;
  if (!client_id)  return res.status(400).json({ error: 'client_id is required' });
  if (!service_id) return res.status(400).json({ error: 'service_id is required' });

  const { data: client }  = await supabase.from('crm_clients').select('id, business_name').eq('id', client_id).maybeSingle();
  if (!client)  return res.status(404).json({ error: 'Client not found' });
  const { data: service } = await supabase.from('crm_services').select('id, name_en').eq('id', service_id).maybeSingle();
  if (!service) return res.status(404).json({ error: 'Service not found' });

  const { data: existing } = await supabase
    .from('crm_customer_services')
    .select('id, status')
    .eq('client_id', client_id).eq('service_id', service_id).maybeSingle();

  if (existing) {
    if (existing.status === 'prospect') {
      return res.status(409).json({ error: 'duplicate', message: 'Upsell opportunity already exists for this service' });
    }
    return res.status(409).json({ error: 'active', message: 'Service already active for this client' });
  }

  const { data: inserted, error } = await supabase
    .from('crm_customer_services')
    .insert([{
      client_id,
      service_id,
      status:            'prospect',
      contract_currency: 'ILS',
      contract_amount:   po_amount       ?? null,
      commission_rate:   commission_rate ?? null,
      notes:             notes || null,
      owner_id:          owner_id || null,
    }])
    .select(`
      id, client_id, service_id, contract_amount, commission_rate, notes, owner_id, created_at,
      crm_clients(id, business_name),
      crm_services(name_en, name_he),
      crm_users!crm_customer_services_owner_id_fkey(id, name)
    `)
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('crm_activity_log').insert([{
    client_id,
    user_id: req.user.id,
    action:  'Opportunity Created',
    details: `Upsell opportunity: ${service.name_en}`,
  }]);

  res.json(mapUpsell(inserted));
}

// ─── PUT /api/opportunities/:id ──────────────────────────────────────────────
router.put('/:id', auth, checkPermission('company:edit'), async (req, res) => {
  const { opportunity_type } = req.body;
  if (opportunity_type === 'new_customer') return updateNewCustomer(req, res);
  if (opportunity_type === 'new_service')  return updateNewService(req, res);
  if (opportunity_type === 'upsell')       return updateUpsell(req, res);
  return res.status(400).json({ error: 'opportunity_type must be one of: new_customer, new_service, upsell' });
});

async function updateNewCustomer(req, res) {
  const { stage, notes, assigned_to, category } = req.body;
  const safe = {};
  if (stage       !== undefined) safe.stage       = stage;
  if (notes       !== undefined) safe.next_action = notes;
  if (assigned_to !== undefined) safe.assigned_to = assigned_to || null;
  if (category    !== undefined) safe.category    = category || null;
  if (Object.keys(safe).length === 0) return res.status(400).json({ error: 'No editable fields supplied' });
  safe.updated_at = new Date();

  const { data, error } = await supabase
    .from('crm_companies').update(safe).eq('id', req.params.id)
    .select('*, crm_users!crm_companies_assigned_to_fkey(id, name)').single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Company not found' });

  res.json(mapNewCustomer(data));
}

async function updateNewService(req, res) {
  const { po_number, po_amount, commission_rate, notes } = req.body;
  const safe = {};
  if (po_number       !== undefined) safe.po_number       = po_number       || null;
  if (po_amount       !== undefined) safe.po_amount       = po_amount       ?? null;
  if (commission_rate !== undefined) safe.commission_rate = commission_rate ?? null;
  if (notes           !== undefined) safe.notes           = notes           || null;
  if (Object.keys(safe).length === 0) return res.status(400).json({ error: 'No editable fields supplied' });
  safe.updated_at = new Date().toISOString();

  const { data: current } = await supabase
    .from('crm_customer_service_providers')
    .select(OPP_SELECT)
    .eq('id', req.params.id).maybeSingle();
  if (!current) return res.status(404).json({ error: 'Opportunity not found' });

  const { data: updated, error } = await supabase
    .from('crm_customer_service_providers')
    .update(safe).eq('id', req.params.id)
    .select(OPP_SELECT).single();
  if (error) return res.status(500).json({ error: error.message });

  // Activity log on null → PO transition only
  if (current.po_number == null && safe.po_number != null && safe.po_number !== '') {
    const clientId    = current.crm_customer_services?.crm_clients?.id;
    const providerNm  = current.crm_service_providers?.name             || 'provider';
    const serviceName = current.crm_customer_services?.crm_services?.name_en || 'service';
    if (clientId) {
      await supabase.from('crm_activity_log').insert([{
        client_id: clientId, user_id: req.user.id, action: 'PO Assigned',
        details: `PO ${safe.po_number} assigned to ${providerNm} for ${serviceName}`,
      }]);
    }
  }

  res.json(mapNewService(updated));
}

async function updateUpsell(req, res) {
  const { status, contract_amount, commission_rate, notes, owner_id } = req.body;
  const safe = {};
  if (status          !== undefined) safe.status          = status;
  if (contract_amount !== undefined) safe.contract_amount = contract_amount ?? null;
  if (commission_rate !== undefined) safe.commission_rate = commission_rate ?? null;
  if (notes           !== undefined) safe.notes           = notes || null;
  if (owner_id        !== undefined) safe.owner_id        = owner_id || null;
  if (Object.keys(safe).length === 0) return res.status(400).json({ error: 'No editable fields supplied' });
  safe.updated_at = new Date().toISOString();

  const { data: current } = await supabase
    .from('crm_customer_services').select('id, status, client_id, service_id, crm_services(name_en)')
    .eq('id', req.params.id).maybeSingle();
  if (!current) return res.status(404).json({ error: 'Opportunity not found' });

  const { data: updated, error } = await supabase
    .from('crm_customer_services').update(safe).eq('id', req.params.id)
    .select(`
      id, client_id, service_id, contract_amount, commission_rate, notes, owner_id, created_at,
      crm_clients(id, business_name),
      crm_services(name_en, name_he),
      crm_users!crm_customer_services_owner_id_fkey(id, name)
    `).single();
  if (error) return res.status(500).json({ error: error.message });

  // Activity log on prospect → active transition (the "Mark Won" event)
  if (current.status === 'prospect' && safe.status === 'active') {
    await supabase.from('crm_activity_log').insert([{
      client_id: current.client_id, user_id: req.user.id, action: 'Upsell Won',
      details: `Upsell won: ${current.crm_services?.name_en || 'service'} now active`,
    }]);
  }

  res.json(mapUpsell(updated));
}

// ─── DELETE /api/opportunities/:id ───────────────────────────────────────────
// Requires ?type=<opportunity_type> query param so we know which table to act on.
router.delete('/:id', auth, checkPermission('company:edit'), async (req, res) => {
  const type = req.query.type;
  if (type === 'new_customer') return deleteNewCustomer(req, res);
  if (type === 'new_service')  return deleteNewService(req, res);
  if (type === 'upsell')       return deleteUpsell(req, res);
  return res.status(400).json({ error: 'query ?type= must be one of: new_customer, new_service, upsell' });
});

async function deleteNewCustomer(req, res) {
  const { data: existing } = await supabase
    .from('crm_companies').select('id, company_name').eq('id', req.params.id).maybeSingle();
  if (!existing) return res.status(404).json({ error: 'Opportunity not found' });

  const { error } = await supabase.from('crm_companies').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}

async function deleteNewService(req, res) {
  const { data: row } = await supabase
    .from('crm_customer_service_providers')
    .select('id, po_number, crm_service_providers(name), crm_customer_services(crm_clients(id, business_name), crm_services(name_en))')
    .eq('id', req.params.id).maybeSingle();
  if (!row) return res.status(404).json({ error: 'Opportunity not found' });
  if (row.po_number != null) {
    return res.status(409).json({ error: 'has_po', message: 'Cannot delete via /opportunities — this row has a PO and is no longer an opportunity.' });
  }

  const { error } = await supabase.from('crm_customer_service_providers').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  const clientId = row.crm_customer_services?.crm_clients?.id;
  if (clientId) {
    const providerNm  = row.crm_service_providers?.name                  || 'provider';
    const serviceName = row.crm_customer_services?.crm_services?.name_en || 'service';
    await supabase.from('crm_activity_log').insert([{
      client_id: clientId, user_id: req.user.id, action: 'Opportunity Removed',
      details: `Removed opportunity: ${providerNm} for ${serviceName}`,
    }]);
  }
  res.json({ success: true });
}

async function deleteUpsell(req, res) {
  const { data: existing } = await supabase
    .from('crm_customer_services').select('id, status, client_id, crm_services(name_en)')
    .eq('id', req.params.id).maybeSingle();
  if (!existing) return res.status(404).json({ error: 'Opportunity not found' });
  if (existing.status !== 'prospect') {
    return res.status(409).json({ error: 'not_prospect', message: 'Cannot delete via /opportunities — this customer-service row is not in prospect status.' });
  }

  const { error } = await supabase.from('crm_customer_services').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('crm_activity_log').insert([{
    client_id: existing.client_id, user_id: req.user.id, action: 'Opportunity Removed',
    details: `Removed upsell opportunity: ${existing.crm_services?.name_en || 'service'}`,
  }]);
  res.json({ success: true });
}

module.exports = router;
