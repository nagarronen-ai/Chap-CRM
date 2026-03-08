import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid email or password');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#E5E1D8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ background: '#FFFFFF', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 16, padding: 48, width: 400, boxShadow: '0 4px 24px rgba(62,66,61,0.08)' }}>
        <p style={{ color: '#8E9B8B', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 12px' }}>Planfor</p>
        <h1 style={{ color: '#3E423D', margin: '0 0 8px', fontSize: 34, fontWeight: 600, fontStyle: 'italic', fontFamily: "'Playfair Display', Georgia, serif" }}>Planfor CRM</h1>
        <p style={{ color: '#5A6059', margin: '0 0 36px', fontSize: 14 }}>Sign in to manage your leads</p>
        {error && <div style={{ background: '#fdf0f0', border: '1px solid #D4183D', color: '#D4183D', padding: '10px 14px', borderRadius: 8, marginBottom: 20, fontSize: 13 }}>{error}</div>}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: '#717182', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" required style={{ width: '100%', background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '11px 14px', color: '#3E423D', fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
          </div>
          <div style={{ marginBottom: 28 }}>
            <label style={{ color: '#717182', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Password</label>
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" required style={{ width: '100%', background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '11px 14px', color: '#3E423D', fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
          </div>
          <button type="submit" disabled={loading}
            style={{ width: '100%', background: '#8E9B8B', color: '#FFFFFF', border: 'none', borderRadius: 8, padding: '13px', fontSize: 13, fontWeight: 500, cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase' }}
            onMouseOver={e => e.target.style.background = '#7A8677'}
            onMouseOut={e => e.target.style.background = '#8E9B8B'}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;