// server/routes/emails.js
const express = require('express');
const router = express.Router();
const supabase = require('../db');
const auth = require('../middleware/auth');

// ─── TEMPLATES ───────────────────────────────────────────────────────────────

// GET templates — each role sees team templates + their own private
router.get('/templates', auth, async (req, res) => {
  const { id: userId, role } = req.user;

  // Finance sees only their own private
  if (role === 'finance') {
    const { data, error } = await supabase
      .from('crm_email_templates')
      .select('*')
      .eq('created_by', userId)
      .eq('visibility', 'private')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // Admin sees everything
  if (role === 'admin') {
    const { data, error } = await supabase
      .from('crm_email_templates')
      .select('*, crm_users!crm_email_templates_created_by_fkey(name)')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // Everyone else: team templates + their own private
  const { data, error } = await supabase
    .from('crm_email_templates')
    .select('*, crm_users!crm_email_templates_created_by_fkey(name)')
    .or(`visibility.eq.team,and(visibility.eq.private,created_by.eq.${userId})`)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST create template
router.post('/templates', auth, async (req, res) => {
  const { role, id: userId } = req.user;
  let { visibility } = req.body;

  // Sales/CSM/Support/Finance can only create private
  if (['sales', 'csm', 'support', 'finance'].includes(role)) {
    visibility = 'private';
  }

  const { data, error } = await supabase
    .from('crm_email_templates')
    .insert([{ ...req.body, visibility, created_by: userId, user_id: userId }])
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PUT update template
router.put('/templates/:id', auth, async (req, res) => {
  const { role, id: userId } = req.user;

  // Fetch template first to check ownership
  const { data: existing } = await supabase
    .from('crm_email_templates')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (!existing) return res.status(404).json({ error: 'Template not found' });

  // Permission check
  const canEdit =
    role === 'admin' ||
    (role === 'marketing' && (existing.visibility === 'team' || existing.created_by === userId)) ||
    existing.created_by === userId;

  if (!canEdit) return res.status(403).json({ error: 'Forbidden' });

  const { data, error } = await supabase
    .from('crm_email_templates')
    .update({ ...req.body, updated_at: new Date() })
    .eq('id', req.params.id)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE template
router.delete('/templates/:id', auth, async (req, res) => {
  const { role, id: userId } = req.user;

  const { data: existing } = await supabase
    .from('crm_email_templates')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (!existing) return res.status(404).json({ error: 'Template not found' });

  const canDelete =
    role === 'admin' ||
    (role === 'marketing' && (existing.visibility === 'team' || existing.created_by === userId)) ||
    existing.created_by === userId;

  if (!canDelete) return res.status(403).json({ error: 'Forbidden' });

  const { error } = await supabase
    .from('crm_email_templates')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── SENT EMAILS ─────────────────────────────────────────────────────────────

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
  const { role } = req.user;
  if (role === 'finance') return res.status(403).json({ error: 'Forbidden' });

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

  await supabase.from('crm_activity_log').insert([{
    company_id,
    person_id: person_id || null,
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