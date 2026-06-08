// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const supabase = require('../db');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET;

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

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