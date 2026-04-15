import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

export const PALETTES = {
  sage: {
    name: 'Sage', description: 'Natural & calm', emoji: '🌿',
    background: '#F5F3EF', backgroundSecondary: '#E5E1D8',
    sidebar: '#3E423D', sidebarText: 'rgba(255,255,255,0.7)', sidebarActive: 'rgba(255,255,255,0.12)',
    primary: '#8E9B8B', primaryHover: '#7A8A77', accent: '#D4A574',
    text: '#3E423D', textSecondary: '#717182', textMuted: '#CBCED4',
    cardBg: '#ffffff', cardBorder: 'rgba(62,66,61,0.08)',
    inputBg: '#F3F3F5', inputBorder: 'rgba(62,66,61,0.15)', isDark: false,
  },
  ocean: {
    name: 'Ocean', description: 'Clean & professional', emoji: '🌊',
    background: '#F0F4F8', backgroundSecondary: '#DDE6EF',
    sidebar: '#1B3A5C', sidebarText: 'rgba(255,255,255,0.7)', sidebarActive: 'rgba(255,255,255,0.12)',
    primary: '#2E86AB', primaryHover: '#246d8c', accent: '#F4A261',
    text: '#1B2B3A', textSecondary: '#4A6278', textMuted: '#A0B4C4',
    cardBg: '#ffffff', cardBorder: 'rgba(27,58,92,0.08)',
    inputBg: '#EBF2F8', inputBorder: 'rgba(27,58,92,0.15)', isDark: false,
  },
  midnight: {
    name: 'Midnight', description: 'Dark & bold', emoji: '🌙',
    background: '#1A1D2E', backgroundSecondary: '#12141F',
    sidebar: '#0D0F1A', sidebarText: 'rgba(255,255,255,0.6)', sidebarActive: 'rgba(255,255,255,0.1)',
    primary: '#6C63FF', primaryHover: '#5a52e0', accent: '#FF6B6B',
    text: '#E8E9F0', textSecondary: '#9899A8', textMuted: '#4A4B58',
    cardBg: '#22253A', cardBorder: 'rgba(255,255,255,0.06)',
    inputBg: '#2A2D42', inputBorder: 'rgba(255,255,255,0.1)', isDark: true,
  },
  rose: {
    name: 'Rose', description: 'Warm & modern', emoji: '🌸',
    background: '#FDF6F0', backgroundSecondary: '#F5E8DC',
    sidebar: '#3D1C2E', sidebarText: 'rgba(255,255,255,0.7)', sidebarActive: 'rgba(255,255,255,0.12)',
    primary: '#C9184A', primaryHover: '#a8143d', accent: '#FF9F1C',
    text: '#2D1015', textSecondary: '#7A4050', textMuted: '#C4A0A8',
    cardBg: '#ffffff', cardBorder: 'rgba(61,28,46,0.08)',
    inputBg: '#FBF0EA', inputBorder: 'rgba(61,28,46,0.15)', isDark: false,
  },
};

export const B2B_LABELS = {
  companies: 'Companies', company: 'Company',
  contacts: 'Contacts', contact: 'Contact',
  pipeline: 'Pipeline', deals: 'Deals', deal: 'Deal',
  customers: 'Leads', customer: 'Lead',
};

export const B2C_LABELS = {
  companies: 'Customers', company: 'Customer',
  contacts: 'People', contact: 'Person',
  pipeline: 'Pipeline', deals: 'Orders', deal: 'Order',
  customers: 'Customers', customer: 'Customer',
};

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem('appSettings') || '{}'); }
    catch { return {}; }
  });

  const paletteKey = settings.palette || 'sage';
  const palette = PALETTES[paletteKey] || PALETTES.sage;
  const labels = settings.business_type === 'b2c' ? B2C_LABELS : B2B_LABELS;

  const refreshSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await axios.get(`${API}/settings`, { headers: { Authorization: `Bearer ${token}` } });
      setSettings(res.data);
      localStorage.setItem('appSettings', JSON.stringify(res.data));
    } catch (err) { console.error('Failed to load settings:', err); }
  };

  useEffect(() => { if (localStorage.getItem('token')) refreshSettings(); }, []);

  useEffect(() => {
    const root = document.documentElement;
    Object.entries({
      '--bg': palette.background, '--bg-secondary': palette.backgroundSecondary,
      '--sidebar': palette.sidebar, '--sidebar-text': palette.sidebarText,
      '--sidebar-active': palette.sidebarActive, '--primary': palette.primary,
      '--primary-hover': palette.primaryHover, '--accent': palette.accent,
      '--text': palette.text, '--text-secondary': palette.textSecondary,
      '--text-muted': palette.textMuted, '--card-bg': palette.cardBg,
      '--card-border': palette.cardBorder, '--input-bg': palette.inputBg,
      '--input-border': palette.inputBorder,
    }).forEach(([k, v]) => root.style.setProperty(k, v));
  }, [palette]);

  return (
    <AppContext.Provider value={{ settings, setSettings, palette, paletteKey, labels, refreshSettings }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}