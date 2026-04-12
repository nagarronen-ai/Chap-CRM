// client/src/pages/Settings.js
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useRole } from '../hooks/useRole';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const MODULES = [
  { key: 'pipeline', label: 'Pipeline', actions: ['view', 'create', 'edit', 'delete', 'change_stage'] },
  { key: 'contacts', label: 'Contacts', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'clients', label: 'Clients', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'emails', label: 'Emails', actions: ['view', 'send', 'delete', 'manage_templates'] },
  { key: 'inbox', label: 'Inbox', actions: ['view'] },
  { key: 'calendar', label: 'Calendar', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'marketing', label: 'Marketing', actions: ['view', 'create', 'send_campaign', 'manage_drip', 'view_waitlist', 'export'] },
  { key: 'finance', label: 'Finance', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'ai_assistant', label: 'AI Assistant', actions: ['view', 'use'] },
  { key: 'thoughts', label: 'Thoughts', actions: ['view', 'use'] },
  { key: 'team', label: 'Team', actions: ['view', 'invite', 'edit_roles', 'delete_users'] },
  { key: 'settings', label: 'Settings', actions: ['view', 'edit'] },
  { key: 'import', label: 'Import', actions: ['use'] },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useRole();
  const isAdmin = role === 'admin';
  const [userTimezone, setUserTimezone] = useState('Asia/Jerusalem');
  const [signature, setSignature] = useState('');
  const [savingSignature, setSavingSignature] = useState(false);
  const [showSignaturePreview, setShowSignaturePreview] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [slackUserId, setSlackUserId] = useState('');
  const [savingSlack, setSavingSlack] = useState(false);
  const [slackSaved, setSlackSaved] = useState(false);

  // Roles & Permissions state
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [permMatrix, setPermMatrix] = useState({});
  const [savingPerms, setSavingPerms] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [showNewRole, setShowNewRole] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);

  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
  const googleStatus = searchParams.get('google');
  const googleEmail = searchParams.get('email');

  useEffect(() => {
    fetchAccounts();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserTimezone(user.timezone || 'Asia/Jerusalem');
    if (googleStatus) {
      const timer = setTimeout(() => setSearchParams({}), 5000);
      return () => clearTimeout(timer);
    }
    const loadUser = async () => {
      try {
        const res = await axios.get(`${API}/users/me`, { headers: getHeaders() });
        setSignature(res.data.email_signature || '');
        setUserTimezone(res.data.timezone || 'Asia/Jerusalem');
        setSlackUserId(res.data.slack_user_id || '');
      } catch (err) { console.error(err); }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (activeTab === 'permissions' && isAdmin) fetchRoles();
  }, [activeTab]);

  const fetchAccounts = async () => {
    try {
      const res = await axios.get(`${API}/google/accounts`, { headers: getHeaders() });
      setAccounts(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchRoles = async () => {
    try {
      const res = await axios.get(`${API}/roles`, { headers: getHeaders() });
      setRoles(res.data);
      if (res.data.length > 0) selectRole(res.data[0]);
    } catch (err) { console.error(err); }
  };

  const selectRole = (r) => {
    setSelectedRole(r);
    const matrix = {};
    (r.crm_permissions || []).forEach(p => {
      if (!matrix[p.module]) matrix[p.module] = {};
      matrix[p.module][p.action] = p.enabled;
    });
    setPermMatrix(matrix);
  };

  const togglePerm = (module, action) => {
    setPermMatrix(prev => ({
      ...prev,
      [module]: { ...prev[module], [action]: !prev[module]?.[action] },
    }));
  };

  const savePermissions = async () => {
    setSavingPerms(true);
    const permissions = [];
    Object.entries(permMatrix).forEach(([module, actions]) => {
      Object.entries(actions).forEach(([action, enabled]) => {
        permissions.push({ module, action, enabled });
      });
    });
    try {
      await axios.put(`${API}/roles/${selectedRole.id}/permissions`, { permissions }, { headers: getHeaders() });
      await fetchRoles();
    } catch (err) { console.error(err); }
    setSavingPerms(false);
  };

  const createRole = async () => {
    if (!newRoleName.trim()) return;
    setCreatingRole(true);
    try {
      const res = await axios.post(`${API}/roles`, { name: newRoleName, description: newRoleDesc }, { headers: getHeaders() });
      setRoles(prev => [...prev, res.data]);
      selectRole(res.data);
      setNewRoleName('');
      setNewRoleDesc('');
      setShowNewRole(false);
    } catch (err) { console.error(err); }
    setCreatingRole(false);
  };

  const deleteRole = async (id) => {
    if (!window.confirm('Delete this role? Users with this role will need to be reassigned.')) return;
    try {
      await axios.delete(`${API}/roles/${id}`, { headers: getHeaders() });
      const updated = roles.filter(r => r.id !== id);
      setRoles(updated);
      if (updated.length > 0) selectRole(updated[0]);
      else setSelectedRole(null);
    } catch (err) { console.error(err); }
  };

  const connectAccount = async (type = 'personal', label = '') => {
    setConnecting(true);
    try {
      const url = `${API}/google/connect?type=${type}${label ? `&label=${label}` : ''}`;
      const res = await axios.get(url, { headers: getHeaders() });
      if (res.data.authUrl) window.location.href = res.data.authUrl;
    } catch (err) { console.error(err); setConnecting(false); }
  };

  const disconnectAccount = async (accountId) => {
    if (!window.confirm('Disconnect this Google account? Email sync and calendar sync will stop for this account.')) return;
    try {
      await axios.delete(`${API}/google/accounts/${accountId}`, { headers: getHeaders() });
      fetchAccounts();
    } catch (err) { console.error(err); }
  };

  return (
    <div style={{ background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: '32px 40px', overflowY: 'auto', minHeight: '100vh', boxSizing: 'border-box' }}>
        <h1 style={{ color: '#1a1d1a', fontSize: 28, fontWeight: 700, margin: '0 0 8px', fontFamily: 'Inter, sans-serif' }}>Settings</h1>
        <p style={{ color: '#717182', fontSize: 14, margin: '0 0 28px' }}>Manage your account, integrations and team permissions</p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(62,66,61,0.1)', marginBottom: 28 }}>
          {[
            { key: 'general', label: 'General' },
            ...(isAdmin ? [{ key: 'permissions', label: 'Roles & Permissions' }] : []),
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              background: 'none', border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #8E9B8B' : '2px solid transparent',
              padding: '10px 24px', fontSize: 14, cursor: 'pointer',
              color: activeTab === tab.key ? '#3E423D' : '#717182',
              fontWeight: activeTab === tab.key ? 600 : 400,
              fontFamily: 'Inter, sans-serif',
            }}>{tab.label}</button>
          ))}
        </div>

        {/* ─── GENERAL TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'general' && (
          <div>
            {/* Google toast */}
            {googleStatus && (
              <div style={{ background: googleStatus === 'success' ? '#E8F5E9' : '#FFEBEE', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: googleStatus === 'success' ? '#2E7D32' : '#D4183D', fontSize: 13 }}>
                {googleStatus === 'success' ? `✅ Google account connected: ${googleEmail}` : '❌ Failed to connect Google account. Please try again.'}
              </div>
            )}

            {/* Gmail / Google */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.08)', padding: '24px 28px', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 20 }}>📧</span>
                <h2 style={{ color: '#3E423D', fontSize: 17, fontWeight: 600, margin: 0 }}>Gmail & Google Calendar</h2>
              </div>
              <p style={{ color: '#717182', fontSize: 13, margin: '0 0 16px' }}>Connect your Google account to send emails from Gmail and sync your calendar.</p>
              {loading ? <p style={{ color: '#717182', fontSize: 13 }}>Loading...</p> : (
                <>
                  {accounts.map(account => (
                    <div key={account.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F5F3EF', borderRadius: 8, padding: '12px 16px', marginBottom: 10 }}>
                      <div>
                        <p style={{ color: '#3E423D', fontSize: 13, fontWeight: 600, margin: 0 }}>{account.email}</p>
                        <p style={{ color: '#717182', fontSize: 11, margin: '2px 0 0', textTransform: 'capitalize' }}>{account.account_type} · {account.label || 'Personal'}</p>
                      </div>
                      <button onClick={() => disconnectAccount(account.id)} style={{ background: 'none', color: '#D4183D', border: '1px solid #D4183D', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>Disconnect</button>
                    </div>
                  ))}
                  <button onClick={() => connectAccount('personal')} disabled={connecting} style={{ background: connecting ? '#A5B2A3' : '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>
                    {connecting ? '⏳ Connecting...' : '+ Connect Google Account'}
                  </button>
                </>
              )}
              {/* What gets synced */}
              <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { icon: '📤', title: 'Direct Emails', desc: 'Send from your real Gmail address' },
                  { icon: '📥', title: 'Smart Inbox Sync', desc: 'Replies from contacts appear on profiles' },
                  { icon: '📣', title: 'Marketing Replies', desc: 'Campaign replies route to assigned rep' },
                  { icon: '📅', title: 'Calendar Sync', desc: 'Two-way Google Calendar sync' },
                ].map(item => (
                  <div key={item.title} style={{ background: '#F5F3EF', borderRadius: 8, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                    <div>
                      <p style={{ color: '#3E423D', fontSize: 12, fontWeight: 600, margin: '0 0 2px' }}>{item.title}</p>
                      <p style={{ color: '#717182', fontSize: 11, margin: 0 }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Email Signature */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.08)', padding: '24px 28px', marginBottom: 20 }}>
              <h2 style={{ color: '#3E423D', fontSize: 17, fontWeight: 600, margin: '0 0 4px' }}>Email Signature</h2>
              <p style={{ color: '#717182', fontSize: 13, margin: '0 0 16px' }}>Appended to all direct emails sent from the CRM.</p>
              <textarea value={signature} onChange={e => setSignature(e.target.value)} rows={5}
                placeholder="Your name, title, phone..."
                style={{ width: '100%', background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '12px', color: '#3E423D', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
                <button onClick={async () => {
                  setSavingSignature(true);
                  try { await axios.put(`${API}/users/me/signature`, { signature }, { headers: getHeaders() }); }
                  catch (err) { console.error(err); }
                  setSavingSignature(false);
                }} style={{ background: savingSignature ? '#A5B2A3' : '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>
                  {savingSignature ? '⏳ Saving...' : '💾 Save Signature'}
                </button>
                <button onClick={() => setShowSignaturePreview(prev => !prev)}
                  style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.15)', borderRadius: 8, padding: '10px 16px', fontSize: 13, cursor: 'pointer' }}>
                  {showSignaturePreview ? '🙈 Hide Preview' : '👁 Preview'}
                </button>
              </div>
              {showSignaturePreview && signature && (
                <div style={{ marginTop: 16, border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: 20, background: '#FAFAF9' }}>
                  <p style={{ color: '#717182', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 12px' }}>Preview</p>
                  <div dangerouslySetInnerHTML={{ __html: signature }} />
                </div>
              )}
            </div>

            {/* Timezone */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.08)', padding: '24px 28px', marginBottom: 20 }}>
              <h2 style={{ color: '#3E423D', fontSize: 17, fontWeight: 600, margin: '0 0 4px' }}>Your Timezone</h2>
              <p style={{ color: '#717182', fontSize: 13, margin: '0 0 16px' }}>Used for calendar timezone conversion when scheduling meetings.</p>
              <select value={userTimezone} onChange={async (e) => {
                const tz = e.target.value;
                setUserTimezone(tz);
                try {
                  await axios.put(`${API}/users/me/timezone`, { timezone: tz }, { headers: getHeaders() });
                  const user = JSON.parse(localStorage.getItem('user') || '{}');
                  user.timezone = tz;
                  localStorage.setItem('user', JSON.stringify(user));
                } catch (err) { console.error(err); }
              }} style={{ width: 400, background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '10px 12px', color: '#3E423D', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif' }}>
                {Intl.supportedValuesOf('timeZone').map(tz => {
                  try {
                    const offset = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || '';
                    return <option key={tz} value={tz}>{tz.replace(/_/g, ' ')} ({offset})</option>;
                  } catch { return <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>; }
                })}
              </select>
              <p style={{ color: '#717182', fontSize: 12, marginTop: 8 }}>
                Current time: {new Date().toLocaleString('en-US', { timeZone: userTimezone, hour: 'numeric', minute: '2-digit', hour12: true, weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
            </div>

            {/* Slack */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.08)', padding: '24px 28px', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 20 }}>💬</span>
                <h2 style={{ color: '#3E423D', fontSize: 17, fontWeight: 600, margin: 0 }}>Slack Integration</h2>
              </div>
              <p style={{ color: '#717182', fontSize: 13, margin: '0 0 16px' }}>
                Link your Slack account to chat with Chappie directly in Slack DMs.<br />
                To find your Slack Member ID: click your profile picture → View Profile → ··· → Copy Member ID
              </p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input value={slackUserId} onChange={e => setSlackUserId(e.target.value)} placeholder="e.g. U0APH8MEDC2"
                  style={{ width: 280, background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '10px 12px', color: '#3E423D', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                <button onClick={async () => {
                  setSavingSlack(true);
                  try {
                    await axios.put(`${API}/users/me/slack`, { slack_user_id: slackUserId }, { headers: getHeaders() });
                    setSlackSaved(true);
                    setTimeout(() => setSlackSaved(false), 3000);
                  } catch (err) { console.error(err); }
                  setSavingSlack(false);
                }} style={{ background: savingSlack ? '#A5B2A3' : '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>
                  {savingSlack ? '⏳ Saving...' : slackSaved ? '✅ Saved' : '💾 Save'}
                </button>
                {slackUserId && (
                  <button onClick={async () => { setSlackUserId(''); await axios.put(`${API}/users/me/slack`, { slack_user_id: '' }, { headers: getHeaders() }); }}
                    style={{ background: 'none', color: '#D4183D', border: '1px solid #D4183D', borderRadius: 8, padding: '10px 14px', fontSize: 13, cursor: 'pointer' }}>
                    Disconnect
                  </button>
                )}
              </div>
              {slackUserId && <p style={{ color: '#8E9B8B', fontSize: 12, marginTop: 8 }}>✅ Slack connected — you can now DM Chappie in your Slack workspace</p>}
            </div>

            {/* Change Password */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.08)', padding: '24px 28px', marginBottom: 20 }}>
              <h2 style={{ color: '#3E423D', fontSize: 17, fontWeight: 600, margin: '0 0 4px' }}>Change Password</h2>
              <p style={{ color: '#717182', fontSize: 13, margin: '0 0 16px' }}>Update your login password.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400 }}>
                {[
                  { key: 'current_password', label: 'Current Password' },
                  { key: 'new_password', label: 'New Password' },
                  { key: 'confirm_password', label: 'Confirm New Password' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label style={{ color: '#717182', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4 }}>{label}</label>
                    <input type="password" value={passwordForm[key]} onChange={e => setPasswordForm(p => ({ ...p, [key]: e.target.value }))}
                      style={{ width: '100%', background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '10px 12px', color: '#3E423D', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }} />
                  </div>
                ))}
                {passwordMsg && (
                  <p style={{ color: passwordMsg.type === 'error' ? '#D4183D' : '#2E7D32', fontSize: 13, margin: 0 }}>
                    {passwordMsg.type === 'error' ? '❌' : '✅'} {passwordMsg.text}
                  </p>
                )}
                <button onClick={async () => {
                  if (passwordForm.new_password !== passwordForm.confirm_password) {
                    return setPasswordMsg({ type: 'error', text: 'New passwords do not match' });
                  }
                  if (passwordForm.new_password.length < 6) {
                    return setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters' });
                  }
                  setSavingPassword(true);
                  try {
                    await axios.put(`${API}/users/me/password`, {
                      current_password: passwordForm.current_password,
                      new_password: passwordForm.new_password,
                    }, { headers: getHeaders() });
                    setPasswordMsg({ type: 'success', text: 'Password updated successfully' });
                    setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
                  } catch (err) {
                    setPasswordMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update password' });
                  }
                  setSavingPassword(false);
                }} disabled={savingPassword || !passwordForm.current_password || !passwordForm.new_password}
                  style={{ background: savingPassword ? '#A5B2A3' : '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', width: 'fit-content' }}>
                  {savingPassword ? '⏳ Saving...' : '🔒 Update Password'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── ROLES & PERMISSIONS TAB ─────────────────────────────────────── */}
        {activeTab === 'permissions' && isAdmin && (
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start' }}>

            {/* Role list */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.08)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(62,66,61,0.08)' }}>
                <p style={{ color: '#3E423D', fontSize: 13, fontWeight: 600, margin: 0 }}>Roles</p>
              </div>
              {roles.map(r => (
                <div key={r.id} onClick={() => selectRole(r)} style={{
                  padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(62,66,61,0.05)',
                  background: selectedRole?.id === r.id ? '#F0EDE8' : '#fff',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <p style={{ color: '#3E423D', fontSize: 13, fontWeight: selectedRole?.id === r.id ? 600 : 400, margin: 0, textTransform: 'capitalize' }}>{r.name}</p>
                    {r.description && <p style={{ color: '#717182', fontSize: 11, margin: '2px 0 0' }}>{r.description}</p>}
                  </div>
                  {!r.is_system && (
                    <button onClick={e => { e.stopPropagation(); deleteRole(r.id); }}
                      style={{ background: 'none', border: 'none', color: '#D4183D', cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
                  )}
                </div>
              ))}
              {showNewRole ? (
                <div style={{ padding: 12, borderTop: '1px solid rgba(62,66,61,0.08)' }}>
                  <input value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="Role name"
                    style={{ width: '100%', background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 6, padding: '7px 10px', fontSize: 12, outline: 'none', marginBottom: 6, boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }} />
                  <input value={newRoleDesc} onChange={e => setNewRoleDesc(e.target.value)} placeholder="Description (optional)"
                    style={{ width: '100%', background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 6, padding: '7px 10px', fontSize: 12, outline: 'none', marginBottom: 8, boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={createRole} disabled={creatingRole} style={{ flex: 1, background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 6, padding: '7px', fontSize: 12, cursor: 'pointer' }}>
                      {creatingRole ? '...' : 'Create'}
                    </button>
                    <button onClick={() => { setShowNewRole(false); setNewRoleName(''); setNewRoleDesc(''); }}
                      style={{ flex: 1, background: '#F5F3EF', color: '#717182', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 6, padding: '7px', fontSize: 12, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: 12 }}>
                  <button onClick={() => setShowNewRole(true)}
                    style={{ width: '100%', background: 'none', border: '1px dashed rgba(62,66,61,0.2)', borderRadius: 6, padding: '8px', fontSize: 12, color: '#8E9B8B', cursor: 'pointer' }}>
                    + New Role
                  </button>
                </div>
              )}
            </div>

            {/* Permission matrix */}
            {selectedRole ? (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.08)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(62,66,61,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ color: '#3E423D', fontSize: 15, fontWeight: 600, margin: 0, textTransform: 'capitalize' }}>{selectedRole.name}</p>
                    {selectedRole.is_system && <p style={{ color: '#717182', fontSize: 11, margin: '2px 0 0' }}>System role — name cannot be changed</p>}
                  </div>
                  <button onClick={savePermissions} disabled={savingPerms}
                    style={{ background: savingPerms ? '#A5B2A3' : '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>
                    {savingPerms ? '⏳ Saving...' : '💾 Save Changes'}
                  </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F9F9F7' }}>
                        <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, color: '#717182', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: '1px solid rgba(62,66,61,0.08)', minWidth: 120 }}>Module</th>
                        {['view', 'create', 'edit', 'delete', 'use', 'send', 'manage_templates', 'change_stage', 'send_campaign', 'manage_drip', 'view_waitlist', 'export', 'invite', 'edit_roles', 'delete_users'].map(action => (
                          <th key={action} style={{ padding: '10px 12px', textAlign: 'center', fontSize: 10, color: '#717182', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: '1px solid rgba(62,66,61,0.08)', whiteSpace: 'nowrap' }}>
                            {action.replace(/_/g, ' ')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MODULES.map((mod, i) => (
                        <tr key={mod.key} style={{ borderBottom: '1px solid rgba(62,66,61,0.05)', background: i % 2 === 0 ? '#fff' : '#FAFAF9' }}>
                          <td style={{ padding: '12px 20px', fontSize: 13, color: '#3E423D', fontWeight: 500 }}>{mod.label}</td>
                          {['view', 'create', 'edit', 'delete', 'use', 'send', 'manage_templates', 'change_stage', 'send_campaign', 'manage_drip', 'view_waitlist', 'export', 'invite', 'edit_roles', 'delete_users'].map(action => (
                            <td key={action} style={{ padding: '12px', textAlign: 'center' }}>
                              {mod.actions.includes(action) ? (
                                <input type="checkbox"
                                  checked={!!permMatrix[mod.key]?.[action]}
                                  onChange={() => togglePerm(mod.key, action)}
                                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#8E9B8B' }}
                                />
                              ) : (
                                <span style={{ color: 'rgba(62,66,61,0.15)', fontSize: 12 }}>—</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.08)', padding: 40, textAlign: 'center', color: '#717182', fontSize: 14 }}>
                Select a role to manage permissions
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}