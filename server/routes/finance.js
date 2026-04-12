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
    const { title, amount, date, category, vendor, status, recurring, notes, receipt_url, recurring_parent_id } = req.body;

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
        notes, receipt_url,
        recurring_parent_id: recurring_parent_id || null,
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
    const { title, amount, date, category, vendor, status, recurring, notes, receipt_url, paid_by, last_paid_date, recurring_interval } = req.body;

    const { data, error } = await supabase
      .from('crm_expenses')
      .update({ title, amount, date, category, vendor, status, recurring, notes, receipt_url, paid_by, last_paid_date, recurring_interval })
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
      try {
        const result = await parseInvoice(req.file.buffer, req.file.mimetype);
        res.json(result);
      } catch (parseErr) {
        if (parseErr.notAnInvoice || parseErr.message === 'NOT_AN_INVOICE') {
          return res.status(422).json({ error: 'NOT_AN_INVOICE' });
        }
        console.error('Invoice parse error:', parseErr.message);
        return res.status(500).json({ error: parseErr.message });
      }
    });
  } catch (err) {
    console.error('Invoice parse error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/finance/expenses/recurring — upcoming recurring payments
router.get('/expenses/recurring', auth, checkPermission('finance:general'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('crm_expenses')
      .select('*')
      .eq('recurring', true)
      .order('date', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const today = new Date();
    const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const withNextDue = (data || []).map(exp => {
      const interval = exp.recurring_interval || 'monthly';
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      // Use last_paid_date if available, otherwise fall back to date
      const baseDate = new Date(exp.last_paid_date || exp.date);

      // Calculate next due by advancing one interval from last paid
      let nextDue = new Date(baseDate);
      if (interval === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1);
      else if (interval === 'quarterly') nextDue.setMonth(nextDue.getMonth() + 3);
      else if (interval === 'yearly') nextDue.setFullYear(nextDue.getFullYear() + 1);

      // If still in the past, keep advancing (handles missed payments)
      while (nextDue < todayStart) {
        if (interval === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1);
        else if (interval === 'quarterly') nextDue.setMonth(nextDue.getMonth() + 3);
        else if (interval === 'yearly') nextDue.setFullYear(nextDue.getFullYear() + 1);
      }

      const daysUntil = Math.ceil((nextDue - todayStart) / (1000 * 60 * 60 * 24));

      return {
        ...exp,
        next_due_date: nextDue.toISOString().split('T')[0],
        days_until: daysUntil,
        due_soon: daysUntil <= 7,
      };
    });

    // Also build yearly projection by month
    const monthlyProjection = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const monthTotal = (data || []).reduce((sum, exp) => {
        const interval = exp.recurring_interval || 'monthly';
        const amount = parseFloat(exp.amount) || 0;
        if (interval === 'monthly') return sum + amount;
        if (interval === 'quarterly' && month % 3 === 1) return sum + amount;
        if (interval === 'yearly' && new Date(exp.date).getMonth() + 1 === month) return sum + amount;
        return sum;
      }, 0);
      return {
        month: new Date(2026, i, 1).toLocaleDateString('en-US', { month: 'short' }),
        amount: Math.round(monthTotal * 100) / 100,
      };
    });

    res.json({
      upcoming: withNextDue.filter(e => e.days_until <= 30).sort((a, b) => a.days_until - b.days_until),
      all_recurring: withNextDue,
      monthly_projection: monthlyProjection,
      yearly_total: Math.round((data || []).reduce((sum, exp) => {
        const interval = exp.recurring_interval || 'monthly';
        const amount = parseFloat(exp.amount) || 0;
        if (interval === 'monthly') return sum + amount * 12;
        if (interval === 'quarterly') return sum + amount * 4;
        if (interval === 'yearly') return sum + amount;
        return sum;
      }, 0) * 100) / 100,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
