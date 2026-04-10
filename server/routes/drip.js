const express = require('express');
const router = express.Router();
const supabase = require('../db');
const auth = require('../middleware/auth');

// ─── SEQUENCES ────────────────────────────────────────────────────────────────

router.get('/sequences', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_drip_sequences')
    .select('*, crm_drip_steps(id)')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const withCounts = await Promise.all(data.map(async (seq) => {
    const { count } = await supabase
      .from('crm_drip_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('sequence_id', seq.id)
      .eq('completed', false);
    return { ...seq, step_count: seq.crm_drip_steps?.length || 0, enrollment_count: count || 0 };
  }));

  res.json(withCounts);
});

router.post('/sequences', auth, async (req, res) => {
  const { name, audience } = req.body;
  const { data, error } = await supabase
    .from('crm_drip_sequences')
    .insert([{ name, audience: audience || 'waitlist', active: false }])
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.put('/sequences/:id', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_drip_sequences')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/sequences/:id', auth, async (req, res) => {
  const { error } = await supabase
    .from('crm_drip_sequences')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── STEPS ────────────────────────────────────────────────────────────────────

router.get('/sequences/:id/steps', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_drip_steps')
    .select('*, crm_email_design_templates(name)')
    .eq('sequence_id', req.params.id)
    .order('step_number', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/sequences/:id/steps', auth, async (req, res) => {
  const { step_number, delay_days, subject, body_html, design_template_id } = req.body;
  const { data, error } = await supabase
    .from('crm_drip_steps')
    .insert([{
      sequence_id: req.params.id,
      step_number, delay_days,
      subject: subject || '',
      body_html: body_html || '',
      design_template_id: design_template_id || null,
      active: true,
    }])
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.put('/steps/:id', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_drip_steps')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/steps/:id', auth, async (req, res) => {
  const { error } = await supabase
    .from('crm_drip_steps')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── ENROLLMENTS ──────────────────────────────────────────────────────────────

router.get('/sequences/:id/enrollments', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_drip_enrollments')
    .select('*')
    .eq('sequence_id', req.params.id)
    .order('enrolled_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;