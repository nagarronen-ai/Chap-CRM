// server/routes/serviceProviders.js
// CRUD for crm_service_providers, plus aggregated views that fold in the
// customer-service-provider junction without N+1.
const express = require('express');
const router = express.Router();
const supabase = require('../db');
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// Strip immutable / join fields from a request body before INSERT or UPDATE.
const sanitizeBody = (body) => {
  const { id, created_at, created_by, updated_at, crm_users, ...safe } = body;
  return safe;
};

// Standard activity log helper. The activity rows aren't tied to a company or
// client (company_id / client_id stay null), so they don't surface on those
// detail-page feeds. They exist for audit only.
const logProviderActivity = async (userId, action, details) => {
  try {
    await supabase.from('crm_activity_log').insert([{
      user_id:  userId,
      action,
      details,
    }]);
  } catch (err) {
    console.error('logProviderActivity error:', err.message);
  }
};

// ─── GET /api/service-providers ──────────────────────────────────────────────
// Lists all providers, with per-row aggregations (active_contracts, total_po_amount)
// computed in JS from a SINGLE junction fetch — no N+1.
//
// Optional ?is_active=true|false filter.
router.get('/', auth, async (req, res) => {
  try {
    let providerQuery = supabase
      .from('crm_service_providers')
      .select('*')
      .order('name', { ascending: true });

    if (req.query.is_active === 'true')  providerQuery = providerQuery.eq('is_active', true);
    if (req.query.is_active === 'false') providerQuery = providerQuery.eq('is_active', false);

    const [providersRes, junctionRes] = await Promise.all([
      providerQuery,
      // ONE query for the entire junction. Aggregation done in-memory below.
      supabase
        .from('crm_customer_service_providers')
        .select('service_provider_id, po_amount'),
    ]);

    if (providersRes.error) return res.status(500).json({ error: providersRes.error.message });
    if (junctionRes.error)  return res.status(500).json({ error: junctionRes.error.message });

    // Bucket-aggregate by service_provider_id
    const aggByProvider = {};
    for (const row of junctionRes.data || []) {
      const bucket = aggByProvider[row.service_provider_id] ||
        (aggByProvider[row.service_provider_id] = { active_contracts: 0, total_po_amount: 0 });
      bucket.active_contracts += 1;
      bucket.total_po_amount  += Number(row.po_amount) || 0;
    }

    const enriched = (providersRes.data || []).map(p => ({
      ...p,
      active_contracts: aggByProvider[p.id]?.active_contracts || 0,
      total_po_amount:  aggByProvider[p.id]?.total_po_amount  || 0,
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/service-providers/:id ──────────────────────────────────────────
// Single provider with aggregations + the list of customer-service contracts
// they're attached to, with nested client + service for the detail page.
// Two DB calls total (provider row, filtered junction). No N+1.
router.get('/:id', auth, async (req, res) => {
  try {
    const [providerRes, junctionRes] = await Promise.all([
      supabase
        .from('crm_service_providers')
        .select('*')
        .eq('id', req.params.id)
        .single(),
      // Filtered junction with nested customer-service, client, and service info
      supabase
        .from('crm_customer_service_providers')
        .select(`
          id, po_number, po_amount, commission_rate, commission_source, notes, created_at,
          crm_customer_services(
            id, status, client_id, service_id, contract_amount, contract_currency,
            crm_clients(id, business_name),
            crm_services(id, name_en, name_he)
          )
        `)
        .eq('service_provider_id', req.params.id)
        .order('created_at', { ascending: false }),
    ]);

    if (providerRes.error) {
      if (providerRes.error.code === 'PGRST116') return res.status(404).json({ error: 'Provider not found' });
      return res.status(500).json({ error: providerRes.error.message });
    }
    if (junctionRes.error) return res.status(500).json({ error: junctionRes.error.message });

    const contracts = junctionRes.data || [];
    const activeContracts = contracts.length;
    const totalPoAmount   = contracts.reduce((a, r) => a + (Number(r.po_amount) || 0), 0);

    res.json({
      ...providerRes.data,
      active_contracts: activeContracts,
      total_po_amount:  totalPoAmount,
      contracts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/service-providers ─────────────────────────────────────────────
router.post('/', auth, checkPermission('company:edit'), async (req, res) => {
  const safe = sanitizeBody(req.body);
  if (!safe.name || typeof safe.name !== 'string' || !safe.name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const { data, error } = await supabase
    .from('crm_service_providers')
    .insert([{
      name:                       safe.name.trim(),
      contact_name:               safe.contact_name              || null,
      contact_email:              safe.contact_email             || null,
      contact_phone:              safe.contact_phone             || null,
      commission_rate_default:    safe.commission_rate_default   ?? null,
      commission_source_default:  safe.commission_source_default || null,
      notes:                      safe.notes                     || null,
      is_active:                  safe.is_active !== false,  // default true unless explicitly false
      created_by:                 req.user.id,
    }])
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await logProviderActivity(req.user.id, 'Provider Created', `Created service provider: ${data.name}`);
  res.json(data);
});

// ─── PUT /api/service-providers/:id ──────────────────────────────────────────
router.put('/:id', auth, checkPermission('company:edit'), async (req, res) => {
  const safe = sanitizeBody(req.body);
  if (Object.keys(safe).length === 0) {
    return res.status(400).json({ error: 'No editable fields supplied' });
  }
  safe.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('crm_service_providers')
    .update(safe)
    .eq('id', req.params.id)
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Provider not found' });

  const changedFields = Object.keys(safe).filter(k => k !== 'updated_at');
  await logProviderActivity(
    req.user.id,
    'Provider Updated',
    `Provider ${data.name} updated: ${changedFields.join(', ')}`
  );

  res.json(data);
});

// ─── DELETE /api/service-providers/:id ───────────────────────────────────────
// Soft delete — sets is_active=false. crm_customer_service_providers FK is
// ON DELETE RESTRICT, so hard-delete would fail if any junction rows exist.
// Soft-delete preserves audit trail and existing junction relationships.
router.delete('/:id', auth, checkPermission('company:edit'), async (req, res) => {
  const { data: existing, error: fetchErr } = await supabase
    .from('crm_service_providers')
    .select('id, name')
    .eq('id', req.params.id)
    .maybeSingle();
  if (fetchErr) return res.status(500).json({ error: fetchErr.message });
  if (!existing) return res.status(404).json({ error: 'Provider not found' });

  const { error } = await supabase
    .from('crm_service_providers')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  await logProviderActivity(req.user.id, 'Provider Deactivated', `Provider ${existing.name} deactivated`);
  res.json({ success: true });
});

module.exports = router;
