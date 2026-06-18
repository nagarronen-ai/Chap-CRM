// client/src/components/Sidebar.js
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useRole } from '../hooks/useRole';
import { useApp } from '../context/AppContext';

const APP_VERSION = 'v2.3.0';
const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { can, role } = useRole();
  const { palette: p, settings } = useApp();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [unreadCount, setUnreadCount] = useState(0);
  const [collapsed, setCollapsed] = useState(() => {
    const initial = {};
    ['main', 'crm', 'communication', 'growth', 'intelligence', 'finance', 'admin'].forEach(key => { initial[key] = true; });
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
    admin: p.primary, sales: '#94B0BC', marketing: '#B4A5D6',
    csm: p.accent, support: p.textSecondary, finance: '#4CAF50',
  };
  const ROLE_LABELS = {
    admin: 'Admin', sales: 'Sales', marketing: 'Marketing',
    csm: 'CSM', support: 'Support', finance: 'Finance',
  };

  const groups = [
    {
      key: 'main', label: 'Main',
      items: [{ path: '/dashboard', label: 'Dashboard', icon: '📊', show: true }],
    },
    {
      key: 'crm', label: 'CRM',
      items: [
        { path: '/clients',           label: 'Clients',           icon: '🤝', show: true },
        { path: '/service-providers', label: 'Service Providers', icon: '🔗', show: true },
        { path: '/opportunities',     label: 'Opportunities',     icon: '🎯', show: true },
      ],
    },
    {
      key: 'communication', label: 'Communication',
      items: [
        { path: '/emails', label: 'Email Templates', icon: '✉️', show: can('email:templates') },
        { path: '/inbox', label: 'Email Inbox', icon: '📬', show: true, badge: unreadCount },
        { path: '/calendar', label: 'Calendar', icon: '📅', show: true },
      ],
    },
    {
      key: 'growth', label: 'Growth',
      items: [
        { path: '/marketing', label: 'Marketing', icon: '📣', show: can('marketing:view') },
        { path: '/import', label: 'Import CSV', icon: '📥', show: can('import:run') },
      ],
    },
    {
      key: 'intelligence', label: 'Intelligence',
      items: [
        { path: '/thoughts', label: 'My Thoughts', icon: '💭', show: true },
        { path: '/ai/log', label: 'AI Assistant', icon: '🧠', show: true },
      ],
    },
    {
      key: 'finance', label: 'Finance',
      items: [{ path: '/finance', label: 'Finance', icon: '💰', show: can('finance:general') }],
    },
    {
      key: 'admin', label: 'Admin',
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

  const toggleGroup = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  const isGroupActive = (items) => items.some(i => location.pathname === i.path);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('appSettings');
    navigate('/login');
  };

  return (
    <div style={{
      width: 220, height: '100vh', background: p.sidebar,
      borderRight: `1px solid ${p.sidebarActive}`,
      display: 'flex', flexDirection: 'column', padding: '20px 12px',
      fontFamily: "'Inter', sans-serif", position: 'fixed', top: 0, left: 0,
      boxSizing: 'border-box', overflowY: 'auto',
      transition: 'background 0.4s ease',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 24, paddingLeft: 12 }}>
        <img
          src={settings.logo_url || '/logo.png'}
          alt={settings.company_name || 'QPoint'}
          style={{ height: 32, maxWidth: 160, objectFit: 'contain', marginBottom: 2 }}
        />
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
              <div onClick={() => toggleGroup(group.key)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                color: hasActive ? 'rgba(255,255,255,0.9)' : p.sidebarText,
                fontWeight: 600, fontSize: 11,
                textTransform: 'uppercase', letterSpacing: 0.8,
                background: hasActive && !isOpen ? p.sidebarActive : 'transparent',
                userSelect: 'none', transition: 'all 0.15s',
              }}>
                <span>{group.label}</span>
                <span style={{ fontSize: 9, opacity: 0.6, transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
              </div>

              {isOpen && (
                <div style={{ marginTop: 2, marginBottom: 4 }}>
                  {visibleItems.map(item => {
                    const active = location.pathname === item.path;
                    return (
                      <div key={item.path} onClick={() => navigate(item.path)} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 12px 7px 20px', borderRadius: 6, marginBottom: 1,
                        cursor: 'pointer',
                        background: active ? p.sidebarActive : 'transparent',
                        color: active ? 'rgba(255,255,255,0.95)' : p.sidebarText,
                        fontWeight: active ? 600 : 400,
                        fontSize: 12, transition: 'all 0.15s',
                      }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.background = p.sidebarActive; }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span style={{ fontSize: 13 }}>{item.icon}</span>
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {item.badge > 0 && (
                          <span style={{ background: '#D4183D', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 10, padding: '1px 6px', minWidth: 16, textAlign: 'center' }}>
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
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
      <div style={{ borderTop: `1px solid ${p.sidebarActive}`, paddingTop: 12, marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', marginBottom: 4 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', background: p.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 11, fontWeight: 600, flexShrink: 0,
          }}>
            {user.name?.charAt(0) || 'U'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 500, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</p>
            <span style={{
              display: 'inline-block', background: ROLE_COLORS[role] || p.primary,
              color: '#fff', fontSize: 9, fontWeight: 600, borderRadius: 4,
              padding: '1px 5px', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1,
            }}>
              {ROLE_LABELS[role] || role}
            </span>
          </div>
        </div>
        <div onClick={handleLogout} style={{
          padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
          color: 'rgba(255,100,100,0.8)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.color = '#FF6B6B'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,100,100,0.8)'}
        >
          <span>↩</span> Sign out
        </div>
        <div style={{ background: p.sidebarActive, borderRadius: 5, padding: '3px 8px', textAlign: 'center', margin: '6px 12px 0' }}>
          <p style={{ color: p.sidebarText, fontSize: 10, margin: 0, fontWeight: 500 }}>{APP_VERSION}</p>
        </div>
      </div>
    </div>
  );
}