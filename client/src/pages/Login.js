// client/src/pages/Login.js
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { PALETTES } from '../context/AppContext';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Read cached settings for branding — falls back to sage defaults
  const cached = (() => { try { return JSON.parse(localStorage.getItem('appSettings') || '{}'); } catch { return {}; } })();
  const p = PALETTES[cached.palette || 'sage'] || PALETTES.sage;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/login`, { email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      // Fetch and cache settings
      try {
        const settingsRes = await axios.get(`${API}/settings`, {
          headers: { Authorization: `Bearer ${res.data.token}` }
        });
        localStorage.setItem('appSettings', JSON.stringify(settingsRes.data));
        // Redirect to onboarding if not completed
        if (!settingsRes.data.onboarding_completed) {
          navigate('/onboarding');
          return;
        }
      } catch (err) {}
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${p.background} 0%, ${p.backgroundSecondary} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        background: p.cardBg, borderRadius: 20, padding: 48, width: 400,
        boxShadow: p.isDark ? '0 4px 40px rgba(0,0,0,0.4)' : '0 4px 24px rgba(62,66,61,0.1)',
        border: `1px solid ${p.cardBorder}`,
      }}>
        {/* Logo / branding */}
        <div style={{ marginBottom: 32 }}>
          <img
            src={cached.logo_url || '/logo.png'}
            alt={cached.company_name || 'QPoint'}
            style={{ height: 40, maxWidth: 180, objectFit: 'contain', marginBottom: 12, display: 'block' }}
          />
          <h1 style={{ color: p.text, fontSize: 26, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>
            Welcome back
          </h1>
        </div>

        {error && (
          <div style={{ background: '#fdf0f0', border: '1px solid #D4183D', borderRadius: 8, padding: '10px 14px', color: '#D4183D', fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: p.textSecondary, fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${p.inputBorder}`, background: p.inputBg, color: p.text, fontSize: 14, boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' }}
            />
          </div>
          <div style={{ marginBottom: 28 }}>
            <label style={{ color: p.textSecondary, fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${p.inputBorder}`, background: p.inputBg, color: p.text, fontSize: 14, boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' }}
            />
          </div>
          <button type="submit" disabled={loading}
            style={{ width: '100%', background: loading ? p.textMuted : p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', transition: 'background 0.2s' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ color: p.textMuted, fontSize: 11, textAlign: 'center', marginTop: 24, marginBottom: 0 }}>
          Powered by <strong style={{ color: p.primary }}>QPoint</strong>
        </p>
      </div>
    </div>
  );
}