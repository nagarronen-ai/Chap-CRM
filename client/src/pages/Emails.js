import { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import axios from 'axios';

const API = 'http://localhost:5000/api';
const CATEGORIES = ['Outreach', 'Follow-up', 'Proposal', 'Meeting Confirmation', 'General'];
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

const DEFAULT_SIGNATURE = `<div style="font-family: Arial, sans-serif; font-size: 13px; color: #666; border-top: 1px solid #eee; padding-top: 12px; margin-top: 20px;">
  <strong>{{sender_name}}</strong><br>
  Planfor.io<br>
  {{sender_email}}
</div>`;

export default function Emails() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [activeTab, setActiveTab] = useState('html');
  const [activeField, setActiveField] = useState('body');
  const [form, setForm] = useState({ name: '', category: 'Outreach', subject: '', body_html: DEFAULT_TEMPLATE, signature_html: DEFAULT_SIGNATURE });
  const [formErrors, setFormErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showSignatureEditor, setShowSignatureEditor] = useState(false);
  const [signature, setSignature] = useState(DEFAULT_SIGNATURE);
  const [savingSignature, setSavingSignature] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const editorRef = useRef(null);
  const subjectRef = useRef(null);

  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    try {
      const res = await axios.get(`${API}/emails/templates`, { headers: getHeaders() });
      setTemplates(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const openNew = () => {
    setEditingTemplate(null);
    setForm({ name: '', category: 'Outreach', subject: '', body_html: DEFAULT_TEMPLATE, signature_html: signature });
    setFormErrors([]);
    setShowEditor(true);
    setPreviewMode(false);
    setActiveTab('html');
  };

  const openEdit = (template) => {
    setEditingTemplate(template);
    setForm({ name: template.name, category: template.category, subject: template.subject, body_html: template.body_html, signature_html: template.signature_html || signature });
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
      const textarea = editorRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newVal = form.body_html.substring(0, start) + tag + form.body_html.substring(end);
      setForm(prev => ({ ...prev, body_html: newVal }));
      setTimeout(() => { textarea.focus(); textarea.selectionStart = textarea.selectionEnd = start + tag.length; }, 0);
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <h1 style={{ color: '#3E423D', fontSize: 30, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>Email Templates</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowSignatureEditor(true)}
              style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.15)', borderRadius: 8, padding: '10px 18px', fontSize: 13, cursor: 'pointer' }}>
              ✍️ Edit Signature
            </button>
            <button onClick={openNew}
              style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, cursor: 'pointer' }}>
              + New Template
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ color: '#717182' }}>Loading...</p>
        ) : templates.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 12, padding: 60, textAlign: 'center', border: '1px solid rgba(62,66,61,0.1)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
            <p style={{ color: '#3E423D', fontSize: 16, fontWeight: 500, margin: '0 0 8px' }}>No templates yet</p>
            <p style={{ color: '#717182', fontSize: 13, margin: '0 0 24px' }}>Create your first email template to get started</p>
            <button onClick={openNew} style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>+ New Template</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {templates.map(t => (
              <div key={t.id} style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid rgba(62,66,61,0.1)', boxShadow: '0 2px 8px rgba(62,66,61,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <span style={{ background: CATEGORY_COLORS[t.category] + '22', color: CATEGORY_COLORS[t.category], fontSize: 11, borderRadius: 20, padding: '3px 10px', fontWeight: 500 }}>{t.category}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(t)} style={{ background: '#F5F3EF', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#5A6059' }}>✏️ Edit</button>
                    <button onClick={() => deleteTemplate(t.id)} style={{ background: '#fdf0f0', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#D4183D' }}>Delete</button>
                  </div>
                </div>
                <h3 style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: '0 0 6px' }}>{t.name}</h3>
                <p style={{ color: '#717182', fontSize: 13, margin: '0 0 12px' }}>Subject: {t.subject}</p>
                <p style={{ color: '#CBCED4', fontSize: 11, margin: 0 }}>Updated {new Date(t.updated_at || t.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}

        {/* Template Editor Modal */}
        {showEditor && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(62,66,61,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 1100, height: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(62,66,61,0.2)' }}>

              {/* Header */}
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

              {/* Error Banner */}
              {formErrors.length > 0 && (
                <div style={{ background: '#fdf0f0', border: 'none', borderBottom: '1px solid #D4183D', padding: '10px 28px', flexShrink: 0 }}>
                  <p style={{ color: '#D4183D', fontSize: 13, margin: 0 }}>
                    ⚠️ Please fill in: <strong>{formErrors.map(f => f === 'name' ? 'Template Name' : f === 'subject' ? 'Subject Line' : 'Email Body').join(', ')}</strong>
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <div style={{ flex: 1, padding: 28, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Meta Fields */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 14 }}>
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

                  {/* Body */}
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
                          <div dangerouslySetInnerHTML={{ __html: resolvePreview(form.body_html + (form.signature_html || '')) }} />
                        </div>
                      </div>
                    ) : activeTab === 'html' ? (
                      <textarea
                        ref={editorRef}
                        value={form.body_html}
                        onChange={e => { setForm({ ...form, body_html: e.target.value }); setFormErrors(prev => prev.filter(f => f !== 'body_html')); }}
                        onFocus={() => setActiveField('body')}
                        onDragOver={e => e.preventDefault()}
                        onDrop={handleBodyDrop}
                        style={{ ...inputStyle, minHeight: 340, fontFamily: 'monospace', fontSize: 12, resize: 'vertical', lineHeight: 1.6, border: formErrors.includes('body_html') ? '1px solid #D4183D' : activeField === 'body' ? '1px solid #8E9B8B' : '1px solid rgba(62,66,61,0.1)' }}
                      />
                    ) : (
                      <div
                        style={{ border: formErrors.includes('body_html') ? '1px solid #D4183D' : activeField === 'body' ? '1px solid #8E9B8B' : '1px solid rgba(62,66,61,0.1)', borderRadius: 8, overflow: 'hidden', minHeight: 340 }}
                        onFocus={() => setActiveField('body')}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => {
                          e.preventDefault();
                          const tag = e.dataTransfer.getData('text/plain');
                          let range;
                          if (document.caretRangeFromPoint) {
                            range = document.caretRangeFromPoint(e.clientX, e.clientY);
                          } else if (document.caretPositionFromPoint) {
                            const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
                            range = document.createRange();
                            range.setStart(pos.offsetNode, pos.offset);
                          }
                          if (range) {
                            const sel = window.getSelection();
                            sel.removeAllRanges();
                            sel.addRange(range);
                            document.execCommand('insertText', false, tag);
                            const el = e.currentTarget.querySelector('[contenteditable]');
                            if (el) setForm(prev => ({ ...prev, body_html: el.innerHTML }));
                          }
                        }}
                      >
                        <div style={{ background: '#F5F3EF', padding: '8px 12px', borderBottom: '1px solid rgba(62,66,61,0.1)', display: 'flex', gap: 8 }}>
                          {[{ cmd: 'bold', label: '<b>B</b>' }, { cmd: 'italic', label: '<i>I</i>' }, { cmd: 'underline', label: '<u>U</u>' }].map(({ cmd, label }) => (
                            <button key={cmd} onMouseDown={e => { e.preventDefault(); document.execCommand(cmd); }}
                              style={{ background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 4, padding: '3px 10px', fontSize: 13, cursor: 'pointer' }}
                              dangerouslySetInnerHTML={{ __html: label }} />
                          ))}
                        </div>
                        <div
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={e => setForm({ ...form, body_html: e.target.innerHTML })}
                          dangerouslySetInnerHTML={{ __html: form.body_html }}
                          style={{ padding: 16, minHeight: 280, outline: 'none', fontSize: 14, lineHeight: 1.7, color: '#3E423D' }}
                        />
                      </div>
                    )}
                  </div>

                  {!previewMode && (
                    <div style={{ background: '#F5F3EF', borderRadius: 8, padding: 16, border: '1px solid rgba(62,66,61,0.1)' }}>
                      <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 8px' }}>Signature Preview</p>
                      <div dangerouslySetInnerHTML={{ __html: form.signature_html || signature }} style={{ fontSize: 13 }} />
                    </div>
                  )}
                </div>

                {/* Merge Tags Sidebar */}
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

        {/* Signature Editor */}
        {showSignatureEditor && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(62,66,61,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 640, boxShadow: '0 20px 60px rgba(62,66,61,0.2)' }}>
              <h2 style={{ color: '#3E423D', fontSize: 22, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 8px' }}>Email Signature</h2>
              <p style={{ color: '#717182', fontSize: 13, margin: '0 0 20px' }}>This signature will be appended to all emails you send from the CRM.</p>
              <label style={labelStyle}>Signature HTML</label>
              <textarea value={signature} onChange={e => setSignature(e.target.value)} rows={8}
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12, marginBottom: 16, resize: 'vertical' }} />
              <p style={{ color: '#717182', fontSize: 12, margin: '0 0 10px' }}>Preview:</p>
              <div style={{ background: '#F5F3EF', borderRadius: 8, padding: 16, marginBottom: 24 }}>
                <div dangerouslySetInnerHTML={{ __html: resolvePreview(signature) }} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => { setSavingSignature(true); setTimeout(() => { setSavingSignature(false); setShowSignatureEditor(false); }, 500); }}
                  style={{ flex: 1, background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>
                  {savingSignature ? '⏳ Saving...' : 'Save Signature'}
                </button>
                <button onClick={() => setShowSignatureEditor(false)}
                  style={{ flex: 1, background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}