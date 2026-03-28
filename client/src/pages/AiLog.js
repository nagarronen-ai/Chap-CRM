import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useRole } from '../hooks/useRole';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const ACTION_LABELS = {
  send_email: '📧 Send Email',
  book_meeting: '📅 Book Meeting',
  cancel_meeting: '❌ Cancel Meeting',
  reschedule_meeting: '📅 Reschedule Meeting',
  add_note: '📌 Add Note',
  update_pipeline_stage: '📊 Update Stage',
  update_client_stage: '📊 Update Client Stage',
  update_next_action: '🎯 Update Next Action',
};

export default function AiLog() {
  const navigate = useNavigate();
  const { role } = useRole();
  const isAdmin = role === 'admin';

  const [conversations, setConversations] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedConv, setSelectedConv] = useState(null);
  const [loading, setLoading] = useState(true);

  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  useEffect(() => {
    fetchConversations();
    if (isAdmin) fetchAgents();
  }, [isAdmin]);

  useEffect(() => {
    fetchConversations();
  }, [selectedAgent]);

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

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 240, flex: 1, padding: 40 }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>AI Assistant</p>
          <h1 style={{ color: '#3E423D', fontSize: 28, fontWeight: 600, fontStyle: 'italic', fontFamily: "'Playfair Display', Georgia, serif", margin: 0 }}>
            Conversation Log
          </h1>
        </div>

        {/* Admin filter */}
        {isAdmin && agents.length > 0 && (
          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ color: '#717182', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Filter by Agent</label>
            <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}
              style={{ background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#3E423D', outline: 'none' }}>
              <option value="">All Agents</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
              ))}
            </select>
            <span style={{ color: '#717182', fontSize: 12 }}>{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: selectedConv ? '1fr 1.5fr' : '1fr', gap: 20 }}>

          {/* Conversation list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loading ? (
              <p style={{ color: '#717182', fontSize: 13 }}>Loading...</p>
            ) : conversations.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 12, padding: 60, textAlign: 'center', border: '1px solid rgba(62,66,61,0.1)' }}>
                <p style={{ fontSize: 40, margin: '0 0 12px' }}>🧠</p>
                <p style={{ color: '#3E423D', fontSize: 15, fontWeight: 500, margin: '0 0 6px' }}>No conversations yet</p>
                <p style={{ color: '#717182', fontSize: 13, margin: 0 }}>Start chatting with the AI Assistant</p>
              </div>
            ) : conversations.map(conv => (
              <div key={conv.id}
                onClick={() => fetchConversationDetail(conv.id)}
                style={{
                  background: selectedConv?.id === conv.id ? '#F0F4F0' : '#fff',
                  borderRadius: 12, padding: 16,
                  border: selectedConv?.id === conv.id ? '1px solid #8E9B8B' : '1px solid rgba(62,66,61,0.1)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ display: 'flex', align: 'center', gap: 8 }}>
                    <span style={{ background: '#E5E1D8', color: '#5A6059', fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
                      {conv.crm_users?.name || 'You'}
                    </span>
                    {conv.actions_taken?.length > 0 && (
                      <span style={{ background: '#D4EDDA', color: '#155724', fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
                        {conv.actions_taken.length} action{conv.actions_taken.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#CBCED4', fontSize: 11 }}>
                      {new Date(conv.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button onClick={e => { e.stopPropagation(); deleteConversation(conv.id); }}
                      style={{ background: 'none', border: 'none', color: '#CBCED4', fontSize: 12, cursor: 'pointer', padding: 0 }}>
                      ✕
                    </button>
                  </div>
                </div>
                <p style={{ color: '#3E423D', fontSize: 13, margin: 0, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {conv.last_message || '—'}
                </p>
              </div>
            ))}
          </div>

          {/* Conversation detail */}
          {selectedConv && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(62,66,61,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ color: '#3E423D', fontSize: 14, fontWeight: 600, margin: 0 }}>Conversation Detail</p>
                  <p style={{ color: '#717182', fontSize: 11, margin: 0 }}>
                    {new Date(selectedConv.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <button onClick={() => setSelectedConv(null)}
                  style={{ background: 'none', border: 'none', color: '#717182', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>

              {/* Actions taken summary */}
              {selectedConv.actions_taken?.length > 0 && (
                <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(62,66,61,0.08)', background: '#F5F3EF' }}>
                  <p style={{ color: '#717182', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px', fontWeight: 600 }}>Actions Taken</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
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

              {/* Messages */}
              <div style={{ padding: 20, overflowY: 'auto', maxHeight: 500, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(selectedConv.messages || [])
                  .filter(m => m.role === 'user' || m.role === 'assistant')
                  .map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '80%', padding: '10px 14px', borderRadius: 12,
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}