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

  const detectAndDecodeFile = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bytes = new Uint8Array(evt.target.result);
        if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
          resolve(new TextDecoder('utf-8').decode(bytes.slice(3)));
          return;
        }
        const utf8Text = new TextDecoder('utf-8').decode(bytes);
        const hasValidHebrew = /[\u05D0-\u05EA]/.test(utf8Text);
        const hasGarbled = /[\uFFFD]/.test(utf8Text);
        if (hasValidHebrew && !hasGarbled) { resolve(utf8Text); return; }
        try {
          const win1255Text = new TextDecoder('windows-1255').decode(bytes);
          resolve(win1255Text);
        } catch { resolve(utf8Text); }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const text = await detectAndDecodeFile(file);
    const data = parseCSV(text);
    setRows(data);
    const sel = {}; data.forEach((_, i) => sel[i] = true); setSelected(sel);
    setStep(2);
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
    let created = 0, skipped = 0, duplicates = 0, peopleAdded = 0;
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
        else {
          try {
            const res = await axios.post(`${API}/contacts/companies`, companyPayload, { headers });
            companyId = res.data.id; created++;
          } catch (err) {
            if (err.response?.status === 409) {
              // Company already exists — use existing company and still import people
              companyId = err.response.data.existing.id;
              duplicates++;
            } else {
              throw err;
            }
          }
        }
        for (const row of group.people) {
          const personPayload = {};
          ['First Name','Last Name','Title','Email','Work Direct Phone','Mobile Phone','Person Linkedin Url','Apollo Contact Id'].forEach(col => {
            const dbCol = FIELD_MAP[col]; if (row[col]) personPayload[dbCol] = row[col];
          });
          if (personPayload.first_name || personPayload.email) {
            try {
              await axios.post(`${API}/contacts/companies/${companyId}/people`, personPayload, { headers });
              peopleAdded++;
            } catch (err) {
              if (err.response?.status !== 409) throw err;
              // person already exists — skip silently
            }
          }
        }
      } catch (err) { console.error('Import error:', err); skipped++; }
    }
    setImportResult({ created, skipped, duplicates, peopleAdded });
    setImporting(false); setStep(4);
  };

  const downloadSample = () => {
    const rows = [
      'Company Name,First Name,Last Name,Email,Title,Mobile Phone,Company City,Company Country',
      'Acme Ltd,David,Cohen,david@acme.com,CEO,050-1234567,Tel Aviv,Israel',
      'Acme Ltd,Sarah,Levi,sarah@acme.com,CTO,050-7654321,Tel Aviv,Israel',
      '\u05D1\u05DC\u05D5\u05DD \u05D0\u05D9\u05E8\u05D5\u05E2\u05D9\u05DD,\u05D9\u05D5\u05E1\u05D9,\u05DB\u05D4\u05DF,yosi@bloom.co.il,\u05DE\u05E0\u05D4\u05DC,052-9876543,\u05D7\u05D9\u05E4\u05D4,\u05D9\u05E9\u05E8\u05D0\u05DC',
      '\u05D1\u05DC\u05D5\u05DD \u05D0\u05D9\u05E8\u05D5\u05E2\u05D9\u05DD,\u05DE\u05D9\u05DB\u05DC,\u05DC\u05D5\u05D9,michal@bloom.co.il,\u05E8\u05DB\u05D6\u05EA,052-1112233,\u05D7\u05D9\u05E4\u05D4,\u05D9\u05E9\u05E8\u05D0\u05DC',
      'Global Tech,John,Smith,john@globaltech.com,VP Sales,+1-555-0101,New York,United States',
    ].join('\n');
    const blob = new Blob(['\uFEFF' + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'chap-crm-example.csv'; a.click();
    URL.revokeObjectURL(url);
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

        {/* STEP 1 */}
        {step === 1 && (
          <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>

            {/* Upload card */}
            <div style={{ background: p.cardBg, borderRadius: 12, padding: 40, border: `1px solid ${p.cardBorder}`, flex: '0 0 480px' }}>
              <h2 style={{ color: p.text, fontSize: 20, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 8px' }}>Upload your CSV</h2>
              <p style={{ color: p.textSecondary, fontSize: 14, margin: '0 0 28px' }}>Upload a CSV from any source. We'll map all fields automatically.</p>
              <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
                <div>
                  <label style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Default Stage</label>
                  <select value={stage} onChange={e => setStage(e.target.value)} style={{ ...inputStyle, width: 180 }}>
                    {['New', 'Contacted', 'No Reply', 'Follow-up', 'Meeting Scheduled', 'Proposal Offered', 'Agreement Sent', 'Closed Won', 'Closed Lost', 'Not Interested'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Origin</label>
                  <select value={origin} onChange={e => setOrigin(e.target.value)} style={{ ...inputStyle, width: 160 }}>
                    {['Upload', 'Cold', 'Hot', 'Instagram', 'Google', 'Referral'].map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>
              <label style={{ display: 'block', background: p.inputBg, border: `2px dashed ${p.inputBorder}`, borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📥</div>
                <p style={{ color: p.text, fontSize: 15, fontWeight: 500, margin: '0 0 4px' }}>Click to upload CSV</p>
                <p style={{ color: p.textSecondary, fontSize: 13, margin: 0 }}>Excel · Google Sheets · Apollo.io · HubSpot · Pipedrive (Hebrew ✓)</p>
                <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
              </label>
            </div>

            {/* Guide panel */}
            <div style={{ flex: 1, background: p.cardBg, border: `1px solid ${p.cardBorder}`, borderRadius: 12, padding: 28, maxHeight: '80vh', overflowY: 'auto' }}>
              <p style={{ color: p.text, fontWeight: 600, fontSize: 15, margin: '0 0 20px' }}>📋 How to prepare your CSV</p>

              <div style={{ marginBottom: 20 }}>
                <p style={{ color: p.text, fontWeight: 600, fontSize: 13, margin: '0 0 8px' }}>Step 1 — Prepare your CSV file</p>
                <p style={{ color: p.textSecondary, fontSize: 12, margin: '0 0 10px', lineHeight: 1.5 }}>Your file must be saved as <strong style={{ color: p.text }}>.csv format</strong>. Here's how to export from each source:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { icon: '📊', name: 'Excel', tip: 'File → Save As → choose "CSV UTF-8 (Comma delimited)" — important: choose UTF-8 not regular CSV for Hebrew support' },
                    { icon: '🌐', name: 'Google Sheets', tip: 'File → Download → Comma Separated Values (.csv) — Google Sheets always exports UTF-8, Hebrew works automatically' },
                    { icon: '🚀', name: 'Apollo.io', tip: 'Select contacts → Export → CSV. Apollo column names are auto-mapped by the importer' },
                    { icon: '🔄', name: 'HubSpot', tip: 'Contacts → Export → select fields → download CSV' },
                    { icon: '📱', name: 'Pipedrive', tip: 'Contacts → ··· → Export data → CSV' },
                    { icon: '📞', name: 'Phone / WhatsApp', tip: 'Export contacts from your phone as vCard (.vcf), then use a free online converter to turn it into CSV' },
                  ].map(({ icon, name, tip }) => (
                    <div key={name} style={{ background: p.inputBg, borderRadius: 8, padding: '8px 12px' }}>
                      <p style={{ color: p.text, fontSize: 12, fontWeight: 600, margin: '0 0 2px' }}>{icon} {name}</p>
                      <p style={{ color: p.textSecondary, fontSize: 11, margin: 0, lineHeight: 1.5 }}>{tip}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <p style={{ color: p.text, fontWeight: 600, fontSize: 13, margin: '0 0 8px' }}>Step 2 — Required columns</p>
                <p style={{ color: p.textSecondary, fontSize: 12, margin: '0 0 8px', lineHeight: 1.5 }}>Column names must match exactly (case sensitive):</p>
                <div style={{ background: p.inputBg, borderRadius: 8, padding: '10px 14px' }}>
                  {[
                    ['Company Name', 'The company this contact belongs to'],
                    ['First Name', 'Contact first name'],
                    ['Last Name', 'Contact last name'],
                    ['Email', 'Contact email address'],
                    ['Work Direct Phone', 'Work phone number'],
                    ['Mobile Phone', 'Mobile number'],
                    ['Title', 'Job title'],
                    ['Company City', 'City'],
                    ['Company Country', 'Country'],
                  ].map(([col, desc]) => (
                    <div key={col} style={{ display: 'flex', gap: 10, padding: '4px 0', borderBottom: `1px solid ${p.cardBorder}` }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: p.primary, minWidth: 150, flexShrink: 0 }}>{col}</span>
                      <span style={{ fontSize: 11, color: p.textSecondary }}>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 20, background: 'rgba(99,190,139,0.08)', border: '1px solid rgba(99,190,139,0.25)', borderRadius: 8, padding: '12px 14px' }}>
                <p style={{ color: p.text, fontWeight: 600, fontSize: 12, margin: '0 0 4px' }}>🇮🇱 Hebrew files</p>
                <p style={{ color: p.textSecondary, fontSize: 11, lineHeight: 1.6, margin: 0 }}>Hebrew is fully supported. When saving from Excel, always choose <strong style={{ color: p.text }}>"CSV UTF-8"</strong> — not regular CSV. Google Sheets exports work automatically. The importer auto-detects the encoding.</p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <p style={{ color: p.text, fontWeight: 600, fontSize: 13, margin: '0 0 8px' }}>Example CSV structure</p>
                <div style={{ background: p.inputBg, borderRadius: 8, padding: '10px 14px', overflowX: 'auto' }}>
                  <pre style={{ fontFamily: 'monospace', fontSize: 10, color: p.textSecondary, margin: 0, lineHeight: 1.8 }}>{`Company Name,First Name,Last Name,Email,Title
Acme Ltd,David,Cohen,david@acme.com,CEO
Acme Ltd,Sarah,Levi,sarah@acme.com,CTO
\u05D1\u05DC\u05D5\u05DD \u05D0\u05D9\u05E8\u05D5\u05E2\u05D9\u05DD,\u05D9\u05D5\u05E1\u05D9,\u05DB\u05D4\u05DF,yosi@bloom.co.il,\u05DE\u05E0\u05D4\u05DC`}</pre>
                </div>
                <p style={{ color: p.textSecondary, fontSize: 11, margin: '6px 0 0' }}>💡 Multiple people from the same company are grouped automatically — no duplicates created.</p>
              </div>

              <div style={{ borderTop: `1px solid ${p.cardBorder}`, paddingTop: 16 }}>
                <p style={{ color: p.text, fontWeight: 600, fontSize: 13, margin: '0 0 6px' }}>📥 Download example CSV</p>
                <p style={{ color: p.textSecondary, fontSize: 11, margin: '0 0 10px' }}>Includes Hebrew + English rows ready to upload.</p>
                <button onClick={downloadSample} style={{ width: '100%', background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  ⬇ Download sample CSV
                </button>
              </div>
            </div>

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
              <button onClick={proceedToImport} disabled={importing} style={{ background: importing ? p.textMuted : p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, cursor: importing ? 'not-allowed' : 'pointer' }}>
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
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 32, flexWrap: 'wrap' }}>
              <div style={{ background: p.inputBg, borderRadius: 10, padding: '16px 24px', textAlign: 'center' }}>
                <p style={{ color: p.primary, fontSize: 28, fontWeight: 700, margin: '0 0 4px' }}>{importResult.created}</p>
                <p style={{ color: p.textSecondary, fontSize: 12, margin: 0 }}>Companies Created</p>
              </div>
              <div style={{ background: p.inputBg, borderRadius: 10, padding: '16px 24px', textAlign: 'center' }}>
                <p style={{ color: '#4CAF50', fontSize: 28, fontWeight: 700, margin: '0 0 4px' }}>{importResult.peopleAdded}</p>
                <p style={{ color: p.textSecondary, fontSize: 12, margin: 0 }}>Contacts Added</p>
              </div>
              <div style={{ background: p.inputBg, borderRadius: 10, padding: '16px 24px', textAlign: 'center' }}>
                <p style={{ color: '#D4A574', fontSize: 28, fontWeight: 700, margin: '0 0 4px' }}>{importResult.duplicates}</p>
                <p style={{ color: p.textSecondary, fontSize: 12, margin: 0 }}>Duplicates Skipped</p>
              </div>
              <div style={{ background: p.inputBg, borderRadius: 10, padding: '16px 24px', textAlign: 'center' }}>
                <p style={{ color: p.textSecondary, fontSize: 28, fontWeight: 700, margin: '0 0 4px' }}>{importResult.skipped}</p>
                <p style={{ color: p.textSecondary, fontSize: 12, margin: 0 }}>Errors</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => navigate('/contacts')} style={{ flex: 1, background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>
                View Companies →
              </button>
              <button onClick={() => { setStep(1); setRows([]); setGrouped([]); setImportResult(null); }} style={{ flex: 1, background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>
                Import Another
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}