import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useRole } from '../hooks/useRole';
import { useApp } from '../context/AppContext';
import TiptapEditor from '../components/TiptapEditor';
import HtmlEditor from '../components/HtmlEditor';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const STAGES = ['New', 'Contacted', 'No Reply', 'Follow-up', 'Meeting Scheduled', 'Proposal Offered', 'Agreement Sent', 'Closed Won', 'Closed Lost', 'Not Interested'];
const ORIGINS = ['Upload', 'Cold', 'Hot', 'Instagram', 'Google', 'Referral'];
const FROM_EMAILS = ['marketing@yourcompany.com', 'noreply@yourcompany.com', 'you@yourcompany.com'];

const STATUS_COLORS = {
  draft: { bg: '#F5F3EF', color: '#717182' },
  sending: { bg: '#FFF3CD', color: '#856404' },
  sent: { bg: '#D4EDDA', color: '#155724' },
};

const STAT_CONFIG = [
  { key: 'sent', label: 'Sent', icon: '📤' },
  { key: 'delivered', label: 'Delivered', icon: '✅' },
  { key: 'opened', label: 'Opened', icon: '👁' },
  { key: 'clicked', label: 'Clicked', icon: '🖱' },
  { key: 'bounced', label: 'Bounced', icon: '↩️' },
  { key: 'unsubscribed', label: 'Unsubscribed', icon: '🚫' },
];

const prettifyHTML = (html) => {
  if (!html) return '';
  let formatted = '';
  let indent = 0;
  const tags = html.replace(/>\s*</g, '>\n<').split('\n');
  tags.forEach(tag => {
    const isClosing = tag.match(/^<\//);
    const isSelfClosing = tag.match(/\/>/);
    const isOpening = tag.match(/^<[^/]/) && !isSelfClosing;
    if (isClosing) indent = Math.max(0, indent - 1);
    formatted += '  '.repeat(indent) + tag.trim() + '\n';
    if (isOpening && !tag.match(/^<(br|hr|img|input|meta|link)/i)) indent++;
  });
  return formatted.trim();
};

export default function Marketing() {
  const { can } = useRole();
  const { palette: p } = useApp();
  const canSend = can('marketing:send');

  const [view, setView] = useState('list');
  const [campaigns, setCampaigns] = useState([]);
  const [globalStats, setGlobalStats] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', subject: '', body_html: '', from_name: 'QPoint', from_email: 'marketing@yourcompany.com', template_id: null });
  const [filters, setFilters] = useState({ stage: '', origin: '', city: '', category: '', source: 'all' });
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState({});
  const [excludedCount, setExcludedCount] = useState(0);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [designTemplates, setDesignTemplates] = useState([]);
  const [recipientFilter, setRecipientFilter] = useState('all');
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState({});

  const [subView, setSubView] = useState('campaigns');
  const [waitlist, setWaitlist] = useState([]);
  const [loadingWaitlist, setLoadingWaitlist] = useState(false);
  const [waitlistSearch, setWaitlistSearch] = useState('');
  const [unsubscribed, setUnsubscribed] = useState([]);
  const [selectedUnsubs, setSelectedUnsubs] = useState({});
  const [loadingUnsubs, setLoadingUnsubs] = useState(false);

  const [dripSequences, setDripSequences] = useState([]);
  const [selectedSequence, setSelectedSequence] = useState(null);
  const [dripSteps, setDripSteps] = useState([]);
  const [loadingDrip, setLoadingDrip] = useState(false);
  const [showDripEditor, setShowDripEditor] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [stepForm, setStepForm] = useState({ delay_days: 3, subject: '', body_html: '', design_template_id: '', active: true });
  const [showNewSequence, setShowNewSequence] = useState(false);
  const [newSequenceName, setNewSequenceName] = useState('');
  const [savingStep, setSavingStep] = useState(false);
  const [designPreviewHtml, setDesignPreviewHtml] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [stepStats, setStepStats] = useState({});

  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const inputStyle = { width: '100%', background: p.inputBg, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '9px 12px', color: p.text, fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { color: p.textSecondary, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 5 };
  const card = { background: p.cardBg, borderRadius: 12, border: `1px solid ${p.cardBorder}` };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchCampaigns(); fetchGlobalStats(); fetchTemplates(); fetchDesignTemplates(); }, []);

  const fetchCampaigns = async () => {
    try { const res = await axios.get(`${API}/marketing/campaigns`, { headers: getHeaders() }); setCampaigns(res.data); } catch (err) { console.error(err); }
    setLoading(false);
  };
  const fetchGlobalStats = async () => {
    try { const res = await axios.get(`${API}/marketing/stats`, { headers: getHeaders() }); setGlobalStats(res.data); } catch (err) { console.error(err); }
  };
  const fetchTemplates = async () => {
    try { const res = await axios.get(`${API}/emails/templates`, { headers: getHeaders() }); setTemplates(res.data.filter(t => t.visibility === 'team')); } catch (err) { console.error(err); }
  };
  const fetchDesignTemplates = async () => {
    try { const res = await axios.get(`${API}/design-templates`, { headers: getHeaders() }); setDesignTemplates(res.data); } catch (err) { console.error(err); }
  };
  const fetchWaitlist = async () => {
    setLoadingWaitlist(true);
    try { const res = await axios.get(`${API}/marketing/waitlist`, { headers: getHeaders() }); setWaitlist(res.data); } catch (err) { console.error(err); }
    setLoadingWaitlist(false);
  };
  const fetchUnsubscribed = async () => {
    setLoadingUnsubs(true);
    try { const res = await axios.get(`${API}/marketing/unsubscribed`, { headers: getHeaders() }); setUnsubscribed(res.data); setSelectedUnsubs({}); } catch (err) { console.error(err); }
    setLoadingUnsubs(false);
  };
  const fetchDripSequences = async () => {
    setLoadingDrip(true);
    try { const res = await axios.get(`${API}/drip/sequences`, { headers: getHeaders() }); setDripSequences(res.data); } catch (err) { console.error(err); }
    setLoadingDrip(false);
  };
  const fetchDripSteps = async (sequenceId) => {
    try {
      const res = await axios.get(`${API}/drip/sequences/${sequenceId}/steps`, { headers: getHeaders() });
      setDripSteps(res.data);
      const statsMap = {};
      for (const s of res.data) {
        try { const sr = await axios.get(`${API}/drip/steps/${s.id}/stats`, { headers: getHeaders() }); statsMap[s.id] = sr.data; } catch (err) {}
      }
      setStepStats(statsMap);
    } catch (err) { console.error(err); }
  };
  const fetchDesignPreview = (templateId) => {
    setLoadingPreview(true);
    const dt = templateId ? designTemplates.find(d => d.id === templateId) : designTemplates.find(d => d.type === 'transactional' && d.active);
    setDesignPreviewHtml(dt?.wrapper_html || '{{content}}');
    setLoadingPreview(false);
  };
  const fetchRecipients = async () => {
    setLoadingRecipients(true);
    try {
      const params = {};
      if (filters.stage) params.stage = filters.stage;
      if (filters.origin) params.origin = filters.origin;
      if (filters.city) params.city = filters.city;
      if (filters.source) params.source = filters.source;
      const res = await axios.get(`${API}/marketing/recipients`, { headers: getHeaders(), params });
      const recs = res.data.recipients;
      setRecipients(recs);
      const selected = {};
      recs.forEach((r, i) => { selected[i] = true; });
      setSelectedRecipients(selected);
      const excRes = await axios.get(`${API}/marketing/recipients/excluded`, { headers: getHeaders() });
      setExcludedCount(excRes.data.excluded_count);
    } catch (err) { console.error(err); }
    setLoadingRecipients(false);
  };

  const deleteWaitlistEntry = async (id) => {
    if (!window.confirm('Remove this subscriber? This cannot be undone.')) return;
    try { await axios.delete(`${API}/marketing/waitlist/${id}`, { headers: getHeaders() }); setWaitlist(prev => prev.filter(w => w.id !== id)); }
    catch (err) { alert('Failed to delete'); }
  };

  const exportCSV = (rows, filename) => {
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportUnsubscribedCSV = () => {
    exportCSV([
      ['First Name', 'Last Name', 'Email', 'Company', 'Unsubscribed At', 'IP Address'],
      ...unsubscribed.map(p => [p.first_name || '', p.last_name || '', p.email, p.crm_companies?.company_name || '', p.marketing_unsubscribed_at ? new Date(p.marketing_unsubscribed_at).toISOString() : '', p.unsubscribe_ip || '']),
    ], `unsubscribed_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const exportWaitlistCSV = () => {
    exportCSV([
      ['First Name', 'Last Name', 'Email', 'Consent', 'Consent Date', 'IP Address', 'Joined'],
      ...waitlist.map(w => [w.first_name || '', w.last_name || '', w.email, w.marketing_consent ? 'Yes' : 'No', w.consent_at ? new Date(w.consent_at).toISOString() : '', w.ip_address || '', w.created_at ? new Date(w.created_at).toISOString() : '']),
    ], `waitlist_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const resubscribeBulk = async () => {
    const ids = Object.entries(selectedUnsubs).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) return;
    if (!window.confirm(`Resubscribe ${ids.length} contact(s)?`)) return;
    try { await axios.post(`${API}/marketing/resubscribe-bulk`, { person_ids: ids }, { headers: getHeaders() }); fetchUnsubscribed(); }
    catch (err) { alert('Failed'); }
  };

  const createSequence = async () => {
    if (!newSequenceName.trim()) return;
    try {
      const res = await axios.post(`${API}/drip/sequences`, { name: newSequenceName, audience: 'waitlist' }, { headers: getHeaders() });
      setDripSequences(prev => [res.data, ...prev]);
      setSelectedSequence(res.data); setDripSteps([]); setNewSequenceName(''); setShowNewSequence(false);
    } catch (err) { console.error(err); }
  };

  const toggleSequenceActive = async (seq) => {
    try {
      const res = await axios.put(`${API}/drip/sequences/${seq.id}`, { active: !seq.active }, { headers: getHeaders() });
      setDripSequences(prev => prev.map(s => s.id === seq.id ? res.data : s));
      if (selectedSequence?.id === seq.id) setSelectedSequence(res.data);
    } catch (err) { console.error(err); }
  };

  const deleteSequence = async (id) => {
    if (!window.confirm('Delete this sequence? All enrollments will be lost.')) return;
    try {
      await axios.delete(`${API}/drip/sequences/${id}`, { headers: getHeaders() });
      setDripSequences(prev => prev.filter(s => s.id !== id));
      if (selectedSequence?.id === id) { setSelectedSequence(null); setDripSteps([]); }
    } catch (err) { console.error(err); }
  };

  const saveStep = async () => {
    setSavingStep(true);
    try {
      if (editingStep) {
        const res = await axios.put(`${API}/drip/steps/${editingStep.id}`, stepForm, { headers: getHeaders() });
        setDripSteps(prev => prev.map(s => s.id === editingStep.id ? res.data : s));
      } else {
        const res = await axios.post(`${API}/drip/sequences/${selectedSequence.id}/steps`, { ...stepForm, step_number: dripSteps.length + 1 }, { headers: getHeaders() });
        setDripSteps(prev => [...prev, res.data]);
      }
      setShowDripEditor(false); setEditingStep(null);
    } catch (err) { console.error(err); }
    setSavingStep(false);
  };

  const toggleStepActive = async (s) => {
    try { const res = await axios.put(`${API}/drip/steps/${s.id}`, { active: !s.active }, { headers: getHeaders() }); setDripSteps(prev => prev.map(x => x.id === s.id ? res.data : x)); }
    catch (err) { console.error(err); }
  };

  const deleteStep = async (id) => {
    if (!window.confirm('Delete this step?')) return;
    try { await axios.delete(`${API}/drip/steps/${id}`, { headers: getHeaders() }); setDripSteps(prev => prev.filter(s => s.id !== id)); }
    catch (err) { console.error(err); }
  };

  const openCampaign = async (campaign) => {
    try { const res = await axios.get(`${API}/marketing/campaigns/${campaign.id}`, { headers: getHeaders() }); setSelectedCampaign(res.data); setView('detail'); }
    catch (err) { console.error(err); }
  };

  const deleteCampaign = async (id) => {
    if (!window.confirm('Delete this draft campaign?')) return;
    try { await axios.delete(`${API}/marketing/campaigns/${id}`, { headers: getHeaders() }); fetchCampaigns(); }
    catch (err) { console.error(err); }
  };

  const saveDraft = async () => {
    try { await axios.post(`${API}/marketing/campaigns`, form, { headers: getHeaders() }); setView('list'); fetchCampaigns(); }
    catch (err) { console.error(err); }
  };

  const sendCampaign = async () => {
    const selectedCount = Object.values(selectedRecipients).filter(Boolean).length;
    if (!window.confirm(`Send to ${selectedCount} recipients?`)) return;
    setSending(true);
    try {
      const draftRes = await axios.post(`${API}/marketing/campaigns`, form, { headers: getHeaders() });
      const campaignId = draftRes.data.id;
      const filteredRecipients = recipients.filter((_, i) => selectedRecipients[i]);
      await axios.post(`${API}/marketing/campaigns/${campaignId}/send`, { recipients: filteredRecipients }, { headers: getHeaders() });
      setView('list'); fetchCampaigns(); fetchGlobalStats();
    } catch (err) { alert('Send failed.'); }
    setSending(false);
  };

  const loadTemplate = (templateId) => {
    const t = templates.find(t => t.id === templateId);
    if (t) setForm(prev => ({ ...prev, subject: t.subject, body_html: t.body_html, template_id: t.id }));
  };

  // ─── CAMPAIGN DETAIL VIEW ───────────────────────────────────────────────────
  if (view === 'detail' && selectedCampaign) {
    const s = selectedCampaign.stats;
    return (
      <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: p.background, minHeight: '100vh', transition: 'background 0.4s' }}>
        <Sidebar />
        <div style={{ marginLeft: 220, flex: 1, padding: 40 }}>
          <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: p.primary, fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}>← Back to Campaigns</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
            <div>
              <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>Campaign Analytics</p>
              <h1 style={{ color: p.text, fontSize: 28, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>{selectedCampaign.name}</h1>
              <p style={{ color: p.textSecondary, fontSize: 13, margin: '4px 0 0' }}>Sent {selectedCampaign.sent_at ? new Date(selectedCampaign.sent_at).toLocaleDateString() : '—'} · From {selectedCampaign.from_email} · By {selectedCampaign.crm_users?.name}</p>
            </div>
            <span style={{ background: STATUS_COLORS[selectedCampaign.status]?.bg, color: STATUS_COLORS[selectedCampaign.status]?.color, borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{selectedCampaign.status}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 }}>
            {STAT_CONFIG.map(({ key, label, icon }) => {
              const val = s[key] || 0;
              const rate = key === 'opened' ? s.open_rate : key === 'clicked' ? s.ctr : key === 'bounced' ? s.bounce_rate : key === 'unsubscribed' ? s.unsub_rate : null;
              const isWarning = (key === 'bounced' && s.bounce_rate > 2) || (key === 'unsubscribed' && s.unsub_rate > 0.5);
              const isGood = (key === 'opened' && s.open_rate >= 30) || (key === 'clicked' && s.ctr >= 2);
              return (
                <div key={key} style={{ ...card, border: `1px solid ${isWarning ? '#D4183D33' : isGood ? p.primary + '33' : p.cardBorder}`, textAlign: 'center', padding: 20 }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
                  <p style={{ color: isWarning ? '#D4183D' : isGood ? p.primary : p.text, fontSize: 22, fontWeight: 700, margin: '0 0 2px' }}>{val}</p>
                  {rate !== null && <p style={{ color: isWarning ? '#D4183D' : isGood ? p.primary : p.textSecondary, fontSize: 12, margin: '0 0 4px', fontWeight: 600 }}>{rate}%</p>}
                  <p style={{ color: p.textSecondary, fontSize: 11, margin: 0, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</p>
                </div>
              );
            })}
          </div>

          <div style={{ ...card, overflow: 'hidden', marginBottom: 24 }}>
            <div onClick={() => setShowEmailPreview(prev => !prev)}
              style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: showEmailPreview ? `1px solid ${p.cardBorder}` : 'none' }}>
              <h3 style={{ color: p.text, fontSize: 15, fontWeight: 600, margin: 0 }}>Email Content</h3>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: p.textSecondary }}>Subject: <strong style={{ color: p.text }}>{selectedCampaign.subject}</strong></span>
                <span style={{ fontSize: 12, color: p.primary }}>{showEmailPreview ? '▲ Hide' : '▼ Show'}</span>
              </div>
            </div>
            {showEmailPreview && (
              <div style={{ padding: 24, maxHeight: 400, overflowY: 'auto' }}>
                <div dangerouslySetInnerHTML={{ __html: selectedCampaign.body_html }} style={{ fontSize: 14, lineHeight: 1.7, color: p.text }} />
              </div>
            )}
          </div>

          {(() => {
            const filteredRecipients = (selectedCampaign.recipients || []).filter(r => {
              if (recipientFilter === 'all') return true;
              if (recipientFilter === 'opened') return r.opened_at || r.status === 'opened' || r.status === 'clicked';
              if (recipientFilter === 'clicked') return r.clicked_at || r.status === 'clicked';
              if (recipientFilter === 'delivered') return ['delivered', 'opened', 'clicked'].includes(r.status);
              if (recipientFilter === 'bounced') return r.status === 'bounced';
              if (recipientFilter === 'unsubscribed') return r.status === 'unsubscribed';
              return true;
            });
            const selectedCount = Object.values(selectedLeads).filter(Boolean).length;
            const launchCampaignFromLeads = () => {
              const leads = filteredRecipients.filter((_, i) => selectedLeads[i]);
              const prefilledRecipients = leads.map(r => ({ email: r.email, first_name: r.crm_people?.first_name || '', last_name: r.crm_people?.last_name || '', company_name: r.crm_companies?.company_name || '', company_id: r.company_id || null, person_id: r.person_id || null, source: 'Contact' }));
              setStep(1); setForm({ name: `Follow-up — ${selectedCampaign.name}`, subject: '', body_html: '', from_name: 'QPoint', from_email: 'marketing@yourcompany.com', template_id: null });
              setRecipients(prefilledRecipients);
              const sel = {}; prefilledRecipients.forEach((_, i) => { sel[i] = true; }); setSelectedRecipients(sel);
              setRecipientFilter('all'); setSelectedLeads({}); setView('create'); setStep(2);
            };
            const FILTER_TABS = [
              { key: 'all', label: 'All', count: selectedCampaign.recipients?.length || 0 },
              { key: 'opened', label: '👁 Opened', count: s.opened || 0, hot: true },
              { key: 'clicked', label: '🖱 Clicked', count: s.clicked || 0, hot: true },
              { key: 'delivered', label: '✅ Delivered', count: s.delivered || 0 },
              { key: 'bounced', label: '↩️ Bounced', count: s.bounced || 0 },
              { key: 'unsubscribed', label: '🚫 Unsubscribed', count: s.unsubscribed || 0 },
            ];
            return (
              <div style={{ ...card, overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: `1px solid ${p.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ color: p.text, fontSize: 15, fontWeight: 600, margin: 0 }}>Recipients ({selectedCampaign.recipients?.length || 0})</h3>
                  {selectedCount > 0 && (
                    <button onClick={launchCampaignFromLeads} style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                      🚀 New Campaign from {selectedCount} Selected
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${p.cardBorder}`, padding: '0 8px' }}>
                  {FILTER_TABS.map(({ key, label, count, hot }) => (
                    <button key={key} onClick={() => { setRecipientFilter(key); setSelectedLeads({}); }}
                      style={{ background: 'none', border: 'none', borderBottom: recipientFilter === key ? `2px solid ${p.primary}` : '2px solid transparent', padding: '10px 14px', fontSize: 12, color: recipientFilter === key ? p.text : p.textSecondary, fontWeight: recipientFilter === key ? 600 : 400, cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}>
                      {label}
                      <span style={{ background: hot && count > 0 ? '#D4EDDA' : p.inputBg, color: hot && count > 0 ? '#155724' : p.textSecondary, borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 600 }}>{count}</span>
                    </button>
                  ))}
                </div>
                {(recipientFilter === 'opened' || recipientFilter === 'clicked') && filteredRecipients.length > 0 && (
                  <div style={{ background: p.inputBg, borderBottom: `1px solid ${p.cardBorder}`, padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>🔥</span>
                    <span style={{ fontSize: 12, color: p.text }}>These are your warm leads — select them and launch a follow-up campaign directly.</span>
                  </div>
                )}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: p.inputBg }}>
                      <th style={{ padding: '10px 16px', width: 40 }}>
                        <input type="checkbox" checked={filteredRecipients.length > 0 && filteredRecipients.every((_, i) => selectedLeads[i])}
                          onChange={e => { const all = {}; filteredRecipients.forEach((_, i) => { all[i] = e.target.checked; }); setSelectedLeads(all); }}
                          style={{ accentColor: p.primary }} />
                      </th>
                      {['Company', 'Contact', 'Email', 'Status', 'Delivered', 'Opened', 'Clicked', 'Bounced'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: p.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecipients.length === 0 ? (
                      <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: p.textSecondary, fontSize: 13 }}>No recipients in this category</td></tr>
                    ) : filteredRecipients.map((r, i) => (
                      <tr key={r.id} style={{ borderTop: `1px solid ${p.cardBorder}`, background: selectedLeads[i] ? p.inputBg : i % 2 === 0 ? p.cardBg : p.backgroundSecondary }}>
                        <td style={{ padding: '12px 16px' }}><input type="checkbox" checked={!!selectedLeads[i]} onChange={e => setSelectedLeads(prev => ({ ...prev, [i]: e.target.checked }))} style={{ accentColor: p.primary }} /></td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: p.text, fontWeight: 500 }}>{r.crm_companies?.company_name || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: p.textSecondary }}>{r.crm_people ? `${r.crm_people.first_name} ${r.crm_people.last_name}` : '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: p.textSecondary }}>{r.email}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: r.status === 'clicked' ? '#D4EDDA' : r.status === 'opened' ? '#E8F5E9' : r.status === 'bounced' ? '#F8D7DA' : r.status === 'unsubscribed' ? '#FFE5D0' : p.inputBg, color: r.status === 'clicked' ? '#155724' : r.status === 'opened' ? '#2E7D32' : r.status === 'bounced' ? '#721C24' : r.status === 'unsubscribed' ? '#856404' : p.textSecondary, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>{r.status}</span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: ['delivered', 'opened', 'clicked'].includes(r.status) ? '#2E7D32' : p.textMuted }}>{['delivered', 'opened', 'clicked'].includes(r.status) ? '✓' : '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: r.opened_at ? '#2E7D32' : p.textMuted }}>{r.opened_at ? new Date(r.opened_at).toLocaleDateString() : '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: r.clicked_at ? '#E65100' : p.textMuted }}>{r.clicked_at ? new Date(r.clicked_at).toLocaleDateString() : '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: r.status === 'bounced' ? '#D4183D' : p.textMuted }}>{r.status === 'bounced' ? '✗' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // ─── CAMPAIGN CREATOR ───────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: p.background, minHeight: '100vh', transition: 'background 0.4s' }}>
        <Sidebar />
        <div style={{ marginLeft: 220, flex: 1, padding: 40 }}>
          <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: p.primary, fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}>← Back to Campaigns</button>
          <h1 style={{ color: p.text, fontSize: 28, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 32px' }}>New Campaign</h1>

          <div style={{ display: 'flex', gap: 0, marginBottom: 40 }}>
            {['Content', 'Recipients', 'Review & Send'].map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: step === i + 1 ? p.primary : step > i + 1 ? p.text : p.inputBorder, color: step >= i + 1 ? '#fff' : p.textSecondary, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{step > i + 1 ? '✓' : i + 1}</div>
                  <span style={{ fontSize: 13, color: step === i + 1 ? p.text : p.textSecondary, fontWeight: step === i + 1 ? 600 : 400 }}>{s}</span>
                </div>
                {i < 2 && <div style={{ flex: 1, height: 1, background: step > i + 1 ? p.primary : p.inputBorder, margin: '0 12px' }} />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div style={{ ...card, padding: 32 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div><label style={labelStyle}>Campaign Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="e.g. Spring Outreach 2025" /></div>
                <div><label style={labelStyle}>From Email</label><select value={form.from_email} onChange={e => setForm({ ...form, from_email: e.target.value })} style={inputStyle}>{FROM_EMAILS.map(e => <option key={e} value={e}>{e}</option>)}</select></div>
                <div><label style={labelStyle}>From Name</label><input value={form.from_name} onChange={e => setForm({ ...form, from_name: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Load from Template</label><select value={form.template_id || ''} onChange={e => loadTemplate(e.target.value)} style={inputStyle}><option value="">— Select a template —</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                <div><label style={labelStyle}>Design Template</label><select value={form.design_template_id || ''} onChange={e => setForm(prev => ({ ...prev, design_template_id: e.target.value }))} style={inputStyle}><option value="">— No design wrapper —</option>{designTemplates.filter(d => d.active).map(d => <option key={d.id} value={d.id}>{d.name} ({d.type})</option>)}</select></div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Subject Line *</label>
                <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} style={inputStyle} placeholder="e.g. Quick Q re: {{company_name}}" />
              </div>
              <div>
                <label style={labelStyle}>Email Body *</label>
                <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}><span style={{ fontSize: 11, color: p.primary, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>✨ Visual Editor</span></div>
                    <TiptapEditor content={form.body_html} onChange={html => setForm(prev => ({ ...prev, body_html: html }))} placeholder="Write your campaign email..." minHeight={350} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}><span style={{ fontSize: 11, color: p.textSecondary, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>HTML Code</span></div>
                    <div style={{ flex: 1, minHeight: 0 }}><HtmlEditor value={prettifyHTML(form.body_html)} onChange={val => setForm({ ...form, body_html: val })} minHeight="100%" /></div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12, padding: '12px 16px', background: p.inputBg, borderRadius: 8, border: `1px solid ${p.cardBorder}` }}>
                  <span style={{ fontSize: 11, color: p.textSecondary, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', marginRight: 4 }}>Merge Tags:</span>
                  {[{ tag: '{{first_name}}', label: 'First Name' }, { tag: '{{last_name}}', label: 'Last Name' }, { tag: '{{company_name}}', label: 'Company' }, { tag: '{{sender_name}}', label: 'Sender' }, { tag: '{{city}}', label: 'City' }, { tag: '{{stage}}', label: 'Stage' }].map(({ tag, label }) => (
                    <button key={tag}
                      onClick={() => setForm(prev => { const current = prev.body_html || ''; const updated = current.replace(/<\/p>\s*$/, tag + '</p>') !== current ? current.replace(/<\/p>\s*$/, tag + '</p>') : current + tag; return { ...prev, body_html: updated }; })}
                      style={{ background: p.cardBg, border: `1px solid ${p.inputBorder}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: p.textSecondary, fontFamily: "'Inter', sans-serif" }}>
                      {label} <span style={{ fontFamily: 'monospace', fontSize: 10, opacity: 0.7, marginLeft: 2 }}>{tag}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                <button onClick={saveDraft} style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>💾 Save Draft</button>
                <button onClick={() => { setStep(2); fetchRecipients(); }} disabled={!form.name || !form.subject || !form.body_html}
                  style={{ background: form.name && form.subject && form.body_html ? p.primary : p.textMuted, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, cursor: form.name && form.subject && form.body_html ? 'pointer' : 'not-allowed' }}>
                  Next: Recipients →
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ ...card, padding: 32, marginBottom: 16 }}>
                <h3 style={{ color: p.text, fontSize: 15, fontWeight: 600, margin: '0 0 20px' }}>Filter Recipients</h3>
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}><label style={labelStyle}>Source</label><select value={filters.source} onChange={e => setFilters({ ...filters, source: e.target.value })} style={inputStyle}><option value="all">All (Contacts + Clients)</option><option value="contacts">Contacts Only</option><option value="clients">Clients Only</option><option value="waitlist">Waitlist Only</option></select></div>
                  <div style={{ flex: 1 }}><label style={labelStyle}>Stage</label><select value={filters.stage} onChange={e => setFilters({ ...filters, stage: e.target.value })} style={inputStyle}><option value="">All Stages</option>{STAGES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                  <div style={{ flex: 1 }}><label style={labelStyle}>Origin</label><select value={filters.origin} onChange={e => setFilters({ ...filters, origin: e.target.value })} style={inputStyle}><option value="">All Origins</option>{ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                  <div style={{ flex: 1 }}><label style={labelStyle}>City</label><input value={filters.city} onChange={e => setFilters({ ...filters, city: e.target.value })} style={inputStyle} placeholder="e.g. Austin" /></div>
                  <div><button onClick={fetchRecipients} style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>🔍 Apply</button></div>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ background: '#D4EDDA', borderRadius: 8, padding: '8px 16px' }}>
                    <span style={{ color: '#155724', fontSize: 13, fontWeight: 600 }}>✅ {loadingRecipients ? '...' : Object.values(selectedRecipients).filter(Boolean).length} of {recipients.length} recipients selected</span>
                  </div>
                  {excludedCount > 0 && <div style={{ background: '#FFE5D0', borderRadius: 8, padding: '8px 16px' }}><span style={{ color: '#856404', fontSize: 13 }}>🚫 {excludedCount} excluded (unsubscribed)</span></div>}
                </div>
                {recipients.length > 0 && (
                  <div style={{ maxHeight: 300, overflowY: 'auto', border: `1px solid ${p.cardBorder}`, borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, background: p.inputBg }}>
                        <tr>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: p.textSecondary, fontWeight: 600, width: 40 }}>
                            <input type="checkbox" checked={Object.values(selectedRecipients).filter(Boolean).length === recipients.length} onChange={e => { const all = {}; recipients.forEach((_, i) => { all[i] = e.target.checked; }); setSelectedRecipients(all); }} style={{ accentColor: p.primary }} />
                          </th>
                          {['Source', 'Company', 'Contact', 'Email', 'Stage'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: p.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {recipients.map((r, i) => (
                          <tr key={i} style={{ borderTop: `1px solid ${p.cardBorder}`, background: selectedRecipients[i] ? p.cardBg : p.backgroundSecondary, opacity: selectedRecipients[i] ? 1 : 0.5 }}>
                            <td style={{ padding: '8px 12px' }}><input type="checkbox" checked={!!selectedRecipients[i]} onChange={e => setSelectedRecipients(prev => ({ ...prev, [i]: e.target.checked }))} style={{ accentColor: p.primary }} /></td>
                            <td style={{ padding: '8px 12px' }}><span style={{ background: r.source === 'Client' ? '#D4EDDA' : r.source === 'Waitlist' ? '#F3E8FF' : '#EBF4FF', color: r.source === 'Client' ? '#155724' : r.source === 'Waitlist' ? '#7C3AED' : '#1a6fad', fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{r.source || 'Contact'}</span></td>
                            <td style={{ padding: '8px 12px', fontSize: 13, color: p.text }}>{r.company_name}</td>
                            <td style={{ padding: '8px 12px', fontSize: 13, color: p.textSecondary }}>{r.first_name} {r.last_name}</td>
                            <td style={{ padding: '8px 12px', fontSize: 13, color: p.textSecondary }}>{r.email}</td>
                            <td style={{ padding: '8px 12px', fontSize: 12, color: p.textSecondary }}>{r.stage}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => setStep(1)} style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>← Back</button>
                <button onClick={() => setStep(3)} disabled={Object.values(selectedRecipients).filter(Boolean).length === 0}
                  style={{ background: Object.values(selectedRecipients).filter(Boolean).length > 0 ? p.primary : p.textMuted, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, cursor: Object.values(selectedRecipients).filter(Boolean).length > 0 ? 'pointer' : 'not-allowed' }}>
                  Next: Review →
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div style={{ ...card, padding: 32, marginBottom: 16 }}>
                <h3 style={{ color: p.text, fontSize: 15, fontWeight: 600, margin: '0 0 20px' }}>Campaign Summary</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                  {[{ label: 'Campaign Name', value: form.name }, { label: 'From', value: `${form.from_name} <${form.from_email}>` }, { label: 'Subject', value: form.subject }, { label: 'Recipients', value: `${Object.values(selectedRecipients).filter(Boolean).length} contacts` }].map(({ label, value }) => (
                    <div key={label} style={{ background: p.inputBg, borderRadius: 8, padding: 16 }}>
                      <p style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>{label}</p>
                      <p style={{ color: p.text, fontSize: 14, fontWeight: 500, margin: 0 }}>{value}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>Email Preview</p>
                  <div style={{ border: `1px solid ${p.cardBorder}`, borderRadius: 8, padding: 24, background: p.inputBg }}>
                    <p style={{ color: p.textSecondary, fontSize: 12, margin: '0 0 8px' }}>Subject: <strong style={{ color: p.text }}>{form.subject}</strong></p>
                    <hr style={{ border: 'none', borderTop: `1px solid ${p.cardBorder}`, margin: '12px 0' }} />
                    <div dangerouslySetInnerHTML={{ __html: form.body_html }} style={{ fontSize: 14 }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => setStep(2)} style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>← Back</button>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={saveDraft} style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>💾 Save Draft</button>
                  <button onClick={sendCampaign} disabled={sending}
                    style={{ background: sending ? p.textMuted : p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 13, cursor: sending ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                    {sending ? '⏳ Sending...' : `🚀 Send to ${Object.values(selectedRecipients).filter(Boolean).length} Recipients`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── MAIN LIST VIEW ─────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: p.background, minHeight: '100vh', transition: 'background 0.4s' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: 40 }}>
        <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>Growth</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1 style={{ color: p.text, fontSize: 30, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>Marketing</h1>
          {canSend && subView === 'campaigns' && (
            <button onClick={() => { setStep(1); setForm({ name: '', subject: '', body_html: '', from_name: 'QPoint', from_email: 'marketing@yourcompany.com', template_id: null }); setView('create'); }}
              style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>
              + New Campaign
            </button>
          )}
        </div>

        {/* Sub Navigation */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${p.cardBorder}`, marginBottom: 24 }}>
          {[
            { key: 'campaigns', label: 'Campaigns', onClick: () => setSubView('campaigns') },
            { key: 'unsubscribed', label: `Unsubscribed${unsubscribed.length > 0 ? ` (${unsubscribed.length})` : ''}`, onClick: () => { setSubView('unsubscribed'); fetchUnsubscribed(); } },
            { key: 'drip', label: 'Drip Sequences', onClick: () => { setSubView('drip'); fetchDripSequences(); } },
            { key: 'waitlist', label: 'Waitlist', onClick: () => { setSubView('waitlist'); fetchWaitlist(); } },
          ].map(({ key, label, onClick }) => (
            <button key={key} onClick={onClick}
              style={{ background: 'none', border: 'none', borderBottom: subView === key ? `2px solid ${p.primary}` : '2px solid transparent', padding: '10px 20px', fontSize: 13, color: subView === key ? p.text : p.textSecondary, fontWeight: subView === key ? 600 : 400, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              {label}
            </button>
          ))}
        </div>

        {/* CAMPAIGNS */}
        {subView === 'campaigns' && (<>
          {globalStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 32 }}>
              {[{ label: 'Total Campaigns', value: globalStats.total_campaigns, icon: '📣' }, { label: 'Total Sent', value: globalStats.total_sent, icon: '📤' }, { label: 'Avg Open Rate', value: `${globalStats.avg_open_rate}%`, icon: '👁' }, { label: 'Avg CTR', value: `${globalStats.avg_ctr}%`, icon: '🖱' }, { label: 'Unsubscribed', value: globalStats.total_unsubscribed, icon: '🚫' }].map(({ label, value, icon }) => (
                <div key={label} style={{ ...card, padding: 20, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
                  <p style={{ color: p.text, fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>{value}</p>
                  <p style={{ color: p.textSecondary, fontSize: 11, margin: 0, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</p>
                </div>
              ))}
            </div>
          )}
          {loading ? (
            <p style={{ color: p.textSecondary }}>Loading...</p>
          ) : campaigns.length === 0 ? (
            <div style={{ ...card, padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📣</div>
              <p style={{ color: p.text, fontSize: 16, fontWeight: 500, margin: '0 0 8px' }}>No campaigns yet</p>
              <p style={{ color: p.textSecondary, fontSize: 13, margin: '0 0 24px' }}>Create your first email campaign to get started</p>
              {canSend && <button onClick={() => setView('create')} style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>+ New Campaign</button>}
            </div>
          ) : (
            <div style={{ ...card, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: p.inputBg }}>
                    {['Campaign', 'Status', 'Recipients', 'Open Rate', 'CTR', 'Sent', ''].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: p.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c, i) => (
                    <tr key={c.id} style={{ borderTop: `1px solid ${p.cardBorder}`, background: i % 2 === 0 ? p.cardBg : p.backgroundSecondary, cursor: 'pointer' }} onClick={() => openCampaign(c)}>
                      <td style={{ padding: '14px 16px' }}>
                        <p style={{ color: p.text, fontSize: 14, fontWeight: 500, margin: '0 0 2px' }}>{c.name}</p>
                        <p style={{ color: p.textSecondary, fontSize: 12, margin: 0 }}>By {c.crm_users?.name}</p>
                      </td>
                      <td style={{ padding: '14px 16px' }}><span style={{ background: STATUS_COLORS[c.status]?.bg, color: STATUS_COLORS[c.status]?.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>{c.status}</span></td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: p.textSecondary }}>{c.stats?.sent || 0}</td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: c.stats?.open_rate >= 30 ? p.primary : p.text, fontWeight: c.stats?.open_rate >= 30 ? 600 : 400 }}>{c.status === 'sent' ? `${c.stats?.open_rate || 0}%` : '—'}</td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: c.stats?.ctr >= 2 ? p.primary : p.text, fontWeight: c.stats?.ctr >= 2 ? 600 : 400 }}>{c.status === 'sent' ? `${c.stats?.ctr || 0}%` : '—'}</td>
                      <td style={{ padding: '14px 16px', fontSize: 12, color: p.textSecondary }}>{c.sent_at ? new Date(c.sent_at).toLocaleDateString() : '—'}</td>
                      <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
                        {c.status === 'draft' && canSend && <button onClick={() => deleteCampaign(c.id)} style={{ background: '#fdf0f0', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#D4183D' }}>Delete</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>)}

        {/* DRIP SEQUENCES */}
        {subView === 'drip' && (
          <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 220px)' }}>
            <div style={{ width: 280, flexShrink: 0, ...card, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${p.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: 0 }}>Sequences</h3>
                <button onClick={() => setShowNewSequence(true)} style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>+ New</button>
              </div>
              {showNewSequence && (
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${p.cardBorder}`, background: p.inputBg }}>
                  <input value={newSequenceName} onChange={e => setNewSequenceName(e.target.value)} placeholder="Sequence name..."
                    style={{ width: '100%', background: p.cardBg, border: `1px solid ${p.inputBorder}`, borderRadius: 6, padding: '7px 10px', fontSize: 12, outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif', color: p.text }}
                    onKeyDown={e => { if (e.key === 'Enter') createSequence(); if (e.key === 'Escape') setShowNewSequence(false); }} autoFocus />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button onClick={createSequence} style={{ flex: 1, background: p.primary, color: '#fff', border: 'none', borderRadius: 6, padding: '6px', fontSize: 11, cursor: 'pointer' }}>Create</button>
                    <button onClick={() => setShowNewSequence(false)} style={{ flex: 1, background: p.inputBg, color: p.textSecondary, border: `1px solid ${p.inputBorder}`, borderRadius: 6, padding: '6px', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {loadingDrip ? <p style={{ color: p.textSecondary, fontSize: 12, padding: 20, textAlign: 'center' }}>Loading...</p>
                  : dripSequences.length === 0 ? <div style={{ padding: 24, textAlign: 'center' }}><p style={{ fontSize: 24 }}>💧</p><p style={{ color: p.textSecondary, fontSize: 12, margin: 0 }}>No sequences yet</p></div>
                  : dripSequences.map(seq => (
                    <div key={seq.id} onClick={() => { setSelectedSequence(seq); fetchDripSteps(seq.id); }}
                      style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: `1px solid ${p.cardBorder}`, background: selectedSequence?.id === seq.id ? p.inputBg : 'transparent', borderLeft: selectedSequence?.id === seq.id ? `3px solid ${p.primary}` : '3px solid transparent' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ color: p.text, fontSize: 13, fontWeight: 500, margin: '0 0 4px' }}>{seq.name}</p>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <span style={{ fontSize: 10, color: p.textSecondary }}>{seq.step_count} steps</span>
                            <span style={{ fontSize: 10, color: p.textSecondary }}>{seq.enrollment_count} active</span>
                          </div>
                        </div>
                        <div onClick={e => { e.stopPropagation(); toggleSequenceActive(seq); }}
                          style={{ width: 28, height: 16, borderRadius: 8, background: seq.active ? p.primary : p.inputBorder, cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                          <div style={{ position: 'absolute', top: 2, left: seq.active ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div style={{ flex: 1, ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {!selectedSequence ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 32 }}>💧</p>
                  <p style={{ color: p.text, fontSize: 14, fontWeight: 500, margin: 0 }}>Select a sequence</p>
                  <p style={{ color: p.textSecondary, fontSize: 12, margin: 0 }}>Or create a new one</p>
                </div>
              ) : (
                <>
                  <div style={{ padding: '16px 24px', borderBottom: `1px solid ${p.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <div>
                      <h3 style={{ color: p.text, fontSize: 15, fontWeight: 600, margin: '0 0 2px' }}>{selectedSequence.name}</h3>
                      <p style={{ color: p.textSecondary, fontSize: 12, margin: 0 }}>Audience: Waitlist · {dripSteps.length} steps · {selectedSequence.enrollment_count} enrolled</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setEditingStep(null); setStepForm({ delay_days: 3, subject: '', body_html: '', design_template_id: '', active: true }); setShowDripEditor(true); fetchDesignPreview(''); }}
                        style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}>+ Add Step</button>
                      <button onClick={() => deleteSequence(selectedSequence.id)} style={{ background: '#fdf0f0', color: '#D4183D', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}>Delete</button>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                    {dripSteps.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 40 }}>
                        <p style={{ fontSize: 32, marginBottom: 8 }}>📧</p>
                        <p style={{ color: p.text, fontSize: 14, fontWeight: 500, margin: '0 0 4px' }}>No steps yet</p>
                        <button onClick={() => { setEditingStep(null); setStepForm({ delay_days: 3, subject: '', body_html: '', design_template_id: '', active: true }); setShowDripEditor(true); fetchDesignPreview(''); }}
                          style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', marginTop: 12 }}>+ Add First Step</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {dripSteps.map((s, i) => (
                          <div key={s.id}>
                            {i > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 4px 20px', marginBottom: 4 }}><div style={{ width: 1, height: 24, background: p.inputBorder, marginLeft: 11 }} /><span style={{ fontSize: 10, color: p.textMuted }}>+{s.delay_days} day{s.delay_days !== 1 ? 's' : ''} after previous</span></div>}
                            <div style={{ background: s.active ? p.cardBg : p.inputBg, borderRadius: 10, border: `1px solid ${s.active ? p.primary + '33' : p.cardBorder}`, padding: '16px 20px', opacity: s.active ? 1 : 0.6 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                    <span style={{ background: p.primary, color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{s.step_number}</span>
                                    <span style={{ color: p.textSecondary, fontSize: 11 }}>{i === 0 ? `Send ${s.delay_days} day${s.delay_days !== 1 ? 's' : ''} after signup` : `Send ${s.delay_days} day${s.delay_days !== 1 ? 's' : ''} after previous`}</span>
                                  </div>
                                  <p style={{ color: p.text, fontSize: 13, fontWeight: 600, margin: '0 0 2px' }}>{s.subject || '— No subject —'}</p>
                                  <p style={{ color: p.textMuted, fontSize: 11, margin: 0 }}>{s.crm_email_design_templates?.name || 'No design template'}</p>
                                  {stepStats[s.id] && stepStats[s.id].sent > 0 && (
                                    <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                                      {[{ label: 'Sent', value: stepStats[s.id].sent, color: p.textSecondary }, { label: 'Opened', value: `${stepStats[s.id].opened} (${stepStats[s.id].open_rate}%)`, color: p.primary }, { label: 'Clicked', value: stepStats[s.id].clicked, color: '#4A7CC7' }, { label: 'Bounced', value: stepStats[s.id].bounced, color: '#D4183D' }].map(({ label, value, color }) => (
                                        <div key={label} style={{ textAlign: 'center' }}>
                                          <p style={{ color, fontSize: 12, fontWeight: 600, margin: '0 0 1px' }}>{value}</p>
                                          <p style={{ color: p.textMuted, fontSize: 10, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                  <div onClick={() => toggleStepActive(s)} style={{ width: 28, height: 16, borderRadius: 8, background: s.active ? p.primary : p.inputBorder, cursor: 'pointer', position: 'relative' }}>
                                    <div style={{ position: 'absolute', top: 2, left: s.active ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                                  </div>
                                  <button onClick={() => { setEditingStep(s); setStepForm({ delay_days: s.delay_days, subject: s.subject || '', body_html: s.body_html || '', design_template_id: s.design_template_id || '', active: s.active }); setShowDripEditor(true); fetchDesignPreview(s.design_template_id); }}
                                    style={{ background: p.inputBg, border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: p.text }}>✏️ Edit</button>
                                  <button onClick={() => deleteStep(s.id)} style={{ background: '#fdf0f0', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#D4183D' }}>Delete</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* DRIP STEP EDITOR MODAL */}
        {showDripEditor && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: p.cardBg, borderRadius: 16, width: '95vw', maxWidth: 1200, height: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: `1px solid ${p.cardBorder}` }}>
              <div style={{ padding: '20px 28px', borderBottom: `1px solid ${p.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <h2 style={{ color: p.text, fontSize: 18, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>
                  {editingStep ? 'Edit Step' : 'New Step'} — {selectedSequence?.name}
                </h2>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={saveStep} disabled={savingStep} style={{ background: savingStep ? p.textMuted : p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>
                    {savingStep ? '⏳ Saving...' : '💾 Save Step'}
                  </button>
                  <button onClick={() => { setShowDripEditor(false); setEditingStep(null); }} style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>✕</button>
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
                <div style={{ flex: 1, overflow: 'auto', padding: 28, display: 'flex', flexDirection: 'column', gap: 16, borderRight: `1px solid ${p.cardBorder}` }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Send after (days)</label>
                      <input type="number" min="1" value={stepForm.delay_days} onChange={e => setStepForm(prev => ({ ...prev, delay_days: parseInt(e.target.value) || 1 }))} style={inputStyle} />
                      <p style={{ color: p.textMuted, fontSize: 11, margin: '4px 0 0' }}>Days after signup (step 1) or previous step</p>
                    </div>
                    <div>
                      <label style={labelStyle}>Design Template</label>
                      <select value={stepForm.design_template_id || ''} onChange={e => { setStepForm(prev => ({ ...prev, design_template_id: e.target.value })); fetchDesignPreview(e.target.value); }} style={inputStyle}>
                        <option value="">— Default Transactional —</option>
                        {designTemplates.filter(d => d.active).map(d => <option key={d.id} value={d.id}>{d.name} ({d.type})</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Subject Line</label>
                    <input value={stepForm.subject} onChange={e => setStepForm(prev => ({ ...prev, subject: e.target.value }))} placeholder="e.g. You're on the list ✨" style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Email Body</label>
                    <HtmlEditor value={stepForm.body_html} onChange={val => setStepForm(prev => ({ ...prev, body_html: val }))} minHeight="300px" />
                  </div>
                </div>
                <div style={{ width: 440, flexShrink: 0, overflow: 'auto', background: p.inputBg }}>
                  <div style={{ padding: '12px 16px', borderBottom: `1px solid ${p.cardBorder}`, background: p.cardBg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ color: p.textSecondary, fontSize: 11, margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>Live Preview</p>
                    {loadingPreview && <p style={{ color: p.textMuted, fontSize: 11, margin: 0 }}>Loading...</p>}
                  </div>
                  <div style={{ padding: 16 }}>
                    <div dangerouslySetInnerHTML={{ __html: designPreviewHtml ? designPreviewHtml.replace('{{content}}', stepForm.body_html || `<p style="color:${p.textMuted};text-align:center;padding:40px;">Start typing to see preview...</p>`).replace('{{unsubscribe_url}}', '#') : stepForm.body_html || `<p style="color:${p.textMuted};text-align:center;padding:40px;">Start typing to see preview...</p>` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WAITLIST */}
        {subView === 'waitlist' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
              {[{ label: 'Total Subscribers', value: waitlist.length, icon: '💌' }, { label: 'Consented', value: waitlist.filter(w => w.marketing_consent).length, icon: '✅' }, { label: 'This Week', value: waitlist.filter(w => new Date(w.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length, icon: '📅' }, { label: 'Today', value: waitlist.filter(w => new Date(w.created_at).toDateString() === new Date().toDateString()).length, icon: '🌱' }].map(({ label, value, icon }) => (
                <div key={label} style={{ ...card, padding: 20, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
                  <p style={{ color: p.text, fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>{value}</p>
                  <p style={{ color: p.textSecondary, fontSize: 11, margin: 0, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</p>
                </div>
              ))}
            </div>
            <div style={{ ...card, overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: `1px solid ${p.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h3 style={{ color: p.text, fontSize: 15, fontWeight: 600, margin: 0 }}>Waitlist ({waitlist.length})</h3>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input value={waitlistSearch} onChange={e => setWaitlistSearch(e.target.value)} placeholder="Search name or email..."
                    style={{ background: p.inputBg, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '7px 12px', fontSize: 12, outline: 'none', fontFamily: 'Inter, sans-serif', width: 200, color: p.text }} />
                  <button onClick={exportWaitlistCSV} style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>⬇ Export CSV</button>
                </div>
              </div>
              {loadingWaitlist ? <div style={{ padding: 40, textAlign: 'center', color: p.textSecondary }}>Loading...</div>
                : waitlist.length === 0 ? <div style={{ padding: 60, textAlign: 'center', color: p.textSecondary }}><p style={{ fontSize: 32, marginBottom: 12 }}>💌</p><p style={{ fontSize: 14 }}>No subscribers yet.</p></div>
                : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: p.inputBg }}>
                          {['First Name', 'Last Name', 'Email', 'Consent', 'Email Status', 'Joined', 'IP Address', 'Actions'].map(h => (
                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: p.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: `1px solid ${p.cardBorder}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {waitlist.filter(w => !waitlistSearch || w.email.toLowerCase().includes(waitlistSearch.toLowerCase()) || (w.name || '').toLowerCase().includes(waitlistSearch.toLowerCase())).map((w, i) => (
                          <tr key={w.id} style={{ borderBottom: `1px solid ${p.cardBorder}`, background: i % 2 === 0 ? p.cardBg : p.backgroundSecondary }}>
                            <td style={{ padding: '12px 16px', fontSize: 13, color: p.text }}>{w.first_name || <span style={{ color: p.textMuted }}>—</span>}</td>
                            <td style={{ padding: '12px 16px', fontSize: 13, color: p.text }}>{w.last_name || <span style={{ color: p.textMuted }}>—</span>}</td>
                            <td style={{ padding: '12px 16px', fontSize: 13, color: p.text }}>{w.email}</td>
                            <td style={{ padding: '12px 16px', fontSize: 12 }}>
                              <span style={{ background: w.marketing_consent ? '#E8F5E9' : '#FFEBEE', color: w.marketing_consent ? '#2E7D32' : '#D4183D', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>{w.marketing_consent ? '✓ Consented' : '✗ No consent'}</span>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 12 }}>
                              {(() => {
                                const s = w.email_status;
                                if (!s || s === 'pending') return <span style={{ background: p.inputBg, color: p.textSecondary, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>⏳ Pending</span>;
                                if (s === 'delivered') return <span style={{ background: '#E8F5E9', color: '#2E7D32', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>✅ Delivered</span>;
                                if (s === 'opened') return <span style={{ background: '#E8F0FE', color: '#1a6fad', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>📬 Opened</span>;
                                if (s === 'bounced') return <span style={{ background: '#FFEBEE', color: '#D4183D', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>❌ Bounced</span>;
                                return <span style={{ background: p.inputBg, color: p.textSecondary, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>{s}</span>;
                              })()}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 12, color: p.textSecondary }}>{new Date(w.created_at).toLocaleDateString()}</td>
                            <td style={{ padding: '12px 16px', fontSize: 11, color: p.textMuted, fontFamily: 'monospace' }}>{w.ip_address || '—'}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <button onClick={() => deleteWaitlistEntry(w.id)} style={{ background: '#fdf0f0', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#D4183D' }}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* UNSUBSCRIBED */}
        {subView === 'unsubscribed' && (
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${p.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h3 style={{ color: p.text, fontSize: 15, fontWeight: 600, margin: 0 }}>Unsubscribed Contacts ({unsubscribed.length})</h3>
                <button onClick={exportUnsubscribedCSV} style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>⬇ Export CSV</button>
              </div>
              {Object.values(selectedUnsubs).some(Boolean) && (
                <button onClick={resubscribeBulk} style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  Resubscribe {Object.values(selectedUnsubs).filter(Boolean).length} Selected
                </button>
              )}
            </div>
            {loadingUnsubs ? <div style={{ padding: 40, textAlign: 'center', color: p.textSecondary }}>Loading...</div>
              : unsubscribed.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center' }}>
                  <p style={{ color: p.primary, fontSize: 14, fontWeight: 500, margin: '0 0 4px' }}>No unsubscribed contacts</p>
                  <p style={{ color: p.textSecondary, fontSize: 12, margin: 0 }}>Everyone is receiving marketing emails</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: p.inputBg }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', width: 40 }}>
                        <input type="checkbox" checked={Object.values(selectedUnsubs).filter(Boolean).length === unsubscribed.length && unsubscribed.length > 0}
                          onChange={e => { const all = {}; unsubscribed.forEach(per => { all[per.id] = e.target.checked; }); setSelectedUnsubs(all); }} style={{ accentColor: p.primary }} />
                      </th>
                      {['Name', 'Email', 'Company', 'Status', 'Unsubscribed', 'IP', ''].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: p.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {unsubscribed.map((per, i) => (
                      <tr key={per.id} style={{ borderTop: `1px solid ${p.cardBorder}`, background: i % 2 === 0 ? p.cardBg : p.backgroundSecondary }}>
                        <td style={{ padding: '12px 16px' }}><input type="checkbox" checked={!!selectedUnsubs[per.id]} onChange={e => setSelectedUnsubs(prev => ({ ...prev, [per.id]: e.target.checked }))} style={{ accentColor: p.primary }} /></td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: p.text, fontWeight: 500 }}>{per.first_name} {per.last_name}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: p.textSecondary }}>{per.email}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: p.text, cursor: 'pointer' }} onClick={() => per.crm_companies?.id && window.open(`/contacts/${per.crm_companies.id}`, '_blank')}>{per.crm_companies?.company_name || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: per.crm_companies?.stage === 'Converted' ? '#E3F2FD' : p.inputBg, color: per.crm_companies?.stage === 'Converted' ? '#1a6fad' : p.textSecondary, fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
                            {per.crm_companies?.stage === 'Converted' ? 'Client' : 'Contact'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: p.textSecondary }}>{per.marketing_unsubscribed_at ? new Date(per.marketing_unsubscribed_at).toLocaleDateString() : '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 11, color: p.textMuted, fontFamily: 'monospace' }}>{per.unsubscribe_ip || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <button onClick={async () => { try { await axios.post(`${API}/marketing/resubscribe/${per.id}`, {}, { headers: getHeaders() }); fetchUnsubscribed(); } catch (err) { console.error(err); } }}
                            style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
                            Resubscribe
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        )}
      </div>
    </div>
  );
}