import { useNavigate, useLocation } from 'react-router-dom';

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const navItem = (label, path, icon) => {
    const active = location.pathname === path;
    return (
      <div onClick={() => navigate(path)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 8, cursor: 'pointer', marginBottom: 4, background: active ? '#F5F3EF' : 'transparent', color: active ? '#94B0BC' : '#5A6059', fontSize: 14, fontWeight: active ? 600 : 400, transition: 'all 0.15s' }}
        onMouseOver={e => { if (!active) e.currentTarget.style.background = '#F5F3EF' }}
        onMouseOut={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
      >
        <span style={{ fontSize: 16 }}>{icon}</span>
        {label}
      </div>
    );
  };

  return (
    <div style={{ width: 240, minHeight: '100vh', background: '#FFFFFF', borderRight: '1px solid rgba(62,66,61,0.1)', display: 'flex', flexDirection: 'column', padding: '24px 16px', fontFamily: "'Inter', sans-serif", position: 'fixed', top: 0, left: 0 }}>
      <div style={{ marginBottom: 32 }}>
        <p style={{ color: '#8E9B8B', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 4px', paddingLeft: 16 }}>Planfor</p>
        <h2 style={{ color: '#3E423D', fontSize: 20, fontWeight: 600, fontStyle: 'italic', fontFamily: "'Playfair Display', Georgia, serif", margin: 0, paddingLeft: 16 }}>CRM</h2>
      </div>

      <nav style={{ flex: 1 }}>
        <p style={{ color: '#717182', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 8px', paddingLeft: 16 }}>Menu</p>
        {navItem('Dashboard', '/dashboard', '📊')}
        {navItem('Contacts', '/contacts', '👥')}
        {navItem('Import', '/import', '📥')}
      </nav>

      <div style={{ borderTop: '1px solid rgba(62,66,61,0.1)', paddingTop: 16 }}>
        <p style={{ color: '#3E423D', fontSize: 13, fontWeight: 500, margin: '0 0 4px', paddingLeft: 16 }}>{user.name || 'User'}</p>
        <p style={{ color: '#717182', fontSize: 12, margin: '0 0 12px', paddingLeft: 16 }}>{user.email || ''}</p>
        <div onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 8, cursor: 'pointer', color: '#D4183D', fontSize: 14 }}
          onMouseOver={e => e.currentTarget.style.background = '#fdf0f0'}
          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
        >
          <span>🚪</span> Logout
        </div>
      </div>
    </div>
  );
}

export default Sidebar;