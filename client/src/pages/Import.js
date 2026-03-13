import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const FIELD_MAP = {
  'Company Name': 'company_name',
  'Company Name for Emails': 'company_name',
  'Website': 'website',
  'Industry': 'industry',
  '# Employees': 'employees',
  'Annual Revenue': 'annual_revenue',
  'Keywords': 'keywords',
  'Company City': 'city',
  'Company State': 'state',
  'Company Country': 'country',
  'Company Address': 'company_address',
  'Company Linkedin Url': 'company_linkedin',
  'Facebook Url': 'facebook_url',
  'Twitter Url': 'twitter_url',
  'Apollo Account Id': 'apollo_account_id',
  'First Name': 'first_name',
  'Last Name': 'last_name',
  'Title': 'title',
  'Email': 'email',
  'Work Direct Phone': 'work_phone',
  'Mobile Phone': 'mobile_phone',
  'Person Linkedin Url': 'linkedin_url',
  'Apollo Contact Id': 'apollo_contact_id',
};

export default function Import() {
  const [step, setStep] = useState(1);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState({});
  const [grouped, setGrouped] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [conflictDecisions, setConflictDecisions] = useState({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [origin, setOrigin] = useState('Upload');
  const [stage, setStage] = useState('New');
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const parseCSV = (text) => {
    const rows = [];
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const parseRow = (line) => {
      const fields = [];
      let field = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
          fields.push(field.trim());
          field = '';
        } else {
          field += ch;
        }
      }
      fields.push(field.trim());
      return fields;
    };
    const headers = parseRow(lines[0]);
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = parseRow(lines[i]);
      const row = {};
      headers.forEach((h, j) => { row[h] = values[j] || ''; });
      rows.push(row);
    }
    return rows;
  };
  
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = parseCSV(evt.target.result);
      setRows(data);
      const sel = {};
      data.forEach((_, i) => sel[i] = true);
      setSelected(sel);
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
    const groupedArr = Object.entries(groups).map(([name, people]) => ({ name, people }));
    setGrouped(groupedArr);
    setStep(3);
  };

  const proceedToImport = async () => {
    setImporting(true);
    let created = 0, updated = 0, skipped = 0;

    for (const group of grouped) {
      const decision = conflictDecisions[group.name];
      if (decision === 'skip') { skipped++; continue; }

      const firstRow = group.people[0];
      const companyPayload = {};
      Object.entries(FIELD_MAP).forEach(([csvCol, dbCol]) => {
        if (['first_name','last_name','title','email','work_phone','mobile_phone','linkedin_url','apollo_contact_id'].includes(dbCol)) return;
        if (firstRow[csvCol]) companyPayload[dbCol] = firstRow[csvCol];
      });
      companyPayload.origin = origin;
      companyPayload.stage = stage;

      try {
        let companyId;
        if (decision === 'add') {
          companyId = decision.existingId;
        } else {
          const res = await axios.post(`${API}/contacts/companies`, companyPayload, { headers });
          companyId = res.data.id;
          created++;
        }

        for (const row of group.people) {
          const personPayload = {};
          ['First Name','Last Name','Title','Email','Work Direct Phone','Mobile Phone','Person Linkedin Url','Apollo Contact Id'].forEach(col => {
            const dbCol = FIELD_MAP[col];
            if (row[col]) personPayload[dbCol] = row[col];
          });
          if (personPayload.first_name || personPayload.email) {
            await axios.post(`${API}/contacts/companies/${companyId}/people`, personPayload, { headers });
          }
        }
      } catch (err) {
        console.error('Import error:', err);
        skipped++;
      }
    }

    setImportResult({ created, updated, skipped });
    setImporting(false);
    setStep(4);
  };

  const inputStyle = { background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '9px 12px', color: '#3E423D', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif' };

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 240, flex: 1, padding: 40 }}>

        <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>Data</p>
        <h1 style={{ color: '#3E423D', fontSize: 30, fontWeight: 600, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 32px' }}>Import CSV</h1>

        {/* Progress Steps */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 36, alignItems: 'center' }}>
          {['Upload File', 'Select Rows', 'Review Groups', 'Done'].map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: step > i + 1 ? '#8E9B8B' : step === i + 1 ? '#3E423D' : '#E5E1D8', color: step >= i + 1 ? '#fff' : '#717182', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span style={{ color: step === i + 1 ? '#3E423D' : '#717182', fontSize: 13, fontWeight: step === i + 1 ? 600 : 400 }}>{s}</span>
              {i < 3 && <div style={{ width: 32, height: 1, background: '#D5CEC0' }} />}
            </div>
          ))}
        </div>

        {/* STEP 1 - Upload */}
        {step === 1 && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 40, border: '1px solid rgba(62,66,61,0.1)', boxShadow: '0 2px 8px rgba(62,66,61,0.06)', maxWidth: 560 }}>
            <h2 style={{ color: '#3E423D', fontSize: 20, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 8px' }}>Upload your Apollo CSV</h2>
            <p style={{ color: '#717182', fontSize: 14, margin: '0 0 28px' }}>Upload a CSV exported from Apollo.io. We'll map all fields automatically.</p>

            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
              <div>
                <label style={{ color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Default Stage</label>
                <select value={stage} onChange={e => setStage(e.target.value)} style={{ ...inputStyle, width: 180 }}>
                  {['New', 'Contacted', 'No Reply', 'Follow-up', 'Meeting Scheduled', 'Proposal Offered', 'Agreement Sent', 'Closed Won', 'Closed Lost', 'Not Interested'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Origin</label>
                <select value={origin} onChange={e => setOrigin(e.target.value)} style={{ ...inputStyle, width: 160 }}>
                  {['Upload', 'Cold', 'Hot', 'Instagram', 'Google', 'Referral'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>

            <label style={{ display: 'block', background: '#F5F3EF', border: '2px dashed #D5CEC0', borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📥</div>
              <p style={{ color: '#3E423D', fontSize: 15, fontWeight: 500, margin: '0 0 4px' }}>Click to upload CSV</p>
              <p style={{ color: '#717182', fontSize: 13, margin: 0 }}>Apollo.io export format supported</p>
              <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
            </label>
          </div>
        )}

        {/* STEP 2 - Select Rows */}
        {step === 2 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <p style={{ color: '#717182', fontSize: 13, margin: 0 }}>{rows.length} rows found · {Object.values(selected).filter(Boolean).length} selected</p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { const s = {}; rows.forEach((_, i) => s[i] = true); setSelected(s); }}
                  style={{ ...inputStyle, cursor: 'pointer', padding: '8px 14px' }}>Select All</button>
                <button onClick={() => { const s = {}; rows.forEach((_, i) => s[i] = false); setSelected(s); }}
                  style={{ ...inputStyle, cursor: 'pointer', padding: '8px 14px' }}>Deselect All</button>
                <button onClick={groupRows}
                  style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>
                  Continue → ({Object.values(selected).filter(Boolean).length} rows)
                </button>
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(62,66,61,0.06)' }}>
              <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0 }}>
                    <tr style={{ background: '#F5F3EF', borderBottom: '1px solid rgba(62,66,61,0.1)' }}>
                      <th style={{ padding: '12px 16px', width: 40 }}>
                        <input type="checkbox" checked={Object.values(selected).every(Boolean)}
                          onChange={e => { const s = {}; rows.forEach((_, i) => s[i] = e.target.checked); setSelected(s); }} />
                      </th>
                      {['Name', 'Title', 'Company', 'Email', 'Phone', 'Location'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(62,66,61,0.06)', background: selected[i] ? '#fff' : '#fafaf9', opacity: selected[i] ? 1 : 0.4 }}>
                        <td style={{ padding: '10px 16px' }}>
                          <input type="checkbox" checked={!!selected[i]} onChange={e => setSelected({ ...selected, [i]: e.target.checked })} />
                        </td>
                        <td style={{ padding: '10px 16px', color: '#3E423D', fontSize: 13, fontWeight: 500 }}>{row['First Name']} {row['Last Name']}</td>
                        <td style={{ padding: '10px 16px', color: '#717182', fontSize: 13 }}>{row['Title'] || '—'}</td>
                        <td style={{ padding: '10px 16px', color: '#3E423D', fontSize: 13 }}>{row['Company Name'] || '—'}</td>
                        <td style={{ padding: '10px 16px', color: '#94B0BC', fontSize: 13 }}>{row['Email'] || '—'}</td>
                        <td style={{ padding: '10px 16px', color: '#717182', fontSize: 13 }}>{row['Work Direct Phone'] || '—'}</td>
                        <td style={{ padding: '10px 16px', color: '#717182', fontSize: 13 }}>{[row['Company City'], row['Company State']].filter(Boolean).join(', ') || '—'}</td>
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
              <p style={{ color: '#717182', fontSize: 13, margin: 0 }}>{grouped.length} companies · {grouped.reduce((acc, g) => acc + g.people.length, 0)} people total</p>
              <button onClick={proceedToImport} disabled={importing}
                style={{ background: importing ? '#A5B2A3' : '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, cursor: importing ? 'not-allowed' : 'pointer' }}>
                {importing ? '⏳ Importing...' : `Import ${grouped.length} Companies →`}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '65vh', overflowY: 'auto' }}>
              {grouped.map((group, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 10, padding: 16, border: '1px solid rgba(62,66,61,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ color: '#3E423D', fontWeight: 600, fontSize: 14, margin: '0 0 4px' }}>{group.name}</p>
                    <p style={{ color: '#717182', fontSize: 12, margin: '0 0 4px' }}>
                      {[group.people[0]['Company City'], group.people[0]['Company State']].filter(Boolean).join(', ')}
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {group.people.map((p, j) => (
                        <span key={j} style={{ background: '#F5F3EF', color: '#5A6059', fontSize: 11, borderRadius: 20, padding: '2px 10px' }}>
                          👤 {p['First Name']} {p['Last Name']} {p['Title'] ? `· ${p['Title']}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ background: '#E5E1D8', color: '#5A6059', fontSize: 11, borderRadius: 20, padding: '3px 10px' }}>
                      {group.people.length} {group.people.length === 1 ? 'person' : 'people'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4 - Done */}
        {step === 4 && importResult && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 48, border: '1px solid rgba(62,66,61,0.1)', boxShadow: '0 2px 8px rgba(62,66,61,0.06)', maxWidth: 480, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ color: '#3E423D', fontSize: 26, fontStyle: 'italic', fontFamily: 'Playfair Display, Georgia, serif', margin: '0 0 24px' }}>Import Complete!</h2>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 32 }}>
              <div style={{ background: '#F5F3EF', borderRadius: 10, padding: '16px 24px' }}>
                <p style={{ color: '#8E9B8B', fontSize: 28, fontWeight: 700, margin: '0 0 4px' }}>{importResult.created}</p>
                <p style={{ color: '#717182', fontSize: 12, margin: 0 }}>Companies Created</p>
              </div>
              <div style={{ background: '#F5F3EF', borderRadius: 10, padding: '16px 24px' }}>
                <p style={{ color: '#94B0BC', fontSize: 28, fontWeight: 700, margin: '0 0 4px' }}>{importResult.skipped}</p>
                <p style={{ color: '#717182', fontSize: 12, margin: 0 }}>Skipped</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => navigate('/contacts')}
                style={{ flex: 1, background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>
                View Companies →
              </button>
              <button onClick={() => { setStep(1); setRows([]); setGrouped([]); setImportResult(null); }}
                style={{ flex: 1, background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>
                Import Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}