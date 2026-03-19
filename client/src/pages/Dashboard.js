import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';

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
  const navigate = useNavigate();
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
    setLoading(false);
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

  const openRate = emailStats.total > 0 ? Math.round((emailStats.opened / emailStats.total) * 100) : 0;
  const clickRate = emailStats.total > 0 ? Math.round((emailStats.clicked / emailStats.total) * 100) : 0;

  const pagedActivity = activity.slice(activityPage * 5, (activityPage + 1) * 5);
  const totalPages = Math.ceil(activity.length / 5);

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 60000);
    if (diff < 1) return 'Now';
    if (diff < 60) return `${diff}m`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    if (diff < 10080) return `${Math.floor(diff / 1440)}d`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Team stats
  const teamStats = teamUsers.map(u => ({
    name: u.name,
    role: u.role,
    companies: companies.filter(c => c.assigned_to === u.id).length,
    clients: clients.filter(c => c.assigned_to === u.id).length,
  })).filter(t => t.companies > 0 || t.clients > 0);

  const stat = (label, value, sub) => (
    <div style={{ padding: '0' }}>
      <p style={{ color: '#1a1d1a', fontSize: 22, fontWeight: 700, margin: '0 0 2px', fontFamily: "'Playfair Display', Georgia, serif" }}>{value}</p>
      <p style={{ color: '#717182', fontSize: 11, margin: 0, letterSpacing: 0.5 }}>{label}</p>
      {sub && <p style={{ color: '#8E9B8B', fontSize: 11, margin: '2px 0 0', fontWeight: 500 }}>{sub}</p>}
    </div>
  );

  if (loading) return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 240, flex: 1, padding: 40, color: '#717182' }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 240, flex: 1, padding: '32px 40px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 2px' }}>Overview</p>
            <h1 style={{ color: '#1a1d1a', fontSize: 28, fontWeight: 700, fontFamily: "'Playfair Display', Georgia, serif", margin: 0 }}>Dashboard</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/import')} style={{ background: '#fff', color: '#3E423D', border: '1px solid rgba(62,66,61,0.12)', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}>Import CSV</button>
            <button onClick={() => navigate('/contacts')} style={{ background: '#3E423D', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}>+ Add Company</button>
          </div>
        </div>

        {/* Top KPIs — single row */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '20px 28px', border: '1px solid rgba(62,66,61,0.08)', marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 20 }}>
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
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: '#1a1d1a', fontSize: 14, fontWeight: 600, margin: 0 }}>Pipeline</h3>
              <span style={{ color: '#717182', fontSize: 11 }}>{activeCompanies.length} active</span>
            </div>
            {byStage.length === 0 ? (
              <p style={{ color: '#CBCED4', fontSize: 13, textAlign: 'center', padding: 20 }}>No data</p>
            ) : byStage.map(({ stage, count }) => (
              <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ color: '#3E423D', fontSize: 12, width: 110, flexShrink: 0 }}>{stage}</span>
                <div style={{ flex: 1, background: '#F5F3EF', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                  <div style={{ background: STAGE_COLORS[stage], height: '100%', borderRadius: 4, width: `${(count / maxStageCount) * 100}%` }} />
                </div>
                <span style={{ color: '#1a1d1a', fontSize: 12, fontWeight: 600, width: 24, textAlign: 'right' }}>{count}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(62,66,61,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4CAF50' }} />
                <span style={{ fontSize: 12, color: '#3E423D' }}><strong>{companies.filter(c => c.stage === 'Closed Won').length}</strong> Won</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#D4183D' }} />
                <span style={{ fontSize: 12, color: '#3E423D' }}><strong>{companies.filter(c => c.stage === 'Closed Lost').length}</strong> Lost</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1a6fad' }} />
                <span style={{ fontSize: 12, color: '#3E423D' }}><strong>{companies.filter(c => c.stage === 'Converted').length}</strong> Converted</span>
              </div>
            </div>
          </div>

          {/* Clients + Email Performance */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Clients */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ color: '#1a1d1a', fontSize: 14, fontWeight: 600, margin: 0 }}>Clients</h3>
                <button onClick={() => navigate('/clients')} style={{ background: 'none', border: 'none', color: '#8E9B8B', fontSize: 12, cursor: 'pointer', padding: 0 }}>View all →</button>
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

            {/* Email Performance */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.08)' }}>
              <h3 style={{ color: '#1a1d1a', fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Email Performance</h3>
              <div style={{ display: 'flex', gap: 16 }}>
                {[
                  { label: 'Sent', value: emailStats.total },
                  { label: 'Open Rate', value: `${openRate}%`, good: openRate >= 30 },
                  { label: 'Click Rate', value: `${clickRate}%`, good: clickRate >= 3 },
                  { label: 'Bounced', value: emailStats.bounced, bad: emailStats.bounced > 0 },
                ].map(({ label, value, good, bad }) => (
                  <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                    <p style={{ color: bad ? '#D4183D' : good ? '#4CAF50' : '#1a1d1a', fontSize: 18, fontWeight: 700, margin: '0 0 2px' }}>{value}</p>
                    <p style={{ color: '#717182', fontSize: 10, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</p>
                  </div>
                ))}
              </div>
              {marketingStats && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(62,66,61,0.06)', display: 'flex', gap: 16 }}>
                  {[
                    { label: 'Campaigns', value: marketingStats.total_campaigns },
                    { label: 'Avg Open', value: `${marketingStats.avg_open_rate || 0}%` },
                    { label: 'Avg CTR', value: `${marketingStats.avg_ctr || 0}%` },
                    { label: 'Unsubs', value: marketingStats.total_unsubscribed || 0 },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                      <p style={{ color: '#1a1d1a', fontSize: 14, fontWeight: 600, margin: '0 0 2px' }}>{value}</p>
                      <p style={{ color: '#717182', fontSize: 10, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Grid — 3 columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>

          {/* Stale Leads */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ color: '#1a1d1a', fontSize: 14, fontWeight: 600, margin: 0 }}>Needs Attention</h3>
              <span style={{ color: staleLeads.length > 0 ? '#D4A574' : '#8E9B8B', fontSize: 12, fontWeight: 600 }}>{staleLeads.length}</span>
            </div>
            {staleLeads.length === 0 ? (
              <p style={{ color: '#8E9B8B', fontSize: 12, textAlign: 'center', padding: 16 }}>All leads are fresh</p>
            ) : staleLeads.slice(0, 5).map(c => {
              const days = Math.floor((new Date() - new Date(c.updated_at || c.created_at)) / 86400000);
              return (
                <div key={c.id} onClick={() => navigate(`/contacts/${c.id}`)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(62,66,61,0.04)', cursor: 'pointer' }}>
                  <div>
                    <p style={{ color: '#1a1d1a', fontSize: 13, fontWeight: 500, margin: 0 }}>{c.company_name}</p>
                    <span style={{ color: STAGE_COLORS[c.stage], fontSize: 10, fontWeight: 600 }}>{c.stage}</span>
                  </div>
                  <span style={{ color: days > 14 ? '#D4183D' : '#D4A574', fontSize: 11, fontWeight: 600 }}>{days}d</span>
                </div>
              );
            })}
          </div>

          {/* Recent Activity */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ color: '#1a1d1a', fontSize: 14, fontWeight: 600, margin: 0 }}>Activity</h3>
              {totalPages > 1 && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button onClick={() => setActivityPage(p => Math.max(0, p - 1))} disabled={activityPage === 0}
                    style={{ background: 'none', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 4, padding: '2px 6px', fontSize: 11, cursor: activityPage === 0 ? 'default' : 'pointer', opacity: activityPage === 0 ? 0.3 : 1 }}>←</button>
                  <span style={{ color: '#717182', fontSize: 10 }}>{activityPage + 1}/{totalPages}</span>
                  <button onClick={() => setActivityPage(p => Math.min(totalPages - 1, p + 1))} disabled={activityPage >= totalPages - 1}
                    style={{ background: 'none', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 4, padding: '2px 6px', fontSize: 11, cursor: activityPage >= totalPages - 1 ? 'default' : 'pointer', opacity: activityPage >= totalPages - 1 ? 0.3 : 1 }}>→</button>
                </div>
              )}
            </div>
            {activity.length === 0 ? (
              <p style={{ color: '#CBCED4', fontSize: 12, textAlign: 'center', padding: 16 }}>No activity</p>
            ) : pagedActivity.map(a => (
              <div key={a.id} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(62,66,61,0.04)', cursor: 'pointer' }}
                onClick={() => a.company_id && navigate(`/contacts/${a.company_id}`)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ color: '#1a1d1a', fontSize: 12, fontWeight: 500 }}>{a.crm_companies?.company_name || '—'}</span>
                    <span style={{ background: '#F5F3EF', color: '#717182', fontSize: 9, borderRadius: 4, padding: '1px 5px' }}>{a.action}</span>
                  </div>
                  <p style={{ color: '#717182', fontSize: 11, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.details?.substring(0, 60)}</p>
                </div>
                <span style={{ color: '#CBCED4', fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>{formatTime(a.created_at)}</span>
              </div>
            ))}
          </div>

          {/* Team + Finance */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Team */}
            {teamStats.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.08)' }}>
                <h3 style={{ color: '#1a1d1a', fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Team</h3>
                {teamStats.map(t => (
                  <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(62,66,61,0.04)' }}>
                    <div>
                      <p style={{ color: '#1a1d1a', fontSize: 12, fontWeight: 500, margin: 0 }}>{t.name}</p>
                      <span style={{ color: '#717182', fontSize: 10 }}>{t.role}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ color: '#3E423D', fontSize: 11 }}>{t.companies} leads</span>
                      <span style={{ color: '#4CAF50', fontSize: 11 }}>{t.clients} clients</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

{/* Upcoming Meetings */}
<div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ color: '#1a1d1a', fontSize: 14, fontWeight: 600, margin: 0 }}>Upcoming Meetings</h3>
                <button onClick={() => navigate('/calendar')} style={{ background: 'none', border: 'none', color: '#8E9B8B', fontSize: 12, cursor: 'pointer', padding: 0 }}>View calendar →</button>
              </div>
              {(() => {
                const now = new Date();
                const weekOut = new Date(now.getTime() + 7 * 86400000);
                const filtered = upcomingMeetings.filter(m => {
                  const start = new Date(m.start_time);
                  return start >= now && start <= weekOut;
                });
                return filtered.length === 0 ? (
                  <p style={{ color: '#CBCED4', fontSize: 12, textAlign: 'center', padding: 16 }}>No meetings in the next 7 days</p>
                ) : filtered.slice(0, 5).map(m => {
                  const start = new Date(m.start_time);
                  const isToday = start.toDateString() === new Date().toDateString();
                  const isTomorrow = start.toDateString() === new Date(Date.now() + 86400000).toDateString();
                  const dayLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  return (
                    <div key={m.id} onClick={() => m.company_id ? navigate(`/contacts/${m.company_id}`) : m.client_id ? navigate(`/clients/${m.client_id}`) : null}
                      style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(62,66,61,0.04)', cursor: 'pointer' }}>
                      <div style={{ width: 4, borderRadius: 2, background: m.meeting_type === 'google_meet' ? '#4CAF50' : '#D4A574', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: '#1a1d1a', fontSize: 12, fontWeight: 500, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</p>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ color: isToday ? '#D4A574' : '#717182', fontSize: 10, fontWeight: isToday ? 600 : 400 }}>{dayLabel}</span>
                          <span style={{ color: '#717182', fontSize: 10 }}>{start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                          <span style={{ color: '#CBCED4', fontSize: 10 }}>{m.meeting_type === 'google_meet' ? '📹' : '📞'}</span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Finance */}
            {financeStats && (
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.08)' }}>
                <h3 style={{ color: '#1a1d1a', fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Finance</h3>
                {[
                  { label: 'This Month', value: `$${(financeStats.totalThisMonth || 0).toLocaleString()}` },
                  { label: 'This Year', value: `$${(financeStats.totalThisYear || 0).toLocaleString()}` },
                  { label: 'Pending', value: `$${(financeStats.totalPending || 0).toLocaleString()}`, warn: financeStats.totalPending > 0 },
                  { label: 'Overdue', value: `$${(financeStats.totalOverdue || 0).toLocaleString()}`, warn: financeStats.totalOverdue > 0 },
                ].filter(f => f.warn !== false || f.value !== '$0').map(({ label, value, warn }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(62,66,61,0.04)' }}>
                    <span style={{ color: '#717182', fontSize: 12 }}>{label}</span>
                    <span style={{ color: warn ? '#D4183D' : '#1a1d1a', fontSize: 13, fontWeight: 600 }}>{value}</span>
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