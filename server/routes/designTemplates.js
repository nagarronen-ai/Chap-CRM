const express = require('express');
const router = express.Router();
const supabase = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_email_design_templates')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', auth, async (req, res) => {
  const { role } = req.user;
  if (!['admin', 'marketing'].includes(role)) return res.status(403).json({ error: 'Forbidden' });
  const { name, type, width, header_html, footer_html, wrapper_html } = req.body;
  const { data, error } = await supabase
    .from('crm_email_design_templates')
    .insert([{ name, type, width: width || 600, header_html, footer_html, wrapper_html, active: true }])
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.put('/:id', auth, async (req, res) => {
  const { role } = req.user;
  if (!['admin', 'marketing'].includes(role)) return res.status(403).json({ error: 'Forbidden' });
  const { data, error } = await supabase
    .from('crm_email_design_templates')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', auth, async (req, res) => {
  const { role } = req.user;
  if (!['admin', 'marketing'].includes(role)) return res.status(403).json({ error: 'Forbidden' });
  const { error } = await supabase
    .from('crm_email_design_templates')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// GET /api/design-templates/type/:type — get active template by type
router.get('/type/:type', async (req, res) => {
  const { data, error } = await supabase
    .from('crm_email_design_templates')
    .select('*')
    .eq('type', req.params.type)
    .eq('active', true)
    .single();
  if (error) return res.status(404).json({ error: 'No active template found' });
  res.json(data);
});

module.exports = router;