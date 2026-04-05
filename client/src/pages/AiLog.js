import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useRole } from '../hooks/useRole';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const ACTION_LABELS = {
  send_email: '📧 Send Email',
  send_bulk_email: '📧 Bulk Email',
  book_meeting: '📅 Book Meeting',
  cancel_meeting: '❌ Cancel Meeting',
  reschedule_meeting: '📅 Reschedule',
  propose_meeting: '📩 Propose Meeting',
  add_note: '📌 Add Note',
  update_pipeline_stage: '📊 Update Stage',
  update_client_stage: '📊 Client Stage',
  update_next_action: '🎯 Next Action',
};

function groupByDay(conversations) {
  const groups = {};
  conversations.forEach(conv => {
    const d = new Date(conv.updated_at);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    let label;
    if (d.toDateString() === today.toDateString()) label = 'Today';
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
    else label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    if (!groups[label]) groups[label] = [];
    groups[label].push(conv);
  });
  return groups;
}

export default function AiLog() {
  const { role } = useRole();
  const isAdmin = role === 'admin';

  const [conversations, setConversations] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedConv, setSelectedConv] = useState(null);
  const [loading, setLoading] = useState(true);

  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  useEffect(() => { fetchConversations(); if (isAdmin) fetchAgents(); }, [isAdmin]);
  useEffect(() => { fetchConversations(); }, [selectedAgent]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const params = selectedAgent ? `?agent_id=${selectedAgent}` : '';
      const res = await axios.get(`${API}/ai/history${params}`, { headers: getHeaders() });
      setConversations(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchAgents = async () => {
    try {
      const res = await axios.get(`${API}/ai/agents`, { headers: getHeaders() });
      setAgents(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchConversationDetail = async (convId) => {
    try {
      const res = await axios.get(`${API}/ai/history/${convId}`, { headers: getHeaders() });
      setSelectedConv(res.data);
    } catch (err) { console.error(err); }
  };

  const deleteConversation = async (convId) => {
    if (!window.confirm('Delete this conversation?')) return;
    try {
      await axios.delete(`${API}/ai/history/${convId}`, { headers: getHeaders() });
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (selectedConv?.id === convId) setSelectedConv(null);
    } catch (err) { console.error(err); }
  };

  const grouped = groupByDay(conversations);

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />

      {/* Main content — fixed height, no outer scroll */}
      <div style={{ marginLeft: 240, flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '32px 40px 20px', flexShrink: 0 }}>
          <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>AI Assistant</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ color: '#3E423D', fontSize: 28, fontWeight: 600, fontStyle: 'italic', fontFamily: "'Playfair Display', Georgia, serif", margin: 0 }}>
              Conversation Log
            </h1>
            {isAdmin && agents.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ color: '#717182', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Filter by Agent</label>
                <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}
                  style={{ background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '7px 12px', fontSize: 13, color: '#3E423D', outline: 'none' }}>
                  <option value="">All Agents</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.email})</option>)}
                </select>
                <span style={{ color: '#717182', fontSize: 12 }}>{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>

        {/* Split panel */}
        <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden', padding: '0 40px 32px' }}>

          {/* Left — conversation list */}
          <div style={{
            width: 300, flexShrink: 0, overflowY: 'auto',
            background: '#fff', borderRadius: '12px 0 0 12px',
            border: '1px solid rgba(62,66,61,0.1)',
            borderRight: 'none',
          }}>
            {loading ? (
              <p style={{ color: '#717182', fontSize: 13, padding: 20 }}>Loading...</p>
            ) : conversations.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>🧠</p>
                <p style={{ color: '#3E423D', fontSize: 14, fontWeight: 500, margin: '0 0 4px' }}>No conversations yet</p>
                <p style={{ color: '#717182', fontSize: 12, margin: 0 }}>Start chatting with Chappie</p>
              </div>
            ) : (
              Object.entries(grouped).map(([label, convs]) => (
                <div key={label}>
                  {/* Day header */}
                  <div style={{ padding: '10px 16px 6px', position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderBottom: '1px solid rgba(62,66,61,0.06)' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#AAAABC', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
                  </div>

                  {/* Conversations for this day */}
                  {convs.map(conv => (
                    <div key={conv.id}
                      onClick={() => fetchConversationDetail(conv.id)}
                      style={{
                        padding: '12px 16px',
                        background: selectedConv?.id === conv.id ? '#F0F4F0' : 'transparent',
                        borderLeft: selectedConv?.id === conv.id ? '3px solid #8E9B8B' : '3px solid transparent',
                        cursor: 'pointer',
                        borderBottom: '1px solid rgba(62,66,61,0.05)',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (selectedConv?.id !== conv.id) e.currentTarget.style.background = '#FAFAF9'; }}
                      onMouseLeave={e => { if (selectedConv?.id !== conv.id) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isAdmin && (
                            <span style={{ background: '#8E9B8B', color: '#fff', fontSize: 9, borderRadius: 10, padding: '1px 6px', fontWeight: 600 }}>
                              {conv.crm_users?.name?.split(' ')[0] || 'User'}
                            </span>
                          )}
                          {conv.actions_taken?.length > 0 && (
                            <span style={{ background: '#D4EDDA', color: '#155724', fontSize: 9, borderRadius: 10, padding: '1px 6px', fontWeight: 600 }}>
                              {conv.actions_taken.length} actions
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: '#CBCED4', fontSize: 10 }}>
                            {new Date(conv.updated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </span>
                          <button onClick={e => { e.stopPropagation(); deleteConversation(conv.id); }}
                            style={{ background: 'none', border: 'none', color: '#CBCED4', fontSize: 11, cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
                        </div>
                      </div>
                      <p style={{ color: '#3E423D', fontSize: 12, margin: 0, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.last_message || '—'}
                      </p>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Right — conversation detail */}
          <div style={{
            flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column',
            background: '#fff',
            borderRadius: '0 12px 12px 0',
            border: '1px solid rgba(62,66,61,0.1)',
          }}>
            {!selectedConv ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 32 }}>💬</p>
                <p style={{ color: '#3E423D', fontSize: 14, fontWeight: 500, margin: 0 }}>Select a conversation</p>
                <p style={{ color: '#717182', fontSize: 12, margin: 0 }}>Click any conversation on the left to view details</p>
              </div>
            ) : (
              <>
                {/* Detail header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(62,66,61,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <div>
                    <p style={{ color: '#3E423D', fontSize: 14, fontWeight: 600, margin: 0 }}>Conversation Detail</p>
                    <p style={{ color: '#717182', fontSize: 11, margin: 0 }}>
                      {new Date(selectedConv.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <button onClick={() => setSelectedConv(null)}
                    style={{ background: 'none', border: 'none', color: '#717182', fontSize: 18, cursor: 'pointer' }}>✕</button>
                </div>

                {/* Actions taken */}
                {selectedConv.actions_taken?.length > 0 && (
                  <div style={{ padding: '10px 20px', borderBottom: '1px solid rgba(62,66,61,0.08)', background: '#F5F3EF', flexShrink: 0 }}>
                    <p style={{ color: '#717182', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 6px', fontWeight: 600 }}>Actions Taken</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {selectedConv.actions_taken.map((action, i) => (
                        <span key={i} style={{
                          background: action.status === 'confirmed_executed' ? '#D4EDDA' : '#E5E1D8',
                          color: action.status === 'confirmed_executed' ? '#155724' : '#5A6059',
                          fontSize: 11, borderRadius: 20, padding: '3px 10px', fontWeight: 500,
                        }}>
                          {ACTION_LABELS[action.tool] || action.tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages — scrollable */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(selectedConv.messages || [])
                    .filter(m => m.role === 'user' || m.role === 'assistant')
                    .map((msg, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                          maxWidth: '75%', padding: '10px 14px', borderRadius: 12,
                          background: msg.role === 'user' ? '#8E9B8B' : '#F5F3EF',
                          color: msg.role === 'user' ? '#fff' : '#3E423D',
                          fontSize: 13, lineHeight: 1.5,
                          borderBottomRightRadius: msg.role === 'user' ? 4 : 12,
                          borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 12,
                          whiteSpace: 'pre-wrap',
                        }}>
                          <span>{msg.content}</span>
                        {msg.timestamp && (
                          <div style={{ fontSize: 10, color: msg.role === 'user' ? 'rgba(255,255,255,0.6)' : '#AAAABC', marginTop: 4, textAlign: 'right' }}>
                            {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </div>
                        )}
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}