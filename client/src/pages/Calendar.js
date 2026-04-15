// client/src/pages/Calendar.js
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useRole } from '../hooks/useRole';
import { useApp } from '../context/AppContext';
import { getTimezone } from '../components/LocationSelector';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const EVENT_COLORS = {
  client:   { bg: '#EBF4FF', color: '#94B0BC', label: '🤝 Client' },
  contact:  { bg: '#F0F4F0', color: '#8E9B8B', label: '🏢 Contact' },
  calendly: { bg: '#FFF4E6', color: '#D4A574', label: '📅 Calendly' },
  internal: { bg: '#F3E8FF', color: '#7C3AED', label: '👥 Internal' },
  google:   { bg: '#FFF3CD', color: '#856404', label: '📅 Google Calendar' },
};
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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

function getClientTimezone(state) {
  if (!state) return null;
  return STATE_TIMEZONES[state] || STATE_TIMEZONES[state.trim()] || null;
}

function convertClientTimeToUTC(dateStr, hour, min, clientTimezone) {
  const refDate = new Date(`${dateStr}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: clientTimezone, timeZoneName: 'shortOffset' }).formatToParts(refDate);
  const offsetStr = parts.find(pt => pt.type === 'timeZoneName')?.value || 'GMT+0';
  const match = offsetStr.match(/GMT([+-])(\d+)(?::(\d+))?/);
  let offsetMinutes = 0;
  if (match) {
    const sign = match[1] === '+' ? 1 : -1;
    offsetMinutes = sign * (parseInt(match[2]) * 60 + parseInt(match[3] || 0));
  }
  const utcDate = new Date(`${dateStr}T00:00:00Z`);
  utcDate.setUTCMinutes(hour * 60 + min - offsetMinutes);
  return utcDate;
}

export default function Calendar() {
  const { palette: p } = useApp();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [clients, setClients] = useState([]);
  const [teamUsers, setTeamUsers] = useState([]);
  const { role } = useRole();
  const [completingEvent, setCompletingEvent] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [savingCompletion, setSavingCompletion] = useState(false);
  const [showZoomInput, setShowZoomInput] = useState(false);
  const [zoomLinkInput, setZoomLinkInput] = useState('');
  const [formPeople, setFormPeople] = useState([]);
  const [reschedulingEvent, setReschedulingEvent] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({ date: '', start_hour: '10', start_min: '00', end_hour: '11', end_min: '00' });
  const [savingReschedule, setSavingReschedule] = useState(false);
  const [selectedEventClientTz, setSelectedEventClientTz] = useState(null);
  const [showLegend, setShowLegend] = useState(false);

  const [form, setForm] = useState({
    title: '', description: '', meeting_type: 'google_meet',
    date: '', start_hour: '10', start_min: '00',
    end_hour: '11', end_min: '00',
    company_id: '', client_id: '', person_id: '',
    attendee_emails: '', is_internal: false,
    client_timezone: null, client_state: '',
  });

  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const inputStyle = { width: '100%', background: p.inputBg, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '9px 12px', color: p.text, fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { color: p.textSecondary, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 5 };

  useEffect(() => { fetchEvents(); }, [currentDate, view]);
  useEffect(() => { fetchCompaniesAndClients(); }, []);

  const fetchPeopleForCompany = async (companyId) => {
    if (!companyId) { setFormPeople([]); return; }
    try { const res = await axios.get(`${API}/contacts/companies/${companyId}`, { headers: getHeaders() }); setFormPeople(res.data.crm_people || []); }
    catch (err) { setFormPeople([]); }
  };

  const fetchEvents = async () => {
    try {
      const { start, end } = getDateRange();
      const res = await axios.get(`${API}/calendar/events?start=${start}&end=${end}`, { headers: getHeaders() });
      setEvents(res.data);
    } catch (err) { if (err.response?.status !== 404) console.error(err); setEvents([]); }
    setLoading(false);
  };

  const fetchCompaniesAndClients = async () => {
    try {
      const [compRes, clientRes, usersRes] = await Promise.all([
        axios.get(`${API}/contacts/companies`, { headers: getHeaders() }),
        axios.get(`${API}/clients`, { headers: getHeaders() }),
        axios.get(`${API}/users`, { headers: getHeaders() }).catch(() => ({ data: [] })),
      ]);
      setCompanies(compRes.data); setClients(clientRes.data); setTeamUsers(usersRes.data);
    } catch (err) { console.error(err); }
  };

  const getDateRange = () => {
    const d = new Date(currentDate);
    if (view === 'month') {
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      end.setDate(end.getDate() + (6 - end.getDay())); end.setHours(23, 59, 59);
      return { start: start.toISOString(), end: end.toISOString() };
    } else if (view === 'week') {
      const start = new Date(d); start.setDate(d.getDate() - d.getDay()); start.setHours(0, 0, 0);
      const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59);
      return { start: start.toISOString(), end: end.toISOString() };
    } else {
      const start = new Date(d); start.setHours(0, 0, 0);
      const end = new Date(d); end.setHours(23, 59, 59);
      return { start: start.toISOString(), end: end.toISOString() };
    }
  };

  const navigate_date = (dir) => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() + dir);
    else if (view === 'week') d.setDate(d.getDate() + 7 * dir);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  };

  const getEventsForDate = (date) => {
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    return events.filter(e => {
      const d = new Date(e.start_time);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` === dateStr;
    });
  };

  const getEventColor = (event) => {
    if (event.is_internal) return EVENT_COLORS.internal;
    if (event.source === 'crm') {
      if (event.client_id) return EVENT_COLORS.client;
      if (event.company_id) return EVENT_COLORS.contact;
      return EVENT_COLORS.calendly;
    }
    return EVENT_COLORS.google;
  };

  const openCreateModal = (date) => {
    const d = date || new Date();
    setForm({ title: '', description: '', meeting_type: 'google_meet', date: d.toISOString().split('T')[0], start_hour: String(d.getHours() || 10), start_min: '00', end_hour: String((d.getHours() || 10) + 1), end_min: '00', company_id: '', client_id: '', person_id: '', attendee_emails: '', is_internal: false, client_timezone: null, client_state: '', auto_record: false });
    setShowCreateModal(true);
  };

  const createMeeting = async () => {
    if (!form.title || !form.date) return;
    let start_time, end_time;
    if (form.client_timezone && !form.is_internal) {
      const startUTC = convertClientTimeToUTC(form.date, parseInt(form.start_hour), parseInt(form.start_min), form.client_timezone);
      const endUTC = convertClientTimeToUTC(form.date, parseInt(form.end_hour), parseInt(form.end_min), form.client_timezone);
      start_time = startUTC.toISOString(); end_time = endUTC.toISOString();
    } else {
      start_time = new Date(`${form.date}T${String(form.start_hour).padStart(2, '0')}:${form.start_min.padStart(2, '0')}:00`).toISOString();
      end_time = new Date(`${form.date}T${String(form.end_hour).padStart(2, '0')}:${form.end_min.padStart(2, '0')}:00`).toISOString();
    }
    const attendee_emails = form.attendee_emails ? form.attendee_emails.split(',').map(e => e.trim()).filter(Boolean) : [];
    if (form.person_id) {
      const person = formPeople.find(pp => pp.id === form.person_id);
      if (person?.email && !attendee_emails.includes(person.email)) attendee_emails.push(person.email);
    }
    if (form.client_id) {
      const client = clients.find(c => c.id === form.client_id);
      if (client?.contact_email && !attendee_emails.includes(client.contact_email)) attendee_emails.push(client.contact_email);
    }
    try {
      await axios.post(`${API}/calendar/meetings`, { title: form.title, description: form.description, meeting_type: form.is_internal ? 'google_meet' : form.meeting_type, start_time, end_time, company_id: form.company_id || null, client_id: form.client_id || null, person_id: form.person_id || null, attendee_emails, is_internal: form.is_internal, auto_record: form.auto_record || false }, { headers: getHeaders() });
      setShowCreateModal(false); fetchEvents();
    } catch (err) { alert('Failed to create meeting: ' + (err.response?.data?.error || err.message)); }
  };

  const fetchClientTimezone = async (event) => {
    setSelectedEventClientTz(null); if (!event) return;
    try {
      let country = null, state = null;
      if (event.company_id) { const res = await axios.get(`${API}/contacts/companies/${event.company_id}`, { headers: getHeaders() }); country = res.data?.country; state = res.data?.state; }
      else if (event.client_id) { const res = await axios.get(`${API}/clients/${event.client_id}`, { headers: getHeaders() }); country = res.data?.country; state = res.data?.state; }
      if (country || state) { const tz = getTimezone(country, state); if (tz) setSelectedEventClientTz({ tz, country, state }); }
    } catch (err) {}
  };

  const cancelMeeting = async (meetingId) => {
    if (!window.confirm('Cancel this meeting? It will also be removed from Google Calendar.')) return;
    try { await axios.delete(`${API}/calendar/meetings/${meetingId}`, { headers: getHeaders() }); setSelectedEvent(null); fetchEvents(); }
    catch (err) { console.error(err); }
  };

  const completeMeeting = async (meetingId) => {
    setSavingCompletion(true);
    try { await axios.put(`${API}/calendar/meetings/${meetingId}`, { status: 'completed', notes: completionNotes }, { headers: getHeaders() }); setSelectedEvent(null); setCompletingEvent(false); setCompletionNotes(''); fetchEvents(); }
    catch (err) { console.error(err); }
    setSavingCompletion(false);
  };

  const rescheduleMeeting = async (meetingId) => {
    if (!rescheduleForm.date) return;
    setSavingReschedule(true);
    try {
      const start_time = new Date(`${rescheduleForm.date}T${String(rescheduleForm.start_hour).padStart(2, '0')}:${rescheduleForm.start_min}:00`).toISOString();
      const end_time = new Date(`${rescheduleForm.date}T${String(rescheduleForm.end_hour).padStart(2, '0')}:${rescheduleForm.end_min}:00`).toISOString();
      await axios.put(`${API}/calendar/meetings/${meetingId}/reschedule`, { start_time, end_time }, { headers: getHeaders() });
      setSelectedEvent(null); setReschedulingEvent(false); fetchEvents();
    } catch (err) { alert('Reschedule failed'); }
    setSavingReschedule(false);
  };

  const importAndCompleteMeeting = async (event) => {
    setSavingCompletion(true);
    try { await axios.post(`${API}/calendar/import-complete`, { google_event_id: event.id, title: event.title, description: event.description, meeting_type: event.meet_link ? 'google_meet' : 'phone', start_time: event.start_time, end_time: event.end_time, meet_link: event.meet_link, attendees: event.attendees, notes: completionNotes }, { headers: getHeaders() }); setSelectedEvent(null); setCompletingEvent(false); setCompletionNotes(''); fetchEvents(); }
    catch (err) { console.error(err); }
    setSavingCompletion(false);
  };

  // ─── MONTH VIEW ────────────────────────────────────────────────────────────
  const renderMonthView = () => {
    const year = currentDate.getFullYear(), month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay); startDate.setDate(startDate.getDate() - startDate.getDay());
    const weeks = []; const d = new Date(startDate);
    for (let w = 0; w < 6; w++) {
      const days = [];
      for (let i = 0; i < 7; i++) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
      weeks.push(days);
      if (d.getMonth() !== month && d.getDay() === 0) break;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    return (
      <div style={{ background: p.cardBg, borderRadius: 12, border: `1px solid ${p.cardBorder}`, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${p.cardBorder}` }}>
          {DAYS.map(day => <div key={day} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: p.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>{day}</div>)}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', height: 120, overflow: 'hidden', borderBottom: wi < weeks.length - 1 ? `1px solid ${p.cardBorder}` : 'none' }}>
            {week.map((day, di) => {
              const isCurrentMonth = day.getMonth() === month;
              const isToday = day.toISOString().split('T')[0] === todayStr;
              const dayEvents = getEventsForDate(day);
              return (
                <div key={di} onClick={() => openCreateModal(day)}
                  style={{ padding: '6px 8px', borderRight: di < 6 ? `1px solid ${p.cardBorder}` : 'none', cursor: 'pointer', background: isToday ? p.inputBg : 'transparent', opacity: isCurrentMonth ? 1 : 0.4, height: 120, overflow: 'hidden', transition: 'background 0.1s' }}
                  onMouseEnter={e => { if (!isToday) e.currentTarget.style.background = p.backgroundSecondary; }}
                  onMouseLeave={e => { if (!isToday) e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: isToday ? p.primary : 'transparent', color: isToday ? '#fff' : p.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: isToday ? 700 : 400, marginBottom: 4 }}>
                    {day.getDate()}
                  </div>
                  {dayEvents.slice(0, 3).map((event, ei) => {
                    const ec = getEventColor(event);
                    return (
                      <div key={ei} onClick={e => { e.stopPropagation(); setSelectedEvent(event); fetchClientTimezone(event); }}
                        style={{ background: ec.bg, color: ec.color, fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 4, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', borderLeft: `3px solid ${ec.color}` }}>
                        {new Date(event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} {event.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && <div style={{ fontSize: 10, color: p.textSecondary, padding: '2px 6px' }}>+{dayEvents.length - 3} more</div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // ─── WEEK VIEW ─────────────────────────────────────────────────────────────
  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate); startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) { const d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i); days.push(d); }
    const todayStr = new Date().toISOString().split('T')[0];
    const hours = Array.from({ length: 24 }, (_, i) => i);
    return (
      <div style={{ background: p.cardBg, borderRadius: 12, border: `1px solid ${p.cardBorder}`, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', borderBottom: `1px solid ${p.cardBorder}` }}>
          <div style={{ padding: 8 }} />
          {days.map((day, i) => {
            const isToday = day.toISOString().split('T')[0] === todayStr;
            return (
              <div key={i} style={{ padding: '10px 8px', textAlign: 'center', borderLeft: `1px solid ${p.cardBorder}` }}>
                <div style={{ fontSize: 11, color: p.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>{DAYS[day.getDay()]}</div>
                <div style={{ width: 28, height: 28, borderRadius: '50%', margin: '4px auto 0', background: isToday ? p.primary : 'transparent', color: isToday ? '#fff' : p.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: isToday ? 700 : 400 }}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ maxHeight: 700, overflowY: 'auto' }}>
          {hours.map(hour => (
            <div key={hour} style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', minHeight: 48, borderBottom: `1px solid ${p.cardBorder}` }}>
              <div style={{ padding: '4px 8px', fontSize: 10, color: p.textMuted, textAlign: 'right' }}>
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
              {days.map((day, di) => {
                const dayEvents = getEventsForDate(day).filter(e => new Date(e.start_time).getHours() === hour);
                return (
                  <div key={di} onClick={() => { const d = new Date(day); d.setHours(hour); openCreateModal(d); }}
                    style={{ borderLeft: `1px solid ${p.cardBorder}`, padding: '2px 4px', cursor: 'pointer', overflow: 'hidden', maxHeight: 48 }}>
                    {dayEvents.map((event, ei) => {
                      const ec = getEventColor(event);
                      return (
                        <div key={ei} onClick={e => { e.stopPropagation(); setSelectedEvent(event); fetchClientTimezone(event); }}
                          style={{ background: ec.bg, color: ec.color, fontSize: 10, fontWeight: 500, padding: '3px 6px', borderRadius: 4, marginBottom: 2, cursor: 'pointer', borderLeft: `3px solid ${ec.color}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {new Date(event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} {event.title}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── DAY VIEW ──────────────────────────────────────────────────────────────
  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayEvents = getEventsForDate(currentDate);
    return (
      <div style={{ background: p.cardBg, borderRadius: 12, border: `1px solid ${p.cardBorder}`, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${p.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: p.text, fontSize: 15, fontWeight: 600 }}>{currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
          <span style={{ color: p.textSecondary, fontSize: 12 }}>{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ maxHeight: 700, overflowY: 'auto' }}>
          {hours.map(hour => {
            const hourEvents = dayEvents.filter(e => new Date(e.start_time).getHours() === hour);
            return (
              <div key={hour} onClick={() => { const d = new Date(currentDate); d.setHours(hour); openCreateModal(d); }}
                style={{ display: 'flex', gap: 12, padding: '8px 20px', minHeight: 48, borderBottom: `1px solid ${p.cardBorder}`, cursor: 'pointer' }}>
                <div style={{ width: 60, fontSize: 11, color: p.textMuted, paddingTop: 4, flexShrink: 0 }}>
                  {hour === 0 ? '12:00 AM' : hour < 12 ? `${hour}:00 AM` : hour === 12 ? '12:00 PM' : `${hour - 12}:00 PM`}
                </div>
                <div style={{ flex: 1 }}>
                  {hourEvents.map((event, ei) => {
                    const ec = getEventColor(event);
                    return (
                      <div key={ei} onClick={e => { e.stopPropagation(); setSelectedEvent(event); fetchClientTimezone(event); }}
                        style={{ background: ec.bg, borderLeft: `4px solid ${ec.color}`, borderRadius: 6, padding: '8px 12px', marginBottom: 4, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: ec.color, fontSize: 13, fontWeight: 600 }}>{event.title}</span>
                          <span style={{ color: p.textSecondary, fontSize: 11 }}>{new Date(event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - {new Date(event.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                        </div>
                        {event.company_name && <div style={{ color: p.textSecondary, fontSize: 11, marginTop: 2 }}>{event.client_id ? '🤝' : '🏢'} {event.company_name}</div>}
                        {event.meet_link && <div style={{ color: '#1a6fad', fontSize: 11, marginTop: 2 }}>📹 Google Meet</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: p.background, minHeight: '100vh', transition: 'background 0.4s' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: '32px 40px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <p style={{ color: p.textSecondary, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>Schedule</p>
            <h1 style={{ color: p.text, fontSize: 28, fontWeight: 600, fontStyle: 'italic', fontFamily: "'Playfair Display', Georgia, serif", margin: 0 }}>Calendar</h1>
          </div>
          <button onClick={() => openCreateModal(new Date())} style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            + New Meeting
          </button>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {['←', 'Today', '→'].map((label, i) => (
              <button key={label} onClick={i === 1 ? () => setCurrentDate(new Date()) : () => navigate_date(i === 0 ? -1 : 1)}
                style={{ background: p.cardBg, border: `1px solid ${p.cardBorder}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: p.text }}>
                {label}
              </button>
            ))}
            <h2 style={{ margin: 0, color: p.text, fontSize: 20, fontWeight: 600, fontFamily: "'Playfair Display', Georgia, serif" }}>
              {view === 'day' ? currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
            </h2>
          </div>

          {/* Legend */}
          <div style={{ position: 'relative', marginRight: 12 }} onMouseEnter={() => setShowLegend(true)} onMouseLeave={() => setShowLegend(false)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: p.cardBg, border: `1px solid ${p.cardBorder}`, borderRadius: 8, cursor: 'default', fontSize: 12, color: p.textSecondary }}>
              {['#94B0BC', '#8E9B8B', '#D4A574', '#7C3AED', '#856404'].map(color => (
                <div key={color} style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
              ))}
              <span style={{ fontSize: 11, color: p.textSecondary }}>Legend</span>
            </div>
            {showLegend && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, background: p.cardBg, borderRadius: 12, padding: '14px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', border: `1px solid ${p.cardBorder}`, zIndex: 100, minWidth: 240 }}>
                <p style={{ color: p.textSecondary, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 10px', fontWeight: 600 }}>Calendar Colors</p>
                {[
                  { color: '#94B0BC', bg: '#EBF4FF', label: 'Client', desc: 'Meeting with a converted client' },
                  { color: '#8E9B8B', bg: '#F0F4F0', label: 'Contact', desc: 'Meeting with a CRM contact' },
                  { color: '#D4A574', bg: '#FFF4E6', label: 'Calendly', desc: 'Calendly booking — no CRM match' },
                  { color: '#7C3AED', bg: '#F3E8FF', label: 'Internal', desc: 'Internal team meeting' },
                  { color: '#856404', bg: '#FFF3CD', label: 'Google Only', desc: 'Google Calendar — not linked to CRM' },
                ].map(({ color, bg, label, desc }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 28, height: 20, borderRadius: 4, flexShrink: 0, background: bg, borderLeft: `3px solid ${color}`, marginTop: 1 }} />
                    <div>
                      <div style={{ color: p.text, fontSize: 12, fontWeight: 600 }}>{label}</div>
                      <div style={{ color: p.textSecondary, fontSize: 11, lineHeight: 1.4 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', gap: 0, background: p.cardBg, borderRadius: 8, border: `1px solid ${p.cardBorder}`, overflow: 'hidden' }}>
            {['month', 'week', 'day'].map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{ background: view === v ? p.text : p.cardBg, color: view === v ? '#fff' : p.textSecondary, border: 'none', padding: '8px 16px', fontSize: 12, fontWeight: view === v ? 600 : 400, cursor: 'pointer', fontFamily: 'Inter, sans-serif', textTransform: 'capitalize', borderRight: `1px solid ${p.cardBorder}` }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar Grid */}
        {loading ? <div style={{ padding: 60, textAlign: 'center', color: p.textSecondary }}>Loading calendar...</div> : (
          <>
            {view === 'month' && renderMonthView()}
            {view === 'week' && renderWeekView()}
            {view === 'day' && renderDayView()}
          </>
        )}

        {/* Event Detail Popup */}
        {selectedEvent && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
            onClick={() => { setSelectedEvent(null); setCompletingEvent(false); setCompletionNotes(''); setShowZoomInput(false); setZoomLinkInput(''); setReschedulingEvent(false); }}>
            <div onClick={e => e.stopPropagation()} style={{ background: p.cardBg, borderRadius: 16, padding: 32, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: `1px solid ${p.cardBorder}`, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h2 style={{ color: p.text, fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>{selectedEvent.title}</h2>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {(() => { const ec = getEventColor(selectedEvent); return <span style={{ background: ec.bg, color: ec.color, fontSize: 11, borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>{ec.label}</span>; })()}
                    {selectedEvent.crm_status && <span style={{ background: p.inputBg, color: p.textSecondary, fontSize: 11, borderRadius: 20, padding: '2px 10px' }}>{selectedEvent.crm_status}</span>}
                  </div>
                </div>
                <button onClick={() => { setSelectedEvent(null); setSelectedEventClientTz(null); setCompletingEvent(false); setCompletionNotes(''); setShowZoomInput(false); setZoomLinkInput(''); setReschedulingEvent(false); }}
                  style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: p.textSecondary }}>✕</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {(() => {
                  const myTz = getMyTimezone();
                  const startDate = new Date(selectedEvent.start_time);
                  const endDate = new Date(selectedEvent.end_time);
                  const myDateStr = startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: myTz });
                  const myStartStr = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: myTz });
                  const myEndStr = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: myTz });
                  let clientTzLabel = null;
                  if (selectedEventClientTz) {
                    const { tz, country, state } = selectedEventClientTz;
                    if (tz !== myTz) {
                      const clientStart = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
                      const clientEnd = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
                      const locationLabel = state || country || tz;
                      clientTzLabel = { clientStart, clientEnd, locationLabel };
                    }
                  }
                  return (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span>🕐</span>
                      <div>
                        <div style={{ color: p.text, fontSize: 14, fontWeight: 500 }}>{myDateStr}</div>
                        <div style={{ color: p.textSecondary, fontSize: 13 }}>
                          {myStartStr} — {myEndStr}
                          <span style={{ color: '#94B0BC', fontSize: 11, fontWeight: 500, marginLeft: 6 }}>(Jerusalem)</span>
                        </div>
                        {clientTzLabel && (
                          <div style={{ marginTop: 4 }}>
                            <span style={{ fontSize: 11, color: p.textSecondary, background: p.inputBg, borderRadius: 4, padding: '2px 8px' }}>
                              🌍 {clientTzLabel.locationLabel}: {clientTzLabel.clientStart} — {clientTzLabel.clientEnd}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {selectedEvent.meet_link && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>📹</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <a href={selectedEvent.meet_link} target="_blank" rel="noreferrer" style={{ color: '#1a6fad', fontSize: 13, textDecoration: 'none' }}>Join Google Meet</a>
                      {selectedEvent.crm_meeting_id && ['scheduled', 'confirmed'].includes(selectedEvent.crm_status) && !selectedEvent.recall_bot_id && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={async () => {
                              try { await axios.post(`${API}/calendar/meetings/${selectedEvent.crm_meeting_id}/record`, { meeting_url: selectedEvent.meet_link }, { headers: getHeaders() }); alert('🎙️ Recording bot sent!'); setSelectedEvent(null); fetchEvents(); }
                              catch (err) { alert('Failed: ' + (err.response?.data?.error || err.message)); }
                            }} style={{ background: '#D4183D', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer' }}>🔴 Google Meet</button>
                            <button onClick={() => setShowZoomInput(prev => !prev)} style={{ background: showZoomInput ? '#2D8CFF' : p.inputBg, color: showZoomInput ? '#fff' : '#2D8CFF', border: '1px solid #2D8CFF', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer' }}>🎥 Zoom</button>
                          </div>
                          {showZoomInput && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input value={zoomLinkInput} onChange={e => setZoomLinkInput(e.target.value)} placeholder="Paste Zoom meeting link..."
                                style={{ flex: 1, background: p.cardBg, border: '1px solid #2D8CFF', borderRadius: 6, padding: '5px 10px', fontSize: 11, outline: 'none', fontFamily: 'Inter, sans-serif', color: p.text }} />
                              <button onClick={async () => {
                                if (!zoomLinkInput || !zoomLinkInput.includes('zoom')) { alert('Please paste a valid Zoom meeting link'); return; }
                                try { await axios.post(`${API}/calendar/meetings/${selectedEvent.crm_meeting_id}/record`, { meeting_url: zoomLinkInput }, { headers: getHeaders() }); alert('🎙️ Recording bot sent!'); setShowZoomInput(false); setZoomLinkInput(''); setSelectedEvent(null); fetchEvents(); }
                                catch (err) { alert('Failed: ' + (err.response?.data?.error || err.message)); }
                              }} disabled={!zoomLinkInput} style={{ background: zoomLinkInput ? '#2D8CFF' : p.inputBorder, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: zoomLinkInput ? 'pointer' : 'default' }}>Send Bot</button>
                            </div>
                          )}
                        </div>
                      )}
                      {selectedEvent.recording_status === 'recording' && <span style={{ background: '#FFEBEE', color: '#D4183D', fontSize: 11, borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>⏺️ Recording...</span>}
                      {selectedEvent.recording_status === 'processing' && <span style={{ background: '#FFF3CD', color: '#856404', fontSize: 11, borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>⏳ Processing...</span>}
                    </div>
                  </div>
                )}
              </div>

              {/* Reschedule flow */}
              {selectedEvent.crm_meeting_id && ['scheduled', 'confirmed'].includes(selectedEvent.crm_status) && (
                <div style={{ marginBottom: 12 }}>
                  {!reschedulingEvent ? (
                    <button onClick={() => { setReschedulingEvent(true); setRescheduleForm({ date: '', start_hour: '10', start_min: '00', end_hour: '11', end_min: '00' }); }}
                      style={{ background: p.inputBg, color: p.textSecondary, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', width: '100%' }}>
                      📅 Reschedule Meeting
                    </button>
                  ) : (
                    <div style={{ background: p.inputBg, borderRadius: 10, padding: 16 }}>
                      <p style={{ color: p.textSecondary, fontSize: 11, textTransform: 'uppercase', margin: '0 0 12px', fontWeight: 600 }}>New Date & Time</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input type="date" value={rescheduleForm.date} onChange={e => setRescheduleForm(prev => ({ ...prev, date: e.target.value }))}
                          style={{ background: p.cardBg, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box', color: p.text }} />
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {['start_hour', 'start_min', null, 'end_hour', 'end_min'].map((field, i) => field === null ? (
                            <span key={i} style={{ color: p.textSecondary, fontSize: 12 }}>→</span>
                          ) : field.includes('min') ? (
                            <select key={field} value={rescheduleForm[field]} onChange={e => setRescheduleForm(prev => ({ ...prev, [field]: e.target.value }))}
                              style={{ width: 70, background: p.cardBg, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '8px', fontSize: 12, outline: 'none', color: p.text }}>
                              {['00', '15', '30', '45'].map(m => <option key={m} value={m}>:{m}</option>)}
                            </select>
                          ) : (
                            <select key={field} value={rescheduleForm[field]} onChange={e => setRescheduleForm(prev => ({ ...prev, [field]: e.target.value }))}
                              style={{ flex: 1, background: p.cardBg, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '8px', fontSize: 12, outline: 'none', color: p.text }}>
                              {Array.from({ length: 24 }, (_, i) => <option key={i} value={String(i)}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>)}
                            </select>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => rescheduleMeeting(selectedEvent.crm_meeting_id)} disabled={savingReschedule || !rescheduleForm.date}
                            style={{ flex: 1, background: rescheduleForm.date ? p.primary : p.textMuted, color: '#fff', border: 'none', borderRadius: 8, padding: '9px', fontSize: 12, cursor: rescheduleForm.date ? 'pointer' : 'default' }}>
                            {savingReschedule ? '⏳ Rescheduling...' : '✓ Confirm & Notify Contact'}
                          </button>
                          <button onClick={() => setReschedulingEvent(false)} style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '9px 14px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Completion flow */}
              {new Date(selectedEvent.end_time) < new Date() && selectedEvent.crm_status !== 'completed' && selectedEvent.crm_status !== 'cancelled' && (
                <div style={{ background: '#FFF3CD', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                  {!completingEvent ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ color: '#856404', fontSize: 13, fontWeight: 500, margin: 0 }}>This meeting has passed — how did it go?</p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setCompletingEvent(true)} style={{ background: p.primary, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>✓ Complete</button>
                        <button onClick={() => { if (selectedEvent.crm_meeting_id) cancelMeeting(selectedEvent.crm_meeting_id); else setSelectedEvent(null); }}
                          style={{ background: p.inputBg, color: '#D4183D', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>✗ No-show</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p style={{ color: '#856404', fontSize: 12, fontWeight: 600, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Meeting Notes</p>
                      <textarea value={completionNotes} onChange={e => setCompletionNotes(e.target.value)} placeholder="What was discussed? Key takeaways, next steps..."
                        rows={4} style={{ width: '100%', background: p.cardBg, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', lineHeight: 1.6, color: p.text }} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button onClick={() => selectedEvent.crm_meeting_id ? completeMeeting(selectedEvent.crm_meeting_id) : importAndCompleteMeeting(selectedEvent)} disabled={savingCompletion}
                          style={{ flex: 1, background: savingCompletion ? p.textMuted : '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '8px', fontSize: 13, cursor: 'pointer' }}>
                          {savingCompletion ? '⏳ Saving...' : '✓ Mark Complete & Save'}
                        </button>
                        <button onClick={() => { setCompletingEvent(false); setCompletionNotes(''); }} style={{ background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedEvent.notes && (
                <div style={{ background: p.inputBg, borderRadius: 10, padding: 14, marginBottom: 12 }}>
                  <p style={{ color: p.textSecondary, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 6px', fontWeight: 600 }}>Meeting Notes</p>
                  <p style={{ color: p.text, fontSize: 13, margin: 0, lineHeight: 1.6 }}>{selectedEvent.notes}</p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                {selectedEvent.html_link && (
                  <a href={selectedEvent.html_link} target="_blank" rel="noreferrer"
                    style={{ flex: 1, background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '10px', fontSize: 13, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                    Open in Google Calendar
                  </a>
                )}
                {selectedEvent.crm_meeting_id && selectedEvent.crm_status !== 'completed' && selectedEvent.crm_status !== 'cancelled' && new Date(selectedEvent.end_time) >= new Date() && (
                  <button onClick={() => cancelMeeting(selectedEvent.crm_meeting_id)} style={{ background: 'none', color: '#D4183D', border: '1px solid #D4183D', borderRadius: 8, padding: '10px 16px', fontSize: 13, cursor: 'pointer' }}>Cancel Meeting</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Create Meeting Modal */}
        {showCreateModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: p.cardBg, borderRadius: 16, padding: 32, width: 540, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${p.cardBorder}` }}>
              <h2 style={{ color: p.text, fontSize: 20, fontStyle: 'italic', fontFamily: "'Playfair Display', Georgia, serif", margin: '0 0 20px' }}>New Meeting</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Title *</label>
                  <input value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} style={inputStyle} placeholder="e.g. Venue walkthrough with..." />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Type</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[{ key: 'google_meet', label: '📹 Google Meet' }, { key: 'phone', label: '📞 Phone Call' }].map(t => (
                        <button key={t.key} onClick={() => setForm(prev => ({ ...prev, meeting_type: t.key }))}
                          style={{ flex: 1, background: form.meeting_type === t.key ? p.text : p.cardBg, color: form.meeting_type === t.key ? '#fff' : p.textSecondary, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Internal Meeting?</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 12px', background: p.inputBg, borderRadius: 8 }}>
                      <input type="checkbox" checked={form.is_internal} onChange={e => setForm(prev => ({ ...prev, is_internal: e.target.checked, client_timezone: null, client_state: '' }))} style={{ accentColor: p.primary }} />
                      <span style={{ color: p.text, fontSize: 13 }}>Team only</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Date *</label>
                  <input type="date" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))} style={inputStyle} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[{ key: 'start', hField: 'start_hour', mField: 'start_min' }, { key: 'end', hField: 'end_hour', mField: 'end_min' }].map(({ key, hField, mField }) => (
                    <div key={key}>
                      <label style={labelStyle}>{key === 'start' ? 'Start' : 'End'} Time {form.client_timezone && !form.is_internal ? `(${form.client_state} time)` : ''}</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select value={form[hField]} onChange={e => setForm(prev => ({ ...prev, [hField]: e.target.value }))} style={{ ...inputStyle, flex: 1 }}>
                          {Array.from({ length: 24 }, (_, i) => <option key={i} value={String(i)}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>)}
                        </select>
                        <select value={form[mField]} onChange={e => setForm(prev => ({ ...prev, [mField]: e.target.value }))} style={{ ...inputStyle, width: 70 }}>
                          {['00', '15', '30', '45'].map(m => <option key={m} value={m}>:{m}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                {form.client_timezone && !form.is_internal && (
                  <div style={{ background: '#FFF3CD', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>🌍</span>
                    <div style={{ fontSize: 12, color: '#856404', lineHeight: 1.6 }}>
                      <strong>Timezone conversion:</strong><br />
                      Client time ({form.client_state}): {parseInt(form.start_hour) === 0 ? '12' : parseInt(form.start_hour) > 12 ? parseInt(form.start_hour) - 12 : form.start_hour}:{form.start_min} {parseInt(form.start_hour) >= 12 ? 'PM' : 'AM'} — {form.client_timezone}<br />
                      Your time: {(() => {
                        try { const converted = convertClientTimeToUTC(form.date, parseInt(form.start_hour), parseInt(form.start_min), form.client_timezone); return new Date(converted).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: getMyTimezone() }); }
                        catch { return '—'; }
                      })()} — {getMyTimezone()}
                    </div>
                  </div>
                )}

                {!form.is_internal && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Link to Contact</label>
                        <select value={form.company_id} onChange={e => {
                          const companyId = e.target.value;
                          const company = companies.find(c => c.id === companyId);
                          const state = company?.state || '';
                          const tz = getClientTimezone(state);
                          setForm(prev => ({ ...prev, company_id: companyId, client_id: '', person_id: '', client_timezone: tz, client_state: state }));
                          fetchPeopleForCompany(companyId);
                        }} style={inputStyle}>
                          <option value="">None</option>
                          {companies.map(c => <option key={c.id} value={c.id}>🏢 {c.company_name} {c.state ? `(${c.state})` : ''}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Link to Client</label>
                        <select value={form.client_id} onChange={e => {
                          const clientId = e.target.value;
                          const client = clients.find(c => c.id === clientId);
                          const state = client?.state || '';
                          const tz = getClientTimezone(state);
                          setForm(prev => ({ ...prev, client_id: clientId, company_id: '', person_id: '', client_timezone: tz, client_state: state }));
                          if (client?.converted_from) fetchPeopleForCompany(client.converted_from); else setFormPeople([]);
                        }} style={inputStyle}>
                          <option value="">None</option>
                          {clients.map(c => <option key={c.id} value={c.id}>🤝 {c.business_name} {c.state ? `(${c.state})` : ''}</option>)}
                        </select>
                      </div>
                    </div>

                    {(form.company_id || form.client_id) && formPeople.length > 0 && (
                      <div>
                        <label style={labelStyle}>Contact Person</label>
                        <select value={form.person_id} onChange={e => setForm(prev => ({ ...prev, person_id: e.target.value }))} style={inputStyle}>
                          <option value="">Select who to invite...</option>
                          {formPeople.filter(pp => pp.email).map(pp => <option key={pp.id} value={pp.id}>👤 {pp.first_name} {pp.last_name} — {pp.email}</option>)}
                        </select>
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label style={labelStyle}>Additional Attendees (comma-separated emails)</label>
                  <input value={form.attendee_emails} onChange={e => setForm(prev => ({ ...prev, attendee_emails: e.target.value }))} style={inputStyle} placeholder="e.g. john@venue.com, sarah@company.com" />
                </div>

                <div>
                  <label style={labelStyle}>Description</label>
                  <textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Meeting agenda, notes..." />
                </div>

                {form.meeting_type === 'google_meet' && !form.is_internal && (
                  <div style={{ background: '#EBF4FF', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 14 }}>📹</span>
                      <span style={{ color: '#1a6fad', fontSize: 12 }}>A Google Meet link will be auto-generated and included in the invite</span>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.auto_record || false} onChange={e => setForm(prev => ({ ...prev, auto_record: e.target.checked }))} style={{ accentColor: '#D4183D' }} />
                      <span style={{ color: '#1a6fad', fontSize: 12, fontWeight: 500 }}>🔴 Auto-record this meeting</span>
                    </label>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button onClick={createMeeting} disabled={!form.title || !form.date}
                  style={{ flex: 1, background: form.title && form.date ? p.primary : p.textMuted, color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, cursor: form.title && form.date ? 'pointer' : 'default', fontWeight: 600 }}>
                  Create & Send Invite
                </button>
                <button onClick={() => setShowCreateModal(false)} style={{ flex: 1, background: p.inputBg, color: p.text, border: `1px solid ${p.inputBorder}`, borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}