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

// Get single client with all related data
router.get('/:id', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_clients')
    .select('*, crm_users!crm_clients_owner_id_fkey(name)')
    .eq('id', req.params.id)
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