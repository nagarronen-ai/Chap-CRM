import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { PALETTES } from '../context/AppContext';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const INDUSTRIES = [
  'Technology & SaaS', 'Marketing & Agency', 'Real Estate', 'Healthcare',
  'Finance & Fintech', 'E-commerce & Retail', 'Consulting', 'Education',
  'Legal', 'Manufacturing', 'Media & Entertainment', 'Non-profit', 'Other'
];

const TEAM_SIZES = ['Just me', '2–5', '6–20', '21–50', '50+'];

const STEPS = [
  { number: 1, label: 'Company' },
  { number: 2, label: 'Business' },
  { number: 3, label: 'Brand' },
  { number: 4, label: 'Team' },
  { number: 5, label: 'Launch' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [inviteEmails, setInviteEmails] = useState(['']);
  const [hoveredPalette, setHoveredPalette] = useState(null);
  const logoInputRef = useRef(null);

  const [form, setForm] = useState({
    company_name: '', industry: '', what_you_sell: '',
    business_type: 'b2b', team_size: '', palette: 'sage', logo_url: null,
  });

  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const activePaletteKey = hoveredPalette || form.palette;
  const p = PALETTES[activePaletteKey] || PALETTES.sage;

  const canProceed = () => {
    if (step === 1) return form.company_name.trim() && form.industry;
    if (step === 2) return form.business_type && form.team_size;
    if (step === 3) return form.palette;
    return true;
  };

  const handleLogoUpload = (file) => {
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      let logoUrl = form.logo_url;
      if (logoFile) {
        const fd = new FormData();
        fd.append('logo', logoFile);
        try {
          const res = await axios.post(`${API}/settings/logo`, fd, {
            headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' }
          });
          logoUrl = res.data.url;
        } catch (err) { console.error('Logo upload failed:', err); }
      }

      const savedSettings = { ...form, logo_url: logoUrl, onboarding_completed: true };
      await axios.put(`${API}/settings`, savedSettings, { headers: getHeaders() });

      const validEmails = inviteEmails.filter(e => e.trim() && e.includes('@'));
      if (validEmails.length > 0) {
        await Promise.allSettled(validEmails.map(email =>
          axios.post(`${API}/users/invite`, { email, role: 'viewer' }, { headers: getHeaders() })
        ));
      }

      localStorage.setItem('appSettings', JSON.stringify(savedSettings));
      navigate('/');
      window.location.reload();
    } catch (err) { console.error('Failed to save settings:', err); }
    setSaving(false);
  };

  const inputStyle = {
    width: '100%', padding: '12px 16px',
    border: `1px solid ${p.inputBorder}`, borderRadius: 10,
    fontSize: 14, fontFamily: 'Inter, sans-serif',
    color: p.text, background: p.inputBg,
    outline: 'none', boxSizing: 'border-box', transition: 'all 0.2s',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${p.background} 0%, ${p.backgroundSecondary} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, sans-serif', padding: 24, transition: 'background 0.4s ease',
    }}>
      <div style={{ width: '100%', maxWidth: 580 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'contain' }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: 10, background: p.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: 'Georgia, serif', transition: 'background 0.4s' }}>C</div>
            )}
            <span style={{ fontSize: 20, fontWeight: 700, color: p.text, letterSpacing: -0.5, transition: 'color 0.4s' }}>
              {form.company_name || 'Chap CRM'}
            </span>
          </div>
          <p style={{ color: p.textSecondary, fontSize: 13, margin: 0 }}>Let's set up your workspace</p>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
          {STEPS.map((s, i) => (
            <div key={s.number} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: step > s.number ? p.primary : step === s.number ? p.primary : p.backgroundSecondary,
                  color: step >= s.number ? '#fff' : p.textMuted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, transition: 'all 0.3s',
                }}>{step > s.number ? '✓' : s.number}</div>
                <span style={{ fontSize: 10, color: step >= s.number ? p.primary : p.textMuted, fontWeight: step === s.number ? 600 : 400, transition: 'color 0.4s' }}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width: 48, height: 2, background: step > s.number ? p.primary : p.backgroundSecondary, margin: '0 4px', marginBottom: 18, transition: 'background 0.4s' }} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div style={{
          background: p.cardBg, borderRadius: 20, padding: 40,
          boxShadow: p.isDark ? '0 4px 40px rgba(0,0,0,0.4)' : '0 4px 40px rgba(62,66,61,0.1)',
          border: `1px solid ${p.cardBorder}`, transition: 'all 0.4s ease',
        }}>

          {/* STEP 1 */}
          {step === 1 && (
            <div>
              <h2 style={{ color: p.text, fontSize: 22, fontWeight: 700, margin: '0 0 6px', fontFamily: 'Georgia, serif' }}>Tell us about your company</h2>
              <p style={{ color: p.textSecondary, fontSize: 14, margin: '0 0 28px' }}>This helps Chap personalize your CRM experience.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: p.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Company Name *</label>
                  <input value={form.company_name} onChange={e => updateForm('company_name', e.target.value)} placeholder="e.g. Acme Corp" style={inputStyle} autoFocus />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: p.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Industry *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {INDUSTRIES.map(ind => (
                      <button key={ind} onClick={() => updateForm('industry', ind)} style={{
                        padding: '10px 14px', borderRadius: 8,
                        border: form.industry === ind ? `2px solid ${p.primary}` : `1px solid ${p.cardBorder}`,
                        background: form.industry === ind ? p.primary + '20' : p.inputBg,
                        color: form.industry === ind ? p.primary : p.textSecondary,
                        fontSize: 12, fontWeight: form.industry === ind ? 600 : 400,
                        cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                      }}>{ind}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: p.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>What do you sell?</label>
                  <input value={form.what_you_sell} onChange={e => updateForm('what_you_sell', e.target.value)} placeholder="e.g. SaaS software, consulting services..." style={inputStyle} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div>
              <h2 style={{ color: p.text, fontSize: 22, fontWeight: 700, margin: '0 0 6px', fontFamily: 'Georgia, serif' }}>How do you sell?</h2>
              <p style={{ color: p.textSecondary, fontSize: 14, margin: '0 0 28px' }}>This sets up your pipeline and contact labels.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: p.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Business Type *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { value: 'b2b', title: 'B2B', desc: 'Selling to businesses', icon: '🏢', labels: 'Companies · Leads · Pipeline · Deals' },
                      { value: 'b2c', title: 'B2C', desc: 'Selling to consumers', icon: '👤', labels: 'Customers · Prospects · Orders' },
                    ].map(opt => (
                      <button key={opt.value} onClick={() => updateForm('business_type', opt.value)} style={{
                        padding: '20px', borderRadius: 12,
                        border: form.business_type === opt.value ? `2px solid ${p.primary}` : `1px solid ${p.cardBorder}`,
                        background: form.business_type === opt.value ? p.primary + '15' : p.inputBg,
                        cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                      }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>{opt.icon}</div>
                        <p style={{ color: p.text, fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>{opt.title}</p>
                        <p style={{ color: p.textSecondary, fontSize: 12, margin: '0 0 8px' }}>{opt.desc}</p>
                        <p style={{ color: p.primary, fontSize: 11, margin: 0, fontWeight: 500 }}>{opt.labels}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: p.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Team Size *</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {TEAM_SIZES.map(size => (
                      <button key={size} onClick={() => updateForm('team_size', size)} style={{
                        padding: '10px 20px', borderRadius: 8,
                        border: form.team_size === size ? `2px solid ${p.primary}` : `1px solid ${p.cardBorder}`,
                        background: form.team_size === size ? p.primary : p.inputBg,
                        color: form.team_size === size ? '#fff' : p.textSecondary,
                        fontSize: 13, fontWeight: form.team_size === size ? 600 : 400,
                        cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                      }}>{size}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — Brand & Palette */}
          {step === 3 && (
            <div>
              <h2 style={{ color: p.text, fontSize: 22, fontWeight: 700, margin: '0 0 6px', fontFamily: 'Georgia, serif' }}>Make it yours</h2>
              <p style={{ color: p.textSecondary, fontSize: 14, margin: '0 0 28px' }}>Choose a theme — hover to preview, click to select.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: p.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Color Theme *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {Object.entries(PALETTES).map(([key, pal]) => (
                      <button key={key}
                        onClick={() => updateForm('palette', key)}
                        onMouseEnter={() => setHoveredPalette(key)}
                        onMouseLeave={() => setHoveredPalette(null)}
                        style={{
                          borderRadius: 14, border: form.palette === key ? `2px solid ${pal.primary}` : `1px solid rgba(0,0,0,0.1)`,
                          overflow: 'hidden', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                          transition: 'all 0.2s', background: 'none', padding: 0,
                          transform: form.palette === key ? 'scale(1.02)' : 'scale(1)',
                          boxShadow: form.palette === key ? `0 4px 20px ${pal.primary}40` : 'none',
                        }}>
                        {/* Mini UI preview */}
                        <div style={{ background: pal.background, padding: '14px 14px 10px' }}>
                          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                            <div style={{ width: 32, background: pal.sidebar, borderRadius: 6, height: 44 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ height: 8, background: pal.cardBg, borderRadius: 4, marginBottom: 4, border: `1px solid ${pal.cardBorder}` }} />
                              <div style={{ height: 28, background: pal.cardBg, borderRadius: 6, border: `1px solid ${pal.cardBorder}`, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 4 }}>
                                <div style={{ width: 16, height: 6, background: pal.primary, borderRadius: 3 }} />
                                <div style={{ width: 24, height: 6, background: pal.inputBg, borderRadius: 3 }} />
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <div style={{ height: 6, flex: 1, background: pal.primary, borderRadius: 3 }} />
                            <div style={{ height: 6, flex: 2, background: pal.inputBg, borderRadius: 3 }} />
                            <div style={{ height: 6, width: 16, background: pal.accent, borderRadius: 3 }} />
                          </div>
                        </div>
                        <div style={{ background: pal.cardBg, padding: '10px 14px', textAlign: 'left', borderTop: `1px solid ${pal.cardBorder}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <span style={{ fontSize: 14, marginRight: 6 }}>{pal.emoji}</span>
                              <span style={{ color: pal.text, fontSize: 13, fontWeight: 600 }}>{pal.name}</span>
                            </div>
                            {form.palette === key && (
                              <span style={{ background: pal.primary, color: '#fff', fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>✓</span>
                            )}
                          </div>
                          <p style={{ color: pal.textSecondary, fontSize: 11, margin: '2px 0 0' }}>{pal.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logo */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: p.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Logo (optional)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 72, height: 72, borderRadius: 16, background: p.inputBg, border: `2px dashed ${p.inputBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                      {logoPreview ? <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 24 }}>🏢</span>}
                    </div>
                    <div>
                      <button onClick={() => logoInputRef.current?.click()} style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'block', marginBottom: 6 }}>
                        {logoPreview ? '🔄 Change logo' : '📁 Upload logo'}
                      </button>
                      <p style={{ color: p.textMuted, fontSize: 11, margin: 0 }}>PNG, JPG or SVG · shown in sidebar & login</p>
                    </div>
                    <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleLogoUpload(e.target.files[0])} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div>
              <h2 style={{ color: p.text, fontSize: 22, fontWeight: 700, margin: '0 0 6px', fontFamily: 'Georgia, serif' }}>Invite your team</h2>
              <p style={{ color: p.textSecondary, fontSize: 14, margin: '0 0 28px' }}>Optional — you can always do this later from Settings.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {inviteEmails.map((email, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8 }}>
                    <input value={email} onChange={e => { const u = [...inviteEmails]; u[i] = e.target.value; setInviteEmails(u); }} placeholder={`teammate${i + 1}@company.com`} style={inputStyle} type="email" />
                    {inviteEmails.length > 1 && <button onClick={() => setInviteEmails(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#D4183D', fontSize: 18, cursor: 'pointer', padding: '0 8px' }}>×</button>}
                  </div>
                ))}
                {inviteEmails.length < 5 && (
                  <button onClick={() => setInviteEmails(prev => [...prev, ''])} style={{ background: 'none', border: `1px dashed ${p.primary}`, borderRadius: 10, padding: '10px', color: p.primary, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>+ Add another teammate</button>
                )}
              </div>
            </div>
          )}

          {/* STEP 5 */}
          {step === 5 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🚀</div>
              <h2 style={{ color: p.text, fontSize: 24, fontWeight: 700, margin: '0 0 10px', fontFamily: 'Georgia, serif' }}>
                You're all set{form.company_name ? `, ${form.company_name}` : ''}!
              </h2>
              <p style={{ color: p.textSecondary, fontSize: 14, margin: '0 0 28px', lineHeight: 1.6 }}>Your Chap CRM is ready to go.</p>
              <div style={{ background: p.inputBg, borderRadius: 12, padding: 20, textAlign: 'left', marginBottom: 28 }}>
                {[
                  { icon: '🏢', label: 'Company', value: form.company_name },
                  { icon: '📊', label: 'Industry', value: form.industry },
                  { icon: form.business_type === 'b2b' ? '🏢' : '👤', label: 'Mode', value: form.business_type === 'b2b' ? 'B2B — Companies & Pipeline' : 'B2C — Customers & Orders' },
                  { icon: '👥', label: 'Team size', value: form.team_size },
                  { icon: '🎨', label: 'Theme', value: `${PALETTES[form.palette]?.emoji} ${PALETTES[form.palette]?.name}` },
                ].map(({ icon, label, value }) => value ? (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${p.cardBorder}` }}>
                    <span style={{ color: p.textSecondary, fontSize: 13 }}>{icon} {label}</span>
                    <span style={{ color: p.text, fontSize: 13, fontWeight: 500 }}>{value}</span>
                  </div>
                ) : null)}
              </div>
            </div>
          )}

          {/* Nav buttons */}
          <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)} style={{ flex: 1, background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 10, padding: '13px', fontSize: 14, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>← Back</button>
            )}
            {step < 5 && (
              <button onClick={() => setStep(s => s + 1)} disabled={!canProceed()} style={{ flex: 2, background: canProceed() ? p.primary : p.textMuted, color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 600, cursor: canProceed() ? 'pointer' : 'default', fontFamily: 'Inter, sans-serif', transition: 'background 0.2s' }}>
                {step === 4 ? 'Continue →' : 'Next →'}
              </button>
            )}
            {step === 5 && (
              <button onClick={handleFinish} disabled={saving} style={{ flex: 2, background: saving ? p.textMuted : p.primary, color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
                {saving ? '⏳ Setting up...' : '🚀 Launch Chap CRM'}
              </button>
            )}
          </div>
          {step === 4 && (
            <button onClick={() => setStep(5)} style={{ width: '100%', background: 'none', border: 'none', color: p.textMuted, fontSize: 12, cursor: 'pointer', marginTop: 12, fontFamily: 'Inter, sans-serif' }}>Skip for now</button>
          )}
        </div>
        <p style={{ textAlign: 'center', color: p.textMuted, fontSize: 11, marginTop: 16 }}>You can change these settings anytime from Settings → Company</p>
      </div>
    </div>
  );
}


