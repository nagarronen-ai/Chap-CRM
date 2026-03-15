import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const STAGE_COLORS = {
  'New': '#94B0BC', 'Contacted': '#8E9B8B', 'No Reply': '#717182',
  'Follow-up': '#D4A574', 'Meeting Scheduled': '#B4A5D6',
  'Proposal Offered': '#8E9B8B', 'Agreement Sent': '#94B0BC',
  'Closed Won': '#4CAF50', 'Closed Lost': '#D4183D', 'Not Interested': '#CBCED4',
};

const STAGES = ['New', 'Contacted', 'No Reply', 'Follow-up', 'Meeting Scheduled', 'Proposal Offered', 'Agreement Sent', 'Closed Won', 'Closed Lost', 'Not Interested'];

const ACTION_ICONS = {
  'Email Sent': '📧', 'Email Draft Saved': '📝', 'Email Opened': '👁',
  'Email Clicked': '🖱', 'Email Bounced': '↩️', 'Note Added': '📌',
  'Stage Changed': '🔄', 'Contact Added': '👤', 'Company Created': '🏢',
  'Email Delivered': '✅',
};

export default function Dashboard() {
  const [companies, setCompanies] = useState([]);
  const [activity, setActivity] = useState([]);
  const [emailStats, setEmailStats] = useState({ total: 0, delivered: 0, opened: 0, clicked: 0 });
  const [marketingStats, setMarketingStats] = useState(null);
  const [financeStats, setFinanceStats] = useState(null);
  const [staleLeads, setStaleLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activityPage, setActivityPage] = useState(0);
  const ACTIVITY_PER_PAGE = 5;
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

      // Find stale leads — companies with no activity in 7+ days that are in active pipeline
      const activeStages = ['New', 'Contacted', 'No Reply', 'Follow-up', 'Meeting Scheduled', 'Proposal Offered', 'Agreement Sent'];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const stale = companiesRes.data.filter(c => {
        if (!activeStages.includes(c.stage)) return false;
        const updated = new Date(c.updated_at || c.created_at);
        return updated < sevenDaysAgo;
      }).sort((a, b) => new Date(a.updated_at || a.created_at) - new Date(b.updated_at || b.created_at));
      setStaleLeads(stale);
    } catch (err) { console.error('dashboard error:', err); }

    // Fetch email stats
    try {
      const res = await axios.get(`${API}/emails/sent`, { headers: getHeaders() });
      const emails = res.data.filter(e => e.status === 'sent');
      setEmailStats({
        total: emails.length,
        delivered: emails.filter(e => ['delivered', 'opened', 'clicked'].includes(e.email_status)).length,
        opened: emails.filter(e => ['opened', 'clicked'].includes(e.email_status)).length,
        clicked: emails.filter(e => e.email_status === 'clicked').length,
      });
    } catch (err) { console.error('email stats error:', err); }

    // Fetch marketing stats
    try {
      const res = await axios.get(`${API}/marketing/stats`, { headers: getHeaders() });
      setMarketingStats(res.data);
    } catch (err) { console.error('marketing stats error:', err); }

    // Fetch finance stats
    try {
      const res = await axios.get(`${API}/finance/expenses/summary`, { headers: getHeaders() });
      setFinanceStats(res.data);
    } catch (err) { /* finance might not be accessible for all roles */ }

    setLoading(false);
  };

  const totalPeople = companies.reduce((acc, c) => acc + (c.crm_people?.length || 0), 0);

  const byStage = STAGES.map(stage => ({
    stage,
    count: companies.filter(c => c.stage === stage).length,
  })).filter(s => s.count > 0);

  const byOrigin = ['Upload', 'Cold', 'Hot', 'Instagram', 'Google', 'Referral'].map(origin => ({
    origin,
    count: companies.filter(c => c.origin === origin).length,
  })).filter(o => o.count > 0);

  const thisWeek = companies.filter(c => {
    const created = new Date(c.created_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return created > weekAgo;
  }).length;

  const maxStageCount = Math.max(...byStage.map(s => s.count), 1);

  const pagedActivity = activity.slice(activityPage * ACTIVITY_PER_PAGE, (activityPage + 1) * ACTIVITY_PER_PAGE);
  const totalActivityPages = Math.ceil(activity.length / ACTIVITY_PER_PAGE);

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 240, flex: 1, padding: 40, color: '#717182' }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 240, flex: 1, padding: 40 }}>

        {/* Header */}
        <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>Overview</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <h1 style={{ color: '#3E423D', fontSize: 30, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>Dashboard</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigate('/import')}
              style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.15)', borderRadius: 8, padding: '10px 18px', fontSize: 13, cursor: 'pointer' }}>
              📥 Import CSV
            </button>
            <button onClick={() => navigate('/contacts')}
              style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, cursor: 'pointer' }}>
              + Add Company
            </button>
          </div>
        </div>

        {/* Top Stats — CRM */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
          {[
            { label: 'Total Companies', value: companies.length, icon: '🏢', color: '#8E9B8B' },
            { label: 'Total People', value: totalPeople, icon: '👥', color: '#94B0BC' },
            { label: 'Added This Week', value: thisWeek, icon: '📈', color: '#D4A574' },
            { label: 'Active Pipeline', value: companies.filter(c => !['Closed Won','Closed Lost','Not Interested'].includes(c.stage)).length, icon: '🎯', color: '#B4A5D6' },
          ].map(stat => (
            <div key={stat.label} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid rgba(62,66,61,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>{stat.icon}</span>
                <p style={{ color: '#717182', fontSize: 10, margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>{stat.label}</p>
              </div>
              <p style={{ color: stat.color, fontSize: 28, fontWeight: 700, margin: 0, fontFamily: 'Playfair Display, Georgia, serif' }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Email & Marketing Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Emails Sent', value: emailStats.total, icon: '📧', color: '#94B0BC' },
            { label: 'Open Rate', value: emailStats.total > 0 ? Math.round((emailStats.opened / emailStats.total) * 100) + '%' : '0%', icon: '👁', color: emailStats.total > 0 && (emailStats.opened / emailStats.total) >= 0.3 ? '#4CAF50' : '#D4A574' },
            { label: 'Campaigns Sent', value: marketingStats?.total_campaigns || 0, icon: '📣', color: '#B4A5D6' },
            { label: 'Avg Campaign Open', value: marketingStats?.avg_open_rate ? marketingStats.avg_open_rate + '%' : '0%', icon: '📊', color: marketingStats?.avg_open_rate >= 30 ? '#4CAF50' : '#D4A574' },
          ].map(stat => (
            <div key={stat.label} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid rgba(62,66,61,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>{stat.icon}</span>
                <p style={{ color: '#717182', fontSize: 10, margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>{stat.label}</p>
              </div>
              <p style={{ color: stat.color, fontSize: 28, fontWeight: 700, margin: 0, fontFamily: 'Playfair Display, Georgia, serif' }}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Pipeline by Stage */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.1)' }}>
            <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: '0 0 20px' }}>Pipeline by Stage</h3>
            {byStage.length === 0 ? (
              <p style={{ color: '#CBCED4', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No companies yet</p>
            ) : byStage.map(({ stage, count }) => (
              <div key={stage} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#5A6059', fontSize: 13 }}>{stage}</span>
                  <span style={{ color: '#3E423D', fontSize: 13, fontWeight: 600 }}>{count}</span>
                </div>
                <div style={{ background: '#F5F3EF', borderRadius: 20, height: 6, overflow: 'hidden' }}>
                  <div style={{ background: STAGE_COLORS[stage], height: '100%', borderRadius: 20, width: `${(count / maxStageCount) * 100}%`, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* By Origin */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.1)' }}>
              <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: '0 0 16px' }}>Companies by Origin</h3>
              {byOrigin.length === 0 ? (
                <p style={{ color: '#CBCED4', fontSize: 13 }}>No data yet</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {byOrigin.map(({ origin, count }) => (
                    <div key={origin} style={{ background: '#F5F3EF', borderRadius: 10, padding: '10px 16px', textAlign: 'center' }}>
                      <p style={{ color: '#3E423D', fontSize: 20, fontWeight: 700, margin: '0 0 2px' }}>{count}</p>
                      <p style={{ color: '#717182', fontSize: 11, margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>{origin}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Outcomes + Finance */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Outcomes */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid rgba(62,66,61,0.1)' }}>
                <h3 style={{ color: '#3E423D', fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Outcomes</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Won', stage: 'Closed Won', color: '#4CAF50', bg: '#f0faf0' },
                    { label: 'Lost', stage: 'Closed Lost', color: '#D4183D', bg: '#fdf0f0' },
                    { label: 'N/I', stage: 'Not Interested', color: '#717182', bg: '#F5F3EF' },
                  ].map(({ label, stage, color, bg }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: bg, borderRadius: 8, padding: '8px 12px' }}>
                      <span style={{ color: '#717182', fontSize: 12 }}>{label}</span>
                      <span style={{ color, fontSize: 18, fontWeight: 700 }}>{companies.filter(c => c.stage === stage).length}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Finance Summary */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid rgba(62,66,61,0.1)' }}>
                <h3 style={{ color: '#3E423D', fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Finance</h3>
                {financeStats ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F5F3EF', borderRadius: 8, padding: '8px 12px' }}>
                      <span style={{ color: '#717182', fontSize: 12 }}>This Month</span>
                      <span style={{ color: '#3E423D', fontSize: 16, fontWeight: 700 }}>${financeStats.totalThisMonth?.toLocaleString() || 0}</span>                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F5F3EF', borderRadius: 8, padding: '8px 12px' }}>
                      <span style={{ color: '#717182', fontSize: 12 }}>This Year</span>
                      <span style={{ color: '#8E9B8B', fontSize: 16, fontWeight: 700 }}>${financeStats.totalThisYear?.toLocaleString() || 0}</span>                    </div>
                      {financeStats.totalOverdue > 0 && (                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fdf0f0', borderRadius: 8, padding: '8px 12px' }}>
                        <span style={{ color: '#D4183D', fontSize: 12 }}>Overdue</span>
                        <span style={{ color: '#D4183D', fontSize: 16, fontWeight: 700 }}>${financeStats.totalOverdue?.toLocaleString() || 0}</span>                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ color: '#CBCED4', fontSize: 12, margin: 0 }}>No access</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row — Stale Leads + Activity */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Stale Leads */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: 0 }}>
                ⚠️ Stale Leads <span style={{ color: '#D4A574', fontSize: 13, fontWeight: 400 }}>({staleLeads.length})</span>
              </h3>
              <span style={{ color: '#717182', fontSize: 11 }}>No activity in 7+ days</span>
            </div>
            {staleLeads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <span style={{ fontSize: 32 }}>🎉</span>
                <p style={{ color: '#8E9B8B', fontSize: 13, margin: '8px 0 0' }}>All leads are fresh!</p>
              </div>
            ) : (
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {staleLeads.slice(0, 10).map(c => {
                  const daysSince = Math.floor((new Date() - new Date(c.updated_at || c.created_at)) / 86400000);
                  return (
                    <div key={c.id}
                      onClick={() => navigate(`/contacts/${c.id}`)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(62,66,61,0.06)', cursor: 'pointer' }}
                      onMouseOver={e => e.currentTarget.style.background = '#FAFAF9'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div>
                        <p style={{ color: '#3E423D', fontSize: 13, fontWeight: 500, margin: '0 0 2px' }}>{c.company_name}</p>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ background: STAGE_COLORS[c.stage] + '22', color: STAGE_COLORS[c.stage], fontSize: 10, borderRadius: 20, padding: '1px 8px', fontWeight: 600 }}>{c.stage}</span>
                          {c.city && <span style={{ color: '#CBCED4', fontSize: 11 }}>{c.city}</span>}
                        </div>
                      </div>
                      <span style={{ color: daysSince > 14 ? '#D4183D' : '#D4A574', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {daysSince}d ago
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: 0 }}>Recent Activity</h3>
              {totalActivityPages > 1 && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button onClick={() => setActivityPage(Math.max(0, activityPage - 1))} disabled={activityPage === 0}
                    style={{ background: 'none', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 6, padding: '3px 8px', fontSize: 12, cursor: activityPage === 0 ? 'default' : 'pointer', opacity: activityPage === 0 ? 0.4 : 1 }}>←</button>
                  <span style={{ color: '#717182', fontSize: 11, padding: '0 4px' }}>{activityPage + 1}/{totalActivityPages}</span>
                  <button onClick={() => setActivityPage(Math.min(totalActivityPages - 1, activityPage + 1))} disabled={activityPage >= totalActivityPages - 1}
                    style={{ background: 'none', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 6, padding: '3px 8px', fontSize: 12, cursor: activityPage >= totalActivityPages - 1 ? 'default' : 'pointer', opacity: activityPage >= totalActivityPages - 1 ? 0.4 : 1 }}>→</button>
                </div>
              )}
            </div>
            {activity.length === 0 ? (
              <p style={{ color: '#CBCED4', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No activity yet</p>
            ) : pagedActivity.map(a => (
              <div key={a.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(62,66,61,0.06)', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16, marginTop: 2, flexShrink: 0 }}>{ACTION_ICONS[a.action] || '📋'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ color: '#3E423D', fontSize: 13, fontWeight: 500, cursor: 'pointer', textDecoration: 'none' }}
                      onClick={() => a.company_id && navigate(`/contacts/${a.company_id}`)}>
                      {a.crm_companies?.company_name || '—'}
                    </span>
                    <span style={{ background: '#F5F3EF', color: '#717182', fontSize: 10, borderRadius: 20, padding: '1px 8px', fontWeight: 500 }}>{a.action}</span>
                  </div>
                  <p style={{ color: '#717182', fontSize: 12, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.details?.substring(0, 80)}{a.details?.length > 80 ? '...' : ''}
                  </p>
                </div>
                <span style={{ color: '#CBCED4', fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>{formatTime(a.created_at)}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}