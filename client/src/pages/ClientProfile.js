import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useRole } from '../hooks/useRole';
import TiptapEditor from '../components/TiptapEditor';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const CLIENT_STAGES = ['Onboarding', 'Active', 'Paused', 'Churned'];
const STAGE_COLORS = {
  'Onboarding': { bg: '#FFF3CD', color: '#856404' },
  'Active': { bg: '#D4EDDA', color: '#155724' },
  'Paused': { bg: '#FFE5D0', color: '#8B5E34' },
  'Churned': { bg: '#F8D7DA', color: '#721C24' },
};
const DOC_TYPES = ['Contract', 'Proposal', 'Invoice', 'NDA', 'Other'];
const DOC_STATUSES = ['Draft', 'Sent', 'Signed', 'Expired'];
const FINANCE_TYPES = ['Commission', 'Settlement', 'Refund', 'Fee', 'Other'];
const FINANCE_STATUSES = ['Pending', 'Completed', 'Failed'];
const MERGE_TAGS = [
  { tag: '{{first_name}}', label: 'First Name' },
  { tag: '{{last_name}}', label: 'Last Name' },
  { tag: '{{company_name}}', label: 'Company Name' },
  { tag: '{{sender_name}}', label: 'Sender Name' },
  { tag: '{{sender_email}}', label: 'Sender Email' },
  { tag: '{{city}}', label: 'City' },
  { tag: '{{stage}}', label: 'Stage' },
];

const AMENITIES_OPTIONS = ['Ceremony Area', 'Dressing Room', 'Indoor Event Space', 'Outdoor Event Space', 'Reception Area', 'Wireless Internet', 'Handicap Accessible', 'On-Site Accommodations', 'Liability Insurance', 'Covered Outdoors Space'];
const VENUE_TYPES = ['Backyard', 'Ballroom', 'Barn', 'Beach', 'Brewery & Distillery', 'Castle', 'City Hall', 'Country Club', 'Cruise', 'Desert', 'Estate', 'Garden', 'Historic Venue', 'Hotel', 'Industrial & Warehouse', 'Library', 'Loft', 'Mountain', 'Museum', 'Park', 'Religious Setting', 'Restaurant', 'Rooftop', 'Tented', 'Trees', 'Vineyard & Winery'];
const SERVICES_OPTIONS = ['Bar & Drinks', 'Cakes & Desserts', 'Destination Weddings', 'Food & Catering', 'Planning', 'Rental Equipment', 'Service Staff', 'Transportation'];
const CEREMONY_OPTIONS = ['Civil Union', 'Commitment Ceremony', 'Elopement', 'Interfaith Ceremony', 'Non-Religious Ceremony', 'Religious Ceremony', 'Second Wedding', 'Vow Renewal'];
const DIVERSITY_OPTIONS = ['Asian-owned', 'Black-owned', 'Hispanic or Latinx-owned', 'LGBTQ+-owned', 'Native American-owned', 'Pacific Islander-owned', 'Veteran-owned', 'Woman-owned'];
const GUEST_CAPACITIES = ['0-50', '51-100', '101-150', '151-200', '201-250', '251-300', '300+'];
const PRICE_TIERS = ['$', '$$', '$$$', '$$$$'];

function PeopleFromContact({ companyId, getHeaders }) {
  const [people, setPeople] = useState([]);
  useEffect(() => {
    const fetchPeople = async () => {
      try {
        const res = await axios.get(`${API}/contacts/companies/${companyId}`, { headers: getHeaders() });
        setPeople(res.data.crm_people || []);
      } catch (err) {}
    };
    fetchPeople();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  if (people.length === 0) return null;

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid rgba(62,66,61,0.1)', marginBottom: 16 }}>
      <h3 style={{ color: '#3E423D', fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>People ({people.length})</h3>
      {people.map(p => (
        <div key={p.id} style={{ background: '#F5F3EF', borderRadius: 10, padding: 12, marginBottom: 8 }}>
          <p style={{ color: '#3E423D', fontWeight: 600, margin: '0 0 2px', fontSize: 13 }}>{p.first_name} {p.last_name}</p>
          {p.title && <p style={{ color: '#717182', fontSize: 12, margin: '0 0 4px' }}>{p.title}</p>}
          {p.email && <p style={{ color: '#94B0BC', fontSize: 12, margin: '0 0 2px' }}>✉️ {p.email}</p>}
          {p.work_phone && <p style={{ color: '#5A6059', fontSize: 12, margin: '0 0 2px' }}>📞 {p.work_phone}</p>}
          {p.mobile_phone && <p style={{ color: '#5A6059', fontSize: 12, margin: 0 }}>📱 {p.mobile_phone}</p>}
        </div>
      ))}
    </div>
  );
}

export default function ClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role, can } = useRole();
  const isAdmin = role === 'admin';
  const canFinance = can('finance:general');

  const [client, setClient] = useState(null);
  const [activity, setActivity] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [vendorPage, setVendorPage] = useState({});
  const [finance, setFinance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [editField, setEditField] = useState(null);
  const [note, setNote] = useState('');
  const [showDocModal, setShowDocModal] = useState(false);
  const [docForm, setDocForm] = useState({ title: '', doc_type: 'Contract', status: 'Draft', file_url: '', notes: '' });
  const [editingDoc, setEditingDoc] = useState(null);
  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [financeForm, setFinanceForm] = useState({ type: 'Commission', amount: '', description: '', status: 'Pending', date: new Date().toISOString().split('T')[0] });
  const [editingFinance, setEditingFinance] = useState(null);
  const [savingVendorPage, setSavingVendorPage] = useState(false);

  // Email composer state
  const [showEmailStep1, setShowEmailStep1] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState(null);
  const [clientPeople, setClientPeople] = useState([]);
  const [showEmailStep2, setShowEmailStep2] = useState(false);
  const [emailForm, setEmailForm] = useState({ subject: '', body_html: '', signature_html: '' });
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [emailActiveField, setEmailActiveField] = useState('body');
  const [emailEditorTab, setEmailEditorTab] = useState('visual');
  const emailSubjectRef = useRef(null);
  const emailBodyRef = useRef(null);
  const [clientEmails, setClientEmails] = useState([]);
  const [contactEmailHistory, setContactEmailHistory] = useState([]);
  const [contactMarketingHistory, setContactMarketingHistory] = useState([]);
  const [clientEmailsPage, setClientEmailsPage] = useState(1);
  const [contactEmailsPage, setContactEmailsPage] = useState(1);
  const [campaignHistoryPage, setCampaignHistoryPage] = useState(1);
  const EMAIL_PAGE_SIZE = 5;

  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAll(); }, [id]);

  const fetchAll = async () => {
    try {
      const [clientRes, activityRes, docsRes, vpRes, finRes] = await Promise.all([
        axios.get(`${API}/clients/${id}`, { headers: getHeaders() }),
        axios.get(`${API}/clients/${id}/activity`, { headers: getHeaders() }),
        axios.get(`${API}/clients/${id}/documents`, { headers: getHeaders() }),
        axios.get(`${API}/clients/${id}/vendor-page`, { headers: getHeaders() }),
        canFinance ? axios.get(`${API}/clients/${id}/finance`, { headers: getHeaders() }) : Promise.resolve({ data: [] }),
      ]);
      setClient(clientRes.data);
      setActivity(activityRes.data);
      setDocuments(docsRes.data);
      setVendorPage(vpRes.data || {});
      setFinance(finRes.data);
      if (clientRes.data?.converted_from) fetchEmailHistory(clientRes.data.converted_from);
    } catch (err) { console.error(err); }
    fetchTemplates();
    setLoading(false);
  };

  const fetchEmailHistory = async (convertedFrom) => {
    try {
      // Emails sent from client profile (logged in activity as "Email sent to...")
      const { data: clientAct } = await axios.get(`${API}/clients/${id}/activity`, { headers: getHeaders() });
      const emailActivity = (clientAct || []).filter(a => a.details?.includes('Email sent to'));
      setClientEmails(emailActivity);

      // Emails from original contact
      if (convertedFrom) {
        const emailRes = await axios.get(`${API}/emails/sent/company/${convertedFrom}`, { headers: getHeaders() });
        setContactEmailHistory(emailRes.data || []);

        const mktRes = await axios.get(`${API}/marketing/company/${convertedFrom}`, { headers: getHeaders() });
        setContactMarketingHistory(mktRes.data || []);
      }
    } catch (err) { console.error(err); }
  };

  const fetchTemplates = async () => {
    try {
      const res = await axios.get(`${API}/emails/templates`, { headers: getHeaders() });
      setTemplates(res.data);
    } catch (err) {}
  };

  const updateField = async (field, value) => {
    try {
      await axios.put(`${API}/clients/${id}`, { [field]: value }, { headers: getHeaders() });
      setClient(prev => ({ ...prev, [field]: value }));
      setEditField(null);
    } catch (err) { console.error(err); }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    try {
      await axios.post(`${API}/clients/${id}/note`, { note }, { headers: getHeaders() });
      setNote('');
      const res = await axios.get(`${API}/clients/${id}/activity`, { headers: getHeaders() });
      setActivity(res.data);
    } catch (err) { console.error(err); }
  };

  const saveDocument = async () => {
    try {
      if (editingDoc) {
        await axios.put(`${API}/clients/documents/${editingDoc.id}`, docForm, { headers: getHeaders() });
      } else {
        await axios.post(`${API}/clients/${id}/documents`, docForm, { headers: getHeaders() });
      }
      setShowDocModal(false);
      setEditingDoc(null);
      setDocForm({ title: '', doc_type: 'Contract', status: 'Draft', file_url: '', notes: '' });
      const res = await axios.get(`${API}/clients/${id}/documents`, { headers: getHeaders() });
      setDocuments(res.data);
    } catch (err) { console.error(err); }
  };

  const deleteDocument = async (docId) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await axios.delete(`${API}/clients/documents/${docId}`, { headers: getHeaders() });
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch (err) { console.error(err); }
  };

  const saveFinanceEntry = async () => {
    try {
      if (editingFinance) {
        await axios.put(`${API}/clients/finance/${editingFinance.id}`, financeForm, { headers: getHeaders() });
      } else {
        await axios.post(`${API}/clients/${id}/finance`, financeForm, { headers: getHeaders() });
      }
      setShowFinanceModal(false);
      setEditingFinance(null);
      setFinanceForm({ type: 'Commission', amount: '', description: '', status: 'Pending', date: new Date().toISOString().split('T')[0] });
      const res = await axios.get(`${API}/clients/${id}/finance`, { headers: getHeaders() });
      setFinance(res.data);
    } catch (err) { console.error(err); }
  };

  const saveVendorPage = async () => {
    setSavingVendorPage(true);
    try {
      const res = await axios.put(`${API}/clients/${id}/vendor-page`, vendorPage, { headers: getHeaders() });
      setVendorPage(res.data);
    } catch (err) { console.error(err); }
    setSavingVendorPage(false);
  };

  const toggleArrayItem = (arr, item) => {
    const current = arr || [];
    return current.includes(item) ? current.filter(i => i !== item) : [...current, item];
  };

  // Email composer functions
  const openEmailComposer = async () => {
    setEmailForm({ subject: '', body_html: '', signature_html: '' });
    setSelectedTemplate(null);
    setEmailSuccess(false);
    setEmailEditorTab('visual');
    setEmailRecipient(null);
    // Fetch people from original company
    if (client.converted_from) {
      try {
        const res = await axios.get(`${API}/contacts/companies/${client.converted_from}`, { headers: getHeaders() });
        setClientPeople(res.data.crm_people || []);
      } catch (err) { setClientPeople([]); }
    } else {
      setClientPeople([]);
    }
    setShowEmailStep1(true);
  };

  const selectTemplate = (template) => {
    setSelectedTemplate(template);
    setEmailForm(prev => ({
      ...prev,
      subject: template ? template.subject : '',
      body_html: template ? template.body_html : '',
      signature_html: template ? template.signature_html : '',
    }));
  };

  const resolveTags = (html) => {
    if (!html) return '';
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return html
      .replace(/{{first_name}}/g, client?.contact_first_name || '')
      .replace(/{{last_name}}/g, client?.contact_last_name || '')
      .replace(/{{company_name}}/g, client?.business_name || '')
      .replace(/{{sender_name}}/g, user?.full_name || user?.name || '')
      .replace(/{{sender_email}}/g, user?.email || '')
      .replace(/{{city}}/g, client?.city || '')
      .replace(/{{stage}}/g, client?.stage || '');
  };

  const insertEmailTag = (tag) => {
    if (emailActiveField === 'subject') {
      const input = emailSubjectRef.current;
      if (!input) return;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const newVal = emailForm.subject.substring(0, start) + tag + emailForm.subject.substring(end);
      setEmailForm(prev => ({ ...prev, subject: newVal }));
      setTimeout(() => { input.focus(); input.selectionStart = input.selectionEnd = start + tag.length; }, 0);
    } else {
      if (emailEditorTab === 'html') {
        const textarea = emailBodyRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newVal = emailForm.body_html.substring(0, start) + tag + emailForm.body_html.substring(end);
        setEmailForm(prev => ({ ...prev, body_html: newVal }));
        setTimeout(() => { textarea.focus(); textarea.selectionStart = textarea.selectionEnd = start + tag.length; }, 0);
      } else {
        setEmailForm(prev => {
          const current = prev.body_html || '';
          const updated = current.replace(/<\/p>\s*$/, tag + '</p>') !== current
            ? current.replace(/<\/p>\s*$/, tag + '</p>')
            : current + tag;
          return { ...prev, body_html: updated };
        });
      }
    }
  };

  const sendClientEmail = async () => {
    if (!emailForm.subject || !emailForm.body_html) return;
    setSavingEmail(true);
    const resolvedBody = resolveTags(emailForm.body_html) + (emailForm.signature_html ? '<br><br><div style="margin-top:16px;padding-top:12px;border-top:1px solid #e0e0e0;">' + resolveTags(emailForm.signature_html) + '</div>' : '');
    try {
      await axios.post(`${API}/emails/send`, {
        company_id: client.converted_from || null,
        person_id: null,
        template_id: selectedTemplate?.id || null,
        subject: resolveTags(emailForm.subject),
        body_html: resolvedBody,
        recipient_email: emailRecipient?.email || client.contact_email,
        recipient_name: emailRecipient?.name || `${client.contact_first_name} ${client.contact_last_name}`,
      }, { headers: getHeaders() });
      await axios.post(`${API}/clients/${id}/note`, { note: `Email sent to ${emailRecipient?.email || client.contact_email}: "${emailForm.subject}"` }, { headers: getHeaders() });
      setEmailSuccess(true);
      setTimeout(() => { setShowEmailStep2(false); setEmailSuccess(false); setEmailForm({ subject: '', body_html: '', signature_html: '' }); fetchAll(); }, 2000);
    } catch (err) { console.error(err); alert('Send failed.'); }
    setSavingEmail(false);
  };

  const inputStyle = { width: '100%', background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '9px 12px', color: '#3E423D', fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 5 };

  if (loading) return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 240, flex: 1, padding: 40, color: '#717182' }}>Loading...</div>
    </div>
  );

  if (!client) return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 240, flex: 1, padding: 40, color: '#717182' }}>Client not found</div>
    </div>
  );

  const totalFinance = finance.reduce((acc, f) => acc + (parseFloat(f.amount) || 0), 0);
  const pendingFinance = finance.filter(f => f.status === 'Pending').reduce((acc, f) => acc + (parseFloat(f.amount) || 0), 0);

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 240, flex: 1, padding: 40 }}>

        <button onClick={() => navigate('/clients')} style={{ background: 'none', border: 'none', color: '#8E9B8B', fontSize: 13, cursor: 'pointer', marginBottom: 8, padding: 0 }}>← Back to Clients</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>{client.category} · {client.business_type || 'Venue'}</p>
            <h1 style={{ color: '#3E423D', fontSize: 28, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>{client.business_name}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {client.contact_email && (
              <button onClick={openEmailComposer}
                style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
                📧 Send Email
              </button>
            )}
            {client.converted_from && (
              <button onClick={() => navigate(`/contacts/${client.converted_from}`)}
                style={{ background: '#F5F3EF', color: '#717182', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>
                📋 View Original Contact
              </button>
            )}
          </div>
        </div>

        {/* Stage Stepper */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {CLIENT_STAGES.map(stage => {
            const stc = STAGE_COLORS[stage];
            const isActive = client.stage === stage;
            return (
              <button key={stage} onClick={() => isAdmin && updateField('stage', stage)}
                style={{ background: isActive ? stc.color : '#fff', color: isActive ? '#fff' : stc.color, border: `1px solid ${stc.color}`, borderRadius: 20, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: isAdmin ? 'pointer' : 'default' }}>
                {stage}
              </button>
            );
          })}
        </div>

        {/* Info Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
          {[
{ label: 'Contract', value: client.contract_type === 'Subscription' ? `${client.contract_type} · $${client.contract_amount || 0}/mo` : client.contract_type === 'RevShare' ? `${client.contract_type} · $${client.contract_amount || 0} + ${client.commission_rate}%` : `${client.contract_type} · ${client.commission_rate}%` },

            { label: 'Contact', value: `${client.contact_first_name} ${client.contact_last_name}` },
            { label: 'Location', value: `${client.city || ''}${client.state ? `, ${client.state}` : ''}` || '—' },
            { label: 'Assigned To', value: client.crm_users?.name || '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#fff', borderRadius: 10, padding: 16, border: '1px solid rgba(62,66,61,0.1)' }}>
              <p style={{ color: '#717182', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>{label}</p>
              <p style={{ color: '#3E423D', fontSize: 14, fontWeight: 500, margin: 0 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(62,66,61,0.1)', marginBottom: 24 }}>
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'activity', label: `Activity (${activity.length})` },
            { key: 'documents', label: `Documents (${documents.length})` },
            { key: 'emails', label: `Emails (${clientEmails.length + contactEmailHistory.length + contactMarketingHistory.length})` },
            { key: 'vendor-page', label: 'Vendor Page' },
            ...(canFinance ? [{ key: 'finance', label: `Finance (${finance.length})` }] : []),
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ background: 'none', border: 'none', borderBottom: activeTab === tab.key ? '2px solid #8E9B8B' : '2px solid transparent', padding: '12px 20px', fontSize: 14, color: activeTab === tab.key ? '#3E423D' : '#717182', fontWeight: activeTab === tab.key ? 600 : 400, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              {tab.label}
            </button>
          ))}
        </div>

{/* ─── OVERVIEW TAB ─── */}
{activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 28, border: '1px solid rgba(62,66,61,0.1)' }}>
              <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>Contact Info</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 16px', marginBottom: 20 }}>
                {[
                  { field: 'business_name', label: 'Business Name' },
                  { field: 'contact_email', label: 'Email' },
                  { field: 'contact_phone', label: 'Phone' },
                  { field: 'address', label: 'Address' },
                  { field: 'city', label: 'City' },
                  { field: 'state', label: 'State' },
                ].map(({ field, label }) => (
                  <div key={field}>
                    <label style={labelStyle}>{label}</label>
                    {editField === field ? (
                      <input type="text" value={client[field] || ''} onChange={e => setClient(prev => ({ ...prev, [field]: e.target.value }))}
                        onBlur={e => updateField(field, e.target.value)} onKeyDown={e => e.key === 'Enter' && updateField(field, e.target.value)}
                        autoFocus style={inputStyle} />
                    ) : (
                      <p onClick={() => isAdmin && setEditField(field)}
                        style={{ color: client[field] ? '#1a1d1a' : '#CBCED4', fontSize: 13, fontWeight: client[field] ? 500 : 400, margin: 0, padding: '6px 10px', background: '#F5F3EF', borderRadius: 6, cursor: isAdmin ? 'pointer' : 'default' }}>
                        {client[field] || '—'}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>Business</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 16px', marginBottom: 20 }}>
                {[
                  { field: 'category', label: 'Category' },
                  { field: 'business_type', label: 'Business Type' },
                  { field: 'website', label: 'Website' },
                ].map(({ field, label }) => (
                  <div key={field}>
                    <label style={labelStyle}>{label}</label>
                    {editField === field ? (
                      <input type="text" value={client[field] || ''} onChange={e => setClient(prev => ({ ...prev, [field]: e.target.value }))}
                        onBlur={e => updateField(field, e.target.value)} onKeyDown={e => e.key === 'Enter' && updateField(field, e.target.value)}
                        autoFocus style={inputStyle} />
                    ) : (
                      <p onClick={() => isAdmin && setEditField(field)}
                        style={{ color: client[field] ? '#1a1d1a' : '#CBCED4', fontSize: 13, fontWeight: client[field] ? 500 : 400, margin: 0, padding: '6px 10px', background: '#F5F3EF', borderRadius: 6, cursor: isAdmin ? 'pointer' : 'default' }}>
                        {client[field] || '—'}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>Contract</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 16px', marginBottom: 20 }}>
                <div>
                  <label style={labelStyle}>Contract Type</label>
                  {editField === 'contract_type' ? (
                    <select value={client.contract_type || ''} onChange={e => updateField('contract_type', e.target.value)} onBlur={() => setEditField(null)} autoFocus style={inputStyle}>
                      <option value="RevShare">RevShare ($ + %)</option>
                      <option value="Commission">Commission (%)</option>
                      <option value="Subscription">Subscription ($/month)</option>
                    </select>
                  ) : (
                    <p onClick={() => isAdmin && setEditField('contract_type')}
                      style={{ color: '#1a1d1a', fontSize: 13, fontWeight: 500, margin: 0, padding: '6px 10px', background: '#F5F3EF', borderRadius: 6, cursor: isAdmin ? 'pointer' : 'default' }}>
                      {client.contract_type || '—'}
                    </p>
                  )}
                </div>
                {(client.contract_type === 'RevShare' || client.contract_type === 'Commission') && (
                  <div>
                    <label style={labelStyle}>{client.contract_type === 'RevShare' ? 'Revenue Share (%)' : 'Commission Rate (%)'}</label>
                    {editField === 'commission_rate' ? (
                      <input type="number" value={client.commission_rate || ''} onChange={e => setClient(prev => ({ ...prev, commission_rate: e.target.value }))}
                        onBlur={e => updateField('commission_rate', e.target.value)} onKeyDown={e => e.key === 'Enter' && updateField('commission_rate', e.target.value)}
                        autoFocus style={inputStyle} />
                    ) : (
                      <p onClick={() => isAdmin && setEditField('commission_rate')}
                        style={{ color: '#1a1d1a', fontSize: 13, fontWeight: 500, margin: 0, padding: '6px 10px', background: '#F5F3EF', borderRadius: 6, cursor: isAdmin ? 'pointer' : 'default' }}>
                        {client.commission_rate ? `${client.commission_rate}%` : '—'}
                      </p>
                    )}
                  </div>
                )}
                {(client.contract_type === 'RevShare' || client.contract_type === 'Subscription') && (
                  <div>
                    <label style={labelStyle}>{client.contract_type === 'RevShare' ? 'Base Amount ($)' : 'Monthly Amount ($)'}</label>
                    {editField === 'contract_amount' ? (
                      <input type="number" value={client.contract_amount || ''} onChange={e => setClient(prev => ({ ...prev, contract_amount: e.target.value }))}
                        onBlur={e => updateField('contract_amount', e.target.value)} onKeyDown={e => e.key === 'Enter' && updateField('contract_amount', e.target.value)}
                        autoFocus style={inputStyle} />
                    ) : (
                      <p onClick={() => isAdmin && setEditField('contract_amount')}
                        style={{ color: '#1a1d1a', fontSize: 13, fontWeight: 500, margin: 0, padding: '6px 10px', background: '#F5F3EF', borderRadius: 6, cursor: isAdmin ? 'pointer' : 'default' }}>
                        {client.contract_amount ? `$${client.contract_amount}` : '—'}
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <label style={labelStyle}>Contract Signed</label>
                  {editField === 'contract_signed_date' ? (
                    <input type="date" value={client.contract_signed_date || ''} onChange={e => setClient(prev => ({ ...prev, contract_signed_date: e.target.value }))}
                      onBlur={e => updateField('contract_signed_date', e.target.value)}
                      autoFocus style={inputStyle} />
                  ) : (
                    <p onClick={() => isAdmin && setEditField('contract_signed_date')}
                      style={{ color: client.contract_signed_date ? '#1a1d1a' : '#CBCED4', fontSize: 13, fontWeight: client.contract_signed_date ? 500 : 400, margin: 0, padding: '6px 10px', background: '#F5F3EF', borderRadius: 6, cursor: isAdmin ? 'pointer' : 'default' }}>
                      {client.contract_signed_date || '—'}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div>
              {client.converted_from && <PeopleFromContact companyId={client.converted_from} getHeaders={getHeaders} />}
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid rgba(62,66,61,0.1)', marginBottom: 16 }}>
                <h3 style={{ color: '#3E423D', fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Quick Note</h3>
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note..." rows={3} style={{ ...inputStyle, marginBottom: 8, resize: 'vertical' }} />
                <button onClick={addNote} disabled={!note.trim()} style={{ background: note.trim() ? '#8E9B8B' : '#D5CEC0', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: note.trim() ? 'pointer' : 'default', width: '100%' }}>Add Note</button>
              </div>
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid rgba(62,66,61,0.1)' }}>
                <h3 style={{ color: '#3E423D', fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Recent Notes</h3>
                {activity.filter(a => a.action === 'Note Added').slice(0, 3).map(a => (
                  <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(62,66,61,0.06)' }}>
                    <p style={{ color: '#3E423D', fontSize: 12, margin: '0 0 2px' }}>{a.details}</p>
                    <p style={{ color: '#CBCED4', fontSize: 10, margin: 0 }}>{new Date(a.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
                {activity.filter(a => a.action === 'Note Added').length === 0 && <p style={{ color: '#CBCED4', fontSize: 12, margin: 0 }}>No notes yet</p>}
              </div>
            </div>
          </div>
        )}

{/* ─── EMAILS TAB ─── */}
{activeTab === 'emails' && (
          <div>
            {/* Client Emails Section */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden', marginBottom: 24 }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(62,66,61,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: '#D4EDDA', color: '#155724', fontSize: 10, borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>Client</span>
                <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: 0 }}>Emails Since Conversion ({clientEmails.length})</h3>
              </div>
              {clientEmails.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <p style={{ color: '#CBCED4', fontSize: 13, margin: 0 }}>No emails sent since conversion</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: '#F5F3EF' }}>
                    {['Details', 'Date'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#717182', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                  {clientEmails.slice((clientEmailsPage - 1) * EMAIL_PAGE_SIZE, clientEmailsPage * EMAIL_PAGE_SIZE).map((e, i) => (
                      <tr key={e.id} style={{ borderTop: '1px solid rgba(62,66,61,0.06)', background: i % 2 === 0 ? '#fff' : '#FAFAF9' }}>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#3E423D' }}>{e.details}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#717182' }}>{new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
              )}
              {clientEmails.length > EMAIL_PAGE_SIZE && (
                <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(62,66,61,0.06)', display: 'flex', justifyContent: 'center', gap: 6 }}>
                  <button onClick={() => setClientEmailsPage(p => Math.max(1, p - 1))} disabled={clientEmailsPage === 1} style={{ background: 'none', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: clientEmailsPage === 1 ? 'default' : 'pointer', opacity: clientEmailsPage === 1 ? 0.4 : 1 }}>←</button>
                  <span style={{ color: '#717182', fontSize: 12, padding: '4px 8px' }}>{clientEmailsPage}/{Math.ceil(clientEmails.length / EMAIL_PAGE_SIZE)}</span>
                  <button onClick={() => setClientEmailsPage(p => Math.min(Math.ceil(clientEmails.length / EMAIL_PAGE_SIZE), p + 1))} disabled={clientEmailsPage >= Math.ceil(clientEmails.length / EMAIL_PAGE_SIZE)} style={{ background: 'none', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: clientEmailsPage >= Math.ceil(clientEmails.length / EMAIL_PAGE_SIZE) ? 'default' : 'pointer', opacity: clientEmailsPage >= Math.ceil(clientEmails.length / EMAIL_PAGE_SIZE) ? 0.4 : 1 }}>→</button>
                </div>
              )}
            </div>

            {/* Contact History Section */}
            {client.converted_from && (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden', marginBottom: 24 }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(62,66,61,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ background: '#EBF4FF', color: '#1a6fad', fontSize: 10, borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>Contact History</span>
                  <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: 0 }}>Direct Emails Before Conversion ({contactEmailHistory.length})</h3>
                </div>
                {contactEmailHistory.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center' }}>
                    <p style={{ color: '#CBCED4', fontSize: 13, margin: 0 }}>No direct emails in contact history</p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#F5F3EF' }}>
                      {['Subject', 'Recipient', 'Sent', 'Status'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#717182', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                    {contactEmailHistory.slice((contactEmailsPage - 1) * EMAIL_PAGE_SIZE, contactEmailsPage * EMAIL_PAGE_SIZE).map((e, i) => (
                        <tr key={e.id} style={{ borderTop: '1px solid rgba(62,66,61,0.06)', background: i % 2 === 0 ? '#fff' : '#FAFAF9' }}>
                          <td style={{ padding: '12px 16px', fontSize: 13, color: '#3E423D', fontWeight: 500 }}>{e.subject || '(no subject)'}</td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: '#717182' }}>{e.crm_people ? `${e.crm_people.first_name} ${e.crm_people.last_name}` : '—'}</td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: '#717182' }}>{e.sent_at ? new Date(e.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              background: e.email_status === 'opened' || e.email_status === 'clicked' ? '#E8F5E9' : e.email_status === 'bounced' ? '#FFEBEE' : e.email_status === 'delivered' ? '#E3F2FD' : '#F5F3EF',
                              color: e.email_status === 'opened' || e.email_status === 'clicked' ? '#2E7D32' : e.email_status === 'bounced' ? '#C62828' : e.email_status === 'delivered' ? '#1565C0' : '#717182',
                              borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize'
                            }}>{e.email_status || e.status || '—'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    </table>
                )}
                {contactEmailHistory.length > EMAIL_PAGE_SIZE && (
                  <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(62,66,61,0.06)', display: 'flex', justifyContent: 'center', gap: 6 }}>
                    <button onClick={() => setContactEmailsPage(p => Math.max(1, p - 1))} disabled={contactEmailsPage === 1} style={{ background: 'none', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: contactEmailsPage === 1 ? 'default' : 'pointer', opacity: contactEmailsPage === 1 ? 0.4 : 1 }}>←</button>
                    <span style={{ color: '#717182', fontSize: 12, padding: '4px 8px' }}>{contactEmailsPage}/{Math.ceil(contactEmailHistory.length / EMAIL_PAGE_SIZE)}</span>
                    <button onClick={() => setContactEmailsPage(p => Math.min(Math.ceil(contactEmailHistory.length / EMAIL_PAGE_SIZE), p + 1))} disabled={contactEmailsPage >= Math.ceil(contactEmailHistory.length / EMAIL_PAGE_SIZE)} style={{ background: 'none', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: contactEmailsPage >= Math.ceil(contactEmailHistory.length / EMAIL_PAGE_SIZE) ? 'default' : 'pointer', opacity: contactEmailsPage >= Math.ceil(contactEmailHistory.length / EMAIL_PAGE_SIZE) ? 0.4 : 1 }}>→</button>
                  </div>
                )}
              </div>
            )}

            {/* Campaign History Section */}
            {client.converted_from && contactMarketingHistory.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(62,66,61,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ background: '#F3E8FF', color: '#7C3AED', fontSize: 10, borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>Campaign History</span>
                  <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: 0 }}>Campaigns Before Conversion ({contactMarketingHistory.length})</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: '#F5F3EF' }}>
                    {['Campaign', 'Recipient', 'Sent', 'Status', 'Opened', 'Clicked'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#717182', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                  {contactMarketingHistory.slice((campaignHistoryPage - 1) * EMAIL_PAGE_SIZE, campaignHistoryPage * EMAIL_PAGE_SIZE).map((r, i) => (
                      <tr key={r.id} style={{ borderTop: '1px solid rgba(62,66,61,0.06)', background: i % 2 === 0 ? '#fff' : '#FAFAF9' }}>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#3E423D', fontWeight: 500 }}>{r.crm_campaigns?.name || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#5A6059' }}>{r.crm_people ? `${r.crm_people.first_name} ${r.crm_people.last_name}` : r.email || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#717182' }}>{r.crm_campaigns?.sent_at ? new Date(r.crm_campaigns.sent_at).toLocaleDateString() : '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: r.status === 'opened' || r.status === 'clicked' ? '#D4EDDA' : r.status === 'bounced' ? '#F8D7DA' : '#F5F3EF',
                            color: r.status === 'opened' || r.status === 'clicked' ? '#155724' : r.status === 'bounced' ? '#721C24' : '#717182',
                            borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize'
                          }}>{r.status}</span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#717182' }}>{r.opened_at ? new Date(r.opened_at).toLocaleDateString() : '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#717182' }}>{r.clicked_at ? new Date(r.clicked_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                {contactMarketingHistory.length > EMAIL_PAGE_SIZE && (
                  <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(62,66,61,0.06)', display: 'flex', justifyContent: 'center', gap: 6 }}>
                    <button onClick={() => setCampaignHistoryPage(p => Math.max(1, p - 1))} disabled={campaignHistoryPage === 1} style={{ background: 'none', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: campaignHistoryPage === 1 ? 'default' : 'pointer', opacity: campaignHistoryPage === 1 ? 0.4 : 1 }}>←</button>
                    <span style={{ color: '#717182', fontSize: 12, padding: '4px 8px' }}>{campaignHistoryPage}/{Math.ceil(contactMarketingHistory.length / EMAIL_PAGE_SIZE)}</span>
                    <button onClick={() => setCampaignHistoryPage(p => Math.min(Math.ceil(contactMarketingHistory.length / EMAIL_PAGE_SIZE), p + 1))} disabled={campaignHistoryPage >= Math.ceil(contactMarketingHistory.length / EMAIL_PAGE_SIZE)} style={{ background: 'none', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: campaignHistoryPage >= Math.ceil(contactMarketingHistory.length / EMAIL_PAGE_SIZE) ? 'default' : 'pointer', opacity: campaignHistoryPage >= Math.ceil(contactMarketingHistory.length / EMAIL_PAGE_SIZE) ? 0.4 : 1 }}>→</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── ACTIVITY TAB ─── */}
        {activeTab === 'activity' && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.1)' }}>
            {activity.length === 0 ? (
              <p style={{ color: '#CBCED4', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>No activity yet</p>
            ) : activity.map(a => (
              <div key={a.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(62,66,61,0.06)', alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F5F3EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                  {a.action === 'Note Added' ? '📌' : a.action === 'Client Created' ? '🤝' : a.action === 'Document Added' ? '📄' : a.action === 'Transaction Added' ? '💰' : a.action === 'Vendor Page Updated' ? '🌐' : '📋'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ color: '#3E423D', fontSize: 13, fontWeight: 500 }}>{a.crm_users?.name || '—'}</span>
                    <span style={{ background: '#F5F3EF', color: '#717182', fontSize: 10, borderRadius: 20, padding: '1px 8px' }}>{a.action}</span>
                  </div>
                  <p style={{ color: '#717182', fontSize: 12, margin: 0 }}>{a.details}</p>
                </div>
                <span style={{ color: '#CBCED4', fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        )}

        {/* ─── DOCUMENTS TAB ─── */}
        {activeTab === 'documents' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              {isAdmin && <button onClick={() => { setEditingDoc(null); setDocForm({ title: '', doc_type: 'Contract', status: 'Draft', file_url: '', notes: '' }); setShowDocModal(true); }} style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, cursor: 'pointer' }}>+ Add Document</button>}
            </div>
            {documents.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 12, padding: 60, textAlign: 'center', border: '1px solid rgba(62,66,61,0.1)' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
                <p style={{ color: '#3E423D', fontSize: 16, fontWeight: 500, margin: '0 0 8px' }}>No documents yet</p>
                <p style={{ color: '#717182', fontSize: 13, margin: 0 }}>Add contracts, proposals, or invoices</p>
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: '#F5F3EF' }}>{['Title', 'Type', 'Status', 'Signed', 'Expires', 'By', 'Date', ''].map(h => (<th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#717182', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>))}</tr></thead>
                  <tbody>{documents.map((d, i) => (
                    <tr key={d.id} style={{ borderTop: '1px solid rgba(62,66,61,0.06)', background: i % 2 === 0 ? '#fff' : '#FAFAF9' }}>
<td style={{ padding: '12px 16px', fontSize: 13, color: '#3E423D', fontWeight: 500 }}>
                        {d.file_url ? <a href={d.file_url} target="_blank" rel="noreferrer" style={{ color: '#3E423D', textDecoration: 'none' }}>{d.title} 📎</a> : d.title}
                      </td>                      <td style={{ padding: '12px 16px' }}><span style={{ background: '#F5F3EF', color: '#717182', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>{d.doc_type}</span></td>
                      <td style={{ padding: '12px 16px' }}><span style={{ background: d.status === 'Signed' ? '#D4EDDA' : d.status === 'Expired' ? '#F8D7DA' : '#F5F3EF', color: d.status === 'Signed' ? '#155724' : d.status === 'Expired' ? '#721C24' : '#717182', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>{d.status}</span></td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#717182' }}>{d.signed_date ? new Date(d.signed_date).toLocaleDateString() : '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#717182' }}>{d.expires_date ? new Date(d.expires_date).toLocaleDateString() : '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#717182' }}>{d.crm_users?.name || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#CBCED4' }}>{new Date(d.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 16px' }}>{isAdmin && (<div style={{ display: 'flex', gap: 6 }}><button onClick={() => { setEditingDoc(d); setDocForm({ title: d.title, doc_type: d.doc_type, status: d.status, file_url: d.file_url || '', notes: d.notes || '', signed_date: d.signed_date || '', expires_date: d.expires_date || '' }); setShowDocModal(true); }} style={{ background: '#F5F3EF', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', color: '#5A6059' }}>Edit</button><button onClick={() => deleteDocument(d.id)} style={{ background: '#fdf0f0', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', color: '#D4183D' }}>Del</button></div>)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── VENDOR PAGE TAB ─── */}
        {activeTab === 'vendor-page' && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, border: '1px solid rgba(62,66,61,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: 0 }}>Marketplace Listing</h3>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: vendorPage.published ? '#155724' : '#717182' }}>
                  <input type="checkbox" checked={vendorPage.published || false} onChange={e => setVendorPage(prev => ({ ...prev, published: e.target.checked }))} style={{ accentColor: '#8E9B8B' }} />
                  {vendorPage.published ? '🟢 Published' : 'Unpublished'}
                </label>
                <button onClick={saveVendorPage} disabled={savingVendorPage} style={{ background: savingVendorPage ? '#A5B2A3' : '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer' }}>{savingVendorPage ? 'Saving...' : '💾 Save'}</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 16px' }}>
              <div><label style={labelStyle}>Display Name</label><input value={vendorPage.display_name || ''} onChange={e => setVendorPage(prev => ({ ...prev, display_name: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Tagline</label><input value={vendorPage.tagline || ''} onChange={e => setVendorPage(prev => ({ ...prev, tagline: e.target.value }))} style={inputStyle} placeholder="e.g. A luxury barn experience..." /></div>
              <div><label style={labelStyle}>Venue Type</label><select value={vendorPage.venue_type || ''} onChange={e => setVendorPage(prev => ({ ...prev, venue_type: e.target.value }))} style={inputStyle}><option value="">Select...</option>{VENUE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
              <div><label style={labelStyle}>Guest Capacity</label><select value={vendorPage.guest_capacity || ''} onChange={e => setVendorPage(prev => ({ ...prev, guest_capacity: e.target.value }))} style={inputStyle}><option value="">Select...</option>{GUEST_CAPACITIES.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
              <div><label style={labelStyle}>Price Tier</label><select value={vendorPage.price_tier || ''} onChange={e => setVendorPage(prev => ({ ...prev, price_tier: e.target.value }))} style={inputStyle}>{PRICE_TIERS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
            </div>
            <div style={{ marginBottom: 24 }}><label style={labelStyle}>About</label><textarea value={vendorPage.about || ''} onChange={e => setVendorPage(prev => ({ ...prev, about: e.target.value }))} rows={4} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Describe the venue..." /></div>
            {[
              { label: 'Amenities', field: 'amenities', options: AMENITIES_OPTIONS },
              { label: 'Services', field: 'services', options: SERVICES_OPTIONS },
              { label: 'Ceremony Types', field: 'ceremony_types', options: CEREMONY_OPTIONS },
              { label: 'Diversity Tags', field: 'diversity_tags', options: DIVERSITY_OPTIONS },
            ].map(({ label, field, options }) => (
              <div key={field} style={{ marginBottom: 20 }}>
                <label style={labelStyle}>{label}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {options.map(opt => { const selected = (vendorPage[field] || []).includes(opt); return (
                    <button key={opt} onClick={() => setVendorPage(prev => ({ ...prev, [field]: toggleArrayItem(prev[field], opt) }))} style={{ background: selected ? '#8E9B8B' : '#fff', color: selected ? '#fff' : '#5A6059', border: `1px solid ${selected ? '#8E9B8B' : 'rgba(62,66,61,0.15)'}`, borderRadius: 20, padding: '5px 14px', fontSize: 12, cursor: 'pointer' }}>{opt}</button>
                  ); })}
                </div>
              </div>
            ))}
            <div style={{ marginBottom: 20 }}><label style={labelStyle}>Social Links</label><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{['instagram', 'facebook', 'website', 'tiktok'].map(platform => (<div key={platform}><label style={{ ...labelStyle, fontSize: 10 }}>{platform}</label><input value={vendorPage.social_links?.[platform] || ''} onChange={e => setVendorPage(prev => ({ ...prev, social_links: { ...(prev.social_links || {}), [platform]: e.target.value } }))} style={inputStyle} placeholder={`https://${platform}.com/...`} /></div>))}</div></div>
          </div>
        )}

        {/* ─── FINANCE TAB ─── */}
        {activeTab === 'finance' && canFinance && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid rgba(62,66,61,0.1)' }}><p style={{ color: '#717182', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Total Earned</p><p style={{ color: '#8E9B8B', fontSize: 28, fontWeight: 700, margin: 0, fontFamily: 'Playfair Display, Georgia, serif' }}>${totalFinance.toLocaleString()}</p></div>
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid rgba(62,66,61,0.1)' }}><p style={{ color: '#717182', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Pending</p><p style={{ color: '#D4A574', fontSize: 28, fontWeight: 700, margin: 0, fontFamily: 'Playfair Display, Georgia, serif' }}>${pendingFinance.toLocaleString()}</p></div>
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid rgba(62,66,61,0.1)' }}><p style={{ color: '#717182', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Transactions</p><p style={{ color: '#3E423D', fontSize: 28, fontWeight: 700, margin: 0, fontFamily: 'Playfair Display, Georgia, serif' }}>{finance.length}</p></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}><button onClick={() => { setEditingFinance(null); setFinanceForm({ type: 'Commission', amount: '', description: '', status: 'Pending', date: new Date().toISOString().split('T')[0] }); setShowFinanceModal(true); }} style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, cursor: 'pointer' }}>+ Add Transaction</button></div>
            {finance.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 12, padding: 60, textAlign: 'center', border: '1px solid rgba(62,66,61,0.1)' }}><div style={{ fontSize: 48, marginBottom: 16 }}>💰</div><p style={{ color: '#3E423D', fontSize: 16, fontWeight: 500, margin: '0 0 8px' }}>No transactions yet</p></div>
            ) : (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: '#F5F3EF' }}>{['Type', 'Amount', 'Description', 'Status', 'Date', 'By', ''].map(h => (<th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#717182', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>))}</tr></thead>
                  <tbody>{finance.map((f, i) => (
                    <tr key={f.id} style={{ borderTop: '1px solid rgba(62,66,61,0.06)', background: i % 2 === 0 ? '#fff' : '#FAFAF9' }}>
                      <td style={{ padding: '12px 16px' }}><span style={{ background: '#F5F3EF', color: '#717182', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>{f.type}</span></td>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: f.type === 'Refund' ? '#D4183D' : '#8E9B8B', fontWeight: 600 }}>${parseFloat(f.amount).toLocaleString()}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#5A6059' }}>{f.description || '—'}</td>
                      <td style={{ padding: '12px 16px' }}><span style={{ background: f.status === 'Completed' ? '#D4EDDA' : f.status === 'Failed' ? '#F8D7DA' : '#FFF3CD', color: f.status === 'Completed' ? '#155724' : f.status === 'Failed' ? '#721C24' : '#856404', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>{f.status}</span></td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#717182' }}>{new Date(f.date).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#717182' }}>{f.crm_users?.name || '—'}</td>
                      <td style={{ padding: '12px 16px' }}><button onClick={() => { setEditingFinance(f); setFinanceForm({ type: f.type, amount: f.amount, description: f.description || '', status: f.status, date: f.date }); setShowFinanceModal(true); }} style={{ background: '#F5F3EF', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', color: '#5A6059' }}>Edit</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── MODALS ─── */}

        {/* Document Modal */}
        {showDocModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(62,66,61,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 500, boxShadow: '0 20px 60px rgba(62,66,61,0.2)' }}>
              <h2 style={{ color: '#3E423D', fontSize: 18, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 20px' }}>{editingDoc ? 'Edit Document' : 'Add Document'}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div><label style={labelStyle}>Title *</label><input value={docForm.title} onChange={e => setDocForm(prev => ({ ...prev, title: e.target.value }))} style={inputStyle} placeholder="e.g. Service Agreement 2026" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={labelStyle}>Type</label><select value={docForm.doc_type} onChange={e => setDocForm(prev => ({ ...prev, doc_type: e.target.value }))} style={inputStyle}>{DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                  <div><label style={labelStyle}>Status</label><select value={docForm.status} onChange={e => setDocForm(prev => ({ ...prev, status: e.target.value }))} style={inputStyle}>{DOC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={labelStyle}>Signed Date</label><input type="date" value={docForm.signed_date || ''} onChange={e => setDocForm(prev => ({ ...prev, signed_date: e.target.value }))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Expires Date</label><input type="date" value={docForm.expires_date || ''} onChange={e => setDocForm(prev => ({ ...prev, expires_date: e.target.value }))} style={inputStyle} /></div>
                </div>
                <div>
                  <label style={labelStyle}>Document File</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const formData = new FormData();
                        formData.append('file', file);
                        try {
                          const res = await axios.post(`${API}/uploads/client-documents`, formData, {
                            headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' }
                          });
                          setDocForm(prev => ({ ...prev, file_url: res.data.url }));
                        } catch (err) { console.error(err); alert('Upload failed'); }
                      }}
                      style={{ fontSize: 12, flex: 1 }}
                    />
                    {docForm.file_url && <a href={docForm.file_url} target="_blank" rel="noreferrer" style={{ color: '#94B0BC', fontSize: 12 }}>View file</a>}
                  </div>
                  {!docForm.file_url && <input value={docForm.file_url || ''} onChange={e => setDocForm(prev => ({ ...prev, file_url: e.target.value }))} style={{ ...inputStyle, marginTop: 6 }} placeholder="Or paste URL manually..." />}
                </div>                <div><label style={labelStyle}>Notes</label><textarea value={docForm.notes} onChange={e => setDocForm(prev => ({ ...prev, notes: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button onClick={saveDocument} disabled={!docForm.title} style={{ flex: 1, background: docForm.title ? '#8E9B8B' : '#D5CEC0', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, cursor: docForm.title ? 'pointer' : 'default' }}>{editingDoc ? 'Save Changes' : 'Add Document'}</button>
                <button onClick={() => { setShowDocModal(false); setEditingDoc(null); }} style={{ flex: 1, background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Finance Modal */}
        {showFinanceModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(62,66,61,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 500, boxShadow: '0 20px 60px rgba(62,66,61,0.2)' }}>
              <h2 style={{ color: '#3E423D', fontSize: 18, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 20px' }}>{editingFinance ? 'Edit Transaction' : 'Add Transaction'}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={labelStyle}>Type</label><select value={financeForm.type} onChange={e => setFinanceForm(prev => ({ ...prev, type: e.target.value }))} style={inputStyle}>{FINANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                  <div><label style={labelStyle}>Amount ($) *</label><input type="number" value={financeForm.amount} onChange={e => setFinanceForm(prev => ({ ...prev, amount: e.target.value }))} style={inputStyle} placeholder="0.00" /></div>
                </div>
                <div><label style={labelStyle}>Description</label><input value={financeForm.description} onChange={e => setFinanceForm(prev => ({ ...prev, description: e.target.value }))} style={inputStyle} placeholder="e.g. Q1 2026 commission" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={labelStyle}>Status</label><select value={financeForm.status} onChange={e => setFinanceForm(prev => ({ ...prev, status: e.target.value }))} style={inputStyle}>{FINANCE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                  <div><label style={labelStyle}>Date</label><input type="date" value={financeForm.date} onChange={e => setFinanceForm(prev => ({ ...prev, date: e.target.value }))} style={inputStyle} /></div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button onClick={saveFinanceEntry} disabled={!financeForm.amount} style={{ flex: 1, background: financeForm.amount ? '#8E9B8B' : '#D5CEC0', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, cursor: financeForm.amount ? 'pointer' : 'default' }}>{editingFinance ? 'Save Changes' : 'Add Transaction'}</button>
                <button onClick={() => { setShowFinanceModal(false); setEditingFinance(null); }} style={{ flex: 1, background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Email Step 1 — Pick Template */}
        {showEmailStep1 && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(62,66,61,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 580, boxShadow: '0 20px 60px rgba(62,66,61,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#3E423D', fontSize: 22, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 6px' }}>New Email</h2>
              <p style={{ color: '#717182', fontSize: 13, margin: '0 0 24px' }}>To: <strong>{client.business_name}</strong></p>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Send To</label>
                <select value={emailRecipient ? JSON.stringify(emailRecipient) : ''} onChange={e => {
                  if (e.target.value) setEmailRecipient(JSON.parse(e.target.value));
                  else setEmailRecipient({ email: client.contact_email, name: `${client.contact_first_name} ${client.contact_last_name}` });
                }} style={inputStyle}>
                  <option value="">👤 {client.contact_first_name} {client.contact_last_name} — {client.contact_email} (Primary)</option>
                  {clientPeople.filter(p => p.email && p.email !== client.contact_email).map(p => (
                    <option key={p.id} value={JSON.stringify({ email: p.email, name: `${p.first_name} ${p.last_name}`, person_id: p.id })}>
                      👤 {p.first_name} {p.last_name} — {p.email}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 28 }}>
                <label style={labelStyle}>Choose Template</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                  <div onClick={() => selectTemplate(null)} style={{ padding: '12px 16px', borderRadius: 10, border: selectedTemplate === null ? '2px solid #8E9B8B' : '1px solid rgba(62,66,61,0.1)', cursor: 'pointer', background: selectedTemplate === null ? '#F5F3EF' : '#fff' }}>
                    <p style={{ color: '#3E423D', fontSize: 13, fontWeight: 500, margin: 0 }}>✏️ Blank email</p>
                    <p style={{ color: '#717182', fontSize: 12, margin: '2px 0 0' }}>Start from scratch</p>
                  </div>
                  {templates.map(t => (
                    <div key={t.id} onClick={() => selectTemplate(t)} style={{ padding: '12px 16px', borderRadius: 10, border: selectedTemplate?.id === t.id ? '2px solid #8E9B8B' : '1px solid rgba(62,66,61,0.1)', cursor: 'pointer', background: selectedTemplate?.id === t.id ? '#F5F3EF' : '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ color: '#3E423D', fontSize: 13, fontWeight: 500, margin: 0 }}>{t.name}</p>
                        <span style={{ background: '#E5E1D8', color: '#5A6059', fontSize: 11, borderRadius: 20, padding: '2px 8px' }}>{t.category}</span>
                      </div>
                      <p style={{ color: '#717182', fontSize: 12, margin: '2px 0 0' }}>{t.subject}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => { setShowEmailStep1(false); setShowEmailStep2(true); setEmailActiveField('body'); setEmailEditorTab('visual'); }} style={{ flex: 1, background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>Continue →</button>
                <button onClick={() => setShowEmailStep1(false)} style={{ flex: 1, background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Email Step 2 — Full Composer */}
        {showEmailStep2 && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(62,66,61,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 1100, height: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(62,66,61,0.2)' }}>
              <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(62,66,61,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                  <h2 style={{ color: '#3E423D', fontSize: 20, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 2px' }}>Compose Email</h2>
                  <p style={{ color: '#717182', fontSize: 12, margin: 0 }}>To: <strong>{client.business_name}</strong> · {emailRecipient?.name || `${client.contact_first_name} ${client.contact_last_name}`} ‹{emailRecipient?.email || client.contact_email}›</p>                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setShowEmailStep2(false); setShowEmailStep1(true); }} style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>← Back</button>
                  {emailSuccess ? (
                    <button style={{ background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13 }}>✅ Email Sent!</button>
                  ) : (
                    <button onClick={sendClientEmail} disabled={savingEmail || !emailForm.subject || !emailForm.body_html} style={{ background: savingEmail ? '#A5B2A3' : '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>
                      {savingEmail ? '⏳ Sending...' : '📤 Send Email'}
                    </button>
                  )}
                  <button onClick={() => setShowEmailStep2(false)} style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>✕</button>
                </div>
              </div>
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <div style={{ flex: 1, padding: 28, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Subject * {emailActiveField === 'subject' && <span style={{ color: '#8E9B8B', fontSize: 10, marginLeft: 4 }}>← tags insert here</span>}</label>
                    <input ref={emailSubjectRef} value={emailForm.subject} onChange={e => setEmailForm(prev => ({ ...prev, subject: e.target.value }))} onFocus={() => setEmailActiveField('subject')} style={{ ...inputStyle, border: emailActiveField === 'subject' ? '1px solid #8E9B8B' : '1px solid rgba(62,66,61,0.1)' }} placeholder="Email subject..." />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 8 }}>
                      <label style={{ ...labelStyle, marginBottom: 0, marginRight: 'auto' }}>Body * {emailActiveField === 'body' && <span style={{ color: '#8E9B8B', fontSize: 10, marginLeft: 4 }}>← tags insert here</span>}</label>
                      {['visual', 'html'].map(tab => (
                        <button key={tab} onClick={() => setEmailEditorTab(tab)} style={{ background: emailEditorTab === tab ? '#3E423D' : '#F5F3EF', color: emailEditorTab === tab ? '#fff' : '#717182', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer' }}>
                          {tab === 'html' ? 'HTML' : '✨ Visual'}
                        </button>
                      ))}
                    </div>
                    {emailEditorTab === 'html' ? (
                      <textarea ref={emailBodyRef} value={emailForm.body_html} onChange={e => setEmailForm(prev => ({ ...prev, body_html: e.target.value }))} onFocus={() => setEmailActiveField('body')} rows={14} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12, resize: 'vertical', lineHeight: 1.6, border: emailActiveField === 'body' ? '1px solid #8E9B8B' : '1px solid rgba(62,66,61,0.1)' }} placeholder="Email body HTML..." />
                    ) : (
                      <TiptapEditor content={emailForm.body_html} onChange={html => setEmailForm(prev => ({ ...prev, body_html: html }))} onFocus={() => setEmailActiveField('body')} placeholder="Write your email..." minHeight={280} />
                    )}
                  </div>
                  {emailForm.signature_html && (
                    <div style={{ background: '#F5F3EF', borderRadius: 8, padding: 16, border: '1px solid rgba(62,66,61,0.1)' }}>
                      <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 8px' }}>Signature</p>
                      <div dangerouslySetInnerHTML={{ __html: resolveTags(emailForm.signature_html) }} style={{ fontSize: 13 }} />
                    </div>
                  )}
                </div>
                <div style={{ width: 200, borderLeft: '1px solid rgba(62,66,61,0.1)', padding: 20, overflowY: 'auto', background: '#FAFAF9', flexShrink: 0 }}>
                  <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px', fontWeight: 600 }}>Merge Tags</p>
                  <p style={{ color: '#717182', fontSize: 12, margin: '0 0 14px', lineHeight: 1.5 }}>Click or drag to insert</p>
                  {MERGE_TAGS.map(({ tag, label }) => (
                    <button key={tag} onClick={() => insertEmailTag(tag)} draggable onDragStart={e => e.dataTransfer.setData('text/plain', tag)}
                      style={{ display: 'block', width: '100%', background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px 10px', marginBottom: 7, cursor: 'grab', textAlign: 'left' }}>
                      <p style={{ color: '#3E423D', fontSize: 11, fontWeight: 500, margin: '0 0 2px' }}>{label}</p>
                      <p style={{ color: '#94B0BC', fontSize: 10, margin: 0, fontFamily: 'monospace' }}>{tag}</p>
                    </button>
                  ))}
                  <div style={{ marginTop: 16, padding: 10, background: '#E5E1D8', borderRadius: 8 }}>
                    <p style={{ color: '#5A6059', fontSize: 11, margin: 0, lineHeight: 1.5 }}>Active: <strong>{emailActiveField === 'subject' ? '📌 Subject' : '📝 Body'}</strong><br /><br />Mode: <strong>{emailEditorTab === 'visual' ? '✨ Visual' : 'HTML'}</strong></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}