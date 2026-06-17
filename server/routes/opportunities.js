// server/routes/opportunities.js
// Opportunities = junction rows in crm_customer_service_providers WHERE po_number IS NULL.
// Once a PO is assigned, the row no longer appears here (it's now an "Active Contract"
// visible on the Provider Profile page and the client's Services tab sub-rows).
const express = require('express');
const router  = express.Router();
const supabase = require('../db');
const auth    = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// Shared SELECT — nested joins for customer + service + owner. Single round-trip via PostgREST.
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

// Flatten the nested join shape into the response contract.
const flatten = (j) => ({
  id:                  j.id,
  customer_service_id: j.customer_service_id,
  service_provider_id: j.service_provider_id,
  provider_name:       j.crm_service_providers?.name || '—',
  customer_id:         j.crm_customer_services?.crm_clients?.id          || null,
  customer_name:       j.crm_customer_services?.crm_clients?.business_name || '—',
  service_name_en:     j.crm_customer_services?.crm_services?.name_en    || '',
  service_name_he:     j.crm_customer_services?.crm_services?.name_he    || '',
  owner_id:            j.crm_customer_services?.crm_users?.id            || null,
  owner_name:          j.crm_customer_services?.crm_users?.name          || null,
  po_amount:           j.po_amount,
  commission_rate:     j.commission_rate,
  commission_source:   j.commission_source,
  notes:               j.notes,
  created_at:          j.created_at,
});

// ─── GET /api/opportunities ──────────────────────────────────────────────────
// Auth-only — any logged-in user can view the pipeline.
router.get('/', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_customer_service_providers')
    .select(OPP_SELECT)
    .is('po_number', null)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(flatten));
});

// ─── POST /api/opportunities ─────────────────────────────────────────────────
// Creates a new pending opportunity. Auto-creates the parent crm_customer_services
// row with status='prospect' if the client doesn't already have this service.
router.post('/', auth, checkPermission('company:edit'), async (req, res) => {
  const {
    client_id, service_id, service_provider_id,
    notes, po_amount, commission_rate, commission_source, owner_id,
  } = req.body;

  if (!client_id)           return res.status(400).json({ error: 'client_id is required' });
  if (!service_id)          return res.status(400).json({ error: 'service_id is required' });
  if (!service_provider_id) return res.status(400).json({ error: 'service_provider_id is required' });

  // 1. Verify client exists
  const { data: client } = await supabase
    .from('crm_clients').select('id, business_name').eq('id', client_id).maybeSingle();
  if (!client) return res.status(404).json({ error: 'Client not found' });

  // 2. Verify provider exists
  const { data: provider } = await supabase
    .from('crm_service_providers').select('id, name').eq('id', service_provider_id).maybeSingle();
  if (!provider) return res.status(404).json({ error: 'Service provider not found' });

  // 3. Verify service exists in catalog
  const { data: service } = await supabase
    .from('crm_services').select('id, name_en').eq('id', service_id).maybeSingle();
  if (!service) return res.status(404).json({ error: 'Service not found' });

  // 4. Find or create the customer_service row
  const { data: existingCs } = await supabase
    .from('crm_customer_services')
    .select('id')
    .eq('client_id', client_id).eq('service_id', service_id).maybeSingle();

  let customerServiceId;
  if (existingCs) {
    customerServiceId = existingCs.id;
  } else {
    const { data: newCs, error: csErr } = await supabase
      .from('crm_customer_services')
      .insert([{
        client_id, service_id,
        status:            'prospect',
        contract_currency: 'ILS',
        owner_id:          owner_id || null,
      }])
      .select('id').single();
    if (csErr) return res.status(500).json({ error: csErr.message });
    customerServiceId = newCs.id;
  }

  // 5. Insert junction row with po_number = NULL
  const { data: inserted, error: jErr } = await supabase
    .from('crm_customer_service_providers')
    .insert([{
      customer_service_id: customerServiceId,
      service_provider_id,
      po_number:         null,
      po_amount:         po_amount       ?? null,
      commission_rate:   commission_rate ?? null,
      commission_source: commission_source || null,
      notes:             notes           || null,
      created_by:        req.user.id,
    }])
    .select(OPP_SELECT)
    .single();
  if (jErr) return res.status(500).json({ error: jErr.message });

  // 6. Activity log on the client
  await supabase.from('crm_activity_log').insert([{
    client_id,
    user_id: req.user.id,
    action:  'Opportunity Created',
    details: `New opportunity: ${provider.name} for ${service.name_en}`,
  }]);

  res.json(flatten(inserted));
});

// ─── PUT /api/opportunities/:id ──────────────────────────────────────────────
// Update fields. Special case: when po_number transitions from null → value,
// log 'PO Assigned' on the underlying client.
router.put('/:id', auth, checkPermission('company:edit'), async (req, res) => {
  const { po_number, po_amount, commission_rate, notes } = req.body;

  // Build the update set from whitelisted fields only.
  const safe = {};
  if (po_number       !== undefined) safe.po_number       = po_number       || null;
  if (po_amount       !== undefined) safe.po_amount       = po_amount       ?? null;
  if (commission_rate !== undefined) safe.commission_rate = commission_rate ?? null;
  if (notes           !== undefined) safe.notes           = notes           || null;
  if (Object.keys(safe).length === 0) {
    return res.status(400).json({ error: 'No editable fields supplied' });
  }
  safe.updated_at = new Date().toISOString();

  // Fetch current row so we can detect the null → value transition for po_number
  const { data: current } = await supabase
    .from('crm_customer_service_providers')
    .select(OPP_SELECT)
    .eq('id', req.params.id)
    .maybeSingle();
  if (!current) return res.status(404).json({ error: 'Opportunity not found' });

  const { data: updated, error } = await supabase
    .from('crm_customer_service_providers')
    .update(safe)
    .eq('id', req.params.id)
    .select(OPP_SELECT)
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // If po_number was just assigned (null → value), log 'PO Assigned' on the client.
  const wasUnassigned = current.po_number == null;
  const nowAssigned   = safe.po_number != null && safe.po_number !== '';
  if (wasUnassigned && nowAssigned) {
    const clientId    = current.crm_customer_services?.crm_clients?.id;
    const providerNm  = current.crm_service_providers?.name             || 'provider';
    const serviceName = current.crm_customer_services?.crm_services?.name_en || 'service';
    if (clientId) {
      await supabase.from('crm_activity_log').insert([{
        client_id: clientId,
        user_id:   req.user.id,
        action:    'PO Assigned',
        details:   `PO ${safe.po_number} assigned to ${providerNm} for ${serviceName}`,
      }]);
    }
  }

  res.json(flatten(updated));
});

// ─── DELETE /api/opportunities/:id ───────────────────────────────────────────
// Only works on pending opportunities (po_number IS NULL). Active contracts
// must be deleted via the provider-side or client-side endpoints.
router.delete('/:id', auth, checkPermission('company:edit'), async (req, res) => {
  const { data: row } = await supabase
    .from('crm_customer_service_providers')
    .select('id, po_number, crm_service_providers(name), crm_customer_services(crm_clients(id, business_name), crm_services(name_en))')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!row) return res.status(404).json({ error: 'Opportunity not found' });
  if (row.po_number != null) {
    return res.status(409).json({
      error: 'has_po',
      message: 'Cannot delete via /opportunities — this row has a PO and is no longer an opportunity. Use the provider profile or client services tab.',
    });
  }

  const { error } = await supabase
    .from('crm_customer_service_providers')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  const clientId    = row.crm_customer_services?.crm_clients?.id;
  const providerNm  = row.crm_service_providers?.name                       || 'provider';
  const serviceName = row.crm_customer_services?.crm_services?.name_en      || 'service';
  if (clientId) {
    await supabase.from('crm_activity_log').insert([{
      client_id: clientId,
      user_id:   req.user.id,
      action:    'Opportunity Removed',
      details:   `Removed opportunity: ${providerNm} for ${serviceName}`,
    }]);
  }

  res.json({ success: true });
});

module.exports = router;
