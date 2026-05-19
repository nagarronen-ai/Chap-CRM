import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useRole } from '../hooks/useRole';
import { useApp } from '../context/AppContext';
import TiptapEditor from '../components/TiptapEditor';
import ScheduleMeetingModal from '../components/ScheduleMeetingModal';
import LocationSelector from '../components/LocationSelector';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CategoryComboBox from '../components/CategoryComboBox';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const CLIENT_STAGES = ['Onboarding', 'Active', 'Paused', 'Churned'];
const STAGE_COLORS = {
  'Onboarding': { bg: '#FFF3CD', color: '#856404' },
  'Active': { bg: '#D4EDDA', color: '#155724' },
  'Paused': { bg: '#FFE5D0', color: '#8B5E34' },
  'Churned': { bg: '#F8D7DA', color: '#721C24' },
};
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

// Generalized listing page fields
const LISTING_TYPES = ['Physical Location', 'Online / Remote', 'Hybrid', 'Mobile / On-site', 'Other'];
const CAPACITY_OPTIONS = ['1-10', '11-25', '26-50', '51-100', '101-250', '251-500', '500+'];
const PRICE_TIERS = ['$', '$$', '$$$', '$$$$'];
const FEATURES_OPTIONS = ['Parking', 'Accessibility', 'WiFi', 'A/V Equipment', 'Catering', 'Storage', 'Security', 'Outdoor Space', 'Indoor Space', 'Private Rooms'];
const SERVICES_OPTIONS = ['Consulting', 'Installation', 'Maintenance', 'Training', 'Support', 'Delivery', 'Custom Work', 'Subscription', 'One-time'];
const DIVERSITY_OPTIONS = ['Asian-owned', 'Black-owned', 'Hispanic or Latinx-owned', 'LGBTQ+-owned', 'Native American-owned', 'Pacific Islander-owned', 'Veteran-owned', 'Woman-owned'];

function PeopleFromContact({ companyId, getHeaders, p }) {
  const [people, setPeople] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ first_name: '', last_name: '', title: '', email: '', work_phone: '', mobile_phone: '' });
  const [saving, setSaving] = useState(false);

  const fetchPeople = async () => {
    try {
      const res = await axios.get(`${API}/contacts/companies/${companyId}`, { headers: getHeaders() });
      setPeople(res.data.crm_people || []);
    } catch (err) {}
  };

  useEffect(() => {
    fetchPeople();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const savePerson = async () => {
    try {
      await axios.put(`${API}/contacts/people/${editing}`, editForm, { headers: getHeaders() });
      setEditing(null); fetchPeople();
    } catch (err) { console.error(err); }
  };

  const addPerson = async () => {
    if (!addForm.first_name) return;
    setSaving(true);
    try {
      await axios.post(`${API}/contacts/companies/${companyId}/people`, addForm, { headers: getHeaders() });
      setAddForm({ first_name: '', last_name: '', title: '', email: '', work_phone: '', mobile_phone: '' });
      setShowAdd(false); fetchPeople();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const deletePerson = async (personId) => {
    if (!window.confirm('Remove this person?')) return;
    try { await axios.delete(`${API}/contacts/people/${personId}`, { headers: getHeaders() }); fetchPeople(); }
    catch (err) { console.error(err); }
  };

  const inputStyle = { width: '100%', background: p.inputBg, border: `1px solid ${p.inputBorder}`, borderRadius: 6, padding: '5px 8px', color: p.text, fontSize: 12, boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' };

  return (
    <div style={{ background: p.cardBg, borderRadius: 12, padding: 20, border: `1px solid ${p.cardBorder}`, marginBottom: 16, overflow: 'hidden', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: 0 }}>People ({people.length})</h3>
        <button onClick={() => setShowAdd(true)} style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>+ Add Person</button>
      </div>

      {showAdd && (
        <div style={{ background: p.inputBg, borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            {[['First Name *', 'first_name'], ['Last Name', 'last_name'], ['Title', 'title'], ['Email', 'email'], ['Work Phone', 'work_phone'], ['Mobile Phone', 'mobile_phone']].map(([label, field]) => (
              <div key={field}>
                <label style={{ color: p.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 3 }}>{label}</label>
                <input value={addForm[field]} onChange={e => setAddForm(prev => ({ ...prev, [field]: e.target.value }))} style={inputStyle} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addPerson} disabled={saving || !addForm.first_name} style={{ background: saving ? p.textMuted : p.primary, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>{saving ? '⏳ Saving...' : 'Save'}</button>
            <button onClick={() => { setShowAdd(false); setAddForm({ first_name: '', last_name: '', title: '', email: '', work_phone: '', mobile_phone: '' }); }} style={{ background: p.cardBg, color: p.textSecondary, border: `1px solid ${p.inputBorder}`, borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {people.length === 0 && !showAdd && <p style={{ color: p.textMuted, fontSize: 13, margin: 0 }}>No people added yet</p>}

      {people.map(person => (
        <div key={person.id} style={{ background: p.inputBg, borderRadius: 10, padding: 12, marginBottom: 8 }}>
          {editing === person.id ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={editForm.first_name || ''} onChange={e => setEditForm(prev => ({ ...prev, first_name: e.target.value }))} placeholder="First" style={inputStyle} />
                <input value={editForm.last_name || ''} onChange={e => setEditForm(prev => ({ ...prev, last_name: e.target.value }))} placeholder="Last" style={inputStyle} />
              </div>
              <input value={editForm.title || ''} onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))} placeholder="Title" style={inputStyle} />
              <input value={editForm.email || ''} onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))} placeholder="Email" style={inputStyle} />
              <input value={editForm.work_phone || ''} onChange={e => setEditForm(prev => ({ ...prev, work_phone: e.target.value }))} placeholder="Work Phone" style={inputStyle} />
              <input value={editForm.mobile_phone || ''} onChange={e => setEditForm(prev => ({ ...prev, mobile_phone: e.target.value }))} placeholder="Mobile" style={inputStyle} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={savePerson} style={{ flex: 1, background: p.primary, color: '#fff', border: 'none', borderRadius: 6, padding: '5px', fontSize: 11, cursor: 'pointer' }}>Save</button>
                <button onClick={() => setEditing(null)} style={{ flex: 1, background: p.cardBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 6, padding: '5px', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ color: p.text, fontWeight: 600, margin: '0 0 2px', fontSize: 13 }}>{person.first_name} {person.last_name}</p>
                {person.title && <p style={{ color: p.textSecondary, fontSize: 12, margin: '0 0 4px' }}>{person.title}</p>}
                {person.email && <p style={{ color: p.primary, fontSize: 12, margin: '0 0 2px', wordBreak: 'break-all' }}>✉️ {person.email}</p>}
                {person.work_phone && <p style={{ color: p.textSecondary, fontSize: 12, margin: '0 0 2px' }}>📞 {person.work_phone}</p>}
                {person.mobile_phone && <p style={{ color: p.textSecondary, fontSize: 12, margin: 0 }}>📱 {person.mobile_phone}</p>}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => { setEditing(person.id); setEditForm({ first_name: person.first_name, last_name: person.last_name, title: person.title || '', email: person.email || '', work_phone: person.work_phone || '', mobile_phone: person.mobile_phone || '' }); }}
                  style={{ background: p.cardBg, border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', color: p.textSecondary }}>✏️</button>
                <button onClick={() => deletePerson(person.id)} style={{ background: p.cardBg, border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', color: '#D4183D' }}>✕</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role, can } = useRole();
  const { palette: p } = useApp();
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
  const [notePersonId, setNotePersonId] = useState('');
  const [showDocModal, setShowDocModal] = useState(false);
  const [docForm, setDocForm] = useState({ title: '', type: 'Contract', notes: '' });
  const [docFile, setDocFile] = useState(null);
  const [editingDoc, setEditingDoc] = useState(null);
  const [savingDoc, setSavingDoc] = useState(false);
  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [financeForm, setFinanceForm] = useState({ type: 'Commission', amount: '', description: '', status: 'Pending', date: new Date().toISOString().split('T')[0] });
  const [editingFinance, setEditingFinance] = useState(null);
  const [savingVendorPage, setSavingVendorPage] = useState(false);
  const [syncedEmails, setSyncedEmails] = useState([]);
  const [expandedSyncedEmail, setExpandedSyncedEmail] = useState({});
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [meetings, setMeetings] = useState([]);
  const [completingMeeting, setCompletingMeeting] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [savingCompletion, setSavingCompletion] = useState(false);
  const [activityFilter, setActivityFilter] = useState('all');
  const [editingNotes, setEditingNotes] = useState(null);
  const [editingNotesText, setEditingNotesText] = useState('');
  const [zoomLinkInput, setZoomLinkInput] = useState({});
  const [showZoomInput, setShowZoomInput] = useState({});
  const [reschedulingMeeting, setReschedulingMeeting] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({ date: '', start_hour: '10', start_min: '00', end_hour: '11', end_min: '00' });
  const [savingReschedule, setSavingReschedule] = useState(false);
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
  const [contactEmailHistory, setContactEmailHistory] = useState([]);
  const [contactMarketingHistory, setContactMarketingHistory] = useState([]);
  const [includeSignature, setIncludeSignature] = useState(true);
  const [userSignature, setUserSignature] = useState('');
  const [gmailConnected, setGmailConnected] = useState(null);
  const [recordingStatus, setRecordingStatus] = useState({});
  const [processingTranscript, setProcessingTranscript] = useState({});

  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const fetchMeetings = async () => {
    try { const res = await axios.get(`${API}/calendar/meetings/client/${id}`, { headers: getHeaders() }); setMeetings(res.data); }
    catch (err) { console.error(err); }
  };

  const completeMeeting = async (meetingId) => {
    setSavingCompletion(true);
    try {
      await axios.put(`${API}/calendar/meetings/${meetingId}`, { status: 'completed', notes: completionNotes }, { headers: getHeaders() });
      setCompletingMeeting(null); setCompletionNotes('');
      fetchMeetings(); fetchAll();
    } catch (err) { console.error(err); }
    setSavingCompletion(false);
  };

  const rescheduleMeeting = async (meetingId) => {
    if (!rescheduleForm.date) return;
    setSavingReschedule(true);
    try {
      const start_time = new Date(`${rescheduleForm.date}T${String(rescheduleForm.start_hour).padStart(2, '0')}:${rescheduleForm.start_min}:00`).toISOString();
      const end_time = new Date(`${rescheduleForm.date}T${String(rescheduleForm.end_hour).padStart(2, '0')}:${rescheduleForm.end_min}:00`).toISOString();
      await axios.put(`${API}/calendar/meetings/${meetingId}/reschedule`, { start_time, end_time }, { headers: getHeaders() });
      setReschedulingMeeting(null); fetchMeetings(); fetchAll();
    } catch (err) { console.error(err); alert('Reschedule failed'); }
    setSavingReschedule(false);
  };

  const startRecording = async (meetingId, meetingUrl) => {
    try {
      setRecordingStatus(prev => ({ ...prev, [meetingId]: 'sending_bot' }));
      await axios.post(`${API}/calendar/meetings/${meetingId}/record`, { meeting_url: meetingUrl }, { headers: getHeaders() });
      pollRecordingStatus(meetingId);
    } catch (err) {
      console.error(err);
      alert('Failed to start recording: ' + (err.response?.data?.error || err.message));
      setRecordingStatus(prev => ({ ...prev, [meetingId]: null }));
    }
  };

  const saveNotes = async (meetingId) => {
    try {
      await axios.put(`${API}/calendar/meetings/${meetingId}`, { notes: editingNotesText }, { headers: getHeaders() });
      setEditingNotes(null); fetchMeetings();
    } catch (err) { console.error(err); }
  };

  const pollRecordingStatus = (meetingId) => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/calendar/meetings/${meetingId}/recording-status`, { headers: getHeaders() });
        const status = res.data.status;
        setRecordingStatus(prev => ({ ...prev, [meetingId]: status }));
        if (['processing', 'completed', 'failed'].includes(status)) {
          clearInterval(interval);
          if (status === 'processing') processTranscript(meetingId);
          if (status === 'completed') fetchMeetings();
        }
      } catch (err) { clearInterval(interval); }
    }, 10000);
  };

  const processTranscript = async (meetingId) => {
    setProcessingTranscript(prev => ({ ...prev, [meetingId]: true }));
    try {
      await axios.post(`${API}/calendar/meetings/${meetingId}/process-transcript`, {}, { headers: getHeaders() });
      setRecordingStatus(prev => ({ ...prev, [meetingId]: 'completed' }));
      fetchMeetings();
    } catch (err) { setTimeout(() => processTranscript(meetingId), 30000); }
    setProcessingTranscript(prev => ({ ...prev, [meetingId]: false }));
  };

  const regenerateSummary = async (meetingId) => {
    setProcessingTranscript(prev => ({ ...prev, [meetingId]: true }));
    try { await axios.post(`${API}/calendar/meetings/${meetingId}/regenerate-summary`, {}, { headers: getHeaders() }); fetchMeetings(); }
    catch (err) { alert('Failed to regenerate summary'); }
    setProcessingTranscript(prev => ({ ...prev, [meetingId]: false }));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAll(); }, [id]);

  const fetchAll = async () => {
    try {
      const [clientRes, activityRes, docsRes, vpRes, finRes] = await Promise.all([
        axios.get(`${API}/clients/${id}`, { headers: getHeaders() }),
        axios.get(`${API}/clients/${id}/activity`, { headers: getHeaders() }),
        axios.get(`${API}/documents?client_id=${id}`, { headers: getHeaders() }),
        axios.get(`${API}/clients/${id}/vendor-page`, { headers: getHeaders() }),
        canFinance ? axios.get(`${API}/clients/${id}/finance`, { headers: getHeaders() }) : Promise.resolve({ data: [] }),
      ]);
      setClient(clientRes.data);
      setActivity(activityRes.data);
      setDocuments(docsRes.data);
      setVendorPage(vpRes.data || {});
      setFinance(finRes.data);
      if (clientRes.data?.converted_from) {
        fetchEmailHistory(clientRes.data.converted_from);
        try {
          const docsRes2 = await axios.get(`${API}/documents?client_id=${id}&company_id=${clientRes.data.converted_from}`, { headers: getHeaders() });
          setDocuments(docsRes2.data);
        } catch (err) { console.error(err); }
      }
    } catch (err) { console.error(err); }
    try { const syncRes = await axios.get(`${API}/sync/emails/client/${id}`, { headers: getHeaders() }); setSyncedEmails(syncRes.data); } catch (err) {}
    try { const sigRes = await axios.get(`${API}/users/me`, { headers: getHeaders() }); setUserSignature(sigRes.data.email_signature || ''); } catch (err) {}
    fetchTemplates(); fetchMeetings();
    setLoading(false);
    try { const gmailRes = await axios.get(`${API}/emails/gmail-status`, { headers: getHeaders() }); setGmailConnected(gmailRes.data); } catch (err) {}
  };

  const fetchEmailHistory = async (convertedFrom) => {
    try {
      if (convertedFrom) {
        const emailRes = await axios.get(`${API}/emails/sent/company/${convertedFrom}`, { headers: getHeaders() });
        setContactEmailHistory(emailRes.data || []);
        const companyRes = await axios.get(`${API}/contacts/companies/${convertedFrom}`, { headers: getHeaders() });
        setClientPeople(companyRes.data.crm_people || []);
        const mktRes = await axios.get(`${API}/marketing/company/${convertedFrom}`, { headers: getHeaders() });
        setContactMarketingHistory(mktRes.data || []);
      }
    } catch (err) { console.error(err); }
  };

  const fetchTemplates = async () => {
    try { const res = await axios.get(`${API}/emails/templates`, { headers: getHeaders() }); setTemplates(res.data); } catch (err) {}
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
      await axios.post(`${API}/clients/${id}/note`, { note, person_id: notePersonId || null }, { headers: getHeaders() });
      setNote(''); setNotePersonId('');
      const res = await axios.get(`${API}/clients/${id}/activity`, { headers: getHeaders() });
      setActivity(res.data);
    } catch (err) { console.error(err); }
  };

  const saveVendorPage = async () => {
    setSavingVendorPage(true);
    try { const res = await axios.put(`${API}/clients/${id}/vendor-page`, vendorPage, { headers: getHeaders() }); setVendorPage(res.data); }
    catch (err) { console.error(err); }
    setSavingVendorPage(false);
  };

  const toggleArrayItem = (arr, item) => {
    const current = arr || [];
    return current.includes(item) ? current.filter(i => i !== item) : [...current, item];
  };

  const openEmailComposer = async () => {
    setEmailForm({ subject: '', body_html: '', signature_html: '' });
    setSelectedTemplate(null); setEmailSuccess(false); setEmailEditorTab('visual'); setEmailRecipient(null);
    if (client.converted_from) {
      try {
        const res = await axios.get(`${API}/contacts/companies/${client.converted_from}`, { headers: getHeaders() });
        setClientPeople(res.data.crm_people || []);
      } catch (err) { setClientPeople([]); }
    } else { setClientPeople([]); }
    setShowEmailStep1(true);
  };

  const selectTemplate = (template) => {
    setSelectedTemplate(template);
    setEmailForm(prev => ({ ...prev, subject: template ? template.subject : '', body_html: template ? template.body_html : '', signature_html: template ? template.signature_html : '' }));
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
      const newVal = emailForm.subject.substring(0, start) + tag + emailForm.subject.substring(start);
      setEmailForm(prev => ({ ...prev, subject: newVal }));
      setTimeout(() => { input.focus(); input.selectionStart = input.selectionEnd = start + tag.length; }, 0);
    } else {
      if (emailEditorTab === 'html') {
        const textarea = emailBodyRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const newVal = emailForm.body_html.substring(0, start) + tag + emailForm.body_html.substring(start);
        setEmailForm(prev => ({ ...prev, body_html: newVal }));
        setTimeout(() => { textarea.focus(); textarea.selectionStart = textarea.selectionEnd = start + tag.length; }, 0);
      } else {
        setEmailForm(prev => {
          const current = prev.body_html || '';
          const updated = current.replace(/<\/p>\s*$/, tag + '</p>') !== current ? current.replace(/<\/p>\s*$/, tag + '</p>') : current + tag;
          return { ...prev, body_html: updated };
        });
      }
    }
  };

  const sendClientEmail = async () => {
    if (!emailForm.subject || !emailForm.body_html) return;
    setSavingEmail(true);
    const sig = includeSignature ? (userSignature || '') : '';
    const resolvedBody = resolveTags(emailForm.body_html) + (sig ? '<br><br><div style="margin-top:16px;padding-top:12px;border-top:1px solid #e0e0e0;">' + resolveTags(sig) + '</div>' : '');
    try {
      await axios.post(`${API}/emails/send`, {
        company_id: client.converted_from || null, person_id: null, template_id: selectedTemplate?.id || null,
        subject: resolveTags(emailForm.subject), body_html: resolvedBody,
        recipient_email: emailRecipient?.email || client.contact_email,
        recipient_name: emailRecipient?.name || `${client.contact_first_name} ${client.contact_last_name}`,
      }, { headers: getHeaders() });
      await axios.post(`${API}/clients/${id}/note`, { note: `Email sent to ${emailRecipient?.email || client.contact_email}: "${emailForm.subject}"` }, { headers: getHeaders() });
      setEmailSuccess(true);
      setTimeout(() => { setShowEmailStep2(false); setEmailSuccess(false); setEmailForm({ subject: '', body_html: '', signature_html: '' }); fetchAll(); }, 2000);
    } catch (err) { console.error(err); alert('Send failed.'); }
    setSavingEmail(false);
  };

  const inputStyle = { width: '100%', background: p.inputBg, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '9px 12px', color: p.text, fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { color: p.textSecondary, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 5 };
  const card = { background: p.cardBg, borderRadius: 12, border: `1px solid ${p.cardBorder}` };

  if (loading) return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: p.background, minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: 40, color: p.textSecondary }}>Loading...</div>
    </div>
  );

  if (!client) return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: p.background, minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: 40, color: p.textSecondary }}>Client not found</div>
    </div>
  );

  const totalFinance = finance.reduce((acc, f) => acc + (parseFloat(f.amount) || 0), 0);
  const pendingFinance = finance.filter(f => f.status === 'Pending').reduce((acc, f) => acc + (parseFloat(f.amount) || 0), 0);

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: p.background, minHeight: '100vh', transition: 'background 0.4s' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: 40 }}>

        <button onClick={() => navigate('/clients')} style={{ background: 'none', border: 'none', color: p.primary, fontSize: 13, cursor: 'pointer', marginBottom: 8, padding: 0 }}>← Back to Clients</button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>{client.category}{client.business_type ? ` · ${client.business_type}` : ''}</p>
            <h1 style={{ color: p.text, fontSize: 28, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>{client.business_name}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {client.contact_email && (
              <button onClick={openEmailComposer} style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>📧 Send Email</button>
            )}
            <button onClick={() => setShowMeetingModal(true)} style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>📅 Schedule Meeting</button>
            {client.converted_from && (
              <button onClick={() => navigate(`/companies/${client.converted_from}`)} style={{ background: p.inputBg, color: p.textSecondary, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>📋 View Original Contact</button>
            )}
          </div>
        </div>

        {/* Stage Stepper */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {CLIENT_STAGES.map(stage => {
            const stc = STAGE_COLORS[stage] || { bg: p.inputBg, color: p.textSecondary };
            const isActive = client.stage === stage;
            return (
              <button key={stage} onClick={() => isAdmin && updateField('stage', stage)}
                style={{ background: isActive ? stc.color : p.cardBg, color: isActive ? '#fff' : stc.color, border: `1px solid ${stc.color}`, borderRadius: 20, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: isAdmin ? 'pointer' : 'default' }}>
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
            <div key={label} style={{ ...card, padding: 16 }}>
              <p style={{ color: p.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>{label}</p>
              <p style={{ color: p.text, fontSize: 14, fontWeight: 500, margin: 0 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${p.cardBorder}`, marginBottom: 24 }}>
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'activity', label: `Activity (${activity.length})` },
            { key: 'meetings', label: `Meetings (${meetings.length})` },
            { key: 'documents', label: `Documents (${documents.length})` },
            { key: 'emails', label: `Emails (${contactEmailHistory.length + contactMarketingHistory.length})` },
            { key: 'people', label: 'People' },
            { key: 'vendor-page', label: 'Listing Page' },
            ...(canFinance ? [{ key: 'finance', label: `Finance (${finance.length})` }] : []),
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ background: 'none', border: 'none', borderBottom: activeTab === tab.key ? `2px solid ${p.primary}` : '2px solid transparent', padding: '12px 20px', fontSize: 14, color: activeTab === tab.key ? p.text : p.textSecondary, fontWeight: activeTab === tab.key ? 600 : 400, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* PEOPLE TAB */}
        {activeTab === 'people' && (
          <PeopleFromContact companyId={client?.converted_from} getHeaders={getHeaders} p={p} />
        )}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, minWidth: 0, width: '100%' }}>
            <div style={{ ...card, padding: 28 }}>
              <h3 style={{ color: p.text, fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>Contact Info</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 16px', marginBottom: 20 }}>
                {[{ field: 'address', label: 'Address' }, { field: 'city', label: 'City' }].map(({ field, label }) => (
                  <div key={field}>
                    <label style={labelStyle}>{label}</label>
                    {editField === field ? (
                      <input type="text" value={client[field] || ''} onChange={e => setClient(prev => ({ ...prev, [field]: e.target.value }))}
                        onBlur={e => updateField(field, e.target.value)} onKeyDown={e => e.key === 'Enter' && updateField(field, e.target.value)}
                        autoFocus style={inputStyle} />
                    ) : (
                      <p onClick={() => isAdmin && setEditField(field)}
                        style={{ color: client[field] ? p.text : p.textMuted, fontSize: 13, fontWeight: client[field] ? 500 : 400, margin: 0, padding: '9px 10px', background: p.inputBg, borderRadius: 6, cursor: isAdmin ? 'pointer' : 'default' }}>
                        {client[field] || '—'}
                      </p>
                    )}
                  </div>
                ))}
                <LocationSelector country={client.country} state={client.state} onCountryChange={v => updateField('country', v)} onStateChange={v => updateField('state', v)} editable={isAdmin}
                  labelStyle={labelStyle}
                  inputStyle={{ width: '100%', background: p.inputBg, border: `1px solid ${p.inputBorder}`, borderRadius: 6, padding: '6px 10px', color: p.text, fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
              </div>

              {[
                { title: 'Business', fields: [{ field: 'category', label: 'Category' }, { field: 'business_type', label: 'Business Type' }], cols: '1fr 1fr' },
                { title: 'Marketing', fields: [{ field: 'origin', label: 'Origin' }], cols: '1fr' },
                { title: 'Social', fields: [{ field: 'linkedin_url', label: 'LinkedIn' }, { field: 'facebook_url', label: 'Facebook' }, { field: 'instagram_url', label: 'Instagram' }, { field: 'website', label: 'Website' }], cols: '1fr 1fr' },
                { title: 'Contract', fields: [{ field: 'contract_type', label: 'Contract Type' }, { field: 'contract_amount', label: 'Amount ($)' }, { field: 'contract_signed_date', label: 'Signed Date' }], cols: '1fr 1fr 1fr' },
              ].map(({ title, fields, cols }) => (
                <div key={title} style={{ marginBottom: 20 }}>
                  <h3 style={{ color: p.text, fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>{title}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '6px 16px' }}>
                  {fields.map(({ field, label }) => (
                    <div key={field}>
                      <label style={labelStyle}>{label}</label>
                      {editField === field ? (
                        field === 'category' ? (
                          <CategoryComboBox value={client[field] || ''} onChange={v => { setClient(prev => ({ ...prev, [field]: v })); updateField(field, v); }} />
                        ) : (
                          <input type={field === 'contract_signed_date' ? 'date' : 'text'} value={client[field] || ''} onChange={e => setClient(prev => ({ ...prev, [field]: e.target.value }))}
                            onBlur={e => updateField(field, e.target.value)} onKeyDown={e => e.key === 'Enter' && updateField(field, e.target.value)}
                            autoFocus style={inputStyle} />
                        )
                      ) : (
                        <p onClick={() => isAdmin && setEditField(field)}
                            style={{ color: client[field] ? p.text : p.textMuted, fontSize: 13, fontWeight: client[field] ? 500 : 400, margin: 0, padding: '9px 10px', background: p.inputBg, borderRadius: 6, cursor: isAdmin ? 'pointer' : 'default' }}>
                            {client[field] || '—'}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              {client.converted_from && <PeopleFromContact companyId={client.converted_from} getHeaders={getHeaders} p={p} />}
              <div style={{ ...card, padding: 20, marginBottom: 16 }}>
                <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Quick Note</h3>
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note..." rows={3} style={{ ...inputStyle, marginBottom: 8, resize: 'vertical' }} />
                <button onClick={addNote} disabled={!note.trim()} style={{ background: note.trim() ? p.primary : p.textMuted, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: note.trim() ? 'pointer' : 'default', width: '100%' }}>Add Note</button>
              </div>
              <div style={{ ...card, padding: 20 }}>
                <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Recent Notes</h3>
                {activity.filter(a => a.action === 'Note Added').slice(0, 3).map(a => (
                  <div key={a.id} style={{ padding: '8px 0', borderBottom: `1px solid ${p.cardBorder}` }}>
                    <p style={{ color: p.text, fontSize: 12, margin: '0 0 2px', wordBreak: 'break-word' }}>{a.details?.length > 120 ? a.details.substring(0, 120) + '...' : a.details}</p>
                    <p style={{ color: p.textMuted, fontSize: 10, margin: 0 }}>{new Date(a.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
                {activity.filter(a => a.action === 'Note Added').length === 0 && <p style={{ color: p.textMuted, fontSize: 12, margin: 0 }}>No notes yet</p>}
              </div>
            </div>
          </div>
        )}

        {/* EMAILS TAB */}
        {activeTab === 'emails' && (
          <div>
            {clientPeople.filter(per => per.marketing_unsubscribed).length > 0 && (
              <div style={{ background: '#FFE5D0', borderRadius: 10, padding: '12px 20px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>🚫</span>
                  <p style={{ color: '#856404', fontSize: 13, fontWeight: 600, margin: 0 }}>Unsubscribed Contacts</p>
                </div>
                {clientPeople.filter(per => per.marketing_unsubscribed).map(per => (
                  <div key={per.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid rgba(133,100,4,0.15)' }}>
                    <span style={{ color: '#856404', fontSize: 12 }}>{per.first_name} {per.last_name} — {per.email}</span>
                    <button onClick={async () => {
                      try {
                        await axios.post(`${API}/marketing/resubscribe/${per.id}`, {}, { headers: getHeaders() });
                        if (client.converted_from) { const res = await axios.get(`${API}/contacts/companies/${client.converted_from}`, { headers: getHeaders() }); setClientPeople(res.data.crm_people || []); }
                      } catch (err) { console.error(err); }
                    }} style={{ background: '#fff', color: '#856404', border: '1px solid #856404', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Resubscribe</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ ...card, overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: `1px solid ${p.cardBorder}` }}>
                <h3 style={{ color: p.text, fontSize: 15, fontWeight: 600, margin: 0 }}>All Emails ({contactEmailHistory.length + contactMarketingHistory.length})</h3>
              </div>
              {contactEmailHistory.length === 0 && contactMarketingHistory.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center' }}><p style={{ color: p.textMuted, fontSize: 13, margin: 0 }}>No emails yet</p></div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: p.inputBg }}>
                      {['Type', 'Subject', 'Recipient', 'Sent', 'Status', 'Opened', 'Clicked'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: p.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contactEmailHistory.map((e, i) => (
                      <tr key={`direct-${e.id}`} style={{ borderTop: `1px solid ${p.cardBorder}`, background: i % 2 === 0 ? p.cardBg : p.inputBg }}>
                        <td style={{ padding: '12px 16px' }}><span style={{ background: '#EBF4FF', color: '#1a6fad', fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>Direct</span></td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: p.text, fontWeight: 500 }}>{e.subject || '(no subject)'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: p.textSecondary }}>{e.crm_people ? `${e.crm_people.first_name} ${e.crm_people.last_name}` : '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: p.textSecondary }}>{e.sent_at ? new Date(e.sent_at).toLocaleDateString() : '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: ['opened', 'clicked'].includes(e.email_status) ? '#E8F5E9' : e.email_status === 'bounced' ? '#FFEBEE' : e.email_status === 'delivered' ? '#E3F2FD' : p.inputBg, color: ['opened', 'clicked'].includes(e.email_status) ? '#2E7D32' : e.email_status === 'bounced' ? '#C62828' : e.email_status === 'delivered' ? '#1565C0' : p.textSecondary, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>{e.email_status || e.status || 'sent'}</span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: p.textSecondary }}>{e.opened_at ? new Date(e.opened_at).toLocaleDateString() : '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: p.textSecondary }}>{e.clicked_at ? new Date(e.clicked_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                    {contactMarketingHistory.map((r, i) => (
                      <tr key={`campaign-${r.id}`} style={{ borderTop: `1px solid ${p.cardBorder}`, background: (contactEmailHistory.length + i) % 2 === 0 ? p.cardBg : p.inputBg }}>
                        <td style={{ padding: '12px 16px' }}><span style={{ background: '#F3E8FF', color: '#7C3AED', fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>Campaign</span></td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: p.text, fontWeight: 500 }}>{r.crm_campaigns?.name || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: p.textSecondary }}>{r.crm_people ? `${r.crm_people.first_name} ${r.crm_people.last_name}` : r.email || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: p.textSecondary }}>{r.crm_campaigns?.sent_at ? new Date(r.crm_campaigns.sent_at).toLocaleDateString() : '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: ['opened', 'clicked'].includes(r.status) ? '#D4EDDA' : r.status === 'bounced' ? '#F8D7DA' : p.inputBg, color: ['opened', 'clicked'].includes(r.status) ? '#155724' : r.status === 'bounced' ? '#721C24' : p.textSecondary, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>{r.status}</span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: p.textSecondary }}>{r.opened_at ? new Date(r.opened_at).toLocaleDateString() : '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: p.textSecondary }}>{r.clicked_at ? new Date(r.clicked_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === 'activity' && (
          <div style={{ ...card, padding: 24 }}>
            <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${p.cardBorder}` }}>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note..." rows={2}
                style={{ ...inputStyle, marginBottom: 8, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <select value={notePersonId} onChange={e => setNotePersonId(e.target.value)} style={{ ...inputStyle, width: 220 }}>
                  <option value="">🏢 Company note</option>
                  {(clientPeople || []).map(per => <option key={per.id} value={per.id}>👤 {per.first_name} {per.last_name}</option>)}
                </select>
                <button onClick={addNote} disabled={!note.trim()}
                  style={{ background: note.trim() ? p.primary : p.textMuted, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: note.trim() ? 'pointer' : 'default' }}>
                  Add Note
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {[
                { key: 'all', label: 'All', color: p.primary },
                { key: 'meetings', label: '📅 Meetings', color: '#B4A5D6' },
                { key: 'documents', label: '📄 Documents', color: '#94B0BC' },
                { key: 'emails', label: '📧 Emails', color: p.primary },
                { key: 'notes', label: '📌 Notes', color: p.primary },
                ...(clientPeople || []).map(per => ({ key: `person_${per.id}`, label: `👤 ${per.first_name} ${per.last_name}`, color: p.primary })),
              ].map(f => (
                <button key={f.key} onClick={() => setActivityFilter(f.key)}
                  style={{ background: activityFilter === f.key ? f.color : p.inputBg, color: activityFilter === f.key ? '#fff' : p.textSecondary, border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
                  {f.label}
                </button>
              ))}
            </div>

            {activity.length === 0 && syncedEmails.length === 0 ? (
              <p style={{ color: p.textMuted, fontSize: 13, textAlign: 'center', padding: '40px 0' }}>No activity yet</p>
            ) : (
              [
                ...activity.map(a => ({ ...a, type: 'activity', sortDate: new Date(a.created_at) })),
                ...syncedEmails.map(e => ({ ...e, type: 'synced_email', sortDate: new Date(e.email_date) })),
              ]
                .sort((a, b) => b.sortDate - a.sortDate)
                .filter(item => {
                  if (activityFilter === 'all') return true;
                  if (activityFilter.startsWith('person_')) return item.type === 'activity' && item.person_id === activityFilter.replace('person_', '');
                  if (activityFilter === 'emails') return item.type === 'synced_email' || (item.type === 'activity' && ['Email Sent', 'Email Received'].includes(item.action));
                  if (activityFilter === 'notes') return item.type === 'activity' && item.action === 'Note Added';
                  if (activityFilter === 'documents') return item.type === 'activity' && item.action === 'Document Added';
                  if (activityFilter === 'meetings') return item.type === 'activity' && ['Meeting Scheduled', 'Meeting Completed', 'Meeting Cancelled'].includes(item.action);
                  return true;
                })
                .map(item => {
                  if (item.type === 'synced_email') {
                    const isExpanded = expandedSyncedEmail[item.id];
                    return (
                      <div key={`synced-${item.id}`} style={{ borderBottom: `1px solid ${p.cardBorder}` }}>
                        <div style={{ display: 'flex', gap: 12, padding: '12px 0', alignItems: 'flex-start' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: item.direction === 'inbound' ? '#EBF4FF' : '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                            {item.direction === 'inbound' ? '📥' : '📤'}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                              <span style={{ color: p.text, fontSize: 13, fontWeight: 500 }}>{item.from_name || item.from_email}</span>
                              <span style={{ background: item.direction === 'inbound' ? '#EBF4FF' : '#E8F5E9', color: item.direction === 'inbound' ? '#1a6fad' : '#2E7D32', fontSize: 10, borderRadius: 20, padding: '1px 8px' }}>
                                {item.direction === 'inbound' ? 'Email Received' : 'Email Sent'}
                              </span>
                            </div>
                            <p style={{ color: p.text, fontSize: 13, margin: '0 0 2px', fontWeight: 500 }}>{item.subject}</p>
                            <p style={{ color: p.textSecondary, fontSize: 12, margin: 0 }}>{item.body_snippet?.substring(0, 120)}...</p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: p.textMuted, fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(item.email_date).toLocaleDateString()}</span>
                            <button onClick={() => setExpandedSyncedEmail(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                              style={{ background: p.inputBg, border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: p.textSecondary }}>
                              {isExpanded ? '▲ Hide' : '▼ View'}
                            </button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div style={{ borderTop: `1px solid ${p.cardBorder}`, background: p.inputBg, padding: 20, marginBottom: 8, borderRadius: '0 0 8px 8px' }}>
                            <div style={{ fontSize: 12, color: p.textSecondary, marginBottom: 8 }}>
                              <strong>From:</strong> {item.from_name} &lt;{item.from_email}&gt;
                            </div>
                            <div style={{ background: p.cardBg, borderRadius: 8, padding: 16, border: `1px solid ${p.cardBorder}`, fontSize: 14, lineHeight: 1.6, color: p.text }}
                              dangerouslySetInnerHTML={{ __html: item.body_html || item.body_snippet }} />
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div key={item.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: `1px solid ${p.cardBorder}`, alignItems: 'flex-start' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: p.inputBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                        {item.action === 'Note Added' ? '📌' : item.action === 'Client Created' ? '🤝' : item.action === 'Document Added' ? '📄' : item.action === 'Transaction Added' ? '💰' : '📋'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                          <span style={{ color: p.text, fontSize: 13, fontWeight: 500 }}>{item.crm_users?.name || '—'}</span>
                          <span style={{ background: p.inputBg, color: p.textSecondary, fontSize: 10, borderRadius: 20, padding: '1px 8px' }}>{item.action}</span>
                        </div>
                        <p style={{ color: p.textSecondary, fontSize: 12, margin: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{item.details}</p>
                      </div>
                      <span style={{ color: p.textMuted, fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                  );
                })
            )}
          </div>
        )}

        {/* MEETINGS TAB */}
        {activeTab === 'meetings' && (
          <div>
            {meetings.length === 0 ? (
              <div style={{ ...card, padding: 60, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
                <p style={{ color: p.text, fontSize: 15, fontWeight: 500, margin: '0 0 6px' }}>No meetings yet</p>
                <p style={{ color: p.textSecondary, fontSize: 13, margin: '0 0 16px' }}>Schedule a meeting to track your interactions with this client.</p>
                <button onClick={() => setShowMeetingModal(true)} style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>📅 Schedule Meeting</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Total', count: meetings.length, color: p.textSecondary },
                    { label: 'Completed', count: meetings.filter(m => m.status === 'completed').length, color: '#4CAF50' },
                    { label: 'Scheduled', count: meetings.filter(m => ['scheduled', 'confirmed'].includes(m.status)).length, color: '#B4A5D6' },
                    { label: 'Cancelled', count: meetings.filter(m => m.status === 'cancelled').length, color: '#D4183D' },
                  ].map((c, i) => (
                    <div key={i} style={{ ...card, padding: '16px 20px' }}>
                      <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 6px' }}>{c.label}</p>
                      <p style={{ color: c.color, fontSize: 22, fontWeight: 700, margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>{c.count}</p>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {meetings.map(m => {
                    const start = new Date(m.start_time);
                    const end = new Date(m.end_time);
                    const isPast = end < new Date();
                    const needsComplete = ['scheduled', 'confirmed'].includes(m.status);
                    const isExpanded = completingMeeting === m.id;
                    const statusColors = { scheduled: { bg: '#F3E8FF', color: '#7C3AED' }, confirmed: { bg: '#E8F5E9', color: '#2E7D32' }, completed: { bg: '#E8F5E9', color: '#4CAF50' }, cancelled: { bg: '#FFEBEE', color: '#C62828' } };
                    const st = statusColors[m.status] || { bg: p.inputBg, color: p.textSecondary };

                    return (
                      <div key={m.id} style={{ ...card, border: needsComplete && isPast ? '2px solid #D4A574' : `1px solid ${p.cardBorder}`, overflow: 'hidden' }}>
                        <div style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                              <span style={{ fontSize: 16 }}>{m.meeting_type === 'google_meet' ? '📹' : '📞'}</span>
                              <p style={{ color: p.text, fontSize: 15, fontWeight: 600, margin: 0 }}>{m.title}</p>
                              <span style={{ background: st.bg, color: st.color, fontSize: 10, borderRadius: 20, padding: '2px 10px', fontWeight: 600, textTransform: 'capitalize' }}>{m.status}</span>
                              {needsComplete && isPast && <span style={{ background: '#FFF3CD', color: '#856404', fontSize: 10, borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>Needs Completion</span>}
                            </div>
                            <div style={{ display: 'flex', gap: 16, color: p.textSecondary, fontSize: 12 }}>
                              <span>📅 {start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              <span>🕐 {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} — {end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                              {m.crm_users?.name && <span>👤 {m.crm_users.name}</span>}
                            </div>

                            {m.meet_link && (
                              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
                                <a href={m.meet_link} target="_blank" rel="noreferrer" style={{ color: '#4CAF50', fontSize: 12 }}>🔗 Join Meeting</a>
                                {['scheduled', 'confirmed'].includes(m.status) && !m.recall_bot_id && !recordingStatus[m.id] && (
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button onClick={e => { e.stopPropagation(); startRecording(m.id, m.meet_link); }} style={{ background: '#D4183D', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer' }}>🔴 Record</button>
                                    <button onClick={e => { e.stopPropagation(); setShowZoomInput(prev => ({ ...prev, [m.id]: !prev[m.id] })); }} style={{ background: showZoomInput[m.id] ? '#2D8CFF' : p.inputBg, color: showZoomInput[m.id] ? '#fff' : '#2D8CFF', border: '1px solid #2D8CFF', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer' }}>🎥 Zoom</button>
                                  </div>
                                )}
                                {showZoomInput[m.id] && (
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <input value={zoomLinkInput[m.id] || ''} onChange={e => setZoomLinkInput(prev => ({ ...prev, [m.id]: e.target.value }))} placeholder="Paste Zoom link..."
                                      style={{ flex: 1, background: p.cardBg, border: '1px solid #2D8CFF', borderRadius: 6, padding: '5px 10px', fontSize: 11, outline: 'none', color: p.text }} />
                                    <button onClick={() => { startRecording(m.id, zoomLinkInput[m.id]); setShowZoomInput(prev => ({ ...prev, [m.id]: false })); }} style={{ background: '#2D8CFF', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}>Send Bot</button>
                                  </div>
                                )}
                              </div>
                            )}

                            {m.notes && (
                              <div style={{ marginTop: 10, padding: 12, background: p.inputBg, borderRadius: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                  <p style={{ color: p.textSecondary, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', margin: 0, fontWeight: 600 }}>Meeting Notes</p>
                                  {m.status === 'completed' && editingNotes !== m.id && (
                                    <button onClick={() => { setEditingNotes(m.id); setEditingNotesText(m.notes); }} style={{ background: 'none', border: 'none', color: p.primary, fontSize: 11, cursor: 'pointer', padding: 0 }}>✏️ Edit</button>
                                  )}
                                </div>
                                {editingNotes === m.id ? (
                                  <div>
                                    <textarea value={editingNotesText} onChange={e => setEditingNotesText(e.target.value)} rows={4} autoFocus
                                      style={{ width: '100%', background: p.cardBg, border: `1px solid ${p.primary}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', color: p.text }} />
                                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                      <button onClick={() => saveNotes(m.id)} style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, cursor: 'pointer' }}>Save</button>
                                      <button onClick={() => setEditingNotes(null)} style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 13, color: p.text, lineHeight: 1.7 }}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}
                                      components={{
                                        h1: ({ node, ...props }) => <h1 style={{ fontSize: 16, fontWeight: 700, color: p.text }} {...props} />,
                                        p: ({ node, ...props }) => <p style={{ margin: '0 0 8px', color: p.text }} {...props} />,
                                        ul: ({ node, ...props }) => <ul style={{ paddingLeft: 20 }} {...props} />,
                                        li: ({ node, ...props }) => <li style={{ color: p.text }} {...props} />,
                                        strong: ({ node, ...props }) => <strong style={{ color: p.text }} {...props} />,
                                      }}>
                                      {m.notes}
                                    </ReactMarkdown>
                                  </div>
                                )}
                              </div>
                            )}

                            {m.ai_summary && (
                              <div style={{ marginTop: 10, padding: 16, background: '#EBF4FF', borderRadius: 10, border: '1px solid rgba(26,111,173,0.1)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                  <p style={{ color: '#1a6fad', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', margin: 0, fontWeight: 600 }}>🤖 AI Summary</p>
                                  <button onClick={() => regenerateSummary(m.id)} disabled={processingTranscript[m.id]} style={{ background: 'none', border: 'none', color: p.primary, fontSize: 10, cursor: 'pointer', padding: 0 }}>
                                    {processingTranscript[m.id] ? '⏳' : '🔄 Regenerate'}
                                  </button>
                                </div>
                                <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}
                                    components={{
                                      h2: ({ node, ...props }) => <h2 style={{ fontSize: 13, fontWeight: 700, color: '#1a6fad', margin: '14px 0 6px', textTransform: 'uppercase', letterSpacing: 0.8 }} {...props} />,
                                      h3: ({ node, ...props }) => <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1a6fad', margin: '10px 0 4px' }} {...props} />,
                                      p: ({ node, ...props }) => <p style={{ margin: '0 0 8px', color: p.text }} {...props} />,
                                      ul: ({ node, ...props }) => <ul style={{ paddingLeft: 0, margin: '4px 0 8px', listStyle: 'none' }} {...props} />,
                                      li: ({ node, ...props }) => <li style={{ marginBottom: 4, color: p.text }} {...props} />,
                                      strong: ({ node, ...props }) => <strong style={{ fontWeight: 600, color: p.text }} {...props} />,
                                    }}>
                                    {m.ai_summary}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            )}

                            {/* action items removed — now rendered inside ai_summary markdown */}

                            {m.recall_bot_id && !m.transcript && !['sending_bot', 'recording'].includes(m.recording_status) && (
                              <button onClick={() => processTranscript(m.id)} disabled={processingTranscript[m.id]}
                                style={{ marginTop: 10, background: processingTranscript[m.id] ? p.textMuted : '#1a6fad', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', width: '100%' }}>
                                {processingTranscript[m.id] ? '⏳ Fetching...' : '📝 Fetch Transcript & AI Summary'}
                              </button>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                            {needsComplete && (
                              <button onClick={() => { setReschedulingMeeting(reschedulingMeeting === m.id ? null : m.id); }}
                                style={{ background: reschedulingMeeting === m.id ? p.text : p.inputBg, color: reschedulingMeeting === m.id ? '#fff' : p.textSecondary, border: `1px solid ${p.inputBorder}`, borderRadius: 6, padding: '6px 14px', fontSize: 11, cursor: 'pointer' }}>
                                {reschedulingMeeting === m.id ? '▲ Close' : '📅 Reschedule'}
                              </button>
                            )}
                            {needsComplete && (
                              <button onClick={() => { setCompletingMeeting(isExpanded ? null : m.id); setCompletionNotes(''); }}
                                style={{ background: isExpanded ? p.text : p.primary, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 11, cursor: 'pointer' }}>
                                {isExpanded ? '▲ Close' : '✓ Complete'}
                              </button>
                            )}
                          </div>
                        </div>

                        {reschedulingMeeting === m.id && (
                          <div style={{ borderTop: `1px solid ${p.cardBorder}`, padding: 20, background: p.inputBg }}>
                            <p style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', margin: '0 0 12px', fontWeight: 600 }}>New Date & Time</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <input type="date" value={rescheduleForm.date} onChange={e => setRescheduleForm(prev => ({ ...prev, date: e.target.value }))}
                                style={{ background: p.cardBg, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', color: p.text }} />
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                {['start_hour', 'start_min', null, 'end_hour', 'end_min'].map((field, i) => field === null ? (
                                  <span key={i} style={{ color: p.textSecondary }}>to</span>
                                ) : field.includes('min') ? (
                                  <select key={field} value={rescheduleForm[field]} onChange={e => setRescheduleForm(prev => ({ ...prev, [field]: e.target.value }))}
                                    style={{ width: 80, background: p.cardBg, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', color: p.text }}>
                                    {['00', '15', '30', '45'].map(min => <option key={min} value={min}>:{min}</option>)}
                                  </select>
                                ) : (
                                  <select key={field} value={rescheduleForm[field]} onChange={e => setRescheduleForm(prev => ({ ...prev, [field]: e.target.value }))}
                                    style={{ flex: 1, background: p.cardBg, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', color: p.text }}>
                                    {Array.from({ length: 24 }, (_, i) => <option key={i} value={String(i)}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>)}
                                  </select>
                                ))}
                              </div>
                              <div style={{ display: 'flex', gap: 10 }}>
                                <button onClick={() => rescheduleMeeting(m.id)} disabled={savingReschedule || !rescheduleForm.date}
                                  style={{ flex: 1, background: rescheduleForm.date ? p.primary : p.textMuted, color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, cursor: rescheduleForm.date ? 'pointer' : 'default' }}>
                                  {savingReschedule ? '⏳ Rescheduling...' : '✓ Confirm & Notify'}
                                </button>
                                <button onClick={() => setReschedulingMeeting(null)} style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                              </div>
                            </div>
                          </div>
                        )}

                        {isExpanded && (
                          <div style={{ borderTop: `1px solid ${p.cardBorder}`, padding: 20, background: p.inputBg }}>
                            <textarea value={completionNotes} onChange={e => setCompletionNotes(e.target.value)}
                              placeholder="What was discussed? Key takeaways, next steps..."
                              rows={4} style={{ width: '100%', background: p.cardBg, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', color: p.text }} />
                            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                              <button onClick={() => completeMeeting(m.id)} disabled={savingCompletion}
                                style={{ flex: 1, background: savingCompletion ? p.textMuted : '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, cursor: 'pointer' }}>
                                {savingCompletion ? '⏳ Saving...' : '✓ Mark Complete & Save Notes'}
                              </button>
                              <button onClick={() => setCompletingMeeting(null)} style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{ color: p.textSecondary, fontSize: 13, margin: 0 }}>{documents.length} document{documents.length !== 1 ? 's' : ''}</p>
              {isAdmin && (
                <button onClick={() => { setEditingDoc(null); setDocForm({ title: '', type: 'Contract', notes: '' }); setDocFile(null); setShowDocModal(true); }}
                  style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>+ Add Document</button>
              )}
            </div>
            {documents.length === 0 ? (
              <div style={{ ...card, padding: 60, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
                <p style={{ color: p.text, fontSize: 16, fontWeight: 500, margin: '0 0 8px' }}>No documents yet</p>
                <p style={{ color: p.textSecondary, fontSize: 13, margin: 0 }}>Add contracts, proposals, or invoices</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {documents.map(doc => (
                  <div key={doc.id} style={{ ...card, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 24 }}>📄</span>
                      <div>
                        <p style={{ color: p.text, fontSize: 13, fontWeight: 600, margin: 0 }}>{doc.title}</p>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3 }}>
                          <span style={{ background: p.inputBg, color: p.textSecondary, fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{doc.type}</span>
                          <span style={{ color: p.textMuted, fontSize: 11 }}>{doc.uploaded_by_user?.name} · {new Date(doc.created_at).toLocaleDateString()}</span>
                          {doc.notes && <span style={{ color: p.textSecondary, fontSize: 11 }}>· {doc.notes}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <a href={doc.file_url} target="_blank" rel="noreferrer"
                        style={{ background: p.inputBg, color: p.text, border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', textDecoration: 'none' }}>
                        {doc.file_url?.match(/\.(pdf|png|jpg|jpeg|gif|webp)(\?|$)/i) ? '👁 View' : '📥 Download'}
                      </a>
                      {isAdmin && (
                        <>
                          <button onClick={() => { setEditingDoc(doc); setDocForm({ title: doc.title, type: doc.type, notes: doc.notes || '' }); setDocFile(null); setShowDocModal(true); }}
                            style={{ background: p.inputBg, color: p.text, border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>Edit</button>
                          <button onClick={async () => { if (!window.confirm('Delete?')) return; await axios.delete(`${API}/documents/${doc.id}`, { headers: getHeaders() }); fetchAll(); }}
                            style={{ background: 'none', color: '#D4183D', border: 'none', borderRadius: 6, padding: '6px 8px', fontSize: 12, cursor: 'pointer' }}>Delete</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LISTING PAGE TAB */}
        {activeTab === 'vendor-page' && (
          <div style={{ ...card, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ color: p.text, fontSize: 15, fontWeight: 600, margin: 0 }}>Marketplace Listing</h3>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: vendorPage.published ? '#155724' : p.textSecondary }}>
                  <input type="checkbox" checked={vendorPage.published || false} onChange={e => setVendorPage(prev => ({ ...prev, published: e.target.checked }))} style={{ accentColor: p.primary }} />
                  {vendorPage.published ? '🟢 Published' : 'Unpublished'}
                </label>
                <button onClick={saveVendorPage} disabled={savingVendorPage} style={{ background: savingVendorPage ? p.textMuted : p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer' }}>{savingVendorPage ? 'Saving...' : '💾 Save'}</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 16px', marginBottom: 20 }}>
              <div><label style={labelStyle}>Display Name</label><input value={vendorPage.display_name || ''} onChange={e => setVendorPage(prev => ({ ...prev, display_name: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Tagline</label><input value={vendorPage.tagline || ''} onChange={e => setVendorPage(prev => ({ ...prev, tagline: e.target.value }))} style={inputStyle} placeholder="Short description..." /></div>
              <div><label style={labelStyle}>Listing Type</label><select value={vendorPage.venue_type || ''} onChange={e => setVendorPage(prev => ({ ...prev, venue_type: e.target.value }))} style={inputStyle}><option value="">Select...</option>{LISTING_TYPES.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
              <div><label style={labelStyle}>Capacity</label><select value={vendorPage.guest_capacity || ''} onChange={e => setVendorPage(prev => ({ ...prev, guest_capacity: e.target.value }))} style={inputStyle}><option value="">Select...</option>{CAPACITY_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
              <div><label style={labelStyle}>Price Tier</label><select value={vendorPage.price_tier || ''} onChange={e => setVendorPage(prev => ({ ...prev, price_tier: e.target.value }))} style={inputStyle}>{PRICE_TIERS.map(pt => <option key={pt} value={pt}>{pt}</option>)}</select></div>
            </div>
            <div style={{ marginBottom: 20 }}><label style={labelStyle}>About</label><textarea value={vendorPage.about || ''} onChange={e => setVendorPage(prev => ({ ...prev, about: e.target.value }))} rows={4} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Describe this client..." /></div>
            {[
              { label: 'Features & Amenities', field: 'amenities', options: FEATURES_OPTIONS },
              { label: 'Services Offered', field: 'services', options: SERVICES_OPTIONS },
              { label: 'Diversity Tags', field: 'diversity_tags', options: DIVERSITY_OPTIONS },
            ].map(({ label, field, options }) => (
              <div key={field} style={{ marginBottom: 20 }}>
                <label style={labelStyle}>{label}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {options.map(opt => {
                    const selected = (vendorPage[field] || []).includes(opt);
                    return (
                      <button key={opt} onClick={() => setVendorPage(prev => ({ ...prev, [field]: toggleArrayItem(prev[field], opt) }))}
                        style={{ background: selected ? p.primary : p.cardBg, color: selected ? '#fff' : p.textSecondary, border: `1px solid ${selected ? p.primary : p.inputBorder}`, borderRadius: 20, padding: '5px 14px', fontSize: 12, cursor: 'pointer' }}>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Social Links</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {['instagram', 'facebook', 'website', 'linkedin'].map(platform => (
                  <div key={platform}>
                    <label style={{ ...labelStyle, fontSize: 10 }}>{platform}</label>
                    <input value={vendorPage.social_links?.[platform] || ''} onChange={e => setVendorPage(prev => ({ ...prev, social_links: { ...(prev.social_links || {}), [platform]: e.target.value } }))} style={inputStyle} placeholder={`https://${platform}.com/...`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* FINANCE TAB */}
        {activeTab === 'finance' && canFinance && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              <div style={{ ...card, padding: 20 }}><p style={{ color: p.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Total Earned</p><p style={{ color: p.primary, fontSize: 28, fontWeight: 700, margin: 0, fontFamily: 'Playfair Display, Georgia, serif' }}>${totalFinance.toLocaleString()}</p></div>
              <div style={{ ...card, padding: 20 }}><p style={{ color: p.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Pending</p><p style={{ color: '#D4A574', fontSize: 28, fontWeight: 700, margin: 0, fontFamily: 'Playfair Display, Georgia, serif' }}>${pendingFinance.toLocaleString()}</p></div>
              <div style={{ ...card, padding: 20 }}><p style={{ color: p.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Transactions</p><p style={{ color: p.text, fontSize: 28, fontWeight: 700, margin: 0, fontFamily: 'Playfair Display, Georgia, serif' }}>{finance.length}</p></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button onClick={() => { setEditingFinance(null); setFinanceForm({ type: 'Commission', amount: '', description: '', status: 'Pending', date: new Date().toISOString().split('T')[0] }); setShowFinanceModal(true); }}
                style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, cursor: 'pointer' }}>+ Add Transaction</button>
            </div>
            {finance.length === 0 ? (
              <div style={{ ...card, padding: 60, textAlign: 'center' }}><div style={{ fontSize: 48, marginBottom: 16 }}>💰</div><p style={{ color: p.text, fontSize: 16, fontWeight: 500, margin: '0 0 8px' }}>No transactions yet</p></div>
            ) : (
              <div style={{ ...card, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: p.inputBg }}>{['Type', 'Amount', 'Description', 'Status', 'Date', 'By', ''].map(h => (<th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: p.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>))}</tr></thead>
                  <tbody>{finance.map((f, i) => (
                    <tr key={f.id} style={{ borderTop: `1px solid ${p.cardBorder}`, background: i % 2 === 0 ? p.cardBg : p.inputBg }}>
                      <td style={{ padding: '12px 16px' }}><span style={{ background: p.inputBg, color: p.textSecondary, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>{f.type}</span></td>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: f.type === 'Refund' ? '#D4183D' : p.primary, fontWeight: 600 }}>${parseFloat(f.amount).toLocaleString()}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: p.textSecondary }}>{f.description || '—'}</td>
                      <td style={{ padding: '12px 16px' }}><span style={{ background: f.status === 'Completed' ? '#D4EDDA' : f.status === 'Failed' ? '#F8D7DA' : '#FFF3CD', color: f.status === 'Completed' ? '#155724' : f.status === 'Failed' ? '#721C24' : '#856404', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>{f.status}</span></td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: p.textSecondary }}>{new Date(f.date).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: p.textSecondary }}>{f.crm_users?.name || '—'}</td>
                      <td style={{ padding: '12px 16px' }}><button onClick={() => { setEditingFinance(f); setFinanceForm({ type: f.type, amount: f.amount, description: f.description || '', status: f.status, date: f.date }); setShowFinanceModal(true); }} style={{ background: p.inputBg, border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', color: p.textSecondary }}>Edit</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* MODALS */}

        {/* Document Modal */}
        {showDocModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: p.cardBg, borderRadius: 16, padding: 32, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: `1px solid ${p.cardBorder}` }}>
              <h2 style={{ color: p.text, fontSize: 18, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 20px' }}>{editingDoc ? 'Edit Document' : 'Add Document'}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div><label style={labelStyle}>Title *</label><input value={docForm.title} onChange={e => setDocForm(prev => ({ ...prev, title: e.target.value }))} style={inputStyle} placeholder="e.g. Signed Contract 2026" /></div>
                <div><label style={labelStyle}>Type</label><select value={docForm.type} onChange={e => setDocForm(prev => ({ ...prev, type: e.target.value }))} style={inputStyle}>{['Contract', 'Invoice', 'Proposal', 'NDA', 'Presentation', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label style={labelStyle}>Notes</label><textarea value={docForm.notes} onChange={e => setDocForm(prev => ({ ...prev, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
                {!editingDoc && (
                  <div><label style={labelStyle}>File *</label>
                    <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.csv"
                      onChange={e => { const file = e.target.files[0]; if (file) { setDocFile(file); if (!docForm.title) setDocForm(prev => ({ ...prev, title: file.name.replace(/\.[^.]+$/, '') })); } }}
                      style={{ fontSize: 13, width: '100%', color: p.text }} />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button onClick={async () => {
                  if (!editingDoc && !docFile) return alert('Please select a file');
                  if (!docForm.title) return alert('Title is required');
                  setSavingDoc(true);
                  try {
                    if (editingDoc) { await axios.put(`${API}/documents/${editingDoc.id}`, docForm, { headers: getHeaders() }); }
                    else {
                      const formData = new FormData();
                      formData.append('file', docFile); formData.append('title', docForm.title); formData.append('type', docForm.type); formData.append('notes', docForm.notes); formData.append('client_id', id);
                      await axios.post(`${API}/documents/upload`, formData, { headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' } });
                    }
                    fetchAll(); setShowDocModal(false);
                  } catch (err) { alert('Failed to save document'); }
                  setSavingDoc(false);
                }} disabled={savingDoc}
                  style={{ flex: 1, background: savingDoc ? p.textMuted : p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                  {savingDoc ? '⏳ Saving...' : editingDoc ? 'Save Changes' : 'Upload'}
                </button>
                <button onClick={() => { setShowDocModal(false); setEditingDoc(null); }} style={{ flex: 1, background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Finance Modal */}
        {showFinanceModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: p.cardBg, borderRadius: 16, padding: 32, width: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: `1px solid ${p.cardBorder}` }}>
              <h2 style={{ color: p.text, fontSize: 18, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 20px' }}>{editingFinance ? 'Edit Transaction' : 'Add Transaction'}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={labelStyle}>Type</label><select value={financeForm.type} onChange={e => setFinanceForm(prev => ({ ...prev, type: e.target.value }))} style={inputStyle}>{FINANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                  <div><label style={labelStyle}>Amount ($) *</label><input type="number" value={financeForm.amount} onChange={e => setFinanceForm(prev => ({ ...prev, amount: e.target.value }))} style={inputStyle} placeholder="0.00" /></div>
                </div>
                <div><label style={labelStyle}>Description</label><input value={financeForm.description} onChange={e => setFinanceForm(prev => ({ ...prev, description: e.target.value }))} style={inputStyle} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={labelStyle}>Status</label><select value={financeForm.status} onChange={e => setFinanceForm(prev => ({ ...prev, status: e.target.value }))} style={inputStyle}>{FINANCE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                  <div><label style={labelStyle}>Date</label><input type="date" value={financeForm.date} onChange={e => setFinanceForm(prev => ({ ...prev, date: e.target.value }))} style={inputStyle} /></div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button onClick={async () => {
                  try {
                    if (editingFinance) { await axios.put(`${API}/clients/finance/${editingFinance.id}`, financeForm, { headers: getHeaders() }); }
                    else { await axios.post(`${API}/clients/${id}/finance`, financeForm, { headers: getHeaders() }); }
                    setShowFinanceModal(false); setEditingFinance(null);
                    setFinanceForm({ type: 'Commission', amount: '', description: '', status: 'Pending', date: new Date().toISOString().split('T')[0] });
                    const res = await axios.get(`${API}/clients/${id}/finance`, { headers: getHeaders() }); setFinance(res.data);
                  } catch (err) { console.error(err); }
                }} disabled={!financeForm.amount}
                  style={{ flex: 1, background: financeForm.amount ? p.primary : p.textMuted, color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, cursor: financeForm.amount ? 'pointer' : 'default' }}>
                  {editingFinance ? 'Save Changes' : 'Add Transaction'}
                </button>
                <button onClick={() => { setShowFinanceModal(false); setEditingFinance(null); }} style={{ flex: 1, background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Email Step 1 */}
        {showEmailStep1 && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: p.cardBg, borderRadius: 16, padding: 40, width: 580, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${p.cardBorder}` }}>
              <h2 style={{ color: p.text, fontSize: 22, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 6px' }}>New Email</h2>
              <p style={{ color: p.textSecondary, fontSize: 13, margin: '0 0 24px' }}>To: <strong>{client.business_name}</strong></p>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Send To</label>
                <select value={emailRecipient ? JSON.stringify(emailRecipient) : ''} onChange={e => { if (e.target.value) setEmailRecipient(JSON.parse(e.target.value)); else setEmailRecipient({ email: client.contact_email, name: `${client.contact_first_name} ${client.contact_last_name}` }); }} style={inputStyle}>
                  <option value="">👤 {client.contact_first_name} {client.contact_last_name} — {client.contact_email} (Primary)</option>
                  {clientPeople.filter(per => per.email && per.email !== client.contact_email).map(per => (
                    <option key={per.id} value={JSON.stringify({ email: per.email, name: `${per.first_name} ${per.last_name}`, person_id: per.id })}>
                      👤 {per.first_name} {per.last_name} — {per.email}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 28 }}>
                <label style={labelStyle}>Choose Template</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                  <div onClick={() => selectTemplate(null)} style={{ padding: '12px 16px', borderRadius: 10, border: selectedTemplate === null ? `2px solid ${p.primary}` : `1px solid ${p.cardBorder}`, cursor: 'pointer', background: selectedTemplate === null ? p.inputBg : p.cardBg }}>
                    <p style={{ color: p.text, fontSize: 13, fontWeight: 500, margin: 0 }}>✏️ Blank email</p>
                    <p style={{ color: p.textSecondary, fontSize: 12, margin: '2px 0 0' }}>Start from scratch</p>
                  </div>
                  {templates.map(t => (
                    <div key={t.id} onClick={() => selectTemplate(t)} style={{ padding: '12px 16px', borderRadius: 10, border: selectedTemplate?.id === t.id ? `2px solid ${p.primary}` : `1px solid ${p.cardBorder}`, cursor: 'pointer', background: selectedTemplate?.id === t.id ? p.inputBg : p.cardBg }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <p style={{ color: p.text, fontSize: 13, fontWeight: 500, margin: 0 }}>{t.name}</p>
                        <span style={{ background: p.inputBg, color: p.textSecondary, fontSize: 11, borderRadius: 20, padding: '2px 8px' }}>{t.category}</span>
                      </div>
                      <p style={{ color: p.textSecondary, fontSize: 12, margin: '2px 0 0' }}>{t.subject}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => { setShowEmailStep1(false); setShowEmailStep2(true); setEmailActiveField('body'); setEmailEditorTab('visual'); }} style={{ flex: 1, background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>Continue →</button>
                <button onClick={() => setShowEmailStep1(false)} style={{ flex: 1, background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Email Step 2 */}
        {showEmailStep2 && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: p.cardBg, borderRadius: 16, width: '90vw', maxWidth: 1100, height: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: `1px solid ${p.cardBorder}` }}>
              <div style={{ padding: '20px 28px', borderBottom: `1px solid ${p.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                  <h2 style={{ color: p.text, fontSize: 20, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 2px' }}>Compose Email</h2>
                  <p style={{ color: p.textSecondary, fontSize: 12, margin: 0 }}>To: <strong>{client.business_name}</strong> · {emailRecipient?.name || `${client.contact_first_name} ${client.contact_last_name}`}</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setShowEmailStep2(false); setShowEmailStep1(true); }} style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>← Back</button>
                  {emailSuccess ? (
                    <button style={{ background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13 }}>✅ Email Sent!</button>
                  ) : (
                    <button onClick={sendClientEmail} disabled={savingEmail || !emailForm.subject || !emailForm.body_html} style={{ background: savingEmail ? p.textMuted : p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>
                      {savingEmail ? '⏳ Sending...' : '📤 Send Email'}
                    </button>
                  )}
                  <button onClick={() => setShowEmailStep2(false)} style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>✕</button>
                </div>
              </div>
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <div style={{ flex: 1, padding: 28, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Subject *</label>
                    <input ref={emailSubjectRef} value={emailForm.subject} onChange={e => setEmailForm(prev => ({ ...prev, subject: e.target.value }))} onFocus={() => setEmailActiveField('subject')}
                      style={{ ...inputStyle, border: emailActiveField === 'subject' ? `1px solid ${p.primary}` : `1px solid ${p.inputBorder}` }} placeholder="Email subject..." />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 8 }}>
                      <label style={{ ...labelStyle, marginBottom: 0, marginRight: 'auto' }}>Body *</label>
                      {['visual', 'html'].map(tab => (
                        <button key={tab} onClick={() => setEmailEditorTab(tab)} style={{ background: emailEditorTab === tab ? p.text : p.inputBg, color: emailEditorTab === tab ? '#fff' : p.textSecondary, border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer' }}>
                          {tab === 'html' ? 'HTML' : '✨ Visual'}
                        </button>
                      ))}
                    </div>
                    {emailEditorTab === 'html' ? (
                      <textarea ref={emailBodyRef} value={emailForm.body_html} onChange={e => setEmailForm(prev => ({ ...prev, body_html: e.target.value }))} onFocus={() => setEmailActiveField('body')}
                        rows={14} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12, resize: 'vertical', lineHeight: 1.6 }} placeholder="Email body HTML..." />
                    ) : (
                      <TiptapEditor content={emailForm.body_html} onChange={html => setEmailForm(prev => ({ ...prev, body_html: html }))} onFocus={() => setEmailActiveField('body')} placeholder="Write your email..." minHeight={280} />
                    )}
                  </div>
                  {userSignature && (
                    <div style={{ background: includeSignature ? p.inputBg : p.cardBg, borderRadius: 8, padding: 14, border: `1px solid ${p.inputBorder}`, opacity: includeSignature ? 1 : 0.5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: includeSignature ? 8 : 0 }}>
                        <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: 0 }}>Signature</p>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: p.textSecondary }}>
                          <input type="checkbox" checked={includeSignature} onChange={e => setIncludeSignature(e.target.checked)} style={{ accentColor: p.primary }} />
                          {includeSignature ? 'Included' : 'Excluded'}
                        </label>
                      </div>
                      {includeSignature && <div dangerouslySetInnerHTML={{ __html: userSignature }} style={{ fontSize: 13 }} />}
                    </div>
                  )}
                </div>
                <div style={{ width: 200, borderLeft: `1px solid ${p.cardBorder}`, padding: 20, overflowY: 'auto', background: p.inputBg, flexShrink: 0 }}>
                  <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 14px', fontWeight: 600 }}>Merge Tags</p>
                  {MERGE_TAGS.map(({ tag, label }) => (
                    <button key={tag} onClick={() => insertEmailTag(tag)} draggable onDragStart={e => e.dataTransfer.setData('text/plain', tag)}
                      style={{ display: 'block', width: '100%', background: p.cardBg, border: `1px solid ${p.cardBorder}`, borderRadius: 8, padding: '8px 10px', marginBottom: 7, cursor: 'grab', textAlign: 'left' }}>
                      <p style={{ color: p.text, fontSize: 11, fontWeight: 500, margin: '0 0 2px' }}>{label}</p>
                      <p style={{ color: p.primary, fontSize: 10, margin: 0, fontFamily: 'monospace' }}>{tag}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <ScheduleMeetingModal
          show={showMeetingModal}
          onClose={() => setShowMeetingModal(false)}
          onCreated={() => fetchAll()}
          clientId={id}
          companyId={client?.converted_from}
          companyName={client?.business_name}
          state={client?.state}
          people={clientPeople}
          contactEmail={client?.contact_email}
          contactName={`${client?.contact_first_name} ${client?.contact_last_name}`}
        />
      </div>
    </div>
  );
}