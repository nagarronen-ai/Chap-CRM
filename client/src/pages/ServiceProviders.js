import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useApp } from '../context/AppContext';
import { useRole } from '../hooks/useRole';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const formatILS = (n) => `₪${Math.round(Number(n) || 0).toLocaleString()}`;

export default function ServiceProviders() {
  const [providers, setProviders]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [activeFilter, setActiveFilter] = useState('active'); // 'active' | 'inactive' | 'all'
  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding]             = useState(false);
  const [addForm, setAddForm] = useState({
    name: '', contact_name: '', contact_email: '', contact_phone: '',
    commission_rate_default: '', commission_source_default: '', notes: '',
  });
  const navigate = useNavigate();
  const { palette: p } = useApp();
  const { can } = useRole();
  const canEdit = can('company:edit');
  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchProviders(); }, []);

  const fetchProviders = async () => {
    try {
      const res = await axios.get(`${API}/service-providers`, { headers: getHeaders() });
      setProviders(res.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const createProvider = async () => {
    if (!addForm.name.trim()) return;
    setAdding(true);
    try {
      const body = {
        name:                       addForm.name.trim(),
        contact_name:               addForm.contact_name              || null,
        contact_email:              addForm.contact_email             || null,
        contact_phone:              addForm.contact_phone             || null,
        commission_rate_default:    addForm.commission_rate_default === '' ? null : Number(addForm.commission_rate_default),
        commission_source_default:  addForm.commission_source_default || null,
        notes:                      addForm.notes                     || null,
      };
      const res = await axios.post(`${API}/service-providers`, body, { headers: getHeaders() });
      // Newly created provider has zero contracts; backend doesn't include the aggregations in the POST response,
      // so we attach defaults here.
      setProviders(prev => [{ ...res.data, active_contracts: 0, total_po_amount: 0 }, ...prev]);
      setShowAddModal(false);
      setAddForm({ name: '', contact_name: '', contact_email: '', contact_phone: '', commission_rate_default: '', commission_source_default: '', notes: '' });
    } catch (err) { console.error(err); }
    setAdding(false);
  };

  const filtered = providers.filter(pv => {
    if (activeFilter === 'active'   && !pv.is_active) return false;
    if (activeFilter === 'inactive' &&  pv.is_active) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        pv.name?.toLowerCase().includes(s) ||
        pv.contact_name?.toLowerCase().includes(s) ||
        pv.contact_email?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const totalActive     = providers.filter(pv =>  pv.is_active).length;
  const totalInactive   = providers.filter(pv => !pv.is_active).length;
  const totalContracts  = providers.reduce((a, pv) => a + (pv.active_contracts || 0), 0);
  const totalValue      = providers.reduce((a, pv) => a + (pv.total_po_amount   || 0), 0);

  const inputStyle = { background: p.inputBg, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '9px 12px', color: p.text, fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif' };

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: p.background, minHeight: '100vh', transition: 'background 0.4s' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: 40 }}>

        <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>CRM</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ color: p.text, fontSize: 30, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>
            Service Providers / ספקי שירות
          </h1>
          {canEdit && (
            <button onClick={() => setShowAddModal(true)}
              style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
              + Add Service Provider
            </button>
          )}
        </div>

        {/* Stat tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Active',          value: totalActive,            color: '#155724', bg: '#D4EDDA' },
            { label: 'Inactive',        value: totalInactive,          color: '#6C6C6C', bg: '#E0E0E0' },
            { label: 'Total Contracts', value: totalContracts,         color: p.text,    bg: p.cardBg, bordered: true },
            { label: 'Total Value',     value: formatILS(totalValue),  color: p.primary, bg: p.cardBg, bordered: true },
          ].map(({ label, value, color, bg, bordered }) => (
            <div key={label} style={{ background: bg, borderRadius: 12, padding: 20, border: bordered ? `1px solid ${p.cardBorder}` : 'none' }}>
              <p style={{ color, fontSize: 24, fontWeight: 700, margin: 0, fontFamily: 'Playfair Display, Georgia, serif' }}>{value}</p>
              <p style={{ color, fontSize: 11, margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.8 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search providers (name, contact, email)..." style={{ ...inputStyle, flex: 1 }} />
          <select value={activeFilter} onChange={e => setActiveFilter(e.target.value)} style={inputStyle}>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
            <option value="all">All providers</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <p style={{ color: p.textSecondary }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div style={{ background: p.cardBg, borderRadius: 12, padding: 60, textAlign: 'center', border: `1px solid ${p.cardBorder}` }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
            <p style={{ color: p.text, fontSize: 16, fontWeight: 500, margin: '0 0 8px' }}>
              {providers.length === 0 ? 'No service providers yet' : 'No providers match your filters'}
            </p>
            <p style={{ color: p.textSecondary, fontSize: 13, margin: 0 }}>
              {providers.length === 0 ? 'Add your first service provider to get started' : 'Try adjusting your search or filters'}
            </p>
          </div>
        ) : (
          <div style={{ background: p.cardBg, borderRadius: 12, border: `1px solid ${p.cardBorder}`, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: p.inputBg }}>
                  {['Name', 'Contact', 'Email', 'Phone', 'Active Contracts', 'Total Value', 'Status'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: p.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((pv, i) => (
                  <tr key={pv.id} onClick={() => navigate(`/service-providers/${pv.id}`)}
                    style={{ borderTop: `1px solid ${p.cardBorder}`, background: i % 2 === 0 ? p.cardBg : p.inputBg, cursor: 'pointer' }}
                    onMouseOver={e => e.currentTarget.style.background = p.backgroundSecondary}
                    onMouseOut={e  => e.currentTarget.style.background = i % 2 === 0 ? p.cardBg : p.inputBg}>
                    <td style={{ padding: '14px 16px' }}>
                      <p style={{ color: p.text, fontSize: 14, fontWeight: 500, margin: 0 }}>{pv.name}</p>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: p.textSecondary }}>{pv.contact_name  || '—'}</td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: p.textSecondary }}>{pv.contact_email || '—'}</td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: p.textSecondary }}>{pv.contact_phone || '—'}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: p.text, fontWeight: 500 }}>{pv.active_contracts || 0}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: p.primary, fontWeight: 600 }}>{formatILS(pv.total_po_amount || 0)}</td>
                    <td style={{ padding: '14px 16px' }}>
                      {pv.is_active ? (
                        <span style={{ background: '#D4EDDA', color: '#155724', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>Active</span>
                      ) : (
                        <span style={{ background: '#E0E0E0', color: '#6C6C6C', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>Inactive</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
            onClick={() => setShowAddModal(false)}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: p.cardBg, borderRadius: 16, padding: 32, width: 540, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: `1px solid ${p.cardBorder}` }}>
              <h2 style={{ color: p.text, fontSize: 20, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 4px' }}>Add Service Provider</h2>
              <p style={{ color: p.textSecondary, fontSize: 12, margin: '0 0 20px' }}>Required: name. Other fields can be set later.</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                {[
                  { label: 'Name *',                field: 'name',                    type: 'text',  required: true },
                  { label: 'Contact Name',          field: 'contact_name',            type: 'text' },
                  { label: 'Email',                 field: 'contact_email',           type: 'email' },
                  { label: 'Phone',                 field: 'contact_phone',           type: 'tel' },
                  { label: 'Default Commission (%)', field: 'commission_rate_default', type: 'number' },
                ].map(({ label, field, type }) => (
                  <div key={field}>
                    <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>{label}</label>
                    <input type={type} value={addForm[field]}
                      onChange={e => setAddForm(prev => ({ ...prev, [field]: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', ...inputStyle }} />
                  </div>
                ))}
                <div>
                  <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Default Commission Source</label>
                  <select value={addForm.commission_source_default}
                    onChange={e => setAddForm(prev => ({ ...prev, commission_source_default: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', ...inputStyle }}>
                    <option value="">— Not set —</option>
                    <option value="customer">Customer</option>
                    <option value="provider">Provider</option>
                    <option value="both">Both</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Notes</label>
                <textarea value={addForm.notes}
                  onChange={e => setAddForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3} style={{ width: '100%', boxSizing: 'border-box', ...inputStyle, resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={createProvider} disabled={adding || !addForm.name.trim()}
                  style={{ flex: 1, background: adding || !addForm.name.trim() ? p.textMuted : p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 13, cursor: adding || !addForm.name.trim() ? 'default' : 'pointer', fontWeight: 600 }}>
                  {adding ? '⏳ Creating...' : 'Create Provider'}
                </button>
                <button onClick={() => setShowAddModal(false)}
                  style={{ flex: 1, background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '11px', fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
