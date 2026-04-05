import { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import axios from 'axios';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

export default function Thoughts() {
  const [thoughts, setThoughts] = useState([]);
  const [selectedThought, setSelectedThought] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newThought, setNewThought] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-20250514');
  const [creating, setCreating] = useState(false);
  const chatEndRef = useRef(null);

  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  useEffect(() => { fetchThoughts(); }, []);

  useEffect(() => {
    if (selectedThought) {
      fetchChat(selectedThought.id);
      setEditingContent(selectedThought.content);
    }
  }, [selectedThought]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchThoughts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/thoughts`, { headers: getHeaders() });
      setThoughts(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchChat = async (thoughtId) => {
    try {
      const res = await axios.get(`${API}/thoughts/${thoughtId}/chat`, { headers: getHeaders() });
      setChatMessages(res.data.messages || []);
    } catch (err) { console.error(err); }
  };

  const createThought = async () => {
    if (!newThought.trim()) return;
    setCreating(true);
    try {
      const res = await axios.post(`${API}/thoughts`, { content: newThought }, { headers: getHeaders() });
      setThoughts(prev => [res.data, ...prev]);
      setNewThought('');
      setSelectedThought(res.data);
      setChatMessages([]);
    } catch (err) { console.error(err); }
    setCreating(false);
  };

  const updateThought = async () => {
    if (!selectedThought || editingContent === selectedThought.content) return;
    try {
      const res = await axios.put(`${API}/thoughts/${selectedThought.id}`, { content: editingContent }, { headers: getHeaders() });
      setThoughts(prev => prev.map(t => t.id === res.data.id ? res.data : t));
      setSelectedThought(res.data);
    } catch (err) { console.error(err); }
  };

  const deleteThought = async (id) => {
    if (!window.confirm('Delete this thought?')) return;
    try {
      await axios.delete(`${API}/thoughts/${id}`, { headers: getHeaders() });
      setThoughts(prev => prev.filter(t => t.id !== id));
      if (selectedThought?.id === id) { setSelectedThought(null); setChatMessages([]); }
    } catch (err) { console.error(err); }
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !selectedThought || chatLoading) return;
    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);
    try {
        const res = await axios.post(`${API}/thoughts/${selectedThought.id}/chat`, { message: userMessage, model: selectedModel }, { headers: getHeaders() });
      setChatMessages(res.data.messages);
    } catch (err) { console.error(err); }
    setChatLoading(false);
  };

  const groupByDate = (thoughts) => {
    const groups = {};
    thoughts.forEach(t => {
      const d = new Date(t.created_at);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      let label;
      if (d.toDateString() === today.toDateString()) label = 'Today';
      else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
      else label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      if (!groups[label]) groups[label] = [];
      groups[label].push(t);
    });
    return groups;
  };

  const grouped = groupByDate(thoughts);

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ marginLeft: 240, flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '32px 40px 20px', flexShrink: 0 }}>
          <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>Personal</p>
          <h1 style={{ color: '#3E423D', fontSize: 28, fontWeight: 600, fontStyle: 'italic', fontFamily: "'Playfair Display', Georgia, serif", margin: '0 0 16px' }}>
            My Thoughts
          </h1>

          {/* New thought input */}
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea
              value={newThought}
              onChange={e => setNewThought(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); createThought(); } }}
              placeholder="Capture a thought... (Enter to save)"
              rows={2}
              style={{
                flex: 1, background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 10,
                padding: '12px 16px', fontSize: 13, color: '#3E423D', outline: 'none', resize: 'none',
                fontFamily: 'Inter, sans-serif', lineHeight: 1.5,
              }}
            />
            <button onClick={createThought} disabled={creating || !newThought.trim()}
              style={{ background: newThought.trim() ? '#8E9B8B' : '#D5CEC0', color: '#fff', border: 'none', borderRadius: 10, padding: '0 20px', fontSize: 13, cursor: newThought.trim() ? 'pointer' : 'not-allowed', flexShrink: 0 }}>
              {creating ? '...' : '+ Add'}
            </button>
          </div>
        </div>

        {/* Split panel */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '0 40px 32px', gap: 0 }}>

          {/* Left — thoughts list */}
          <div style={{ width: 280, flexShrink: 0, overflowY: 'auto', background: '#fff', borderRadius: '12px 0 0 12px', border: '1px solid rgba(62,66,61,0.1)', borderRight: 'none' }}>
            {loading ? (
              <p style={{ color: '#717182', fontSize: 13, padding: 20 }}>Loading...</p>
            ) : thoughts.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>💭</p>
                <p style={{ color: '#3E423D', fontSize: 14, fontWeight: 500, margin: '0 0 4px' }}>No thoughts yet</p>
                <p style={{ color: '#717182', fontSize: 12, margin: 0 }}>Capture your first idea above</p>
              </div>
            ) : Object.entries(grouped).map(([label, convs]) => (
              <div key={label}>
                <div style={{ padding: '10px 16px 6px', position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderBottom: '1px solid rgba(62,66,61,0.06)' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#AAAABC', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
                </div>
                {convs.map(t => (
                  <div key={t.id}
                    onClick={() => { setSelectedThought(t); setChatMessages([]); }}
                    style={{
                      padding: '12px 16px', cursor: 'pointer',
                      background: selectedThought?.id === t.id ? '#F0F4F0' : 'transparent',
                      borderLeft: selectedThought?.id === t.id ? '3px solid #8E9B8B' : '3px solid transparent',
                      borderBottom: '1px solid rgba(62,66,61,0.05)',
                    }}
                    onMouseEnter={e => { if (selectedThought?.id !== t.id) e.currentTarget.style.background = '#FAFAF9'; }}
                    onMouseLeave={e => { if (selectedThought?.id !== t.id) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <p style={{ color: '#3E423D', fontSize: 12, margin: 0, lineHeight: 1.5, flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {t.content}
                      </p>
                      <button onClick={e => { e.stopPropagation(); deleteThought(t.id); }}
                        style={{ background: 'none', border: 'none', color: '#CBCED4', fontSize: 11, cursor: 'pointer', padding: '0 0 0 6px', flexShrink: 0 }}>✕</button>
                    </div>
                    <p style={{ color: '#CBCED4', fontSize: 10, margin: '4px 0 0' }}>
                      {new Date(t.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Right — thought detail + chat */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '0 12px 12px 0', border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden' }}>
            {!selectedThought ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 32 }}>💭</p>
                <p style={{ color: '#3E423D', fontSize: 14, fontWeight: 500, margin: 0 }}>Select a thought</p>
                <p style={{ color: '#717182', fontSize: 12, margin: 0 }}>Or capture a new one above</p>
              </div>
            ) : (
              <>
                {/* Thought content — editable */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(62,66,61,0.08)', flexShrink: 0 }}>
                  <p style={{ color: '#717182', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>
                    {new Date(selectedThought.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                  <textarea
                    value={editingContent}
                    onChange={e => setEditingContent(e.target.value)}
                    onBlur={updateThought}
                    rows={3}
                    style={{
                      width: '100%', background: 'transparent', border: 'none', outline: 'none',
                      fontSize: 15, color: '#3E423D', fontFamily: 'Inter, sans-serif',
                      lineHeight: 1.6, resize: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Chat header */}
                <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(62,66,61,0.06)', flexShrink: 0, background: '#FAFAF9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ color: '#717182', fontSize: 11, margin: 0 }}>
                    💬 Brainstorm with Claude — ask anything about this idea
                  </p>
                  <select
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value)}
                    style={{ background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#3E423D', outline: 'none', cursor: 'pointer' }}>
                    <option value="claude-haiku-4-5-20251001">Haiku — Quick & Cheap</option>
                    <option value="claude-sonnet-4-20250514">Sonnet 4 — Balanced</option>
                    <option value="claude-opus-4-20250514">Opus 4 — Deep Thinking</option>
                  </select>
                </div>

                {/* Chat messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {chatMessages.length === 0 ? (
                    <div style={{ textAlign: 'center', marginTop: 40 }}>
                      <p style={{ color: '#AAAABC', fontSize: 13 }}>Start a conversation about this thought</p>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
                        {[
                          'What are the risks?',
                          'Help me build an action plan',
                          'What are the opportunities?',
                          'Play devil\'s advocate',
                        ].map(prompt => (
                          <button key={prompt} onClick={() => { setChatInput(prompt); }}
                            style={{ background: '#F5F3EF', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 20, padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: '#5A6059' }}>
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : chatMessages.filter(m => m.role === 'user' || m.role === 'assistant').map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '75%', padding: '10px 14px', borderRadius: 12,
                        background: msg.role === 'user' ? '#8E9B8B' : '#F5F3EF',
                        color: msg.role === 'user' ? '#fff' : '#3E423D',
                        fontSize: 13, lineHeight: 1.6,
                        borderBottomRightRadius: msg.role === 'user' ? 4 : 12,
                        borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 12,
                        whiteSpace: 'pre-wrap',
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <div style={{ background: '#F5F3EF', borderRadius: 12, padding: '10px 16px', fontSize: 13, color: '#717182' }}>
                        Claude is thinking...
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat input */}
                <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(62,66,61,0.08)', flexShrink: 0, display: 'flex', gap: 8 }}>
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') sendChat(); }}
                    placeholder="Ask Claude about this idea..."
                    style={{
                      flex: 1, background: '#F5F3EF', border: '1px solid rgba(62,66,61,0.1)',
                      borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#3E423D',
                      outline: 'none', fontFamily: 'Inter, sans-serif',
                    }}
                  />
                  <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                    style={{ background: chatInput.trim() ? '#8E9B8B' : '#D5CEC0', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, cursor: chatInput.trim() ? 'pointer' : 'not-allowed' }}>
                    Send
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}