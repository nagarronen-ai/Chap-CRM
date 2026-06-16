// server/routes/services.js
// Catalog of services Sensecom sells — used to populate the checklist on the
// client detail Services tab.
const express = require('express');
const router = express.Router();
const supabase = require('../db');
const auth = require('../middleware/auth');

// GET /api/services — list active services for dropdowns / checklists
router.get('/', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('crm_services')
    .select('id, name_en, name_he, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
