// server/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../db');
const auth = require('../middleware/auth');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET;

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const { data: user, error } = await supabase
    .from('crm_users')
    .select('id, email, name, password, role, timezone')
    .eq('email', email.toLowerCase())
    .single();

  if (error || !user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  await supabase
    .from('crm_users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', user.id);

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, timezone: user.timezone }
  });
});

router.post('/register', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const { email, password, name, role = 'viewer' } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'All fields required' });

  const hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from('crm_users')
    .insert([{ email: email.toLowerCase(), password: hash, name, role }])
    .select('id, email, name, role')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.json({ user: { id: data.id, email: data.email, name: data.name, role: data.role } });
});

module.exports = router;
