import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useRole } from '../hooks/useRole';
import TiptapEditor from '../components/TiptapEditor';
import ScheduleMeetingModal from '../components/ScheduleMeetingModal';
import LocationSelector from '../components/LocationSelector';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
const EMAIL_STATUS_COLORS = {
  sent: { bg: '#F5F3EF', text: '#717182', label: 'Sent' },
  delivered: { bg: '#E3F2FD', text: '#1565C0', label: 'Delivered' },
  opened: { bg: '#E8F5E9', text: '#2E7D32', label: 'Opened' },
  clicked: { bg: '#FFF3E0', text: '#E65100', label: 'Clicked' },
  bounced: { bg: '#FFEBEE', text: '#C62828', label: 'Bounced' },
};

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const MERGE_TAGS = [
  { tag: '{{first_name}}', label: 'First Name' },
  { tag: '{{last_name}}', label: 'Last Name' },
  { tag: '{{company_name}}', label: 'Company Name' },
  { tag: '{{sender_name}}', label: 'Sender Name' },
  { tag: '{{sender_email}}', label: 'Sender Email' },
  { tag: '{{city}}', label: 'City' },
  { tag: '{{stage}}', label: 'Stage' },
];

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

  const labelStyle = { color: '#717182', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 2 };
  const inputStyle = { width: '100%', background: '#F3F3F5', border: '1px solid #8E9B8B', borderRadius: 6, padding: '5px 8px', color: '#3E423D', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' };

  return (
    <div style={{ marginBottom: 8 }}>
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
        style={{ padding: '6px 10px', color: val ? '#1a1d1a' : '#CBCED4', fontSize: 13, fontWeight: val ? 500 : 400, cursor: 'text', minHeight: 22, display: 'flex', alignItems: 'center', background: '#F5F3EF', borderRadius: 6 }}
        onMouseOver={e => e.currentTarget.style.background = '#EBE8E1'}
        onMouseOut={e => e.currentTarget.style.background = '#F5F3EF'}>
          {val || <span style={{ fontStyle: 'italic', fontSize: 12 }}>—</span>}
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
  const [teamUsers, setTeamUsers] = useState([]);
  const { can } = useRole();
  const [marketingData, setMarketingData] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [showDocModal, setShowDocModal] = useState(false);
  const [docForm, setDocForm] = useState({ title: '', type: 'Other', notes: '' });
  const [docFile, setDocFile] = useState(null);
  const [savingDoc, setSavingDoc] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [emailTrackingData, setEmailTrackingData] = useState([]);
  const [expandedActivity, setExpandedActivity] = useState({});
  const [emailBodies, setEmailBodies] = useState({});
  const [activityPage, setActivityPage] = useState(1);
  const [activityPageSize, setActivityPageSize] = useState(5);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [completingMeeting, setCompletingMeeting] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [savingCompletion, setSavingCompletion] = useState(false);
  const [editingNotes, setEditingNotes] = useState(null); // meeting id being edited
  const [editingNotesText, setEditingNotesText] = useState('');
  const [zoomLinkInput, setZoomLinkInput] = useState({}); // { [meetingId]: url }
  const [showZoomInput, setShowZoomInput] = useState({}); // { [meetingId]: bool }
  const [reschedulingMeeting, setReschedulingMeeting] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({ date: '', start_hour: '10', start_min: '00', end_hour: '11', end_min: '00' });
  const [savingReschedule, setSavingReschedule] = useState(false);

  // Email composer state
  const [showEmailStep1, setShowEmailStep1] = useState(false);
  const [showEmailStep2, setShowEmailStep2] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [emailForm, setEmailForm] = useState({ person_id: '', subject: '', body_html: '', signature_html: '' });
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailActiveField, setEmailActiveField] = useState('body');
  const [emailEditorTab, setEmailEditorTab] = useState('visual');
  const emailBodyRef = useRef(null);
  const emailSubjectRef = useRef(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertForm, setConvertForm] = useState({ contract_type: 'RevShare', commission_rate: 5, contract_amount: 0, contract_signed_date: '', notes: '' });
  const [converting, setConverting] = useState(false);
  const [includeSignature, setIncludeSignature] = useState(true);
  const [userSignature, setUserSignature] = useState('');

  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
  const convertToClient = async () => {
    setConverting(true);
    try {
      const res = await axios.post(`${API}/clients/convert/${id}`, convertForm, { headers: getHeaders() });
      setShowConvertModal(false);
      navigate(`/clients/${res.data.id}`);
    } catch (err) { console.error(err); alert('Conversion failed.'); }
    setConverting(false);
  };

  useEffect(() => { fetchCompany(); fetchActivity(); fetchTemplates(); fetchMarketingData(); fetchEmailTracking(); fetchMeetings(); fetchDocuments(); }, [id]);
    const fetchTeamUsers = async () => {
    try {
      const res = await axios.get(`${API}/users`, { headers: getHeaders() });
      setTeamUsers(res.data);
    } catch (err) {} // non-admins will get 403, that's fine
  };

  useEffect(() => { fetchTeamUsers(); }, []);

  const fetchCompany = async () => {
    try {
      const res = await axios.get(`${API}/contacts/companies/${id}`, { headers: getHeaders() });
      setCompany(res.data);
      setNextAction(res.data.next_action || '');
    } catch (err) { console.error(err); }
    setLoading(false);
    // Fetch user signature
    try {
      const sigRes = await axios.get(`${API}/users/me`, { headers: getHeaders() });
      setUserSignature(sigRes.data.email_signature || '');
    } catch (err) {}
    try {
      const gmailRes = await axios.get(`${API}/emails/gmail-status`, { headers: getHeaders() });
      setGmailConnected(gmailRes.data);
    } catch (err) {}
  };

  const fetchActivity = async () => {
    try {
      const res = await axios.get(`${API}/contacts/companies/${id}/activity`, { headers: getHeaders() });
      setActivity(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchTemplates = async () => {
    try {
      const res = await axios.get(`${API}/emails/templates`, { headers: getHeaders() });
      setTemplates(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchMarketingData = async () => {
    try {
      const res = await axios.get(`${API}/marketing/company/${id}`, { headers: getHeaders() });
      setMarketingData(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchEmailTracking = async () => {
    try {
      const res = await axios.get(`${API}/emails/sent/company/${id}`, { headers: getHeaders() });
      setEmailTrackingData(res.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchDocuments = async () => {
    try {
      const res = await axios.get(`${API}/documents?company_id=${id}`, { headers: getHeaders() });
      setDocuments(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchMeetings = async () => {
    try {
      const res = await axios.get(`${API}/calendar/meetings/company/${id}`, { headers: getHeaders() });
      setMeetings(res.data);
    } catch (err) { console.error(err); }
  };

  const completeMeeting = async (meetingId) => {
    setSavingCompletion(true);
    try {
      await axios.put(`${API}/calendar/meetings/${meetingId}`, {
        status: 'completed',
        notes: completionNotes,
      }, { headers: getHeaders() });
      setCompletingMeeting(null);
      setCompletionNotes('');
      fetchMeetings();
      fetchDocuments();
      fetchActivity();
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
      setReschedulingMeeting(null);
      fetchMeetings();
      fetchActivity();
    } catch (err) { console.error(err); alert('Reschedule failed'); }
    setSavingReschedule(false);
  };

  const [recordingStatus, setRecordingStatus] = useState({});
  const [processingTranscript, setProcessingTranscript] = useState({});

  const startRecording = async (meetingId, meetingUrl) => {
    try {
      setRecordingStatus(prev => ({ ...prev, [meetingId]: 'sending_bot' }));
      await axios.post(`${API}/calendar/meetings/${meetingId}/record`, 
        { meeting_url: meetingUrl },
        { headers: getHeaders() }
      );
      // Poll for status updates
      pollRecordingStatus(meetingId);
    } catch (err) {
      console.error(err);
      alert('Failed to start recording: ' + (err.response?.data?.error || err.message));
      setRecordingStatus(prev => ({ ...prev, [meetingId]: null }));
    }
  };

  const saveNotes = async (meetingId) => {
    try {
      await axios.put(`${API}/calendar/meetings/${meetingId}`, {
        notes: editingNotesText,
      }, { headers: getHeaders() });
      setEditingNotes(null);
      fetchMeetings();
    } catch (err) { console.error(err); }
  };

  const pollRecordingStatus = (meetingId) => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/calendar/meetings/${meetingId}/recording-status`, { headers: getHeaders() });
        const status = res.data.status;
        setRecordingStatus(prev => ({ ...prev, [meetingId]: status }));

        if (status === 'processing' || status === 'completed' || status === 'failed') {
          clearInterval(interval);
          if (status === 'processing') {
            // Auto-fetch transcript
            processTranscript(meetingId);
          }
          if (status === 'completed') {
            fetchMeetings();
          }
        }
      } catch (err) {
        console.error('Poll error:', err);
        clearInterval(interval);
      }
    }, 10000); // Check every 10 seconds
  };

  const processTranscript = async (meetingId) => {
    setProcessingTranscript(prev => ({ ...prev, [meetingId]: true }));
    try {
      await axios.post(`${API}/calendar/meetings/${meetingId}/process-transcript`, {}, { headers: getHeaders() });
      setRecordingStatus(prev => ({ ...prev, [meetingId]: 'completed' }));
      fetchMeetings();
    } catch (err) {
      console.error('Process transcript error:', err);
      // Might not be ready yet — try again in 30 seconds
      setTimeout(() => processTranscript(meetingId), 30000);
    }
    setProcessingTranscript(prev => ({ ...prev, [meetingId]: false }));
  };

  const regenerateSummary = async (meetingId) => {
    setProcessingTranscript(prev => ({ ...prev, [meetingId]: true }));
    try {
      await axios.post(`${API}/calendar/meetings/${meetingId}/regenerate-summary`, {}, { headers: getHeaders() });
      fetchMeetings();
    } catch (err) {
      console.error(err);
      alert('Failed to regenerate summary');
    }
    setProcessingTranscript(prev => ({ ...prev, [meetingId]: false }));
  };

  const fetchEmailBody = async (activityId, companyId) => {
    if (emailBodies[activityId]) return;
    try {
      const res = await axios.get(`${API}/emails/sent/company/${companyId}`, { headers: getHeaders() });
      setEmailBodies(prev => ({ ...prev, [activityId]: res.data }));
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

  // Email composer functions
  const resolveTags = (html, person) => {
    if (!html) return '';
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return html
      .replace(/{{first_name}}/g, person?.first_name || '')
      .replace(/{{last_name}}/g, person?.last_name || '')
      .replace(/{{company_name}}/g, company?.company_name || '')
      .replace(/{{sender_name}}/g, user?.full_name || user?.name || 'Dan Sitbon')
      .replace(/{{sender_email}}/g, user?.email || 'you@yourcompany.com')
      .replace(/{{city}}/g, company?.city || '')
      .replace(/{{stage}}/g, company?.stage || '');
  };

  const openEmailComposer = () => {
    setEmailForm({ person_id: '', subject: '', body_html: '', signature_html: '' });
    setSelectedTemplate(null);
    setEmailSuccess(false);
    setEmailEditorTab('visual');
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

  const proceedToStep2 = () => {
    setShowEmailStep1(false);
    setShowEmailStep2(true);
    setEmailActiveField('body');
    setEmailEditorTab('visual');
  };

  const getSelectedPerson = () => company?.crm_people?.find(p => p.id === emailForm.person_id) || null;
  const resolvedSubject = () => resolveTags(emailForm.subject, getSelectedPerson());
  const resolvedBody = () => {
    const body = resolveTags(emailForm.body_html, getSelectedPerson());
    const sig = includeSignature ? resolveTags(userSignature || '', getSelectedPerson()) : '';
    if (!sig) return body;
    return body + '<br><br><div style="margin-top:16px;padding-top:12px;border-top:1px solid #e0e0e0;">' + sig + '</div>';
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
        // Tiptap visual mode — append to content
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

  const sendEmail = async () => {
    if (!emailForm.subject || !emailForm.body_html) return;
    setSavingEmail(true);
    const person = getSelectedPerson();
    try {
      const res = await axios.post(`${API}/emails/send`, {
        company_id: id,
        person_id: emailForm.person_id || null,
        template_id: selectedTemplate?.id || null,
        subject: resolvedSubject(),
        body_html: resolvedBody(),
        recipient_email: person?.email || null,
        recipient_name: person ? `${person.first_name} ${person.last_name}` : null,
      }, { headers: getHeaders() });
      fetchActivity();
      fetchEmailTracking();
      setEmailSuccess(res.data.sendGridSuccess ? 'sent' : 'draft');
      setTimeout(() => { setShowEmailStep2(false); setEmailSuccess(false); }, 2500);
    } catch (err) { console.error(err); }
    setSavingEmail(false);
  };

  const filteredActivity = (() => {
    if (filterPerson === 'meetings') {
      return activity.filter(a =>
        ['Meeting Scheduled', 'Meeting Completed', 'Meeting Cancelled', 'Meeting No-show', 'Meeting Recorded'].includes(a.action)
      );
    }
    if (filterPerson === 'documents') {
      return activity.filter(a => a.action === 'Document Added');
    }
    if (filterPerson) {
      return activity.filter(a => a.person_id === filterPerson || (!a.person_id && filterPerson === 'company'));
    }
    return activity;
  })();

  const lastActivity = activity[0];

  const inputStyle = { width: '100%', background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '9px 12px', color: '#3E423D', fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 5 };

  if (loading) return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: 40, color: '#717182' }}>Loading...</div>
    </div>
  );

  if (!company) return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: 40, color: '#D4183D' }}>Company not found.</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: 40 }}>

        <button onClick={() => navigate('/contacts')} style={{ background: 'none', border: 'none', color: '#717182', fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}>← Back to Companies</button>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>{company.category}{company.business_type ? ` · ${company.business_type}` : ''}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ color: '#3E423D', fontSize: 32, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>{company.company_name}</h1>
            <div style={{ display: 'flex', gap: 8 }}>
            {company.stage === 'Closed Won' && can('company:edit') && <button onClick={() => setShowConvertModal(true)} style={{ background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>🤝 Convert to Client</button>}
            {company.stage === 'Converted' && <span style={{ background: '#D4EDDA', color: '#155724', borderRadius: 8, padding: '8px 16px', fontSize: 13 }}>✅ Converted to Client</span>}
            {can('email:send') && <button onClick={openEmailComposer} style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>📧 Send Email</button>}
            <button onClick={() => setShowMeetingModal(true)} style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>📅 Schedule Meeting</button>
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
                <button key={stage} onClick={() => can('pipeline:move') ? updateStage(stage) : null}
                  style={{ cursor: can('pipeline:move') ? 'pointer' : 'default', background: isActive ? STAGE_COLORS[stage] : isPast ? STAGE_COLORS[stage] + '33' : '#F5F3EF', color: isActive ? '#fff' : isPast ? STAGE_COLORS[stage] : '#717182', border: isActive ? `2px solid ${STAGE_COLORS[stage]}` : '2px solid transparent', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s' }}>
                  {isWon ? '🎉 ' : isLost ? '✗ ' : ''}{stage}
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
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
              <p onClick={() => setEditingNextAction(true)} style={{ color: nextAction ? '#3E423D' : '#CBCED4', fontSize: 13, margin: 0, cursor: 'text', fontStyle: nextAction ? 'normal' : 'italic' }}>
                {nextAction || 'Click to set next action...'}
              </p>
            )}
          </div>
          <div style={{ background: '#fff', borderRadius: 10, padding: 16, border: '1px solid rgba(62,66,61,0.1)' }}>
            <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px' }}>Origin</p>
            <span style={{ background: '#E5E1D8', color: '#5A6059', fontSize: 12, borderRadius: 20, padding: '4px 12px' }}>{company.origin || '—'}</span>
            <span style={{ color: '#717182', fontSize: 12, marginLeft: 8 }}>{company.city}{company.state ? `, ${company.state}` : ''}</span>
          </div>

          <div style={{ background: '#fff', borderRadius: 10, padding: 16, border: '1px solid rgba(62,66,61,0.1)' }}>
            <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px' }}>Assigned To</p>
            {can('company:assign') ? (
              <select
                value={company.assigned_to || ''}
                onChange={e => updateField('assigned_to', e.target.value || null)}
                style={{ background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.15)', borderRadius: 6, padding: '4px 8px', fontSize: 13, color: '#3E423D', outline: 'none', width: '100%' }}>
                <option value="">— Unassigned —</option>
                {teamUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            ) : (
              <span style={{ color: '#3E423D', fontSize: 13 }}>
                {company.crm_users?.name || '— Unassigned —'}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(62,66,61,0.1)' }}>
        {['overview', 'people', 'activity', 'meetings', 'emails', 'marketing', 'documents'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ background: 'none', border: 'none', padding: '10px 20px', fontSize: 13, cursor: 'pointer', color: activeTab === tab ? '#3E423D' : '#717182', fontWeight: activeTab === tab ? 600 : 400, borderBottom: activeTab === tab ? '2px solid #8E9B8B' : '2px solid transparent', textTransform: 'capitalize', fontFamily: 'Inter, sans-serif' }}>
              {tab} {tab === 'people' ? `(${company.crm_people?.length || 0})` : tab === 'activity' ? `(${activity.length})` : tab === 'meetings' ? `(${meetings.length})` : tab === 'emails' ? `(${emailTrackingData.length + marketingData.length})` : tab === 'marketing' ? `(${marketingData.length})` : tab === 'documents' ? `(${documents.length})` : ''}
            </button>
          ))}
        </div>

 {/* OVERVIEW TAB */}
 {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 28, border: '1px solid rgba(62,66,61,0.1)' }}>
            <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>Contact Info</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 16px', marginBottom: 20 }}>
                <InlineField label="Address" value={company.company_address} onSave={v => updateField('company_address', v)} />
                <InlineField label="City" value={company.city} onSave={v => updateField('city', v)} />
                <LocationSelector
                  country={company.country}
                  state={company.state}
                  onCountryChange={v => updateField('country', v)}
                  onStateChange={v => updateField('state', v)}
                  labelStyle={{ color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}
                  inputStyle={{ width: '100%', background: '#F5F3EF', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 6, padding: '6px 10px', color: '#3E423D', fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' }}                />
              </div>

              <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>Business</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginBottom: 20 }}>
                {[
                  { field: 'category', label: 'Category', options: Object.keys(CATEGORIES) },
                  { field: 'business_type', label: 'Business Type', options: company.category ? CATEGORIES[company.category] : [] },
                ].map(({ field, label, options }) => (
                  <InlineField key={field} label={label} value={company[field]} onSave={v => updateField(field, v)} options={options} />
                ))}
              </div>

              <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>Marketing</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px 16px', marginBottom: 20 }}>
                {[
                  { field: 'origin', label: 'Origin', options: ORIGINS },
                ].map(({ field, label, options }) => (
                  <InlineField key={field} label={label} value={company[field]} onSave={v => updateField(field, v)} options={options} />
                ))}
              </div>

              <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>Social</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                {[
                  { field: 'company_linkedin', label: 'LinkedIn' },
                  { field: 'facebook_url', label: 'Facebook' },
                  { field: 'instagram_url', label: 'Instagram' },
                  { field: 'website', label: 'Website' },
                ].map(({ field, label }) => (
                  <InlineField key={field} label={label} value={company[field]} onSave={v => updateField(field, v)} />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ color: '#3E423D', fontSize: 14, fontWeight: 600, margin: 0 }}>People ({company.crm_people?.length || 0})</h3>
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
                        {can('people:edit') && <button onClick={() => setEditingPerson({ ...person })} style={{ background: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#5A6059' }}>✏️</button>}
                        {can('people:delete') && <button onClick={() => deletePerson(person.id)} style={{ background: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#D4183D' }}>✕</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.1)' }}>
                <h3 style={{ color: '#3E423D', fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Quick Note</h3>
                <textarea value={quickNote} onChange={e => setQuickNote(e.target.value)} placeholder="Add a note..." rows={3}
                  style={{ ...inputStyle, resize: 'vertical', marginBottom: 10 }} />
                <button onClick={saveQuickNote} disabled={savingQuickNote || !quickNote.trim()}
                  style={{ background: savingQuickNote ? '#A5B2A3' : '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', width: '100%' }}>
                  {savingQuickNote ? '⏳ Saving...' : 'Save Note'}
                </button>
                {activity.filter(a => a.action === 'Note Added').slice(0, 3).length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 8px' }}>Recent Notes</p>
                    {activity.filter(a => a.action === 'Note Added').slice(0, 3).map(a => (
                      <div key={a.id} style={{ borderLeft: '2px solid #E5E1D8', paddingLeft: 10, marginBottom: 8 }}>
                        <p style={{ color: '#3E423D', fontSize: 13, margin: '0 0 2px', wordBreak: 'break-word' }}>{a.details?.length > 120 ? a.details.substring(0, 120) + '...' : a.details}</p>
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
              <button onClick={() => { setFilterPerson(''); setActivityPage(1); }} style={{ background: filterPerson === '' ? '#8E9B8B' : '#F5F3EF', color: filterPerson === '' ? '#fff' : '#5A6059', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>All</button>
              
              <button onClick={() => { setFilterPerson('meetings'); setActivityPage(1); }}
  style={{ background: filterPerson === 'meetings' ? '#B4A5D6' : '#F5F3EF', color: filterPerson === 'meetings' ? '#fff' : '#5A6059', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
  📅 Meetings
</button>
<button onClick={() => { setFilterPerson('documents'); setActivityPage(1); }}
  style={{ background: filterPerson === 'documents' ? '#94B0BC' : '#F5F3EF', color: filterPerson === 'documents' ? '#fff' : '#5A6059', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
  📄 Documents
</button>
<button onClick={() => { setFilterPerson('company'); setActivityPage(1); }}
  style={{ background: filterPerson === 'company' ? '#8E9B8B' : '#F5F3EF', color: filterPerson === 'company' ? '#fff' : '#5A6059', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
  🏢 Company
</button>
              {company.crm_people?.map(p => (
                <button key={p.id} onClick={() => { setFilterPerson(p.id); setActivityPage(1); }} style={{ background: filterPerson === p.id ? '#8E9B8B' : '#F5F3EF', color: filterPerson === p.id ? '#fff' : '#5A6059', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
                  👤 {p.first_name} {p.last_name}
                </button>
              ))}
            </div>
            {/* Pagination controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ color: '#717182', fontSize: 12, margin: 0 }}>
                {filteredActivity.length} total · showing {Math.min(activityPageSize, filteredActivity.length)} per page
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#717182', fontSize: 12 }}>Per page:</span>
                {[5, 10, 25, 50].map(size => (
                  <button key={size} onClick={() => { setActivityPageSize(size); setActivityPage(1); }}
                    style={{ background: activityPageSize === size ? '#8E9B8B' : '#F5F3EF', color: activityPageSize === size ? '#fff' : '#5A6059', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredActivity.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#CBCED4', border: '1px solid rgba(62,66,61,0.1)' }}>No activity yet</div>
              ) : filteredActivity.slice((activityPage - 1) * activityPageSize, activityPage * activityPageSize).map(a => {
                const isEmail = a.action === 'Email Sent' || a.action === 'Email Draft Saved';
                const isExpanded = expandedActivity[a.id];
                const bodies = emailBodies[a.id] || [];
                return (
                  <div key={a.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden' }}>
                    <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ background: a.action === 'Note Added' ? '#E5E1D8' : isEmail ? '#EBF4FF' : '#F5F3EF', color: a.action === 'Note Added' ? '#5A6059' : isEmail ? '#1a6fad' : '#5A6059', fontSize: 11, borderRadius: 20, padding: '2px 10px' }}>{a.action}</span>
                          {isEmail && (() => {
                            const subjectMatch = a.details.includes(': "') ? a.details.split(': "')[1]?.replace(/"$/, '') : '';
                            const match = emailTrackingData.find(e => e.subject === subjectMatch);
                            const st = match?.email_status || (a.action === 'Email Sent' ? 'sent' : null);
                            const stInfo = EMAIL_STATUS_COLORS[st];
                            return stInfo ? (
                              <span style={{ background: stInfo.bg, color: stInfo.text, fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{stInfo.label}</span>
                            ) : null;
                          })()}                          {a.crm_people && <span style={{ color: '#8E9B8B', fontSize: 12 }}>👤 {a.crm_people.first_name} {a.crm_people.last_name}</span>}
                          {!a.person_id && a.action === 'Note Added' && <span style={{ color: '#94B0BC', fontSize: 12 }}>🏢 Company</span>}
                        </div>
                        <p style={{ color: '#3E423D', fontSize: 14, margin: '0 0 4px', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{a.details?.length > 200 ? a.details.substring(0, 200) + '...' : a.details}</p>
                        <p style={{ color: '#CBCED4', fontSize: 11, margin: 0 }}>{new Date(a.created_at).toLocaleString()}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 12 }}>
                        {isEmail && (
                          <button onClick={() => {
                            setExpandedActivity(prev => ({ ...prev, [a.id]: !prev[a.id] }));
                            if (!emailBodies[a.id]) fetchEmailBody(a.id, id);
                          }} style={{ background: '#F5F3EF', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#5A6059', display: 'flex', alignItems: 'center', gap: 4 }}>
                            {isExpanded ? '▲ Hide' : '▼ View Email'}
                          </button>
                        )}
                        {a.action === 'Note Added' && (
                          <button onClick={() => deleteActivity(a.id)} style={{ background: 'none', border: 'none', color: '#D4183D', fontSize: 12, cursor: 'pointer' }}>Delete</button>
                        )}
                      </div>
                    </div>
                    {isEmail && isExpanded && (
                      <div style={{ borderTop: '1px solid rgba(62,66,61,0.08)', background: '#FAFAF9', padding: 20 }}>
                        {bodies.length === 0 ? (
                          <p style={{ color: '#717182', fontSize: 13, margin: 0 }}>Loading email content...</p>
                        ) : (() => {
                          const subjectMatch = a.details.includes(': "') ? a.details.split(': "')[1]?.replace(/"$/, '') : '';
                          const match = bodies.find(e => e.subject === subjectMatch) || bodies[0];
                          return match ? (
                            <div>
                              <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 10px', fontWeight: 600 }}>
                                {match.status === 'sent' ? '📤 Sent' : '💾 Draft'} · {match.subject}
                              </p>
                              <div dangerouslySetInnerHTML={{ __html: match.body_html }} style={{ fontSize: 13, lineHeight: 1.7, color: '#3E423D' }} />
                            </div>
                          ) : <p style={{ color: '#717182', fontSize: 13, margin: 0 }}>Email content not found.</p>;
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredActivity.length > activityPageSize && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
                <button onClick={() => setActivityPage(p => Math.max(1, p - 1))} disabled={activityPage === 1}
                  style={{ background: activityPage === 1 ? '#F5F3EF' : '#8E9B8B', color: activityPage === 1 ? '#CBCED4' : '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: activityPage === 1 ? 'default' : 'pointer' }}>← Prev</button>
                {Array.from({ length: Math.ceil(filteredActivity.length / activityPageSize) }, (_, i) => i + 1).map(page => (
                  <button key={page} onClick={() => setActivityPage(page)}
                    style={{ background: activityPage === page ? '#3E423D' : '#F5F3EF', color: activityPage === page ? '#fff' : '#5A6059', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                    {page}
                  </button>
                ))}
                <button onClick={() => setActivityPage(p => Math.min(Math.ceil(filteredActivity.length / activityPageSize), p + 1))} disabled={activityPage === Math.ceil(filteredActivity.length / activityPageSize)}
                  style={{ background: activityPage === Math.ceil(filteredActivity.length / activityPageSize) ? '#F5F3EF' : '#8E9B8B', color: activityPage === Math.ceil(filteredActivity.length / activityPageSize) ? '#CBCED4' : '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>Next →</button>
              </div>
            )}
          </div>
        )}

{/* MEETINGS TAB */}
{activeTab === 'meetings' && (
          <div>
            {meetings.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 12, padding: 60, textAlign: 'center', border: '1px solid rgba(62,66,61,0.1)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
                <p style={{ color: '#3E423D', fontSize: 15, fontWeight: 500, margin: '0 0 6px' }}>No meetings yet</p>
                <p style={{ color: '#717182', fontSize: 13, margin: '0 0 16px' }}>Schedule a meeting to track your interactions with this company.</p>
                <button onClick={() => setShowMeetingModal(true)} style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>📅 Schedule Meeting</button>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Total', count: meetings.length, color: '#717182' },
                    { label: 'Completed', count: meetings.filter(m => m.status === 'completed').length, color: '#4CAF50' },
                    { label: 'Scheduled', count: meetings.filter(m => m.status === 'scheduled' || m.status === 'confirmed').length, color: '#B4A5D6' },
                    { label: 'Cancelled', count: meetings.filter(m => m.status === 'cancelled').length, color: '#D4183D' },
                  ].map((card, i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(62,66,61,0.1)' }}>
                      <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 6px' }}>{card.label}</p>
                      <p style={{ color: card.color, fontSize: 22, fontWeight: 700, margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>{card.count}</p>
                    </div>
                  ))}
                </div>

                {/* Meeting list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {meetings.map(m => {
                    const start = new Date(m.start_time);
                    const end = new Date(m.end_time);
                    const isPast = end < new Date();
                    const needsComplete = (m.status === 'scheduled' || m.status === 'confirmed');
                    const isExpanded = completingMeeting === m.id;
                    const statusColors = {
                      scheduled: { bg: '#F3E8FF', color: '#7C3AED' },
                      confirmed: { bg: '#E8F5E9', color: '#2E7D32' },
                      completed: { bg: '#E8F5E9', color: '#4CAF50' },
                      cancelled: { bg: '#FFEBEE', color: '#C62828' },
                    };
                    const st = statusColors[m.status] || { bg: '#F5F3EF', color: '#717182' };

                    return (
                      <div key={m.id} style={{ background: '#fff', borderRadius: 12, border: (needsComplete && isPast) ? '2px solid #D4A574' : '1px solid rgba(62,66,61,0.1)', overflow: 'hidden' }}>
                        <div style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                              <span style={{ fontSize: 16 }}>{m.meeting_type === 'google_meet' ? '📹' : '📞'}</span>
                              <p style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: 0 }}>{m.title}</p>
                              <span style={{ background: st.bg, color: st.color, fontSize: 10, borderRadius: 20, padding: '2px 10px', fontWeight: 600, textTransform: 'capitalize' }}>{m.status}</span>
                              {needsComplete && isPast && <span style={{ background: '#FFF3CD', color: '#856404', fontSize: 10, borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>Needs Completion</span>}
                            </div>
                            <div style={{ display: 'flex', gap: 16, alignItems: 'center', color: '#717182', fontSize: 12 }}>
                              <span>📅 {start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              <span>🕐 {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} — {end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                              {m.crm_users?.name && <span>👤 {m.crm_users.name}</span>}
                            </div>
                            {m.meet_link && (
                              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
                                <a href={m.meet_link} target="_blank" rel="noreferrer" style={{ color: '#4CAF50', fontSize: 12 }}>🔗 Join Google Meet</a>
                                {/* Record button — show for scheduled meetings with meet links */}
                                {(m.status === 'scheduled' || m.status === 'confirmed') && !m.recall_bot_id && !recordingStatus[m.id] && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {/* Google Meet button */}
      <button onClick={(e) => { e.stopPropagation(); startRecording(m.id, m.meet_link); }}
        style={{ background: '#D4183D', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
        🔴 Google Meet
      </button>
      {/* Zoom button */}
      <button onClick={(e) => { e.stopPropagation(); setShowZoomInput(prev => ({ ...prev, [m.id]: !prev[m.id] })); }}
        style={{ background: showZoomInput[m.id] ? '#2D8CFF' : '#F5F3EF', color: showZoomInput[m.id] ? '#fff' : '#2D8CFF', border: '1px solid #2D8CFF', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
        🎥 Zoom
      </button>
    </div>
    {/* Zoom link input — appears when Zoom is clicked */}
    {showZoomInput[m.id] && (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          value={zoomLinkInput[m.id] || ''}
          onChange={e => setZoomLinkInput(prev => ({ ...prev, [m.id]: e.target.value }))}
          placeholder="Paste Zoom meeting link..."
          style={{ flex: 1, background: '#fff', border: '1px solid #2D8CFF', borderRadius: 6, padding: '5px 10px', fontSize: 11, outline: 'none', fontFamily: 'Inter, sans-serif' }}
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            const zoomUrl = zoomLinkInput[m.id];
            if (!zoomUrl || !zoomUrl.includes('zoom')) {
              alert('Please paste a valid Zoom meeting link');
              return;
            }
            startRecording(m.id, zoomUrl);
            setShowZoomInput(prev => ({ ...prev, [m.id]: false }));
            setZoomLinkInput(prev => ({ ...prev, [m.id]: '' }));
          }}
          disabled={!zoomLinkInput[m.id]}
          style={{ background: zoomLinkInput[m.id] ? '#2D8CFF' : '#D5CEC0', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: zoomLinkInput[m.id] ? 'pointer' : 'default' }}>
          Send Bot
        </button>
      </div>
    )}
  </div>
)}
                                {/* Recording status indicator */}
                                {(recordingStatus[m.id] || m.recording_status) && m.recording_status !== 'completed' && (
                                  <span style={{
                                    background: (recordingStatus[m.id] || m.recording_status) === 'recording' ? '#FFEBEE' : (recordingStatus[m.id] || m.recording_status) === 'failed' ? '#F8D7DA' : '#FFF3CD',
                                    color: (recordingStatus[m.id] || m.recording_status) === 'recording' ? '#D4183D' : (recordingStatus[m.id] || m.recording_status) === 'failed' ? '#721C24' : '#856404',
                                    fontSize: 11, borderRadius: 20, padding: '3px 10px', fontWeight: 600,
                                  }}>
                                    {(recordingStatus[m.id] || m.recording_status) === 'sending_bot' ? '⏳ Sending bot...' :
                                     (recordingStatus[m.id] || m.recording_status) === 'recording' ? '⏺️ Recording...' :
                                     (recordingStatus[m.id] || m.recording_status) === 'processing' ? '⏳ Processing transcript...' :
                                     (recordingStatus[m.id] || m.recording_status) === 'failed' ? '❌ Recording failed' : ''}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Meeting Notes */}
                            {m.notes && (
  <div style={{ marginTop: 10, padding: 12, background: '#F5F3EF', borderRadius: 8, fontSize: 13, color: '#3E423D', lineHeight: 1.6 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
      <p style={{ color: '#717182', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', margin: 0, fontWeight: 600 }}>Meeting Notes</p>
      {m.status === 'completed' && editingNotes !== m.id && (
        <button onClick={() => { setEditingNotes(m.id); setEditingNotesText(m.notes); }}
          style={{ background: 'none', border: 'none', color: '#94B0BC', fontSize: 11, cursor: 'pointer', padding: 0 }}>
          ✏️ Edit
        </button>
      )}
    </div>
    {editingNotes === m.id ? (
      <div>
        <textarea value={editingNotesText} onChange={e => setEditingNotesText(e.target.value)}
          rows={4} autoFocus
          style={{ width: '100%', background: '#fff', border: '1px solid #8E9B8B', borderRadius: 8, padding: '10px 14px', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', lineHeight: 1.6 }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={() => saveNotes(m.id)}
            style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, cursor: 'pointer' }}>
            Save
          </button>
          <button onClick={() => setEditingNotes(null)}
            style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    ) : (
<div style={{ fontSize: 13, color: '#3E423D', lineHeight: 1.7 }}>
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      h1: ({node, ...props}) => <h1 style={{ fontSize: 16, fontWeight: 700, margin: '12px 0 6px', color: '#3E423D' }} {...props} />,
      h2: ({node, ...props}) => <h2 style={{ fontSize: 15, fontWeight: 600, margin: '10px 0 6px', color: '#3E423D' }} {...props} />,
      h3: ({node, ...props}) => <h3 style={{ fontSize: 14, fontWeight: 600, margin: '8px 0 4px', color: '#3E423D' }} {...props} />,
      p: ({node, ...props}) => <p style={{ margin: '0 0 8px' }} {...props} />,
      ul: ({node, ...props}) => <ul style={{ paddingLeft: 20, margin: '4px 0 8px' }} {...props} />,
      ol: ({node, ...props}) => <ol style={{ paddingLeft: 20, margin: '4px 0 8px' }} {...props} />,
      li: ({node, ...props}) => <li style={{ marginBottom: 4 }} {...props} />,
      table: ({node, ...props}) => <table style={{ borderCollapse: 'collapse', width: '100%', margin: '10px 0', fontSize: 12 }} {...props} />,
      th: ({node, ...props}) => <th style={{ background: '#E5E1D8', padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#3E423D', border: '1px solid rgba(62,66,61,0.15)' }} {...props} />,
      td: ({node, ...props}) => <td style={{ padding: '8px 12px', color: '#5A6059', border: '1px solid rgba(62,66,61,0.1)', verticalAlign: 'top' }} {...props} />,
      strong: ({node, ...props}) => <strong style={{ fontWeight: 600, color: '#3E423D' }} {...props} />,
      hr: ({node, ...props}) => <hr style={{ border: 'none', borderTop: '1px solid rgba(62,66,61,0.1)', margin: '12px 0' }} {...props} />,
    }}
  >
    {m.notes}
  </ReactMarkdown>
</div>
    )}
  </div>
)}

                            {/* AI Summary */}
                            {m.ai_summary && (
                              <div style={{ marginTop: 10, padding: 16, background: '#EBF4FF', borderRadius: 10, border: '1px solid rgba(26,111,173,0.1)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                  <p style={{ color: '#1a6fad', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', margin: 0, fontWeight: 600 }}>🤖 AI Summary</p>
                                  <button onClick={() => regenerateSummary(m.id)} disabled={processingTranscript[m.id]}
                                    style={{ background: 'none', border: 'none', color: '#94B0BC', fontSize: 10, cursor: 'pointer', padding: 0 }}>
                                    {processingTranscript[m.id] ? '⏳ Regenerating...' : '🔄 Regenerate'}
                                  </button>
                                </div>
                                <p style={{ color: '#3E423D', fontSize: 13, margin: 0, lineHeight: 1.7 }}>{m.ai_summary}</p>
                              </div>
                            )}

                            {/* Action Items */}
                            {m.ai_action_items && m.ai_action_items.length > 0 && (
                              <div style={{ marginTop: 10, padding: 16, background: '#F5F3EF', borderRadius: 10 }}>
                                <p style={{ color: '#717182', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 10px', fontWeight: 600 }}>📋 Action Items ({m.ai_action_items.length})</p>
                                {m.ai_action_items.map((item, idx) => (
                                  <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                                    <span style={{ color: item.priority === 'high' ? '#D4183D' : item.priority === 'medium' ? '#D4A574' : '#8E9B8B', fontSize: 14, flexShrink: 0 }}>
                                      {item.priority === 'high' ? '🔴' : item.priority === 'medium' ? '🟡' : '🟢'}
                                    </span>
                                    <div>
                                      <p style={{ color: '#3E423D', fontSize: 13, margin: '0 0 2px' }}>{item.task}</p>
                                      {item.owner && item.owner !== 'TBD' && (
                                        <span style={{ color: '#717182', fontSize: 11 }}>→ {item.owner}</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Transcript (collapsible) */}
                            {m.transcript && (
                              <details style={{ marginTop: 10 }}>
                                <summary style={{ color: '#717182', fontSize: 12, cursor: 'pointer', padding: '8px 0', userSelect: 'none' }}>
                                  📜 View Full Transcript
                                </summary>
                                <div style={{ padding: 16, background: '#fff', borderRadius: 8, border: '1px solid rgba(62,66,61,0.08)', marginTop: 6, maxHeight: 400, overflowY: 'auto' }}>
                                  {m.transcript_segments ? m.transcript_segments.map((seg, idx) => (
                                    <div key={idx} style={{ marginBottom: 12 }}>
                                      <span style={{ color: '#1a6fad', fontSize: 11, fontWeight: 600 }}>{seg.speaker}</span>
                                      <span style={{ color: '#CBCED4', fontSize: 10, marginLeft: 8 }}>
                                        {Math.floor(seg.startTime / 60)}:{String(Math.floor(seg.startTime % 60)).padStart(2, '0')}
                                      </span>
                                      <p style={{ color: '#3E423D', fontSize: 13, margin: '2px 0 0', lineHeight: 1.6 }}>{seg.text}</p>
                                    </div>
                                  )) : (
                                    <pre style={{ color: '#3E423D', fontSize: 12, margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{m.transcript}</pre>
                                  )}
                                </div>
                              </details>
                            )}

                            {/* Process transcript button for meetings with recording but no transcript yet */}
                            {m.recall_bot_id && !m.transcript && m.recording_status !== 'sending_bot' && m.recording_status !== 'recording' && (
                              <button onClick={() => processTranscript(m.id)} disabled={processingTranscript[m.id]}
                                style={{ marginTop: 10, background: processingTranscript[m.id] ? '#A5B2A3' : '#1a6fad', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', width: '100%' }}>
                                {processingTranscript[m.id] ? '⏳ Fetching transcript & generating summary...' : '📝 Fetch Transcript & Generate AI Summary'}
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                            {needsComplete && (
                              <button onClick={() => { setReschedulingMeeting(reschedulingMeeting === m.id ? null : m.id); setRescheduleForm({ date: '', start_hour: '10', start_min: '00', end_hour: '11', end_min: '00' }); }}
                                style={{ background: reschedulingMeeting === m.id ? '#3E423D' : '#F5F3EF', color: reschedulingMeeting === m.id ? '#fff' : '#717182', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 6, padding: '6px 14px', fontSize: 11, cursor: 'pointer' }}>
                                {reschedulingMeeting === m.id ? '▲ Close' : '📅 Reschedule'}
                              </button>
                            )}
                            {needsComplete && (
                              <button onClick={() => { setCompletingMeeting(isExpanded ? null : m.id); setCompletionNotes(''); }}
                                style={{ background: isExpanded ? '#3E423D' : '#8E9B8B', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 11, cursor: 'pointer' }}>
                                {isExpanded ? '▲ Close' : '✓ Complete'}
                              </button>
                            )}
                          </div>
                        </div>
                        {reschedulingMeeting === m.id && (
                          <div style={{ borderTop: '1px solid rgba(62,66,61,0.08)', padding: 20, background: '#F8F9FF' }}>
                            <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 12px', fontWeight: 600 }}>New Date & Time</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <input type="date" value={rescheduleForm.date} onChange={e => setRescheduleForm(prev => ({ ...prev, date: e.target.value }))}
                                style={{ background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <select value={rescheduleForm.start_hour} onChange={e => setRescheduleForm(prev => ({ ...prev, start_hour: e.target.value }))}
                                  style={{ flex: 1, background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none' }}>
                                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={String(i)}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>)}
                                </select>
                                <select value={rescheduleForm.start_min} onChange={e => setRescheduleForm(prev => ({ ...prev, start_min: e.target.value }))}
                                  style={{ width: 80, background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none' }}>
                                  {['00', '15', '30', '45'].map(m => <option key={m} value={m}>:{m}</option>)}
                                </select>
                                <span style={{ color: '#717182', fontSize: 13 }}>to</span>
                                <select value={rescheduleForm.end_hour} onChange={e => setRescheduleForm(prev => ({ ...prev, end_hour: e.target.value }))}
                                  style={{ flex: 1, background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none' }}>
                                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={String(i)}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>)}
                                </select>
                                <select value={rescheduleForm.end_min} onChange={e => setRescheduleForm(prev => ({ ...prev, end_min: e.target.value }))}
                                  style={{ width: 80, background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none' }}>
                                  {['00', '15', '30', '45'].map(m => <option key={m} value={m}>:{m}</option>)}
                                </select>
                              </div>
                              <div style={{ display: 'flex', gap: 10 }}>
                                <button onClick={() => rescheduleMeeting(m.id)} disabled={savingReschedule || !rescheduleForm.date}
                                  style={{ flex: 1, background: rescheduleForm.date ? '#8E9B8B' : '#D5CEC0', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, cursor: rescheduleForm.date ? 'pointer' : 'default' }}>
                                  {savingReschedule ? '⏳ Rescheduling...' : '✓ Confirm & Notify Contact'}
                                </button>
                                <button onClick={() => setReschedulingMeeting(null)}
                                  style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                              </div>
                            </div>
                          </div>
                        )}
                        {isExpanded && (
                          <div style={{ borderTop: '1px solid rgba(62,66,61,0.08)', padding: 20, background: '#FAFAF9' }}>
                            <textarea value={completionNotes} onChange={e => setCompletionNotes(e.target.value)}
                              placeholder="What was discussed? Key takeaways, next steps..."
                              rows={4} style={{ width: '100%', background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '10px 14px', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', lineHeight: 1.6 }} />
                            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                              <button onClick={() => completeMeeting(m.id)} disabled={savingCompletion}
                                style={{ flex: 1, background: savingCompletion ? '#A5B2A3' : '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, cursor: 'pointer' }}>
                                {savingCompletion ? '⏳ Saving...' : '✓ Mark Complete & Save Notes'}
                              </button>
                              <button onClick={() => setCompletingMeeting(null)}
                                style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
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
        
{/* EMAILS TAB */}
{activeTab === 'emails' && (
          <div>
            {emailTrackingData.length === 0 && marketingData.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 12, padding: 60, textAlign: 'center', border: '1px solid rgba(62,66,61,0.1)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
                <p style={{ color: '#3E423D', fontSize: 15, fontWeight: 500, margin: '0 0 6px' }}>No emails sent yet</p>
                <p style={{ color: '#717182', fontSize: 13, margin: 0 }}>Send an email from this profile to see tracking data here.</p>
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Total Sent', count: emailTrackingData.length + marketingData.length, color: '#717182' },
                    { label: 'Delivered', count: emailTrackingData.filter(e => ['delivered', 'opened', 'clicked'].includes(e.email_status)).length, color: '#1565C0' },
                    { label: 'Opened', count: emailTrackingData.filter(e => ['opened', 'clicked'].includes(e.email_status)).length, color: '#2E7D32' },
                    { label: 'Clicked', count: emailTrackingData.filter(e => e.email_status === 'clicked').length, color: '#E65100' },
                    { label: 'Bounced', count: emailTrackingData.filter(e => e.email_status === 'bounced').length, color: '#C62828' },
                  ].map((card, i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(62,66,61,0.1)' }}>
                      <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 6px' }}>{card.label}</p>
                      <p style={{ color: card.color, fontSize: 22, fontWeight: 700, margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>{card.count}</p>
                    </div>
                  ))}
                </div>

                {/* Email table */}
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                    </thead>
                    <tbody>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F5F3EF' }}>
                        {['Type', 'Subject', 'Recipient', 'Sent', 'Status', 'Opened', 'Clicked'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#717182', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {emailTrackingData.map((email, i) => {
                        const st = EMAIL_STATUS_COLORS[email.email_status || 'sent'];
                        return (
                          <tr key={`direct-${email.id}`} style={{ borderTop: '1px solid rgba(62,66,61,0.06)', background: i % 2 === 0 ? '#fff' : '#FAFAF9' }}>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ background: '#EBF4FF', color: '#1a6fad', fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>Direct</span>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 13, color: '#3E423D', fontWeight: 500, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {email.subject || '(no subject)'}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 12, color: '#717182' }}>
                              {email.crm_people ? `${email.crm_people.first_name} ${email.crm_people.last_name}` : '—'}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 12, color: '#717182' }}>
                              {email.sent_at ? new Date(email.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : email.status === 'draft' ? 'Draft' : '—'}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ background: st.bg, color: st.text, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>{st.label}</span>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 12, color: email.opened_at ? '#2E7D32' : '#717182' }}>
                              {email.opened_at ? new Date(email.opened_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 12, color: email.clicked_at ? '#E65100' : '#717182' }}>
                              {email.clicked_at ? new Date(email.clicked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                      {marketingData.map((r, i) => (
                        <tr key={`campaign-${r.id}`} style={{ borderTop: '1px solid rgba(62,66,61,0.06)', background: (emailTrackingData.length + i) % 2 === 0 ? '#fff' : '#FAFAF9' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ background: '#F3E8FF', color: '#7C3AED', fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>Campaign</span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 13, color: '#3E423D', fontWeight: 500, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.crm_campaigns?.name || '—'}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: '#717182' }}>
                            {r.email || '—'}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: '#717182' }}>
                            {r.crm_campaigns?.sent_at ? new Date(r.crm_campaigns.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              background: r.status === 'opened' || r.status === 'clicked' ? '#E8F5E9' : r.status === 'bounced' ? '#FFEBEE' : '#F5F3EF',
                              color: r.status === 'opened' || r.status === 'clicked' ? '#2E7D32' : r.status === 'bounced' ? '#C62828' : '#717182',
                              borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize'
                            }}>{r.status}</span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: r.opened_at ? '#2E7D32' : '#717182' }}>
                            {r.opened_at ? new Date(r.opened_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: r.clicked_at ? '#E65100' : '#717182' }}>
                            {r.clicked_at ? new Date(r.clicked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{ color: '#717182', fontSize: 13, margin: 0 }}>{documents.length} document{documents.length !== 1 ? 's' : ''}</p>
              <button onClick={() => { setEditingDoc(null); setDocForm({ title: '', type: 'Other', notes: '' }); setDocFile(null); setShowDocModal(true); }}
                style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
                + Add Document
              </button>
            </div>

            {documents.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', border: '1px solid rgba(62,66,61,0.08)' }}>
                <p style={{ color: '#CBCED4', fontSize: 14, margin: 0 }}>No documents yet</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {documents.map(doc => (
                  <div key={doc.id} style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', border: '1px solid rgba(62,66,61,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 24 }}>📄</span>
                      <div>
                        <p style={{ color: '#3E423D', fontSize: 13, fontWeight: 600, margin: 0 }}>{doc.title}</p>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3 }}>
                          <span style={{ background: '#F5F3EF', color: '#717182', fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{doc.type}</span>
                          <span style={{ color: '#CBCED4', fontSize: 11 }}>{doc.uploaded_by_user?.name} · {new Date(doc.created_at).toLocaleDateString()}</span>
                          {doc.notes && <span style={{ color: '#717182', fontSize: 11 }}>· {doc.notes}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                    <a 
                        href={doc.file_url}
                        target="_blank" rel="noreferrer"
                        style={{ background: '#F5F3EF', color: '#3E423D', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', textDecoration: 'none' }}>
                        {doc.file_url?.match(/\.(pdf|png|jpg|jpeg|gif|webp)(\?|$)/i) ? '👁 View' : '📥 Download'}
                      </a>
                      <button onClick={() => { setEditingDoc(doc); setDocForm({ title: doc.title, type: doc.type, notes: doc.notes || '' }); setDocFile(null); setShowDocModal(true); }}
                        style={{ background: '#F5F3EF', color: '#3E423D', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                        Edit
                      </button>
                      <button onClick={async () => {
                        if (!window.confirm('Delete this document?')) return;
                        await axios.delete(`${API}/documents/${doc.id}`, { headers: getHeaders() });
                        fetchDocuments();
                      }} style={{ background: 'none', color: '#D4183D', border: 'none', borderRadius: 6, padding: '6px 8px', fontSize: 12, cursor: 'pointer' }}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Document Modal */}
            {showDocModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(62,66,61,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 480, boxShadow: '0 20px 60px rgba(62,66,61,0.2)' }}>
                  <h2 style={{ color: '#3E423D', fontSize: 18, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 20px' }}>
                    {editingDoc ? 'Edit Document' : 'Add Document'}
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={{ color: '#717182', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4 }}>Title *</label>
                      <input value={docForm.title} onChange={e => setDocForm(p => ({ ...p, title: e.target.value }))}
                        style={{ width: '100%', background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif', color: '#3E423D' }}
                        placeholder="e.g. Signed Contract 2026" />
                    </div>
                    <div>
                      <label style={{ color: '#717182', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4 }}>Type</label>
                      <select value={docForm.type} onChange={e => setDocForm(p => ({ ...p, type: e.target.value }))}
                        style={{ width: '100%', background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif', color: '#3E423D' }}>
                        {['Contract', 'Invoice', 'Proposal', 'NDA', 'Presentation', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ color: '#717182', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4 }}>Notes (optional)</label>
                      <textarea value={docForm.notes} onChange={e => setDocForm(p => ({ ...p, notes: e.target.value }))}
                        rows={2} placeholder="Any relevant notes..."
                        style={{ width: '100%', background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif', color: '#3E423D', resize: 'vertical' }} />
                    </div>
                    {!editingDoc && (
                      <div>
                        <label style={{ color: '#717182', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4 }}>File *</label>
                        <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.csv"
                          onChange={e => {
                            const file = e.target.files[0];
                            if (file) {
                              setDocFile(file);
                              if (!docForm.title) setDocForm(p => ({ ...p, title: file.name.replace(/\.[^.]+$/, '') }));
                            }
                          }}
                          style={{ fontSize: 13, width: '100%' }} />
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                    <button onClick={async () => {
                      if (!editingDoc && !docFile) return alert('Please select a file');
                      if (!docForm.title) return alert('Title is required');
                      setSavingDoc(true);
                      try {
                        if (editingDoc) {
                          await axios.put(`${API}/documents/${editingDoc.id}`, docForm, { headers: getHeaders() });
                        } else {
                          const formData = new FormData();
                          formData.append('file', docFile);
                          formData.append('title', docForm.title);
                          formData.append('type', docForm.type);
                          formData.append('notes', docForm.notes);
                          formData.append('company_id', id);
                          await axios.post(`${API}/documents/upload`, formData, {
                            headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' }
                          });
                        }
                        fetchDocuments();
                        setShowDocModal(false);
                      } catch (err) { console.error(err); alert('Failed to save document'); }
                      setSavingDoc(false);
                    }} disabled={savingDoc}
                      style={{ flex: 1, background: savingDoc ? '#A5B2A3' : '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                      {savingDoc ? '⏳ Saving...' : editingDoc ? 'Update' : 'Upload'}
                    </button>
                    <button onClick={() => setShowDocModal(false)}
                      style={{ flex: 1, background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '11px', fontSize: 13, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MARKETING TAB */}
        {activeTab === 'marketing' && (
          <div>
            {company.crm_people?.some(p => p.marketing_unsubscribed) && (
              <div style={{ background: '#FFE5D0', borderRadius: 10, padding: '12px 20px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>🚫</span>
                  <p style={{ color: '#856404', fontSize: 13, fontWeight: 600, margin: 0 }}>Unsubscribed Contacts</p>
                </div>
                {company.crm_people.filter(p => p.marketing_unsubscribed).map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid rgba(133,100,4,0.15)' }}>
                    <span style={{ color: '#856404', fontSize: 12 }}>{p.first_name} {p.last_name} — {p.email}</span>
                    <button onClick={async () => {
                      try {
                        await axios.post(`${API}/marketing/resubscribe/${p.id}`, {}, { headers: getHeaders() });
                        fetchCompany();
                      } catch (err) { console.error(err); }
                    }} style={{ background: '#fff', color: '#856404', border: '1px solid #856404', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                      Resubscribe
                    </button>
                  </div>
                ))}
              </div>
            )}
            {marketingData.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 12, padding: 60, textAlign: 'center', border: '1px solid rgba(62,66,61,0.1)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📣</div>
                <p style={{ color: '#3E423D', fontSize: 15, fontWeight: 500, margin: '0 0 6px' }}>No campaign activity yet</p>
                <p style={{ color: '#717182', fontSize: 13, margin: 0 }}>This contact hasn't been included in any campaigns yet.</p>
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F5F3EF' }}>
                    {['Campaign', 'Recipient', 'Sent', 'Status', 'Opened', 'Clicked'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#717182', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {marketingData.map((r, i) => (
                      <tr key={r.id} style={{ borderTop: '1px solid rgba(62,66,61,0.06)', background: i % 2 === 0 ? '#fff' : '#FAFAF9' }}>
<td style={{ padding: '12px 16px', fontSize: 13, color: '#3E423D', fontWeight: 500 }}>{r.crm_campaigns?.name}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#5A6059' }}>{r.crm_people ? `${r.crm_people.first_name} ${r.crm_people.last_name}` : r.email || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#717182' }}>{r.crm_campaigns?.sent_at ? new Date(r.crm_campaigns.sent_at).toLocaleDateString() : '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: r.status === 'opened' || r.status === 'clicked' ? '#D4EDDA' : r.status === 'bounced' ? '#F8D7DA' : r.status === 'unsubscribed' ? '#FFE5D0' : '#F5F3EF',
                            color: r.status === 'opened' || r.status === 'clicked' ? '#155724' : r.status === 'bounced' ? '#721C24' : r.status === 'unsubscribed' ? '#856404' : '#717182',
                            borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize'
                          }}>{r.status}</span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#717182' }}>{r.opened_at ? new Date(r.opened_at).toLocaleDateString() : '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#717182' }}>{r.clicked_at ? new Date(r.clicked_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── EMAIL STEP 1 ── */}
        {showEmailStep1 && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(62,66,61,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 580, boxShadow: '0 20px 60px rgba(62,66,61,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ color: '#3E423D', fontSize: 22, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 6px' }}>New Email</h2>
              <p style={{ color: '#717182', fontSize: 13, margin: '0 0 24px' }}>to <strong>{company.company_name}</strong></p>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Send To</label>
                <select value={emailForm.person_id} onChange={e => setEmailForm(prev => ({ ...prev, person_id: e.target.value }))} style={inputStyle}>
                  <option value="">🏢 No specific person (company)</option>
                  {company.crm_people?.map(p => (
                    <option key={p.id} value={p.id}>👤 {p.first_name} {p.last_name}{p.email ? ` — ${p.email}` : ' (no email)'}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 28 }}>
                <label style={labelStyle}>Choose Template</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                  <div onClick={() => selectTemplate(null)}
                    style={{ padding: '12px 16px', borderRadius: 10, border: selectedTemplate === null ? '2px solid #8E9B8B' : '1px solid rgba(62,66,61,0.1)', cursor: 'pointer', background: selectedTemplate === null ? '#F5F3EF' : '#fff' }}>
                    <p style={{ color: '#3E423D', fontSize: 13, fontWeight: 500, margin: 0 }}>✏️ Blank email</p>
                    <p style={{ color: '#717182', fontSize: 12, margin: '2px 0 0' }}>Start from scratch</p>
                  </div>
                  {templates.map(t => (
                    <div key={t.id} onClick={() => selectTemplate(t)}
                      style={{ padding: '12px 16px', borderRadius: 10, border: selectedTemplate?.id === t.id ? '2px solid #8E9B8B' : '1px solid rgba(62,66,61,0.1)', cursor: 'pointer', background: selectedTemplate?.id === t.id ? '#F5F3EF' : '#fff' }}>
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
                <button onClick={proceedToStep2} style={{ flex: 1, background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>Continue →</button>
                <button onClick={() => setShowEmailStep1(false)} style={{ flex: 1, background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── EMAIL STEP 2 — Full Composer ── */}
        {showEmailStep2 && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(62,66,61,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 1100, height: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(62,66,61,0.2)' }}>

              {/* Header */}
              <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(62,66,61,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                  <h2 style={{ color: '#3E423D', fontSize: 20, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 2px' }}>Compose Email</h2>
                  <p style={{ color: '#717182', fontSize: 12, margin: 0 }}>
                    To: <strong>{company.company_name}</strong>
                    {getSelectedPerson() && <span> · {getSelectedPerson().first_name} {getSelectedPerson().last_name}{getSelectedPerson().email ? ` ‹${getSelectedPerson().email}›` : ''}</span>}
                    {selectedTemplate && <span> · Template: {selectedTemplate.name}</span>}
                  </p>
                  {gmailConnected?.connected && <span style={{ background: '#E8F5E9', color: '#2E7D32', fontSize: 10, borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>📧 via Gmail · {gmailConnected.email}</span>}
                  {gmailConnected && !gmailConnected.connected && <span style={{ background: '#FFF3CD', color: '#856404', fontSize: 10, borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>📧 via SendGrid</span>}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setShowEmailStep2(false); setShowEmailStep1(true); }}
                    style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>← Back</button>
                  {emailSuccess ? (
                    <button style={{ background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13 }}>
                      {emailSuccess === 'sent' ? '✅ Email Sent!' : '💾 Saved as Draft'}
                    </button>
                  ) : (
                    <button onClick={sendEmail} disabled={savingEmail || !emailForm.subject || !emailForm.body_html}
                      style={{ background: savingEmail ? '#A5B2A3' : '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>
                      {savingEmail ? '⏳ Sending...' : getSelectedPerson()?.email ? '📤 Send Email' : '💾 Save Draft'}
                    </button>
                  )}
                  <button onClick={() => setShowEmailStep2(false)}
                    style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>✕</button>
                </div>
              </div>

              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Main editor */}
                <div style={{ flex: 1, padding: 28, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Subject */}
                  <div>
                    <label style={labelStyle}>
                      Subject * {emailActiveField === 'subject' && <span style={{ color: '#8E9B8B', fontSize: 10, marginLeft: 4 }}>← tags insert here</span>}
                    </label>
                    <input
                      ref={emailSubjectRef}
                      value={emailForm.subject}
                      onChange={e => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
                      onFocus={() => setEmailActiveField('subject')}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault();
                        const tag = e.dataTransfer.getData('text/plain');
                        const input = emailSubjectRef.current;
                        const start = input.selectionStart || 0;
                        const newVal = emailForm.subject.substring(0, start) + tag + emailForm.subject.substring(start);
                        setEmailForm(prev => ({ ...prev, subject: newVal }));
                      }}
                      style={{ ...inputStyle, border: emailActiveField === 'subject' ? '1px solid #8E9B8B' : '1px solid rgba(62,66,61,0.1)' }}
                      placeholder="Email subject..."
                    />
                  </div>

                  {/* Body — Visual / HTML toggle */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 8 }}>
                      <label style={{ ...labelStyle, marginBottom: 0, marginRight: 'auto' }}>
                        Body * {emailActiveField === 'body' && <span style={{ color: '#8E9B8B', fontSize: 10, marginLeft: 4 }}>← tags insert here</span>}
                      </label>
                      {['visual', 'html'].map(tab => (
                        <button key={tab} onClick={() => setEmailEditorTab(tab)}
                          style={{ background: emailEditorTab === tab ? '#3E423D' : '#F5F3EF', color: emailEditorTab === tab ? '#fff' : '#717182', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer' }}>
                          {tab === 'html' ? 'HTML' : '✨ Visual'}
                        </button>
                      ))}
                    </div>

                    {emailEditorTab === 'html' ? (
                      <textarea
                        ref={emailBodyRef}
                        value={emailForm.body_html}
                        onChange={e => setEmailForm(prev => ({ ...prev, body_html: e.target.value }))}
                        onFocus={() => setEmailActiveField('body')}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => {
                          e.preventDefault();
                          const tag = e.dataTransfer.getData('text/plain');
                          const textarea = emailBodyRef.current;
                          const start = textarea.selectionStart || 0;
                          const newVal = emailForm.body_html.substring(0, start) + tag + emailForm.body_html.substring(start);
                          setEmailForm(prev => ({ ...prev, body_html: newVal }));
                        }}
                        rows={14}
                        style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12, resize: 'vertical', lineHeight: 1.6, border: emailActiveField === 'body' ? '1px solid #8E9B8B' : '1px solid rgba(62,66,61,0.1)' }}
                        placeholder="Email body HTML..."
                      />
                    ) : (
                      <TiptapEditor
                        content={emailForm.body_html}
                        onChange={html => setEmailForm(prev => ({ ...prev, body_html: html }))}
                        onFocus={() => setEmailActiveField('body')}
                        placeholder="Write your email..."
                        minHeight={280}
                      />
                    )}
                  </div>

                  {/* Signature preview */}
                  {userSignature && (
                    <div style={{ background: includeSignature ? '#F5F3EF' : '#FAFAFA', borderRadius: 8, padding: 14, border: `1px solid ${includeSignature ? 'rgba(62,66,61,0.1)' : 'rgba(62,66,61,0.06)'}`, opacity: includeSignature ? 1 : 0.5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: includeSignature ? 8 : 0 }}>
                        <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: 0 }}>Signature</p>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: includeSignature ? '#8E9B8B' : '#717182' }}>
                          <input type="checkbox" checked={includeSignature} onChange={e => setIncludeSignature(e.target.checked)} style={{ accentColor: '#8E9B8B' }} />
                          {includeSignature ? 'Included' : 'Excluded'}
                        </label>
                      </div>
                      {includeSignature && (
                        <div dangerouslySetInnerHTML={{ __html: userSignature }} style={{ fontSize: 13 }} />
                      )}
                    </div>
                  )}
                </div>

                {/* Merge Tags Sidebar */}
                <div style={{ width: 200, borderLeft: '1px solid rgba(62,66,61,0.1)', padding: 20, overflowY: 'auto', background: '#FAFAF9', flexShrink: 0 }}>
                  <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px', fontWeight: 600 }}>Merge Tags</p>
                  <p style={{ color: '#717182', fontSize: 12, margin: '0 0 14px', lineHeight: 1.5 }}>Click or drag to insert</p>
                  {MERGE_TAGS.map(({ tag, label }) => (
                    <button key={tag}
                      onClick={() => insertEmailTag(tag)}
                      draggable
                      onDragStart={e => e.dataTransfer.setData('text/plain', tag)}
                      style={{ display: 'block', width: '100%', background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px 10px', marginBottom: 7, cursor: 'grab', textAlign: 'left' }}
                      onMouseOver={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(62,66,61,0.12)'}
                      onMouseOut={e => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <p style={{ color: '#3E423D', fontSize: 11, fontWeight: 500, margin: '0 0 2px' }}>{label}</p>
                      <p style={{ color: '#94B0BC', fontSize: 10, margin: 0, fontFamily: 'monospace' }}>{tag}</p>
                    </button>
                  ))}
                  <div style={{ marginTop: 16, padding: 10, background: '#E5E1D8', borderRadius: 8 }}>
                    <p style={{ color: '#5A6059', fontSize: 11, margin: 0, lineHeight: 1.5 }}>
                      Active: <strong>{emailActiveField === 'subject' ? '📌 Subject' : '📝 Body'}</strong><br /><br />
                      Mode: <strong>{emailEditorTab === 'visual' ? '✨ Visual' : 'HTML'}</strong>
                    </p>
                  </div>
                </div>
              </div>
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
      {/* Convert to Client Modal */}
      {showConvertModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(62,66,61,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 520, boxShadow: '0 20px 60px rgba(62,66,61,0.2)' }}>
              <h2 style={{ color: '#3E423D', fontSize: 22, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 6px' }}>Convert to Client</h2>
              <p style={{ color: '#717182', fontSize: 13, margin: '0 0 24px' }}>Converting <strong>{company.company_name}</strong> from a lead to an active client.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Contract Type</label>
                    <select value={convertForm.contract_type} onChange={e => setConvertForm(prev => ({ ...prev, contract_type: e.target.value }))} style={inputStyle}>
                      <option value="RevShare">RevShare ($ + %)</option>
                      <option value="Commission">Commission (%)</option>
                      <option value="Subscription">Subscription ($/month)</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Contract Signed Date</label>
                    <input type="date" value={convertForm.contract_signed_date || ''} onChange={e => setConvertForm(prev => ({ ...prev, contract_signed_date: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
                {convertForm.contract_type === 'RevShare' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Base Amount ($)</label>
                      <input type="number" value={convertForm.contract_amount || ''} onChange={e => setConvertForm(prev => ({ ...prev, contract_amount: e.target.value }))} style={inputStyle} placeholder="e.g. 500" />
                    </div>
                    <div>
                      <label style={labelStyle}>Revenue Share (%)</label>
                      <input type="number" value={convertForm.commission_rate} onChange={e => setConvertForm(prev => ({ ...prev, commission_rate: e.target.value }))} style={inputStyle} placeholder="e.g. 5" />
                    </div>
                  </div>
                )}
                {convertForm.contract_type === 'Commission' && (
                  <div>
                    <label style={labelStyle}>Commission Rate (%)</label>
                    <input type="number" value={convertForm.commission_rate} onChange={e => setConvertForm(prev => ({ ...prev, commission_rate: e.target.value }))} style={inputStyle} placeholder="e.g. 10" />
                  </div>
                )}
                {convertForm.contract_type === 'Subscription' && (
                  <div>
                    <label style={labelStyle}>Monthly Amount ($)</label>
                    <input type="number" value={convertForm.contract_amount || ''} onChange={e => setConvertForm(prev => ({ ...prev, contract_amount: e.target.value }))} style={inputStyle} placeholder="e.g. 99" />
                  </div>
                )}
                <div>
                  <label style={labelStyle}>Notes</label>
                  <textarea value={convertForm.notes} onChange={e => setConvertForm(prev => ({ ...prev, notes: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Any notes about this client..." />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button onClick={convertToClient} disabled={converting}
                  style={{ flex: 1, background: converting ? '#A5B2A3' : '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                  {converting ? '⏳ Converting...' : '🤝 Convert to Client'}
                </button>
                <button onClick={() => setShowConvertModal(false)}
                  style={{ flex: 1, background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
        <ScheduleMeetingModal
          show={showMeetingModal}
          onClose={() => setShowMeetingModal(false)}
          onCreated={() => fetchActivity()}
          companyId={id}
          companyName={company?.company_name}
          state={company?.state}
          people={company?.crm_people || []}
        />
    </div>
  );
}