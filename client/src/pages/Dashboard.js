import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useApp } from '../context/AppContext';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

// Mirrors the Services tab pills in ClientProfile.js
const STATUS_PILL = {
  active:   { dot: '#28a745', bg: '#D4EDDA', fg: '#155724', label: 'Active'   },
  prospect: { dot: '#D4A574', bg: '#FFF3CD', fg: '#856404', label: 'Prospect' },
  past:     { dot: '#9E9E9E', bg: '#E0E0E0', fg: '#6C6C6C', label: 'Past'     },
  lost:     { dot: '#D4183D', bg: '#F8D7DA', fg: '#721C24', label: 'Lost'     },
};

// Color tokens for the Opportunities Pipeline rows — match Opportunities page TYPE_PILL fg
const OPP_TYPE_ROW = {
  new_customer: { label: 'New Customers', color: '#4A90D9' },
  new_service:  { label: 'New Services',  color: STATUS_PILL.active.dot },
  upsell:       { label: 'Upsells',       color: STATUS_PILL.prospect.dot },
};

const formatILS = (n) => `₪${Math.round(Number(n) || 0).toLocaleString()}`;

const TIMEFRAME_LABEL = { month: 'this month', quarter: 'this quarter', year: 'this year', all: 'all time' };

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const [activity, setActivity] = useState([]);
  const [financeStats, setFinanceStats] = useState(null);
  const [teamUsers, setTeamUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activityPage, setActivityPage] = useState(0);
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [needsCompletion, setNeedsCompletion] = useState([]);
  const [completingMeeting, setCompletingMeeting] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [savingCompletion, setSavingCompletion] = useState(false);
  const [recurringData, setRecurringData] = useState(null);
  const [markPaidModal, setMarkPaidModal] = useState(null);
  const [markPaidParsing, setMarkPaidParsing] = useState(false);
  const [markPaidSaving, setMarkPaidSaving] = useState(false);
  const [markPaidForm, setMarkPaidForm] = useState({ amount: '', receipt_url: '' });

  // QPoint dashboard state
  const [dashStats, setDashStats] = useState(null);
  const [opportunities, setOpportunities] = useState(null); // null = loading, [] = loaded empty
  const [providers, setProviders] = useState(null);         // null = loading, [] = loaded empty
  const [timeframe, setTimeframe] = useState('month');
  // Default: "services" — crm_client_finance is empty so revenue toggle has nothing to show
  const [topToggle, setTopToggle] = useState('services');

  const navigate = useNavigate();
  const { palette: p } = useApp();
  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchDashStats(); }, [timeframe]);

  const sinceForTimeframe = (tf) => {
    const now = new Date();
    if (tf === 'month')   return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    if (tf === 'quarter') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString().slice(0, 10);
    if (tf === 'year')    return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    return null;
  };

  const fetchDashStats = async () => {
    const since = sinceForTimeframe(timeframe);
    try {
      const res = await axios.get(`${API}/clients/dashboard-stats${since ? `?since=${since}` : ''}`, { headers: getHeaders() });
      setDashStats(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchData = async () => {
    try {
      const [clientsRes, activityRes] = await Promise.all([
        axios.get(`${API}/clients`, { headers: getHeaders() }),
        axios.get(`${API}/clients/activity/combined?limit=10`, { headers: getHeaders() }),
      ]);
      setClients(clientsRes.data);
      setActivity(activityRes.data);
    } catch (err) { console.error(err); }
    try { const res = await axios.get(`${API}/opportunities`,               { headers: getHeaders() }); setOpportunities(res.data || []); } catch (err) { setOpportunities([]); }
    try { const res = await axios.get(`${API}/service-providers`,           { headers: getHeaders() }); setProviders(res.data || []); }     catch (err) { setProviders([]); }
    try { const res = await axios.get(`${API}/finance/expenses/recurring`,  { headers: getHeaders() }); setRecurringData(res.data); }       catch (err) {}
    try { const res = await axios.get(`${API}/finance/expenses/summary`,    { headers: getHeaders() }); setFinanceStats(res.data); }        catch (err) {}
    try { const res = await axios.get(`${API}/users/team-list`,             { headers: getHeaders() }); setTeamUsers(res.data); }           catch (err) {}
    try { const res = await axios.get(`${API}/calendar/upcoming`,           { headers: getHeaders() }); setUpcomingMeetings(res.data); }    catch (err) {}
    try { const res = await axios.get(`${API}/calendar/needs-completion`,   { headers: getHeaders() }); setNeedsCompletion(res.data); }     catch (err) {}
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

  const pagedActivity = activity.slice(activityPage * 5, (activityPage + 1) * 5);
  const totalPages    = Math.ceil(activity.length / 5);

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const diff = Math.floor((new Date() - d) / 60000);
    if (diff < 1)     return 'Now';
    if (diff < 60)    return `${diff}m`;
    if (diff < 1440)  return `${Math.floor(diff / 60)}h`;
    if (diff < 10080) return `${Math.floor(diff / 1440)}d`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Team: clients owned + active services owned
  const teamStats = teamUsers.map(u => ({
    name: u.name, role: u.role,
    clients: clients.filter(c => c.owner_id === u.id).length,
    activeServices: dashStats?.active_services_by_owner?.[u.id] || 0,
  })).filter(t => t.clients > 0 || t.activeServices > 0);

  // KPI tiles — Companies hidden when 0
  const counts = dashStats?.counts || {};
  const kpiTiles = [
    counts.companies > 0 ? { label: 'Companies', value: counts.companies } : null,
    { label: 'Clients',           value: counts.clients ?? clients.length },
    { label: 'People',            value: counts.people ?? 0 },
    { label: 'Active Services',   value: counts.services_active ?? 0 },
    { label: 'Prospect Services', value: counts.services_prospect ?? 0 },
    { label: 'Revenue',           value: formatILS(dashStats?.revenue?.paid || 0), sub: TIMEFRAME_LABEL[timeframe] },
  ].filter(Boolean);

  const topList = topToggle === 'revenue' ? (dashStats?.top_by_revenue || []) : (dashStats?.top_by_services || []);

  // Opportunities Pipeline aggregations — bucket by type. Tracks raw count, total ₪, and
  // weighted ₪ (po_amount × probability / 100, summed only over rows where BOTH are set).
  // `weightedHas` flags whether ANY row in the bucket qualified — lets us distinguish
  // "no data" (render —) from "genuinely ₪0" later.
  const oppAgg = opportunities ? opportunities.reduce(
    (acc, o) => {
      const bucket = acc[o.opportunity_type];
      if (!bucket) return acc;
      bucket.count += 1;
      if (o.po_amount != null) bucket.sum += Number(o.po_amount) || 0;
      if (o.po_amount != null && o.probability != null) {
        bucket.weighted    += Number(o.po_amount) * Number(o.probability) / 100;
        bucket.weightedHas  = true;
      }
      return acc;
    },
    {
      new_customer: { count: 0, sum: 0, weighted: 0, weightedHas: false },
      new_service:  { count: 0, sum: 0, weighted: 0, weightedHas: false },
      upsell:       { count: 0, sum: 0, weighted: 0, weightedHas: false },
    }
  ) : null;
  const oppTotalCount = oppAgg ? oppAgg.new_customer.count + oppAgg.new_service.count + oppAgg.upsell.count : 0;
  // Total pipeline value excludes new_customer (po_amount is always null there)
  const oppTotalValue = oppAgg ? oppAgg.new_service.sum + oppAgg.upsell.sum : 0;
  const oppTotalWeighted    = oppAgg ? oppAgg.new_customer.weighted + oppAgg.new_service.weighted + oppAgg.upsell.weighted : 0;
  const oppTotalWeightedHas = oppAgg ? (oppAgg.new_customer.weightedHas || oppAgg.new_service.weightedHas || oppAgg.upsell.weightedHas) : false;

  // Provider Contracts — provider endpoint counts ALL junction rows (pending included).
  // Subtract new_service opportunities (= junction rows with po_number IS NULL) to get
  // truly-active contracts (PO assigned).
  const providerTotals = providers ? providers.reduce(
    (acc, pr) => ({
      contractsAll: acc.contractsAll + (Number(pr.active_contracts) || 0),
      valueAll:     acc.valueAll     + (Number(pr.total_po_amount)  || 0),
    }),
    { contractsAll: 0, valueAll: 0 }
  ) : null;
  const pendingCount      = oppAgg?.new_service.count || 0;
  const pendingValue      = oppAgg?.new_service.sum   || 0;
  const activeOrdersCount = providerTotals ? Math.max(0, providerTotals.contractsAll - pendingCount) : 0;
  const activeOrdersValue = providerTotals ? Math.max(0, providerTotals.valueAll     - pendingValue) : 0;
  const providersReady    = providers != null && oppAgg != null;
  const hasAnyProviderContracts = providers && providers.some(pr => (pr.active_contracts || 0) > 0);

  const card = { background: p.cardBg, borderRadius: 12, padding: 24, border: `1px solid ${p.cardBorder}` };

  const stat = (label, value, sub) => (
    <div>
      <p style={{ color: p.text, fontSize: 22, fontWeight: 700, margin: '0 0 2px', fontFamily: "'Playfair Display', Georgia, serif" }}>{value}</p>
      <p style={{ color: p.textSecondary, fontSize: 11, margin: 0, letterSpacing: 0.5 }}>{label}</p>
      {sub && <p style={{ color: p.primary, fontSize: 11, margin: '2px 0 0', fontWeight: 500 }}>{sub}</p>}
    </div>
  );

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
            <button onClick={() => navigate('/clients')} style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}>+ Add Client</button>
          </div>
        </div>

        {/* KPI Bar */}
        <div style={{ ...card, marginBottom: 20, display: 'grid', gridTemplateColumns: `repeat(${kpiTiles.length}, 1fr)`, gap: 20, padding: '20px 28px' }}>
          {kpiTiles.map(({ label, value, sub }) => (
            <div key={label}>{stat(label, value, sub)}</div>
          ))}
        </div>

        {/* Row 1 — Revenue (with timeframe) | Opportunities Pipeline | Clients status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>

          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: 0 }}>Revenue</h3>
              <select value={timeframe} onChange={e => setTimeframe(e.target.value)}
                style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 6, padding: '4px 8px', fontSize: 11, outline: 'none', fontFamily: 'Inter, sans-serif' }}>
                <option value="month">This month</option>
                <option value="quarter">This quarter</option>
                <option value="year">This year</option>
                <option value="all">All time</option>
              </select>
            </div>
            <p style={{ color: p.text, fontSize: 32, fontWeight: 700, margin: '8px 0 4px', fontFamily: "'Playfair Display', Georgia, serif" }}>
              {formatILS(dashStats?.revenue?.paid || 0)}
            </p>
            <p style={{ color: p.textSecondary, fontSize: 11, margin: 0 }}>paid · {TIMEFRAME_LABEL[timeframe]}</p>
            {(dashStats?.revenue?.pending || 0) > 0 && (
              <p style={{ color: '#D4A574', fontSize: 12, margin: '10px 0 0', fontWeight: 500 }}>
                {formatILS(dashStats.revenue.pending)} pending
              </p>
            )}
          </div>

          {/* Opportunities Pipeline */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: 0 }}>Opportunities Pipeline</h3>
              <button onClick={() => navigate('/opportunities')} style={{ background: 'none', border: 'none', color: p.primary, fontSize: 12, cursor: 'pointer', padding: 0 }}>view all →</button>
            </div>
            {!oppAgg ? (
              [0, 1, 2].map(i => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${p.cardBorder}` }}>
                  <span style={{ color: p.textMuted, fontSize: 13 }}>—</span>
                  <span style={{ color: p.textMuted, fontSize: 13 }}>—</span>
                </div>
              ))
            ) : oppTotalCount === 0 ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <p style={{ color: p.textMuted, fontSize: 12, margin: '0 0 8px' }}>No opportunities yet</p>
                <button onClick={() => navigate('/opportunities')} style={{ background: 'none', border: 'none', color: p.primary, fontSize: 12, cursor: 'pointer', padding: 0, fontWeight: 600 }}>Open Opportunities →</button>
              </div>
            ) : (
              <>
                {/* Column header line */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14, padding: '0 4px 6px' }}>
                  <span style={{ color: p.textMuted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, minWidth: 24, textAlign: 'right' }}>#</span>
                  <span style={{ color: p.textMuted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, minWidth: 80, textAlign: 'right' }}>Total</span>
                  <span style={{ color: p.textMuted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, minWidth: 80, textAlign: 'right' }}>Weighted</span>
                </div>
                {['new_customer', 'new_service', 'upsell'].map(type => {
                  const { label, color }              = OPP_TYPE_ROW[type];
                  const { count, sum, weighted, weightedHas } = oppAgg[type];
                  return (
                    <div key={type}
                      onClick={() => navigate(`/opportunities?type=${type}`)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px', borderBottom: `1px solid ${p.cardBorder}`, cursor: 'pointer', borderRadius: 6 }}
                      onMouseOver={e => e.currentTarget.style.background = p.inputBg}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ color: p.text, fontSize: 13, fontWeight: 500 }}>{label}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                        <span style={{ color: p.text, fontSize: 13, fontWeight: 600, minWidth: 24, textAlign: 'right' }}>{count}</span>
                        <span style={{ color: type === 'new_customer' ? p.textMuted : p.primary, fontSize: 13, fontWeight: 600, minWidth: 80, textAlign: 'right' }}>
                          {type === 'new_customer' ? '—' : formatILS(sum)}
                        </span>
                        <span style={{ color: weightedHas ? '#155724' : p.textMuted, fontSize: 13, fontWeight: 600, minWidth: 80, textAlign: 'right' }}>
                          {weightedHas ? `${formatILS(weighted)} est.` : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 4px 0' }}>
                  <span style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Total</span>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <span style={{ color: p.text, fontSize: 13, fontWeight: 700, minWidth: 24, textAlign: 'right' }}>{oppTotalCount}</span>
                    <span style={{ color: p.primary, fontSize: 13, fontWeight: 700, minWidth: 80, textAlign: 'right' }}>{formatILS(oppTotalValue)}</span>
                    <span style={{ color: oppTotalWeightedHas ? '#155724' : p.textMuted, fontSize: 13, fontWeight: 700, minWidth: 80, textAlign: 'right' }}>
                      {oppTotalWeightedHas ? `${formatILS(oppTotalWeighted)} wtd.` : '—'}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: 0 }}>Clients</h3>
              <button onClick={() => navigate('/clients')} style={{ background: 'none', border: 'none', color: p.primary, fontSize: 12, cursor: 'pointer', padding: 0 }}>View all →</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Onboarding', count: clients.filter(c => c.stage === 'Onboarding').length, color: '#856404', bg: '#FFF3CD' },
                { label: 'Active',     count: clients.filter(c => c.stage === 'Active').length,     color: '#155724', bg: '#D4EDDA' },
                { label: 'Paused',     count: clients.filter(c => c.stage === 'Paused').length,     color: '#8B5E34', bg: '#FFE5D0' },
                { label: 'Churned',    count: clients.filter(c => c.stage === 'Churned').length,    color: '#721C24', bg: '#F8D7DA' },
              ].map(({ label, count, color, bg }) => (
                <div key={label} style={{ background: bg, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <p style={{ color, fontSize: 18, fontWeight: 700, margin: '0 0 2px' }}>{count}</p>
                  <p style={{ color, fontSize: 9, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.8 }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2 — Top Customers | Provider Contracts | Operator Expenses */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>

          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: 0 }}>Top Customers</h3>
              <div style={{ display: 'flex', gap: 4, background: p.inputBg, borderRadius: 20, padding: 2 }}>
                {[{ key: 'services', label: 'Services' }, { key: 'revenue', label: 'Revenue' }].map(t => (
                  <button key={t.key} onClick={() => setTopToggle(t.key)}
                    style={{ background: topToggle === t.key ? p.primary : 'transparent', color: topToggle === t.key ? '#fff' : p.textSecondary, border: 'none', borderRadius: 20, padding: '3px 12px', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            {topList.length === 0 ? (
              <p style={{ color: p.textMuted, fontSize: 12, textAlign: 'center', padding: 20 }}>No data yet</p>
            ) : topList.map((t, i) => (
              <div key={t.id} onClick={() => navigate(`/clients/${t.id}`)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${p.cardBorder}`, cursor: 'pointer' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0, flex: 1 }}>
                  <span style={{ color: p.textMuted, fontSize: 11, width: 16 }}>{i + 1}</span>
                  <span style={{ color: p.text, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.business_name}</span>
                </div>
                <span style={{ color: p.primary, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 8 }}>
                  {topToggle === 'revenue' ? formatILS(t.value) : `${t.value} svc`}
                </span>
              </div>
            ))}
          </div>

          {/* Provider Contracts */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: 0 }}>Provider Contracts</h3>
              <button onClick={() => navigate('/service-providers')} style={{ background: 'none', border: 'none', color: p.primary, fontSize: 12, cursor: 'pointer', padding: 0 }}>view all →</button>
            </div>
            {!providersReady ? (
              <>
                <div style={{ marginBottom: 14, padding: '6px 8px' }}>
                  <p style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 4px' }}>Active Orders (SOAG)</p>
                  <p style={{ color: p.textMuted, fontSize: 18, fontWeight: 700, margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>—</p>
                </div>
                <div style={{ padding: '6px 8px' }}>
                  <p style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 4px' }}>Pending Quotes</p>
                  <p style={{ color: p.textMuted, fontSize: 18, fontWeight: 700, margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>—</p>
                </div>
              </>
            ) : (!hasAnyProviderContracts && pendingCount === 0) ? (
              <p style={{ color: p.textMuted, fontSize: 12, textAlign: 'center', padding: 20 }}>No provider contracts yet</p>
            ) : (
              <>
                <div onClick={() => navigate('/service-providers')}
                  style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}
                  onMouseOver={e => e.currentTarget.style.background = p.inputBg}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <p style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 6px' }}>Active Orders (SOAG)</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ color: p.text, fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display', Georgia, serif" }}>{activeOrdersCount} contracts</span>
                    <span style={{ color: p.primary, fontSize: 14, fontWeight: 600 }}>{formatILS(activeOrdersValue)}</span>
                  </div>
                </div>
                <div onClick={() => navigate('/opportunities?type=new_service')}
                  style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}
                  onMouseOver={e => e.currentTarget.style.background = p.inputBg}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <p style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 6px' }}>Pending Quotes</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ color: p.text, fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display', Georgia, serif" }}>{pendingCount} quotes</span>
                    <span style={{ color: STATUS_PILL.prospect.fg, fontSize: 14, fontWeight: 600 }}>{formatILS(pendingValue)}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div style={card}>
            <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Operator Expenses</h3>
            {financeStats ? (
              [
                { label: 'This Month', value: formatILS(financeStats.totalThisMonth || 0) },
                { label: 'This Year',  value: formatILS(financeStats.totalThisYear  || 0) },
                { label: 'Pending',    value: formatILS(financeStats.totalPending   || 0), warn: financeStats.totalPending > 0 },
                { label: 'Overdue',    value: formatILS(financeStats.totalOverdue   || 0), warn: financeStats.totalOverdue > 0 },
              ].map(({ label, value, warn }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${p.cardBorder}` }}>
                  <span style={{ color: p.textSecondary, fontSize: 12 }}>{label}</span>
                  <span style={{ color: warn ? '#D4183D' : p.text, fontSize: 13, fontWeight: 600 }}>{value}</span>
                </div>
              ))
            ) : (
              <p style={{ color: p.textMuted, fontSize: 12, textAlign: 'center', padding: 16 }}>No expenses tracked yet</p>
            )}
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
                      onClick={() => m.client_id ? navigate(`/clients/${m.client_id}`) : m.company_id ? navigate(`/companies/${m.company_id}`) : null}>
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

        {/* Recurring Payments (₪) */}
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
                    <p style={{ color: p.text, fontSize: 14, fontWeight: 700, margin: 0 }}>₪{parseFloat(exp.amount).toFixed(2)}</p>
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

        {/* Mark Paid Modal (₪) */}
        {markPaidModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: p.cardBg, borderRadius: 16, padding: 32, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: `1px solid ${p.cardBorder}` }}>
              <h2 style={{ color: p.text, fontSize: 18, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 6px' }}>Mark as Paid</h2>
              <p style={{ color: p.textSecondary, fontSize: 13, margin: '0 0 20px' }}>{markPaidModal.title} · {markPaidModal.vendor}</p>
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4 }}>Amount Paid (₪)</label>
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

        {/* Bottom Row — Recent Activity | Upcoming Meetings | Team */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>

          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: 0 }}>Recent Activity</h3>
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
            ) : pagedActivity.map(a => {
              const orgName = a.crm_clients?.business_name || a.crm_companies?.company_name || '—';
              const onRowClick = () => {
                if (a.client_id) navigate(`/clients/${a.client_id}`);
                else if (a.company_id) navigate(`/companies/${a.company_id}`);
              };
              return (
                <div key={a.id} onClick={onRowClick}
                  style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: `1px solid ${p.cardBorder}`, cursor: a.client_id || a.company_id ? 'pointer' : 'default' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ color: p.text, fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{orgName}</span>
                      <span style={{ background: p.inputBg, color: p.textSecondary, fontSize: 9, borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>{a.action}</span>
                    </div>
                    <p style={{ color: p.textSecondary, fontSize: 11, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.details?.substring(0, 60)}</p>
                  </div>
                  <span style={{ color: p.textMuted, fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>{formatTime(a.created_at)}</span>
                </div>
              );
            })}
          </div>

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
                const isToday    = start.toDateString() === new Date().toDateString();
                const isTomorrow = start.toDateString() === new Date(Date.now() + 86400000).toDateString();
                const dayLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                return (
                  <div key={m.id} onClick={() => m.client_id ? navigate(`/clients/${m.client_id}`) : m.company_id ? navigate(`/companies/${m.company_id}`) : null}
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

          <div style={card}>
            <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Team</h3>
            {teamStats.length === 0 ? (
              <p style={{ color: p.textMuted, fontSize: 12, textAlign: 'center', padding: 16 }}>No assignments yet</p>
            ) : teamStats.map(t => (
              <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${p.cardBorder}` }}>
                <div>
                  <p style={{ color: p.text, fontSize: 12, fontWeight: 500, margin: 0 }}>{t.name}</p>
                  <span style={{ color: p.textSecondary, fontSize: 10 }}>{t.role}</span>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ color: '#4CAF50', fontSize: 11 }}>{t.clients} clients</span>
                  <span style={{ color: p.primary, fontSize: 11 }}>{t.activeServices} svc</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
