const express = require('express');
const router = express.Router();
const supabase = require('../db');
const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, 'venueflow_secret');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- COMPANIES ---
router.get('/companies', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_companies')
    .select('*, crm_people(id, first_name, last_name, title, email, work_phone)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/companies', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_companies')
    .insert([{ ...req.body, user_id: req.user.id }])
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  await supabase.from('crm_activity_log').insert([{
    company_id: data.id, user_id: req.user.id,
    action: 'Company Created', details: `${data.company_name} added to CRM`
  }]);
  res.json(data);
});

router.get('/companies/:id', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_companies')
    .select('*, crm_people(*)')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.put('/companies/:id', auth, async (req, res) => {
  const { data: old } = await supabase.from('crm_companies').select('stage').eq('id', req.params.id).single();
  const { data, error } = await supabase
    .from('crm_companies')
    .update(req.body)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (old && req.body.stage && old.stage !== req.body.stage) {
    await supabase.from('crm_activity_log').insert([{
      company_id: data.id, user_id: req.user.id,
      action: 'Stage Changed',
      details: `Stage changed from "${old.stage}" to "${req.body.stage}"`
    }]);
  }
  res.json(data);
});

router.delete('/companies/:id', auth, async (req, res) => {
  const { error } = await supabase.from('crm_companies').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// --- PEOPLE ---
router.post('/companies/:id/people', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_people')
    .insert([{ ...req.body, company_id: req.params.id, user_id: req.user.id }])
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  await supabase.from('crm_activity_log').insert([{
    company_id: req.params.id, person_id: data.id, user_id: req.user.id,
    action: 'Person Added',
    details: `${data.first_name} ${data.last_name} added as contact`
  }]);
  res.json(data);
});

router.put('/people/:id', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_people').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/people/:id', auth, async (req, res) => {
  const { data } = await supabase.from('crm_people').select('company_id, first_name, last_name').eq('id', req.params.id).single();
  const { error } = await supabase.from('crm_people').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  if (data) {
    await supabase.from('crm_activity_log').insert([{
      company_id: data.company_id, user_id: req.user.id,
      action: 'Person Removed',
      details: `${data.first_name} ${data.last_name} removed`
    }]);
  }
  res.json({ success: true });
});

// --- ACTIVITY LOG ---
router.get('/companies/:id/activity', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_activity_log')
    .select('*, crm_people(first_name, last_name)')
    .eq('company_id', req.params.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/companies/:id/note', auth, async (req, res) => {
  const { note, person_id } = req.body;
  const { data, error } = await supabase.from('crm_activity_log').insert([{
    company_id: req.params.id,
    person_id: person_id || null,
    user_id: req.user.id,
    action: 'Note Added',
    details: note
  }]).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/activity/:id', auth, async (req, res) => {
  const { data } = await supabase.from('crm_activity_log').select('company_id, details').eq('id', req.params.id).single();
  const { error } = await supabase.from('crm_activity_log').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  if (data) {
    await supabase.from('crm_activity_log').insert([{
      company_id: data.company_id, user_id: req.user.id,
      action: 'Note Deleted', details: `Deleted note: "${data.details?.substring(0, 50)}..."`
    }]);
  }
  res.json({ success: true });
});

module.exports = router;
