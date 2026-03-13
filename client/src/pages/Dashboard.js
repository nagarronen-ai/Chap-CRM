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

export default function Dashboard() {
  const [companies, setCompanies] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/contacts/companies`, { headers: getHeaders() });
      setCompanies(res.data);
    } catch (err) { console.error('companies error:', err); }
    try {
      const res = await axios.get(`${API}/contacts/activity/recent`, { headers: getHeaders() });
      setActivity(res.data);
    } catch (err) { console.error('activity error:', err); }
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

        {/* Top Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Total Companies', value: companies.length, icon: '🏢', color: '#8E9B8B' },
            { label: 'Total People', value: totalPeople, icon: '👥', color: '#94B0BC' },
            { label: 'Added This Week', value: thisWeek, icon: '📈', color: '#D4A574' },
            { label: 'Active Pipeline', value: companies.filter(c => !['Closed Won','Closed Lost','Not Interested'].includes(c.stage)).length, icon: '🎯', color: '#B4A5D6' },
          ].map(stat => (
            <div key={stat.label} style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.1)', boxShadow: '0 2px 8px rgba(62,66,61,0.06)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{stat.icon}</div>
              <p style={{ color: stat.color, fontSize: 32, fontWeight: 700, margin: '0 0 4px', fontFamily: 'Playfair Display, Georgia, serif' }}>{stat.value}</p>
              <p style={{ color: '#717182', fontSize: 12, margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>{stat.label}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Pipeline by Stage */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.1)', boxShadow: '0 2px 8px rgba(62,66,61,0.06)' }}>
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

          {/* By Origin + Recent */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* By Origin */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.1)', boxShadow: '0 2px 8px rgba(62,66,61,0.06)' }}>
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

            {/* Won vs Lost */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.1)', boxShadow: '0 2px 8px rgba(62,66,61,0.06)' }}>
              <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: '0 0 16px' }}>Outcomes</h3>
              <div style={{ display: 'flex', gap: 12 }}>
                {[
                  { label: 'Closed Won', color: '#4CAF50', bg: '#f0faf0' },
                  { label: 'Closed Lost', color: '#D4183D', bg: '#fdf0f0' },
                  { label: 'Not Interested', color: '#717182', bg: '#F5F3EF' },
                ].map(({ label, color, bg }) => (
                  <div key={label} style={{ flex: 1, background: bg, borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                    <p style={{ color, fontSize: 24, fontWeight: 700, margin: '0 0 2px' }}>{companies.filter(c => c.stage === label).length}</p>
                    <p style={{ color: '#717182', fontSize: 11, margin: 0 }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.1)', boxShadow: '0 2px 8px rgba(62,66,61,0.06)' }}>
          <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: '0 0 16px' }}>Recent Activity</h3>
          {activity.length === 0 ? (
            <p style={{ color: '#CBCED4', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No activity yet</p>
          ) : activity.map(a => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(62,66,61,0.06)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ background: '#F5F3EF', color: '#5A6059', fontSize: 11, borderRadius: 20, padding: '2px 10px', whiteSpace: 'nowrap' }}>{a.action}</span>
                <span style={{ color: '#3E423D', fontSize: 13 }}>{a.crm_companies?.company_name || '—'}</span>
                <span style={{ color: '#717182', fontSize: 12 }}>{a.details?.substring(0, 60)}{a.details?.length > 60 ? '...' : ''}</span>
              </div>
              <span style={{ color: '#CBCED4', fontSize: 11, whiteSpace: 'nowrap', marginLeft: 12 }}>{new Date(a.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}