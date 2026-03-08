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

// --- TEMPLATES ---
router.get('/templates', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_email_templates')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/templates', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_email_templates')
    .insert([{ ...req.body, user_id: req.user.id }])
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.put('/templates/:id', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_email_templates')
    .update({ ...req.body, updated_at: new Date() })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/templates/:id', auth, async (req, res) => {
  const { error } = await supabase
    .from('crm_email_templates')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// --- SENT EMAILS ---
router.get('/sent', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_emails_sent')
    .select('*, crm_companies(company_name), crm_people(first_name, last_name)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/sent/company/:companyId', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_emails_sent')
    .select('*, crm_people(first_name, last_name)')
    .eq('company_id', req.params.companyId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/send', auth, async (req, res) => {
  const { company_id, person_id, template_id, subject, body_html } = req.body;
  const { data, error } = await supabase
    .from('crm_emails_sent')
    .insert([{
      user_id: req.user.id,
      company_id, person_id, template_id,
      subject, body_html,
      status: 'draft',
      created_at: new Date()
    }])
    .select().single();
  if (error) return res.status(500).json({ error: error.message });

  // Log in activity
  await supabase.from('crm_activity_log').insert([{
    company_id, person_id: person_id || null,
    user_id: req.user.id,
    action: 'Email Draft Saved',
    details: `Draft saved: "${subject}"`
  }]);

  res.json(data);
});

router.delete('/sent/:id', auth, async (req, res) => {
  const { error } = await supabase
    .from('crm_emails_sent')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;