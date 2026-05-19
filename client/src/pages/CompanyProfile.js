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

const STAGES = ['New', 'Contacted', 'No Reply', 'Follow-up', 'Meeting Scheduled', 'Proposal Offered', 'Agreement Sent', 'Closed Won', 'Closed Lost', 'Not Interested'];
const ORIGINS = ['Upload', 'Cold', 'Hot', 'Instagram', 'Google', 'Referral'];

export const B2B_CATEGORIES = {
  'Technology': ['SaaS', 'Hardware', 'IT Services', 'Cybersecurity', 'AI & Data', 'Cloud', 'Dev Tools', 'Other Tech'],
  'Finance & Banking': ['Banking', 'Insurance', 'Investment', 'Accounting', 'Fintech', 'Other Finance'],
  'Healthcare & Medical': ['Hospital', 'Clinic', 'Pharma', 'MedTech', 'Mental Health', 'Other Health'],
  'Real Estate': ['Commercial', 'Residential', 'Property Management', 'Construction', 'Other RE'],
  'Marketing & Advertising': ['Agency', 'PR', 'SEO', 'Media Buying', 'Content', 'Other Marketing'],
  'Legal & Compliance': ['Law Firm', 'Compliance', 'IP', 'Corporate Law', 'Other Legal'],
  'Manufacturing': ['Industrial', 'Consumer Goods', 'Automotive', 'Electronics', 'Other Mfg'],
  'Retail & Wholesale': ['Wholesale', 'Distribution', 'eCommerce B2B', 'Other Retail'],
  'Consulting': ['Strategy', 'Management', 'HR', 'IT Consulting', 'Other Consulting'],
  'Logistics': ['Freight', 'Supply Chain', 'Warehousing', 'Last Mile', 'Other Logistics'],
  'Education': ['K-12', 'Higher Ed', 'EdTech', 'Corporate Training', 'Other Education'],
  'Media & Publishing': ['News', 'Publishing', 'Podcasting', 'Video', 'Other Media'],
  'Non-profit': ['NGO', 'Foundation', 'Association', 'Other Non-profit'],
  'Government': ['Federal', 'State/Local', 'Public Sector', 'Other Gov'],
  'Other': ['Other'],
};

export const B2C_CATEGORIES = {
  'Retail & E-commerce': ['Fashion', 'Electronics', 'Home Goods', 'Sporting Goods', 'Toys', 'Other Retail'],
  'Food & Beverage': ['Restaurant', 'Café', 'Bar', 'Food Delivery', 'Catering', 'Other F&B'],
  'Beauty & Wellness': ['Salon', 'Spa', 'Skincare', 'Cosmetics', 'Barbershop', 'Other Beauty'],
  'Health & Fitness': ['Gym', 'Personal Training', 'Yoga', 'Nutrition', 'Other Fitness'],
  'Education': ['Tutoring', 'Online Course', 'Language School', 'Music Lessons', 'Other Education'],
  'Entertainment': ['Events', 'Music', 'Gaming', 'Film', 'Comedy', 'Other Entertainment'],
  'Travel & Hospitality': ['Hotel', 'Resort', 'Tour Operator', 'Travel Agency', 'Other Travel'],
  'Home & Living': ['Interior Design', 'Furniture', 'Cleaning', 'Landscaping', 'Other Home'],
  'Automotive': ['Dealership', 'Repair', 'Car Rental', 'Detailing', 'Other Auto'],
  'Sports & Recreation': ['Sports Club', 'Outdoor', 'Coaching', 'Other Sports'],
  'Pet Care': ['Veterinary', 'Grooming', 'Pet Store', 'Dog Walking', 'Other Pet'],
  'Wedding & Events': ['Venue', 'Photography', 'Catering', 'Florist', 'DJ', 'Planner', 'Other Events'],
  'Financial Services': ['Insurance', 'Mortgage', 'Tax', 'Financial Advisor', 'Other Finance'],
  'Other': ['Other'],
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

function InlineField({ label, value, onSave, type = 'text', options = null, p }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || '');
  const inputRef = useRef(null);

  useEffect(() => { setVal(value || ''); }, [value]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const save = () => { setEditing(false); if (val !== value) onSave(val); };

  const labelStyle = { color: p.textSecondary, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 2 };
  const inputStyle = { width: '100%', background: p.inputBg, border: `1px solid ${p.primary}`, borderRadius: 6, padding: '5px 8px', color: p.text, fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' };

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
            onBlur={save} onKeyDown={e => e.key === 'Enter' && save()} style={inputStyle} />
        )
      ) : (
        <div onClick={() => setEditing(true)}
          style={{ padding: '6px 10px', color: val ? p.text : p.textMuted, fontSize: 13, fontWeight: val ? 500 : 400, cursor: 'text', minHeight: 22, display: 'flex', alignItems: 'center', background: p.inputBg, borderRadius: 6 }}
          onMouseOver={e => e.currentTarget.style.opacity = '0.8'}
          onMouseOut={e => e.currentTarget.style.opacity = '1'}>
          {val || <span style={{ fontStyle: 'italic', fontSize: 12 }}>—</span>}
        </div>
      )}
    </div>
  );
}

export default function CompanyProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { palette: p, settings } = useApp();
  const { can } = useRole();

  const CATEGORIES = settings.business_type === 'b2c' ? B2C_CATEGORIES : B2B_CATEGORIES;

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
  const [editingNotes, setEditingNotes] = useState(null);
  const [editingNotesText, setEditingNotesText] = useState('');
  const [zoomLinkInput, setZoomLinkInput] = useState({});
  const [showZoomInput, setShowZoomInput] = useState({});
  const [reschedulingMeeting, setReschedulingMeeting] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({ date: '', start_hour: '10', start_min: '00', end_hour: '11', end_min: '00' });
  const [savingReschedule, setSavingReschedule] = useState(false);
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
  const [recordingStatus, setRecordingStatus] = useState({});
  const [processingTranscript, setProcessingTranscript] = useState({});

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
    try { const res = await axios.get(`${API}/users`, { headers: getHeaders() }); setTeamUsers(res.data); } catch (err) {}
  };
  useEffect(() => { fetchTeamUsers(); }, []);

  const fetchCompany = async () => {
    try {
      const res = await axios.get(`${API}/contacts/companies/${id}`, { headers: getHeaders() });
      setCompany(res.data);
      setNextAction(res.data.next_action || '');
    } catch (err) { console.error(err); }
    setLoading(false);
    try { const sigRes = await axios.get(`${API}/users/me`, { headers: getHeaders() }); setUserSignature(sigRes.data.email_signature || ''); } catch (err) {}
    try { const gmailRes = await axios.get(`${API}/emails/gmail-status`, { headers: getHeaders() }); setGmailConnected(gmailRes.data); } catch (err) {}
  };

  const fetchActivity = async () => {
    try { const res = await axios.get(`${API}/contacts/companies/${id}/activity`, { headers: getHeaders() }); setActivity(res.data); } catch (err) {}
  };
  const fetchTemplates = async () => {
    try { const res = await axios.get(`${API}/emails/templates`, { headers: getHeaders() }); setTemplates(res.data); } catch (err) {}
  };
  const fetchMarketingData = async () => {
    try { const res = await axios.get(`${API}/marketing/company/${id}`, { headers: getHeaders() }); setMarketingData(res.data); } catch (err) {}
  };
  const fetchEmailTracking = async () => {
    try { const res = await axios.get(`${API}/emails/sent/company/${id}`, { headers: getHeaders() }); setEmailTrackingData(res.data || []); } catch (err) {}
  };
  const fetchDocuments = async () => {
    try { const res = await axios.get(`${API}/documents?company_id=${id}`, { headers: getHeaders() }); setDocuments(res.data); } catch (err) {}
  };
  const fetchMeetings = async () => {
    try { const res = await axios.get(`${API}/calendar/meetings/company/${id}`, { headers: getHeaders() }); setMeetings(res.data); } catch (err) {}
  };

  const completeMeeting = async (meetingId) => {
    setSavingCompletion(true);
    try {
      await axios.put(`${API}/calendar/meetings/${meetingId}`, { status: 'completed', notes: completionNotes }, { headers: getHeaders() });
      setCompletingMeeting(null); setCompletionNotes('');
      fetchMeetings(); fetchDocuments(); fetchActivity();
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
      setReschedulingMeeting(null); fetchMeetings(); fetchActivity();
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

  const fetchEmailBody = async (activityId, companyId) => {
    if (emailBodies[activityId]) return;
    try { const res = await axios.get(`${API}/emails/sent/company/${companyId}`, { headers: getHeaders() }); setEmailBodies(prev => ({ ...prev, [activityId]: res.data })); }
    catch (err) { console.error(err); }
  };

  const updateField = async (field, value) => {
    const oldValue = company[field];
    if (oldValue === value) return;
    try {
      await axios.put(`${API}/contacts/companies/${id}`, { [field]: value }, { headers: getHeaders() });
      setCompany(prev => ({ ...prev, [field]: value }));
      if (field === 'stage') { fetchActivity(); }
      else {
        const label = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        await axios.post(`${API}/contacts/companies/${id}/note`, { note: `${label} changed from "${oldValue || '—'}" to "${value || '—'}"`, person_id: null }, { headers: getHeaders() });
        fetchActivity();
      }
    } catch (err) { console.error(err); }
  };

  const updateStage = (stage) => updateField('stage', stage);
  const saveNextAction = async () => { setEditingNextAction(false); await updateField('next_action', nextAction); };

  const addNote = async (noteText, personId) => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try { await axios.post(`${API}/contacts/companies/${id}/note`, { note: noteText, person_id: personId || null }, { headers: getHeaders() }); fetchActivity(); }
    catch (err) { console.error(err); }
    setSavingNote(false);
  };

  const saveQuickNote = async () => {
    if (!quickNote.trim() || savingQuickNote) return;
    setSavingQuickNote(true);
    await addNote(quickNote, null);
    setQuickNote(''); setSavingQuickNote(false);
  };

  const deleteActivity = async (actId) => {
    if (!window.confirm('Delete this entry?')) return;
    try { await axios.delete(`${API}/contacts/activity/${actId}`, { headers: getHeaders() }); fetchActivity(); } catch (err) {}
  };

  const addPerson = async (e) => {
    e.preventDefault(); setSavingPerson(true);
    try {
      await axios.post(`${API}/contacts/companies/${id}/people`, personForm, { headers: getHeaders() });
      setShowAddPerson(false);
      setPersonForm({ first_name: '', last_name: '', title: '', email: '', work_phone: '', mobile_phone: '' });
      fetchCompany(); fetchActivity();
    } catch (err) { console.error(err); }
    setSavingPerson(false);
  };

  const saveEditPerson = async (e) => {
    e.preventDefault(); setSavingPerson(true);
    try { await axios.put(`${API}/contacts/people/${editingPerson.id}`, editingPerson, { headers: getHeaders() }); setEditingPerson(null); fetchCompany(); }
    catch (err) { console.error(err); }
    setSavingPerson(false);
  };

  const deletePerson = async (personId) => {
    if (!window.confirm('Remove this person?')) return;
    try { await axios.delete(`${API}/contacts/people/${personId}`, { headers: getHeaders() }); fetchCompany(); fetchActivity(); } catch (err) {}
  };

  const resolveTags = (html, person) => {
    if (!html) return '';
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return html
      .replace(/{{first_name}}/g, person?.first_name || '')
      .replace(/{{last_name}}/g, person?.last_name || '')
      .replace(/{{company_name}}/g, company?.company_name || '')
      .replace(/{{sender_name}}/g, user?.full_name || user?.name || '')
      .replace(/{{sender_email}}/g, user?.email || 'you@yourcompany.com')
      .replace(/{{city}}/g, company?.city || '')
      .replace(/{{stage}}/g, company?.stage || '');
  };

  const openEmailComposer = () => {
    setEmailForm({ person_id: '', subject: '', body_html: '', signature_html: '' });
    setSelectedTemplate(null); setEmailSuccess(false); setEmailEditorTab('visual');
    setShowEmailStep1(true);
  };

  const selectTemplate = (template) => {
    setSelectedTemplate(template);
    setEmailForm(prev => ({ ...prev, subject: template ? template.subject : '', body_html: template ? template.body_html : '', signature_html: template ? template.signature_html : '' }));
  };

  const proceedToStep2 = () => { setShowEmailStep1(false); setShowEmailStep2(true); setEmailActiveField('body'); setEmailEditorTab('visual'); };
  const getSelectedPerson = () => company?.crm_people?.find(person => person.id === emailForm.person_id) || null;
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

  const sendEmail = async () => {
    if (!emailForm.subject || !emailForm.body_html) return;
    setSavingEmail(true);
    const person = getSelectedPerson();
    try {
      const res = await axios.post(`${API}/emails/send`, {
        company_id: id, person_id: emailForm.person_id || null, template_id: selectedTemplate?.id || null,
        subject: resolvedSubject(), body_html: resolvedBody(),
        recipient_email: person?.email || null,
        recipient_name: person ? `${person.first_name} ${person.last_name}` : null,
      }, { headers: getHeaders() });
      fetchActivity(); fetchEmailTracking();
      setEmailSuccess(res.data.sendGridSuccess ? 'sent' : 'draft');
      setTimeout(() => { setShowEmailStep2(false); setEmailSuccess(false); }, 2500);
    } catch (err) { console.error(err); }
    setSavingEmail(false);
  };

  const filteredActivity = (() => {
    if (filterPerson === 'meetings') return activity.filter(a => ['Meeting Scheduled', 'Meeting Completed', 'Meeting Cancelled', 'Meeting No-show', 'Meeting Recorded'].includes(a.action));
    if (filterPerson === 'documents') return activity.filter(a => a.action === 'Document Added');
    if (filterPerson) return activity.filter(a => a.person_id === filterPerson || (!a.person_id && filterPerson === 'company'));
    return activity;
  })();

  const lastActivity = activity[0];

  const inputStyle = { width: '100%', background: p.inputBg, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '9px 12px', color: p.text, fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { color: p.textSecondary, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 5 };
  const card = { background: p.cardBg, borderRadius: 12, border: `1px solid ${p.cardBorder}` };

  if (loading) return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: p.background, minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: 40, color: p.textSecondary }}>Loading...</div>
    </div>
  );

  if (!company) return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: p.background, minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: 40, color: '#D4183D' }}>Company not found.</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: p.background, minHeight: '100vh', transition: 'background 0.4s' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: 40 }}>

        <button onClick={() => navigate('/contacts')} style={{ background: 'none', border: 'none', color: p.textSecondary, fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}>← Back to Companies</button>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>{company.category}{company.business_type ? ` · ${company.business_type}` : ''}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ color: p.text, fontSize: 32, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>{company.company_name}</h1>
            <div style={{ display: 'flex', gap: 8 }}>
              {company.stage === 'Closed Won' && can('company:edit') && <button onClick={() => setShowConvertModal(true)} style={{ background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>🤝 Convert to Client</button>}
              {company.stage === 'Converted' && <span style={{ background: '#D4EDDA', color: '#155724', borderRadius: 8, padding: '8px 16px', fontSize: 13 }}>✅ Converted to Client</span>}
              {can('email:send') && <button onClick={openEmailComposer} style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>📧 Send Email</button>}
              <button onClick={() => setShowMeetingModal(true)} style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>📅 Schedule Meeting</button>
              {company.website && <a href={company.website} target="_blank" rel="noreferrer" style={{ background: p.inputBg, color: p.primary, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '8px 14px', fontSize: 12, textDecoration: 'none' }}>🌐 Website</a>}
              {company.company_linkedin && <a href={company.company_linkedin} target="_blank" rel="noreferrer" style={{ background: p.inputBg, color: p.primary, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '8px 14px', fontSize: 12, textDecoration: 'none' }}>in LinkedIn</a>}
            </div>
          </div>
        </div>

        {/* Pipeline Stepper */}
        <div style={{ ...card, padding: '14px 20px', boxShadow: `0 2px 8px ${p.cardBorder}`, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            {STAGES.map((stage) => {
              const isActive = company.stage === stage;
              const isPast = STAGES.indexOf(company.stage) > STAGES.indexOf(stage);
              const isLost = ['Closed Lost', 'Not Interested'].includes(stage);
              const isWon = stage === 'Closed Won';
              return (
                <button key={stage} onClick={() => can('pipeline:move') ? updateStage(stage) : null}
                  style={{ cursor: can('pipeline:move') ? 'pointer' : 'default', background: isActive ? STAGE_COLORS[stage] : isPast ? STAGE_COLORS[stage] + '33' : p.inputBg, color: isActive ? '#fff' : isPast ? STAGE_COLORS[stage] : p.textSecondary, border: isActive ? `2px solid ${STAGE_COLORS[stage]}` : '2px solid transparent', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s' }}>
                  {isWon ? '🎉 ' : isLost ? '✗ ' : ''}{stage}
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
          {[
            {
              label: 'Last Activity', content: lastActivity ? (
                <div>
                  <p style={{ color: p.text, fontSize: 13, fontWeight: 500, margin: '0 0 2px' }}>{lastActivity.action}</p>
                  <p style={{ color: p.textSecondary, fontSize: 12, margin: 0 }}>{new Date(lastActivity.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
              ) : <p style={{ color: p.textMuted, fontSize: 13, margin: 0 }}>No activity yet</p>
            },
          ].map(({ label, content }) => (
            <div key={label} style={{ ...card, padding: 16 }}>
              <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px' }}>{label}</p>
              {content}
            </div>
          ))}
          <div style={{ ...card, padding: 16 }}>
            <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px' }}>Next Action</p>
            {editingNextAction ? (
              <input autoFocus value={nextAction} onChange={e => setNextAction(e.target.value)}
                onBlur={saveNextAction} onKeyDown={e => e.key === 'Enter' && saveNextAction()}
                style={{ ...inputStyle, padding: '4px 8px', fontSize: 13 }} placeholder="e.g. Send proposal..." />
            ) : (
              <p onClick={() => setEditingNextAction(true)} style={{ color: nextAction ? p.text : p.textMuted, fontSize: 13, margin: 0, cursor: 'text', fontStyle: nextAction ? 'normal' : 'italic' }}>
                {nextAction || 'Click to set next action...'}
              </p>
            )}
          </div>
          <div style={{ ...card, padding: 16 }}>
            <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px' }}>Origin</p>
            <span style={{ background: p.inputBg, color: p.textSecondary, fontSize: 12, borderRadius: 20, padding: '4px 12px' }}>{company.origin || '—'}</span>
            <span style={{ color: p.textSecondary, fontSize: 12, marginLeft: 8 }}>{company.city}{company.state ? `, ${company.state}` : ''}</span>
          </div>
          <div style={{ ...card, padding: 16 }}>
            <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px' }}>Assigned To</p>
            {can('company:assign') ? (
              <select value={company.assigned_to || ''} onChange={e => updateField('assigned_to', e.target.value || null)}
                style={{ background: p.inputBg, border: `1px solid ${p.inputBorder}`, borderRadius: 6, padding: '4px 8px', fontSize: 13, color: p.text, outline: 'none', width: '100%' }}>
                <option value="">— Unassigned —</option>
                {teamUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            ) : (
              <span style={{ color: p.text, fontSize: 13 }}>{company.crm_users?.name || '— Unassigned —'}</span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: `1px solid ${p.cardBorder}` }}>
          {['overview', 'people', 'activity', 'meetings', 'emails', 'marketing', 'documents'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ background: 'none', border: 'none', padding: '10px 20px', fontSize: 13, cursor: 'pointer', color: activeTab === tab ? p.text : p.textSecondary, fontWeight: activeTab === tab ? 600 : 400, borderBottom: activeTab === tab ? `2px solid ${p.primary}` : '2px solid transparent', textTransform: 'capitalize', fontFamily: 'Inter, sans-serif' }}>
              {tab} {tab === 'people' ? `(${company.crm_people?.length || 0})` : tab === 'activity' ? `(${activity.length})` : tab === 'meetings' ? `(${meetings.length})` : tab === 'emails' ? `(${emailTrackingData.length + marketingData.length})` : tab === 'documents' ? `(${documents.length})` : ''}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
            <div style={{ ...card, padding: 28 }}>
              <h3 style={{ color: p.text, fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>Contact Info</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 16px', marginBottom: 20 }}>
                <InlineField label="Address" value={company.company_address} onSave={v => updateField('company_address', v)} p={p} />
                <InlineField label="City" value={company.city} onSave={v => updateField('city', v)} p={p} />
                <LocationSelector
                  country={company.country} state={company.state}
                  onCountryChange={v => updateField('country', v)} onStateChange={v => updateField('state', v)}
                  labelStyle={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}
                  inputStyle={{ width: '100%', background: p.inputBg, border: `1px solid ${p.inputBorder}`, borderRadius: 6, padding: '6px 10px', color: p.text, fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' }}
                />
              </div>
              <h3 style={{ color: p.text, fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>Business</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginBottom: 20 }}>
                <div style={{ marginBottom: 8 }}>
  <label style={{ color: p.textSecondary, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Category</label>
  <CategoryComboBox value={company.category || ''} onChange={v => updateField('category', v)} />
</div>
                <InlineField label="Type" value={company.business_type} onSave={v => updateField('business_type', v)} options={company.category ? CATEGORIES[company.category] : []} p={p} />
              </div>
              <h3 style={{ color: p.text, fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>Marketing</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px 16px', marginBottom: 20 }}>
                <InlineField label="Origin" value={company.origin} onSave={v => updateField('origin', v)} options={ORIGINS} p={p} />
              </div>
              <h3 style={{ color: p.text, fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>Social</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                {[
                  { field: 'company_linkedin', label: 'LinkedIn' },
                  { field: 'facebook_url', label: 'Facebook' },
                  { field: 'instagram_url', label: 'Instagram' },
                  { field: 'website', label: 'Website' },
                ].map(({ field, label }) => (
                  <InlineField key={field} label={label} value={company[field]} onSave={v => updateField(field, v)} p={p} />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ ...card, padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: 0 }}>People ({company.crm_people?.length || 0})</h3>
                  <button onClick={() => setShowAddPerson(true)} style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>+ Add</button>
                </div>
                {company.crm_people?.length === 0 ? (
                  <p style={{ color: p.textMuted, fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No people yet</p>
                ) : company.crm_people?.map(person => (
                  <div key={person.id} style={{ background: p.inputBg, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ color: p.text, fontWeight: 600, margin: '0 0 2px', fontSize: 14 }}>{person.first_name} {person.last_name}</p>
                        {person.title && <p style={{ color: p.textSecondary, fontSize: 12, margin: '0 0 6px' }}>{person.title}</p>}
                        {person.email && <p style={{ color: p.primary, fontSize: 12, margin: '0 0 2px' }}>✉️ {person.email}</p>}
                        {person.work_phone && <p style={{ color: p.textSecondary, fontSize: 12, margin: '0 0 2px' }}>📞 {person.work_phone}</p>}
                        {person.mobile_phone && <p style={{ color: p.textSecondary, fontSize: 12, margin: 0 }}>📱 {person.mobile_phone}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {can('people:edit') && <button onClick={() => setEditingPerson({ ...person })} style={{ background: p.cardBg, border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: p.textSecondary }}>✏️</button>}
                        {can('people:delete') && <button onClick={() => deletePerson(person.id)} style={{ background: p.cardBg, border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#D4183D' }}>✕</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ ...card, padding: 24 }}>
                <h3 style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Quick Note</h3>
                <textarea value={quickNote} onChange={e => setQuickNote(e.target.value)} placeholder="Add a note..." rows={3}
                  style={{ ...inputStyle, resize: 'vertical', marginBottom: 10 }} />
                <button onClick={saveQuickNote} disabled={savingQuickNote || !quickNote.trim()}
                  style={{ background: savingQuickNote ? p.textMuted : p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', width: '100%' }}>
                  {savingQuickNote ? '⏳ Saving...' : 'Save Note'}
                </button>
                {activity.filter(a => a.action === 'Note Added').slice(0, 3).length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 8px' }}>Recent Notes</p>
                    {activity.filter(a => a.action === 'Note Added').slice(0, 3).map(a => (
                      <div key={a.id} style={{ borderLeft: `2px solid ${p.inputBorder}`, paddingLeft: 10, marginBottom: 8 }}>
                        <p style={{ color: p.text, fontSize: 13, margin: '0 0 2px', wordBreak: 'break-word' }}>{a.details?.length > 120 ? a.details.substring(0, 120) + '...' : a.details}</p>
                        <p style={{ color: p.textMuted, fontSize: 11, margin: 0 }}>{new Date(a.created_at).toLocaleDateString()}</p>
                      </div>
                    ))}
                    <button onClick={() => setActiveTab('activity')} style={{ background: 'none', border: 'none', color: p.primary, fontSize: 12, cursor: 'pointer', padding: 0, marginTop: 4 }}>View all activity →</button>
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
              <p style={{ color: p.textSecondary, fontSize: 13, margin: 0 }}>{company.crm_people?.length || 0} people at this company</p>
              <button onClick={() => setShowAddPerson(true)} style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>+ Add Person</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {company.crm_people?.length === 0 ? (
                <div style={{ ...card, padding: 40, textAlign: 'center', color: p.textMuted }}>No people added yet</div>
              ) : company.crm_people?.map(person => (
                <div key={person.id} style={{ ...card, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ color: p.text, fontWeight: 600, margin: '0 0 4px', fontSize: 15 }}>{person.first_name} {person.last_name}</p>
                    {person.title && <p style={{ color: p.textSecondary, fontSize: 13, margin: '0 0 4px' }}>{person.title}</p>}
                    <div style={{ display: 'flex', gap: 16 }}>
                      {person.email && <span style={{ color: p.primary, fontSize: 13 }}>✉️ {person.email}</span>}
                      {person.work_phone && <span style={{ color: p.textSecondary, fontSize: 13 }}>📞 {person.work_phone}</span>}
                      {person.mobile_phone && <span style={{ color: p.textSecondary, fontSize: 13 }}>📱 {person.mobile_phone}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setEditingPerson({ ...person })} style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>✏️ Edit</button>
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
            <div style={{ ...card, padding: 24, marginBottom: 24 }}>
              <h3 style={{ color: p.text, fontSize: 15, fontWeight: 600, margin: '0 0 16px' }}>Add Note</h3>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Write a note..." rows={3}
                style={{ ...inputStyle, resize: 'vertical', marginBottom: 12 }} />
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <select value={selectedPerson} onChange={e => setSelectedPerson(e.target.value)} style={{ ...inputStyle, width: 220 }}>
                  <option value="">🏢 Company note</option>
                  {company.crm_people?.map(per => <option key={per.id} value={per.id}>👤 {per.first_name} {per.last_name}</option>)}
                </select>
                <button onClick={() => { addNote(note, selectedPerson); setNote(''); setSelectedPerson(''); }} disabled={savingNote || !note.trim()}
                  style={{ background: savingNote ? p.textMuted : p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>
                  {savingNote ? '⏳ Saving...' : 'Add Note'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                { key: '', label: 'All', color: p.primary },
                { key: 'meetings', label: '📅 Meetings', color: '#B4A5D6' },
                { key: 'documents', label: '📄 Documents', color: '#94B0BC' },
                { key: 'company', label: '🏢 Company', color: p.primary },
              ].map(({ key, label, color }) => (
                <button key={key} onClick={() => { setFilterPerson(key); setActivityPage(1); }}
                  style={{ background: filterPerson === key ? color : p.inputBg, color: filterPerson === key ? '#fff' : p.textSecondary, border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
              {company.crm_people?.map(per => (
                <button key={per.id} onClick={() => { setFilterPerson(per.id); setActivityPage(1); }}
                  style={{ background: filterPerson === per.id ? p.primary : p.inputBg, color: filterPerson === per.id ? '#fff' : p.textSecondary, border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
                  👤 {per.first_name} {per.last_name}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ color: p.textSecondary, fontSize: 12, margin: 0 }}>{filteredActivity.length} total · showing {Math.min(activityPageSize, filteredActivity.length)} per page</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: p.textSecondary, fontSize: 12 }}>Per page:</span>
                {[5, 10, 25, 50].map(size => (
                  <button key={size} onClick={() => { setActivityPageSize(size); setActivityPage(1); }}
                    style={{ background: activityPageSize === size ? p.primary : p.inputBg, color: activityPageSize === size ? '#fff' : p.textSecondary, border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredActivity.length === 0 ? (
                <div style={{ ...card, padding: 40, textAlign: 'center', color: p.textMuted }}>No activity yet</div>
              ) : filteredActivity.slice((activityPage - 1) * activityPageSize, activityPage * activityPageSize).map(a => {
                const isEmail = a.action === 'Email Sent' || a.action === 'Email Draft Saved';
                const isExpanded = expandedActivity[a.id];
                const bodies = emailBodies[a.id] || [];
                return (
                  <div key={a.id} style={{ ...card, overflow: 'hidden' }}>
                    <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ background: a.action === 'Note Added' ? p.inputBg : isEmail ? '#EBF4FF' : p.inputBg, color: a.action === 'Note Added' ? p.textSecondary : isEmail ? '#1a6fad' : p.textSecondary, fontSize: 11, borderRadius: 20, padding: '2px 10px' }}>{a.action}</span>
                          {isEmail && (() => {
                            const subjectMatch = a.details.includes(': "') ? a.details.split(': "')[1]?.replace(/"$/, '') : '';
                            const match = emailTrackingData.find(e => e.subject === subjectMatch);
                            const st = match?.email_status || (a.action === 'Email Sent' ? 'sent' : null);
                            const stInfo = EMAIL_STATUS_COLORS[st];
                            return stInfo ? <span style={{ background: stInfo.bg, color: stInfo.text, fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{stInfo.label}</span> : null;
                          })()}
                          {a.crm_people && <span style={{ color: p.primary, fontSize: 12 }}>👤 {a.crm_people.first_name} {a.crm_people.last_name}</span>}
                          {!a.person_id && a.action === 'Note Added' && <span style={{ color: p.textSecondary, fontSize: 12 }}>🏢 Company</span>}
                        </div>
                        <p style={{ color: p.text, fontSize: 14, margin: '0 0 4px', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{a.details?.length > 200 ? a.details.substring(0, 200) + '...' : a.details}</p>
                        <p style={{ color: p.textMuted, fontSize: 11, margin: 0 }}>{new Date(a.created_at).toLocaleString()}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 12 }}>
                        {isEmail && (
                          <button onClick={() => { setExpandedActivity(prev => ({ ...prev, [a.id]: !prev[a.id] })); if (!emailBodies[a.id]) fetchEmailBody(a.id, id); }}
                            style={{ background: p.inputBg, border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: p.textSecondary }}>
                            {isExpanded ? '▲ Hide' : '▼ View Email'}
                          </button>
                        )}
                        {a.action === 'Note Added' && (
                          <button onClick={() => deleteActivity(a.id)} style={{ background: 'none', border: 'none', color: '#D4183D', fontSize: 12, cursor: 'pointer' }}>Delete</button>
                        )}
                      </div>
                    </div>
                    {isEmail && isExpanded && (
                      <div style={{ borderTop: `1px solid ${p.cardBorder}`, background: p.inputBg, padding: 20 }}>
                        {bodies.length === 0 ? <p style={{ color: p.textSecondary, fontSize: 13, margin: 0 }}>Loading email content...</p>
                          : (() => {
                            const subjectMatch = a.details.includes(': "') ? a.details.split(': "')[1]?.replace(/"$/, '') : '';
                            const match = bodies.find(e => e.subject === subjectMatch) || bodies[0];
                            return match ? (
                              <div>
                                <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 10px', fontWeight: 600 }}>{match.status === 'sent' ? '📤 Sent' : '💾 Draft'} · {match.subject}</p>
                                <div dangerouslySetInnerHTML={{ __html: match.body_html }} style={{ fontSize: 13, lineHeight: 1.7, color: p.text }} />
                              </div>
                            ) : <p style={{ color: p.textSecondary, fontSize: 13, margin: 0 }}>Email content not found.</p>;
                          })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredActivity.length > activityPageSize && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
                <button onClick={() => setActivityPage(prev => Math.max(1, prev - 1))} disabled={activityPage === 1}
                  style={{ background: activityPage === 1 ? p.inputBg : p.primary, color: activityPage === 1 ? p.textMuted : '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: activityPage === 1 ? 'default' : 'pointer' }}>← Prev</button>
                {Array.from({ length: Math.ceil(filteredActivity.length / activityPageSize) }, (_, i) => i + 1).map(page => (
                  <button key={page} onClick={() => setActivityPage(page)}
                    style={{ background: activityPage === page ? p.text : p.inputBg, color: activityPage === page ? '#fff' : p.textSecondary, border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                    {page}
                  </button>
                ))}
                <button onClick={() => setActivityPage(prev => Math.min(Math.ceil(filteredActivity.length / activityPageSize), prev + 1))}
                  disabled={activityPage === Math.ceil(filteredActivity.length / activityPageSize)}
                  style={{ background: activityPage === Math.ceil(filteredActivity.length / activityPageSize) ? p.inputBg : p.primary, color: activityPage === Math.ceil(filteredActivity.length / activityPageSize) ? p.textMuted : '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>Next →</button>
              </div>
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
                <p style={{ color: p.textSecondary, fontSize: 13, margin: '0 0 16px' }}>Schedule a meeting to track your interactions.</p>
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
                            <div style={{ display: 'flex', gap: 16, alignItems: 'center', color: p.textSecondary, fontSize: 12 }}>
                              <span>📅 {start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              <span>🕐 {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} — {end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                              {m.crm_users?.name && <span>👤 {m.crm_users.name}</span>}
                            </div>

                            {m.meet_link && (
                              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
                                <a href={m.meet_link} target="_blank" rel="noreferrer" style={{ color: '#4CAF50', fontSize: 12 }}>🔗 Join Meeting</a>
                                {['scheduled', 'confirmed'].includes(m.status) && !m.recall_bot_id && !recordingStatus[m.id] && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                      <button onClick={(e) => { e.stopPropagation(); startRecording(m.id, m.meet_link); }}
                                        style={{ background: '#D4183D', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer' }}>
                                        🔴 Record Meet
                                      </button>
                                      <button onClick={(e) => { e.stopPropagation(); setShowZoomInput(prev => ({ ...prev, [m.id]: !prev[m.id] })); }}
                                        style={{ background: showZoomInput[m.id] ? '#2D8CFF' : p.inputBg, color: showZoomInput[m.id] ? '#fff' : '#2D8CFF', border: '1px solid #2D8CFF', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer' }}>
                                        🎥 Zoom
                                      </button>
                                    </div>
                                    {showZoomInput[m.id] && (
                                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <input value={zoomLinkInput[m.id] || ''} onChange={e => setZoomLinkInput(prev => ({ ...prev, [m.id]: e.target.value }))}
                                          placeholder="Paste Zoom link..."
                                          style={{ flex: 1, background: p.cardBg, border: '1px solid #2D8CFF', borderRadius: 6, padding: '5px 10px', fontSize: 11, outline: 'none', fontFamily: 'Inter, sans-serif', color: p.text }} />
                                        <button onClick={() => { startRecording(m.id, zoomLinkInput[m.id]); setShowZoomInput(prev => ({ ...prev, [m.id]: false })); }}
                                          style={{ background: '#2D8CFF', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}>Send Bot</button>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {(recordingStatus[m.id] || m.recording_status) && m.recording_status !== 'completed' && (
                                  <span style={{ background: '#FFF3CD', color: '#856404', fontSize: 11, borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>
                                    {recordingStatus[m.id] === 'sending_bot' ? '⏳ Sending bot...' : recordingStatus[m.id] === 'recording' ? '⏺️ Recording...' : '⏳ Processing...'}
                                  </span>
                                )}
                              </div>
                            )}

                            {m.notes && (
                              <div style={{ marginTop: 10, padding: 12, background: p.inputBg, borderRadius: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                  <p style={{ color: p.textSecondary, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', margin: 0, fontWeight: 600 }}>Meeting Notes</p>
                                  {m.status === 'completed' && editingNotes !== m.id && (
                                    <button onClick={() => { setEditingNotes(m.id); setEditingNotesText(m.notes); }}
                                      style={{ background: 'none', border: 'none', color: p.primary, fontSize: 11, cursor: 'pointer', padding: 0 }}>✏️ Edit</button>
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
                                        h1: ({ node, ...props }) => <h1 style={{ fontSize: 16, fontWeight: 700, margin: '12px 0 6px', color: p.text }} {...props} />,
                                        h2: ({ node, ...props }) => <h2 style={{ fontSize: 15, fontWeight: 600, margin: '10px 0 6px', color: p.text }} {...props} />,
                                        h3: ({ node, ...props }) => <h3 style={{ fontSize: 14, fontWeight: 600, margin: '8px 0 4px', color: p.text }} {...props} />,
                                        p: ({ node, ...props }) => <p style={{ margin: '0 0 8px', color: p.text }} {...props} />,
                                        ul: ({ node, ...props }) => <ul style={{ paddingLeft: 20, margin: '4px 0 8px' }} {...props} />,
                                        li: ({ node, ...props }) => <li style={{ marginBottom: 4, color: p.text }} {...props} />,
                                        strong: ({ node, ...props }) => <strong style={{ fontWeight: 600, color: p.text }} {...props} />,
                                      }}>
                                      {m.notes}
                                    </ReactMarkdown>
                                  </div>
                                )}
                              </div>
                            )}

                            {m.ai_summary && (
                              <div style={{ marginTop: 10, padding: 16, background: '#EBF4FF', borderRadius: 10, border: '1px solid rgba(26,111,173,0.1)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                  <p style={{ color: '#1a6fad', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', margin: 0, fontWeight: 600 }}>🤖 AI Meeting Intelligence</p>
                                  <button onClick={() => regenerateSummary(m.id)} disabled={processingTranscript[m.id]}
                                    style={{ background: 'none', border: 'none', color: p.primary, fontSize: 10, cursor: 'pointer', padding: 0 }}>
                                    {processingTranscript[m.id] ? '⏳ Regenerating...' : '🔄 Regenerate'}
                                  </button>
                                </div>
                                <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}
                                    components={{
                                      h2: ({ node, ...props }) => <h2 style={{ fontSize: 13, fontWeight: 700, color: '#1a6fad', margin: '14px 0 6px', textTransform: 'uppercase', letterSpacing: 0.8 }} {...props} />,
                                      h3: ({ node, ...props }) => <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1a6fad', margin: '10px 0 4px' }} {...props} />,
                                      p: ({ node, ...props }) => <p style={{ margin: '0 0 8px', color: p.text }} {...props} />,
                                      ul: ({ node, ...props }) => <ul style={{ paddingLeft: 18, margin: '4px 0 8px' }} {...props} />,
                                      li: ({ node, ...props }) => <li style={{ marginBottom: 4, color: p.text }} {...props} />,
                                      strong: ({ node, ...props }) => <strong style={{ fontWeight: 600, color: p.text }} {...props} />,
                                    }}>
                                    {m.ai_summary}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            )}

                            {m.recall_bot_id && !m.transcript && !['sending_bot', 'recording'].includes(m.recording_status) && (
                              <button onClick={() => processTranscript(m.id)} disabled={processingTranscript[m.id]}
                                style={{ marginTop: 10, background: processingTranscript[m.id] ? p.textMuted : '#1a6fad', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', width: '100%' }}>
                                {processingTranscript[m.id] ? '⏳ Fetching transcript...' : '📝 Fetch Transcript & Generate AI Summary'}
                              </button>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                            {needsComplete && (
                              <button onClick={() => { setReschedulingMeeting(reschedulingMeeting === m.id ? null : m.id); setRescheduleForm({ date: '', start_hour: '10', start_min: '00', end_hour: '11', end_min: '00' }); }}
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
                            <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 12px', fontWeight: 600 }}>New Date & Time</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <input type="date" value={rescheduleForm.date} onChange={e => setRescheduleForm(prev => ({ ...prev, date: e.target.value }))}
                                style={{ background: p.cardBg, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', color: p.text }} />
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                {['start_hour', 'start_min', null, 'end_hour', 'end_min'].map((field, i) => field === null ? (
                                  <span key={i} style={{ color: p.textSecondary, fontSize: 13 }}>to</span>
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
                                <button onClick={() => setReschedulingMeeting(null)}
                                  style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                              </div>
                            </div>
                          </div>
                        )}

                        {isExpanded && (
                          <div style={{ borderTop: `1px solid ${p.cardBorder}`, padding: 20, background: p.inputBg }}>
                            <textarea value={completionNotes} onChange={e => setCompletionNotes(e.target.value)}
                              placeholder="What was discussed? Key takeaways, next steps..."
                              rows={4} style={{ width: '100%', background: p.cardBg, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', color: p.text, lineHeight: 1.6 }} />
                            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                              <button onClick={() => completeMeeting(m.id)} disabled={savingCompletion}
                                style={{ flex: 1, background: savingCompletion ? p.textMuted : '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, cursor: 'pointer' }}>
                                {savingCompletion ? '⏳ Saving...' : '✓ Mark Complete & Save Notes'}
                              </button>
                              <button onClick={() => setCompletingMeeting(null)}
                                style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
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
              <div style={{ ...card, padding: 60, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
                <p style={{ color: p.text, fontSize: 15, fontWeight: 500, margin: '0 0 6px' }}>No emails sent yet</p>
                <p style={{ color: p.textSecondary, fontSize: 13, margin: 0 }}>Send an email from this profile to see tracking data here.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Total Sent', count: emailTrackingData.length + marketingData.length, color: p.textSecondary },
                    { label: 'Delivered', count: emailTrackingData.filter(e => ['delivered', 'opened', 'clicked'].includes(e.email_status)).length, color: '#1565C0' },
                    { label: 'Opened', count: emailTrackingData.filter(e => ['opened', 'clicked'].includes(e.email_status)).length, color: '#2E7D32' },
                    { label: 'Clicked', count: emailTrackingData.filter(e => e.email_status === 'clicked').length, color: '#E65100' },
                    { label: 'Bounced', count: emailTrackingData.filter(e => e.email_status === 'bounced').length, color: '#C62828' },
                  ].map((c, i) => (
                    <div key={i} style={{ ...card, padding: '16px 20px' }}>
                      <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 6px' }}>{c.label}</p>
                      <p style={{ color: c.color, fontSize: 22, fontWeight: 700, margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>{c.count}</p>
                    </div>
                  ))}
                </div>
                <div style={{ ...card, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: p.inputBg }}>
                        {['Type', 'Subject', 'Recipient', 'Sent', 'Status', 'Opened', 'Clicked'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: p.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {emailTrackingData.map((email, i) => {
                        const st = EMAIL_STATUS_COLORS[email.email_status || 'sent'];
                        return (
                          <tr key={`direct-${email.id}`} style={{ borderTop: `1px solid ${p.cardBorder}`, background: i % 2 === 0 ? p.cardBg : p.inputBg }}>
                            <td style={{ padding: '12px 16px' }}><span style={{ background: '#EBF4FF', color: '#1a6fad', fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>Direct</span></td>
                            <td style={{ padding: '12px 16px', fontSize: 13, color: p.text, fontWeight: 500, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.subject || '(no subject)'}</td>
                            <td style={{ padding: '12px 16px', fontSize: 12, color: p.textSecondary }}>{email.crm_people ? `${email.crm_people.first_name} ${email.crm_people.last_name}` : '—'}</td>
                            <td style={{ padding: '12px 16px', fontSize: 12, color: p.textSecondary }}>{email.sent_at ? new Date(email.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                            <td style={{ padding: '12px 16px' }}><span style={{ background: st.bg, color: st.text, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>{st.label}</span></td>
                            <td style={{ padding: '12px 16px', fontSize: 12, color: email.opened_at ? '#2E7D32' : p.textSecondary }}>{email.opened_at ? new Date(email.opened_at).toLocaleDateString() : '—'}</td>
                            <td style={{ padding: '12px 16px', fontSize: 12, color: email.clicked_at ? '#E65100' : p.textSecondary }}>{email.clicked_at ? new Date(email.clicked_at).toLocaleDateString() : '—'}</td>
                          </tr>
                        );
                      })}
                      {marketingData.map((r, i) => (
                        <tr key={`campaign-${r.id}`} style={{ borderTop: `1px solid ${p.cardBorder}`, background: (emailTrackingData.length + i) % 2 === 0 ? p.cardBg : p.inputBg }}>
                          <td style={{ padding: '12px 16px' }}><span style={{ background: '#F3E8FF', color: '#7C3AED', fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>Campaign</span></td>
                          <td style={{ padding: '12px 16px', fontSize: 13, color: p.text, fontWeight: 500, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.crm_campaigns?.name || '—'}</td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: p.textSecondary }}>{r.email || '—'}</td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: p.textSecondary }}>{r.crm_campaigns?.sent_at ? new Date(r.crm_campaigns.sent_at).toLocaleDateString() : '—'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ background: ['opened', 'clicked'].includes(r.status) ? '#E8F5E9' : r.status === 'bounced' ? '#FFEBEE' : p.inputBg, color: ['opened', 'clicked'].includes(r.status) ? '#2E7D32' : r.status === 'bounced' ? '#C62828' : p.textSecondary, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>{r.status}</span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: r.opened_at ? '#2E7D32' : p.textSecondary }}>{r.opened_at ? new Date(r.opened_at).toLocaleDateString() : '—'}</td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: r.clicked_at ? '#E65100' : p.textSecondary }}>{r.clicked_at ? new Date(r.clicked_at).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
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
              <p style={{ color: p.textSecondary, fontSize: 13, margin: 0 }}>{documents.length} document{documents.length !== 1 ? 's' : ''}</p>
              <button onClick={() => { setEditingDoc(null); setDocForm({ title: '', type: 'Other', notes: '' }); setDocFile(null); setShowDocModal(true); }}
                style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>+ Add Document</button>
            </div>
            {documents.length === 0 ? (
              <div style={{ ...card, padding: 40, textAlign: 'center' }}>
                <p style={{ color: p.textMuted, fontSize: 14, margin: 0 }}>No documents yet</p>
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
                      <button onClick={() => { setEditingDoc(doc); setDocForm({ title: doc.title, type: doc.type, notes: doc.notes || '' }); setDocFile(null); setShowDocModal(true); }}
                        style={{ background: p.inputBg, color: p.text, border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>Edit</button>
                      <button onClick={async () => { if (!window.confirm('Delete this document?')) return; await axios.delete(`${API}/documents/${doc.id}`, { headers: getHeaders() }); fetchDocuments(); }}
                        style={{ background: 'none', color: '#D4183D', border: 'none', borderRadius: 6, padding: '6px 8px', fontSize: 12, cursor: 'pointer' }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MARKETING TAB */}
        {activeTab === 'marketing' && (
          <div>
            {company.crm_people?.some(per => per.marketing_unsubscribed) && (
              <div style={{ background: '#FFE5D0', borderRadius: 10, padding: '12px 20px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>🚫</span>
                  <p style={{ color: '#856404', fontSize: 13, fontWeight: 600, margin: 0 }}>Unsubscribed Contacts</p>
                </div>
                {company.crm_people.filter(per => per.marketing_unsubscribed).map(per => (
                  <div key={per.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid rgba(133,100,4,0.15)' }}>
                    <span style={{ color: '#856404', fontSize: 12 }}>{per.first_name} {per.last_name} — {per.email}</span>
                    <button onClick={async () => { try { await axios.post(`${API}/marketing/resubscribe/${per.id}`, {}, { headers: getHeaders() }); fetchCompany(); } catch (err) {} }}
                      style={{ background: '#fff', color: '#856404', border: '1px solid #856404', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Resubscribe</button>
                  </div>
                ))}
              </div>
            )}
            {marketingData.length === 0 ? (
              <div style={{ ...card, padding: 60, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📣</div>
                <p style={{ color: p.text, fontSize: 15, fontWeight: 500, margin: '0 0 6px' }}>No campaign activity yet</p>
                <p style={{ color: p.textSecondary, fontSize: 13, margin: 0 }}>This contact hasn't been included in any campaigns yet.</p>
              </div>
            ) : (
              <div style={{ ...card, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: p.inputBg }}>
                      {['Campaign', 'Recipient', 'Sent', 'Status', 'Opened', 'Clicked'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: p.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {marketingData.map((r, i) => (
                      <tr key={r.id} style={{ borderTop: `1px solid ${p.cardBorder}`, background: i % 2 === 0 ? p.cardBg : p.inputBg }}>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: p.text, fontWeight: 500 }}>{r.crm_campaigns?.name}</td>
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
              </div>
            )}
          </div>
        )}

        {/* EMAIL STEP 1 */}
        {showEmailStep1 && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: p.cardBg, borderRadius: 16, padding: 40, width: 580, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ color: p.text, fontSize: 22, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 6px' }}>New Email</h2>
              <p style={{ color: p.textSecondary, fontSize: 13, margin: '0 0 24px' }}>to <strong>{company.company_name}</strong></p>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Send To</label>
                <select value={emailForm.person_id} onChange={e => setEmailForm(prev => ({ ...prev, person_id: e.target.value }))} style={inputStyle}>
                  <option value="">🏢 No specific person</option>
                  {company.crm_people?.map(per => <option key={per.id} value={per.id}>👤 {per.first_name} {per.last_name}{per.email ? ` — ${per.email}` : ' (no email)'}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 28 }}>
                <label style={labelStyle}>Choose Template</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                  <div onClick={() => selectTemplate(null)}
                    style={{ padding: '12px 16px', borderRadius: 10, border: selectedTemplate === null ? `2px solid ${p.primary}` : `1px solid ${p.cardBorder}`, cursor: 'pointer', background: selectedTemplate === null ? p.inputBg : p.cardBg }}>
                    <p style={{ color: p.text, fontSize: 13, fontWeight: 500, margin: 0 }}>✏️ Blank email</p>
                    <p style={{ color: p.textSecondary, fontSize: 12, margin: '2px 0 0' }}>Start from scratch</p>
                  </div>
                  {templates.map(t => (
                    <div key={t.id} onClick={() => selectTemplate(t)}
                      style={{ padding: '12px 16px', borderRadius: 10, border: selectedTemplate?.id === t.id ? `2px solid ${p.primary}` : `1px solid ${p.cardBorder}`, cursor: 'pointer', background: selectedTemplate?.id === t.id ? p.inputBg : p.cardBg }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ color: p.text, fontSize: 13, fontWeight: 500, margin: 0 }}>{t.name}</p>
                        <span style={{ background: p.inputBg, color: p.textSecondary, fontSize: 11, borderRadius: 20, padding: '2px 8px' }}>{t.category}</span>
                      </div>
                      <p style={{ color: p.textSecondary, fontSize: 12, margin: '2px 0 0' }}>{t.subject}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={proceedToStep2} style={{ flex: 1, background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>Continue →</button>
                <button onClick={() => setShowEmailStep1(false)} style={{ flex: 1, background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* EMAIL STEP 2 */}
        {showEmailStep2 && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: p.cardBg, borderRadius: 16, width: '90vw', maxWidth: 1100, height: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: `1px solid ${p.cardBorder}` }}>
              <div style={{ padding: '20px 28px', borderBottom: `1px solid ${p.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                  <h2 style={{ color: p.text, fontSize: 20, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 2px' }}>Compose Email</h2>
                  <p style={{ color: p.textSecondary, fontSize: 12, margin: 0 }}>To: <strong>{company.company_name}</strong>{getSelectedPerson() && <span> · {getSelectedPerson().first_name} {getSelectedPerson().last_name}</span>}</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setShowEmailStep2(false); setShowEmailStep1(true); }}
                    style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>← Back</button>
                  {emailSuccess ? (
                    <button style={{ background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13 }}>
                      {emailSuccess === 'sent' ? '✅ Email Sent!' : '💾 Saved as Draft'}
                    </button>
                  ) : (
                    <button onClick={sendEmail} disabled={savingEmail || !emailForm.subject || !emailForm.body_html}
                      style={{ background: savingEmail ? p.textMuted : p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>
                      {savingEmail ? '⏳ Sending...' : getSelectedPerson()?.email ? '📤 Send Email' : '💾 Save Draft'}
                    </button>
                  )}
                  <button onClick={() => setShowEmailStep2(false)}
                    style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>✕</button>
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
                        <button key={tab} onClick={() => setEmailEditorTab(tab)}
                          style={{ background: emailEditorTab === tab ? p.text : p.inputBg, color: emailEditorTab === tab ? '#fff' : p.textSecondary, border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer' }}>
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
                  <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px', fontWeight: 600 }}>Merge Tags</p>
                  <p style={{ color: p.textSecondary, fontSize: 12, margin: '0 0 14px', lineHeight: 1.5 }}>Click or drag to insert</p>
                  {MERGE_TAGS.map(({ tag, label }) => (
                    <button key={tag} onClick={() => insertEmailTag(tag)} draggable onDragStart={e => e.dataTransfer.setData('text/plain', tag)}
                      style={{ display: 'block', width: '100%', background: p.cardBg, border: `1px solid ${p.cardBorder}`, borderRadius: 8, padding: '8px 10px', marginBottom: 7, cursor: 'grab', textAlign: 'left' }}>
                      <p style={{ color: p.text, fontSize: 11, fontWeight: 500, margin: '0 0 2px' }}>{label}</p>
                      <p style={{ color: p.primary, fontSize: 10, margin: 0, fontFamily: 'monospace' }}>{tag}</p>
                    </button>
                  ))}
                  <div style={{ marginTop: 16, padding: 10, background: p.cardBg, borderRadius: 8, border: `1px solid ${p.cardBorder}` }}>
                    <p style={{ color: p.textSecondary, fontSize: 11, margin: 0, lineHeight: 1.5 }}>
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
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: p.cardBg, borderRadius: 16, padding: 40, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: `1px solid ${p.cardBorder}` }}>
              <h2 style={{ color: p.text, fontSize: 22, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 24px' }}>Add Person</h2>
              <form onSubmit={addPerson}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                  {[['First Name *', 'first_name', true], ['Last Name', 'last_name', false], ['Title', 'title', false], ['Email', 'email', false], ['Work Phone', 'work_phone', false], ['Mobile Phone', 'mobile_phone', false]].map(([label, field, required]) => (
                    <div key={field}>
                      <label style={labelStyle}>{label}</label>
                      <input required={required} value={personForm[field]} onChange={e => setPersonForm({ ...personForm, [field]: e.target.value })} style={inputStyle} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="submit" disabled={savingPerson} style={{ flex: 1, background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>{savingPerson ? '⏳ Saving...' : 'Add Person'}</button>
                  <button type="button" onClick={() => setShowAddPerson(false)} style={{ flex: 1, background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Person Modal */}
        {editingPerson && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: p.cardBg, borderRadius: 16, padding: 40, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: `1px solid ${p.cardBorder}` }}>
              <h2 style={{ color: p.text, fontSize: 22, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 24px' }}>Edit Person</h2>
              <form onSubmit={saveEditPerson}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                  {[['First Name *', 'first_name', true], ['Last Name', 'last_name', false], ['Title', 'title', false], ['Email', 'email', false], ['Work Phone', 'work_phone', false], ['Mobile Phone', 'mobile_phone', false]].map(([label, field, required]) => (
                    <div key={field}>
                      <label style={labelStyle}>{label}</label>
                      <input required={required} value={editingPerson[field] || ''} onChange={e => setEditingPerson({ ...editingPerson, [field]: e.target.value })} style={inputStyle} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="submit" disabled={savingPerson} style={{ flex: 1, background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>{savingPerson ? '⏳ Saving...' : 'Save Changes'}</button>
                  <button type="button" onClick={() => setEditingPerson(null)} style={{ flex: 1, background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Document Modal */}
        {showDocModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: p.cardBg, borderRadius: 16, padding: 32, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: `1px solid ${p.cardBorder}` }}>
              <h2 style={{ color: p.text, fontSize: 18, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 20px' }}>
                {editingDoc ? 'Edit Document' : 'Add Document'}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Title *</label>
                  <input value={docForm.title} onChange={e => setDocForm(prev => ({ ...prev, title: e.target.value }))} style={inputStyle} placeholder="e.g. Signed Contract 2026" />
                </div>
                <div>
                  <label style={labelStyle}>Type</label>
                  <select value={docForm.type} onChange={e => setDocForm(prev => ({ ...prev, type: e.target.value }))} style={inputStyle}>
                    {['Contract', 'Invoice', 'Proposal', 'NDA', 'Presentation', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Notes (optional)</label>
                  <textarea value={docForm.notes} onChange={e => setDocForm(prev => ({ ...prev, notes: e.target.value }))} rows={2}
                    style={{ ...inputStyle, resize: 'vertical' }} placeholder="Any relevant notes..." />
                </div>
                {!editingDoc && (
                  <div>
                    <label style={labelStyle}>File *</label>
                    <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.csv"
                      onChange={e => { const file = e.target.files[0]; if (file) { setDocFile(file); if (!docForm.title) setDocForm(prev => ({ ...prev, title: file.name.replace(/\.[^.]+$/, '') })); } }}
                      style={{ fontSize: 13, width: '100%', color: p.text }} />
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
                      await axios.post(`${API}/documents/upload`, formData, { headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' } });
                    }
                    fetchDocuments(); setShowDocModal(false);
                  } catch (err) { alert('Failed to save document'); }
                  setSavingDoc(false);
                }} disabled={savingDoc}
                  style={{ flex: 1, background: savingDoc ? p.textMuted : p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                  {savingDoc ? '⏳ Saving...' : editingDoc ? 'Update' : 'Upload'}
                </button>
                <button onClick={() => setShowDocModal(false)}
                  style={{ flex: 1, background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '11px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Convert to Client Modal */}
        {showConvertModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: p.cardBg, borderRadius: 16, padding: 40, width: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: `1px solid ${p.cardBorder}` }}>
              <h2 style={{ color: p.text, fontSize: 22, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 6px' }}>Convert to Client</h2>
              <p style={{ color: p.textSecondary, fontSize: 13, margin: '0 0 24px' }}>Converting <strong>{company.company_name}</strong> from a lead to an active client.</p>
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
                {convertForm.contract_type !== 'Commission' && (
                  <div>
                    <label style={labelStyle}>{convertForm.contract_type === 'Subscription' ? 'Monthly Amount ($)' : 'Base Amount ($)'}</label>
                    <input type="number" value={convertForm.contract_amount || ''} onChange={e => setConvertForm(prev => ({ ...prev, contract_amount: e.target.value }))} style={inputStyle} placeholder="e.g. 500" />
                  </div>
                )}
                {convertForm.contract_type !== 'Subscription' && (
                  <div>
                    <label style={labelStyle}>{convertForm.contract_type === 'Commission' ? 'Commission Rate (%)' : 'Revenue Share (%)'}</label>
                    <input type="number" value={convertForm.commission_rate} onChange={e => setConvertForm(prev => ({ ...prev, commission_rate: e.target.value }))} style={inputStyle} placeholder="e.g. 5" />
                  </div>
                )}
                <div>
                  <label style={labelStyle}>Notes</label>
                  <textarea value={convertForm.notes} onChange={e => setConvertForm(prev => ({ ...prev, notes: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Any notes about this client..." />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button onClick={convertToClient} disabled={converting}
                  style={{ flex: 1, background: converting ? p.textMuted : '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                  {converting ? '⏳ Converting...' : '🤝 Convert to Client'}
                </button>
                <button onClick={() => setShowConvertModal(false)}
                  style={{ flex: 1, background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>

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