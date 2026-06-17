import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useApp } from '../context/AppContext';
import { useRole } from '../hooks/useRole';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const formatILS = (n) => `₪${Math.round(Number(n) || 0).toLocaleString()}`;

// Matches the Services-tab pills in ClientProfile.js
const SERVICE_STATUS = {
  active:   { bg: '#D4EDDA', fg: '#155724', label: 'Active'   },
  prospect: { bg: '#FFF3CD', fg: '#856404', label: 'Prospect' },
  past:     { bg: '#E0E0E0', fg: '#6C6C6C', label: 'Past'     },
  lost:     { bg: '#F8D7DA', fg: '#721C24', label: 'Lost'     },
};

const COMMISSION_SOURCE_LABELS = {
  customer: 'Customer',
  provider: 'Provider',
  both:     'Both',
};

export default function ServiceProviderProfile() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { palette: p } = useApp();
  const { can }      = useRole();
  const canEdit      = can('company:edit');

  const [provider, setProvider]               = useState(null);
  const [loading, setLoading]                 = useState(true);
  const [editingField, setEditingField]       = useState(null);
  const [draft, setDraft]                     = useState('');
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchProvider(); }, [id]);

  const fetchProvider = async () => {
    try {
      const res = await axios.get(`${API}/service-providers/${id}`, { headers: getHeaders() });
      setProvider(res.data);
    } catch (err) {
      console.error(err);
      if (err?.response?.status === 404) navigate('/service-providers');
    }
    setLoading(false);
  };

  const startEdit = (field) => {
    if (!canEdit) return;
    setEditingField(field);
    setDraft(provider[field] ?? '');
  };

  const cancelEdit = () => { setEditingField(null); setDraft(''); };

  // commitEdit: for input cells (text + number). Saves on blur / Enter.
  const commitEdit = async () => {
    if (!editingField) return;
    const field = editingField;
    let value = draft;
    if (field === 'commission_rate_default') {
      value = value === '' ? null : Number(value);
      if (Number.isNaN(value)) { cancelEdit(); return; }
    } else {
      value = value === '' ? null : value;
    }
    const current = provider[field] ?? null;
    if (value === current || (current == null && (value == null || value === ''))) { cancelEdit(); return; }
    try {
      const res = await axios.put(`${API}/service-providers/${id}`, { [field]: value }, { headers: getHeaders() });
      setProvider(prev => ({ ...prev, [field]: res.data[field] }));
    } catch (err) { console.error(err); }
    cancelEdit();
  };

  // commitImmediateChange: for the commission_source_default <select>. Saves on
  // change since native selects don't reliably blur after a pick.
  const commitImmediateChange = async (field, rawValue) => {
    const value = rawValue === '' ? null : rawValue;
    if (value === (provider[field] ?? null)) { cancelEdit(); return; }
    try {
      const res = await axios.put(`${API}/service-providers/${id}`, { [field]: value }, { headers: getHeaders() });
      setProvider(prev => ({ ...prev, [field]: res.data[field] }));
    } catch (err) { console.error(err); }
    cancelEdit();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter')      { e.preventDefault(); commitEdit(); }
    else if (e.key === 'Escape'){ e.preventDefault(); cancelEdit(); }
  };

  const deactivate = async () => {
    try {
      await axios.delete(`${API}/service-providers/${id}`, { headers: getHeaders() });
      navigate('/service-providers');
    } catch (err) { console.error(err); }
  };

  const reactivate = async () => {
    try {
      const res = await axios.put(`${API}/service-providers/${id}`, { is_active: true }, { headers: getHeaders() });
      setProvider(prev => ({ ...prev, is_active: res.data.is_active }));
    } catch (err) { console.error(err); }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: p.background, minHeight: '100vh' }}>
        <Sidebar />
        <div style={{ marginLeft: 220, flex: 1, padding: 40, color: p.textSecondary }}>Loading...</div>
      </div>
    );
  }
  if (!provider) {
    return (
      <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: p.background, minHeight: '100vh' }}>
        <Sidebar />
        <div style={{ marginLeft: 220, flex: 1, padding: 40, color: p.textSecondary }}>Provider not found</div>
      </div>
    );
  }

  const card = { background: p.cardBg, borderRadius: 12, border: `1px solid ${p.cardBorder}` };
  const editInputStyle = { background: p.inputBg, border: `1px solid ${p.primary}`, borderRadius: 6, padding: '6px 8px', color: p.text, fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box' };
  const readFieldStyle = { color: p.text, fontSize: 13, margin: 0, padding: '6px 8px', borderRadius: 6, background: p.inputBg, cursor: canEdit ? 'pointer' : 'default' };

  const renderText = (field, displayValue) => {
    if (editingField === field) {
      return (
        <input autoFocus value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitEdit} onKeyDown={onKeyDown}
          style={editInputStyle} />
      );
    }
    return (
      <p onClick={() => startEdit(field)} style={{ ...readFieldStyle, color: displayValue ? p.text : p.textMuted }}>
        {displayValue || '—'}
      </p>
    );
  };

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: p.background, minHeight: '100vh', transition: 'background 0.4s' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: 40 }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button onClick={() => navigate('/service-providers')}
            style={{ background: 'none', border: 'none', color: p.primary, fontSize: 12, cursor: 'pointer', padding: 0 }}>
            ← All service providers
          </button>
        </div>

        {/* Header */}
        <div style={{ ...card, padding: 28, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>Service Provider / ספק שירות</p>
              {editingField === 'name' ? (
                <input autoFocus value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onBlur={commitEdit} onKeyDown={onKeyDown}
                  style={{ ...editInputStyle, fontSize: 26, fontWeight: 600, fontFamily: 'Playfair Display, Georgia, serif', padding: '6px 10px' }} />
              ) : (
                <h1 onClick={() => canEdit && startEdit('name')}
                  style={{ color: p.text, fontSize: 28, fontWeight: 600, fontFamily: 'Playfair Display, Georgia, serif', margin: 0, cursor: canEdit ? 'pointer' : 'default' }}>
                  {provider.name}
                </h1>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, marginLeft: 16 }}>
              {provider.is_active ? (
                <span style={{ background: '#D4EDDA', color: '#155724', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>Active</span>
              ) : (
                <span style={{ background: '#E0E0E0', color: '#6C6C6C', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>Inactive</span>
              )}
              {canEdit && provider.is_active && (
                <button onClick={() => setConfirmDeactivate(true)}
                  style={{ background: 'transparent', color: '#D4183D', border: `1px solid ${p.cardBorder}`, borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
                  Deactivate
                </button>
              )}
              {canEdit && !provider.is_active && (
                <button onClick={reactivate}
                  style={{ background: 'transparent', color: '#155724', border: `1px solid ${p.cardBorder}`, borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
                  Reactivate
                </button>
              )}
            </div>
          </div>

          {/* Contact fields grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
            {[
              { label: 'Contact Name', field: 'contact_name' },
              { label: 'Email',        field: 'contact_email' },
              { label: 'Phone',        field: 'contact_phone' },
            ].map(({ label, field }) => (
              <div key={field}>
                <p style={{ color: p.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>{label}</p>
                {renderText(field, provider[field])}
              </div>
            ))}
            <div>
              <p style={{ color: p.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Default Commission Source</p>
              {editingField === 'commission_source_default' ? (
                <select autoFocus value={provider.commission_source_default || ''}
                  onChange={e => commitImmediateChange('commission_source_default', e.target.value)}
                  onBlur={cancelEdit} onKeyDown={onKeyDown}
                  style={editInputStyle}>
                  <option value="">— Not set —</option>
                  <option value="customer">Customer</option>
                  <option value="provider">Provider</option>
                  <option value="both">Both</option>
                </select>
              ) : (
                <p onClick={() => startEdit('commission_source_default')}
                  style={{ ...readFieldStyle, color: provider.commission_source_default ? p.text : p.textMuted }}>
                  {COMMISSION_SOURCE_LABELS[provider.commission_source_default] || '—'}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 16 }}>
            <div>
              <p style={{ color: p.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Default Commission</p>
              {editingField === 'commission_rate_default' ? (
                <input autoFocus type="number" step="0.01" value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onBlur={commitEdit} onKeyDown={onKeyDown}
                  style={editInputStyle} />
              ) : (
                <p onClick={() => startEdit('commission_rate_default')}
                  style={{ ...readFieldStyle, color: provider.commission_rate_default != null ? p.text : p.textMuted }}>
                  {provider.commission_rate_default != null ? `${provider.commission_rate_default}%` : '—'}
                </p>
              )}
            </div>
            <div>
              <p style={{ color: p.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Notes</p>
              {renderText('notes', provider.notes)}
            </div>
          </div>
        </div>

        {/* Info bar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div style={{ ...card, padding: 20 }}>
            <p style={{ color: p.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Active Contracts</p>
            <p style={{ color: p.text, fontSize: 24, fontWeight: 700, margin: 0, fontFamily: 'Playfair Display, Georgia, serif' }}>{provider.active_contracts || 0}</p>
          </div>
          <div style={{ ...card, padding: 20 }}>
            <p style={{ color: p.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Total Value</p>
            <p style={{ color: p.primary, fontSize: 24, fontWeight: 700, margin: 0, fontFamily: 'Playfair Display, Georgia, serif' }}>{formatILS(provider.total_po_amount || 0)}</p>
          </div>
          <div style={{ ...card, padding: 20 }}>
            <p style={{ color: p.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Created</p>
            <p style={{ color: p.text, fontSize: 14, fontWeight: 500, margin: '4px 0 0' }}>{new Date(provider.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Contracts table (read-only — Session 2 wires editing from the Services tab) */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${p.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: 0 }}>Contracts ({(provider.contracts || []).length})</h3>
            <p style={{ color: p.textSecondary, fontSize: 11, margin: 0 }}>Read-only · attach providers from each client's Services tab (Session 2)</p>
          </div>
          {(provider.contracts || []).length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <p style={{ color: p.textMuted, fontSize: 13, margin: 0 }}>No contracts yet — this provider isn't attached to any customer services.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: p.inputBg }}>
                  {['Customer', 'Service', 'PO Number', 'PO Amount', 'Commission', 'Service Status'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: p.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(provider.contracts || []).map((c, i) => {
                  const cs      = c.crm_customer_services;
                  const client  = cs?.crm_clients;
                  const service = cs?.crm_services;
                  const status  = cs?.status || 'active';
                  const sc      = SERVICE_STATUS[status] || SERVICE_STATUS.active;
                  return (
                    <tr key={c.id} onClick={() => client?.id && navigate(`/clients/${client.id}`)}
                      style={{ borderTop: `1px solid ${p.cardBorder}`, background: i % 2 === 0 ? p.cardBg : p.inputBg, cursor: client?.id ? 'pointer' : 'default' }}
                      onMouseOver={e => e.currentTarget.style.background = p.backgroundSecondary}
                      onMouseOut={e  => e.currentTarget.style.background = i % 2 === 0 ? p.cardBg : p.inputBg}>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: p.text, fontWeight: 500 }}>{client?.business_name || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ color: p.text, fontSize: 13 }}>{service?.name_he || '—'}</div>
                        <div style={{ color: p.textSecondary, fontSize: 11 }}>{service?.name_en || ''}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: p.textSecondary }}>{c.po_number || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: p.primary, fontWeight: 600 }}>
                        {c.po_amount != null ? formatILS(c.po_amount) : <span style={{ color: p.textMuted, fontWeight: 400 }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: p.text }}>
                        {c.commission_rate != null ? `${c.commission_rate}%` : <span style={{ color: p.textMuted }}>—</span>}
                        {c.commission_source && (
                          <span style={{ color: p.textSecondary, fontSize: 11, marginLeft: 6 }}>({COMMISSION_SOURCE_LABELS[c.commission_source]})</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: sc.bg, color: sc.fg, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>{sc.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Confirm Deactivate Modal */}
        {confirmDeactivate && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
            onClick={() => setConfirmDeactivate(false)}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: p.cardBg, borderRadius: 16, padding: 28, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: `1px solid ${p.cardBorder}` }}>
              <h2 style={{ color: p.text, fontSize: 18, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 8px' }}>Deactivate Provider?</h2>
              <p style={{ color: p.textSecondary, fontSize: 13, margin: '0 0 20px', lineHeight: 1.5 }}>
                "{provider.name}" will be marked inactive.{' '}
                {provider.active_contracts > 0
                  ? `Existing ${provider.active_contracts} contract${provider.active_contracts === 1 ? '' : 's'} stay attached — they won't be affected.`
                  : ''}
                {' '}You can reactivate later.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={deactivate}
                  style={{ flex: 1, background: '#D4183D', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                  Deactivate
                </button>
                <button onClick={() => setConfirmDeactivate(false)}
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
