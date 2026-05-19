// server/routes/contacts.js
const express = require('express');
const router = express.Router();
const supabase = require('../db');
const auth = require('../middleware/auth');
const { checkPermission, getCompanyFilter } = require('../middleware/rbac');

// ─── COMPANIES ───────────────────────────────────────────────────────────────

router.get('/companies', auth, async (req, res) => {
  const filter = getCompanyFilter(req.user.id, req.user.role);
  let query = supabase
    .from('crm_companies')
    .select('*, crm_people(*), crm_users!crm_companies_assigned_to_fkey(id, name)')
    .order('created_at', { ascending: false });
  if (filter.assigned_to) query = query.eq('assigned_to', filter.assigned_to);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/companies', auth, async (req, res) => {
  // Check for duplicate company name
  if (req.body.company_name) {
    const { data: existing } = await supabase
      .from('crm_companies')
      .select('id, company_name')
      .ilike('company_name', req.body.company_name.trim())
      .single();
    if (existing) {
      return res.status(409).json({ error: 'duplicate', existing });
    }
  }
  const { data, error } = await supabase
    .from('crm_companies')
    .insert([{ ...req.body, user_id: req.user.id }])
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/companies/:id', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_companies')
    .select('*, crm_people(*), crm_users!crm_companies_assigned_to_fkey(id, name)')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  if (['sales', 'csm'].includes(req.user.role) && data.assigned_to !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(data);
});

router.put('/companies/:id', auth, checkPermission('company:edit'), async (req, res) => {
  const updates = { ...req.body, updated_at: new Date() };
  const { data, error } = await supabase
    .from('crm_companies')
    .update(updates)
    .eq('id', req.params.id)
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  const changed = Object.keys(req.body).filter(k => k !== 'updated_at');
  if (changed.length) {
    await supabase.from('crm_activity_log').insert([{
      company_id: req.params.id,
      user_id: req.user.id,
      action: 'Field Updated',
      details: `Updated: ${changed.join(', ')}`
    }]);
  }
  res.json(data);
});

router.delete('/companies/:id', auth, checkPermission('company:delete'), async (req, res) => {
  const { error } = await supabase.from('crm_companies').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.put('/companies/:id/assign', auth, checkPermission('company:assign'), async (req, res) => {
  const { assigned_to } = req.body;
  const { data, error } = await supabase
    .from('crm_companies')
    .update({ assigned_to, updated_at: new Date() })
    .eq('id', req.params.id)
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  await supabase.from('crm_activity_log').insert([{
    company_id: req.params.id,
    user_id: req.user.id,
    action: 'Assigned',
    details: `Company assigned to user ${assigned_to}`
  }]);
  res.json(data);
});

router.put('/companies/:id/stage', auth, checkPermission('pipeline:move'), async (req, res) => {
  const { stage } = req.body;
  const { data, error } = await supabase
    .from('crm_companies')
    .update({ stage, updated_at: new Date() })
    .eq('id', req.params.id)
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  await supabase.from('crm_activity_log').insert([{
    company_id: req.params.id,
    user_id: req.user.id,
    action: 'Stage Changed',
    details: `Stage changed to: ${stage}`
  }]);
  res.json(data);
});

// ─── PEOPLE ──────────────────────────────────────────────────────────────────

router.post('/companies/:id/people', auth, checkPermission('people:edit'), async (req, res) => {
  const { data, error } = await supabase
    .from('crm_people')
    .insert([{ ...req.body, company_id: req.params.id, user_id: req.user.id }])
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  await supabase.from('crm_activity_log').insert([{
    company_id: req.params.id,
    user_id: req.user.id,
    action: 'Contact Added',
    details: `Added: ${req.body.first_name} ${req.body.last_name}`
  }]);
  res.json(data);
});

router.put('/people/:id', auth, checkPermission('people:edit'), async (req, res) => {
  const { data, error } = await supabase
    .from('crm_people')
    .update(req.body)
    .eq('id', req.params.id)
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/people/:id', auth, checkPermission('people:delete'), async (req, res) => {
  const { error } = await supabase.from('crm_people').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── ACTIVITY ────────────────────────────────────────────────────────────────

router.get('/companies/:id/activity', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_activity_log')
    .select('*, crm_people(first_name, last_name), crm_users(name)')
    .eq('company_id', req.params.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/companies/:id/note', auth, checkPermission('activity:write'), async (req, res) => {
  const { note, person_id } = req.body;
  const { data, error } = await supabase
    .from('crm_activity_log')
    .insert([{
      company_id: req.params.id,
      user_id: req.user.id,
      person_id: person_id || null,
      action: 'Note Added',
      details: note
    }])
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/activity/recent', auth, async (req, res) => {
  const filter = getCompanyFilter(req.user.id, req.user.role);
  let query = supabase
    .from('crm_activity_log')
    .select('*, crm_companies(company_name, assigned_to)')
    .order('created_at', { ascending: false })
    .limit(15);
  if (filter.assigned_to) {
    const { data: myCompanies } = await supabase
      .from('crm_companies')
      .select('id')
      .eq('assigned_to', filter.assigned_to);
    const ids = (myCompanies || []).map(c => c.id);
    if (ids.length === 0) return res.json([]);
    query = query.in('company_id', ids);
  }
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/activity/:id', auth, checkPermission('activity:delete'), async (req, res) => {
  const { error } = await supabase.from('crm_activity_log').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;