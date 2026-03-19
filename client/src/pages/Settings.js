// client/src/pages/Settings.js
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useRole } from '../hooks/useRole';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

export default function Settings() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useRole();
  const isAdmin = role === 'admin';
  const [userTimezone, setUserTimezone] = useState('Asia/Jerusalem');
  const [signature, setSignature] = useState('');
  const [savingSignature, setSavingSignature] = useState(false);  

  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  // Show success/error toast from OAuth redirect
  const googleStatus = searchParams.get('google');
  const googleEmail = searchParams.get('email');

  useEffect(() => {
    fetchAccounts();
    // Load user timezone
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserTimezone(user.timezone || 'Asia/Jerusalem');
    // Clear URL params after showing toast
    if (googleStatus) {
      const timer = setTimeout(() => {
        setSearchParams({});
      }, 5000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Load user signature
    const loadUser = async () => {
      try {
        const res = await axios.get(`${API}/users/me`, { headers: getHeaders() });
        setSignature(res.data.email_signature || '');
        setUserTimezone(res.data.timezone || 'Asia/Jerusalem');
      } catch (err) {
        console.error(err);
      }
    };
    loadUser();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await axios.get(`${API}/google/accounts`, { headers: getHeaders() });
      setAccounts(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const connectAccount = async (type = 'personal', label = '') => {
    setConnecting(true);
    try {
      const url = `${API}/google/connect?type=${type}${label ? `&label=${label}` : ''}`;
      const res = await axios.get(url, { headers: getHeaders() });
      if (res.data.authUrl) {
        window.location.href = res.data.authUrl;
      }
    } catch (err) {
      console.error(err);
      setConnecting(false);
    }
  };

  const disconnectAccount = async (accountId) => {
    if (!window.confirm('Disconnect this Google account? Email sync and calendar sync will stop for this account.')) return;
    try {
      await axios.delete(`${API}/google/accounts/${accountId}`, { headers: getHeaders() });
      setAccounts(prev => prev.filter(a => a.id !== accountId));
    } catch (err) { console.error(err); }
  };

  const personalAccounts = accounts.filter(a => a.account_type === 'personal' && a.is_active);
  const sharedAccounts = accounts.filter(a => a.account_type === 'shared' && a.is_active);
  const hasPersonal = personalAccounts.length > 0;

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 240, flex: 1, padding: '32px 40px', maxWidth: 800 }}>

        {/* Header */}
        <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>Configuration</p>
        <h1 style={{ color: '#3E423D', fontSize: 28, fontWeight: 600, fontStyle: 'italic', fontFamily: "'Playfair Display', Georgia, serif", margin: '0 0 24px' }}>Settings</h1>

        {/* OAuth Success/Error Toast */}
        {googleStatus === 'success' && (
          <div style={{
            background: '#D4EDDA', border: '1px solid #C3E6CB', borderRadius: 10, padding: '14px 20px',
            marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10
          }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <span style={{ color: '#155724', fontSize: 14 }}>
              Successfully connected <strong>{googleEmail}</strong>
            </span>
          </div>
        )}
        {googleStatus === 'error' && (
          <div style={{
            background: '#F8D7DA', border: '1px solid #F5C6CB', borderRadius: 10, padding: '14px 20px',
            marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10
          }}>
            <span style={{ fontSize: 18 }}>❌</span>
            <span style={{ color: '#721C24', fontSize: 14 }}>
              Failed to connect Google account. Please try again.
            </span>
          </div>
        )}

        {/* Personal Gmail Account */}
        <div style={{
          background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.08)',
          padding: '24px 28px', marginBottom: 20
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ color: '#3E423D', fontSize: 17, fontWeight: 600, margin: '0 0 4px' }}>Your Gmail Account</h2>
              <p style={{ color: '#717182', fontSize: 13, margin: 0 }}>
                Connect your @planfor.io email to send emails and sync replies from CRM contacts
              </p>
            </div>
            {!hasPersonal && (
              <button
                onClick={() => connectAccount('personal')}
                disabled={connecting}
                style={{
                  background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: connecting ? 'not-allowed' : 'pointer',
                  opacity: connecting ? 0.7 : 1, fontFamily: 'Inter, sans-serif'
                }}
              >
                {connecting ? '⏳ Connecting...' : '🔗 Connect Gmail'}
              </button>
            )}
          </div>

          {hasPersonal ? (
            personalAccounts.map(account => (
              <div key={account.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#F5F3EF', borderRadius: 10, padding: '14px 20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', background: '#8E9B8B',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 16, fontWeight: 600
                  }}>
                    {account.email?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ color: '#3E423D', fontSize: 14, fontWeight: 500, margin: 0 }}>{account.email}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <span style={{
                        display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                        background: '#4CAF50'
                      }} />
                      <span style={{ color: '#717182', fontSize: 11 }}>
                        Connected · {account.crm_users?.name || 'You'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => disconnectAccount(account.id)}
                  style={{
                    background: 'none', color: '#D4183D', border: '1px solid #D4183D',
                    borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif'
                  }}
                >
                  Disconnect
                </button>
              </div>
            ))
          ) : (
            <div style={{
              background: '#F5F3EF', borderRadius: 10, padding: '24px',
              textAlign: 'center', color: '#717182', fontSize: 13
            }}>
              No Gmail account connected yet. Connect your @planfor.io email to start sending emails directly from the CRM.
            </div>
          )}
        </div>

        {/* Shared Accounts (Admin Only) */}
        {isAdmin && (
          <div style={{
            background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.08)',
            padding: '24px 28px', marginBottom: 20
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ color: '#3E423D', fontSize: 17, fontWeight: 600, margin: '0 0 4px' }}>Shared Accounts</h2>
                <p style={{ color: '#717182', fontSize: 13, margin: 0 }}>
                  Connect shared mailboxes like marketing@planfor.io — replies get routed to the assigned rep
                </p>
              </div>
              <button
                onClick={() => {
                  const label = window.prompt('Enter a label for this shared account (e.g. Marketing, Support):');
                  if (label) connectAccount('shared', label);
                }}
                disabled={connecting}
                style={{
                  background: '#fff', color: '#3E423D', border: '1px solid rgba(62,66,61,0.15)',
                  borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 500,
                  cursor: connecting ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif'
                }}
              >
                + Add Shared Account
              </button>
            </div>

            {sharedAccounts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sharedAccounts.map(account => (
                  <div key={account.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: '#F5F3EF', borderRadius: 10, padding: '14px 20px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', background: '#B4A5D6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 14, fontWeight: 600
                      }}>
                        {account.label?.charAt(0).toUpperCase() || 'S'}
                      </div>
                      <div>
                        <p style={{ color: '#3E423D', fontSize: 14, fontWeight: 500, margin: 0 }}>{account.email}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                          <span style={{
                            background: '#B4A5D6', color: '#fff', fontSize: 10, fontWeight: 600,
                            borderRadius: 4, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: 0.5
                          }}>
                            {account.label || 'Shared'}
                          </span>
                          <span style={{ color: '#717182', fontSize: 11 }}>
                            Connected by {account.crm_users?.name || '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => disconnectAccount(account.id)}
                      style={{
                        background: 'none', color: '#D4183D', border: '1px solid #D4183D',
                        borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif'
                      }}
                    >
                      Disconnect
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                background: '#F5F3EF', borderRadius: 10, padding: '24px',
                textAlign: 'center', color: '#717182', fontSize: 13
              }}>
                No shared accounts connected. Add a shared mailbox to automatically capture marketing email replies.
              </div>
            )}
          </div>
        )}
{/* Email Signature */}
<div style={{
          background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.08)',
          padding: '24px 28px', marginBottom: 20
        }}>
          <h2 style={{ color: '#3E423D', fontSize: 17, fontWeight: 600, margin: '0 0 4px' }}>Email Signature</h2>
          <p style={{ color: '#717182', fontSize: 13, margin: '0 0 16px' }}>
            This signature can be toggled on/off when composing emails
          </p>
          <textarea
            value={signature}
            onChange={e => setSignature(e.target.value)}
            rows={6}
            placeholder='<div style="font-size:13px;color:#555;">Best regards,<br>Your Name<br>Planfor.io</div>'
            style={{
              width: '100%', background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8,
              padding: '10px 12px', color: '#3E423D', fontSize: 12, fontFamily: 'monospace',
              boxSizing: 'border-box', outline: 'none', resize: 'vertical', marginBottom: 12
            }}
          />
          {signature && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 6px' }}>Preview</p>
              <div style={{ background: '#F5F3EF', borderRadius: 8, padding: 14, border: '1px solid rgba(62,66,61,0.08)' }}
                dangerouslySetInnerHTML={{ __html: signature }} />
            </div>
          )}
          <button
            onClick={async () => {
              setSavingSignature(true);
              try {
                await axios.put(`${API}/users/me/signature`, { signature }, { headers: getHeaders() });
              } catch (err) { console.error(err); }
              setSavingSignature(false);
            }}
            style={{
              background: savingSignature ? '#A5B2A3' : '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif'
            }}
          >
            {savingSignature ? '⏳ Saving...' : '💾 Save Signature'}
          </button>
        </div>

        {/* User Timezone */}
        <div style={{
          background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.08)',
          padding: '24px 28px', marginBottom: 20
        }}>
          <h2 style={{ color: '#3E423D', fontSize: 17, fontWeight: 600, margin: '0 0 4px' }}>Your Timezone</h2>
          <p style={{ color: '#717182', fontSize: 13, margin: '0 0 16px' }}>
            Used for calendar timezone conversion when scheduling meetings with US venues
          </p>
          <select
            value={userTimezone}
            onChange={async (e) => {
              const tz = e.target.value;
              setUserTimezone(tz);
              try {
                await axios.put(`${API}/users/me/timezone`, { timezone: tz }, { headers: getHeaders() });
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                user.timezone = tz;
                localStorage.setItem('user', JSON.stringify(user));
              } catch (err) { console.error(err); }
            }}
            style={{
              width: 400, background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8,
              padding: '10px 12px', color: '#3E423D', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif'
            }}
          >
            {Intl.supportedValuesOf('timeZone').map(tz => {
              try {
                const now = new Date();
                const offset = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
                  .formatToParts(now)
                  .find(p => p.type === 'timeZoneName')?.value || '';
                return (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, ' ')} ({offset})
                  </option>
                );
              } catch {
                return <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>;
              }
            })}
          </select>
          <p style={{ color: '#717182', fontSize: 12, marginTop: 8 }}>
            Current time: {new Date().toLocaleString('en-US', { timeZone: userTimezone, hour: 'numeric', minute: '2-digit', hour12: true, weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
        </div>

        {/* What's Connected Info */}
        <div style={{
          background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.08)',
          padding: '24px 28px'
        }}>
          <h2 style={{ color: '#3E423D', fontSize: 17, fontWeight: 600, margin: '0 0 16px' }}>What gets synced</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { icon: '📤', title: 'Direct Emails', desc: 'Send emails from your real Gmail address instead of SendGrid' },
              { icon: '📥', title: 'Smart Inbox Sync', desc: 'Replies from CRM contacts automatically appear on company profiles' },
              { icon: '📣', title: 'Marketing Replies', desc: 'When a venue replies to a campaign, it routes to the assigned rep' },
              { icon: '📅', title: 'Calendar Sync', desc: 'See your Google Calendar in the CRM, create meetings that sync both ways' },
            ].map(item => (
              <div key={item.title} style={{
                background: '#F5F3EF', borderRadius: 10, padding: '16px 18px',
                display: 'flex', gap: 12, alignItems: 'flex-start'
              }}>
                <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
                <div>
                  <p style={{ color: '#3E423D', fontSize: 13, fontWeight: 600, margin: '0 0 3px' }}>{item.title}</p>
                  <p style={{ color: '#717182', fontSize: 12, margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}