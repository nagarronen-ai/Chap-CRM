// client/src/pages/Login.js
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/login`, { email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user)); // now includes role
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#E5E1D8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#F5F3EF', borderRadius: 16, padding: 48, width: 380, boxShadow: '0 4px 24px rgba(62,66,61,0.1)', border: '1px solid rgba(62,66,61,0.1)' }}>
        <p style={{ color: '#8E9B8B', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 4px' }}>Planfor</p>
        <h1 style={{ color: '#3E423D', fontSize: 28, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 32px' }}>Welcome back</h1>

        {error && (
          <div style={{ background: '#fdf0f0', border: '1px solid #D4183D', borderRadius: 8, padding: '10px 14px', color: '#D4183D', fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: '#5A6059', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(62,66,61,0.15)', background: '#F3F3F5', color: '#3E423D', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ color: '#5A6059', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(62,66,61,0.15)', background: '#F3F3F5', color: '#3E423D', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          <button type="submit" disabled={loading}
            style={{ width: '100%', background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}