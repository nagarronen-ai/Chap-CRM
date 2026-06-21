import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useApp } from '../context/AppContext';
import { useRole } from '../hooks/useRole';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const formatILS = (n) => `₪${Math.round(Number(n) || 0).toLocaleString()}`;

const TYPE_PILL = {
  new_customer: { label: 'New Customer / לקוח חדש', bg: '#EBF4FF', fg: '#1a6fad' },
  new_service:  { label: 'New Service / שירות חדש', bg: '#D4EDDA', fg: '#155724' },
  upsell:       { label: 'Upsell / שדרוג',           bg: '#FFF3CD', fg: '#856404' },
};

const SEGMENTS = [
  { value: 'government',      label: 'Government' },
  { value: 'business',        label: 'Business' },
  { value: 'financial',       label: 'Financial' },
  { value: 'public',          label: 'Public' },
  { value: 'nonprofit',       label: 'Nonprofit' },
  { value: 'local_authority', label: 'Local Authority' },
];

export default function Opportunities() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [searchParams]                    = useSearchParams();
  const [search, setSearch]               = useState('');
  const [typeFilter, setTypeFilter]       = useState(() => {
    const t = searchParams.get('type');
    return ['new_customer', 'new_service', 'upsell'].includes(t) ? t : '';
  });
  const [ownerFilter, setOwnerFilter]     = useState('');

  // Catalogs for the Add modal dropdowns
  const [teamUsers, setTeamUsers]               = useState([]);
  const [clientsList, setClientsList]           = useState([]);
  const [providerCatalog, setProviderCatalog]   = useState([]);
  const [servicesCatalog, setServicesCatalog]   = useState([]);

  // Add modal
  const [showAddModal, setShowAddModal]   = useState(false);
  const [modalStep, setModalStep]         = useState('type');  // 'type' | 'form'
  const [selectedType, setSelectedType]   = useState('');
  const [adding, setAdding]               = useState(false);
  const [addError, setAddError]           = useState('');

  // Type-specific form state
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '', contact_name: '', contact_email: '', contact_phone: '',
    segment: '', interested_services: [], owner_id: '', notes: '',
  });
  const [newServiceForm, setNewServiceForm] = useState({
    client_id: '', service_id: '', service_provider_id: '',
    notes: '', po_amount: '', commission_rate: '', commission_source: '', owner_id: '',
  });
  const [upsellForm, setUpsellForm] = useState({
    client_id: '', service_id: '', notes: '', po_amount: '', owner_id: '',
  });

  // Customer combobox state (shared by new_service + upsell forms)
  const [customerSearch, setCustomerSearch]             = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Inline PO assignment (new_service rows)
  const [editingPoId, setEditingPoId] = useState(null);
  const [poDraft, setPoDraft]         = useState('');

  // Inline probability edit (all 3 types)
  const [editingProbId, setEditingProbId] = useState(null);
  const [probDraft, setProbDraft]         = useState('');

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

  // Re-sync typeFilter when URL ?type= changes (e.g. user navigates from Dashboard tiles)
  useEffect(() => {
    const t = searchParams.get('type');
    setTypeFilter(['new_customer', 'new_service', 'upsell'].includes(t) ? t : '');
  }, [searchParams]);

  const fetchOpportunities = async () => {
    try {
      const res = await axios.get(`${API}/opportunities`, { headers: getHeaders() });
      setOpportunities(res.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  // ─── Modal helpers ───────────────────────────────────────────────────────
  const closeModal = () => {
    setShowAddModal(false);
    setModalStep('type');
    setSelectedType('');
    setNewCustomerForm({ name: '', contact_name: '', contact_email: '', contact_phone: '', segment: '', interested_services: [], owner_id: '', notes: '' });
    setNewServiceForm({ client_id: '', service_id: '', service_provider_id: '', notes: '', po_amount: '', commission_rate: '', commission_source: '', owner_id: '' });
    setUpsellForm({ client_id: '', service_id: '', notes: '', po_amount: '', owner_id: '' });
    setCustomerSearch('');
    setAddError('');
  };

  const selectType = (t) => { setSelectedType(t); setModalStep('form'); setAddError(''); };
  const backToTypeSelect = () => { setModalStep('type'); setAddError(''); };

  // ─── Create handlers ─────────────────────────────────────────────────────
  const canSubmit = () => {
    if (selectedType === 'new_customer') return !!newCustomerForm.name.trim();
    if (selectedType === 'new_service')  return !!(newServiceForm.client_id && newServiceForm.service_id && newServiceForm.service_provider_id && newServiceForm.notes.trim());
    if (selectedType === 'upsell')       return !!(upsellForm.client_id && upsellForm.service_id);
    return false;
  };

  const submitCreate = async () => {
    if (!canSubmit()) return;
    setAdding(true);
    setAddError('');
    let body;
    if (selectedType === 'new_customer') {
      body = {
        opportunity_type: 'new_customer',
        name:             newCustomerForm.name.trim(),
        contact_name:     newCustomerForm.contact_name || null,
        contact_email:    newCustomerForm.contact_email || null,
        contact_phone:    newCustomerForm.contact_phone || null,
        segment:          newCustomerForm.segment || null,
        interested_services: newCustomerForm.interested_services,
        owner_id:         newCustomerForm.owner_id || null,
        notes:            newCustomerForm.notes || null,
      };
    } else if (selectedType === 'new_service') {
      body = {
        opportunity_type:    'new_service',
        client_id:           newServiceForm.client_id,
        service_id:          newServiceForm.service_id,
        service_provider_id: newServiceForm.service_provider_id,
        notes:               newServiceForm.notes.trim(),
        po_amount:           newServiceForm.po_amount       === '' ? null : Number(newServiceForm.po_amount),
        commission_rate:     newServiceForm.commission_rate === '' ? null : Number(newServiceForm.commission_rate),
        commission_source:   newServiceForm.commission_source || null,
        owner_id:            newServiceForm.owner_id || null,
      };
    } else if (selectedType === 'upsell') {
      body = {
        opportunity_type: 'upsell',
        client_id:        upsellForm.client_id,
        service_id:       upsellForm.service_id,
        notes:            upsellForm.notes || null,
        po_amount:        upsellForm.po_amount === '' ? null : Number(upsellForm.po_amount),
        owner_id:         upsellForm.owner_id || null,
      };
    }
    try {
      const res = await axios.post(`${API}/opportunities`, body, { headers: getHeaders() });
      setOpportunities(prev => [res.data, ...prev]);
      closeModal();
    } catch (err) {
      console.error(err);
      setAddError(err?.response?.data?.message || err?.response?.data?.error || 'Failed to create opportunity');
    }
    setAdding(false);
  };

  // ─── Inline PO assignment (new_service only) ─────────────────────────────
  const startPoEdit = (opp) => { if (!canEdit) return; setEditingPoId(opp.id); setPoDraft(''); };
  const cancelPoEdit = () => { setEditingPoId(null); setPoDraft(''); };
  const commitPoEdit = async (opp) => {
    const t = poDraft.trim();
    if (!t) { cancelPoEdit(); return; }
    try {
      await axios.put(`${API}/opportunities/${opp.id}`, { opportunity_type: 'new_service', po_number: t }, { headers: getHeaders() });
      setOpportunities(prev => prev.filter(o => o.id !== opp.id));
    } catch (err) { console.error(err); }
    cancelPoEdit();
  };
  const onPoKeyDown = (e, opp) => {
    if (e.key === 'Enter')      { e.preventDefault(); commitPoEdit(opp); }
    else if (e.key === 'Escape'){ e.preventDefault(); cancelPoEdit(); }
  };

  // ─── Inline probability edit (all 3 types) ───────────────────────────────
  const startProbEdit = (opp) => {
    if (!canEdit) return;
    setEditingProbId(opp.id);
    setProbDraft(opp.probability != null ? String(opp.probability) : '');
  };
  const cancelProbEdit = () => { setEditingProbId(null); setProbDraft(''); };
  const commitProbEdit = async (opp) => {
    const t = probDraft.trim();
    if (t === '') { cancelProbEdit(); return; }
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0 || n > 100) { cancelProbEdit(); return; }
    try {
      const res = await axios.put(
        `${API}/opportunities/${opp.id}`,
        { opportunity_type: opp.opportunity_type, probability: n },
        { headers: getHeaders() },
      );
      setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, probability: res.data?.probability ?? n } : o));
    } catch (err) { console.error(err); }
    cancelProbEdit();
  };
  const onProbKeyDown = (e, opp) => {
    if (e.key === 'Enter')       { e.preventDefault(); commitProbEdit(opp); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelProbEdit(); }
  };

  // Color tier for probability % display
  const probColor = (n) => {
    if (n == null) return p.textMuted;
    if (n <= 30)   return '#D4183D';     // red
    if (n <= 60)   return '#D4A574';     // amber
    if (n <= 90)   return '#155724';     // green
    return '#0B5D2A';                    // bold green (91-100)
  };
  const weightedFor = (o) => (o.po_amount != null && o.probability != null)
    ? Number(o.po_amount) * Number(o.probability) / 100
    : null;

  // ─── Mark Won (upsell only) ──────────────────────────────────────────────
  const markUpsellWon = async (opp) => {
    if (!canEdit) return;
    if (!window.confirm(`Mark "${opp.service_name_en}" as active for ${opp.customer_name}?`)) return;
    try {
      await axios.put(`${API}/opportunities/${opp.id}`, { opportunity_type: 'upsell', status: 'active' }, { headers: getHeaders() });
      setOpportunities(prev => prev.filter(o => o.id !== opp.id));
    } catch (err) { console.error(err); }
  };

  // ─── Delete opportunity (per type) ───────────────────────────────────────
  const removeOpportunity = async (opp) => {
    if (!canEdit) return;
    const what =
      opp.opportunity_type === 'new_customer' ? opp.description
      : opp.opportunity_type === 'new_service'  ? `${opp.provider_name} for ${opp.customer_name}`
      : `${opp.service_name_en} upsell for ${opp.customer_name}`;
    if (!window.confirm(`Remove this opportunity?\n\n${what}`)) return;
    try {
      await axios.delete(`${API}/opportunities/${opp.id}?type=${opp.opportunity_type}`, { headers: getHeaders() });
      setOpportunities(prev => prev.filter(o => o.id !== opp.id));
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message;
      if (msg) alert(msg);
    }
  };

  // ─── Filtering ───────────────────────────────────────────────────────────
  const filtered = opportunities.filter(o => {
    if (typeFilter && o.opportunity_type !== typeFilter) return false;
    if (ownerFilter === 'unassigned' && o.owner_id) return false;
    if (ownerFilter && ownerFilter !== 'unassigned' && o.owner_id !== ownerFilter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return (
        o.description?.toLowerCase().includes(s) ||
        o.notes?.toLowerCase().includes(s) ||
        o.customer_name?.toLowerCase().includes(s) ||
        o.provider_name?.toLowerCase().includes(s) ||
        o.service_name_en?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  // ─── Stats ───────────────────────────────────────────────────────────────
  const totalCount    = opportunities.length;
  const pipelineValue = opportunities.reduce((a, o) => a + (Number(o.po_amount) || 0), 0);
  // Weighted revenue: sum of po_amount × probability / 100 across rows where BOTH are set.
  const weightedRevenue = opportunities.reduce((a, o) => {
    const w = weightedFor(o);
    return a + (w == null ? 0 : w);
  }, 0);
  const byTypeCount = {
    new_customer: opportunities.filter(o => o.opportunity_type === 'new_customer').length,
    new_service:  opportunities.filter(o => o.opportunity_type === 'new_service').length,
    upsell:       opportunities.filter(o => o.opportunity_type === 'upsell').length,
  };
  // Filtered totals for the footer summary — respects search + type + owner filters.
  const filteredPipelineValue = filtered.reduce((a, o) => a + (Number(o.po_amount) || 0), 0);
  const filteredWeighted      = filtered.reduce((a, o) => {
    const w = weightedFor(o);
    return a + (w == null ? 0 : w);
  }, 0);

  // ─── Customer combobox (used in new_service + upsell forms) ──────────────
  const activeForm = selectedType === 'new_service' ? newServiceForm : selectedType === 'upsell' ? upsellForm : null;
  const setActiveCustomerId = (id) => {
    if (selectedType === 'new_service') setNewServiceForm(prev => ({ ...prev, client_id: id }));
    else if (selectedType === 'upsell') setUpsellForm(prev => ({ ...prev, client_id: id }));
  };
  const selectedCustomer = activeForm && clientsList.find(c => c.id === activeForm.client_id);
  const filteredClients = customerSearch.trim() === ''
    ? clientsList.slice(0, 15)
    : clientsList.filter(c => c.business_name?.toLowerCase().includes(customerSearch.toLowerCase())).slice(0, 15);

  const inputStyle = { background: p.inputBg, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '9px 12px', color: p.text, fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif' };
  const modalInputStyle = { width: '100%', boxSizing: 'border-box', ...inputStyle };

  const typePill = (type) => {
    const pill = TYPE_PILL[type] || TYPE_PILL.new_service;
    return (
      <span style={{ background: pill.bg, color: pill.fg, borderRadius: 20, padding: '2px 8px', fontSize: 9, fontWeight: 600, whiteSpace: 'nowrap' }}>
        {pill.label}
      </span>
    );
  };

  const renderTypeCard = (key, title, titleHe, blurb) => {
    const pill = TYPE_PILL[key];
    return (
      <div key={key} onClick={() => selectType(key)}
        style={{ background: p.cardBg, border: `2px solid ${p.cardBorder}`, borderRadius: 12, padding: 18, cursor: 'pointer', transition: 'border-color 0.15s' }}
        onMouseOver={e => e.currentTarget.style.borderColor = pill.fg}
        onMouseOut={e  => e.currentTarget.style.borderColor = p.cardBorder}>
        <span style={{ background: pill.bg, color: pill.fg, borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 600, display: 'inline-block', marginBottom: 10 }}>{pill.label}</span>
        <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>{title}</h3>
        <p style={{ color: p.textSecondary, fontSize: 11, margin: '0 0 10px' }}>{titleHe}</p>
        <p style={{ color: p.textMuted, fontSize: 12, margin: 0, lineHeight: 1.5 }}>{blurb}</p>
      </div>
    );
  };

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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: p.cardBg, borderRadius: 12, padding: 20, border: `1px solid ${p.cardBorder}` }}>
            <p style={{ color: p.text, fontSize: 24, fontWeight: 700, margin: 0, fontFamily: 'Playfair Display, Georgia, serif' }}>{totalCount}</p>
            <p style={{ color: p.text, fontSize: 11, margin: '4px 0 2px', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.8 }}>Total Opportunities</p>
            <p style={{ color: p.textSecondary, fontSize: 11, margin: 0 }}>
              {byTypeCount.new_customer} new customers · {byTypeCount.new_service} new services · {byTypeCount.upsell} upsells
            </p>
          </div>
          <div style={{ background: p.cardBg, borderRadius: 12, padding: 20, border: `1px solid ${p.cardBorder}` }}>
            <p style={{ color: p.primary, fontSize: 24, fontWeight: 700, margin: 0, fontFamily: 'Playfair Display, Georgia, serif' }}>{formatILS(pipelineValue)}</p>
            <p style={{ color: p.text, fontSize: 11, margin: '4px 0 2px', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.8 }}>Pipeline Value</p>
            <p style={{ color: p.textSecondary, fontSize: 11, margin: 0 }}>total potential</p>
          </div>
          <div style={{ background: p.cardBg, borderRadius: 12, padding: 20, border: `1px solid ${p.cardBorder}` }}>
            <p style={{ color: '#155724', fontSize: 24, fontWeight: 700, margin: 0, fontFamily: 'Playfair Display, Georgia, serif' }}>{formatILS(weightedRevenue)}</p>
            <p style={{ color: p.text, fontSize: 11, margin: '4px 0 2px', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.8 }}>Weighted Revenue</p>
            <p style={{ color: p.textSecondary, fontSize: 11, margin: 0 }}>estimated revenue</p>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search description, customer, provider, service..."
            style={{ ...inputStyle, flex: 1 }} />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={inputStyle}>
            <option value="">All Types</option>
            <option value="new_customer">New Customer</option>
            <option value="new_service">New Service</option>
            <option value="upsell">Upsell</option>
          </select>
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
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '9%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '3%' }} />
              </colgroup>
              <thead>
                <tr style={{ background: p.inputBg }}>
                  {['Type', 'Description', 'Customer', 'Service', 'Provider', 'Amount', 'Weighted', 'Prob %', 'Owner', 'Added', 'Stage', 'PO / Action', ''].map(h => (
                    <th key={h} style={{ padding: '12px 10px', textAlign: 'left', fontSize: 10, color: p.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((o, i) => {
                  const rowBg = i % 2 === 0 ? p.cardBg : p.inputBg;
                  const isCustomer = o.opportunity_type === 'new_customer';
                  const isService  = o.opportunity_type === 'new_service';
                  const isUpsell   = o.opportunity_type === 'upsell';
                  const editingPo = editingPoId === o.id;
                  return (
                    <tr key={`${o.opportunity_type}-${o.id}`} style={{ borderTop: `1px solid ${p.cardBorder}`, background: rowBg }}>
                      <td style={{ padding: '10px 8px' }}>{typePill(o.opportunity_type)}</td>
                      <td style={{ padding: '10px 10px', fontSize: 12, color: p.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.description || o.notes || ''}>
                        {isCustomer ? (
                          <span onClick={() => navigate(`/companies/${o.id}`)} style={{ color: p.primary, cursor: 'pointer' }}>
                            {o.description || '—'}
                          </span>
                        ) : (o.description || o.notes || <span style={{ color: p.textMuted }}>—</span>)}
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.customer_id ? (
                          <span onClick={() => navigate(`/clients/${o.customer_id}`)} style={{ color: p.primary, cursor: 'pointer', fontWeight: 500 }} title={o.customer_name}>
                            {o.customer_name}
                          </span>
                        ) : <span style={{ color: p.textMuted }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.service_name_he ? (
                          <>
                            <div style={{ color: p.text }}>{o.service_name_he}</div>
                            <div style={{ color: p.textSecondary, fontSize: 10 }}>{o.service_name_en}</div>
                          </>
                        ) : <span style={{ color: p.textMuted }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.provider_name ? (
                          <span onClick={() => o.service_provider_id && navigate(`/service-providers/${o.service_provider_id}`)}
                            style={{ color: o.service_provider_id ? p.primary : p.text, cursor: o.service_provider_id ? 'pointer' : 'default', fontWeight: 500 }}>
                            {o.provider_name}
                          </span>
                        ) : <span style={{ color: p.textMuted }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: 12, color: p.primary, fontWeight: 600 }}>
                        {o.po_amount != null ? formatILS(o.po_amount) : <span style={{ color: p.textMuted, fontWeight: 400 }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: 12, color: p.text, fontWeight: 500 }}>
                        {(() => {
                          const w = weightedFor(o);
                          return w == null
                            ? <span style={{ color: p.textMuted, fontWeight: 400 }}>—</span>
                            : formatILS(w);
                        })()}
                      </td>
                      <td style={{ padding: '10px 8px', fontSize: 12 }}>
                        {editingProbId === o.id ? (
                          <input autoFocus type="number" min="0" max="100" value={probDraft}
                            onChange={e => setProbDraft(e.target.value)}
                            onBlur={() => commitProbEdit(o)}
                            onKeyDown={e => onProbKeyDown(e, o)}
                            style={{ width: '100%', maxWidth: 70, background: p.inputBg, border: `1px solid ${p.primary}`, borderRadius: 4, padding: '4px 6px', color: p.text, fontSize: 11, outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                        ) : (
                          <span onClick={() => startProbEdit(o)}
                            title={canEdit ? 'Click to set probability' : ''}
                            style={{ color: probColor(o.probability), fontWeight: o.probability != null && o.probability > 90 ? 700 : 600, cursor: canEdit ? 'pointer' : 'default', fontSize: 12 }}>
                            {o.probability != null ? `${o.probability}%` : <span style={{ color: p.textMuted, fontWeight: 400 }}>—</span>}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: 11, color: o.owner_name ? p.textSecondary : p.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.owner_name || ''}>
                        {o.owner_name || '—'}
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: 11, color: p.textMuted }}>
                        {new Date(o.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '10px 8px', fontSize: 11 }}>
                        {isCustomer && o.stage ? (
                          <span style={{ background: p.inputBg, color: p.text, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 600 }}>{o.stage}</span>
                        ) : isUpsell ? (
                          <span style={{ background: '#FFF3CD', color: '#856404', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 600 }}>Prospect</span>
                        ) : <span style={{ color: p.textMuted }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 8px', fontSize: 11 }}>
                        {isService && (editingPo ? (
                          <input autoFocus type="text" value={poDraft}
                            onChange={e => setPoDraft(e.target.value)}
                            onBlur={() => commitPoEdit(o)}
                            onKeyDown={e => onPoKeyDown(e, o)}
                            placeholder="SOAG..."
                            style={{ width: '100%', maxWidth: 110, background: p.inputBg, border: `1px solid ${p.primary}`, borderRadius: 4, padding: '4px 6px', color: p.text, fontSize: 11, outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                        ) : (
                          <span onClick={() => startPoEdit(o)}
                            style={{ background: '#FFF3CD', color: '#856404', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 600, cursor: canEdit ? 'pointer' : 'default' }}
                            title={canEdit ? 'Click to assign PO' : ''}>
                            Pending
                          </span>
                        ))}
                        {isUpsell && canEdit && (
                          <button onClick={() => markUpsellWon(o)}
                            style={{ background: '#155724', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                            Mark Won
                          </button>
                        )}
                        {isCustomer && <span style={{ color: p.textMuted }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                        {canEdit && (
                          <button onClick={() => removeOpportunity(o)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#D4183D', fontSize: 13 }}
                            title="Remove opportunity">🗑</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Footer summary — recalculates from filtered rows */}
            <div style={{ padding: '10px 16px', background: p.inputBg, borderTop: `1px solid ${p.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: p.textSecondary }}>
              <span>Total pipeline: <strong style={{ color: p.text, fontWeight: 600 }}>{formatILS(filteredPipelineValue)}</strong></span>
              <span>Weighted: <strong style={{ color: p.text, fontWeight: 600 }}>{formatILS(filteredWeighted)}</strong> est.</span>
            </div>
          </div>
        )}

        {/* Add Opportunity Modal */}
        {showAddModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
            onClick={closeModal}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: p.cardBg, borderRadius: 16, padding: 32, width: 620, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: `1px solid ${p.cardBorder}` }}>

              {modalStep === 'type' ? (
                <>
                  <h2 style={{ color: p.text, fontSize: 20, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 4px' }}>Add Opportunity</h2>
                  <p style={{ color: p.textSecondary, fontSize: 12, margin: '0 0 20px' }}>What kind of opportunity?</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                    {renderTypeCard('new_customer', 'New Customer', 'לקוח חדש', 'A lead not yet a client')}
                    {renderTypeCard('new_service',  'New Service',  'שירות חדש', 'Existing client + provider')}
                    {renderTypeCard('upsell',       'Upsell',       'שדרוג',     'Sell a new service to existing client')}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }} />
                    <button onClick={closeModal}
                      style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '11px 24px', fontSize: 13, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <button onClick={backToTypeSelect}
                      style={{ background: 'transparent', color: p.primary, border: 'none', cursor: 'pointer', fontSize: 12, padding: 0 }}>← Back</button>
                  </div>
                  <h2 style={{ color: p.text, fontSize: 20, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '8px 0 4px' }}>
                    {selectedType === 'new_customer' ? 'New Customer' : selectedType === 'new_service' ? 'New Service' : 'Upsell'}
                  </h2>
                  <p style={{ color: p.textSecondary, fontSize: 12, margin: '0 0 20px' }}>{TYPE_PILL[selectedType]?.label}</p>

                  {/* ── NEW CUSTOMER FORM ── */}
                  {selectedType === 'new_customer' && (
                    <>
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Company Name *</label>
                        <input value={newCustomerForm.name}
                          onChange={e => setNewCustomerForm(prev => ({ ...prev, name: e.target.value }))}
                          style={modalInputStyle} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                        <div>
                          <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Contact Name</label>
                          <input value={newCustomerForm.contact_name}
                            onChange={e => setNewCustomerForm(prev => ({ ...prev, contact_name: e.target.value }))}
                            style={modalInputStyle} />
                        </div>
                        <div>
                          <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Phone</label>
                          <input value={newCustomerForm.contact_phone}
                            onChange={e => setNewCustomerForm(prev => ({ ...prev, contact_phone: e.target.value }))}
                            style={modalInputStyle} />
                        </div>
                        <div>
                          <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Email</label>
                          <input type="email" value={newCustomerForm.contact_email}
                            onChange={e => setNewCustomerForm(prev => ({ ...prev, contact_email: e.target.value }))}
                            style={modalInputStyle} />
                        </div>
                        <div>
                          <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Segment</label>
                          <select value={newCustomerForm.segment}
                            onChange={e => setNewCustomerForm(prev => ({ ...prev, segment: e.target.value }))}
                            style={modalInputStyle}>
                            <option value="">— Select —</option>
                            {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Services Interested In</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {servicesCatalog.map(s => {
                            const checked = newCustomerForm.interested_services.includes(s.id);
                            return (
                              <label key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: checked ? p.inputBg : p.cardBg, border: `1px solid ${checked ? p.primary : p.inputBorder}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>
                                <input type="checkbox" checked={checked}
                                  onChange={e => {
                                    setNewCustomerForm(prev => ({
                                      ...prev,
                                      interested_services: e.target.checked
                                        ? [...prev.interested_services, s.id]
                                        : prev.interested_services.filter(id => id !== s.id),
                                    }));
                                  }}
                                  style={{ accentColor: p.primary }} />
                                <span style={{ color: p.text }}>{s.name_he}</span>
                                <span style={{ color: p.textSecondary, fontSize: 10 }}>{s.name_en}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                        <div>
                          <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Owner</label>
                          <select value={newCustomerForm.owner_id}
                            onChange={e => setNewCustomerForm(prev => ({ ...prev, owner_id: e.target.value }))}
                            style={modalInputStyle}>
                            <option value="">— Unassigned —</option>
                            {teamUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Notes</label>
                          <input value={newCustomerForm.notes}
                            onChange={e => setNewCustomerForm(prev => ({ ...prev, notes: e.target.value }))}
                            style={modalInputStyle} />
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── NEW SERVICE FORM ── */}
                  {selectedType === 'new_service' && (
                    <>
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Customer *</label>
                        {selectedCustomer ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...modalInputStyle, padding: '8px 12px' }}>
                            <span style={{ flex: 1, color: p.text, fontWeight: 500 }}>{selectedCustomer.business_name}</span>
                            <button onClick={() => { setActiveCustomerId(''); setCustomerSearch(''); }}
                              style={{ background: 'transparent', border: 'none', color: p.textSecondary, fontSize: 14, cursor: 'pointer' }}>✕</button>
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
                                  <div key={c.id} onClick={() => { setActiveCustomerId(c.id); setCustomerSearch(''); setShowCustomerDropdown(false); }}
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
                        <div>
                          <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Provider *</label>
                          <select value={newServiceForm.service_provider_id}
                            onChange={e => setNewServiceForm(prev => ({ ...prev, service_provider_id: e.target.value }))}
                            style={modalInputStyle}>
                            <option value="">— Select provider —</option>
                            {providerCatalog.map(pv => <option key={pv.id} value={pv.id}>{pv.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Service *</label>
                          <select value={newServiceForm.service_id}
                            onChange={e => setNewServiceForm(prev => ({ ...prev, service_id: e.target.value }))}
                            style={modalInputStyle}>
                            <option value="">— Select service —</option>
                            {servicesCatalog.map(s => <option key={s.id} value={s.id}>{s.name_he} / {s.name_en}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Description *</label>
                        <textarea value={newServiceForm.notes}
                          onChange={e => setNewServiceForm(prev => ({ ...prev, notes: e.target.value }))}
                          rows={2} placeholder="What's the work?" style={{ ...modalInputStyle, resize: 'vertical' }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                        <div>
                          <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Amount (₪)</label>
                          <input type="number" value={newServiceForm.po_amount}
                            onChange={e => setNewServiceForm(prev => ({ ...prev, po_amount: e.target.value }))}
                            style={modalInputStyle} />
                        </div>
                        <div>
                          <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Commission %</label>
                          <input type="number" step="0.01" value={newServiceForm.commission_rate}
                            onChange={e => setNewServiceForm(prev => ({ ...prev, commission_rate: e.target.value }))}
                            style={modalInputStyle} />
                        </div>
                        <div>
                          <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Source</label>
                          <select value={newServiceForm.commission_source}
                            onChange={e => setNewServiceForm(prev => ({ ...prev, commission_source: e.target.value }))}
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
                        <select value={newServiceForm.owner_id}
                          onChange={e => setNewServiceForm(prev => ({ ...prev, owner_id: e.target.value }))}
                          style={modalInputStyle}>
                          <option value="">— Unassigned —</option>
                          {teamUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                    </>
                  )}

                  {/* ── UPSELL FORM ── */}
                  {selectedType === 'upsell' && (
                    <>
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Customer *</label>
                        {selectedCustomer ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...modalInputStyle, padding: '8px 12px' }}>
                            <span style={{ flex: 1, color: p.text, fontWeight: 500 }}>{selectedCustomer.business_name}</span>
                            <button onClick={() => { setActiveCustomerId(''); setCustomerSearch(''); }}
                              style={{ background: 'transparent', border: 'none', color: p.textSecondary, fontSize: 14, cursor: 'pointer' }}>✕</button>
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
                                  <div key={c.id} onClick={() => { setActiveCustomerId(c.id); setCustomerSearch(''); setShowCustomerDropdown(false); }}
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
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Service *</label>
                        <select value={upsellForm.service_id}
                          onChange={e => setUpsellForm(prev => ({ ...prev, service_id: e.target.value }))}
                          style={modalInputStyle}>
                          <option value="">— Select service —</option>
                          {servicesCatalog.map(s => <option key={s.id} value={s.id}>{s.name_he} / {s.name_en}</option>)}
                        </select>
                      </div>
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Notes</label>
                        <textarea value={upsellForm.notes}
                          onChange={e => setUpsellForm(prev => ({ ...prev, notes: e.target.value }))}
                          rows={2} style={{ ...modalInputStyle, resize: 'vertical' }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                        <div>
                          <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Expected Amount (₪)</label>
                          <input type="number" value={upsellForm.po_amount}
                            onChange={e => setUpsellForm(prev => ({ ...prev, po_amount: e.target.value }))}
                            style={modalInputStyle} />
                        </div>
                        <div>
                          <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Owner</label>
                          <select value={upsellForm.owner_id}
                            onChange={e => setUpsellForm(prev => ({ ...prev, owner_id: e.target.value }))}
                            style={modalInputStyle}>
                            <option value="">— Unassigned —</option>
                            {teamUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {addError && <p style={{ color: '#D4183D', fontSize: 12, margin: '0 0 12px' }}>{addError}</p>}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={submitCreate} disabled={!canSubmit() || adding}
                      style={{ flex: 1, background: canSubmit() && !adding ? p.primary : p.textMuted, color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 13, cursor: canSubmit() && !adding ? 'pointer' : 'default', fontWeight: 600 }}>
                      {adding ? '⏳ Creating...' : 'Create Opportunity'}
                    </button>
                    <button onClick={closeModal}
                      style={{ flex: 1, background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '11px', fontSize: 13, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
