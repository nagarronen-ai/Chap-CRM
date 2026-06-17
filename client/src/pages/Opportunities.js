import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useApp } from '../context/AppContext';
import { useRole } from '../hooks/useRole';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const formatILS = (n) => `₪${Math.round(Number(n) || 0).toLocaleString()}`;

export default function Opportunities() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [ownerFilter, setOwnerFilter]     = useState('');

  const [teamUsers, setTeamUsers]               = useState([]);
  const [clientsList, setClientsList]           = useState([]);
  const [providerCatalog, setProviderCatalog]   = useState([]);
  const [servicesCatalog, setServicesCatalog]   = useState([]);

  // Add modal
  const [showAddModal, setShowAddModal]   = useState(false);
  const [adding, setAdding]               = useState(false);
  const [addError, setAddError]           = useState('');
  const [addForm, setAddForm] = useState({
    client_id: '', service_id: '', service_provider_id: '',
    notes: '', po_amount: '', commission_rate: '', commission_source: '', owner_id: '',
  });
  const [customerSearch, setCustomerSearch]       = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Inline PO assignment
  const [editingPoId, setEditingPoId] = useState(null);
  const [poDraft, setPoDraft]         = useState('');

  const navigate = useNavigate();
  const { palette: p } = useApp();
  const { can } = useRole();
  const canEdit = can('company:edit');
  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchOpportunities();
    axios.get(`${API}/users/team-list`,                   { headers: getHeaders() }).then(r => setTeamUsers(r.data || []))      .catch(() => {});
    axios.get(`${API}/clients`,                           { headers: getHeaders() }).then(r => setClientsList(r.data || []))    .catch(() => {});
    axios.get(`${API}/service-providers?is_active=true`,  { headers: getHeaders() }).then(r => setProviderCatalog(r.data || [])).catch(() => {});
    axios.get(`${API}/services`,                          { headers: getHeaders() }).then(r => setServicesCatalog(r.data || [])).catch(() => {});
  }, []);

  const fetchOpportunities = async () => {
    try {
      const res = await axios.get(`${API}/opportunities`, { headers: getHeaders() });
      setOpportunities(res.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  // ─── Create opportunity ──────────────────────────────────────────────────
  const resetAddForm = () => {
    setAddForm({ client_id: '', service_id: '', service_provider_id: '', notes: '', po_amount: '', commission_rate: '', commission_source: '', owner_id: '' });
    setCustomerSearch('');
    setAddError('');
  };

  const createOpportunity = async () => {
    if (!addForm.client_id || !addForm.service_id || !addForm.service_provider_id || !addForm.notes.trim()) return;
    setAdding(true);
    setAddError('');
    try {
      const body = {
        client_id:           addForm.client_id,
        service_id:          addForm.service_id,
        service_provider_id: addForm.service_provider_id,
        notes:               addForm.notes.trim(),
        po_amount:           addForm.po_amount       === '' ? null : Number(addForm.po_amount),
        commission_rate:     addForm.commission_rate === '' ? null : Number(addForm.commission_rate),
        commission_source:   addForm.commission_source || null,
        owner_id:            addForm.owner_id        || null,
      };
      const res = await axios.post(`${API}/opportunities`, body, { headers: getHeaders() });
      setOpportunities(prev => [res.data, ...prev]);
      setShowAddModal(false);
      resetAddForm();
    } catch (err) {
      console.error(err);
      setAddError(err?.response?.data?.error || 'Failed to create opportunity');
    }
    setAdding(false);
  };

  // ─── Assign PO inline ────────────────────────────────────────────────────
  const startPoEdit = (opp) => {
    if (!canEdit) return;
    setEditingPoId(opp.id);
    setPoDraft('');
  };
  const cancelPoEdit = () => { setEditingPoId(null); setPoDraft(''); };
  const commitPoEdit = async (opp) => {
    const trimmed = poDraft.trim();
    if (!trimmed) { cancelPoEdit(); return; }
    try {
      await axios.put(`${API}/opportunities/${opp.id}`, { po_number: trimmed }, { headers: getHeaders() });
      // PO assigned → row no longer belongs in the opportunities pipeline; drop it locally.
      setOpportunities(prev => prev.filter(o => o.id !== opp.id));
    } catch (err) { console.error(err); }
    cancelPoEdit();
  };
  const onPoKeyDown = (e, opp) => {
    if (e.key === 'Enter')      { e.preventDefault(); commitPoEdit(opp); }
    else if (e.key === 'Escape'){ e.preventDefault(); cancelPoEdit(); }
  };

  // ─── Remove opportunity ──────────────────────────────────────────────────
  const removeOpportunity = async (opp) => {
    if (!canEdit) return;
    if (!window.confirm(`Remove this opportunity?\n\n${opp.notes || opp.provider_name + ' for ' + opp.service_name_en}`)) return;
    try {
      await axios.delete(`${API}/opportunities/${opp.id}`, { headers: getHeaders() });
      setOpportunities(prev => prev.filter(o => o.id !== opp.id));
    } catch (err) { console.error(err); }
  };

  // ─── Filtering ───────────────────────────────────────────────────────────
  const filtered = opportunities.filter(o => {
    if (ownerFilter === 'unassigned' && o.owner_id) return false;
    if (ownerFilter && ownerFilter !== 'unassigned' && o.owner_id !== ownerFilter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return (
        o.notes?.toLowerCase().includes(s) ||
        o.customer_name?.toLowerCase().includes(s) ||
        o.provider_name?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  // ─── Stat aggregations ───────────────────────────────────────────────────
  const totalCount       = opportunities.length;
  const pipelineValue    = opportunities.reduce((a, o) => a + (Number(o.po_amount) || 0), 0);
  const distinctProviders = new Set(opportunities.map(o => o.service_provider_id)).size;

  // ─── Searchable customer dropdown filter ─────────────────────────────────
  const filteredClients = customerSearch.trim() === ''
    ? clientsList.slice(0, 15)
    : clientsList.filter(c => c.business_name?.toLowerCase().includes(customerSearch.toLowerCase())).slice(0, 15);
  const selectedCustomer = clientsList.find(c => c.id === addForm.client_id);

  const inputStyle = { background: p.inputBg, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '9px 12px', color: p.text, fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif' };
  const modalInputStyle = { width: '100%', boxSizing: 'border-box', ...inputStyle };

  const canSubmit = !!(addForm.client_id && addForm.service_id && addForm.service_provider_id && addForm.notes.trim());

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: p.background, minHeight: '100vh', transition: 'background 0.4s' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: 40 }}>

        {/* Header */}
        <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>Pipeline</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ color: p.text, fontSize: 30, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>Opportunities</h1>
          {canEdit && (
            <button onClick={() => setShowAddModal(true)}
              style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
              + Add Opportunity
            </button>
          )}
        </div>

        {/* Stat tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Total Opportunities', value: totalCount,                  color: p.text,    bg: p.cardBg, bordered: true },
            { label: 'Pipeline Value',      value: formatILS(pipelineValue),    color: p.primary, bg: p.cardBg, bordered: true },
            { label: 'Providers Involved',  value: distinctProviders,           color: p.text,    bg: p.cardBg, bordered: true },
          ].map(({ label, value, color, bg, bordered }) => (
            <div key={label} style={{ background: bg, borderRadius: 12, padding: 20, border: bordered ? `1px solid ${p.cardBorder}` : 'none' }}>
              <p style={{ color, fontSize: 24, fontWeight: 700, margin: 0, fontFamily: 'Playfair Display, Georgia, serif' }}>{value}</p>
              <p style={{ color, fontSize: 11, margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.8 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search description, customer, provider..."
            style={{ ...inputStyle, flex: 1 }} />
          <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} style={inputStyle}>
            <option value="">All Owners</option>
            <option value="unassigned">— Unassigned —</option>
            {teamUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <p style={{ color: p.textSecondary }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div style={{ background: p.cardBg, borderRadius: 12, padding: 60, textAlign: 'center', border: `1px solid ${p.cardBorder}` }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
            <p style={{ color: p.text, fontSize: 16, fontWeight: 500, margin: '0 0 8px' }}>
              {opportunities.length === 0 ? 'No opportunities yet' : 'No opportunities match your filters'}
            </p>
            <p style={{ color: p.textSecondary, fontSize: 13, margin: 0 }}>
              {opportunities.length === 0 ? 'Add one to start tracking your pipeline' : 'Try adjusting your search or filters'}
            </p>
          </div>
        ) : (
          <div style={{ background: p.cardBg, borderRadius: 12, border: `1px solid ${p.cardBorder}`, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: p.inputBg }}>
                  {['Description', 'Customer', 'Service', 'Provider', 'Amount', 'Owner', 'Added', 'PO', ''].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, color: p.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((o, i) => {
                  const rowBg = i % 2 === 0 ? p.cardBg : p.inputBg;
                  const editingPo = editingPoId === o.id;
                  return (
                    <tr key={o.id} style={{ borderTop: `1px solid ${p.cardBorder}`, background: rowBg }}>
                      {/* Description (notes) */}
                      <td style={{ padding: '12px 14px', fontSize: 13, color: p.text, fontWeight: 500, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.notes || ''}>
                        {o.notes || '—'}
                      </td>
                      {/* Customer */}
                      <td style={{ padding: '12px 14px', fontSize: 13 }}>
                        {o.customer_id ? (
                          <span onClick={() => navigate(`/clients/${o.customer_id}`)}
                            style={{ color: p.primary, cursor: 'pointer', fontWeight: 500 }}>
                            {o.customer_name}
                          </span>
                        ) : <span style={{ color: p.textMuted }}>—</span>}
                      </td>
                      {/* Service */}
                      <td style={{ padding: '12px 14px', fontSize: 13 }}>
                        <div style={{ color: p.text }}>{o.service_name_he || '—'}</div>
                        <div style={{ color: p.textSecondary, fontSize: 11 }}>{o.service_name_en || ''}</div>
                      </td>
                      {/* Provider */}
                      <td style={{ padding: '12px 14px', fontSize: 13 }}>
                        <span onClick={() => navigate(`/service-providers/${o.service_provider_id}`)}
                          style={{ color: p.primary, cursor: 'pointer', fontWeight: 500 }}>
                          {o.provider_name}
                        </span>
                      </td>
                      {/* Amount */}
                      <td style={{ padding: '12px 14px', fontSize: 13, color: p.primary, fontWeight: 600 }}>
                        {o.po_amount != null ? formatILS(o.po_amount) : <span style={{ color: p.textMuted, fontWeight: 400 }}>—</span>}
                      </td>
                      {/* Owner */}
                      <td style={{ padding: '12px 14px', fontSize: 12, color: o.owner_name ? p.textSecondary : p.textMuted }}>
                        {o.owner_name || '—'}
                      </td>
                      {/* Added */}
                      <td style={{ padding: '12px 14px', fontSize: 12, color: p.textMuted }}>
                        {new Date(o.created_at).toLocaleDateString()}
                      </td>
                      {/* PO (inline editable) */}
                      <td style={{ padding: '12px 14px', fontSize: 12 }}>
                        {editingPo ? (
                          <input autoFocus type="text" value={poDraft}
                            onChange={e => setPoDraft(e.target.value)}
                            onBlur={() => commitPoEdit(o)}
                            onKeyDown={e => onPoKeyDown(e, o)}
                            placeholder="SOAG..."
                            style={{ width: '100%', maxWidth: 130, background: p.inputBg, border: `1px solid ${p.primary}`, borderRadius: 4, padding: '4px 6px', color: p.text, fontSize: 12, outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                        ) : (
                          <span onClick={() => startPoEdit(o)}
                            style={{ background: '#FFF3CD', color: '#856404', borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 600, cursor: canEdit ? 'pointer' : 'default' }}
                            title={canEdit ? 'Click to assign PO' : ''}>
                            Pending
                          </span>
                        )}
                      </td>
                      {/* Delete */}
                      <td style={{ padding: '12px 8px', textAlign: 'center', width: 36 }}>
                        {canEdit && (
                          <button onClick={() => removeOpportunity(o)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#D4183D', fontSize: 14 }}
                            title="Remove opportunity">
                            🗑
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Opportunity Modal */}
        {showAddModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
            onClick={() => { setShowAddModal(false); resetAddForm(); }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: p.cardBg, borderRadius: 16, padding: 32, width: 580, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: `1px solid ${p.cardBorder}` }}>
              <h2 style={{ color: p.text, fontSize: 20, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 4px' }}>Add Opportunity</h2>
              <p style={{ color: p.textSecondary, fontSize: 12, margin: '0 0 20px' }}>Customer, Provider, Service, and Description are required.</p>

              {/* Customer — searchable */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Customer *</label>
                {selectedCustomer ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...modalInputStyle, padding: '8px 12px' }}>
                    <span style={{ flex: 1, color: p.text, fontWeight: 500 }}>{selectedCustomer.business_name}</span>
                    <button onClick={() => { setAddForm(prev => ({ ...prev, client_id: '' })); setCustomerSearch(''); }}
                      style={{ background: 'transparent', border: 'none', color: p.textSecondary, fontSize: 14, cursor: 'pointer' }} title="Clear">✕</button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <input value={customerSearch}
                      onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 180)}
                      placeholder="Type to search customers..."
                      style={modalInputStyle} />
                    {showCustomerDropdown && filteredClients.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: p.cardBg, border: `1px solid ${p.cardBorder}`, borderRadius: 8, zIndex: 10, maxHeight: 220, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                        {filteredClients.map(c => (
                          <div key={c.id} onClick={() => {
                            setAddForm(prev => ({ ...prev, client_id: c.id }));
                            setCustomerSearch('');
                            setShowCustomerDropdown(false);
                          }}
                            style={{ padding: '8px 12px', cursor: 'pointer', color: p.text, fontSize: 13, borderBottom: `1px solid ${p.cardBorder}` }}
                            onMouseOver={e => e.currentTarget.style.background = p.inputBg}
                            onMouseOut={e  => e.currentTarget.style.background = 'transparent'}>
                            {c.business_name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                {/* Provider */}
                <div>
                  <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Provider *</label>
                  <select value={addForm.service_provider_id}
                    onChange={e => setAddForm(prev => ({ ...prev, service_provider_id: e.target.value }))}
                    style={modalInputStyle}>
                    <option value="">— Select provider —</option>
                    {providerCatalog.map(pv => <option key={pv.id} value={pv.id}>{pv.name}</option>)}
                  </select>
                </div>
                {/* Service */}
                <div>
                  <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Service *</label>
                  <select value={addForm.service_id}
                    onChange={e => setAddForm(prev => ({ ...prev, service_id: e.target.value }))}
                    style={modalInputStyle}>
                    <option value="">— Select service —</option>
                    {servicesCatalog.map(s => <option key={s.id} value={s.id}>{s.name_he} / {s.name_en}</option>)}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Description *</label>
                <textarea value={addForm.notes}
                  onChange={e => setAddForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  placeholder="What's the work? (e.g., 'Cellcom mobile lines — RFP response')"
                  style={{ ...modalInputStyle, resize: 'vertical' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Amount (₪)</label>
                  <input type="number" value={addForm.po_amount}
                    onChange={e => setAddForm(prev => ({ ...prev, po_amount: e.target.value }))}
                    style={modalInputStyle} />
                </div>
                <div>
                  <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Commission %</label>
                  <input type="number" step="0.01" value={addForm.commission_rate}
                    onChange={e => setAddForm(prev => ({ ...prev, commission_rate: e.target.value }))}
                    style={modalInputStyle} />
                </div>
                <div>
                  <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Source</label>
                  <select value={addForm.commission_source}
                    onChange={e => setAddForm(prev => ({ ...prev, commission_source: e.target.value }))}
                    style={modalInputStyle}>
                    <option value="">—</option>
                    <option value="provider">Provider</option>
                    <option value="customer">Customer</option>
                    <option value="both">Both</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Owner</label>
                <select value={addForm.owner_id}
                  onChange={e => setAddForm(prev => ({ ...prev, owner_id: e.target.value }))}
                  style={modalInputStyle}>
                  <option value="">— Unassigned —</option>
                  {teamUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>

              {addError && (
                <p style={{ color: '#D4183D', fontSize: 12, margin: '0 0 12px' }}>{addError}</p>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={createOpportunity} disabled={!canSubmit || adding}
                  style={{ flex: 1, background: canSubmit && !adding ? p.primary : p.textMuted, color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 13, cursor: canSubmit && !adding ? 'pointer' : 'default', fontWeight: 600 }}>
                  {adding ? '⏳ Creating...' : 'Create Opportunity'}
                </button>
                <button onClick={() => { setShowAddModal(false); resetAddForm(); }}
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
