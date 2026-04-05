import { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useRole } from '../hooks/useRole';
import TiptapEditor from '../components/TiptapEditor';
import HtmlEditor from '../components/HtmlEditor';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';
const CATEGORIES = ['Outreach', 'Follow-up', 'Proposal', 'Meeting Confirmation', 'General', 'Waitlist'];
const DESIGN_TYPES = [
  { type: 'transactional', label: 'Transactional', width: 600, desc: 'Waitlist confirmation, drip emails, system emails' },
  { type: 'campaign', label: 'Campaign', width: 600, desc: 'Vendor outreach campaigns' },
  { type: 'newsletter', label: 'Newsletter', width: 700, desc: 'Weekly newsletter to waitlist couples' },
];
const MERGE_TAGS = [
  { tag: '{{first_name}}', label: 'First Name' },
  { tag: '{{last_name}}', label: 'Last Name' },
  { tag: '{{company_name}}', label: 'Company Name' },
  { tag: '{{sender_name}}', label: 'Sender Name' },
  { tag: '{{sender_email}}', label: 'Sender Email' },
  { tag: '{{city}}', label: 'City' },
  { tag: '{{stage}}', label: 'Stage' },
];

const DEFAULT_TEMPLATE = `<div style="font-family: Arial, sans-serif; font-size: 15px; color: #222; line-height: 1.6; max-width: 600px;">
  <p>Hi {{first_name}},</p>
  <p>I hope this message finds you well!</p>
  <p>I'm reaching out from Planfor — we help wedding vendors grow their business and connect with more couples.</p>
  <p>I'd love to learn more about {{company_name}} and explore how we might work together.</p>
  <p>Would you be open to a quick call this week?</p>
  <p>Best,<br>{{sender_name}}</p>
</div>`;

export default function Emails() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [activeTab, setActiveTab] = useState('html');
  const [activeField, setActiveField] = useState('body');
  const [form, setForm] = useState({ name: '', category: 'Outreach', subject: '', body_html: DEFAULT_TEMPLATE, signature_html: '', visibility: 'team', include_signature: false });
  const [formErrors, setFormErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const editorRef = useRef(null);
  const subjectRef = useRef(null);
  const [signature, setSignature] = useState('');
  const [designTab, setDesignTab] = useState('templates');
  const [designTemplates, setDesignTemplates] = useState([]);
  const [editingDesign, setEditingDesign] = useState(null);
  const [designForm, setDesignForm] = useState({ name: '', type: 'transactional', width: 600, header_html: '', footer_html: '', wrapper_html: '', active: true });
  const [showDesignEditor, setShowDesignEditor] = useState(false);
  const [savingDesign, setSavingDesign] = useState(false);

  const { role } = useRole();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const canCreate = ['admin', 'marketing', 'sales', 'csm', 'support', 'finance'].includes(role);

  const canEditTemplate = (t) => {
    if (role === 'admin') return true;
    if (role === 'marketing' && (t.visibility === 'team' || t.created_by === currentUser.id)) return true;
    if (t.created_by === currentUser.id) return true;
    return false;
  };

  const canSetTeamVisibility = ['admin', 'marketing'].includes(role);

  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  useEffect(() => { fetchTemplates(); }, []);
  useEffect(() => { fetchDesignTemplates(); }, []);
  useEffect(() => {
    axios.get(`${API}/users/me`, { headers: getHeaders() })
      .then(res => setSignature(res.data.email_signature || ''))
      .catch(() => {});
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await axios.get(`${API}/emails/templates`, { headers: getHeaders() });
      setTemplates(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchDesignTemplates = async () => {
    try {
      const res = await axios.get(`${API}/design-templates`, { headers: getHeaders() });
      setDesignTemplates(res.data);
    } catch (err) { console.error(err); }
  };

  const saveDesignTemplate = async () => {
    setSavingDesign(true);
    try {
      if (editingDesign) {
        await axios.put(`${API}/design-templates/${editingDesign.id}`, designForm, { headers: getHeaders() });
      } else {
        await axios.post(`${API}/design-templates`, designForm, { headers: getHeaders() });
      }
      setShowDesignEditor(false);
      fetchDesignTemplates();
    } catch (err) { console.error(err); }
    setSavingDesign(false);
  };

  const toggleDesignActive = async (dt) => {
    try {
      await axios.put(`${API}/design-templates/${dt.id}`, { active: !dt.active }, { headers: getHeaders() });
      fetchDesignTemplates();
    } catch (err) { console.error(err); }
  };

  const deleteDesignTemplate = async (id) => {
    if (!window.confirm('Delete this design template?')) return;
    try {
      await axios.delete(`${API}/design-templates/${id}`, { headers: getHeaders() });
      fetchDesignTemplates();
    } catch (err) { console.error(err); }
  };

  const openNew = () => {
    setEditingTemplate(null);
    setForm({ name: '', category: 'Outreach', subject: '', body_html: DEFAULT_TEMPLATE, signature_html: '', visibility: canSetTeamVisibility ? 'team' : 'private', include_signature: false });
    setFormErrors([]);
    setShowEditor(true);
    setPreviewMode(false);
    setActiveTab('html');
  };

  const openEdit = (template) => {
    setEditingTemplate(template);
    setForm({ name: template.name, category: template.category, subject: template.subject, body_html: template.body_html, signature_html: template.signature_html || '', visibility: template.visibility || 'private', include_signature: template.include_signature || false });
    setFormErrors([]);
    setShowEditor(true);
    setPreviewMode(false);
    setActiveTab('html');
  };

  const saveTemplate = async () => {
    const errors = [];
    if (!form.name) errors.push('name');
    if (!form.subject) errors.push('subject');
    if (!form.body_html) errors.push('body_html');
    if (errors.length > 0) { setFormErrors(errors); return; }
    setFormErrors([]);
    setSaving(true);
    try {
      if (editingTemplate) {
        await axios.put(`${API}/emails/templates/${editingTemplate.id}`, form, { headers: getHeaders() });
      } else {
        await axios.post(`${API}/emails/templates`, form, { headers: getHeaders() });
      }
      setShowEditor(false);
      fetchTemplates();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await axios.delete(`${API}/emails/templates/${id}`, { headers: getHeaders() });
      fetchTemplates();
    } catch (err) { console.error(err); }
  };

  const insertTagAtCursor = (tag) => {
    if (activeField === 'subject') {
      const input = subjectRef.current;
      if (!input) return;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const newVal = form.subject.substring(0, start) + tag + form.subject.substring(end);
      setForm(prev => ({ ...prev, subject: newVal }));
      setTimeout(() => { input.focus(); input.selectionStart = input.selectionEnd = start + tag.length; }, 0);
    } else {
      if (activeTab === 'html') {
        const textarea = editorRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newVal = form.body_html.substring(0, start) + tag + form.body_html.substring(end);
        setForm(prev => ({ ...prev, body_html: newVal }));
        setTimeout(() => { textarea.focus(); textarea.selectionStart = textarea.selectionEnd = start + tag.length; }, 0);
      } else {
        setForm(prev => {
          const current = prev.body_html || '';
          const updated = current.replace(/<\/p>\s*$/, tag + '</p>') !== current
            ? current.replace(/<\/p>\s*$/, tag + '</p>')
            : current + tag;
          return { ...prev, body_html: updated };
        });
      }
    }
  };

  const handleSubjectDrop = (e) => {
    e.preventDefault();
    const tag = e.dataTransfer.getData('text/plain');
    const input = subjectRef.current;
    if (!input) return;
    input.focus();
    const dropPos = input.selectionStart || 0;
    const newVal = form.subject.substring(0, dropPos) + tag + form.subject.substring(dropPos);
    setForm(prev => ({ ...prev, subject: newVal }));
    setTimeout(() => { input.selectionStart = input.selectionEnd = dropPos + tag.length; }, 0);
  };

  const handleBodyDrop = (e) => {
    e.preventDefault();
    const tag = e.dataTransfer.getData('text/plain');
    const textarea = editorRef.current;
    if (!textarea) return;
    textarea.focus();
    const dropPos = textarea.selectionStart || 0;
    const newVal = form.body_html.substring(0, dropPos) + tag + form.body_html.substring(dropPos);
    setForm(prev => ({ ...prev, body_html: newVal }));
    setTimeout(() => { textarea.focus(); textarea.selectionStart = textarea.selectionEnd = dropPos + tag.length; }, 0);
  };

  const resolvePreview = (html) => {
    if (!html) return '';
    return html
      .replace(/{{first_name}}/g, 'Jane')
      .replace(/{{last_name}}/g, 'Smith')
      .replace(/{{company_name}}/g, 'Sunset Venue')
      .replace(/{{sender_name}}/g, 'Dan Sitbon')
      .replace(/{{sender_email}}/g, 'dan.s@planfor.io')
      .replace(/{{city}}/g, 'Austin')
      .replace(/{{stage}}/g, 'New');
  };

  const inputStyle = { width: '100%', background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '9px 12px', color: '#3E423D', fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 5 };
  const CATEGORY_COLORS = { 'Outreach': '#94B0BC', 'Follow-up': '#D4A574', 'Proposal': '#B4A5D6', 'Meeting Confirmation': '#8E9B8B', 'General': '#717182' };

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 240, flex: 1, padding: 40 }}>

        <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>Communication</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ color: '#3E423D', fontSize: 30, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>Email Templates</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            {canCreate && designTab === 'design' && (
              <button onClick={() => { setEditingDesign(null); setDesignForm({ name: '', type: 'transactional', width: 600, header_html: '', footer_html: '', wrapper_html: '', active: true }); setShowDesignEditor(true); }}
                style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, cursor: 'pointer' }}>
                + New Design Template
              </button>
            )}
            {canCreate && designTab === 'templates' && (
              <button onClick={openNew}
                style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, cursor: 'pointer' }}>
                + New Template
              </button>
            )}
          </div>
        </div>

        {/* Tab navigation */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(62,66,61,0.1)', marginBottom: 24 }}>
          {[{ key: 'templates', label: 'Email Templates' }, { key: 'design', label: '🎨 Design Templates' }].map(({ key, label }) => (
            <button key={key} onClick={() => setDesignTab(key)}
              style={{ background: 'none', border: 'none', borderBottom: designTab === key ? '2px solid #8E9B8B' : '2px solid transparent', padding: '10px 20px', fontSize: 13, color: designTab === key ? '#1a1d1a' : '#717182', fontWeight: designTab === key ? 600 : 400, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ─── DESIGN TEMPLATES VIEW ─────────────────────────────────────── */}
        {designTab === 'design' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              {DESIGN_TYPES.map(dt => {
                const existing = designTemplates.find(d => d.type === dt.type);
                return (
                  <div key={dt.type} style={{ background: '#fff', borderRadius: 12, padding: 24, border: `1px solid ${existing?.active ? 'rgba(142,155,139,0.3)' : 'rgba(62,66,61,0.1)'}`, boxShadow: '0 2px 8px rgba(62,66,61,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>{dt.label}</h3>
                        <p style={{ color: '#717182', fontSize: 12, margin: 0 }}>{dt.desc}</p>
                      </div>
                      {existing && (
                        <div onClick={() => toggleDesignActive(existing)}
                          style={{ width: 36, height: 20, borderRadius: 10, background: existing.active ? '#8E9B8B' : '#D5CEC0', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                          <div style={{ position: 'absolute', top: 2, left: existing.active ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                        </div>
                      )}
                    </div>
                    <div style={{ background: '#F5F3EF', borderRadius: 6, padding: '8px 12px', marginBottom: 16 }}>
                      <p style={{ color: '#717182', fontSize: 11, margin: 0 }}>Width: {dt.width}px · {existing ? (existing.active ? '✅ Active' : '⏸ Inactive') : '⚠️ Not created'}</p>
                    </div>
                    {existing ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => { setEditingDesign(existing); setDesignForm({ name: existing.name, type: existing.type, width: existing.width, header_html: existing.header_html || '', footer_html: existing.footer_html || '', wrapper_html: existing.wrapper_html || '', active: existing.active }); setShowDesignEditor(true); }}
                          style={{ flex: 1, background: '#F5F3EF', border: 'none', borderRadius: 6, padding: '8px', fontSize: 12, cursor: 'pointer', color: '#3E423D' }}>✏️ Edit</button>
                        <button onClick={() => deleteDesignTemplate(existing.id)}
                          style={{ background: '#fdf0f0', border: 'none', borderRadius: 6, padding: '8px 12px', fontSize: 12, cursor: 'pointer', color: '#D4183D' }}>Delete</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingDesign(null); setDesignForm({ name: dt.label, type: dt.type, width: dt.width, header_html: '', footer_html: '', wrapper_html: '', active: true }); setShowDesignEditor(true); }}
                        style={{ width: '100%', background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 6, padding: '8px', fontSize: 12, cursor: 'pointer' }}>
                        + Create {dt.label} Template
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── EMAIL TEMPLATES VIEW ──────────────────────────────────────── */}
        {designTab === 'templates' && (
          <>
            {loading ? (
              <p style={{ color: '#717182' }}>Loading...</p>
            ) : templates.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 12, padding: 60, textAlign: 'center', border: '1px solid rgba(62,66,61,0.1)' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
                <p style={{ color: '#3E423D', fontSize: 16, fontWeight: 500, margin: '0 0 8px' }}>No templates yet</p>
                <p style={{ color: '#717182', fontSize: 13, margin: '0 0 24px' }}>Create your first email template to get started</p>
                {canCreate && <button onClick={openNew} style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>+ New Template</button>}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {templates.map(t => (
                  <div key={t.id} style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.1)', boxShadow: '0 2px 8px rgba(62,66,61,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ background: (CATEGORY_COLORS[t.category] || '#717182') + '22', color: CATEGORY_COLORS[t.category] || '#717182', fontSize: 11, borderRadius: 20, padding: '3px 10px', fontWeight: 500 }}>{t.category}</span>
                        <span style={{ background: t.visibility === 'team' ? '#E5F0FF' : '#F5F3EF', color: t.visibility === 'team' ? '#4A7CC7' : '#717182', fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {t.visibility === 'team' ? '🌐 Team' : '🔒 Private'}
                        </span>
                      </div>
                      {canEditTemplate(t) && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEdit(t)} style={{ background: '#F5F3EF', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#5A6059' }}>✏️ Edit</button>
                          <button onClick={() => deleteTemplate(t.id)} style={{ background: '#fdf0f0', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#D4183D' }}>Delete</button>
                        </div>
                      )}
                    </div>
                    <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: '0 0 6px' }}>{t.name}</h3>
                    <p style={{ color: '#717182', fontSize: 13, margin: '0 0 6px' }}>Subject: {t.subject}</p>
                    {t.crm_users?.name && <p style={{ color: '#CBCED4', fontSize: 11, margin: '0 0 6px' }}>By {t.crm_users.name}</p>}
                    <p style={{ color: '#CBCED4', fontSize: 11, margin: 0 }}>Updated {new Date(t.updated_at || t.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ─── DESIGN TEMPLATE EDITOR MODAL ─────────────────────────────── */}
        {showDesignEditor && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(62,66,61,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 900, height: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(62,66,61,0.2)' }}>
              <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(62,66,61,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <h2 style={{ color: '#3E423D', fontSize: 18, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>
                  {editingDesign ? 'Edit Design Template' : 'New Design Template'} — {designForm.type}
                </h2>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={saveDesignTemplate} disabled={savingDesign}
                    style={{ background: savingDesign ? '#A5B2A3' : '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>
                    {savingDesign ? '⏳ Saving...' : '💾 Save'}
                  </button>
                  <button onClick={() => setShowDesignEditor(false)}
                    style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>✕</button>
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Template Name</label>
                    <input value={designForm.name} onChange={e => setDesignForm(prev => ({ ...prev, name: e.target.value }))} style={inputStyle} placeholder="e.g. Planfor Transactional" />
                  </div>
                  <div>
                    <label style={labelStyle}>Type</label>
                    <select value={designForm.type} onChange={e => setDesignForm(prev => ({ ...prev, type: e.target.value }))} style={inputStyle}>
                      {DESIGN_TYPES.map(dt => <option key={dt.type} value={dt.type}>{dt.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Width (px)</label>
                    <input type="number" value={designForm.width} onChange={e => setDesignForm(prev => ({ ...prev, width: parseInt(e.target.value) }))} style={inputStyle} />
                  </div>
                </div>
                <div style={{ background: '#F5F3EF', borderRadius: 8, padding: 16, fontSize: 12, color: '#717182', lineHeight: 1.6 }}>
                  <strong style={{ color: '#3E423D' }}>How it works:</strong> Use <code>wrapper_html</code> with a <code>{'{{content}}'}</code> placeholder for full control, OR use separate <code>header_html</code> + <code>footer_html</code> that wrap around your email body.
                </div>
                <div>
                  <label style={labelStyle}>Header HTML</label>
                  <HtmlEditor value={designForm.header_html} onChange={val => setDesignForm(prev => ({ ...prev, header_html: val }))} minHeight="180px" />
                </div>
                <div>
                  <label style={labelStyle}>Footer HTML</label>
                  <HtmlEditor value={designForm.footer_html} onChange={val => setDesignForm(prev => ({ ...prev, footer_html: val }))} minHeight="180px" />
                </div>
                <div>
                  <label style={labelStyle}>Full Wrapper HTML (optional — overrides header/footer if set)</label>
                  <p style={{ color: '#717182', fontSize: 11, margin: '0 0 6px' }}>Use <code style={{ background: '#F5F3EF', padding: '1px 4px', borderRadius: 3 }}>{'{{content}}'}</code> where the email body should go</p>
                  <HtmlEditor value={designForm.wrapper_html} onChange={val => setDesignForm(prev => ({ ...prev, wrapper_html: val }))} minHeight="200px" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── EMAIL TEMPLATE EDITOR MODAL ──────────────────────────────── */}
        {showEditor && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(62,66,61,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 1100, height: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(62,66,61,0.2)' }}>
              <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(62,66,61,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <h2 style={{ color: '#3E423D', fontSize: 20, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>
                  {editingTemplate ? 'Edit Template' : 'New Template'}
                </h2>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setPreviewMode(!previewMode)}
                    style={{ background: previewMode ? '#3E423D' : '#F5F3EF', color: previewMode ? '#fff' : '#3E423D', border: '1px solid rgba(62,66,61,0.15)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
                    {previewMode ? '✏️ Edit' : '👁 Preview'}
                  </button>
                  <button onClick={saveTemplate} disabled={saving}
                    style={{ background: saving ? '#A5B2A3' : '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>
                    {saving ? '⏳ Saving...' : '💾 Save Template'}
                  </button>
                  <button onClick={() => setShowEditor(false)}
                    style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>✕ Close</button>
                </div>
              </div>

              {formErrors.length > 0 && (
                <div style={{ background: '#fdf0f0', borderBottom: '1px solid #D4183D', padding: '10px 28px', flexShrink: 0 }}>
                  <p style={{ color: '#D4183D', fontSize: 13, margin: 0 }}>
                    ⚠️ Please fill in: <strong>{formErrors.map(f => f === 'name' ? 'Template Name' : f === 'subject' ? 'Subject Line' : 'Email Body').join(', ')}</strong>
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <div style={{ flex: 1, padding: 28, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: canSetTeamVisibility ? '1fr 1fr 1fr 2fr' : '1fr 1fr 2fr', gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Template Name *</label>
                      <input
                        value={form.name}
                        onChange={e => { setForm({ ...form, name: e.target.value }); setFormErrors(prev => prev.filter(f => f !== 'name')); }}
                        onFocus={() => setActiveField('name')}
                        style={{ ...inputStyle, border: formErrors.includes('name') ? '1px solid #D4183D' : '1px solid rgba(62,66,61,0.1)' }}
                        placeholder="e.g. Cold Outreach"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Category</label>
                      <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    {canSetTeamVisibility && (
                      <div>
                        <label style={labelStyle}>Visibility</label>
                        <select value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value })} style={inputStyle}>
                          <option value="team">🌐 Team — visible to all</option>
                          <option value="private">🔒 Private — only me</option>
                        </select>
                      </div>
                    )}
                    <div>
                      <label style={labelStyle}>
                        Subject Line * {activeField === 'subject' && !formErrors.includes('subject') && <span style={{ color: '#8E9B8B', fontSize: 10, marginLeft: 4 }}>← inserting here</span>}
                      </label>
                      <input
                        ref={subjectRef}
                        value={form.subject}
                        onChange={e => { setForm({ ...form, subject: e.target.value }); setFormErrors(prev => prev.filter(f => f !== 'subject')); }}
                        onFocus={() => setActiveField('subject')}
                        onDragOver={e => e.preventDefault()}
                        onDrop={handleSubjectDrop}
                        style={{ ...inputStyle, border: formErrors.includes('subject') ? '1px solid #D4183D' : activeField === 'subject' ? '1px solid #8E9B8B' : '1px solid rgba(62,66,61,0.1)' }}
                        placeholder="e.g. Partnership opportunity for {{company_name}}"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F5F3EF', borderRadius: 8, padding: '12px 16px', border: '1px solid rgba(62,66,61,0.08)' }}>
                    <div>
                      <p style={{ color: '#3E423D', fontSize: 13, fontWeight: 500, margin: '0 0 2px' }}>Include Signature</p>
                      <p style={{ color: '#717182', fontSize: 11, margin: 0 }}>Append your email signature when sending this template</p>
                    </div>
                    <div onClick={() => setForm(prev => ({ ...prev, include_signature: !prev.include_signature }))}
                      style={{ width: 40, height: 22, borderRadius: 11, background: form.include_signature ? '#8E9B8B' : '#D5CEC0', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: 3, left: form.include_signature ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 12, alignItems: 'center' }}>
                      <label style={{ ...labelStyle, marginBottom: 0, marginRight: 'auto' }}>
                        Email Body * {activeField === 'body' && !previewMode && !formErrors.includes('body_html') && <span style={{ color: '#8E9B8B', fontSize: 10, marginLeft: 4 }}>← inserting here</span>}
                      </label>
                      {!previewMode && ['html', 'visual'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                          style={{ background: activeTab === tab ? '#3E423D' : '#F5F3EF', color: activeTab === tab ? '#fff' : '#717182', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer' }}>
                          {tab === 'html' ? 'HTML' : '✨ Visual'}
                        </button>
                      ))}
                    </div>

                    {previewMode ? (
                      <div style={{ background: '#f9f9f9', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: 24, minHeight: 300 }}>
                        <div style={{ background: '#fff', borderRadius: 8, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                          <p style={{ color: '#717182', fontSize: 12, margin: '0 0 4px' }}>Subject: <strong style={{ color: '#3E423D' }}>{resolvePreview(form.subject)}</strong></p>
                          <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '12px 0' }} />
                          <div dangerouslySetInnerHTML={{ __html: resolvePreview(form.body_html + (form.include_signature && signature ? '<br><br><div style="margin-top:16px;padding-top:12px;border-top:1px solid #e0e0e0;">' + signature + '</div>' : '')) }} />
                        </div>
                      </div>
                    ) : activeTab === 'html' ? (
                      <div style={{ overflow: 'hidden', width: '100%' }}>
                        <HtmlEditor
                          value={form.body_html}
                          onChange={val => { setForm(prev => ({ ...prev, body_html: val })); setFormErrors(prev => prev.filter(f => f !== 'body_html')); }}
                          minHeight="340px"
                        />
                      </div>
                    ) : (
                      <TiptapEditor
                        content={form.body_html}
                        onChange={html => { setForm(prev => ({ ...prev, body_html: html })); setFormErrors(prev => prev.filter(f => f !== 'body_html')); }}
                        onFocus={() => setActiveField('body')}
                        placeholder="Write your email template..."
                        minHeight={340}
                      />
                    )}
                  </div>

                  {!previewMode && signature && form.include_signature && (
                    <div style={{ background: '#F5F3EF', borderRadius: 8, padding: 16, border: '1px solid rgba(62,66,61,0.1)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: 0 }}>Your Signature</p>
                        <span style={{ color: '#717182', fontSize: 11 }}>Edit in Settings → Email Signature</span>
                      </div>
                      <div dangerouslySetInnerHTML={{ __html: signature }} style={{ fontSize: 13 }} />
                    </div>
                  )}
                </div>

                <div style={{ width: 220, borderLeft: '1px solid rgba(62,66,61,0.1)', padding: 20, overflowY: 'auto', background: '#FAFAF9', flexShrink: 0 }}>
                  <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 6px', fontWeight: 600 }}>Merge Tags</p>
                  <p style={{ color: '#717182', fontSize: 12, margin: '0 0 16px', lineHeight: 1.5 }}>Click to insert at cursor, or drag into any field</p>
                  {MERGE_TAGS.map(({ tag, label }) => (
                    <button key={tag}
                      onClick={() => insertTagAtCursor(tag)}
                      draggable
                      onDragStart={e => e.dataTransfer.setData('text/plain', tag)}
                      style={{ display: 'block', width: '100%', background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px 12px', marginBottom: 8, cursor: 'grab', textAlign: 'left' }}
                      onMouseOver={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(62,66,61,0.12)'}
                      onMouseOut={e => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <p style={{ color: '#3E423D', fontSize: 12, fontWeight: 500, margin: '0 0 2px' }}>{label}</p>
                      <p style={{ color: '#94B0BC', fontSize: 11, margin: 0, fontFamily: 'monospace' }}>{tag}</p>
                    </button>
                  ))}
                  <div style={{ marginTop: 16, padding: 12, background: '#E5E1D8', borderRadius: 8 }}>
                    <p style={{ color: '#5A6059', fontSize: 11, margin: 0, lineHeight: 1.5 }}>
                      Active field: <strong>{activeField === 'subject' ? '📌 Subject' : '📝 Body'}</strong><br /><br />
                      Tags auto-resolve with real data when sending from a company profile.
                    </p>
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