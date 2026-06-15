import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useApp } from '../context/AppContext';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const CLIENT_STAGES = ['Onboarding', 'Active', 'Paused', 'Churned'];
const STAGE_COLORS = {
  'Onboarding': { bg: '#FFF3CD', color: '#856404' },
  'Active': { bg: '#D4EDDA', color: '#155724' },
  'Paused': { bg: '#FFE5D0', color: '#8B5E34' },
  'Churned': { bg: '#F8D7DA', color: '#721C24' },
};
const CONTRACT_COLORS = {
  'RevShare': { bg: '#EBF4FF', color: '#1a6fad' },
  'Subscription': { bg: '#F3E8FF', color: '#7C3AED' },
  'Flat Fee': { bg: '#E8F5E9', color: '#2E7D32' },
};

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const navigate = useNavigate();
  const { palette: p } = useApp();
  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchClients(); }, []);

  const fetchClients = async () => {
    try {
      const res = await axios.get(`${API}/clients`, { headers: getHeaders() });
      setClients(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const filtered = clients.filter(c => {
    if (stageFilter && c.stage !== stageFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        c.business_name?.toLowerCase().includes(s) ||
        c.contact_first_name?.toLowerCase().includes(s) ||
        c.contact_last_name?.toLowerCase().includes(s) ||
        c.contact_email?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const inputStyle = { background: p.inputBg, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '9px 12px', color: p.text, fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif' };

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: p.background, minHeight: '100vh', transition: 'background 0.4s' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: 40 }}>

        <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>Management</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ color: p.text, fontSize: 30, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>Clients</h1>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {CLIENT_STAGES.map(stage => {
            const count = clients.filter(c => c.stage === stage).length;
            const sc = STAGE_COLORS[stage];
            return (
              <div key={stage} style={{ background: p.cardBg, borderRadius: 12, padding: 20, border: `1px solid ${p.cardBorder}`, cursor: 'pointer' }}
                onClick={() => setStageFilter(stageFilter === stage ? '' : stage)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ background: sc.bg, color: sc.color, fontSize: 11, borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>{stage}</span>
                  <span style={{ color: p.text, fontSize: 24, fontWeight: 700, fontFamily: 'Playfair Display, Georgia, serif' }}>{count}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..."
            style={{ ...inputStyle, flex: 1 }} />
          <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} style={inputStyle}>
            <option value="">All Stages</option>
            {CLIENT_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Client List */}
        {loading ? (
          <p style={{ color: p.textSecondary }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div style={{ background: p.cardBg, borderRadius: 12, padding: 60, textAlign: 'center', border: `1px solid ${p.cardBorder}` }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🤝</div>
            <p style={{ color: p.text, fontSize: 16, fontWeight: 500, margin: '0 0 8px' }}>
              {clients.length === 0 ? 'No clients yet' : 'No clients match your filters'}
            </p>
            <p style={{ color: p.textSecondary, fontSize: 13, margin: 0 }}>
              {clients.length === 0 ? 'Convert a contact from the pipeline to create your first client' : 'Try adjusting your search or filters'}
            </p>
          </div>
        ) : (
          <div style={{ background: p.cardBg, borderRadius: 12, border: `1px solid ${p.cardBorder}`, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: p.inputBg }}>
                  {['Business Name', 'Contact', 'Stage', 'Contract', 'Commission', 'City', 'Owner', 'Created'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: p.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const sc = STAGE_COLORS[c.stage] || { bg: p.inputBg, color: p.textSecondary };
                  const cc = CONTRACT_COLORS[c.contract_type] || { bg: p.inputBg, color: p.textSecondary };
                  return (
                    <tr key={c.id}
                      style={{ borderTop: `1px solid ${p.cardBorder}`, background: i % 2 === 0 ? p.cardBg : p.inputBg, cursor: 'pointer' }}
                      onClick={() => navigate(`/clients/${c.id}`)}
                      onMouseOver={e => e.currentTarget.style.background = p.backgroundSecondary}
                      onMouseOut={e => e.currentTarget.style.background = i % 2 === 0 ? p.cardBg : p.inputBg}>
                      <td style={{ padding: '14px 16px' }}>
                        <p style={{ color: p.text, fontSize: 14, fontWeight: 500, margin: 0 }}>{c.business_name}</p>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <p style={{ color: p.textSecondary, fontSize: 13, margin: '0 0 1px' }}>{c.contact_first_name} {c.contact_last_name}</p>
                        <p style={{ color: p.textMuted, fontSize: 11, margin: 0 }}>{c.contact_email}</p>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: sc.bg, color: sc.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>{c.stage}</span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: cc.bg, color: cc.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>{c.contract_type}</span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: p.primary, fontWeight: 600 }}>{c.commission_rate}%</td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: p.textSecondary }}>{c.city}{c.state ? `, ${c.state}` : ''}</td>
                      <td style={{ padding: '14px 16px', fontSize: 12, color: p.textSecondary }}>{c.crm_users?.name || '—'}</td>
                      <td style={{ padding: '14px 16px', fontSize: 12, color: p.textMuted }}>{new Date(c.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}