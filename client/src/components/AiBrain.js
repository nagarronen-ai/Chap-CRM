import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useApp } from '../context/AppContext';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const ACTION_LABELS = {
  send_email: '📧 Send Email', book_meeting: '📅 Book Meeting',
  cancel_meeting: '❌ Cancel Meeting', reschedule_meeting: '📅 Reschedule Meeting',
  send_bulk_email: '📧 Bulk Email', propose_meeting: '📩 Propose Meeting',
};

function formatActionSummary(action) {
  const { tool, args } = action;
  switch (tool) {
    case 'send_email': return `Send email to ${args.recipient_name} (${args.recipient_email})\nSubject: "${args.subject}"${args.cc?.length > 0 ? `\nCC: ${args.cc.join(', ')}` : ''}\n\n${args.body}`;
    case 'send_bulk_email': return `Send email to ${args.recipients?.length || 0} contacts\nSubject: "${args.subject}"\n\n${args.body}`;
    case 'propose_meeting': return `Send meeting proposal to ${args.recipient_name} (${args.recipient_email})\nSubject: "${args.subject}"\nProposed: ${args.proposed_date} at ${args.proposed_start_hour}:${String(args.proposed_start_min || 0).padStart(2, '0')} — ${args.proposed_end_hour}:${String(args.proposed_end_min || 0).padStart(2, '0')}\n\n${args.body}`;
    case 'book_meeting': return `Book meeting: "${args.title}"\nDate: ${args.date} at ${args.start_hour}:${String(args.start_min || 0).padStart(2, '0')} — ${args.end_hour}:${String(args.end_min || 0).padStart(2, '0')}\n${args.attendee_email ? `Invite: ${args.attendee_email}` : ''}`;
    case 'cancel_meeting': return `Cancel meeting ID: ${args.meeting_id}`;
    case 'reschedule_meeting': return `Reschedule meeting to ${args.date} at ${args.start_hour}:${String(args.start_min || 0).padStart(2, '0')}`;
    default: return JSON.stringify(args, null, 2);
  }
}

export default function AiBrain() {
  const { palette: p } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  useEffect(() => { if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (activeTab === 'history') fetchHistory(); }, [activeTab]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try { const res = await axios.get(`${API}/ai/history`, { headers: getHeaders() }); setHistory(res.data); }
    catch (err) { console.error(err); }
    setLoadingHistory(false);
  };

  const sendMessage = async () => {
    if ((!input.trim() && !attachedFile) || loading) return;
    const userMessage = input.trim();
    const file = attachedFile;
    setInput(''); setAttachedFile(null); setLoading(true); setPendingActions(null);

    try {
      if (file) {
        setUploadingFile(true);
        const formData = new FormData(); formData.append('file', file);
        let fileUrl = '', parsedData = null;
        const isInvoiceLike = /\.(pdf|png|jpg|jpeg)$/i.test(file.name);
        if (isInvoiceLike) {
          try { const parseForm = new FormData(); parseForm.append('invoice', file); const parseRes = await axios.post(`${API}/finance/invoices/parse`, parseForm, { headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' } }); parsedData = parseRes.data; }
          catch (err) {}
        }
        try { const uploadRes = await axios.post(`${API}/uploads/receipts`, formData, { headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' } }); fileUrl = uploadRes.data.url || ''; }
        catch (err) { console.error('Upload failed:', err); }
        setUploadingFile(false);
        let messageContent = userMessage || '';
        if (parsedData && !userMessage) messageContent = `I uploaded a file: "${file.name}". It looks like an invoice from ${parsedData.vendor || 'unknown vendor'} for $${parsedData.amount || '?'}. What should I do with it?`;
        else if (!userMessage) messageContent = `I uploaded a file: "${file.name}". What should I do with it?`;
        else messageContent = `${userMessage} [File attached: ${file.name}${fileUrl ? `, url: ${fileUrl}` : ''}${parsedData ? `, parsed: ${JSON.stringify(parsedData)}` : ''}]`;
        setMessages(prev => [...prev, { role: 'user', content: userMessage || `📎 ${file.name}`, fileAttachment: { name: file.name, url: fileUrl, parsed: parsedData } }]);
        const res = await axios.post(`${API}/ai/chat`, { message: messageContent, conversationId: currentConversationId, fileContext: { name: file.name, url: fileUrl, parsed: parsedData } }, { headers: getHeaders() });
        if (res.data.conversationId) setCurrentConversationId(res.data.conversationId);
        handleResponse(res.data);
      } else {
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        const res = await axios.post(`${API}/ai/chat`, { message: userMessage, conversationId: currentConversationId }, { headers: getHeaders() });
        if (res.data.conversationId) setCurrentConversationId(res.data.conversationId);
        handleResponse(res.data);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Something went wrong. Please try again.' }]);
    }
    setLoading(false); setUploadingFile(false);
  };

  const handleResponse = (data) => {
    if (data.type === 'confirmation') {
      if (data.content) setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
      setPendingActions(data.pending_actions);
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
      setPendingActions(null);
    }
  };

  const confirmActions = async (confirmed) => {
    if (!confirmed) { setPendingActions(null); setMessages(prev => [...prev, { role: 'assistant', content: '↩️ Action cancelled.' }]); return; }
    setLoading(true); setPendingActions(null);
    try {
      const res = await axios.post(`${API}/ai/chat`, { message: null, pendingConfirmation: { confirmed: true, actions: pendingActions } }, { headers: getHeaders() });
      handleResponse(res.data);
    } catch (err) { setMessages(prev => [...prev, { role: 'assistant', content: '❌ Action failed. Please try again.' }]); }
    setLoading(false);
  };

  const startNewConversation = async () => {
    try { const res = await axios.post(`${API}/ai/new-conversation`, {}, { headers: getHeaders() }); setCurrentConversationId(res.data.id); setMessages([]); setPendingActions(null); }
    catch (err) { console.error(err); }
  };

  return (
    <>
      {/* Floating button */}
      <button onClick={() => setIsOpen(prev => !prev)}
        style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, width: 52, height: 52, borderRadius: '50%', background: isOpen ? p.text : p.primary, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 22, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
        title="AI Assistant">
        {isOpen ? '✕' : '🧠'}
      </button>

      {/* Widget */}
      {isOpen && (
        <div style={{ position: 'fixed', bottom: 88, right: 24, zIndex: 9998, width: 380, height: 560, background: p.cardBg, borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', border: `1px solid ${p.cardBorder}` }}>

          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${p.cardBorder}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <p style={{ color: p.text, fontSize: 14, fontWeight: 600, margin: 0 }}>🧠 AI Assistant</p>
                <p style={{ color: p.textSecondary, fontSize: 11, margin: 0 }}>Chap CRM Brain</p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={startNewConversation} style={{ background: p.inputBg, border: 'none', borderRadius: 6, color: p.textSecondary, fontSize: 11, cursor: 'pointer', padding: '4px 10px' }}>+ New Chat</button>
                <button onClick={() => { setMessages([]); setPendingActions(null); }} style={{ background: 'none', border: 'none', color: p.textMuted, fontSize: 11, cursor: 'pointer', padding: 0 }}>Clear</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 0, background: p.inputBg, borderRadius: 8, overflow: 'hidden' }}>
              {['chat', 'history'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{ flex: 1, background: activeTab === tab ? p.primary : 'transparent', color: activeTab === tab ? '#fff' : p.textSecondary, border: 'none', padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif', textTransform: 'capitalize', fontWeight: activeTab === tab ? 600 : 400 }}>
                  {tab === 'chat' ? '💬 Chat' : '📋 History'}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <p style={{ fontSize: 28, margin: '0 0 8px' }}>🧠</p>
                    <p style={{ color: p.text, fontSize: 13, fontWeight: 500, margin: '0 0 4px' }}>Hi, I'm your CRM assistant</p>
                    <p style={{ color: p.textSecondary, fontSize: 12, margin: '0 0 16px' }}>Ask me anything or tell me what to do</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {['What does my pipeline look like?', 'Any stale leads this week?', 'Book a meeting with Acme Corp tomorrow at 3pm', 'Add a note to Plan4 Advisory'].map(suggestion => (
                        <button key={suggestion} onClick={() => setInput(suggestion)}
                          style={{ background: p.inputBg, border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: p.textSecondary, cursor: 'pointer', textAlign: 'left' }}>
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: 12, background: msg.role === 'user' ? p.primary : p.inputBg, color: msg.role === 'user' ? '#fff' : p.text, fontSize: 13, lineHeight: 1.5, borderBottomRightRadius: msg.role === 'user' ? 4 : 12, borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 12, whiteSpace: 'pre-wrap' }}>
                      {msg.fileAttachment && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 6, padding: '4px 8px', marginBottom: 6, fontSize: 11 }}>
                          <span>📎</span>
                          <span style={{ opacity: 0.9 }}>{msg.fileAttachment.name}</span>
                          {msg.fileAttachment.parsed && <span style={{ opacity: 0.7 }}>· parsed ✓</span>}
                        </div>
                      )}
                      <span>{msg.content}</span>
                      {msg.timestamp && <div style={{ fontSize: 10, color: msg.role === 'user' ? 'rgba(255,255,255,0.6)' : p.textMuted, marginTop: 4, textAlign: 'right' }}>{new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>}
                    </div>
                  </div>
                ))}

                {pendingActions && (
                  <div style={{ background: '#FFF3CD', borderRadius: 12, padding: 16, border: '1px solid rgba(133,100,4,0.2)' }}>
                    <p style={{ color: '#856404', fontSize: 12, fontWeight: 600, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>⚠️ Confirm Actions ({pendingActions.length})</p>
                    {pendingActions.map((action, i) => (
                      <div key={i} style={{ background: p.cardBg, borderRadius: 8, padding: 12, marginBottom: 8, border: '1px solid rgba(133,100,4,0.15)' }}>
                        <p style={{ color: '#856404', fontSize: 11, fontWeight: 600, margin: '0 0 4px' }}>{ACTION_LABELS[action.tool] || action.tool}</p>
                        <p style={{ color: p.textSecondary, fontSize: 11, margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{formatActionSummary(action)}</p>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button onClick={() => confirmActions(true)} style={{ flex: 1, background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>✓ Confirm</button>
                      <button onClick={() => confirmActions(false)} style={{ flex: 1, background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '8px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                )}

                {loading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ background: p.inputBg, borderRadius: 12, borderBottomLeftRadius: 4, padding: '10px 14px', fontSize: 13, color: p.textSecondary }}>🧠 Thinking...</div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div style={{ padding: '12px 16px', borderTop: `1px solid ${p.cardBorder}`, flexShrink: 0 }}>
                {attachedFile && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: p.inputBg, borderRadius: 8, padding: '6px 10px', marginBottom: 8 }}>
                    <span style={{ fontSize: 16 }}>📎</span>
                    <span style={{ flex: 1, fontSize: 12, color: p.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachedFile.name}</span>
                    <button onClick={() => setAttachedFile(null)} style={{ background: 'none', border: 'none', color: '#D4183D', cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <button onClick={() => fileInputRef.current?.click()} disabled={loading}
                    style={{ background: p.inputBg, border: 'none', borderRadius: 10, width: 38, height: 38, cursor: 'pointer', fontSize: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Attach file">
                    📎
                  </button>
                  <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xlsx,.csv" style={{ display: 'none' }}
                    onChange={e => { const file = e.target.files[0]; if (file) setAttachedFile(file); e.target.value = ''; }} />
                  <textarea value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder={attachedFile ? "Add a message or just send the file..." : "Ask me anything..."}
                    rows={2}
                    style={{ flex: 1, background: p.inputBg, border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'Inter, sans-serif', color: p.text, lineHeight: 1.5 }} />
                  <button onClick={sendMessage} disabled={(!input.trim() && !attachedFile) || loading}
                    style={{ background: (input.trim() || attachedFile) && !loading ? p.primary : p.inputBorder, color: '#fff', border: 'none', borderRadius: 10, width: 38, height: 38, cursor: input.trim() && !loading ? 'pointer' : 'default', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    ↑
                  </button>
                </div>
                <p style={{ color: p.textMuted, fontSize: 10, margin: '6px 0 0', textAlign: 'center' }}>Enter to send · Shift+Enter for new line</p>
              </div>
            </>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {loadingHistory ? (
                <p style={{ color: p.textSecondary, fontSize: 13, textAlign: 'center', padding: 20 }}>Loading...</p>
              ) : history.length === 0 ? (
                <p style={{ color: p.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>No conversations yet</p>
              ) : history.map(conv => (
                <div key={conv.id} style={{ background: p.inputBg, borderRadius: 10, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <p style={{ color: p.text, fontSize: 12, fontWeight: 500, margin: 0 }}>{conv.crm_users?.name || 'You'}</p>
                    <p style={{ color: p.textMuted, fontSize: 10, margin: 0 }}>{new Date(conv.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <p style={{ color: p.textSecondary, fontSize: 12, margin: '0 0 6px', lineHeight: 1.4 }}>{conv.last_message || '—'}</p>
                  {conv.actions_taken?.length > 0 && <p style={{ color: p.primary, fontSize: 10, margin: 0 }}>{conv.actions_taken.length} action{conv.actions_taken.length > 1 ? 's' : ''} taken</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}