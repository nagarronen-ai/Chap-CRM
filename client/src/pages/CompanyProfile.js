import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';

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

const API = 'http://localhost:5000/api';

function InlineField({ label, value, onSave, type = 'text', options = null }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || '');
  const inputRef = useRef(null);

  useEffect(() => { setVal(value || ''); }, [value]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const save = () => {
    setEditing(false);
    if (val !== value) onSave(val);
  };

  const labelStyle = { color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 3 };
  const inputStyle = { width: '100%', background: '#F3F3F5', border: '1px solid #8E9B8B', borderRadius: 6, padding: '6px 10px', color: '#3E423D', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' };

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      {editing ? (
        options ? (
          <select ref={inputRef} value={val} onChange={e => setVal(e.target.value)} onBlur={save} style={inputStyle}>
            <option value="">—</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input ref={inputRef} value={val} onChange={e => setVal(e.target.value)}
            onBlur={save} onKeyDown={e => e.key === 'Enter' && save()}
            style={inputStyle} />
        )
      ) : (
        <div onClick={() => setEditing(true)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid transparent', color: val ? '#3E423D' : '#CBCED4', fontSize: 13, cursor: 'text', minHeight: 30, display: 'flex', alignItems: 'center', transition: 'border 0.15s', background: 'transparent' }}
          onMouseOver={e => e.currentTarget.style.border = '1px solid rgba(62,66,61,0.2)'}
          onMouseOut={e => e.currentTarget.style.border = '1px solid transparent'}>
          {val || <span style={{ fontStyle: 'italic', color: '#CBCED4' }}>Click to edit...</span>}
        </div>
      )}
    </div>
  );
}

export default function CompanyProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [note, setNote] = useState('');
  const [selectedPerson, setSelectedPerson] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [filterPerson, setFilterPerson] = useState('');
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [personForm, setPersonForm] = useState({ first_name: '', last_name: '', title: '', email: '', work_phone: '', mobile_phone: '' });
  const [savingPerson, setSavingPerson] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [nextAction, setNextAction] = useState('');
  const [editingNextAction, setEditingNextAction] = useState(false);
  const [quickNote, setQuickNote] = useState('');
  const [savingQuickNote, setSavingQuickNote] = useState(false);

  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  useEffect(() => { fetchCompany(); fetchActivity(); }, [id]);

  const fetchCompany = async () => {
    try {
      const res = await axios.get(`${API}/contacts/companies/${id}`, { headers: getHeaders() });
      setCompany(res.data);
      setNextAction(res.data.next_action || '');
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchActivity = async () => {
    try {
      const res = await axios.get(`${API}/contacts/companies/${id}/activity`, { headers: getHeaders() });
      setActivity(res.data);
    } catch (err) { console.error(err); }
  };

  const updateField = async (field, value) => {
    const oldValue = company[field];
    if (oldValue === value) return;
    try {
      await axios.put(`${API}/contacts/companies/${id}`, { [field]: value }, { headers: getHeaders() });
      setCompany(prev => ({ ...prev, [field]: value }));
      if (field === 'stage') {
        fetchActivity();
      } else {
        const label = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        await axios.post(`${API}/contacts/companies/${id}/note`, {
          note: `${label} changed from "${oldValue || '—'}" to "${value || '—'}"`,
          person_id: null
        }, { headers: getHeaders() });
        fetchActivity();
      }
    } catch (err) { console.error(err); }
  };

  const updateStage = (stage) => updateField('stage', stage);

  const saveNextAction = async () => {
    setEditingNextAction(false);
    await updateField('next_action', nextAction);
  };

  const addNote = async (noteText, personId) => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await axios.post(`${API}/contacts/companies/${id}/note`, {
        note: noteText, person_id: personId || null
      }, { headers: getHeaders() });
      fetchActivity();
    } catch (err) { console.error(err); }
    setSavingNote(false);
  };

  const saveQuickNote = async () => {
    if (!quickNote.trim() || savingQuickNote) return;
    setSavingQuickNote(true);
    await addNote(quickNote, null);
    setQuickNote('');
    setSavingQuickNote(false);
  };

  const deleteActivity = async (actId) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await axios.delete(`${API}/contacts/activity/${actId}`, { headers: getHeaders() });
      fetchActivity();
    } catch (err) { console.error(err); }
  };

  const addPerson = async (e) => {
    e.preventDefault();
    setSavingPerson(true);
    try {
      await axios.post(`${API}/contacts/companies/${id}/people`, personForm, { headers: getHeaders() });
      setShowAddPerson(false);
      setPersonForm({ first_name: '', last_name: '', title: '', email: '', work_phone: '', mobile_phone: '' });
      fetchCompany();
      fetchActivity();
    } catch (err) { console.error(err); }
    setSavingPerson(false);
  };

  const saveEditPerson = async (e) => {
    e.preventDefault();
    setSavingPerson(true);
    try {
      await axios.put(`${API}/contacts/people/${editingPerson.id}`, editingPerson, { headers: getHeaders() });
      setEditingPerson(null);
      fetchCompany();
    } catch (err) { console.error(err); }
    setSavingPerson(false);
  };

  const deletePerson = async (personId) => {
    if (!window.confirm('Remove this person?')) return;
    try {
      await axios.delete(`${API}/contacts/people/${personId}`, { headers: getHeaders() });
      fetchCompany();
      fetchActivity();
    } catch (err) { console.error(err); }
  };

  const filteredActivity = filterPerson
    ? activity.filter(a => a.person_id === filterPerson || (!a.person_id && filterPerson === 'company'))
    : activity;

  const lastActivity = activity[0];

  const inputStyle = { width: '100%', background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '9px 12px', color: '#3E423D', fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 5 };

  if (loading) return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 240, flex: 1, padding: 40, color: '#717182' }}>Loading...</div>
    </div>
  );

  if (!company) return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 240, flex: 1, padding: 40, color: '#D4183D' }}>Company not found.</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 240, flex: 1, padding: 40 }}>

        {/* Back */}
        <button onClick={() => navigate('/contacts')} style={{ background: 'none', border: 'none', color: '#717182', fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}>← Back to Companies</button>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>{company.category}{company.business_type ? ` · ${company.business_type}` : ''}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ color: '#3E423D', fontSize: 32, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>{company.company_name}</h1>
            <div style={{ display: 'flex', gap: 8 }}>
              {company.website && <a href={company.website} target="_blank" rel="noreferrer" style={{ background: '#F5F3EF', color: '#94B0BC', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px 14px', fontSize: 12, textDecoration: 'none' }}>🌐 Website</a>}
              {company.company_linkedin && <a href={company.company_linkedin} target="_blank" rel="noreferrer" style={{ background: '#F5F3EF', color: '#94B0BC', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px 14px', fontSize: 12, textDecoration: 'none' }}>in LinkedIn</a>}
            </div>
          </div>
        </div>

        {/* Pipeline Stepper */}
<div style={{ background: '#fff', borderRadius: 12, padding: '14px 20px', border: '1px solid rgba(62,66,61,0.1)', boxShadow: '0 2px 8px rgba(62,66,61,0.06)', marginBottom: 20 }}>
  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
    {STAGES.map((stage) => {
      const isActive = company.stage === stage;
      const isPast = STAGES.indexOf(company.stage) > STAGES.indexOf(stage);
      const isLost = ['Closed Lost', 'Not Interested'].includes(stage);
      const isWon = stage === 'Closed Won';
      return (
        <button key={stage} onClick={() => updateStage(stage)}
          style={{
            background: isActive ? STAGE_COLORS[stage] : isPast ? STAGE_COLORS[stage] + '33' : '#F5F3EF',
            color: isActive ? '#fff' : isPast ? STAGE_COLORS[stage] : '#717182',
            border: isActive ? `2px solid ${STAGE_COLORS[stage]}` : '2px solid transparent',
            borderRadius: 20, padding: '4px 12px', fontSize: 11, cursor: 'pointer',
            fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap',
            fontFamily: 'Inter, sans-serif', transition: 'all 0.15s'
          }}>
          {isWon ? '🎉 ' : isLost ? '✗ ' : ''}{stage}
        </button>
      );
    })}
  </div>
</div>

        {/* Status Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 16, border: '1px solid rgba(62,66,61,0.1)' }}>
            <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px' }}>Last Activity</p>
            {lastActivity ? (
              <div>
                <p style={{ color: '#3E423D', fontSize: 13, fontWeight: 500, margin: '0 0 2px' }}>{lastActivity.action}</p>
                <p style={{ color: '#717182', fontSize: 12, margin: 0 }}>{new Date(lastActivity.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
              </div>
            ) : <p style={{ color: '#CBCED4', fontSize: 13, margin: 0 }}>No activity yet</p>}
          </div>

          <div style={{ background: '#fff', borderRadius: 10, padding: 16, border: '1px solid rgba(62,66,61,0.1)' }}>
            <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px' }}>Next Action</p>
            {editingNextAction ? (
              <input autoFocus value={nextAction} onChange={e => setNextAction(e.target.value)}
                onBlur={saveNextAction} onKeyDown={e => e.key === 'Enter' && saveNextAction()}
                style={{ ...inputStyle, padding: '4px 8px', fontSize: 13 }} placeholder="e.g. Send proposal..." />
            ) : (
              <p onClick={() => setEditingNextAction(true)}
                style={{ color: nextAction ? '#3E423D' : '#CBCED4', fontSize: 13, margin: 0, cursor: 'text', fontStyle: nextAction ? 'normal' : 'italic' }}>
                {nextAction || 'Click to set next action...'}
              </p>
            )}
          </div>

          <div style={{ background: '#fff', borderRadius: 10, padding: 16, border: '1px solid rgba(62,66,61,0.1)' }}>
            <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px' }}>Origin</p>
            <span style={{ background: '#E5E1D8', color: '#5A6059', fontSize: 12, borderRadius: 20, padding: '4px 12px' }}>{company.origin || '—'}</span>
            <span style={{ color: '#717182', fontSize: 12, marginLeft: 8 }}>{company.city}{company.state ? `, ${company.state}` : ''}</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(62,66,61,0.1)' }}>
          {['overview', 'people', 'activity'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ background: 'none', border: 'none', padding: '10px 20px', fontSize: 13, cursor: 'pointer', color: activeTab === tab ? '#3E423D' : '#717182', fontWeight: activeTab === tab ? 600 : 400, borderBottom: activeTab === tab ? '2px solid #8E9B8B' : '2px solid transparent', textTransform: 'capitalize', fontFamily: 'Inter, sans-serif' }}>
              {tab} {tab === 'people' ? `(${company.crm_people?.length || 0})` : tab === 'activity' ? `(${activity.length})` : ''}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>

            {/* Left — Inline editable fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.1)', boxShadow: '0 2px 8px rgba(62,66,61,0.06)' }}>
                <h3 style={{ color: '#3E423D', fontSize: 14, fontWeight: 600, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: 1 }}>Company Info</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                  <InlineField label="Company Name" value={company.company_name} onSave={v => updateField('company_name', v)} />
                  <InlineField label="Website" value={company.website} onSave={v => updateField('website', v)} />
                  <InlineField label="Category" value={company.category} onSave={v => updateField('category', v)} options={Object.keys(CATEGORIES)} />
                  <InlineField label="Business Type" value={company.business_type} onSave={v => updateField('business_type', v)} options={company.category ? CATEGORIES[company.category] : []} />
                  <InlineField label="Industry" value={company.industry} onSave={v => updateField('industry', v)} />
                  <InlineField label="Employees" value={company.employees} onSave={v => updateField('employees', v)} />
                  <InlineField label="Annual Revenue" value={company.annual_revenue} onSave={v => updateField('annual_revenue', v)} />
                  <InlineField label="Origin" value={company.origin} onSave={v => updateField('origin', v)} options={ORIGINS} />
                </div>
              </div>

              <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.1)', boxShadow: '0 2px 8px rgba(62,66,61,0.06)' }}>
                <h3 style={{ color: '#3E423D', fontSize: 14, fontWeight: 600, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: 1 }}>Location & Social</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                  <InlineField label="City" value={company.city} onSave={v => updateField('city', v)} />
                  <InlineField label="State" value={company.state} onSave={v => updateField('state', v)} />
                  <InlineField label="Country" value={company.country} onSave={v => updateField('country', v)} options={COUNTRIES} />
                  <InlineField label="Address" value={company.company_address} onSave={v => updateField('company_address', v)} />
                  <InlineField label="LinkedIn" value={company.company_linkedin} onSave={v => updateField('company_linkedin', v)} />
                  <InlineField label="Facebook" value={company.facebook_url} onSave={v => updateField('facebook_url', v)} />
                  <InlineField label="Twitter" value={company.twitter_url} onSave={v => updateField('twitter_url', v)} />
                </div>
              </div>
            </div>

            {/* Right — People cards + Quick note */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.1)', boxShadow: '0 2px 8px rgba(62,66,61,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ color: '#3E423D', fontSize: 14, fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>People ({company.crm_people?.length || 0})</h3>
                  <button onClick={() => setShowAddPerson(true)} style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>+ Add</button>
                </div>
                {company.crm_people?.length === 0 ? (
                  <p style={{ color: '#CBCED4', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No people yet</p>
                ) : company.crm_people?.map(person => (
                  <div key={person.id} style={{ background: '#F5F3EF', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ color: '#3E423D', fontWeight: 600, margin: '0 0 2px', fontSize: 14 }}>{person.first_name} {person.last_name}</p>
                        {person.title && <p style={{ color: '#717182', fontSize: 12, margin: '0 0 6px' }}>{person.title}</p>}
                        {person.email && <p style={{ color: '#94B0BC', fontSize: 12, margin: '0 0 2px' }}>✉️ {person.email}</p>}
                        {person.work_phone && <p style={{ color: '#5A6059', fontSize: 12, margin: '0 0 2px' }}>📞 {person.work_phone}</p>}
                        {person.mobile_phone && <p style={{ color: '#5A6059', fontSize: 12, margin: 0 }}>📱 {person.mobile_phone}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setEditingPerson({ ...person })} style={{ background: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#5A6059' }}>✏️</button>
                        <button onClick={() => deletePerson(person.id)} style={{ background: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#D4183D' }}>✕</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Note */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.1)', boxShadow: '0 2px 8px rgba(62,66,61,0.06)' }}>
                <h3 style={{ color: '#3E423D', fontSize: 14, fontWeight: 600, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 1 }}>Quick Note</h3>
                <textarea value={quickNote} onChange={e => setQuickNote(e.target.value)} placeholder="Add a note..." rows={3}
                  style={{ ...inputStyle, resize: 'vertical', marginBottom: 10 }} />
                <button onClick={saveQuickNote} disabled={savingQuickNote || !quickNote.trim()}
                  style={{ background: savingQuickNote ? '#A5B2A3' : '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', width: '100%' }}>
                  {savingQuickNote ? '⏳ Saving...' : 'Save Note'}
                </button>

                {/* Last 3 notes preview */}
                {activity.filter(a => a.action === 'Note Added').slice(0, 3).length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 8px' }}>Recent Notes</p>
                    {activity.filter(a => a.action === 'Note Added').slice(0, 3).map(a => (
                      <div key={a.id} style={{ borderLeft: '2px solid #E5E1D8', paddingLeft: 10, marginBottom: 8 }}>
                        <p style={{ color: '#3E423D', fontSize: 13, margin: '0 0 2px' }}>{a.details}</p>
                        <p style={{ color: '#CBCED4', fontSize: 11, margin: 0 }}>{new Date(a.created_at).toLocaleDateString()}</p>
                      </div>
                    ))}
                    <button onClick={() => setActiveTab('activity')} style={{ background: 'none', border: 'none', color: '#94B0BC', fontSize: 12, cursor: 'pointer', padding: 0, marginTop: 4 }}>View all activity →</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PEOPLE TAB */}
        {activeTab === 'people' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ color: '#717182', fontSize: 13, margin: 0 }}>{company.crm_people?.length || 0} people at this company</p>
              <button onClick={() => setShowAddPerson(true)} style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>+ Add Person</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {company.crm_people?.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#CBCED4', border: '1px solid rgba(62,66,61,0.1)' }}>No people added yet</div>
              ) : company.crm_people?.map(person => (
                <div key={person.id} style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid rgba(62,66,61,0.1)', boxShadow: '0 2px 8px rgba(62,66,61,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ color: '#3E423D', fontWeight: 600, margin: '0 0 4px', fontSize: 15 }}>{person.first_name} {person.last_name}</p>
                    {person.title && <p style={{ color: '#717182', fontSize: 13, margin: '0 0 4px' }}>{person.title}</p>}
                    <div style={{ display: 'flex', gap: 16 }}>
                      {person.email && <span style={{ color: '#94B0BC', fontSize: 13 }}>✉️ {person.email}</span>}
                      {person.work_phone && <span style={{ color: '#5A6059', fontSize: 13 }}>📞 {person.work_phone}</span>}
                      {person.mobile_phone && <span style={{ color: '#5A6059', fontSize: 13 }}>📱 {person.mobile_phone}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setEditingPerson({ ...person })} style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>✏️ Edit</button>
                    <button onClick={() => deletePerson(person.id)} style={{ background: '#fdf0f0', color: '#D4183D', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === 'activity' && (
          <div>
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.1)', boxShadow: '0 2px 8px rgba(62,66,61,0.06)', marginBottom: 24 }}>
              <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: '0 0 16px' }}>Add Note</h3>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Write a note..." rows={3}
                style={{ ...inputStyle, resize: 'vertical', marginBottom: 12 }} />
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <select value={selectedPerson} onChange={e => setSelectedPerson(e.target.value)} style={{ ...inputStyle, width: 220 }}>
                  <option value="">🏢 Company note</option>
                  {company.crm_people?.map(p => <option key={p.id} value={p.id}>👤 {p.first_name} {p.last_name}</option>)}
                </select>
                <button onClick={() => { addNote(note, selectedPerson); setNote(''); setSelectedPerson(''); }} disabled={savingNote || !note.trim()}
                  style={{ background: savingNote ? '#A5B2A3' : '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>
                  {savingNote ? '⏳ Saving...' : 'Add Note'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <button onClick={() => setFilterPerson('')} style={{ background: filterPerson === '' ? '#8E9B8B' : '#F5F3EF', color: filterPerson === '' ? '#fff' : '#5A6059', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>All</button>
              <button onClick={() => setFilterPerson('company')} style={{ background: filterPerson === 'company' ? '#8E9B8B' : '#F5F3EF', color: filterPerson === 'company' ? '#fff' : '#5A6059', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>🏢 Company</button>
              {company.crm_people?.map(p => (
                <button key={p.id} onClick={() => setFilterPerson(p.id)} style={{ background: filterPerson === p.id ? '#8E9B8B' : '#F5F3EF', color: filterPerson === p.id ? '#fff' : '#5A6059', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
                  👤 {p.first_name} {p.last_name}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredActivity.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#CBCED4', border: '1px solid rgba(62,66,61,0.1)' }}>No activity yet</div>
              ) : filteredActivity.map(a => (
                <div key={a.id} style={{ background: '#fff', borderRadius: 10, padding: 16, border: '1px solid rgba(62,66,61,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ background: a.action === 'Note Added' ? '#E5E1D8' : '#F5F3EF', color: '#5A6059', fontSize: 11, borderRadius: 20, padding: '2px 10px' }}>{a.action}</span>
                      {a.crm_people && <span style={{ color: '#8E9B8B', fontSize: 12 }}>👤 {a.crm_people.first_name} {a.crm_people.last_name}</span>}
                      {!a.person_id && a.action === 'Note Added' && <span style={{ color: '#94B0BC', fontSize: 12 }}>🏢 Company</span>}
                    </div>
                    <p style={{ color: '#3E423D', fontSize: 14, margin: '0 0 4px' }}>{a.details}</p>
                    <p style={{ color: '#CBCED4', fontSize: 11, margin: 0 }}>{new Date(a.created_at).toLocaleString()}</p>
                  </div>
                  {a.action === 'Note Added' && (
                    <button onClick={() => deleteActivity(a.id)} style={{ background: 'none', border: 'none', color: '#D4183D', fontSize: 12, cursor: 'pointer', marginLeft: 12 }}>Delete</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Person Modal */}
        {showAddPerson && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(62,66,61,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 480, boxShadow: '0 20px 60px rgba(62,66,61,0.2)' }}>
              <h2 style={{ color: '#3E423D', fontSize: 22, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 24px' }}>Add Person</h2>
              <form onSubmit={addPerson}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                  <div><label style={labelStyle}>First Name *</label><input required value={personForm.first_name} onChange={e => setPersonForm({...personForm, first_name: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Last Name</label><input value={personForm.last_name} onChange={e => setPersonForm({...personForm, last_name: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Title</label><input value={personForm.title} onChange={e => setPersonForm({...personForm, title: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Email</label><input value={personForm.email} onChange={e => setPersonForm({...personForm, email: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Work Phone</label><input value={personForm.work_phone} onChange={e => setPersonForm({...personForm, work_phone: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Mobile Phone</label><input value={personForm.mobile_phone} onChange={e => setPersonForm({...personForm, mobile_phone: e.target.value})} style={inputStyle} /></div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="submit" disabled={savingPerson} style={{ flex: 1, background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>{savingPerson ? '⏳ Saving...' : 'Add Person'}</button>
                  <button type="button" onClick={() => setShowAddPerson(false)} style={{ flex: 1, background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Person Modal */}
        {editingPerson && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(62,66,61,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 480, boxShadow: '0 20px 60px rgba(62,66,61,0.2)' }}>
              <h2 style={{ color: '#3E423D', fontSize: 22, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 24px' }}>Edit Person</h2>
              <form onSubmit={saveEditPerson}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                  <div><label style={labelStyle}>First Name *</label><input required value={editingPerson.first_name} onChange={e => setEditingPerson({...editingPerson, first_name: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Last Name</label><input value={editingPerson.last_name || ''} onChange={e => setEditingPerson({...editingPerson, last_name: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Title</label><input value={editingPerson.title || ''} onChange={e => setEditingPerson({...editingPerson, title: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Email</label><input value={editingPerson.email || ''} onChange={e => setEditingPerson({...editingPerson, email: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Work Phone</label><input value={editingPerson.work_phone || ''} onChange={e => setEditingPerson({...editingPerson, work_phone: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Mobile Phone</label><input value={editingPerson.mobile_phone || ''} onChange={e => setEditingPerson({...editingPerson, mobile_phone: e.target.value})} style={inputStyle} /></div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="submit" disabled={savingPerson} style={{ flex: 1, background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>{savingPerson ? '⏳ Saving...' : 'Save Changes'}</button>
                  <button type="button" onClick={() => setEditingPerson(null)} style={{ flex: 1, background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}