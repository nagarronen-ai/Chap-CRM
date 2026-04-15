import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useRole } from '../hooks/useRole';
import { useApp } from '../context/AppContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const STAGES = ['New', 'Contacted', 'No Reply', 'Follow-up', 'Meeting Scheduled', 'Proposal Offered', 'Agreement Sent', 'Closed Won', 'Closed Lost', 'Not Interested'];
const STAGE_COLORS = {
  'New': '#94B0BC', 'Contacted': '#8E9B8B', 'No Reply': '#717182',
  'Follow-up': '#D4A574', 'Meeting Scheduled': '#B4A5D6',
  'Proposal Offered': '#8E9B8B', 'Agreement Sent': '#94B0BC',
  'Closed Won': '#4CAF50', 'Closed Lost': '#D4183D', 'Not Interested': '#CBCED4',
  'Converted': '#1a6fad',
};

export default function Dashboard() {
  const [companies, setCompanies] = useState([]);
  const [clients, setClients] = useState([]);
  const [activity, setActivity] = useState([]);
  const [emailStats, setEmailStats] = useState({ total: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 });
  const [marketingStats, setMarketingStats] = useState(null);
  const [financeStats, setFinanceStats] = useState(null);
  const [teamUsers, setTeamUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activityPage, setActivityPage] = useState(0);
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [needsCompletion, setNeedsCompletion] = useState([]);
  const [completingMeeting, setCompletingMeeting] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [waitlistStats, setWaitlistStats] = useState(null);
  const [waitlistGrowth, setWaitlistGrowth] = useState([]);
  const [thoughtsCount, setThoughtsCount] = useState(0);
  const [campaignStats, setCampaignStats] = useState([]);
  const [savingCompletion, setSavingCompletion] = useState(false);
  const [teamInsight, setTeamInsight] = useState(null);
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const [recurringData, setRecurringData] = useState(null);
  const [markPaidModal, setMarkPaidModal] = useState(null);
  const [markPaidParsing, setMarkPaidParsing] = useState(false);
  const [markPaidSaving, setMarkPaidSaving] = useState(false);
  const [markPaidForm, setMarkPaidForm] = useState({ amount: '', receipt_url: '' });
  const navigate = useNavigate();
  const { role } = useRole();
  const { palette: p } = useApp();
  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [companiesRes, activityRes] = await Promise.all([
        axios.get(`${API}/contacts/companies`, { headers: getHeaders() }),
        axios.get(`${API}/contacts/activity/recent`, { headers: getHeaders() }),
      ]);
      setCompanies(companiesRes.data);
      setActivity(activityRes.data);
    } catch (err) { console.error(err); }
    try { const res = await axios.get(`${API}/clients`, { headers: getHeaders() }); setClients(res.data); } catch (err) {}
    try { const res = await axios.get(`${API}/insights/latest`, { headers: getHeaders() }); setTeamInsight(res.data); } catch (err) {}
    try { const res = await axios.get(`${API}/finance/expenses/recurring`, { headers: getHeaders() }); setRecurringData(res.data); } catch (err) {}
    try {
      const res = await axios.get(`${API}/emails/sent`, { headers: getHeaders() });
      const emails = res.data.filter(e => e.status === 'sent');
      setEmailStats({
        total: emails.length,
        delivered: emails.filter(e => ['delivered', 'opened', 'clicked'].includes(e.email_status)).length,
        opened: emails.filter(e => ['opened', 'clicked'].includes(e.email_status)).length,
        clicked: emails.filter(e => e.email_status === 'clicked').length,
        bounced: emails.filter(e => e.email_status === 'bounced').length,
      });
    } catch (err) {}
    try { const res = await axios.get(`${API}/marketing/stats`, { headers: getHeaders() }); setMarketingStats(res.data); } catch (err) {}
    try { const res = await axios.get(`${API}/finance/expenses/summary`, { headers: getHeaders() }); setFinanceStats(res.data); } catch (err) {}
    try { const res = await axios.get(`${API}/users`, { headers: getHeaders() }); setTeamUsers(res.data); } catch (err) {}
    try { const res = await axios.get(`${API}/calendar/upcoming`, { headers: getHeaders() }); setUpcomingMeetings(res.data); } catch (err) {}
    try {
      const res = await axios.get(`${API}/marketing/waitlist`, { headers: getHeaders() });
      const waitlist = res.data;
      setWaitlistStats({
        total: waitlist.length,
        consented: waitlist.filter(w => w.marketing_consent).length,
        thisWeek: waitlist.filter(w => new Date(w.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
        today: waitlist.filter(w => new Date(w.created_at).toDateString() === new Date().toDateString()).length,
      });
      const days = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        days.push({ label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), count: waitlist.filter(w => new Date(w.created_at).toDateString() === d.toDateString()).length });
      }
      setWaitlistGrowth(days);
    } catch (err) {}
    try {
      const res = await axios.get(`${API}/thoughts`, { headers: getHeaders() });
      setThoughtsCount(res.data.filter(t => new Date(t.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length);
    } catch (err) {}
    try { const res = await axios.get(`${API}/marketing/campaigns`, { headers: getHeaders() }); setCampaignStats(res.data.filter(c => c.status === 'sent').slice(0, 5)); } catch (err) {}
    try { const res = await axios.get(`${API}/calendar/needs-completion`, { headers: getHeaders() }); setNeedsCompletion(res.data); } catch (err) {}
    setLoading(false);
  };

  const completeMeeting = async (meetingId) => {
    setSavingCompletion(true);
    try {
      await axios.put(`${API}/calendar/meetings/${meetingId}`, { status: 'completed', notes: completionNotes }, { headers: getHeaders() });
      setNeedsCompletion(prev => prev.filter(m => m.id !== meetingId));
      setCompletingMeeting(null);
      setCompletionNotes('');
      fetchData();
    } catch (err) { console.error(err); }
    setSavingCompletion(false);
  };

  const markNoShow = async (meetingId) => {
    try {
      await axios.put(`${API}/calendar/meetings/${meetingId}`, { status: 'cancelled', notes: 'No-show' }, { headers: getHeaders() });
      setNeedsCompletion(prev => prev.filter(m => m.id !== meetingId));
      fetchData();
    } catch (err) { console.error(err); }
  };

  const totalPeople = companies.reduce((acc, c) => acc + (c.crm_people?.length || 0), 0);
  const activeCompanies = companies.filter(c => !['Closed Won', 'Closed Lost', 'Not Interested', 'Converted'].includes(c.stage));
  const staleLeads = activeCompanies.filter(c => {
    const updated = new Date(c.updated_at || c.created_at);
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    return updated < weekAgo;
  }).sort((a, b) => new Date(a.updated_at || a.created_at) - new Date(b.updated_at || b.created_at));

  const byStage = STAGES.map(stage => ({ stage, count: companies.filter(c => c.stage === stage).length })).filter(s => s.count > 0);
  const maxStageCount = Math.max(...byStage.map(s => s.count), 1);

  const stageVelocity = STAGES.slice(0, 7).map(stage => {
    const sc = companies.filter(c => c.stage === stage);
    if (sc.length === 0) return { stage, count: 0, avgDays: 0 };
    const avgDays = Math.round(sc.reduce((acc, c) => acc + Math.floor((new Date() - new Date(c.updated_at || c.created_at)) / 86400000), 0) / sc.length);
    return { stage, count: sc.length, avgDays };
  }).filter(s => s.count > 0);

  const openRate = emailStats.total > 0 ? Math.round((emailStats.opened / emailStats.total) * 100) : 0;
  const clickRate = emailStats.total > 0 ? Math.round((emailStats.clicked / emailStats.total) * 100) : 0;
  const pagedActivity = activity.slice(activityPage * 5, (activityPage + 1) * 5);
  const totalPages = Math.ceil(activity.length / 5);

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const diff = Math.floor((new Date() - d) / 60000);
    if (diff < 1) return 'Now';
    if (diff < 60) return `${diff}m`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    if (diff < 10080) return `${Math.floor(diff / 1440)}d`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const teamStats = teamUsers.map(u => ({
    name: u.name, role: u.role,
    companies: companies.filter(c => c.assigned_to === u.id).length,
    clients: clients.filter(c => c.assigned_to === u.id).length,
  })).filter(t => t.companies > 0 || t.clients > 0);

  const stat = (label, value, sub) => (
    <div>
      <p style={{ color: p.text, fontSize: 22, fontWeight: 700, margin: '0 0 2px', fontFamily: "'Playfair Display', Georgia, serif" }}>{value}</p>
      <p style={{ color: p.textSecondary, fontSize: 11, margin: 0, letterSpacing: 0.5 }}>{label}</p>
      {sub && <p style={{ color: p.primary, fontSize: 11, margin: '2px 0 0', fontWeight: 500 }}>{sub}</p>}
    </div>
  );

  const card = { background: p.cardBg, borderRadius: 12, padding: 24, border: `1px solid ${p.cardBorder}` };

  if (loading) return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: p.background, minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: 40, color: p.textSecondary }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: p.background, minHeight: '100vh', transition: 'background 0.4s' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: '32px 40px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 2px' }}>Overview</p>
            <h1 style={{ color: p.text, fontSize: 28, fontWeight: 700, fontFamily: "'Playfair Display', Georgia, serif", margin: 0 }}>Dashboard</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/import')} style={{ background: p.cardBg, color: p.text, border: `1px solid ${p.cardBorder}`, borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}>Import CSV</button>
            <button onClick={() => navigate('/contacts')} style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}>+ Add Company</button>
          </div>
        </div>

        {/* Top KPIs */}
        <div style={{ ...card, marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 20, padding: '20px 28px' }}>
          {stat('Contacts', companies.length)}
          {stat('People', totalPeople)}
          {stat('Active Pipeline', activeCompanies.length)}
          {stat('Clients', clients.length, clients.filter(c => c.stage === 'Active').length > 0 ? `${clients.filter(c => c.stage === 'Active').length} active` : null)}
          {stat('Emails Sent', emailStats.total, openRate > 0 ? `${openRate}% open` : null)}
          {stat('Campaigns', marketingStats?.total_campaigns || 0, marketingStats?.avg_open_rate ? `${marketingStats.avg_open_rate}% avg open` : null)}
          {stat('Expenses', financeStats ? `$${(financeStats.totalThisMonth || 0).toLocaleString()}` : '$0', 'this month')}
        </div>

        {/* Main Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Pipeline */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: 0 }}>Pipeline</h3>
              <span style={{ color: p.textSecondary, fontSize: 11 }}>{activeCompanies.length} active</span>
            </div>
            {byStage.length === 0 ? (
              <p style={{ color: p.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>No data</p>
            ) : byStage.map(({ stage, count }) => (
              <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ color: p.text, fontSize: 12, width: 110, flexShrink: 0 }}>{stage}</span>
                <div style={{ flex: 1, background: p.inputBg, borderRadius: 4, height: 8, overflow: 'hidden' }}>
                  <div style={{ background: STAGE_COLORS[stage], height: '100%', borderRadius: 4, width: `${(count / maxStageCount) * 100}%` }} />
                </div>
                <span style={{ color: p.text, fontSize: 12, fontWeight: 600, width: 24, textAlign: 'right' }}>{count}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 12, borderTop: `1px solid ${p.cardBorder}` }}>
              {[
                { color: '#4CAF50', label: 'Won', count: companies.filter(c => c.stage === 'Closed Won').length },
                { color: '#D4183D', label: 'Lost', count: companies.filter(c => c.stage === 'Closed Lost').length },
                { color: '#1a6fad', label: 'Converted', count: companies.filter(c => c.stage === 'Converted').length },
              ].map(({ color, label, count }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: 12, color: p.text }}><strong>{count}</strong> {label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Clients + Email */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: 0 }}>Clients</h3>
                <button onClick={() => navigate('/clients')} style={{ background: 'none', border: 'none', color: p.primary, fontSize: 12, cursor: 'pointer', padding: 0 }}>View all →</button>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                {[
                  { label: 'Onboarding', count: clients.filter(c => c.stage === 'Onboarding').length, color: '#856404', bg: '#FFF3CD' },
                  { label: 'Active', count: clients.filter(c => c.stage === 'Active').length, color: '#155724', bg: '#D4EDDA' },
                  { label: 'Paused', count: clients.filter(c => c.stage === 'Paused').length, color: '#8B5E34', bg: '#FFE5D0' },
                  { label: 'Churned', count: clients.filter(c => c.stage === 'Churned').length, color: '#721C24', bg: '#F8D7DA' },
                ].map(({ label, count, color, bg }) => (
                  <div key={label} style={{ flex: 1, background: bg, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                    <p style={{ color, fontSize: 20, fontWeight: 700, margin: '0 0 2px' }}>{count}</p>
                    <p style={{ color, fontSize: 10, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.8 }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={card}>
              <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Email Performance</h3>
              <div style={{ display: 'flex', gap: 16 }}>
                {[
                  { label: 'Sent', value: emailStats.total },
                  { label: 'Open Rate', value: `${openRate}%`, good: openRate >= 30 },
                  { label: 'Click Rate', value: `${clickRate}%`, good: clickRate >= 3 },
                  { label: 'Bounced', value: emailStats.bounced, bad: emailStats.bounced > 0 },
                ].map(({ label, value, good, bad }) => (
                  <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                    <p style={{ color: bad ? '#D4183D' : good ? '#4CAF50' : p.text, fontSize: 18, fontWeight: 700, margin: '0 0 2px' }}>{value}</p>
                    <p style={{ color: p.textSecondary, fontSize: 10, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</p>
                  </div>
                ))}
              </div>
              {marketingStats && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${p.cardBorder}`, display: 'flex', gap: 16 }}>
                  {[
                    { label: 'Campaigns', value: marketingStats.total_campaigns },
                    { label: 'Avg Open', value: `${marketingStats.avg_open_rate || 0}%` },
                    { label: 'Avg CTR', value: `${marketingStats.avg_ctr || 0}%` },
                    { label: 'Unsubs', value: marketingStats.total_unsubscribed || 0 },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                      <p style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: '0 0 2px' }}>{value}</p>
                      <p style={{ color: p.textSecondary, fontSize: 10, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Needs Completion */}
        {needsCompletion.length > 0 && (
          <div style={{ ...card, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: 0 }}>Needs Completion</h3>
              <span style={{ background: '#FFF3CD', color: '#856404', fontSize: 11, fontWeight: 600, borderRadius: 10, padding: '2px 10px' }}>{needsCompletion.length}</span>
            </div>
            {needsCompletion.slice(0, 5).map(m => {
              const endDate = new Date(m.end_time);
              const daysAgo = Math.floor((Date.now() - endDate) / 86400000);
              const isExpanded = completingMeeting === m.id;
              return (
                <div key={m.id} style={{ borderBottom: `1px solid ${p.cardBorder}`, padding: '8px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                      onClick={() => m.company_id ? navigate(`/contacts/${m.company_id}`) : m.client_id ? navigate(`/clients/${m.client_id}`) : null}>
                      <p style={{ color: p.text, fontSize: 12, fontWeight: 500, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</p>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ color: p.textSecondary, fontSize: 10 }}>{m.crm_companies?.company_name || m.crm_clients?.business_name || 'General'}</span>
                        <span style={{ color: daysAgo > 3 ? '#D4183D' : '#D4A574', fontSize: 10, fontWeight: 600 }}>{daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => { setCompletingMeeting(isExpanded ? null : m.id); setCompletionNotes(''); }}
                        style={{ background: isExpanded ? p.text : p.primary, color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 10, cursor: 'pointer' }}>
                        {isExpanded ? '▲' : '✓ Complete'}
                      </button>
                      <button onClick={() => markNoShow(m.id)}
                        style={{ background: p.inputBg, color: '#D4183D', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 10, cursor: 'pointer' }}>✗</button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{ marginTop: 8, padding: 10, background: p.inputBg, borderRadius: 8 }}>
                      <textarea value={completionNotes} onChange={e => setCompletionNotes(e.target.value)}
                        placeholder="Meeting notes — what was discussed?"
                        rows={3} style={{ width: '100%', background: p.cardBg, border: `1px solid ${p.cardBorder}`, borderRadius: 6, padding: '8px 10px', fontSize: 12, resize: 'vertical', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', color: p.text }} />
                      <button onClick={() => completeMeeting(m.id)} disabled={savingCompletion}
                        style={{ marginTop: 6, background: savingCompletion ? p.textMuted : '#4CAF50', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 11, cursor: 'pointer', width: '100%' }}>
                        {savingCompletion ? '⏳ Saving...' : '✓ Mark Complete & Save Notes'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Analytics Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Waitlist Growth */}
          <div style={{ ...card, gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: 0 }}>Waitlist Growth</h3>
              <button onClick={() => navigate('/marketing')} style={{ background: 'none', border: 'none', color: p.primary, fontSize: 12, cursor: 'pointer', padding: 0 }}>View waitlist →</button>
            </div>
            {waitlistStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Total', value: waitlistStats.total },
                  { label: 'Consented', value: waitlistStats.consented },
                  { label: 'This Week', value: waitlistStats.thisWeek },
                  { label: 'Today', value: waitlistStats.today },
                ].map(({ label, value }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <p style={{ color: p.text, fontSize: 20, fontWeight: 700, margin: '0 0 2px' }}>{value}</p>
                    <p style={{ color: p.textSecondary, fontSize: 10, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</p>
                  </div>
                ))}
              </div>
            )}
            {waitlistGrowth.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 48 }}>
                {waitlistGrowth.map((d, i) => {
                  const max = Math.max(...waitlistGrowth.map(x => x.count), 1);
                  const height = Math.max((d.count / max) * 48, d.count > 0 ? 4 : 2);
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ width: '100%', height, background: d.count > 0 ? p.primary : p.inputBg, borderRadius: 2, transition: 'height 0.3s' }} title={`${d.label}: ${d.count}`} />
                    </div>
                  );
                })}
              </div>
            )}
            <p style={{ color: p.textMuted, fontSize: 10, margin: '6px 0 0', textAlign: 'center' }}>Last 14 days</p>
          </div>

          {/* Pipeline Velocity */}
          <div style={card}>
            <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: '0 0 16px' }}>Pipeline Velocity</h3>
            {stageVelocity.length === 0 ? (
              <p style={{ color: p.textMuted, fontSize: 12, textAlign: 'center', padding: 16 }}>No data yet</p>
            ) : stageVelocity.slice(0, 5).map(s => (
              <div key={s.stage} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${p.cardBorder}` }}>
                <div>
                  <p style={{ color: p.text, fontSize: 12, fontWeight: 500, margin: 0 }}>{s.stage}</p>
                  <p style={{ color: p.textSecondary, fontSize: 10, margin: 0 }}>{s.count} leads</p>
                </div>
                <span style={{ color: s.avgDays > 14 ? '#D4183D' : s.avgDays > 7 ? '#D4A574' : p.primary, fontSize: 12, fontWeight: 600 }}>
                  {s.avgDays}d avg
                </span>
              </div>
            ))}
          </div>

          {/* Thoughts + Campaigns */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ ...card, padding: 20, flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ color: p.text, fontSize: 13, fontWeight: 600, margin: 0 }}>My Thoughts</h3>
                <button onClick={() => navigate('/thoughts')} style={{ background: 'none', border: 'none', color: p.primary, fontSize: 11, cursor: 'pointer', padding: 0 }}>Open →</button>
              </div>
              <p style={{ color: p.text, fontSize: 28, fontWeight: 700, margin: '0 0 2px', fontFamily: "'Playfair Display', Georgia, serif" }}>{thoughtsCount}</p>
              <p style={{ color: p.textSecondary, fontSize: 11, margin: 0 }}>thoughts this week</p>
            </div>
            <div style={{ ...card, padding: 20, flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ color: p.text, fontSize: 13, fontWeight: 600, margin: 0 }}>Campaigns</h3>
                <button onClick={() => navigate('/marketing')} style={{ background: 'none', border: 'none', color: p.primary, fontSize: 11, cursor: 'pointer', padding: 0 }}>View →</button>
              </div>
              <p style={{ color: p.text, fontSize: 28, fontWeight: 700, margin: '0 0 2px', fontFamily: "'Playfair Display', Georgia, serif" }}>
                {marketingStats?.avg_open_rate || 0}%
              </p>
              <p style={{ color: p.textSecondary, fontSize: 11, margin: 0 }}>avg open rate · {marketingStats?.total_campaigns || 0} sent</p>
            </div>
          </div>
        </div>

        {/* Recurring Payments */}
        {recurringData?.upcoming?.filter(e => e.due_soon).length > 0 && (
          <div style={{ ...card, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>🔄</span>
                <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: 0 }}>Upcoming Recurring Payments</h3>
                <span style={{ background: '#FFF3CD', color: '#856404', fontSize: 11, fontWeight: 600, borderRadius: 10, padding: '2px 8px' }}>
                  {recurringData.upcoming.filter(e => e.due_soon).length} due this week
                </span>
              </div>
              <button onClick={() => navigate('/finance?filter=recurring')} style={{ background: 'none', border: 'none', color: p.primary, fontSize: 12, cursor: 'pointer', padding: 0 }}>View all →</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recurringData.upcoming.filter(e => e.due_soon).map(exp => (
                <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: p.inputBg, borderRadius: 8 }}>
                  <div>
                    <p style={{ color: p.text, fontSize: 13, fontWeight: 500, margin: 0 }}>{exp.title}</p>
                    <p style={{ color: p.textSecondary, fontSize: 11, margin: '2px 0 0' }}>{exp.vendor} · {exp.recurring_interval}</p>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <p style={{ color: p.text, fontSize: 14, fontWeight: 700, margin: 0 }}>${parseFloat(exp.amount).toFixed(2)}</p>
                    <p style={{ color: exp.days_until <= 2 ? '#D4183D' : '#D4A574', fontSize: 11, fontWeight: 600, margin: 0 }}>
                      {exp.days_until === 0 ? 'Due today' : exp.days_until === 1 ? 'Due tomorrow' : `Due in ${exp.days_until}d`}
                    </p>
                    <button onClick={() => { setMarkPaidModal(exp); setMarkPaidForm({ amount: exp.amount, receipt_url: '' }); }}
                      style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>
                      ✓ Mark Paid
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mark Paid Modal */}
        {markPaidModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: p.cardBg, borderRadius: 16, padding: 32, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: `1px solid ${p.cardBorder}` }}>
              <h2 style={{ color: p.text, fontSize: 18, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 6px' }}>Mark as Paid</h2>
              <p style={{ color: p.textSecondary, fontSize: 13, margin: '0 0 20px' }}>{markPaidModal.title} · {markPaidModal.vendor}</p>
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4 }}>Amount Paid ($)</label>
                <input type="number" step="0.01" value={markPaidForm.amount}
                  onChange={e => setMarkPaidForm(prev => ({ ...prev, amount: e.target.value }))}
                  style={{ width: '100%', background: p.inputBg, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif', color: p.text }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4 }}>Upload Invoice (optional)</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: p.inputBg, border: `1px dashed ${p.inputBorder}`, borderRadius: 8, padding: '12px 16px', cursor: markPaidParsing ? 'not-allowed' : 'pointer' }}>
                  <span style={{ fontSize: 20 }}>📄</span>
                  <div style={{ flex: 1 }}>
                    {markPaidParsing ? <p style={{ color: p.textSecondary, fontSize: 13, margin: 0 }}>⏳ Parsing invoice with AI...</p>
                      : markPaidForm.receipt_url ? <p style={{ color: p.primary, fontSize: 13, margin: 0, fontWeight: 600 }}>✅ Invoice uploaded & parsed</p>
                      : <p style={{ color: p.textSecondary, fontSize: 13, margin: 0 }}>Click to upload PDF or image</p>}
                  </div>
                  <input type="file" accept=".pdf,image/*" style={{ display: 'none' }} disabled={markPaidParsing}
                    onChange={async (e) => {
                      const file = e.target.files[0]; if (!file) return;
                      setMarkPaidParsing(true);
                      try {
                        const parseForm = new FormData(); parseForm.append('invoice', file);
                        const parseRes = await axios.post(`${API}/finance/invoices/parse`, parseForm, { headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' } });
                        const receiptForm = new FormData(); receiptForm.append('file', file);
                        let receiptUrl = '';
                        try { const uploadRes = await axios.post(`${API}/uploads/receipts`, receiptForm, { headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' } }); receiptUrl = uploadRes.data.url || ''; } catch (err) {}
                        setMarkPaidForm(prev => ({ ...prev, amount: parseRes.data.amount || prev.amount, receipt_url: receiptUrl }));
                      } catch (err) { console.error('Parse error:', err); }
                      setMarkPaidParsing(false); e.target.value = '';
                    }} />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={async () => {
                  setMarkPaidSaving(true);
                  try {
                    await axios.post(`${API}/finance/expenses`, { title: markPaidModal.title, amount: markPaidForm.amount, date: new Date().toISOString().split('T')[0], category: markPaidModal.category, vendor: markPaidModal.vendor, status: 'paid', recurring: false, notes: markPaidModal.notes || '', receipt_url: markPaidForm.receipt_url || '', paid_by: markPaidModal.paid_by, recurring_parent_id: markPaidModal.id }, { headers: getHeaders() });
                    await axios.put(`${API}/finance/expenses/${markPaidModal.id}`, { ...markPaidModal, last_paid_date: new Date().toISOString().split('T')[0] }, { headers: getHeaders() });
                    const res = await axios.get(`${API}/finance/expenses/recurring`, { headers: getHeaders() });
                    setRecurringData(res.data); setMarkPaidModal(null);
                  } catch (err) { console.error(err); }
                  setMarkPaidSaving(false);
                }} disabled={markPaidSaving} style={{ flex: 1, background: markPaidSaving ? p.textMuted : p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                  {markPaidSaving ? '⏳ Saving...' : '✓ Confirm Payment'}
                </button>
                <button onClick={() => setMarkPaidModal(null)} style={{ flex: 1, background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '11px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Team Superbrain */}
        <div style={{ background: `linear-gradient(135deg, ${p.sidebar} 0%, ${p.sidebar}CC 100%)`, borderRadius: 12, padding: 24, border: `1px solid ${p.cardBorder}`, marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: 0.06 }}>🧠</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>🧠</span>
                <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 600, margin: 0 }}>Team Superbrain</h3>
                {teamInsight && (
                  <span style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', fontSize: 10, borderRadius: 20, padding: '2px 8px' }}>
                    {new Date(teamInsight.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
              {teamInsight && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, margin: 0 }}>From {teamInsight.thought_count} thoughts · {teamInsight.user_count} {teamInsight.user_count === 1 ? 'contributor' : 'contributors'}</p>}
            </div>
            {role === 'admin' && (
              <button onClick={async () => {
                setGeneratingInsight(true);
                try { const res = await axios.post(`${API}/insights/generate`, {}, { headers: getHeaders() }); setTeamInsight(res.data); } catch (err) { console.error(err); }
                setGeneratingInsight(false);
              }} disabled={generatingInsight} style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 14px', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
                {generatingInsight ? '⏳ Generating...' : '✨ Generate Now'}
              </button>
            )}
          </div>
          {teamInsight ? (
  <div style={{ fontSize: 13, lineHeight: 1.7 }}>
    <ReactMarkdown remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ node, ...props }) => <h2 style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.9)', margin: '14px 0 6px', textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: 4 }} {...props} />,
        h3: ({ node, ...props }) => <h3 style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)', margin: '10px 0 4px' }} {...props} />,
        p: ({ node, ...props }) => <p style={{ margin: '0 0 8px', color: 'rgba(255,255,255,0.85)' }} {...props} />,
        ul: ({ node, ...props }) => <ul style={{ paddingLeft: 18, margin: '4px 0 8px', listStyle: 'none', padding: 0 }} {...props} />,
        li: ({ node, ...props }) => <li style={{ marginBottom: 4, color: 'rgba(255,255,255,0.85)' }} {...props} />,
        strong: ({ node, ...props }) => <strong style={{ fontWeight: 600, color: '#fff' }} {...props} />,
      }}>
      {teamInsight.insight}
    </ReactMarkdown>
  </div>
) : (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0, fontStyle: 'italic' }}>No insight yet — add thoughts in My Thoughts and click Generate Now to surface team patterns.</p>
          )}
        </div>

        {/* Bottom Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>

          {/* Stale Leads */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: 0 }}>Needs Attention</h3>
              <span style={{ color: staleLeads.length > 0 ? '#D4A574' : p.primary, fontSize: 12, fontWeight: 600 }}>{staleLeads.length}</span>
            </div>
            {staleLeads.length === 0 ? (
              <p style={{ color: p.primary, fontSize: 12, textAlign: 'center', padding: 16 }}>All leads are fresh</p>
            ) : staleLeads.slice(0, 5).map(c => {
              const days = Math.floor((new Date() - new Date(c.updated_at || c.created_at)) / 86400000);
              return (
                <div key={c.id} onClick={() => navigate(`/contacts/${c.id}`)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${p.cardBorder}`, cursor: 'pointer' }}>
                  <div>
                    <p style={{ color: p.text, fontSize: 13, fontWeight: 500, margin: 0 }}>{c.company_name}</p>
                    <span style={{ color: STAGE_COLORS[c.stage], fontSize: 10, fontWeight: 600 }}>{c.stage}</span>
                  </div>
                  <span style={{ color: days > 14 ? '#D4183D' : '#D4A574', fontSize: 11, fontWeight: 600 }}>{days}d</span>
                </div>
              );
            })}
          </div>

          {/* Recent Activity */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: 0 }}>Activity</h3>
              {totalPages > 1 && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button onClick={() => setActivityPage(prev => Math.max(0, prev - 1))} disabled={activityPage === 0}
                    style={{ background: 'none', border: `1px solid ${p.cardBorder}`, borderRadius: 4, padding: '2px 6px', fontSize: 11, cursor: activityPage === 0 ? 'default' : 'pointer', opacity: activityPage === 0 ? 0.3 : 1, color: p.text }}>←</button>
                  <span style={{ color: p.textSecondary, fontSize: 10 }}>{activityPage + 1}/{totalPages}</span>
                  <button onClick={() => setActivityPage(prev => Math.min(totalPages - 1, prev + 1))} disabled={activityPage >= totalPages - 1}
                    style={{ background: 'none', border: `1px solid ${p.cardBorder}`, borderRadius: 4, padding: '2px 6px', fontSize: 11, cursor: activityPage >= totalPages - 1 ? 'default' : 'pointer', opacity: activityPage >= totalPages - 1 ? 0.3 : 1, color: p.text }}>→</button>
                </div>
              )}
            </div>
            {activity.length === 0 ? (
              <p style={{ color: p.textMuted, fontSize: 12, textAlign: 'center', padding: 16 }}>No activity</p>
            ) : pagedActivity.map(a => (
              <div key={a.id} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: `1px solid ${p.cardBorder}`, cursor: 'pointer' }}
                onClick={() => a.company_id && navigate(`/contacts/${a.company_id}`)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ color: p.text, fontSize: 12, fontWeight: 500 }}>{a.crm_companies?.company_name || '—'}</span>
                    <span style={{ background: p.inputBg, color: p.textSecondary, fontSize: 9, borderRadius: 4, padding: '1px 5px' }}>{a.action}</span>
                  </div>
                  <p style={{ color: p.textSecondary, fontSize: 11, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.details?.substring(0, 60)}</p>
                </div>
                <span style={{ color: p.textMuted, fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>{formatTime(a.created_at)}</span>
              </div>
            ))}
          </div>

          {/* Team + Meetings + Finance */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {teamStats.length > 0 && (
              <div style={card}>
                <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Team</h3>
                {teamStats.map(t => (
                  <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${p.cardBorder}` }}>
                    <div>
                      <p style={{ color: p.text, fontSize: 12, fontWeight: 500, margin: 0 }}>{t.name}</p>
                      <span style={{ color: p.textSecondary, fontSize: 10 }}>{t.role}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ color: p.text, fontSize: 11 }}>{t.companies} leads</span>
                      <span style={{ color: '#4CAF50', fontSize: 11 }}>{t.clients} clients</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: 0 }}>Upcoming Meetings</h3>
                <button onClick={() => navigate('/calendar')} style={{ background: 'none', border: 'none', color: p.primary, fontSize: 12, cursor: 'pointer', padding: 0 }}>View calendar →</button>
              </div>
              {(() => {
                const now = new Date();
                const weekOut = new Date(now.getTime() + 7 * 86400000);
                const filtered = upcomingMeetings.filter(m => { const start = new Date(m.start_time); return start >= now && start <= weekOut; });
                return filtered.length === 0 ? (
                  <p style={{ color: p.textMuted, fontSize: 12, textAlign: 'center', padding: 16 }}>No meetings in the next 7 days</p>
                ) : filtered.slice(0, 5).map(m => {
                  const start = new Date(m.start_time);
                  const isToday = start.toDateString() === new Date().toDateString();
                  const isTomorrow = start.toDateString() === new Date(Date.now() + 86400000).toDateString();
                  const dayLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  return (
                    <div key={m.id} onClick={() => m.company_id ? navigate(`/contacts/${m.company_id}`) : m.client_id ? navigate(`/clients/${m.client_id}`) : null}
                      style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: `1px solid ${p.cardBorder}`, cursor: 'pointer' }}>
                      <div style={{ width: 4, borderRadius: 2, background: m.meeting_type === 'google_meet' ? '#4CAF50' : p.accent, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: p.text, fontSize: 12, fontWeight: 500, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</p>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ color: isToday ? p.accent : p.textSecondary, fontSize: 10, fontWeight: isToday ? 600 : 400 }}>{dayLabel}</span>
                          <span style={{ color: p.textSecondary, fontSize: 10 }}>{start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {financeStats && (
              <div style={card}>
                <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Finance</h3>
                {[
                  { label: 'This Month', value: `$${(financeStats.totalThisMonth || 0).toLocaleString()}` },
                  { label: 'This Year', value: `$${(financeStats.totalThisYear || 0).toLocaleString()}` },
                  { label: 'Pending', value: `$${(financeStats.totalPending || 0).toLocaleString()}`, warn: financeStats.totalPending > 0 },
                  { label: 'Overdue', value: `$${(financeStats.totalOverdue || 0).toLocaleString()}`, warn: financeStats.totalOverdue > 0 },
                ].map(({ label, value, warn }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${p.cardBorder}` }}>
                    <span style={{ color: p.textSecondary, fontSize: 12 }}>{label}</span>
                    <span style={{ color: warn ? '#D4183D' : p.text, fontSize: 13, fontWeight: 600 }}>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}