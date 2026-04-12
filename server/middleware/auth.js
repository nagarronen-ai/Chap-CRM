// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const supabase = require('../db');

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'chap_secret');

    // Fetch fresh role from DB so role changes take effect immediately
    const { data: user, error } = await supabase
      .from('crm_users')
      .select('id, email, name, role')
      .eq('id', decoded.id)
      .single();

    if (error || !user) return res.status(401).json({ error: 'User not found' });

    req.user = { id: user.id, email: user.email, name: user.name, role: user.role };    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = auth;