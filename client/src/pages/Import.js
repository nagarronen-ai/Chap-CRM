import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useApp } from '../context/AppContext';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const FIELD_MAP = {
  'Company Name': 'company_name', 'Company Name for Emails': 'company_name',
  'Website': 'website', 'Industry': 'industry', '# Employees': 'employees',
  'Annual Revenue': 'annual_revenue', 'Keywords': 'keywords',
  'Company City': 'city', 'Company State': 'state', 'Company Country': 'country',
  'Company Address': 'company_address', 'Company Linkedin Url': 'company_linkedin',
  'Facebook Url': 'facebook_url', 'Twitter Url': 'twitter_url',
  'Apollo Account Id': 'apollo_account_id', 'First Name': 'first_name',
  'Last Name': 'last_name', 'Title': 'title', 'Email': 'email',
  'Work Direct Phone': 'work_phone', 'Mobile Phone': 'mobile_phone',
  'Person Linkedin Url': 'linkedin_url', 'Apollo Contact Id': 'apollo_contact_id',
};

export default function Import() {
  const { palette: p } = useApp();
  const [step, setStep] = useState(1);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState({});
  const [grouped, setGrouped] = useState([]);
  const [conflictDecisions, setConflictDecisions] = useState({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [origin, setOrigin] = useState('Upload');
  const [stage, setStage] = useState('New');
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const inputStyle = { background: p.inputBg, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '9px 12px', color: p.text, fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif' };

  const parseCSV = (text) => {
    const result = [];
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const parseRow = (line) => {
      const fields = []; let field = ''; let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { if (inQuotes && line[i + 1] === '"') { field += '"'; i++; } else { inQuotes = !inQuotes; } }
        else if (ch === ',' && !inQuotes) { fields.push(field.trim()); field = ''; }
        else { field += ch; }
      }
      fields.push(field.trim());
      return fields;
    };
    const csvHeaders = parseRow(lines[0]);
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = parseRow(lines[i]);
      const row = {};
      csvHeaders.forEach((h, j) => { row[h] = values[j] || ''; });
      result.push(row);
    }
    return result;
  };

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = parseCSV(evt.target.result);
      setRows(data);
      const sel = {}; data.forEach((_, i) => sel[i] = true); setSelected(sel);
      setStep(2);
    };
    reader.readAsText(file);
  };

  const groupRows = () => {
    const selectedRows = rows.filter((_, i) => selected[i]);
    const groups = {};
    selectedRows.forEach(row => {
      const companyName = row['Company Name'] || row['Company Name for Emails'] || 'Unknown';
      if (!groups[companyName]) groups[companyName] = [];
      groups[companyName].push(row);
    });
    setGrouped(Object.entries(groups).map(([name, people]) => ({ name, people })));
    setStep(3);
  };

  const proceedToImport = async () => {
    setImporting(true);
    let created = 0, skipped = 0;
    for (const group of grouped) {
      const decision = conflictDecisions[group.name];
      if (decision === 'skip') { skipped++; continue; }
      const firstRow = group.people[0];
      const companyPayload = {};
      Object.entries(FIELD_MAP).forEach(([csvCol, dbCol]) => {
        if (['first_name','last_name','title','email','work_phone','mobile_phone','linkedin_url','apollo_contact_id'].includes(dbCol)) return;
        if (firstRow[csvCol]) companyPayload[dbCol] = firstRow[csvCol];
      });
      companyPayload.origin = origin; companyPayload.stage = stage;
      try {
        let companyId;
        if (decision === 'add') { companyId = decision.existingId; }
        else { const res = await axios.post(`${API}/contacts/companies`, companyPayload, { headers }); companyId = res.data.id; created++; }
        for (const row of group.people) {
          const personPayload = {};
          ['First Name','Last Name','Title','Email','Work Direct Phone','Mobile Phone','Person Linkedin Url','Apollo Contact Id'].forEach(col => {
            const dbCol = FIELD_MAP[col]; if (row[col]) personPayload[dbCol] = row[col];
          });
          if (personPayload.first_name || personPayload.email) {
            await axios.post(`${API}/contacts/companies/${companyId}/people`, personPayload, { headers });
          }
        }
      } catch (err) { console.error('Import error:', err); skipped++; }
    }
    setImportResult({ created, skipped });
    setImporting(false); setStep(4);
  };

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: p.background, minHeight: '100vh', transition: 'background 0.4s' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: 40 }}>

        <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>Data</p>
        <h1 style={{ color: p.text, fontSize: 30, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 32px' }}>Import CSV</h1>

        {/* Progress Steps */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 36, alignItems: 'center' }}>
          {['Upload File', 'Select Rows', 'Review Groups', 'Done'].map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: step > i + 1 ? p.primary : step === i + 1 ? p.text : p.inputBorder, color: step >= i + 1 ? '#fff' : p.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span style={{ color: step === i + 1 ? p.text : p.textSecondary, fontSize: 13, fontWeight: step === i + 1 ? 600 : 400 }}>{s}</span>
              {i < 3 && <div style={{ width: 32, height: 1, background: p.inputBorder }} />}
            </div>
          ))}
        </div>

        {/* STEP 1 - Upload */}
        {step === 1 && (
          <div style={{ background: p.cardBg, borderRadius: 12, padding: 40, border: `1px solid ${p.cardBorder}`, maxWidth: 560 }}>
            <h2 style={{ color: p.text, fontSize: 20, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 8px' }}>Upload your Apollo CSV</h2>
            <p style={{ color: p.textSecondary, fontSize: 14, margin: '0 0 28px' }}>Upload a CSV exported from Apollo.io. We'll map all fields automatically.</p>
            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
              <div>
                <label style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Default Stage</label>
                <select value={stage} onChange={e => setStage(e.target.value)} style={{ ...inputStyle, width: 180 }}>
                  {['New', 'Contacted', 'No Reply', 'Follow-up', 'Meeting Scheduled', 'Proposal Offered', 'Agreement Sent', 'Closed Won', 'Closed Lost', 'Not Interested'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Origin</label>
                <select value={origin} onChange={e => setOrigin(e.target.value)} style={{ ...inputStyle, width: 160 }}>
                  {['Upload', 'Cold', 'Hot', 'Instagram', 'Google', 'Referral'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <label style={{ display: 'block', background: p.inputBg, border: `2px dashed ${p.inputBorder}`, borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📥</div>
              <p style={{ color: p.text, fontSize: 15, fontWeight: 500, margin: '0 0 4px' }}>Click to upload CSV</p>
              <p style={{ color: p.textSecondary, fontSize: 13, margin: 0 }}>Apollo.io export format supported</p>
              <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
            </label>
          </div>
        )}

        {/* STEP 2 - Select Rows */}
        {step === 2 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{ color: p.textSecondary, fontSize: 13, margin: 0 }}>{rows.length} rows found · {Object.values(selected).filter(Boolean).length} selected</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { const s = {}; rows.forEach((_, i) => s[i] = true); setSelected(s); }} style={{ ...inputStyle, cursor: 'pointer', padding: '8px 14px' }}>Select All</button>
                <button onClick={() => { const s = {}; rows.forEach((_, i) => s[i] = false); setSelected(s); }} style={{ ...inputStyle, cursor: 'pointer', padding: '8px 14px' }}>Deselect All</button>
                <button onClick={groupRows} style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>
                  Continue → ({Object.values(selected).filter(Boolean).length} rows)
                </button>
              </div>
            </div>
            <div style={{ background: p.cardBg, borderRadius: 12, border: `1px solid ${p.cardBorder}`, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0 }}>
                    <tr style={{ background: p.inputBg, borderBottom: `1px solid ${p.cardBorder}` }}>
                      <th style={{ padding: '12px 16px', width: 40 }}>
                        <input type="checkbox" checked={Object.values(selected).every(Boolean)} onChange={e => { const s = {}; rows.forEach((_, i) => s[i] = e.target.checked); setSelected(s); }} style={{ accentColor: p.primary }} />
                      </th>
                      {['Name', 'Title', 'Company', 'Email', 'Phone', 'Location'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: p.textSecondary, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${p.cardBorder}`, background: selected[i] ? p.cardBg : p.backgroundSecondary, opacity: selected[i] ? 1 : 0.4 }}>
                        <td style={{ padding: '10px 16px' }}><input type="checkbox" checked={!!selected[i]} onChange={e => setSelected({ ...selected, [i]: e.target.checked })} style={{ accentColor: p.primary }} /></td>
                        <td style={{ padding: '10px 16px', color: p.text, fontSize: 13, fontWeight: 500 }}>{row['First Name']} {row['Last Name']}</td>
                        <td style={{ padding: '10px 16px', color: p.textSecondary, fontSize: 13 }}>{row['Title'] || '—'}</td>
                        <td style={{ padding: '10px 16px', color: p.text, fontSize: 13 }}>{row['Company Name'] || '—'}</td>
                        <td style={{ padding: '10px 16px', color: p.primary, fontSize: 13 }}>{row['Email'] || '—'}</td>
                        <td style={{ padding: '10px 16px', color: p.textSecondary, fontSize: 13 }}>{row['Work Direct Phone'] || '—'}</td>
                        <td style={{ padding: '10px 16px', color: p.textSecondary, fontSize: 13 }}>{[row['Company City'], row['Company State']].filter(Boolean).join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 - Review Groups */}
        {step === 3 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{ color: p.textSecondary, fontSize: 13, margin: 0 }}>{grouped.length} companies · {grouped.reduce((acc, g) => acc + g.people.length, 0)} people total</p>
              <button onClick={proceedToImport} disabled={importing}
                style={{ background: importing ? p.textMuted : p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, cursor: importing ? 'not-allowed' : 'pointer' }}>
                {importing ? '⏳ Importing...' : `Import ${grouped.length} Companies →`}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '65vh', overflowY: 'auto' }}>
              {grouped.map((group, i) => (
                <div key={i} style={{ background: p.cardBg, borderRadius: 10, padding: 16, border: `1px solid ${p.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ color: p.text, fontWeight: 600, fontSize: 14, margin: '0 0 4px' }}>{group.name}</p>
                    <p style={{ color: p.textSecondary, fontSize: 12, margin: '0 0 4px' }}>
                      {[group.people[0]['Company City'], group.people[0]['Company State']].filter(Boolean).join(', ')}
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {group.people.map((person, j) => (
                        <span key={j} style={{ background: p.inputBg, color: p.textSecondary, fontSize: 11, borderRadius: 20, padding: '2px 10px' }}>
                          👤 {person['First Name']} {person['Last Name']} {person['Title'] ? `· ${person['Title']}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span style={{ background: p.inputBg, color: p.textSecondary, fontSize: 11, borderRadius: 20, padding: '3px 10px' }}>
                    {group.people.length} {group.people.length === 1 ? 'person' : 'people'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4 - Done */}
        {step === 4 && importResult && (
          <div style={{ background: p.cardBg, borderRadius: 12, padding: 48, border: `1px solid ${p.cardBorder}`, maxWidth: 480, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ color: p.text, fontSize: 26, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 24px' }}>Import Complete!</h2>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 32 }}>
              <div style={{ background: p.inputBg, borderRadius: 10, padding: '16px 24px' }}>
                <p style={{ color: p.primary, fontSize: 28, fontWeight: 700, margin: '0 0 4px' }}>{importResult.created}</p>
                <p style={{ color: p.textSecondary, fontSize: 12, margin: 0 }}>Companies Created</p>
              </div>
              <div style={{ background: p.inputBg, borderRadius: 10, padding: '16px 24px' }}>
                <p style={{ color: p.textSecondary, fontSize: 28, fontWeight: 700, margin: '0 0 4px' }}>{importResult.skipped}</p>
                <p style={{ color: p.textSecondary, fontSize: 12, margin: 0 }}>Skipped</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => navigate('/contacts')} style={{ flex: 1, background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>
                View Companies →
              </button>
              <button onClick={() => { setStep(1); setRows([]); setGrouped([]); setImportResult(null); }}
                style={{ flex: 1, background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>
                Import Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}