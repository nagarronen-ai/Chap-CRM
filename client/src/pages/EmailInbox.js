// client/src/pages/EmailInbox.js
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

export default function EmailInbox() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [selectedThreads, setSelectedThreads] = useState(new Set());
  const [markingRead, setMarkingRead] = useState(false);
  const navigate = useNavigate();

  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  useEffect(() => { fetchInbox(); }, [filter, search]);

  const fetchInbox = async () => {
    try {
      let url = `${API}/sync/inbox?`;
      if (filter && filter !== 'all') url += `filter=${filter}&`;
      if (search) url += `search=${encodeURIComponent(search)}&`;
      const res = await axios.get(url, { headers: getHeaders() });
      setEmails(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const triggerSync = async () => {
    setSyncing(true);
    try {
      await axios.post(`${API}/sync/gmail`, {}, { headers: getHeaders() });
      setTimeout(() => { fetchInbox(); setSyncing(false); }, 5000);
    } catch (err) { console.error(err); setSyncing(false); }
  };

  const markAsRead = async (emailId) => {
    try {
      await axios.put(`${API}/sync/emails/${emailId}/read`, {}, { headers: getHeaders() });
      setEmails(prev => prev.map(e => e.id === emailId ? { ...e, is_read: true } : e));
    } catch (err) { console.error(err); }
  };

  // ── Compute threads FIRST so markBulkAsRead can use it ──────────────────────
  const unreadCount = emails.filter(e => !e.is_read && e.direction === 'inbound').length;

  const threadMap = {};
  emails.forEach(e => {
    const threadId = e.gmail_thread_id || e.id;
    if (!threadMap[threadId]) {
      threadMap[threadId] = {
        threadId,
        emails: [],
        latestDate: e.email_date,
        subject: e.subject,
        company_name: e.crm_companies?.company_name || e.crm_clients?.business_name || '',
        company_id: e.company_id,
        client_id: e.client_id,
        person_name: e.crm_people ? `${e.crm_people.first_name} ${e.crm_people.last_name}` : '',
        hasUnread: false,
      };
    }
    threadMap[threadId].emails.push(e);
    if (!e.is_read && e.direction === 'inbound') threadMap[threadId].hasUnread = true;
    if (new Date(e.email_date) > new Date(threadMap[threadId].latestDate)) {
      threadMap[threadId].latestDate = e.email_date;
    }
  });

  const threads = Object.values(threadMap).sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate));

  // ── Now markBulkAsRead can safely reference threads ──────────────────────────
  const markBulkAsRead = async () => {
    if (selectedThreads.size === 0) return;
    setMarkingRead(true);
    try {
      const emailIds = threads
        .filter(t => selectedThreads.has(t.threadId))
        .flatMap(t => t.emails.map(e => e.id));

      await axios.put(`${API}/sync/emails/bulk-read`, { email_ids: emailIds }, { headers: getHeaders() });

      setEmails(prev => prev.map(e =>
        emailIds.includes(e.id) ? { ...e, is_read: true } : e
      ));
      setSelectedThreads(new Set());
    } catch (err) { console.error(err); }
    setMarkingRead(false);
  };

  const toggleThreadSelect = (e, threadId) => {
    e.stopPropagation();
    setSelectedThreads(prev => {
      const next = new Set(prev);
      next.has(threadId) ? next.delete(threadId) : next.add(threadId);
      return next;
    });
  };

  const toggleExpand = (email) => {
    if (expandedId === email.id) {
      setExpandedId(null);
    } else {
      setExpandedId(email.id);
      if (!email.is_read) markAsRead(email.id);
    }
  };

  const goToProfile = (email) => {
    if (email.client_id) navigate(`/clients/${email.client_id}`);
    else if (email.company_id) navigate(`/companies/${email.company_id}`);
  };

  const sendReply = async (thread) => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      const latestInbound = thread.emails.find(e => e.direction === 'inbound') || thread.emails[0];
      const replyTo = latestInbound.from_email;
      const replyName = latestInbound.from_name || replyTo;
      const subject = latestInbound.subject?.startsWith('Re:') ? latestInbound.subject : `Re: ${latestInbound.subject}`;

      await axios.post(`${API}/emails/send`, {
        company_id: latestInbound.company_id || null,
        person_id: latestInbound.person_id || null,
        subject,
        body_html: `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #222; line-height: 1.6;">${replyText.replace(/\n/g, '<br>')}</div>
        <br>
        <div style="padding-left: 12px; border-left: 2px solid #ccc; margin-top: 16px; color: #666; font-size: 13px;">
          <p style="margin: 0 0 8px; color: #999; font-size: 12px;">On ${new Date(latestInbound.email_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}, ${latestInbound.from_name || latestInbound.from_email} wrote:</p>
          ${latestInbound.body_html || latestInbound.body_snippet || ''}
        </div>`,
        recipient_email: replyTo,
        recipient_name: replyName,
        gmail_thread_id: thread.threadId || null,
        in_reply_to: latestInbound.gmail_message_id || null,
      }, { headers: getHeaders() });

      const now = new Date().toISOString();
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setEmails(prev => [...prev, {
        id: `sent-${Date.now()}`,
        gmail_thread_id: thread.threadId,
        direction: 'outbound',
        from_email: user.email || '',
        from_name: user.name || '',
        to_emails: [{ email: replyTo }],
        subject,
        body_snippet: replyText.substring(0, 100),
        body_html: `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #222; line-height: 1.6;">${replyText.replace(/\n/g, '<br>')}</div>`,
        email_date: now,
        is_read: true,
        has_attachments: false,
        attachment_count: 0,
        company_id: latestInbound.company_id,
        client_id: latestInbound.client_id,
        person_id: latestInbound.person_id,
        crm_companies: latestInbound.crm_companies,
        crm_clients: latestInbound.crm_clients,
        crm_people: latestInbound.crm_people,
      }]);
      setReplyingTo(null);
      setReplyText('');
    } catch (err) {
      console.error(err);
      alert('Reply failed: ' + (err.response?.data?.error || err.message));
    }
    setSendingReply(false);
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 60000);
    if (diff < 1) return 'Now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    if (diff < 10080) return `${Math.floor(diff / 1440)}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
    { key: 'inbound', label: 'Received' },
    { key: 'outbound', label: 'Sent' },
  ];

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: '32px 40px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>Communication</p>
            <h1 style={{ color: '#3E423D', fontSize: 28, fontWeight: 600, fontStyle: 'italic', fontFamily: "'Playfair Display', Georgia, serif", margin: 0 }}>
              Email Inbox
              {unreadCount > 0 && (
                <span style={{ background: '#D4183D', color: '#fff', fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '2px 10px', marginLeft: 12, fontFamily: 'Inter, sans-serif', fontStyle: 'normal', verticalAlign: 'middle' }}>
                  {unreadCount}
                </span>
              )}
            </h1>
          </div>
          <button onClick={triggerSync} disabled={syncing}
            style={{ background: '#fff', color: '#3E423D', border: '1px solid rgba(62,66,61,0.15)', borderRadius: 8, padding: '10px 18px', fontSize: 13, cursor: syncing ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 8 }}>
            {syncing ? '⏳ Syncing...' : '🔄 Sync Now'}
          </button>
        </div>

        {/* Filters + Search */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 0, background: '#fff', borderRadius: 8, border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden' }}>
            {filters.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                style={{
                  background: filter === f.key ? '#3E423D' : '#fff',
                  color: filter === f.key ? '#fff' : '#717182',
                  border: 'none', padding: '8px 16px', fontSize: 12, fontWeight: filter === f.key ? 600 : 400,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  borderRight: '1px solid rgba(62,66,61,0.08)',
                }}>
                {f.label}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, subject, or email..."
            style={{
              flex: 1, background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8,
              padding: '8px 14px', color: '#3E423D', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif',
            }}
          />
        </div>

        {/* Bulk action bar */}
        {selectedThreads.size > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: '#3E423D', borderRadius: 8, padding: '10px 16px', marginBottom: 12,
          }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>
              {selectedThreads.size} thread{selectedThreads.size > 1 ? 's' : ''} selected
            </span>
            <button onClick={markBulkAsRead} disabled={markingRead}
              style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
              {markingRead ? 'Marking...' : '✓ Mark as Read'}
            </button>
            <button onClick={() => setSelectedThreads(new Set())}
              style={{ background: 'transparent', color: '#CBCED4', border: 'none', fontSize: 12, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        )}

        {/* Email List */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#717182' }}>Loading...</div>
        ) : threads.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 12, padding: 60, textAlign: 'center', border: '1px solid rgba(62,66,61,0.1)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <p style={{ color: '#3E423D', fontSize: 16, fontWeight: 500, margin: '0 0 8px' }}>No emails yet</p>
            <p style={{ color: '#717182', fontSize: 13, margin: 0 }}>
              {filter === 'unread' ? 'All caught up — no unread emails from CRM contacts.' : 'Emails from CRM contacts will appear here once Gmail sync runs.'}
            </p>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden' }}>
            {threads.map((thread, idx) => {
              const latestEmail = thread.emails[0];
              const isExpanded = expandedId === latestEmail.id;
              const isSelected = selectedThreads.has(thread.threadId);

              return (
                <div key={thread.threadId} style={{ borderBottom: idx < threads.length - 1 ? '1px solid rgba(62,66,61,0.06)' : 'none' }}>
                  {/* Thread Row */}
                  <div
                    onClick={() => toggleExpand(latestEmail)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                      cursor: 'pointer',
                      background: isSelected ? '#F0F4F0' : isExpanded ? '#FAFAF9' : thread.hasUnread ? '#F8F9FF' : '#fff',
                      transition: 'background 0.1s',
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      onClick={e => toggleThreadSelect(e, thread.threadId)}
                      style={{ width: 20, flexShrink: 0, cursor: 'pointer' }}
                    >
                      {isSelected ? (
                        <div style={{
                          width: 18, height: 18, borderRadius: 4,
                          background: '#8E9B8B', border: '2px solid #8E9B8B',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{ color: '#fff', fontSize: 11, lineHeight: 1 }}>✓</span>
                        </div>
                      ) : (
                        <div style={{
                          width: 18, height: 18, borderRadius: 4,
                          border: `2px solid ${thread.hasUnread ? '#1a6fad' : 'rgba(62,66,61,0.2)'}`,
                          background: thread.hasUnread ? '#EBF4FF' : '#fff',
                        }} />
                      )}
                    </div>

                    {/* Direction icon */}
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: latestEmail.direction === 'inbound' ? '#EBF4FF' : '#E8F5E9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
                    }}>
                      {latestEmail.direction === 'inbound' ? '📥' : '📤'}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{
                          color: '#3E423D', fontSize: 13,
                          fontWeight: thread.hasUnread ? 700 : 500,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {latestEmail.from_name || latestEmail.from_email}
                        </span>
                        {thread.emails.length > 1 && (
                          <span style={{ color: '#717182', fontSize: 11, background: '#F5F3EF', borderRadius: 10, padding: '1px 7px', flexShrink: 0 }}>
                            {thread.emails.length}
                          </span>
                        )}
                      </div>
                      <p style={{
                        color: thread.hasUnread ? '#3E423D' : '#5A6059', fontSize: 13,
                        fontWeight: thread.hasUnread ? 600 : 400,
                        margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {latestEmail.subject || '(no subject)'}
                      </p>
                      <p style={{ color: '#717182', fontSize: 12, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {latestEmail.body_snippet?.substring(0, 100)}
                      </p>
                    </div>

                    {/* Right side: company + time */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      {thread.company_name && (
                        <button
                          onClick={(e) => { e.stopPropagation(); goToProfile(latestEmail); }}
                          style={{
                            background: '#F5F3EF', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 6,
                            padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#5A6059',
                            fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          {latestEmail.client_id ? '🤝' : '🏢'} {thread.company_name}
                        </button>
                      )}
                      <span style={{ color: '#CBCED4', fontSize: 11, whiteSpace: 'nowrap', minWidth: 60, textAlign: 'right' }}>
                        {formatTime(thread.latestDate)}
                      </span>
                      <span style={{ color: '#CBCED4', fontSize: 12 }}>
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Email View */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid rgba(62,66,61,0.08)', background: '#FAFAF9' }}>
                      {thread.emails
                        .sort((a, b) => new Date(a.email_date) - new Date(b.email_date))
                        .map((email, emailIdx) => (
                        <div key={email.id} style={{
                          padding: '16px 20px 16px 62px',
                          borderBottom: emailIdx < thread.emails.length - 1 ? '1px solid rgba(62,66,61,0.06)' : 'none',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: '50%',
                                background: email.direction === 'inbound' ? '#EBF4FF' : '#E8F5E9',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                              }}>
                                {email.direction === 'inbound' ? '📥' : '📤'}
                              </div>
                              <div>
                                <span style={{ color: '#3E423D', fontSize: 13, fontWeight: 500 }}>
                                  {email.from_name || email.from_email}
                                </span>
                                <span style={{ color: '#717182', fontSize: 11, marginLeft: 6 }}>
                                  &lt;{email.from_email}&gt;
                                </span>
                              </div>
                              <span style={{
                                background: email.direction === 'inbound' ? '#EBF4FF' : '#E8F5E9',
                                color: email.direction === 'inbound' ? '#1a6fad' : '#2E7D32',
                                fontSize: 10, borderRadius: 20, padding: '1px 8px',
                              }}>
                                {email.direction === 'inbound' ? 'Received' : 'Sent'}
                              </span>
                              {email.has_attachments && (
                                <span style={{ color: '#717182', fontSize: 11 }}>📎 {email.attachment_count}</span>
                              )}
                            </div>
                            <span style={{ color: '#CBCED4', fontSize: 11 }}>
                              {new Date(email.email_date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div style={{
                            background: '#fff', borderRadius: 8, padding: 16,
                            border: '1px solid rgba(62,66,61,0.08)', fontSize: 14, lineHeight: 1.6,
                          }}
                            dangerouslySetInnerHTML={{ __html: email.body_html || email.body_snippet }}
                          />
                        </div>
                      ))}

                      {/* Quick action bar */}
                      <div style={{ borderTop: '1px solid rgba(62,66,61,0.08)', background: '#F5F3EF' }}>
                        <div style={{ padding: '12px 20px 12px 62px', display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button
                            onClick={() => goToProfile(latestEmail)}
                            style={{
                              background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8,
                              padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                              display: 'flex', alignItems: 'center', gap: 6,
                            }}
                          >
                            {latestEmail.client_id ? '🤝 View Client' : '🏢 View Contact'} → {thread.company_name}
                          </button>
                          <button
                            onClick={() => { setReplyingTo(replyingTo === thread.threadId ? null : thread.threadId); setReplyText(''); }}
                            style={{
                              background: replyingTo === thread.threadId ? '#3E423D' : '#fff',
                              color: replyingTo === thread.threadId ? '#fff' : '#3E423D',
                              border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8,
                              padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                              display: 'flex', alignItems: 'center', gap: 6,
                            }}
                          >
                            ↩ Reply
                          </button>
                          {thread.person_name && (
                            <span style={{ color: '#717182', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                              👤 {thread.person_name}
                            </span>
                          )}
                        </div>

                        {/* Reply composer */}
                        {replyingTo === thread.threadId && (
                          <div style={{ padding: '0 20px 16px 62px' }}>
                            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden' }}>
                              <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(62,66,61,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ color: '#717182', fontSize: 12 }}>To:</span>
                                <span style={{ color: '#3E423D', fontSize: 12, fontWeight: 500 }}>
                                  {(() => {
                                    const inbound = thread.emails.find(e => e.direction === 'inbound');
                                    return inbound ? `${inbound.from_name || ''} <${inbound.from_email}>` : thread.person_name || '—';
                                  })()}
                                </span>
                              </div>
                              <textarea
                                value={replyText}
                                onChange={e => setReplyText(e.target.value)}
                                placeholder="Type your reply..."
                                rows={4}
                                autoFocus
                                style={{
                                  width: '100%', border: 'none', padding: '12px 14px', fontSize: 13,
                                  resize: 'vertical', outline: 'none', fontFamily: 'Inter, sans-serif',
                                  lineHeight: 1.6, boxSizing: 'border-box', minHeight: 100,
                                }}
                              />
                              <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(62,66,61,0.06)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button
                                  onClick={() => { setReplyingTo(null); setReplyText(''); }}
                                  style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}>
                                  Cancel
                                </button>
                                <button
                                  onClick={() => sendReply(thread)}
                                  disabled={sendingReply || !replyText.trim()}
                                  style={{
                                    background: sendingReply ? '#A5B2A3' : !replyText.trim() ? '#D5CEC0' : '#8E9B8B',
                                    color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px',
                                    fontSize: 12, cursor: !replyText.trim() ? 'default' : 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 6,
                                  }}>
                                  {sendingReply ? '⏳ Sending...' : '📤 Send Reply'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}