const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../db');

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const { data, error } = await supabase.from('crm_users').insert([{ email, password: hashedPassword, name }]).select().single();
    if (error) return res.status(400).json({ error: 'Email already exists' });
    const token = jwt.sign({ id: data.id, email: data.email }, 'venueflow_secret', { expiresIn: '7d' });
    res.json({ token, user: { id: data.id, email: data.email, name: data.name } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data, error } = await supabase.from('crm_users').select('*').eq('email', email).single();
    if (error || !data) return res.status(400).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, data.password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: data.id, email: data.email }, 'venueflow_secret', { expiresIn: '7d' });
    res.json({ token, user: { id: data.id, email: data.email, name: data.name } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
