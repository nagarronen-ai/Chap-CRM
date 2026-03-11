import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useRole } from '../hooks/useRole';

const API = 'http://localhost:5000/api';

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

export default function Marketing() {
  const { role, can } = useRole();
  const canSend = can('marketing:send');

  const [view, setView] = useState('list'); // list | create | detail
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
  const [filters, setFilters] = useState({ stage: '', origin: '', city: '', category: '' });
  const [recipients, setRecipients] = useState([]);
  const [excludedCount, setExcludedCount] = useState(0);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [templates, setTemplates] = useState([]);

  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

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

  const fetchRecipients = async () => {
    setLoadingRecipients(true);
    try {
      const params = {};
      if (filters.stage) params.stage = filters.stage;
      if (filters.origin) params.origin = filters.origin;
      if (filters.city) params.city = filters.city;
      if (filters.category) params.category = filters.category;
      const res = await axios.get(`${API}/marketing/recipients`, { headers: getHeaders(), params });
      setRecipients(res.data.recipients);

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
    if (!window.confirm(`Send to ${recipients.length} recipients?`)) return;
    setSending(true);
    try {
      // First save as draft
      const draftRes = await axios.post(`${API}/marketing/campaigns`, form, { headers: getHeaders() });
      const campaignId = draftRes.data.id;
      // Then send
      await axios.post(`${API}/marketing/campaigns/${campaignId}/send`, { recipients }, { headers: getHeaders() });
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

          {/* Recipients Table */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(62,66,61,0.08)' }}>
              <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: 0 }}>Recipients ({selectedCampaign.recipients?.length || 0})</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F5F3EF' }}>
                  {['Company', 'Contact', 'Email', 'Status', 'Opened', 'Clicked'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#717182', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedCampaign.recipients?.map((r, i) => (
                  <tr key={r.id} style={{ borderTop: '1px solid rgba(62,66,61,0.06)', background: i % 2 === 0 ? '#fff' : '#FAFAF9' }}>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#3E423D', fontWeight: 500 }}>{r.crm_companies?.company_name}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#5A6059' }}>{r.crm_people ? `${r.crm_people.first_name} ${r.crm_people.last_name}` : '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#717182' }}>{r.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        background: r.status === 'opened' || r.status === 'clicked' ? '#D4EDDA' : r.status === 'bounced' ? '#F8D7DA' : r.status === 'unsubscribed' ? '#FFE5D0' : '#F5F3EF',
                        color: r.status === 'opened' || r.status === 'clicked' ? '#155724' : r.status === 'bounced' ? '#721C24' : r.status === 'unsubscribed' ? '#856404' : '#717182',
                        borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize'
                      }}>{r.status}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#717182' }}>{r.opened_at ? new Date(r.opened_at).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#717182' }}>{r.clicked_at ? new Date(r.clicked_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ─── CAMPAIGN CREATOR ───────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
        <Sidebar />
        <div style={{ marginLeft: 240, flex: 1, padding: 40, maxWidth: 900 }}>
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
                <textarea value={form.body_html} onChange={e => setForm({ ...form, body_html: e.target.value })} rows={12}
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                  placeholder="Write your email HTML here or load from a template above..." />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                <button onClick={saveDraft} style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.15)', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>
                  💾 Save Draft
                </button>
                <button onClick={() => { setStep(2); fetchRecipients(); }}
                  disabled={!form.name || !form.subject || !form.body_html}
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
                  <div>
                    <label style={labelStyle}>Stage</label>
                    <select value={filters.stage} onChange={e => setFilters({ ...filters, stage: e.target.value })} style={inputStyle}>
                      <option value="">All Stages</option>
                      {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Origin</label>
                    <select value={filters.origin} onChange={e => setFilters({ ...filters, origin: e.target.value })} style={inputStyle}>
                      <option value="">All Origins</option>
                      {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>City</label>
                    <input value={filters.city} onChange={e => setFilters({ ...filters, city: e.target.value })} style={inputStyle} placeholder="e.g. Austin" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button onClick={fetchRecipients} style={{ width: '100%', background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer' }}>
                      🔍 Apply Filters
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ background: '#D4EDDA', borderRadius: 8, padding: '8px 16px' }}>
                    <span style={{ color: '#155724', fontSize: 13, fontWeight: 600 }}>✅ {loadingRecipients ? '...' : recipients.length} recipients selected</span>
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
                          {['Company', 'Contact', 'Email', 'Stage'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#717182', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recipients.map((r, i) => (
                          <tr key={i} style={{ borderTop: '1px solid rgba(62,66,61,0.06)' }}>
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
                <button onClick={() => setStep(3)} disabled={recipients.length === 0}
                  style={{ background: recipients.length > 0 ? '#8E9B8B' : '#D5CEC0', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, cursor: recipients.length > 0 ? 'pointer' : 'not-allowed' }}>
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
                    { label: 'Recipients', value: `${recipients.length} contacts` },
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
                  <button onClick={saveDraft} style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.15)', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>
                    💾 Save Draft
                  </button>
                  <button onClick={sendCampaign} disabled={sending}
                    style={{ background: sending ? '#A5B2A3' : '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 13, cursor: sending ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                    {sending ? '⏳ Sending...' : `🚀 Send to ${recipients.length} Recipients`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── CAMPAIGN LIST VIEW ─────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 240, flex: 1, padding: 40 }}>
        <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>Growth</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <h1 style={{ color: '#3E423D', fontSize: 30, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>Marketing</h1>
          {canSend && (
            <button onClick={() => { setStep(1); setForm({ name: '', subject: '', body_html: '', from_name: 'Planfor', from_email: 'marketing@planfor.io', template_id: null }); setView('create'); }}
              style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>
              + New Campaign
            </button>
          )}
        </div>

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
                      <span style={{ background: STATUS_COLORS[c.status]?.bg, color: STATUS_COLORS[c.status]?.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#5A6059' }}>{c.stats?.sent || 0}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: c.stats?.open_rate >= 30 ? '#8E9B8B' : '#3E423D', fontWeight: c.stats?.open_rate >= 30 ? 600 : 400 }}>
                      {c.status === 'sent' ? `${c.stats?.open_rate || 0}%` : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: c.stats?.ctr >= 2 ? '#8E9B8B' : '#3E423D', fontWeight: c.stats?.ctr >= 2 ? 600 : 400 }}>
                      {c.status === 'sent' ? `${c.stats?.ctr || 0}%` : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#717182' }}>
                      {c.sent_at ? new Date(c.sent_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
                      {c.status === 'draft' && canSend && (
                        <button onClick={() => deleteCampaign(c.id)}
                          style={{ background: '#fdf0f0', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#D4183D' }}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}