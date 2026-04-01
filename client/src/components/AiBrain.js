import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const ACTION_LABELS = {
  send_email: '📧 Send Email',
  book_meeting: '📅 Book Meeting',
  cancel_meeting: '❌ Cancel Meeting',
  reschedule_meeting: '📅 Reschedule Meeting',
  send_bulk_email: '📧 Bulk Email',
  propose_meeting: '📩 Propose Meeting',
};

function formatActionSummary(action) {
  const { tool, args } = action;
  switch (tool) {
    case 'send_email':
      return `Send email to ${args.recipient_name} (${args.recipient_email})\nSubject: "${args.subject}"${args.cc && args.cc.length > 0 ? `\nCC: ${args.cc.join(', ')}` : ''}\n\n${args.body}`;
      case 'send_bulk_email':
      return `Send email to ${args.recipients?.length || 0} contacts\nSubject: "${args.subject}"\n\n${args.body}`;
      case 'propose_meeting':
      return `Send meeting proposal to ${args.recipient_name} (${args.recipient_email})\nSubject: "${args.subject}"\nProposed: ${args.proposed_date} at ${args.proposed_start_hour}:${String(args.proposed_start_min || 0).padStart(2,'0')} — ${args.proposed_end_hour}:${String(args.proposed_end_min || 0).padStart(2,'0')}\n\n${args.body}`;
      case 'book_meeting':
      return `Book meeting: "${args.title}"\nDate: ${args.date} at ${args.start_hour}:${String(args.start_min || 0).padStart(2,'0')} — ${args.end_hour}:${String(args.end_min || 0).padStart(2,'0')}\n${args.attendee_email ? `Invite: ${args.attendee_email}` : ''}`;
    case 'cancel_meeting':
      return `Cancel meeting ID: ${args.meeting_id}`;
    case 'reschedule_meeting':
      return `Reschedule meeting to ${args.date} at ${args.start_hour}:${String(args.start_min || 0).padStart(2,'0')}`;
    default:
      return JSON.stringify(args, null, 2);
  }
}

export default function AiBrain() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const messagesEndRef = useRef(null);

  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [activeTab]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await axios.get(`${API}/ai/history`, { headers: getHeaders() });
      setHistory(res.data);
    } catch (err) { console.error(err); }
    setLoadingHistory(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);
    setPendingActions(null);

    try {
      const res = await axios.post(`${API}/ai/chat`, { message: userMessage }, { headers: getHeaders() });
      handleResponse(res.data);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Something went wrong. Please try again.' }]);
    }
    setLoading(false);
  };

  const handleResponse = (data) => {
    if (data.type === 'confirmation') {
      if (data.content) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
      }
      setPendingActions(data.pending_actions);
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
      setPendingActions(null);
    }
  };

  const confirmActions = async (confirmed) => {
    if (!confirmed) {
      setPendingActions(null);
      setMessages(prev => [...prev, { role: 'assistant', content: '↩️ Action cancelled.' }]);
      return;
    }

    setLoading(true);
    setPendingActions(null);
    try {
      const res = await axios.post(`${API}/ai/chat`, {
        message: null,
        pendingConfirmation: { confirmed: true, actions: pendingActions },
      }, { headers: getHeaders() });
      handleResponse(res.data);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Action failed. Please try again.' }]);
    }
    setLoading(false);
  };

  const clearChat = () => {
    setMessages([]);
    setPendingActions(null);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          width: 52, height: 52, borderRadius: '50%',
          background: isOpen ? '#3E423D' : '#8E9B8B',
          color: '#fff', border: 'none', cursor: 'pointer',
          fontSize: 22, boxShadow: '0 4px 20px rgba(62,66,61,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}
        title="AI Assistant"
      >
        {isOpen ? '✕' : '🧠'}
      </button>

      {/* Widget */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: 88, right: 24, zIndex: 9998,
          width: 380, height: 560,
          background: '#fff', borderRadius: 16,
          boxShadow: '0 8px 40px rgba(62,66,61,0.2)',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'Inter, sans-serif',
          border: '1px solid rgba(62,66,61,0.1)',
        }}>

          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(62,66,61,0.08)', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <p style={{ color: '#3E423D', fontSize: 14, fontWeight: 600, margin: 0 }}>🧠 AI Assistant</p>
                <p style={{ color: '#717182', fontSize: 11, margin: 0 }}>Planfor CRM Brain</p>
              </div>
              <button onClick={clearChat}
                style={{ background: 'none', border: 'none', color: '#CBCED4', fontSize: 11, cursor: 'pointer', padding: 0 }}>
                Clear
              </button>
            </div>
            <div style={{ display: 'flex', gap: 0, background: '#F5F3EF', borderRadius: 8, overflow: 'hidden' }}>
              {['chat', 'history'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1, background: activeTab === tab ? '#8E9B8B' : 'transparent',
                    color: activeTab === tab ? '#fff' : '#717182',
                    border: 'none', padding: '6px 12px', fontSize: 12,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    textTransform: 'capitalize', fontWeight: activeTab === tab ? 600 : 400,
                  }}>
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
                    <p style={{ color: '#3E423D', fontSize: 13, fontWeight: 500, margin: '0 0 4px' }}>Hi, I'm your CRM assistant</p>
                    <p style={{ color: '#717182', fontSize: 12, margin: '0 0 16px' }}>Ask me anything or tell me what to do</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[
                        'What does my pipeline look like?',
                        'Any stale leads this week?',
                        'Book a meeting with QualifAI tomorrow at 3pm',
                        'Add a note to Plan4 Advisory',
                      ].map(suggestion => (
                        <button key={suggestion} onClick={() => setInput(suggestion)}
                          style={{ background: '#F5F3EF', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#5A6059', cursor: 'pointer', textAlign: 'left' }}>
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '85%', padding: '10px 14px', borderRadius: 12,
                      background: msg.role === 'user' ? '#8E9B8B' : '#F5F3EF',
                      color: msg.role === 'user' ? '#fff' : '#3E423D',
                      fontSize: 13, lineHeight: 1.5,
                      borderBottomRightRadius: msg.role === 'user' ? 4 : 12,
                      borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 12,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))}

                {/* Pending confirmation card */}
                {pendingActions && (
                  <div style={{ background: '#FFF3CD', borderRadius: 12, padding: 16, border: '1px solid rgba(133,100,4,0.2)' }}>
                    <p style={{ color: '#856404', fontSize: 12, fontWeight: 600, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      ⚠️ Confirm Actions ({pendingActions.length})
                    </p>
                    {pendingActions.map((action, i) => (
                      <div key={i} style={{ background: '#fff', borderRadius: 8, padding: 12, marginBottom: 8, border: '1px solid rgba(133,100,4,0.15)' }}>
                        <p style={{ color: '#856404', fontSize: 11, fontWeight: 600, margin: '0 0 4px' }}>
                          {ACTION_LABELS[action.tool] || action.tool}
                        </p>
                        <p style={{ color: '#5A6059', fontSize: 11, margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                          {formatActionSummary(action)}
                        </p>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button onClick={() => confirmActions(true)}
                        style={{ flex: 1, background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                        ✓ Confirm
                      </button>
                      <button onClick={() => confirmActions(false)}
                        style={{ flex: 1, background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px', fontSize: 12, cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {loading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ background: '#F5F3EF', borderRadius: 12, borderBottomLeftRadius: 4, padding: '10px 14px', fontSize: 13, color: '#717182' }}>
                      🧠 Thinking...
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(62,66,61,0.08)', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Ask me anything..."
                    rows={2}
                    style={{
                      flex: 1, background: '#F5F3EF', border: 'none', borderRadius: 10,
                      padding: '10px 14px', fontSize: 13, resize: 'none', outline: 'none',
                      fontFamily: 'Inter, sans-serif', color: '#3E423D', lineHeight: 1.5,
                    }}
                  />
                  <button onClick={sendMessage} disabled={!input.trim() || loading}
                    style={{
                      background: input.trim() && !loading ? '#8E9B8B' : '#D5CEC0',
                      color: '#fff', border: 'none', borderRadius: 10,
                      width: 38, height: 38, cursor: input.trim() && !loading ? 'pointer' : 'default',
                      fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                    ↑
                  </button>
                </div>
                <p style={{ color: '#CBCED4', fontSize: 10, margin: '6px 0 0', textAlign: 'center' }}>
                  Enter to send · Shift+Enter for new line
                </p>
              </div>
            </>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {loadingHistory ? (
                <p style={{ color: '#717182', fontSize: 13, textAlign: 'center', padding: 20 }}>Loading...</p>
              ) : history.length === 0 ? (
                <p style={{ color: '#CBCED4', fontSize: 13, textAlign: 'center', padding: 20 }}>No conversations yet</p>
              ) : history.map(conv => (
                <div key={conv.id} style={{ background: '#F5F3EF', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <p style={{ color: '#3E423D', fontSize: 12, fontWeight: 500, margin: 0 }}>
                      {conv.crm_users?.name || 'You'}
                    </p>
                    <p style={{ color: '#CBCED4', fontSize: 10, margin: 0 }}>
                      {new Date(conv.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <p style={{ color: '#717182', fontSize: 12, margin: '0 0 6px', lineHeight: 1.4 }}>
                    {conv.last_message || '—'}
                  </p>
                  {conv.actions_taken?.length > 0 && (
                    <p style={{ color: '#8E9B8B', fontSize: 10, margin: 0 }}>
                      {conv.actions_taken.length} action{conv.actions_taken.length > 1 ? 's' : ''} taken
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}