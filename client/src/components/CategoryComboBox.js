import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { B2B_CATEGORIES, B2C_CATEGORIES } from '../pages/CompanyProfile';

export default function CategoryComboBox({ value, onChange, style }) {
  const { palette: p, settings } = useApp();
  const CATEGORIES = settings.business_type === 'b2c' ? B2C_CATEGORIES : B2B_CATEGORIES;
  const allSuggestions = Object.keys(CATEGORIES);

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(value || '');
  const ref = useRef(null);

  useEffect(() => { setInput(value || ''); }, [value]);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = input
    ? allSuggestions.filter(s => s.toLowerCase().includes(input.toLowerCase()))
    : allSuggestions;

  const handleSelect = (val) => {
    setInput(val);
    onChange(val);
    setOpen(false);
  };

  const handleChange = (e) => {
    setInput(e.target.value);
    onChange(e.target.value);
    setOpen(true);
  };

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <input
        value={input}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        placeholder="Type or select a category..."
        style={{ width: '100%', background: p.inputBg, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '9px 12px', color: p.text, fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }}
      />
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: p.cardBg, border: `1px solid ${p.cardBorder}`, borderRadius: 8, zIndex: 1000, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', marginTop: 4 }}>
          {filtered.map(s => (
            <div key={s} onClick={() => handleSelect(s)}
              style={{ padding: '9px 14px', fontSize: 13, color: p.text, cursor: 'pointer' }}
              onMouseOver={e => e.currentTarget.style.background = p.inputBg}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
              {s}
            </div>
          ))}
          {input && !allSuggestions.find(s => s.toLowerCase() === input.toLowerCase()) && (
            <div onClick={() => handleSelect(input)}
              style={{ padding: '9px 14px', fontSize: 13, color: p.primary, cursor: 'pointer', borderTop: `1px solid ${p.cardBorder}` }}
              onMouseOver={e => e.currentTarget.style.background = p.inputBg}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
              + Use "{input}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}