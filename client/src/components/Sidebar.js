// client/src/components/Sidebar.js
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useRole } from '../hooks/useRole';

export default function Sidebar() {
  const APP_VERSION = 'v1.4.2';
  const navigate = useNavigate();
  const location = useLocation();
  const { can, role } = useRole();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [unreadCount, setUnreadCount] = useState(0);
  const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await axios.get(`${API}/sync/unread-count`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setUnreadCount(res.data.count || 0);
      } catch (err) {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, []);

  const ROLE_COLORS = {
    admin: '#8E9B8B', sales: '#94B0BC', marketing: '#B4A5D6',
    csm: '#D4A574', support: '#717182', finance: '#4CAF50',
  };
  const ROLE_LABELS = {
    admin: 'Admin', sales: 'Sales', marketing: 'Marketing',
    csm: 'CSM', support: 'Support', finance: 'Finance',
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊', show: true },
    { path: '/contacts', label: 'Contacts', icon: '🏢', show: true },
    { path: '/clients', label: 'Clients', icon: '🤝', show: true },
    { path: '/calendar', label: 'Calendar', icon: '📅', show: true },
    { path: '/emails', label: 'Email Templates', icon: '✉️', show: can('email:templates') },
    { path: '/inbox', label: 'Email Inbox', icon: '📬', show: true, badge: unreadCount },
    { path: '/import', label: 'Import CSV', icon: '📥', show: can('import:run') },
    { path: '/team', label: 'Team', icon: '👥', show: can('users:manage') },
    { path: '/marketing', label: 'Marketing', icon: '📣', show: can('marketing:view') },
    { path: '/finance', label: 'Finance', icon: '💰', show: can('finance:general') },
    { path: '/settings', label: 'Settings', icon: '⚙️', show: true },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div style={{
      width: 240, height: '100vh', background: '#FFFFFF',
      borderRight: '1px solid rgba(62,66,61,0.1)',
      display: 'flex', flexDirection: 'column', padding: '24px 16px',
      fontFamily: "'Inter', sans-serif", position: 'fixed', top: 0, left: 0,
      boxSizing: 'border-box'
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ color: '#8E9B8B', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 4px', paddingLeft: 16 }}>Planfor</p>
        <p style={{ color: '#3E423D', fontSize: 20, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0, paddingLeft: 16 }}>CRM</p>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1 }}>
        {navItems.filter(i => i.show).map(item => {
          const active = location.pathname === item.path;
          return (
            <div key={item.path} onClick={() => navigate(item.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px', borderRadius: 8, marginBottom: 2, cursor: 'pointer',
                background: active ? '#F5F3EF' : 'transparent',
                color: active ? '#3E423D' : '#5A6059',
                fontWeight: active ? 600 : 400, fontSize: 14,
                transition: 'all 0.15s',
              }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
              {item.badge > 0 && (
                <span style={{
                  marginLeft: 'auto', background: '#D4183D', color: '#fff',
                  fontSize: 10, fontWeight: 700, borderRadius: 10,
                  padding: '1px 7px', minWidth: 18, textAlign: 'center',
                }}>{item.badge > 99 ? '99+' : item.badge}</span>
              )}
            </div>
          );
        })}
      </nav>

      {/* User info + role badge */}
      <div style={{ borderTop: '1px solid rgba(62,66,61,0.08)', paddingTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', marginBottom: 4 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: '#8E9B8B',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 13, fontWeight: 600, flexShrink: 0
          }}>
            {user.name?.charAt(0) || 'U'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ color: '#3E423D', fontSize: 13, fontWeight: 500, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</p>
            <span style={{
              display: 'inline-block', background: ROLE_COLORS[role] || '#717182',
              color: '#fff', fontSize: 10, fontWeight: 600, borderRadius: 4,
              padding: '1px 6px', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2
            }}>
              {ROLE_LABELS[role] || role}
            </span>
          </div>
        </div>
        <div onClick={handleLogout}
          style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer', color: '#D4183D', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>↩</span> Sign out
        </div>
        <div style={{ background: '#F5F3EF', borderRadius: 6, padding: '4px 10px', textAlign: 'center', margin: '8px 16px 0' }}>
          <p style={{ color: '#717182', fontSize: 11, margin: 0, fontWeight: 500 }}>{APP_VERSION}</p>
        </div>
      </div>
    </div>
  );
}