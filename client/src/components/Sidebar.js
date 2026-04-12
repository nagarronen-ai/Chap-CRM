// client/src/components/Sidebar.js
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useRole } from '../hooks/useRole';

const APP_VERSION = 'v2.3';
const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { can, role } = useRole();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [unreadCount, setUnreadCount] = useState(0);
  const [collapsed, setCollapsed] = useState(() => {
    const initial = {};
    const activeGroups = ['main', 'crm', 'communication', 'growth', 'intelligence', 'finance', 'admin'];
    activeGroups.forEach(key => { initial[key] = true; }); // all collapsed by default
    return initial;
  });

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

  const groups = [
    {
      key: 'main',
      label: 'Main',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: '📊', show: true },
      ],
    },
    {
      key: 'crm',
      label: 'CRM',
      items: [
        { path: '/contacts', label: 'Contacts', icon: '🏢', show: true },
        { path: '/clients', label: 'Clients', icon: '🤝', show: true },
      ],
    },
    {
      key: 'communication',
      label: 'Communication',
      items: [
        { path: '/emails', label: 'Email Templates', icon: '✉️', show: can('email:templates') },
        { path: '/inbox', label: 'Email Inbox', icon: '📬', show: true, badge: unreadCount },
        { path: '/calendar', label: 'Calendar', icon: '📅', show: true },
      ],
    },
    {
      key: 'growth',
      label: 'Growth',
      items: [
        { path: '/marketing', label: 'Marketing', icon: '📣', show: can('marketing:view') },
        { path: '/import', label: 'Import CSV', icon: '📥', show: can('import:run') },
      ],
    },
    {
      key: 'intelligence',
      label: 'Intelligence',
      items: [
        { path: '/thoughts', label: 'My Thoughts', icon: '💭', show: true },
        { path: '/ai/log', label: 'AI Assistant', icon: '🧠', show: true },
      ],
    },
    {
      key: 'finance',
      label: 'Finance',
      items: [
        { path: '/finance', label: 'Finance', icon: '💰', show: can('finance:general') },
      ],
    },
    {
      key: 'admin',
      label: 'Admin',
      items: [
        { path: '/team', label: 'Team', icon: '👥', show: can('users:manage') },
        { path: '/settings', label: 'Settings', icon: '⚙️', show: true },
      ],
    },
  ];

  useEffect(() => {
    groups.forEach(group => {
      const visibleItems = group.items.filter(i => i.show);
      if (visibleItems.some(i => location.pathname === i.path)) {
        setCollapsed(prev => ({ ...prev, [group.key]: false }));
      }
    });
  }, [location.pathname]);

  const toggleGroup = (key) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isGroupActive = (items) => items.some(i => location.pathname === i.path);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div style={{
      width: 220, height: '100vh', background: '#FFFFFF',
      borderRight: '1px solid rgba(62,66,61,0.1)',
      display: 'flex', flexDirection: 'column', padding: '20px 12px',
      fontFamily: "'Inter', sans-serif", position: 'fixed', top: 0, left: 0,
      boxSizing: 'border-box', overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 24, paddingLeft: 12 }}>
        <p style={{ color: '#8E9B8B', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 2px' }}>Planfor</p>
        <p style={{ color: '#3E423D', fontSize: 18, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>CRM</p>
      </div>

      {/* Nav groups */}
      <nav style={{ flex: 1 }}>
        {groups.map(group => {
          const visibleItems = group.items.filter(i => i.show);
          if (visibleItems.length === 0) return null;
          const isOpen = !collapsed[group.key];
          const hasActive = isGroupActive(visibleItems);

          return (
            <div key={group.key} style={{ marginBottom: 4 }}>
              {/* Group header */}
              <div onClick={() => toggleGroup(group.key)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                color: hasActive ? '#3E423D' : '#717182',
                fontWeight: 600, fontSize: 11,
                textTransform: 'uppercase', letterSpacing: 0.8,
                background: hasActive && !isOpen ? '#F5F3EF' : 'transparent',
                userSelect: 'none',
              }}>
                <span>{group.label}</span>
                <span style={{ fontSize: 9, opacity: 0.6, transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
              </div>

              {/* Group items */}
              {isOpen && (
                <div style={{ marginTop: 2, marginBottom: 4 }}>
                  {visibleItems.map(item => {
                    const active = location.pathname === item.path;
                    return (
                      <div key={item.path} onClick={() => navigate(item.path)} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 12px 7px 20px', borderRadius: 6, marginBottom: 1,
                        cursor: 'pointer',
                        background: active ? '#F5F3EF' : 'transparent',
                        color: active ? '#3E423D' : '#5A6059',
                        fontWeight: active ? 600 : 400,
                        fontSize: 12,
                        transition: 'all 0.15s',
                      }}>
                        <span style={{ fontSize: 13 }}>{item.icon}</span>
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {item.badge > 0 && (
                          <span style={{
                            background: '#D4183D', color: '#fff',
                            fontSize: 9, fontWeight: 700, borderRadius: 10,
                            padding: '1px 6px', minWidth: 16, textAlign: 'center',
                          }}>{item.badge > 99 ? '99+' : item.badge}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User info */}
      <div style={{ borderTop: '1px solid rgba(62,66,61,0.08)', paddingTop: 12, marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', marginBottom: 4 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', background: '#8E9B8B',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 11, fontWeight: 600, flexShrink: 0,
          }}>
            {user.name?.charAt(0) || 'U'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ color: '#3E423D', fontSize: 12, fontWeight: 500, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</p>
            <span style={{
              display: 'inline-block', background: ROLE_COLORS[role] || '#717182',
              color: '#fff', fontSize: 9, fontWeight: 600, borderRadius: 4,
              padding: '1px 5px', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1,
            }}>
              {ROLE_LABELS[role] || role}
            </span>
          </div>
        </div>
        <div onClick={handleLogout} style={{
          padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
          color: '#D4183D', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>↩</span> Sign out
        </div>
        <div style={{ background: '#F5F3EF', borderRadius: 5, padding: '3px 8px', textAlign: 'center', margin: '6px 12px 0' }}>
          <p style={{ color: '#717182', fontSize: 10, margin: 0, fontWeight: 500 }}>{APP_VERSION}</p>
        </div>
      </div>
    </div>
  );
}