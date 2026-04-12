// server/routes/users.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const supabase = require('../db');
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// ─── /me routes MUST come before /:id routes ─────────────────────────────────

// GET /api/users/me — get current user profile
router.get('/me', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_users')
    .select('id, email, name, role, timezone, email_signature, slack_user_id')
    .eq('id', req.user.id)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PUT /api/users/me/timezone — update own timezone
router.put('/me/timezone', auth, async (req, res) => {
  const { timezone } = req.body;
  if (!timezone) return res.status(400).json({ error: 'Timezone required' });
  const { data, error } = await supabase
    .from('crm_users')
    .update({ timezone })
    .eq('id', req.user.id)
    .select('id, email, name, role, timezone')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PUT /api/users/me/slack — update own Slack user ID
router.put('/me/slack', auth, async (req, res) => {
  const { slack_user_id } = req.body;
  const { data, error } = await supabase
    .from('crm_users')
    .update({ slack_user_id: slack_user_id || null })
    .eq('id', req.user.id)
    .select('id, slack_user_id')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});


// PUT /api/users/me/password — change own password
router.put('/me/password', auth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Both current and new password are required' });
  if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

  const { data: user } = await supabase.from('crm_users').select('password').eq('id', req.user.id).single();
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = await bcrypt.compare(current_password, user.password);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const hashed = await bcrypt.hash(new_password, 10);
  await supabase.from('crm_users').update({ password: hashed }).eq('id', req.user.id);
  res.json({ success: true });
});

// PUT /api/users/:id/reset-password — admin resets any user's password
router.put('/:id/reset-password', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const { randomBytes } = require('crypto');
  const tempPassword = randomBytes(4).toString('hex').toUpperCase();
  const hashed = await bcrypt.hash(tempPassword, 10);

  const { error } = await supabase.from('crm_users').update({ password: hashed }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ temp_password: tempPassword });
});
// PUT /api/users/me/signature — update own signature
router.put('/me/signature', auth, async (req, res) => {
  const { signature } = req.body;
  const { data, error } = await supabase
    .from('crm_users')
    .update({ email_signature: signature })
    .eq('id', req.user.id)
    .select('id, email, name, role, email_signature')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── Team management routes (/:id) ───────────────────────────────────────────

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
    const { error: insertError } = await supabase
      .from('crm_users')
      .insert([{ email: email.toLowerCase(), name: full_name, role, password: hash }]);
    if (insertError) return res.status(500).json({ error: insertError.message });
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