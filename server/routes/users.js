// server/routes/users.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const supabase = require('../db');
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// GET all team members — admin only
router.get('/', auth, checkPermission('users:manage'), async (req, res) => {
  const { data, error } = await supabase
    .from('crm_users')
    .select('id, email, name, role, last_login, created_at')
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST invite / create new user — admin only
router.post('/invite', auth, checkPermission('users:manage'), async (req, res) => {
    const { email, full_name, role, password } = req.body;
    if (!email || !full_name || !role) return res.status(400).json({ error: 'email, full_name and role are required' });
  
    const tempPassword = password || 'Planfor2024!';
    const hash = await bcrypt.hash(tempPassword, 10);
  
    // Insert without expecting data back
    const { error: insertError } = await supabase
      .from('crm_users')
      .insert([{ email: email.toLowerCase(), name: full_name, role, password: hash }]);
  
    if (insertError) return res.status(500).json({ error: insertError.message });
  
    // Fetch the newly created user separately
    const { data, error: fetchError } = await supabase
      .from('crm_users')
      .select('id, email, name, role, created_at')
      .eq('email', email.toLowerCase())
      .single();
  
    if (fetchError) return res.status(500).json({ error: fetchError.message });
  
    res.json({ ...data, temp_password: tempPassword });
  });

// PUT change role — admin only
router.put('/:id/role', auth, checkPermission('users:manage'), async (req, res) => {
  const { role } = req.body;
  const validRoles = ['admin', 'sales', 'marketing', 'csm', 'support', 'finance'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const { data, error } = await supabase
    .from('crm_users')
    .update({ role })
    .eq('id', req.params.id)
    .select('id, email, name, role')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE user — admin only (can't delete yourself)
router.delete('/:id', auth, checkPermission('users:manage'), async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "You can't delete yourself" });
  const { error } = await supabase.from('crm_users').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;