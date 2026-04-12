const express = require('express');
const router = express.Router();
const supabase = require('../db');
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

// GET /api/finance/expenses — list all expenses (admin + finance)
router.get('/expenses', auth, checkPermission('finance:general'), async (req, res) => {
  try {
    const { category, status, from, to } = req.query;

    let query = supabase
      .from('crm_expenses')
      .select('*, paid_by_user:crm_users!paid_by(name)')
      .order('date', { ascending: false });

    if (category) query = query.eq('category', category);
    if (status) query = query.eq('status', status);
    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/finance/expenses/summary — summary stats
router.get('/expenses/summary', auth, checkPermission('finance:general'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('crm_expenses')
      .select('amount, status, date');

    if (error) return res.status(500).json({ error: error.message });

    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const thisYear = now.getFullYear().toString();

    const summary = {
      totalThisMonth: 0,
      totalThisYear: 0,
      totalPending: 0,
      totalOverdue: 0,
      totalPaid: 0,
      count: data.length,
    };

    data.forEach(exp => {
      const amt = parseFloat(exp.amount) || 0;
      if (exp.date?.startsWith(thisMonth)) summary.totalThisMonth += amt;
      if (exp.date?.startsWith(thisYear)) summary.totalThisYear += amt;
      if (exp.status === 'pending') summary.totalPending += amt;
      if (exp.status === 'overdue') summary.totalOverdue += amt;
      if (exp.status === 'paid') summary.totalPaid += amt;
    });

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/finance/expenses/by-person — spending grouped by person
router.get('/expenses/by-person', auth, checkPermission('finance:general'), async (req, res) => {
  try {
    const { month, year } = req.query;

    let query = supabase
      .from('crm_expenses')
      .select('amount, paid_by, status, date, paid_by_user:crm_users!paid_by(name)');

    if (month && year) {
      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const endMonth = parseInt(month);
      const endYear = parseInt(year);
      const nextMonth = endMonth === 12 ? 1 : endMonth + 1;
      const nextYear = endMonth === 12 ? endYear + 1 : endYear;
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
      query = query.gte('date', startDate).lt('date', endDate);
    } else if (year) {
      query = query.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const grouped = {};
    data.forEach(exp => {
      const id = exp.paid_by || 'unknown';
      if (!grouped[id]) {
        grouped[id] = {
          paid_by: id,
          name: exp.paid_by_user?.name || 'Unknown',
          total: 0,
          paid: 0,
          pending: 0,
          overdue: 0,
          count: 0,
        };
      }
      const amt = parseFloat(exp.amount) || 0;
      grouped[id].total += amt;
      grouped[id].count += 1;
      if (exp.status === 'paid') grouped[id].paid += amt;
      if (exp.status === 'pending') grouped[id].pending += amt;
      if (exp.status === 'overdue') grouped[id].overdue += amt;
    });

    res.json(Object.values(grouped));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/expenses — create expense (admin only)
router.post('/expenses', auth, checkPermission('finance:general'), async (req, res) => {
  try {
    const { title, amount, date, category, vendor, status, recurring, notes, receipt_url } = req.body;

    if (!title || !amount || !date || !category) {
      return res.status(400).json({ error: 'Title, amount, date, and category are required' });
    }

    const { data, error } = await supabase
      .from('crm_expenses')
      .insert([{
        title, amount, date, category, vendor,
        paid_by: req.body.paid_by || req.user.id,
        status: status || 'pending',
        recurring: recurring || false,
        notes, receipt_url
      }])
      .select('*, paid_by_user:crm_users!paid_by(name)')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/finance/expenses/:id — update expense (admin only)
router.put('/expenses/:id', auth, checkPermission('finance:general'), async (req, res) => {
  try {
    const { title, amount, date, category, vendor, status, recurring, notes, receipt_url, paid_by } = req.body;

    const { data, error } = await supabase
      .from('crm_expenses')
      .update({ title, amount, date, category, vendor, status, recurring, notes, receipt_url, paid_by })
      .eq('id', req.params.id)
      .select('*, paid_by_user:crm_users!paid_by(name)')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/finance/expenses/:id — delete expense (admin only)
router.delete('/expenses/:id', auth, checkPermission('finance:general'), async (req, res) => {
  try {
    const { error } = await supabase
      .from('crm_expenses')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/invoices/parse — parse invoice with Claude Vision
router.post('/invoices/parse', auth, checkPermission('finance:general'), async (req, res) => {
  try {
    const multer = require('multer');
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }).single('invoice');

    upload(req, res, async (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const { parseInvoice } = require('../services/invoiceParser');
      const result = await parseInvoice(req.file.buffer, req.file.mimetype);
      res.json(result);
    });
  } catch (err) {
    console.error('Invoice parse error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
