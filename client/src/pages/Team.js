// client/src/pages/Team.js
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useApp } from '../context/AppContext';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const ROLES = ['admin', 'sales', 'marketing', 'csm', 'support', 'finance'];
const ROLE_COLORS = {
  admin: '#8E9B8B', sales: '#94B0BC', marketing: '#B4A5D6',
  csm: '#D4A574', support: '#717182', finance: '#4CAF50',
};
const ROLE_LABELS = {
  admin: 'Admin', sales: 'Sales', marketing: 'Marketing',
  csm: 'CSM', support: 'Support', finance: 'Finance',
};

export default function Team() {
  const { palette: p } = useApp();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ full_name: '', email: '', role: 'sales', password: '' });
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState(null);
  const [saving, setSaving] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/users`, { headers });
      setUsers(res.data);
    } catch (err) {
      if (err.response?.status === 403) navigate('/dashboard');
    }
    setLoading(false);
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await axios.put(`${API}/users/${userId}/role`, { role: newRole }, { headers });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) { alert('Failed to update role'); }
  };

  const handleResetPassword = async (userId, name) => {
    if (!window.confirm(`Reset password for ${name}? A new temp password will be generated.`)) return;
    try {
      const res = await axios.put(`${API}/users/${userId}/reset-password`, {}, { headers });
      setResetResult({ name, temp_password: res.data.temp_password });
    } catch (err) { alert(err.response?.data?.error || 'Failed to reset password'); }
  };

  const handleDelete = async (userId, name) => {
    if (!window.confirm(`Remove ${name} from the team?`)) return;
    try {
      await axios.delete(`${API}/users/${userId}`, { headers });
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) { alert(err.response?.data?.error || 'Failed to delete user'); }
  };

  const handleInvite = async () => {
    setInviteError('');
    if (!inviteForm.full_name || !inviteForm.email) return setInviteError('Name and email are required');
    setSaving(true);
    try {
      const res = await axios.post(`${API}/users/invite`, inviteForm, { headers });
      setInviteSuccess(res.data);
      setUsers(prev => [...prev, res.data]);
      setInviteForm({ full_name: '', email: '', role: 'sales', password: '' });
    } catch (err) { setInviteError(err.response?.data?.error || 'Failed to create user'); }
    setSaving(false);
  };

  const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${p.inputBorder}`, background: p.inputBg, color: p.text, fontSize: 14, boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' };

  if (loading) return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: p.background, minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: 40, color: p.textSecondary }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: p.background, minHeight: '100vh', transition: 'background 0.4s' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: 40 }}>

        <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>Settings</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <h1 style={{ color: p.text, fontSize: 30, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>Team</h1>
          <button onClick={() => { setShowInvite(true); setInviteSuccess(null); }}
            style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            + Invite Member
          </button>
        </div>

        {/* Users Table */}
        <div style={{ background: p.cardBg, borderRadius: 12, border: `1px solid ${p.cardBorder}`, boxShadow: `0 2px 8px ${p.cardBorder}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: p.inputBg }}>
                {['Name', 'Email', 'Role', 'Last Login', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: p.textSecondary, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} style={{ borderTop: `1px solid ${p.cardBorder}` }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: ROLE_COLORS[user.role] || p.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                        {user.full_name?.charAt(0)}
                      </div>
                      <span style={{ color: p.text, fontSize: 14, fontWeight: 500 }}>{user.full_name}</span>
                      {user.id === currentUser.id && (
                        <span style={{ background: p.inputBg, color: p.textSecondary, fontSize: 10, borderRadius: 4, padding: '2px 6px' }}>You</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', color: p.textSecondary, fontSize: 14 }}>{user.email}</td>
                  <td style={{ padding: '14px 16px' }}>
                    {user.id === currentUser.id ? (
                      <span style={{ background: ROLE_COLORS[user.role], color: '#fff', fontSize: 11, fontWeight: 600, borderRadius: 6, padding: '3px 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    ) : (
                      <select value={user.role} onChange={e => handleRoleChange(user.id, e.target.value)}
                        style={{ background: ROLE_COLORS[user.role], color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {ROLES.map(r => <option key={r} value={r} style={{ background: '#fff', color: '#3E423D' }}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', color: p.textSecondary, fontSize: 13 }}>
                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    {user.id !== currentUser.id && (
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => handleResetPassword(user.id, user.name)}
                          style={{ background: 'none', border: `1px solid ${p.inputBorder}`, color: p.textSecondary, cursor: 'pointer', fontSize: 12, padding: '4px 10px', borderRadius: 6 }}>
                          🔑 Reset Password
                        </button>
                        <button onClick={() => handleDelete(user.id, user.full_name)}
                          style={{ background: 'none', border: 'none', color: '#D4183D', cursor: 'pointer', fontSize: 13, padding: '4px 8px', borderRadius: 6 }}>
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Reset Password Result Modal */}
        {resetResult && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: p.cardBg, borderRadius: 16, padding: 32, width: 380, boxShadow: '0 8px 40px rgba(0,0,0,0.15)', border: `1px solid ${p.cardBorder}` }}>
              <h2 style={{ color: p.text, fontSize: 18, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 16px' }}>Password Reset</h2>
              <div style={{ background: '#F0FAF0', border: '1px solid #4CAF50', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                <p style={{ color: '#2E7D32', fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>✓ Password reset for {resetResult.name}</p>
                <p style={{ color: p.textSecondary, fontSize: 13, margin: '0 0 4px' }}>New temporary password:</p>
                <code style={{ background: p.inputBg, border: `1px solid ${p.inputBorder}`, borderRadius: 6, padding: '6px 12px', fontSize: 16, fontWeight: 700, letterSpacing: 2, color: p.text, display: 'block', textAlign: 'center', marginTop: 8 }}>
                  {resetResult.temp_password}
                </code>
                <p style={{ color: p.textSecondary, fontSize: 11, margin: '10px 0 0', textAlign: 'center' }}>Share this with the user. It won't be shown again.</p>
              </div>
              <button onClick={() => setResetResult(null)} style={{ width: '100%', background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: 12, fontSize: 14, cursor: 'pointer' }}>Done</button>
            </div>
          </div>
        )}

        {/* Invite Modal */}
        {showInvite && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: p.cardBg, borderRadius: 16, padding: 32, width: 420, boxShadow: '0 8px 40px rgba(0,0,0,0.15)', border: `1px solid ${p.cardBorder}` }}>
              <h2 style={{ color: p.text, fontSize: 20, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 24px' }}>Invite Team Member</h2>

              {inviteSuccess ? (
                <div>
                  <div style={{ background: '#f0faf0', border: '1px solid #4CAF50', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                    <p style={{ color: '#2e7d32', fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>✓ User created successfully</p>
                    <p style={{ color: p.textSecondary, fontSize: 13, margin: '0 0 4px' }}><strong>Email:</strong> {inviteSuccess.email}</p>
                    <p style={{ color: p.textSecondary, fontSize: 13, margin: 0 }}><strong>Temp password:</strong> <code style={{ background: p.inputBg, padding: '2px 6px', borderRadius: 4 }}>{inviteSuccess.temp_password}</code></p>
                    <p style={{ color: p.textSecondary, fontSize: 12, margin: '8px 0 0' }}>Share these credentials with the new team member.</p>
                  </div>
                  <button onClick={() => setShowInvite(false)} style={{ width: '100%', background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: 12, fontSize: 14, cursor: 'pointer' }}>Done</button>
                </div>
              ) : (
                <>
                  {inviteError && (
                    <div style={{ background: '#fdf0f0', border: '1px solid #D4183D', borderRadius: 8, padding: '10px 14px', color: '#D4183D', fontSize: 13, marginBottom: 16 }}>
                      {inviteError}
                    </div>
                  )}
                  {[
                    { label: 'Full Name', key: 'full_name', type: 'text', placeholder: 'Jane Smith' },
                    { label: 'Email', key: 'email', type: 'email', placeholder: 'jane@company.com' },
                    { label: 'Temporary Password', key: 'password', type: 'text', placeholder: 'Leave blank for default' },
                  ].map(field => (
                    <div key={field.key} style={{ marginBottom: 16 }}>
                      <label style={{ color: p.textSecondary, fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>{field.label}</label>
                      <input type={field.type} placeholder={field.placeholder} value={inviteForm[field.key]}
                        onChange={e => setInviteForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                        style={inputStyle} />
                    </div>
                  ))}
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ color: p.textSecondary, fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>Role</label>
                    <select value={inviteForm.role} onChange={e => setInviteForm(prev => ({ ...prev, role: e.target.value }))} style={inputStyle}>
                      {ROLES.filter(r => r !== 'admin').map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setShowInvite(false)} style={{ flex: 1, background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: 12, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleInvite} disabled={saving}
                      style={{ flex: 1, background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: 12, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                      {saving ? 'Creating...' : 'Create User'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}