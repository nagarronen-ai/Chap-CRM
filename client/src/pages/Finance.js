import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';
const token = () => localStorage.getItem('token');
const headers = () => ({ Authorization: `Bearer ${token()}` });

const CATEGORIES = ['Server', 'Domain', 'Software', 'Marketing', 'Legal', 'Office', 'Salaries', 'Other'];
const STATUSES = ['pending', 'paid', 'overdue'];
const MONTHS = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
  { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
  { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

const STATUS_COLORS = {
  pending: { bg: '#FFF3E0', text: '#E65100', border: '#FFB74D' },
  paid: { bg: '#E8F5E9', text: '#2E7D32', border: '#81C784' },
  overdue: { bg: '#FFEBEE', text: '#C62828', border: '#E57373' },
};

const CATEGORY_ICONS = {
  Server: '🖥️', Domain: '🌐', Software: '💿', Marketing: '📣',
  Legal: '⚖️', Office: '🏢', Salaries: '💰', Other: '📦',
};

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

const inputStyle = {
  width: '100%', padding: '10px 12px', border: '1px solid #D5CEC0', borderRadius: 8,
  fontSize: 14, fontFamily: "'Inter', sans-serif", color: '#3E423D',
  background: '#FFFFFF', outline: 'none', boxSizing: 'border-box',
};

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

export default function Finance() {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: '', amount: '', date: '', category: 'Server',
    vendor: '', status: 'pending', recurring: false, recurring_interval: 'monthly', notes: '', receipt_url: '', paid_by: ''
  });
  const [error, setError] = useState('');
  const [teamUsers, setTeamUsers] = useState([]);
  const [parsedInvoice, setParsedInvoice] = useState(null);
  const [parsingInvoice, setParsingInvoice] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [recurringExpenses, setRecurringExpenses] = useState(null);

  // Per-person state
  const [personData, setPersonData] = useState([]);
  const [personYear, setPersonYear] = useState(String(currentYear));
  const [personMonth, setPersonMonth] = useState('');
  const [personLoading, setPersonLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterCategory) params.category = filterCategory;
      if (filterStatus) params.status = filterStatus;

      const [expRes, sumRes] = await Promise.all([
        axios.get(`${API}/finance/expenses`, { headers: headers(), params }),
        axios.get(`${API}/finance/expenses/summary`, { headers: headers() }),
      ]);
      setExpenses(expRes.data);
      setSummary(sumRes.data);
    } catch (err) {
      if (err.response?.status === 401) navigate('/login');
      if (err.response?.status === 403) setError('You do not have access to Finance.');
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterStatus, navigate]);

  const fetchPersonData = useCallback(async () => {
    try {
      setPersonLoading(true);
      const params = { year: personYear };
      if (personMonth) params.month = personMonth;
      const res = await axios.get(`${API}/finance/expenses/by-person`, { headers: headers(), params });
      setPersonData(res.data);
    } catch (err) {
      // silently fail
    } finally {
      setPersonLoading(false);
    }
  }, [personYear, personMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const fetchRecurring = async () => {
      try {
        const res = await axios.get(`${API}/finance/expenses/recurring`, { headers: headers() });
        setRecurringExpenses(res.data);
      } catch (err) { console.error(err); }
    };
    fetchRecurring();
  }, []);
  useEffect(() => { fetchPersonData(); }, [fetchPersonData]);

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const res = await axios.get(`${API}/users`, { headers: headers() });
        setTeamUsers(res.data || []);
      } catch (err) { /* non-admin won't see team list */ }
    };
    fetchTeam();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ title: '', amount: '', date: '', category: 'Server', vendor: '', status: 'pending', recurring: false, notes: '', receipt_url: '', paid_by: '' });
    setShowModal(true);
  };

  const openEdit = (exp) => {
    setEditing(exp);
    setForm({
      title: exp.title, amount: exp.amount, date: exp.date, category: exp.category,
      vendor: exp.vendor || '', status: exp.status, recurring: exp.recurring || false,
      notes: exp.notes || '', receipt_url: exp.receipt_url || '', paid_by: exp.paid_by || '',
      recurring_interval: exp.recurring_interval || 'monthly'
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.amount || !form.date || !form.category) {
      setError('Title, amount, date, and category are required.');
      return;
    }
    try {
      if (editing) {
        await axios.put(`${API}/finance/expenses/${editing.id}`, form, { headers: headers() });
      } else {
        await axios.post(`${API}/finance/expenses`, form, { headers: headers() });
      }
      setShowModal(false);
      setError('');
      fetchData();
      fetchPersonData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save expense.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await axios.delete(`${API}/finance/expenses/${id}`, { headers: headers() });
      fetchData();
      fetchPersonData();
    } catch (err) {
      setError('Failed to delete expense.');
    }
  };

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';

  const personTotal = personData.reduce((sum, p) => sum + p.total, 0);
  const periodLabel = personMonth
    ? `${MONTHS.find(m => m.value === personMonth)?.label} ${personYear}`
    : `Year ${personYear}`;

  if (error === 'You do not have access to Finance.') {
    return (
      <div style={{ display: 'flex', fontFamily: "'Inter', sans-serif" }}>
        <Sidebar />
        <div style={{ marginLeft: 220, padding: 32, flex: 1 }}>
          <p style={{ color: '#D4183D', fontSize: 16 }}>You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', fontFamily: "'Inter', sans-serif", background: '#E5E1D8', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, padding: 32, flex: 1 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#3E423D', margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>Finance</h1>
            <p style={{ color: '#5A6059', fontSize: 14, margin: '4px 0 0' }}>Track company expenses and spending</p>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.15)', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: parsingInvoice ? 'not-allowed' : 'pointer', fontFamily: "'Inter', sans-serif", opacity: parsingInvoice ? 0.6 : 1 }}>
                {parsingInvoice ? '⏳ Parsing...' : '📄 Upload Invoice'}
                <input type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  setParsingInvoice(true);
                  try {
                    const formData = new FormData();
                    formData.append('invoice', file);
                    
                    // Parse invoice with Claude
                    const parseRes = await axios.post(`${API}/finance/invoices/parse`, formData, {
                      headers: { ...headers(), 'Content-Type': 'multipart/form-data' }
                    });

                    // Also upload file as receipt
                    const receiptForm = new FormData();
                    receiptForm.append('file', file);
                    let receiptUrl = '';
                    try {
                      const uploadRes = await axios.post(`${API}/uploads/receipts`, receiptForm, {
                        headers: { ...headers(), 'Content-Type': 'multipart/form-data' }
                      });
                      receiptUrl = uploadRes.data.url || '';
                    } catch (uploadErr) {
                      console.error('Receipt upload failed:', uploadErr.message);
                    }

                    setParsedInvoice(parseRes.data);
                    setForm({
                      title: parseRes.data.title || '',
                      amount: parseRes.data.amount || '',
                      date: parseRes.data.date || new Date().toISOString().split('T')[0],
                      category: parseRes.data.category || 'Other',
                      vendor: parseRes.data.vendor || '',
                      status: 'paid',
                      recurring: parseRes.data.recurring || false,
                      recurring_interval: parseRes.data.recurring_interval || 'monthly',
                      notes: parseRes.data.notes || '',
                      receipt_url: receiptUrl,
                      paid_by: user.id || '',
                    });
                    setEditing(null);
                    setShowModal(true);
                  } catch (err) {
                    setError('Failed to parse invoice: ' + (err.response?.data?.error || err.message));
                  }
                  setParsingInvoice(false);
                  e.target.value = '';
                }} />
              </label>
              <button onClick={openAdd} style={{
                background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
              }}>
                + Add Expense
              </button>
            </div>
          )}
        </div>

        {/* Yearly Projection */}
        {recurringExpenses && recurringExpenses.monthly_projection && (
          <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '24px 28px', border: '1px solid rgba(62,66,61,0.08)', marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#3E423D', margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>Recurring Expenses Projection</h2>
                <p style={{ color: '#717182', fontSize: 13, margin: '4px 0 0' }}>Estimated yearly cost: <strong style={{ color: '#3E423D' }}>${recurringExpenses.yearly_total?.toLocaleString()}</strong></p>
              </div>
              <span style={{ background: '#F5F3EF', color: '#8E9B8B', fontSize: 12, borderRadius: 8, padding: '6px 14px', fontWeight: 600 }}>
                {recurringExpenses.all_recurring?.length || 0} recurring expenses
              </span>
            </div>
            {/* Bar chart */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
              {recurringExpenses.monthly_projection.map((m, i) => {
                const max = Math.max(...recurringExpenses.monthly_projection.map(x => x.amount), 1);
                const height = Math.max((m.amount / max) * 100, m.amount > 0 ? 4 : 2);
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <p style={{ color: '#717182', fontSize: 9, margin: 0, fontWeight: 600 }}>${m.amount > 0 ? m.amount.toFixed(0) : ''}</p>
                    <div style={{ width: '100%', height: height, background: m.amount > 0 ? '#8E9B8B' : '#E5E1D8', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }} title={`${m.month}: $${m.amount}`} />
                    <p style={{ color: '#717182', fontSize: 10, margin: 0 }}>{m.month}</p>
                  </div>
                );
              })}
            </div>
            {/* Upcoming this week */}
            {recurringExpenses.upcoming?.filter(e => e.due_soon).length > 0 && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(62,66,61,0.08)' }}>
                <p style={{ color: '#717182', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600, margin: '0 0 10px' }}>Due This Week</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recurringExpenses.upcoming.filter(e => e.due_soon).map(exp => (
                    <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#F5F3EF', borderRadius: 8 }}>
                      <div>
                        <p style={{ color: '#3E423D', fontSize: 13, fontWeight: 500, margin: 0 }}>{exp.title}</p>
                        <p style={{ color: '#717182', fontSize: 11, margin: '2px 0 0' }}>{exp.vendor} · {exp.next_due_date}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ color: '#3E423D', fontSize: 13, fontWeight: 700, margin: 0 }}>${parseFloat(exp.amount).toFixed(2)}</p>
                        <p style={{ color: exp.days_until <= 2 ? '#D4183D' : '#D4A574', fontSize: 11, fontWeight: 600, margin: '2px 0 0' }}>
                          {exp.days_until === 0 ? 'Today' : exp.days_until === 1 ? 'Tomorrow' : `In ${exp.days_until}d`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'This Month', value: fmt(summary.totalThisMonth), icon: '📅', color: '#8E9B8B' },
            { label: 'This Year', value: fmt(summary.totalThisYear), icon: '📊', color: '#94B0BC' },
            { label: 'Pending', value: fmt(summary.totalPending), icon: '⏳', color: '#D4A574' },
            { label: 'Overdue', value: fmt(summary.totalOverdue), icon: '🚨', color: '#D4183D' },
          ].map((card, i) => (
            <div key={i} style={{
              background: '#FFFFFF', borderRadius: 12, padding: '20px 24px',
              border: '1px solid rgba(62,66,61,0.08)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#5A6059', fontWeight: 500 }}>{card.label}</span>
                <span style={{ fontSize: 20 }}>{card.icon}</span>
              </div>
              <p style={{ fontSize: 24, fontWeight: 700, color: card.color, margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Per-Person Spending Breakdown */}
        <div style={{
          background: '#FFFFFF', borderRadius: 12, padding: '24px 28px',
          border: '1px solid rgba(62,66,61,0.08)', marginBottom: 28,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#3E423D', margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>
                Spending by Person
              </h2>
              <p style={{ fontSize: 13, color: '#717182', margin: '4px 0 0' }}>{periodLabel}</p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <select value={personYear} onChange={e => setPersonYear(e.target.value)}
                style={{ ...inputStyle, width: 110, cursor: 'pointer', padding: '8px 10px', fontSize: 13 }}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={personMonth} onChange={e => setPersonMonth(e.target.value)}
                style={{ ...inputStyle, width: 140, cursor: 'pointer', padding: '8px 10px', fontSize: 13 }}>
                <option value="">All Year</option>
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          {personLoading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#717182' }}>Loading...</div>
          ) : personData.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#717182' }}>No expenses for this period.</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${personData.length}, 1fr)`, gap: 16, marginBottom: 20 }}>
                {personData.map((person, i) => {
                  const percentage = personTotal > 0 ? ((person.total / personTotal) * 100).toFixed(1) : 0;
                  const colors = ['#8E9B8B', '#94B0BC', '#B4A5D6', '#D4A574', '#717182'];
                  const color = colors[i % colors.length];
                  return (
                    <div key={person.paid_by} style={{
                      background: '#F5F3EF', borderRadius: 10, padding: '18px 20px',
                      borderLeft: `4px solid ${color}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#3E423D' }}>{person.name}</span>
                        <span style={{ fontSize: 11, color: '#717182', background: '#FFFFFF', padding: '2px 8px', borderRadius: 4 }}>
                          {percentage}%
                        </span>
                      </div>
                      <p style={{ fontSize: 22, fontWeight: 700, color, margin: '0 0 10px', fontFamily: "'Playfair Display', Georgia, serif" }}>
                        {fmt(person.total)}
                      </p>
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#5A6059' }}>
                        <span>✅ Paid: {fmt(person.paid)}</span>
                        <span>⏳ Pending: {fmt(person.pending)}</span>
                      </div>
                      {person.overdue > 0 && (
                        <div style={{ fontSize: 11, color: '#D4183D', marginTop: 4 }}>
                          🚨 Overdue: {fmt(person.overdue)}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#717182', marginTop: 6 }}>
                        {person.count} expense{person.count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Combined bar */}
              <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#E5E1D8' }}>
                {personData.map((person, i) => {
                  const percentage = personTotal > 0 ? (person.total / personTotal) * 100 : 0;
                  const colors = ['#8E9B8B', '#94B0BC', '#B4A5D6', '#D4A574', '#717182'];
                  return (
                    <div key={person.paid_by} style={{
                      width: `${percentage}%`, background: colors[i % colors.length],
                      transition: 'width 0.3s ease',
                    }} />
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <span style={{ fontSize: 13, color: '#5A6059' }}>
                  Combined: <strong style={{ color: '#3E423D' }}>{fmt(personTotal)}</strong>
                </span>
              </div>
            </>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            style={{ ...inputStyle, width: 180, cursor: 'pointer' }}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ ...inputStyle, width: 160, cursor: 'pointer' }}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          {(filterCategory || filterStatus) && (
            <button onClick={() => { setFilterCategory(''); setFilterStatus(''); }}
              style={{ background: 'none', border: '1px solid #D5CEC0', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: '#5A6059', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
              Clear filters
            </button>
          )}
        </div>

        {/* Expenses Table */}
        <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid rgba(62,66,61,0.08)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#717182' }}>Loading...</div>
          ) : expenses.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#717182' }}>
              No expenses found. {isAdmin && 'Click "+ Add Expense" to get started.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(62,66,61,0.08)' }}>
                {['Title', 'Category', 'Amount', 'Date', 'Vendor', 'Paid By', 'Status', 'Receipt', 'Recurring', isAdmin ? 'Actions' : ''].filter(Boolean).map(h => (
                      <th key={h} style={{
                      textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600,
                      color: '#717182', textTransform: 'uppercase', letterSpacing: 0.5,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.map(exp => (
                  <tr key={exp.id} style={{ borderBottom: '1px solid rgba(62,66,61,0.04)', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F5F3EF'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 500, color: '#3E423D' }}>
                      {exp.title}
                      {exp.notes && <p style={{ fontSize: 12, color: '#717182', margin: '2px 0 0', fontWeight: 400 }}>{exp.notes.length > 50 ? exp.notes.slice(0, 50) + '...' : exp.notes}</p>}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#5A6059' }}>
                      <span style={{ marginRight: 6 }}>{CATEGORY_ICONS[exp.category] || '📦'}</span>{exp.category}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 600, color: '#3E423D' }}>{fmt(exp.amount)}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#5A6059' }}>
                      {new Date(exp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#5A6059' }}>{exp.vendor || '—'}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#5A6059' }}>{exp.paid_by_user?.name || '—'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: STATUS_COLORS[exp.status]?.bg, color: STATUS_COLORS[exp.status]?.text,
                        border: `1px solid ${STATUS_COLORS[exp.status]?.border}`,
                      }}>
                        {exp.status.charAt(0).toUpperCase() + exp.status.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13 }}>{exp.receipt_url ? <a href={exp.receipt_url} target="_blank" rel="noreferrer" style={{ color: '#94B0BC', textDecoration: 'none' }}>📎 View</a> : <span style={{ color: '#CBCED4' }}>—</span>}</td>
                    {isAdmin && (
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => openEdit(exp)}
                            style={{ background: 'none', border: '1px solid #D5CEC0', borderRadius: 6, padding: '4px 12px', fontSize: 12, color: '#5A6059', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                            Edit
                          </button>
                          <button onClick={() => handleDelete(exp.id)}
                            style={{ background: 'none', border: '1px solid #E57373', borderRadius: 6, padding: '4px 12px', fontSize: 12, color: '#D4183D', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Paid Total Footer */}
        {!loading && expenses.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <div style={{ background: '#FFFFFF', borderRadius: 10, padding: '12px 24px', border: '1px solid rgba(62,66,61,0.08)' }}>
              <span style={{ fontSize: 13, color: '#5A6059', marginRight: 12 }}>Total Paid:</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#8E9B8B', fontFamily: "'Playfair Display', Georgia, serif" }}>
                {fmt(summary.totalPaid)}
              </span>
            </div>
          </div>
        )}

        {error && error !== 'You do not have access to Finance.' && (
          <div style={{ marginTop: 16, padding: '10px 16px', background: '#FFEBEE', borderRadius: 8, color: '#C62828', fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#FFFFFF', borderRadius: 16, padding: 32, width: 520,
            maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#3E423D', margin: '0 0 24px', fontFamily: "'Playfair Display', Georgia, serif" }}>
              {editing ? 'Edit Expense' : 'Add Expense'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#5A6059', display: 'block', marginBottom: 4 }}>Title *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Supabase Pro Plan" style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#5A6059', display: 'block', marginBottom: 4 }}>Amount (USD) *</label>
                  <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#5A6059', display: 'block', marginBottom: 4 }}>Date *</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#5A6059', display: 'block', marginBottom: 4 }}>Category *</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#5A6059', display: 'block', marginBottom: 4 }}>Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                    {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#5A6059', display: 'block', marginBottom: 4 }}>Vendor / Supplier</label>
                  <input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} placeholder="e.g. Supabase, Vercel" style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#5A6059', display: 'block', marginBottom: 4 }}>Paid By</label>
                  <select value={form.paid_by} onChange={e => setForm({ ...form, paid_by: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">Select team member</option>
                    {teamUsers.filter(u => u.role === 'admin').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#5A6059', display: 'block', marginBottom: 4 }}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Optional notes..." style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#5A6059', display: 'block', marginBottom: 4 }}>Receipt</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const formData = new FormData();
                      formData.append('file', file);
                      try {
                        const res = await axios.post(`${API}/uploads/receipts`, formData, {
                          headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'multipart/form-data' }                        });
                        setForm(prev => ({ ...prev, receipt_url: res.data.url }));
                      } catch (err) { console.error(err); alert('Upload failed'); }
                    }}
                    style={{ fontSize: 12, flex: 1 }}
                  />
                  {form.receipt_url && <a href={form.receipt_url} target="_blank" rel="noreferrer" style={{ color: '#94B0BC', fontSize: 12, whiteSpace: 'nowrap' }}>View</a>}
                </div>
                {!form.receipt_url && <input value={form.receipt_url || ''} onChange={e => setForm({ ...form, receipt_url: e.target.value })} placeholder="Or paste URL..." style={{ ...inputStyle, marginTop: 6, fontSize: 12 }} />}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" checked={form.recurring} onChange={e => setForm({ ...form, recurring: e.target.checked })}
                  style={{ width: 16, height: 16, accentColor: '#8E9B8B' }} />
                <label style={{ fontSize: 13, color: '#5A6059' }}>Recurring expense</label>
              </div>
              {form.recurring && (
                <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#5A6059', display: 'block', marginBottom: 4 }}>Billing Interval</label>
                <select value={form.recurring_interval || 'monthly'} onChange={e => setForm({ ...form, recurring_interval: e.target.value })} style={inputStyle}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 28 }}>
              <button onClick={() => setShowModal(false)}
                style={{ background: 'none', border: '1px solid #D5CEC0', borderRadius: 8, padding: '10px 20px', fontSize: 14, color: '#5A6059', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                Cancel
              </button>
              <button onClick={handleSave}
                style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                {editing ? 'Update' : 'Add Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}