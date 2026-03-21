// client/src/components/ScheduleMeetingModal.js
import { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

// US State → IANA timezone
const STATE_TIMEZONES = {
  'AL': 'America/Chicago', 'AK': 'America/Anchorage', 'AZ': 'America/Phoenix', 'AR': 'America/Chicago',
  'CA': 'America/Los_Angeles', 'CO': 'America/Denver', 'CT': 'America/New_York', 'DE': 'America/New_York',
  'FL': 'America/New_York', 'GA': 'America/New_York', 'HI': 'Pacific/Honolulu', 'ID': 'America/Boise',
  'IL': 'America/Chicago', 'IN': 'America/Indiana/Indianapolis', 'IA': 'America/Chicago', 'KS': 'America/Chicago',
  'KY': 'America/New_York', 'LA': 'America/Chicago', 'ME': 'America/New_York', 'MD': 'America/New_York',
  'MA': 'America/New_York', 'MI': 'America/Detroit', 'MN': 'America/Chicago', 'MS': 'America/Chicago',
  'MO': 'America/Chicago', 'MT': 'America/Denver', 'NE': 'America/Chicago', 'NV': 'America/Los_Angeles',
  'NH': 'America/New_York', 'NJ': 'America/New_York', 'NM': 'America/Denver', 'NY': 'America/New_York',
  'NC': 'America/New_York', 'ND': 'America/Chicago', 'OH': 'America/New_York', 'OK': 'America/Chicago',
  'OR': 'America/Los_Angeles', 'PA': 'America/New_York', 'RI': 'America/New_York', 'SC': 'America/New_York',
  'SD': 'America/Chicago', 'TN': 'America/Chicago', 'TX': 'America/Chicago', 'UT': 'America/Denver',
  'VT': 'America/New_York', 'VA': 'America/New_York', 'WA': 'America/Los_Angeles', 'WV': 'America/New_York',
  'WI': 'America/Chicago', 'WY': 'America/Denver', 'DC': 'America/New_York',
  'Alabama': 'America/Chicago', 'Alaska': 'America/Anchorage', 'Arizona': 'America/Phoenix', 'Arkansas': 'America/Chicago',
  'California': 'America/Los_Angeles', 'Colorado': 'America/Denver', 'Connecticut': 'America/New_York', 'Delaware': 'America/New_York',
  'Florida': 'America/New_York', 'Georgia': 'America/New_York', 'Hawaii': 'Pacific/Honolulu', 'Idaho': 'America/Boise',
  'Illinois': 'America/Chicago', 'Indiana': 'America/Indiana/Indianapolis', 'Iowa': 'America/Chicago', 'Kansas': 'America/Chicago',
  'Kentucky': 'America/New_York', 'Louisiana': 'America/Chicago', 'Maine': 'America/New_York', 'Maryland': 'America/New_York',
  'Massachusetts': 'America/New_York', 'Michigan': 'America/Detroit', 'Minnesota': 'America/Chicago', 'Mississippi': 'America/Chicago',
  'Missouri': 'America/Chicago', 'Montana': 'America/Denver', 'Nebraska': 'America/Chicago', 'Nevada': 'America/Los_Angeles',
  'New Hampshire': 'America/New_York', 'New Jersey': 'America/New_York', 'New Mexico': 'America/Denver', 'New York': 'America/New_York',
  'North Carolina': 'America/New_York', 'North Dakota': 'America/Chicago', 'Ohio': 'America/New_York', 'Oklahoma': 'America/Chicago',
  'Oregon': 'America/Los_Angeles', 'Pennsylvania': 'America/New_York', 'Rhode Island': 'America/New_York', 'South Carolina': 'America/New_York',
  'South Dakota': 'America/Chicago', 'Tennessee': 'America/Chicago', 'Texas': 'America/Chicago', 'Utah': 'America/Denver',
  'Vermont': 'America/New_York', 'Virginia': 'America/New_York', 'Washington': 'America/Los_Angeles', 'West Virginia': 'America/New_York',
  'Wisconsin': 'America/Chicago', 'Wyoming': 'America/Denver',
};

function getMyTimezone() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return user.timezone || 'Asia/Jerusalem';
}

function getTimezoneOffset(timezone, date) {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  return (utcDate - tzDate) / 60000;
}

function formatInTimezone(date, timezone) {
  return new Date(date).toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true });
}

function convertClientTimeToUTC(dateStr, hour, min, clientTimezone) {
  const localStr = `${dateStr}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
  const localDate = new Date(localStr);
  const offset = getTimezoneOffset(clientTimezone, localDate);
  return new Date(localDate.getTime() + offset * 60000);
}

/**
 * ScheduleMeetingModal
 * 
 * Props:
 * - show: boolean
 * - onClose: () => void
 * - onCreated: () => void (callback after meeting created)
 * - companyId: string (optional)
 * - clientId: string (optional)
 * - companyName: string
 * - state: string (US state for timezone detection)
 * - people: [{ id, first_name, last_name, email }]
 * - contactEmail: string (for clients — primary contact email)
 * - contactName: string (for clients — primary contact name)
 */
export default function ScheduleMeetingModal({ show, onClose, onCreated, companyId, clientId, companyName, state, people = [], contactEmail, contactName }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    meeting_type: 'google_meet',
    date: new Date().toISOString().split('T')[0],
    start_hour: '10',
    start_min: '00',
    end_hour: '11',
    end_min: '00',
    person_id: '',
    attendee_emails: '',
    auto_record: false,
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const clientTimezone = state ? (STATE_TIMEZONES[state] || STATE_TIMEZONES[state.trim()] || null) : null;
  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  // Auto-fill description with company context
  useEffect(() => {
    if (show && companyName) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setForm(prev => ({
        ...prev,
        title: `Meeting with ${companyName}`,
        description: `Meeting with ${companyName}${state ? ` (${state})` : ''}\nOrganized by: ${user.name || ''}\n\n`,
        person_id: '',
        attendee_emails: '',
      }));
      setSuccess(false);
    }
  }, [show, companyName, state]);

  const handleCreate = async () => {
    if (!form.title || !form.date) return;
    setSaving(true);

    let start_time, end_time;
    if (clientTimezone) {
      const startUTC = convertClientTimeToUTC(form.date, parseInt(form.start_hour), parseInt(form.start_min), clientTimezone);
      const endUTC = convertClientTimeToUTC(form.date, parseInt(form.end_hour), parseInt(form.end_min), clientTimezone);
      start_time = startUTC.toISOString();
      end_time = endUTC.toISOString();
    } else {
      start_time = new Date(`${form.date}T${String(form.start_hour).padStart(2, '0')}:${form.start_min.padStart(2, '0')}:00`).toISOString();
      end_time = new Date(`${form.date}T${String(form.end_hour).padStart(2, '0')}:${form.end_min.padStart(2, '0')}:00`).toISOString();
    }

    // Build attendee list
    const attendee_emails = form.attendee_emails
      ? form.attendee_emails.split(',').map(e => e.trim()).filter(Boolean)
      : [];

    // Add selected person's email
    if (form.person_id && people.length > 0) {
      const person = people.find(p => p.id === form.person_id);
      if (person?.email && !attendee_emails.includes(person.email)) {
        attendee_emails.push(person.email);
      }
    }

    // Add client primary email if no person selected
    if (clientId && contactEmail && !form.person_id && !attendee_emails.includes(contactEmail)) {
      attendee_emails.push(contactEmail);
    }

    try {
      await axios.post(`${API}/calendar/meetings`, {
        title: form.title,
        description: form.description,
        meeting_type: form.meeting_type,
        start_time,
        end_time,
        company_id: companyId || null,
        client_id: clientId || null,
        person_id: form.person_id || null,
        attendee_emails,
        is_internal: false,
        auto_record: form.auto_record || false,
      }, { headers: getHeaders() });

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        if (onCreated) onCreated();
      }, 2000);
    } catch (err) {
      console.error(err);
      alert('Failed to create meeting: ' + (err.response?.data?.error || err.message));
    }
    setSaving(false);
  };

  if (!show) return null;

  const inputStyle = { width: '100%', background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '9px 12px', color: '#3E423D', fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 5 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(62,66,61,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 540, boxShadow: '0 20px 60px rgba(62,66,61,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ color: '#3E423D', fontSize: 20, fontStyle: 'italic', fontFamily: "'Playfair Display', Georgia, serif", margin: '0 0 4px' }}>Schedule Meeting</h2>
            <p style={{ color: '#717182', fontSize: 13, margin: 0 }}>with <strong>{companyName}</strong>{state ? ` · ${state}` : ''}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#717182' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Title */}
          <div>
            <label style={labelStyle}>Title *</label>
            <input value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} style={inputStyle} placeholder="e.g. Venue walkthrough..." />
          </div>

          {/* Type */}
          <div>
            <label style={labelStyle}>Meeting Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { key: 'google_meet', label: '📹 Google Meet' },
                { key: 'phone', label: '📞 Phone Call' },
              ].map(t => (
                <button key={t.key} onClick={() => setForm(prev => ({ ...prev, meeting_type: t.key }))}
                  style={{
                    flex: 1, background: form.meeting_type === t.key ? '#3E423D' : '#fff',
                    color: form.meeting_type === t.key ? '#fff' : '#5A6059',
                    border: '1px solid rgba(62,66,61,0.15)', borderRadius: 8,
                    padding: '10px', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500,
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label style={labelStyle}>Date *</label>
            <input type="date" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))} style={inputStyle} />
          </div>

          {/* Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Start Time {clientTimezone ? `(${state} time)` : ''}</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select value={form.start_hour} onChange={e => setForm(prev => ({ ...prev, start_hour: e.target.value }))} style={{ ...inputStyle, flex: 1 }}>
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={String(i)}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>)}
                </select>
                <select value={form.start_min} onChange={e => setForm(prev => ({ ...prev, start_min: e.target.value }))} style={{ ...inputStyle, width: 70 }}>
                  {['00', '15', '30', '45'].map(m => <option key={m} value={m}>:{m}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>End Time {clientTimezone ? `(${state} time)` : ''}</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select value={form.end_hour} onChange={e => setForm(prev => ({ ...prev, end_hour: e.target.value }))} style={{ ...inputStyle, flex: 1 }}>
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={String(i)}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>)}
                </select>
                <select value={form.end_min} onChange={e => setForm(prev => ({ ...prev, end_min: e.target.value }))} style={{ ...inputStyle, width: 70 }}>
                  {['00', '15', '30', '45'].map(m => <option key={m} value={m}>:{m}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Timezone conversion preview */}
          {clientTimezone && (
            <div style={{ background: '#FFF3CD', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>🌍</span>
              <div style={{ fontSize: 12, color: '#856404', lineHeight: 1.6 }}>
                <strong>Timezone conversion:</strong><br />
                Client time ({state}): {parseInt(form.start_hour) === 0 ? '12' : parseInt(form.start_hour) > 12 ? parseInt(form.start_hour) - 12 : form.start_hour}:{form.start_min} {parseInt(form.start_hour) >= 12 ? 'PM' : 'AM'} — {clientTimezone}<br />
                Your time: {(() => {
                  try {
                    const converted = convertClientTimeToUTC(form.date, parseInt(form.start_hour), parseInt(form.start_min), clientTimezone);
                    return formatInTimezone(converted, getMyTimezone());
                  } catch { return '—'; }
                })()} — {getMyTimezone()}
              </div>
            </div>
          )}

          {/* Invite Person */}
          {people.length > 0 && (
            <div>
              <label style={labelStyle}>Invite Contact Person</label>
              <select value={form.person_id} onChange={e => setForm(prev => ({ ...prev, person_id: e.target.value }))} style={inputStyle}>
                <option value="">Select who to invite...</option>
                {people.filter(p => p.email).map(p => (
                  <option key={p.id} value={p.id}>👤 {p.first_name} {p.last_name} — {p.email}</option>
                ))}
              </select>
            </div>
          )}

          {/* Client primary contact (when no people list) */}
          {people.length === 0 && contactEmail && (
            <div style={{ background: '#F5F3EF', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>👤</span>
              <span style={{ color: '#3E423D', fontSize: 13 }}>
                Invite will be sent to: <strong>{contactName || contactEmail}</strong> ({contactEmail})
              </span>
            </div>
          )}

          {/* Additional attendees */}
          <div>
            <label style={labelStyle}>Additional Attendees (comma-separated emails)</label>
            <input value={form.attendee_emails} onChange={e => setForm(prev => ({ ...prev, attendee_emails: e.target.value }))} style={inputStyle} placeholder="e.g. colleague@planfor.io" />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description (auto-filled, editable)</label>
            <textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {/* Google Meet info */}
          {form.meeting_type === 'google_meet' && (
            <div style={{ background: '#EBF4FF', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>📹</span>
                <span style={{ color: '#1a6fad', fontSize: 12 }}>A Google Meet link will be auto-generated and included in the invite</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.auto_record || false} onChange={e => setForm(prev => ({ ...prev, auto_record: e.target.checked }))} style={{ accentColor: '#D4183D' }} />
                <span style={{ color: '#1a6fad', fontSize: 12, fontWeight: 500 }}>🔴 Auto-record this meeting (Planfor Assistant will join and transcribe)</span>
              </label>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          {success ? (
            <button style={{ flex: 1, background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, fontWeight: 600 }}>
              ✅ Meeting Created & Invite Sent!
            </button>
          ) : (
            <button onClick={handleCreate} disabled={!form.title || !form.date || saving}
              style={{ flex: 1, background: form.title && form.date && !saving ? '#8E9B8B' : '#D5CEC0', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, cursor: form.title && form.date && !saving ? 'pointer' : 'default', fontWeight: 600 }}>
              {saving ? '⏳ Creating...' : 'Create & Send Invite'}
            </button>
          )}
          <button onClick={onClose}
            style={{ flex: 1, background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}