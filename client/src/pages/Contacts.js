import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useRole } from '../hooks/useRole';

const STAGES = ['New', 'Contacted', 'No Reply', 'Follow-up', 'Meeting Scheduled', 'Proposal Offered', 'Agreement Sent', 'Closed Won', 'Closed Lost', 'Not Interested'];
const ORIGINS = ['Upload', 'Cold', 'Hot', 'Instagram', 'Google', 'Referral'];
const COUNTRIES = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Israel', 'France', 'Germany', 'Spain', 'Italy', 'Netherlands', 'Belgium', 'Switzerland', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Portugal', 'Austria', 'New Zealand', 'Singapore', 'Japan', 'South Korea', 'Brazil', 'Mexico', 'Argentina', 'Colombia', 'Chile', 'South Africa', 'Nigeria', 'Kenya', 'Egypt', 'UAE', 'Saudi Arabia', 'India', 'China', 'Other'];
const CATEGORIES = {
  'Venue & Spaces': ['Venue', 'Hotel', 'Resort', 'Estate', 'Ranch', 'Barn', 'Garden', 'Rooftop'],
  'Entertainment': ['DJ', 'Live Band', 'Photographer', 'Videographer', 'Photo Booth'],
  'Food & Drink': ['Catering', 'Cake & Desserts', 'Bar Service', 'Food Truck'],
  'Beauty & Fashion': ['Makeup Artist', 'Hair Stylist', 'Bridal Boutique', 'Suits & Tuxedos'],
  'Decor & Florals': ['Florist', 'Event Decor', 'Lighting', 'Rentals'],
  'Planning & Services': ['Wedding Planner', 'Officiant', 'Transportation', 'Stationery', 'Favors & Gifts'],
  'Other': ['Jeweler', 'Travel & Honeymoon', 'Other'],
};
const STAGE_COLORS = {
  'New': '#94B0BC', 'Contacted': '#8E9B8B', 'No Reply': '#717182',
  'Follow-up': '#D4A574', 'Meeting Scheduled': '#B4A5D6',
  'Proposal Offered': '#8E9B8B', 'Agreement Sent': '#94B0BC',
  'Closed Won': '#4CAF50', 'Closed Lost': '#D4183D', 'Not Interested': '#CBCED4',
};
const ROLE_COLORS = {
  admin: '#8E9B8B', sales: '#94B0BC', marketing: '#B4A5D6',
  csm: '#D4A574', support: '#717182', finance: '#4CAF50',
};

const API = 'http://localhost:5000/api';
const EMPTY_FORM = { company_name: '', website: '', category: '', business_type: '', city: '', state: '', country: '', stage: 'New', origin: 'Upload', first_name: '', last_name: '', title: '', email: '', work_phone: '' };

export default function Contacts() {
  const [companies, setCompanies] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [dupCompany, setDupCompany] = useState(null);
  const [pendingForm, setPendingForm] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterOrigin, setFilterOrigin] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterAssigned, setFilterAssigned] = useState('');
  const [teamUsers, setTeamUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  useRole(); // reserved for future role-based UI controls


  useEffect(() => { fetchCompanies(); }, []);

  useEffect(() => {
    axios.get(`${API}/users`, { headers }).then(r => setTeamUsers(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    let result = companies;
    if (search) result = result.filter(c => {
      const companyMatch = `${c.company_name} ${c.city} ${c.state}`.toLowerCase().includes(search.toLowerCase());
      const peopleMatch = c.crm_people?.some(p =>
        `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(search.toLowerCase())
      );
      return companyMatch || peopleMatch;
    });
    if (filterStage) result = result.filter(c => c.stage === filterStage);
    if (filterOrigin) result = result.filter(c => c.origin === filterOrigin);
    if (filterCategory) result = result.filter(c => c.category === filterCategory);
    if (filterAssigned) {
      if (filterAssigned === 'unassigned') result = result.filter(c => !c.assigned_to);
      else result = result.filter(c => c.assigned_to === filterAssigned);
    }
    setFiltered(result);
  }, [search, filterStage, filterOrigin, filterCategory, filterAssigned, companies]);

  const fetchCompanies = async () => {
    try {
      const res = await axios.get(`${API}/contacts/companies`, { headers });
      setCompanies(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const saveCompany = async (formData) => {
    setSaving(true);
    try {
      const companyPayload = {
        company_name: formData.company_name, website: formData.website,
        category: formData.category, business_type: formData.business_type,
        city: formData.city, state: formData.state, country: formData.country,
        stage: formData.stage, origin: formData.origin,
      };
      const res = await axios.post(`${API}/contacts/companies`, companyPayload, { headers });
      if (formData.first_name) {
        await axios.post(`${API}/contacts/companies/${res.data.id}/people`, {
          first_name: formData.first_name, last_name: formData.last_name,
          title: formData.title, email: formData.email, work_phone: formData.work_phone,
        }, { headers });
      }
      setShowModal(false);
      setDupCompany(null);
      setPendingForm(null);
      setForm(EMPTY_FORM);
      fetchCompanies();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const dup = companies.find(c => c.company_name?.toLowerCase() === form.company_name.toLowerCase());
    if (dup) {
      setPendingForm(form);
      setDupCompany(dup);
      return;
    }
    await saveCompany(form);
  };

  const inputStyle = { width: '100%', background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '9px 12px', color: '#3E423D', fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 5 };

  const hasFilters = search || filterStage || filterOrigin || filterCategory || filterAssigned;

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 240, flex: 1, padding: 40 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>Pipeline</p>
            <h1 style={{ color: '#3E423D', fontSize: 30, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>Companies</h1>
          </div>
          <button onClick={() => setShowModal(true)} style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>+ Add Company</button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="🔍 Search company, person, email..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: 260 }} />
          <select value={filterStage} onChange={e => setFilterStage(e.target.value)} style={{ ...inputStyle, width: 160 }}>
            <option value="">All Stages</option>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)} style={{ ...inputStyle, width: 140 }}>
            <option value="">All Origins</option>
            {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ ...inputStyle, width: 160 }}>
            <option value="">All Categories</option>
            {Object.keys(CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {teamUsers.length > 0 && (
            <select value={filterAssigned} onChange={e => setFilterAssigned(e.target.value)} style={{ ...inputStyle, width: 160 }}>
              <option value="">All Owners</option>
              <option value="unassigned">— Unassigned —</option>
              {teamUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          {hasFilters && (
            <button onClick={() => { setSearch(''); setFilterStage(''); setFilterOrigin(''); setFilterCategory(''); setFilterAssigned(''); }}
              style={{ background: '#E5E1D8', color: '#5A6059', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 12, cursor: 'pointer' }}>
              Clear Filters
            </button>
          )}
          <span style={{ marginLeft: 'auto', color: '#717182', fontSize: 13 }}>{filtered.length} companies</span>
        </div>

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(62,66,61,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F5F3EF', borderBottom: '1px solid rgba(62,66,61,0.1)' }}>
                {['Company', 'Category', 'Location', 'People', 'Owner', 'Origin', 'Stage', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#717182' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#CBCED4' }}>No companies found</td></tr>
              ) : filtered.map((c, i) => {
                const owner = c.crm_users;
                return (
                  <tr key={c.id}
                    style={{ borderBottom: '1px solid rgba(62,66,61,0.06)', background: i % 2 === 0 ? '#fff' : '#fafaf9', cursor: 'pointer' }}
                    onMouseOver={e => e.currentTarget.style.background = '#F5F3EF'}
                    onMouseOut={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafaf9'}
                    onClick={() => navigate(`/companies/${c.id}`)}>
                    <td style={{ padding: '12px 16px' }}>
                      <p style={{ color: '#3E423D', fontWeight: 600, margin: '0 0 2px', fontSize: 14 }}>{c.company_name}</p>
                      {c.website && <p style={{ color: '#94B0BC', fontSize: 12, margin: 0 }}>{c.website}</p>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {c.category ? (
                        <div>
                          <span style={{ color: '#3E423D', fontSize: 13, display: 'block' }}>{c.category}</span>
                          {c.business_type && <span style={{ color: '#717182', fontSize: 11 }}>{c.business_type}</span>}
                        </div>
                      ) : <span style={{ color: '#CBCED4' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#5A6059', fontSize: 13 }}>{[c.city, c.state].filter(Boolean).join(', ') || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {c.crm_people?.length > 0 ? (
                        <div>
                          <p style={{ color: '#3E423D', fontSize: 13, margin: '0 0 2px', fontWeight: 500 }}>{c.crm_people[0].first_name} {c.crm_people[0].last_name}</p>
                          {c.crm_people.length > 1 && <p style={{ color: '#717182', fontSize: 11, margin: 0 }}>+{c.crm_people.length - 1} more</p>}
                        </div>
                      ) : <span style={{ color: '#CBCED4', fontSize: 13 }}>No contacts</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {owner ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: ROLE_COLORS[owner.role] || '#8E9B8B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                            {owner.name?.charAt(0)}
                          </div>
                          <span style={{ color: '#3E423D', fontSize: 13 }}>{owner.name}</span>
                        </div>
                      ) : <span style={{ color: '#CBCED4', fontSize: 13 }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}><span style={{ background: '#E5E1D8', color: '#5A6059', fontSize: 11, borderRadius: 20, padding: '3px 10px' }}>{c.origin || '—'}</span></td>
                    <td style={{ padding: '12px 16px' }}><span style={{ background: STAGE_COLORS[c.stage] + '22', color: STAGE_COLORS[c.stage], fontSize: 11, borderRadius: 20, padding: '3px 10px', fontWeight: 500 }}>{c.stage}</span></td>
                    <td style={{ padding: '12px 16px' }}><button style={{ background: '#F5F3EF', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: '#5A6059' }}>View →</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Duplicate modal */}
        {dupCompany && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(62,66,61,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 36, width: 460, boxShadow: '0 20px 60px rgba(62,66,61,0.2)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
              <h3 style={{ color: '#3E423D', fontSize: 20, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 8px' }}>Company Already Exists</h3>
              <p style={{ color: '#5A6059', fontSize: 14, margin: '0 0 20px' }}>This company is already in your CRM:</p>
              <div style={{ background: '#F5F3EF', borderRadius: 10, padding: 16, marginBottom: 24 }}>
                <p style={{ color: '#3E423D', fontWeight: 600, margin: '0 0 4px' }}>{dupCompany.company_name}</p>
                <p style={{ color: '#717182', fontSize: 13, margin: '0 0 4px' }}>{dupCompany.city} {dupCompany.state}</p>
                <p style={{ color: '#8E9B8B', fontSize: 13, margin: 0 }}>{dupCompany.category} · {dupCompany.stage} · {dupCompany.crm_people?.length || 0} people</p>
              </div>
              <p style={{ color: '#5A6059', fontSize: 13, margin: '0 0 20px' }}>
                {pendingForm?.first_name ? `Would you like to add ${pendingForm.first_name} ${pendingForm.last_name} as a new person at this company?` : 'Would you like to go to the existing company profile?'}
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={async () => {
                  if (pendingForm?.first_name) {
                    setSaving(true);
                    try {
                      await axios.post(`${API}/contacts/companies/${dupCompany.id}/people`, {
                        first_name: pendingForm.first_name, last_name: pendingForm.last_name,
                        title: pendingForm.title, email: pendingForm.email, work_phone: pendingForm.work_phone,
                      }, { headers });
                    } catch (err) { console.error(err); }
                    setSaving(false);
                  }
                  setDupCompany(null); setPendingForm(null); setShowModal(false); setForm(EMPTY_FORM);
                  navigate(`/companies/${dupCompany.id}`);
                }} disabled={saving}
                  style={{ flex: 1, background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 13, cursor: 'pointer' }}>
                  {saving ? '⏳ Saving...' : pendingForm?.first_name ? '+ Add Person to Company' : 'View Company'}
                </button>
                <button onClick={() => { setDupCompany(null); setPendingForm(null); }}
                  style={{ flex: 1, background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '11px', fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Company Modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(62,66,61,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(62,66,61,0.2)' }}>
              <h2 style={{ color: '#3E423D', fontSize: 24, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 24px' }}>New Company</h2>
              <form onSubmit={handleSubmit}>
                <p style={{ color: '#8E9B8B', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 12px', fontWeight: 600 }}>Company Info</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                  <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Company Name *</label><input required value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Website</label><input value={form.website} onChange={e => setForm({...form, website: e.target.value})} style={inputStyle} /></div>
                  <div>
                    <label style={labelStyle}>Category</label>
                    <select value={form.category} onChange={e => setForm({...form, category: e.target.value, business_type: ''})} style={inputStyle}>
                      <option value="">Select category...</option>
                      {Object.keys(CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Type</label>
                    <select value={form.business_type} onChange={e => setForm({...form, business_type: e.target.value})} style={inputStyle} disabled={!form.category}>
                      <option value="">Select type...</option>
                      {form.category && CATEGORIES[form.category].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><label style={labelStyle}>City</label><input value={form.city} onChange={e => setForm({...form, city: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>State</label><input value={form.state} onChange={e => setForm({...form, state: e.target.value})} style={inputStyle} /></div>
                  <div>
                    <label style={labelStyle}>Country</label>
                    <select value={form.country} onChange={e => setForm({...form, country: e.target.value})} style={inputStyle}>
                      <option value="">Select country...</option>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Stage</label>
                    <select value={form.stage} onChange={e => setForm({...form, stage: e.target.value})} style={inputStyle}>
                      {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Origin</label>
                    <select value={form.origin} onChange={e => setForm({...form, origin: e.target.value})} style={inputStyle}>
                      {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>

                <p style={{ color: '#8E9B8B', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 12px', fontWeight: 600 }}>Primary Contact (Optional)</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
                  <div><label style={labelStyle}>First Name</label><input value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Last Name</label><input value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Title</label><input value={form.title} onChange={e => setForm({...form, title: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Email</label><input value={form.email} onChange={e => setForm({...form, email: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Phone</label><input value={form.work_phone} onChange={e => setForm({...form, work_phone: e.target.value})} style={inputStyle} /></div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="submit" disabled={saving}
                    style={{ flex: 1, background: saving ? '#A5B2A3' : '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer' }}>
                    {saving ? '⏳ Saving...' : 'Save Company'}
                  </button>
                  <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}