import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useRole } from '../hooks/useRole';
import TiptapEditor from '../components/TiptapEditor';
import HtmlEditor from '../components/HtmlEditor';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const STAGES = ['New', 'Contacted', 'No Reply', 'Follow-up', 'Meeting Scheduled', 'Proposal Offered', 'Agreement Sent', 'Closed Won', 'Closed Lost', 'Not Interested'];
const ORIGINS = ['Upload', 'Cold', 'Hot', 'Instagram', 'Google', 'Referral'];
const FROM_EMAILS = ['marketing@planfor.io', 'noreply@planfor.io', 'dan.s@planfor.io'];

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
  const canSend = can('marketing:send');

  const [view, setView] = useState('list');
  const [campaigns, setCampaigns] = useState([]);
  const [globalStats, setGlobalStats] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Campaign builder state
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', subject: '', body_html: '', from_name: 'Planfor', from_email: 'marketing@planfor.io', template_id: null,
  });
  const [filters, setFilters] = useState({ stage: '', origin: '', city: '', category: '', source: 'all' });
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState({});
  const [excludedCount, setExcludedCount] = useState(0);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [templates, setTemplates] = useState([]);

  // Campaign detail — hot leads
  const [recipientFilter, setRecipientFilter] = useState('all');
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState({});

  // Sub navigation
  const [subView, setSubView] = useState('campaigns');
  const [waitlist, setWaitlist] = useState([]);
  const [loadingWaitlist, setLoadingWaitlist] = useState(false);
  const [waitlistSearch, setWaitlistSearch] = useState('');
  const [unsubscribed, setUnsubscribed] = useState([]);
  const [selectedUnsubs, setSelectedUnsubs] = useState({});
  const [loadingUnsubs, setLoadingUnsubs] = useState(false);

  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchCampaigns(); fetchGlobalStats(); fetchTemplates(); }, []);

  const fetchCampaigns = async () => {
    try {
      const res = await axios.get(`${API}/marketing/campaigns`, { headers: getHeaders() });
      setCampaigns(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchGlobalStats = async () => {
    try {
      const res = await axios.get(`${API}/marketing/stats`, { headers: getHeaders() });
      setGlobalStats(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchTemplates = async () => {
    try {
      const res = await axios.get(`${API}/emails/templates`, { headers: getHeaders() });
      setTemplates(res.data.filter(t => t.visibility === 'team'));
    } catch (err) { console.error(err); }
  };

  const fetchWaitlist = async () => {
    setLoadingWaitlist(true);
    try {
      const res = await axios.get(`${API}/marketing/waitlist`, { headers: getHeaders() });
      setWaitlist(res.data);
    } catch (err) { console.error(err); }
    setLoadingWaitlist(false);
  };

  const deleteWaitlistEntry = async (id) => {
    if (!window.confirm('Remove this subscriber? This cannot be undone.')) return;
    try {
      await axios.delete(`${API}/marketing/waitlist/${id}`, { headers: getHeaders() });
      setWaitlist(prev => prev.filter(w => w.id !== id));
    } catch (err) { console.error(err); alert('Failed to delete'); }
  };

  const exportUnsubscribedCSV = () => {
    const rows = [
      ['First Name', 'Last Name', 'Email', 'Company', 'Unsubscribed At', 'IP Address', 'User Agent', 'Campaign ID'],
      ...unsubscribed.map(p => [
        p.first_name || '',
        p.last_name || '',
        p.email,
        p.crm_companies?.company_name || '',
        p.marketing_unsubscribed_at ? new Date(p.marketing_unsubscribed_at).toISOString() : '',
        p.unsubscribe_ip || '',
        p.unsubscribe_user_agent || '',
        p.unsubscribe_campaign_id || '',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unsubscribed_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportWaitlistCSV = () => {
    const rows = [
      ['First Name', 'Last Name', 'Email', 'Consent', 'Consent Date', 'IP Address', 'User Agent', 'Consent Text', 'Joined', 'Unsubscribed At', 'Unsubscribe IP', 'Unsubscribe User Agent'],
      ...waitlist.map(w => [
        w.first_name || '',
        w.last_name || '',
        w.email,
        w.marketing_consent ? 'Yes' : 'No',
        w.consent_at ? new Date(w.consent_at).toISOString() : '',
        w.ip_address || '',
        w.user_agent || '',
        w.consent_text || '',
        w.created_at ? new Date(w.created_at).toISOString() : '',
        w.unsubscribed_at ? new Date(w.unsubscribed_at).toISOString() : '',
        w.unsubscribe_ip || '',
        w.unsubscribe_user_agent || '',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waitlist_couples_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fetchUnsubscribed = async () => {
    setLoadingUnsubs(true);
    try {
      const res = await axios.get(`${API}/marketing/unsubscribed`, { headers: getHeaders() });
      setUnsubscribed(res.data);
      setSelectedUnsubs({});
    } catch (err) { console.error(err); }
    setLoadingUnsubs(false);
  };

  const resubscribeBulk = async () => {
    const ids = Object.entries(selectedUnsubs).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) return;
    if (!window.confirm(`Resubscribe ${ids.length} contact(s)?`)) return;
    try {
      await axios.post(`${API}/marketing/resubscribe-bulk`, { person_ids: ids }, { headers: getHeaders() });
      fetchUnsubscribed();
    } catch (err) { console.error(err); alert('Failed'); }
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

  const openCampaign = async (campaign) => {
    try {
      const res = await axios.get(`${API}/marketing/campaigns/${campaign.id}`, { headers: getHeaders() });
      setSelectedCampaign(res.data);
      setView('detail');
    } catch (err) { console.error(err); }
  };

  const deleteCampaign = async (id) => {
    if (!window.confirm('Delete this draft campaign?')) return;
    try {
      await axios.delete(`${API}/marketing/campaigns/${id}`, { headers: getHeaders() });
      fetchCampaigns();
    } catch (err) { console.error(err); }
  };

  const saveDraft = async () => {
    try {
      await axios.post(`${API}/marketing/campaigns`, form, { headers: getHeaders() });
      setView('list');
      fetchCampaigns();
    } catch (err) { console.error(err); }
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
      setView('list');
      fetchCampaigns();
      fetchGlobalStats();
    } catch (err) {
      console.error(err);
      alert('Send failed. Check console for details.');
    }
    setSending(false);
  };

  const loadTemplate = (templateId) => {
    const t = templates.find(t => t.id === templateId);
    if (t) {
      setForm(prev => ({ ...prev, subject: t.subject, body_html: t.body_html, template_id: t.id }));
    }
  };

  const inputStyle = { width: '100%', background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '9px 12px', color: '#3E423D', fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 5 };

  // ─── CAMPAIGN DETAIL VIEW ───────────────────────────────────────────────────
  if (view === 'detail' && selectedCampaign) {
    const s = selectedCampaign.stats;
    return (
      <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
        <Sidebar />
        <div style={{ marginLeft: 240, flex: 1, padding: 40 }}>
          <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: '#8E9B8B', fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}>← Back to Campaigns</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
            <div>
              <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>Campaign Analytics</p>
              <h1 style={{ color: '#3E423D', fontSize: 28, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>{selectedCampaign.name}</h1>
              <p style={{ color: '#717182', fontSize: 13, margin: '4px 0 0' }}>
                Sent {selectedCampaign.sent_at ? new Date(selectedCampaign.sent_at).toLocaleDateString() : '—'} · From {selectedCampaign.from_email} · By {selectedCampaign.crm_users?.name}
              </p>
            </div>
            <span style={{ background: STATUS_COLORS[selectedCampaign.status]?.bg, color: STATUS_COLORS[selectedCampaign.status]?.color, borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
              {selectedCampaign.status}
            </span>
          </div>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 }}>
            {STAT_CONFIG.map(({ key, label, icon }) => {
              const val = s[key] || 0;
              const rate = key === 'opened' ? s.open_rate : key === 'clicked' ? s.ctr : key === 'bounced' ? s.bounce_rate : key === 'unsubscribed' ? s.unsub_rate : null;
              const isWarning = (key === 'bounced' && s.bounce_rate > 2) || (key === 'unsubscribed' && s.unsub_rate > 0.5);
              const isGood = (key === 'opened' && s.open_rate >= 30) || (key === 'clicked' && s.ctr >= 2);
              return (
                <div key={key} style={{ background: '#fff', borderRadius: 12, padding: 20, border: `1px solid ${isWarning ? '#D4183D33' : isGood ? '#8E9B8B33' : 'rgba(62,66,61,0.1)'}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
                  <p style={{ color: isWarning ? '#D4183D' : isGood ? '#8E9B8B' : '#3E423D', fontSize: 22, fontWeight: 700, margin: '0 0 2px' }}>{val}</p>
                  {rate !== null && <p style={{ color: isWarning ? '#D4183D' : isGood ? '#8E9B8B' : '#717182', fontSize: 12, margin: '0 0 4px', fontWeight: 600 }}>{rate}%</p>}
                  <p style={{ color: '#717182', fontSize: 11, margin: 0, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</p>
                </div>
              );
            })}
          </div>

          {/* Email Preview */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden', marginBottom: 24 }}>
            <div onClick={() => setShowEmailPreview(prev => !prev)}
              style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: showEmailPreview ? '1px solid rgba(62,66,61,0.08)' : 'none' }}>
              <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: 0 }}>Email Content</h3>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#717182' }}>Subject: <strong style={{ color: '#3E423D' }}>{selectedCampaign.subject}</strong></span>
                <span style={{ fontSize: 12, color: '#8E9B8B' }}>{showEmailPreview ? '▲ Hide' : '▼ Show'}</span>
              </div>
            </div>
            {showEmailPreview && (
              <div style={{ padding: 24, maxHeight: 400, overflowY: 'auto' }}>
                <div dangerouslySetInnerHTML={{ __html: selectedCampaign.body_html }} style={{ fontSize: 14, lineHeight: 1.7, color: '#3E423D' }} />
              </div>
            )}
          </div>

          {/* Recipients Table */}
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
              const prefilledRecipients = leads.map(r => ({
                email: r.email,
                first_name: r.crm_people?.first_name || '',
                last_name: r.crm_people?.last_name || '',
                company_name: r.crm_companies?.company_name || '',
                company_id: r.company_id || null,
                person_id: r.person_id || null,
                source: 'Contact',
              }));
              setStep(1);
              setForm({ name: `Follow-up — ${selectedCampaign.name}`, subject: '', body_html: '', from_name: 'Planfor', from_email: 'marketing@planfor.io', template_id: null });
              setRecipients(prefilledRecipients);
              const sel = {};
              prefilledRecipients.forEach((_, i) => { sel[i] = true; });
              setSelectedRecipients(sel);
              setRecipientFilter('all');
              setSelectedLeads({});
              setView('create');
              setStep(2);
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
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(62,66,61,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: 0 }}>
                    Recipients ({selectedCampaign.recipients?.length || 0})
                  </h3>
                  {selectedCount > 0 && (
                    <button onClick={launchCampaignFromLeads}
                      style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                      🚀 New Campaign from {selectedCount} Selected
                    </button>
                  )}
                </div>

                {/* Filter Tabs */}
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(62,66,61,0.08)', padding: '0 8px' }}>
                  {FILTER_TABS.map(({ key, label, count, hot }) => (
                    <button key={key} onClick={() => { setRecipientFilter(key); setSelectedLeads({}); }}
                      style={{
                        background: 'none', border: 'none',
                        borderBottom: recipientFilter === key ? '2px solid #8E9B8B' : '2px solid transparent',
                        padding: '10px 14px', fontSize: 12,
                        color: recipientFilter === key ? '#3E423D' : '#717182',
                        fontWeight: recipientFilter === key ? 600 : 400,
                        cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}>
                      {label}
                      <span style={{
                        background: hot && count > 0 ? '#D4EDDA' : '#F5F3EF',
                        color: hot && count > 0 ? '#155724' : '#717182',
                        borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 600,
                      }}>{count}</span>
                    </button>
                  ))}
                </div>

                {/* Hot leads hint */}
                {(recipientFilter === 'opened' || recipientFilter === 'clicked') && filteredRecipients.length > 0 && (
                  <div style={{ background: '#F0F7F0', borderBottom: '1px solid rgba(142,155,139,0.2)', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>🔥</span>
                    <span style={{ fontSize: 12, color: '#3E6B3E' }}>
                      These are your warm leads — select them and launch a follow-up campaign directly.
                    </span>
                  </div>
                )}

                {/* Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F5F3EF' }}>
                      <th style={{ padding: '10px 16px', width: 40 }}>
                        <input type="checkbox"
                          checked={filteredRecipients.length > 0 && filteredRecipients.every((_, i) => selectedLeads[i])}
                          onChange={e => {
                            const all = {};
                            filteredRecipients.forEach((_, i) => { all[i] = e.target.checked; });
                            setSelectedLeads(all);
                          }}
                          style={{ accentColor: '#8E9B8B' }} />
                      </th>
                      {['Company', 'Contact', 'Email', 'Status', 'Delivered', 'Opened', 'Clicked', 'Bounced'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#717182', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecipients.length === 0 ? (
                      <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#717182', fontSize: 13 }}>No recipients in this category</td></tr>
                    ) : filteredRecipients.map((r, i) => (
                      <tr key={r.id} style={{ borderTop: '1px solid rgba(62,66,61,0.06)', background: selectedLeads[i] ? '#F0F7F0' : i % 2 === 0 ? '#fff' : '#FAFAF9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <input type="checkbox" checked={!!selectedLeads[i]}
                            onChange={e => setSelectedLeads(prev => ({ ...prev, [i]: e.target.checked }))}
                            style={{ accentColor: '#8E9B8B' }} />
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#3E423D', fontWeight: 500 }}>{r.crm_companies?.company_name || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#5A6059' }}>{r.crm_people ? `${r.crm_people.first_name} ${r.crm_people.last_name}` : '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#717182' }}>{r.email}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: r.status === 'clicked' ? '#D4EDDA' : r.status === 'opened' ? '#E8F5E9' : r.status === 'bounced' ? '#F8D7DA' : r.status === 'unsubscribed' ? '#FFE5D0' : '#F5F3EF',
                            color: r.status === 'clicked' ? '#155724' : r.status === 'opened' ? '#2E7D32' : r.status === 'bounced' ? '#721C24' : r.status === 'unsubscribed' ? '#856404' : '#717182',
                            borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
                          }}>{r.status}</span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: ['delivered','opened','clicked'].includes(r.status) ? '#2E7D32' : '#AAAABC' }}>
                          {['delivered','opened','clicked'].includes(r.status) ? '✓' : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: r.opened_at ? '#2E7D32' : '#AAAABC' }}>
                          {r.opened_at ? new Date(r.opened_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: r.clicked_at ? '#E65100' : '#AAAABC' }}>
                          {r.clicked_at ? new Date(r.clicked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: r.status === 'bounced' ? '#D4183D' : '#AAAABC' }}>
                          {r.status === 'bounced' ? '✗' : '—'}
                        </td>
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
      <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
        <Sidebar />
        <div style={{ marginLeft: 240, flex: 1, padding: 40 }}>
          <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: '#8E9B8B', fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}>← Back to Campaigns</button>
          <h1 style={{ color: '#3E423D', fontSize: 28, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 32px' }}>New Campaign</h1>

          {/* Step Indicator */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 40 }}>
            {['Content', 'Recipients', 'Review & Send'].map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: step === i + 1 ? '#8E9B8B' : step > i + 1 ? '#3E423D' : '#D5CEC0',
                    color: step >= i + 1 ? '#fff' : '#717182', fontSize: 12, fontWeight: 600, flexShrink: 0
                  }}>{step > i + 1 ? '✓' : i + 1}</div>
                  <span style={{ fontSize: 13, color: step === i + 1 ? '#3E423D' : '#717182', fontWeight: step === i + 1 ? 600 : 400 }}>{s}</span>
                </div>
                {i < 2 && <div style={{ flex: 1, height: 1, background: step > i + 1 ? '#8E9B8B' : '#D5CEC0', margin: '0 12px' }} />}
              </div>
            ))}
          </div>

          {/* Step 1 — Content */}
          {step === 1 && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 32, border: '1px solid rgba(62,66,61,0.1)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Campaign Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="e.g. Spring Outreach 2025" />
                </div>
                <div>
                  <label style={labelStyle}>From Email</label>
                  <select value={form.from_email} onChange={e => setForm({ ...form, from_email: e.target.value })} style={inputStyle}>
                    {FROM_EMAILS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>From Name</label>
                  <input value={form.from_name} onChange={e => setForm({ ...form, from_name: e.target.value })} style={inputStyle} placeholder="e.g. Dan from Planfor" />
                </div>
                <div>
                  <label style={labelStyle}>Load from Template</label>
                  <select value={form.template_id || ''} onChange={e => loadTemplate(e.target.value)} style={inputStyle}>
                    <option value="">— Select a template —</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Subject Line *</label>
                <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} style={inputStyle} placeholder="e.g. Quick Q re: {{company_name}}" />
              </div>
              <div>
                <label style={labelStyle}>Email Body *</label>
                <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: '#8E9B8B', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>✨ Visual Editor</span>
                    </div>
                    <TiptapEditor content={form.body_html} onChange={html => setForm(prev => ({ ...prev, body_html: html }))} placeholder="Write your campaign email..." minHeight={350} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: '#717182', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>HTML Code</span>
                    </div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                      <HtmlEditor
  value={prettifyHTML(form.body_html)}
  onChange={val => setForm({ ...form, body_html: val })}
  minHeight="100%"
/>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12, padding: '12px 16px', background: '#F5F3EF', borderRadius: 8, border: '1px solid rgba(62,66,61,0.08)' }}>
                  <span style={{ fontSize: 11, color: '#717182', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', marginRight: 4 }}>Merge Tags:</span>
                  {[
                    { tag: '{{first_name}}', label: 'First Name' }, { tag: '{{last_name}}', label: 'Last Name' },
                    { tag: '{{company_name}}', label: 'Company' }, { tag: '{{sender_name}}', label: 'Sender' },
                    { tag: '{{sender_email}}', label: 'Sender Email' }, { tag: '{{city}}', label: 'City' }, { tag: '{{stage}}', label: 'Stage' },
                  ].map(({ tag, label }) => (
                    <button key={tag}
                      onClick={() => setForm(prev => {
                        const current = prev.body_html || '';
                        const updated = current.replace(/<\/p>\s*$/, tag + '</p>') !== current
                          ? current.replace(/<\/p>\s*$/, tag + '</p>') : current + tag;
                        return { ...prev, body_html: updated };
                      })}
                      style={{ background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#5A6059', fontFamily: "'Inter', sans-serif", transition: 'all 0.1s' }}
                      onMouseOver={e => { e.currentTarget.style.background = '#8E9B8B'; e.currentTarget.style.color = '#fff'; }}
                      onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#5A6059'; }}>
                      {label} <span style={{ fontFamily: 'monospace', fontSize: 10, opacity: 0.7, marginLeft: 2 }}>{tag}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                <button onClick={saveDraft} style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.15)', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>💾 Save Draft</button>
                <button onClick={() => { setStep(2); fetchRecipients(); }} disabled={!form.name || !form.subject || !form.body_html}
                  style={{ background: form.name && form.subject && form.body_html ? '#8E9B8B' : '#D5CEC0', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, cursor: form.name && form.subject && form.body_html ? 'pointer' : 'not-allowed' }}>
                  Next: Recipients →
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Recipients */}
          {step === 2 && (
            <div>
              <div style={{ background: '#fff', borderRadius: 12, padding: 32, border: '1px solid rgba(62,66,61,0.1)', marginBottom: 16 }}>
                <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: '0 0 20px' }}>Filter Recipients</h3>
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Source</label>
                    <select value={filters.source} onChange={e => setFilters({ ...filters, source: e.target.value })} style={inputStyle}>
                      <option value="all">All (Contacts + Clients)</option>
                      <option value="contacts">Contacts Only</option>
                      <option value="clients">Clients Only</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Stage</label>
                    <select value={filters.stage} onChange={e => setFilters({ ...filters, stage: e.target.value })} style={inputStyle}>
                      <option value="">All Stages</option>
                      {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Origin</label>
                    <select value={filters.origin} onChange={e => setFilters({ ...filters, origin: e.target.value })} style={inputStyle}>
                      <option value="">All Origins</option>
                      {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>City</label>
                    <input value={filters.city} onChange={e => setFilters({ ...filters, city: e.target.value })} style={inputStyle} placeholder="e.g. Austin" />
                  </div>
                  <div>
                    <button onClick={fetchRecipients} style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>🔍 Apply</button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ background: '#D4EDDA', borderRadius: 8, padding: '8px 16px' }}>
                    <span style={{ color: '#155724', fontSize: 13, fontWeight: 600 }}>✅ {loadingRecipients ? '...' : Object.values(selectedRecipients).filter(Boolean).length} of {recipients.length} recipients selected</span>
                  </div>
                  {excludedCount > 0 && (
                    <div style={{ background: '#FFE5D0', borderRadius: 8, padding: '8px 16px' }}>
                      <span style={{ color: '#856404', fontSize: 13 }}>🚫 {excludedCount} excluded (unsubscribed)</span>
                    </div>
                  )}
                </div>

                {recipients.length > 0 && (
                  <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, background: '#F5F3EF' }}>
                        <tr>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#717182', fontWeight: 600, width: 40 }}>
                            <input type="checkbox" checked={Object.values(selectedRecipients).filter(Boolean).length === recipients.length}
                              onChange={e => { const all = {}; recipients.forEach((_, i) => { all[i] = e.target.checked; }); setSelectedRecipients(all); }}
                              style={{ accentColor: '#8E9B8B' }} />
                          </th>
                          {['Source', 'Company', 'Contact', 'Email', 'Stage'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#717182', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recipients.map((r, i) => (
                          <tr key={i} style={{ borderTop: '1px solid rgba(62,66,61,0.06)', background: selectedRecipients[i] ? '#fff' : '#FAFAF9', opacity: selectedRecipients[i] ? 1 : 0.5 }}>
                            <td style={{ padding: '8px 12px' }}>
                              <input type="checkbox" checked={!!selectedRecipients[i]} onChange={e => setSelectedRecipients(prev => ({ ...prev, [i]: e.target.checked }))} style={{ accentColor: '#8E9B8B' }} />
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{ background: r.source === 'Client' ? '#D4EDDA' : '#EBF4FF', color: r.source === 'Client' ? '#155724' : '#1a6fad', fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{r.source || 'Contact'}</span>
                            </td>
                            <td style={{ padding: '8px 12px', fontSize: 13, color: '#3E423D' }}>{r.company_name}</td>
                            <td style={{ padding: '8px 12px', fontSize: 13, color: '#5A6059' }}>{r.first_name} {r.last_name}</td>
                            <td style={{ padding: '8px 12px', fontSize: 13, color: '#717182' }}>{r.email}</td>
                            <td style={{ padding: '8px 12px', fontSize: 12, color: '#717182' }}>{r.stage}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => setStep(1)} style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.15)', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>← Back</button>
                <button onClick={() => setStep(3)} disabled={Object.values(selectedRecipients).filter(Boolean).length === 0}
                  style={{ background: Object.values(selectedRecipients).filter(Boolean).length > 0 ? '#8E9B8B' : '#D5CEC0', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, cursor: Object.values(selectedRecipients).filter(Boolean).length > 0 ? 'pointer' : 'not-allowed' }}>
                  Next: Review →
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Review & Send */}
          {step === 3 && (
            <div>
              <div style={{ background: '#fff', borderRadius: 12, padding: 32, border: '1px solid rgba(62,66,61,0.1)', marginBottom: 16 }}>
                <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: '0 0 20px' }}>Campaign Summary</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                  {[
                    { label: 'Campaign Name', value: form.name },
                    { label: 'From', value: `${form.from_name} <${form.from_email}>` },
                    { label: 'Subject', value: form.subject },
                    { label: 'Recipients', value: `${Object.values(selectedRecipients).filter(Boolean).length} contacts` },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: '#F5F3EF', borderRadius: 8, padding: 16 }}>
                      <p style={{ color: '#717182', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>{label}</p>
                      <p style={{ color: '#3E423D', fontSize: 14, fontWeight: 500, margin: 0 }}>{value}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p style={{ color: '#717182', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>Email Preview</p>
                  <div style={{ border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: 24, background: '#FAFAF9' }}>
                    <p style={{ color: '#717182', fontSize: 12, margin: '0 0 8px' }}>Subject: <strong style={{ color: '#3E423D' }}>{form.subject}</strong></p>
                    <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '12px 0' }} />
                    <div dangerouslySetInnerHTML={{ __html: form.body_html }} style={{ fontSize: 14 }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => setStep(2)} style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.15)', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>← Back</button>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={saveDraft} style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.15)', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>💾 Save Draft</button>
                  <button onClick={sendCampaign} disabled={sending}
                    style={{ background: sending ? '#A5B2A3' : '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 13, cursor: sending ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
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
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 240, flex: 1, padding: 40 }}>
        <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>Growth</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1 style={{ color: '#3E423D', fontSize: 30, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>Marketing</h1>
          {canSend && subView === 'campaigns' && (
            <button onClick={() => { setStep(1); setForm({ name: '', subject: '', body_html: '', from_name: 'Planfor', from_email: 'marketing@planfor.io', template_id: null }); setView('create'); }}
              style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>
              + New Campaign
            </button>
          )}
        </div>

        {/* Sub Navigation */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(62,66,61,0.1)', marginBottom: 24 }}>
          <button onClick={() => setSubView('campaigns')}
            style={{ background: 'none', border: 'none', borderBottom: subView === 'campaigns' ? '2px solid #8E9B8B' : '2px solid transparent', padding: '10px 20px', fontSize: 13, color: subView === 'campaigns' ? '#1a1d1a' : '#717182', fontWeight: subView === 'campaigns' ? 600 : 400, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            Campaigns
            </button>
            <button onClick={() => { setSubView('unsubscribed'); fetchUnsubscribed(); }}
            style={{ background: 'none', border: 'none', borderBottom: subView === 'unsubscribed' ? '2px solid #8E9B8B' : '2px solid transparent', padding: '10px 20px', fontSize: 13, color: subView === 'unsubscribed' ? '#1a1d1a' : '#717182', fontWeight: subView === 'unsubscribed' ? 600 : 400, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            Unsubscribed {unsubscribed.length > 0 && <span style={{ background: '#D4183D', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, marginLeft: 4 }}>{unsubscribed.length}</span>}
          </button>
          <button onClick={() => { setSubView('waitlist'); fetchWaitlist(); }}
            style={{ background: 'none', border: 'none', borderBottom: subView === 'waitlist' ? '2px solid #8E9B8B' : '2px solid transparent', padding: '10px 20px', fontSize: 13, color: subView === 'waitlist' ? '#1a1d1a' : '#717182', fontWeight: subView === 'waitlist' ? 600 : 400, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            Waitlist Couples
          </button>
        </div>

        {/* Campaigns View */}
        {subView === 'campaigns' && (<>
          {/* Global Stats */}
          {globalStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 32 }}>
              {[
                { label: 'Total Campaigns', value: globalStats.total_campaigns, icon: '📣' },
                { label: 'Total Sent', value: globalStats.total_sent, icon: '📤' },
                { label: 'Avg Open Rate', value: `${globalStats.avg_open_rate}%`, icon: '👁' },
                { label: 'Avg CTR', value: `${globalStats.avg_ctr}%`, icon: '🖱' },
                { label: 'Unsubscribed', value: globalStats.total_unsubscribed, icon: '🚫' },
              ].map(({ label, value, icon }) => (
                <div key={label} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid rgba(62,66,61,0.1)', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
                  <p style={{ color: '#3E423D', fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>{value}</p>
                  <p style={{ color: '#717182', fontSize: 11, margin: 0, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Campaign List */}
          {loading ? (
            <p style={{ color: '#717182' }}>Loading...</p>
          ) : campaigns.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 12, padding: 60, textAlign: 'center', border: '1px solid rgba(62,66,61,0.1)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📣</div>
              <p style={{ color: '#3E423D', fontSize: 16, fontWeight: 500, margin: '0 0 8px' }}>No campaigns yet</p>
              <p style={{ color: '#717182', fontSize: 13, margin: '0 0 24px' }}>Create your first email campaign to get started</p>
              {canSend && <button onClick={() => setView('create')} style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>+ New Campaign</button>}
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F5F3EF' }}>
                    {['Campaign', 'Status', 'Recipients', 'Open Rate', 'CTR', 'Sent', ''].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: '#717182', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c, i) => (
                    <tr key={c.id} style={{ borderTop: '1px solid rgba(62,66,61,0.06)', background: i % 2 === 0 ? '#fff' : '#FAFAF9', cursor: 'pointer' }}
                      onClick={() => openCampaign(c)}>
                      <td style={{ padding: '14px 16px' }}>
                        <p style={{ color: '#3E423D', fontSize: 14, fontWeight: 500, margin: '0 0 2px' }}>{c.name}</p>
                        <p style={{ color: '#717182', fontSize: 12, margin: 0 }}>By {c.crm_users?.name}</p>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: STATUS_COLORS[c.status]?.bg, color: STATUS_COLORS[c.status]?.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>{c.status}</span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: '#5A6059' }}>{c.stats?.sent || 0}</td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: c.stats?.open_rate >= 30 ? '#8E9B8B' : '#3E423D', fontWeight: c.stats?.open_rate >= 30 ? 600 : 400 }}>
                        {c.status === 'sent' ? `${c.stats?.open_rate || 0}%` : '—'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: c.stats?.ctr >= 2 ? '#8E9B8B' : '#3E423D', fontWeight: c.stats?.ctr >= 2 ? 600 : 400 }}>
                        {c.status === 'sent' ? `${c.stats?.ctr || 0}%` : '—'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 12, color: '#717182' }}>{c.sent_at ? new Date(c.sent_at).toLocaleDateString() : '—'}</td>
                      <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
                        {c.status === 'draft' && canSend && (
                          <button onClick={() => deleteCampaign(c.id)} style={{ background: '#fdf0f0', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#D4183D' }}>Delete</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>)}

{/* Waitlist View */}
{subView === 'waitlist' && (
          <div>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Total Subscribers', value: waitlist.length, icon: '💌' },
                { label: 'Consented', value: waitlist.filter(w => w.marketing_consent).length, icon: '✅' },
                { label: 'This Week', value: waitlist.filter(w => new Date(w.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length, icon: '📅' },
                { label: 'Today', value: waitlist.filter(w => new Date(w.created_at).toDateString() === new Date().toDateString()).length, icon: '🌱' },
              ].map(({ label, value, icon }) => (
                <div key={label} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid rgba(62,66,61,0.1)', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
                  <p style={{ color: '#3E423D', fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>{value}</p>
                  <p style={{ color: '#717182', fontSize: 11, margin: 0, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Table */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.08)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(62,66,61,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h3 style={{ color: '#1a1d1a', fontSize: 15, fontWeight: 600, margin: 0 }}>
                  Waitlist Couples ({waitlist.length})
                </h3>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    value={waitlistSearch}
                    onChange={e => setWaitlistSearch(e.target.value)}
                    placeholder="Search name or email..."
                    style={{ background: '#F5F3EF', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '7px 12px', fontSize: 12, outline: 'none', fontFamily: 'Inter, sans-serif', width: 200 }}
                  />
                  <button onClick={exportWaitlistCSV}
                    style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                    ⬇ Export CSV
                  </button>
                </div>
              </div>

              {loadingWaitlist ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#717182' }}>Loading...</div>
              ) : waitlist.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: '#717182' }}>
                  <p style={{ fontSize: 32, marginBottom: 12 }}>💌</p>
                  <p style={{ fontSize: 14 }}>No subscribers yet. Share your waitlist link to get started.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F9F9F7' }}>
                      {['First Name', 'Last Name', 'Email', 'Consent', 'Joined', 'IP Address', 'Actions'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#717182', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: '1px solid rgba(62,66,61,0.08)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {waitlist
                        .filter(w => !waitlistSearch || w.email.toLowerCase().includes(waitlistSearch.toLowerCase()) || (w.name || '').toLowerCase().includes(waitlistSearch.toLowerCase()))
                        .map((w, i) => (
                        <tr key={w.id} style={{ borderBottom: '1px solid rgba(62,66,61,0.05)', background: i % 2 === 0 ? '#fff' : '#FAFAF9' }}>
                          <td style={{ padding: '12px 16px', fontSize: 13, color: '#3E423D' }}>{w.first_name || <span style={{ color: '#AAAABC' }}>—</span>}</td>
                          <td style={{ padding: '12px 16px', fontSize: 13, color: '#3E423D' }}>{w.last_name || <span style={{ color: '#AAAABC' }}>—</span>}</td>
                          <td style={{ padding: '12px 16px', fontSize: 13, color: '#3E423D' }}>{w.email}</td>
                          <td style={{ padding: '12px 16px', fontSize: 12 }}>
                            <span style={{ background: w.marketing_consent ? '#E8F5E9' : '#FFEBEE', color: w.marketing_consent ? '#2E7D32' : '#D4183D', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                              {w.marketing_consent ? '✓ Consented' : '✗ No consent'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: '#717182' }}>
                            {new Date(w.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 11, color: '#AAAABC', fontFamily: 'monospace' }}>
                            {w.ip_address || '—'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <button onClick={() => deleteWaitlistEntry(w.id)}
                              style={{ background: '#fdf0f0', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#D4183D' }}>
                              Delete
                            </button>
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
        {/* Unsubscribed View */}
        {subView === 'unsubscribed' && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(62,66,61,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h3 style={{ color: '#1a1d1a', fontSize: 15, fontWeight: 600, margin: 0 }}>Unsubscribed Contacts ({unsubscribed.length})</h3>
                <button onClick={exportUnsubscribedCSV}
                  style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                  ⬇ Export CSV
                </button>
              </div>
              {Object.values(selectedUnsubs).some(Boolean) && (
                <button onClick={resubscribeBulk}
                  style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  Resubscribe {Object.values(selectedUnsubs).filter(Boolean).length} Selected
                </button>
              )}
            </div>
            {loadingUnsubs ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#717182' }}>Loading...</div>
            ) : unsubscribed.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center' }}>
                <p style={{ color: '#8E9B8B', fontSize: 14, fontWeight: 500, margin: '0 0 4px' }}>No unsubscribed contacts</p>
                <p style={{ color: '#717182', fontSize: 12, margin: 0 }}>Everyone is receiving marketing emails</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F5F3EF' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', width: 40 }}>
                      <input type="checkbox"
                        checked={Object.values(selectedUnsubs).filter(Boolean).length === unsubscribed.length && unsubscribed.length > 0}
                        onChange={e => { const all = {}; unsubscribed.forEach(p => { all[p.id] = e.target.checked; }); setSelectedUnsubs(all); }}
                        style={{ accentColor: '#8E9B8B' }} />
                    </th>
                    {['Name', 'Email', 'Company', 'Status', 'Unsubscribed', 'IP Address', 'User Agent', ''].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#717182', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {unsubscribed.map((p, i) => (
                    <tr key={p.id} style={{ borderTop: '1px solid rgba(62,66,61,0.06)', background: i % 2 === 0 ? '#fff' : '#FAFAF9' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <input type="checkbox" checked={!!selectedUnsubs[p.id]} onChange={e => setSelectedUnsubs(prev => ({ ...prev, [p.id]: e.target.checked }))} style={{ accentColor: '#8E9B8B' }} />
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#1a1d1a', fontWeight: 500 }}>{p.first_name} {p.last_name}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#717182' }}>{p.email}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#3E423D', cursor: 'pointer' }}
                        onClick={() => p.crm_companies?.id && window.open(`/contacts/${p.crm_companies.id}`, '_blank')}>
                        {p.crm_companies?.company_name || '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: p.crm_companies?.stage === 'Converted' ? '#E3F2FD' : '#F5F3EF', color: p.crm_companies?.stage === 'Converted' ? '#1a6fad' : '#717182', fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
                          {p.crm_companies?.stage === 'Converted' ? 'Client' : 'Contact'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#717182' }}>
                        {p.marketing_unsubscribed_at ? new Date(p.marketing_unsubscribed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 11, color: '#AAAABC', fontFamily: 'monospace' }}>
                        {p.unsubscribe_ip || '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 11, color: '#AAAABC', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.unsubscribe_user_agent || '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button onClick={async () => {
                          try {
                            await axios.post(`${API}/marketing/resubscribe/${p.id}`, {}, { headers: getHeaders() });
                            fetchUnsubscribed();
                          } catch (err) { console.error(err); }
                        }} style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
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