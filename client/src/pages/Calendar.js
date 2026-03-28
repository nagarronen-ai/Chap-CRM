// client/src/pages/Calendar.js
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { useRole } from '../hooks/useRole';

const API = process.env.REACT_APP_API || 'http://localhost:5000/api';

const EVENT_COLORS = {
  google_meet: { bg: '#EBF4FF', color: '#1a6fad', label: '📹 Google Meet' },
  phone: { bg: '#E8F5E9', color: '#2E7D32', label: '📞 Phone Call' },
  internal: { bg: '#F3E8FF', color: '#7C3AED', label: '👥 Internal' },
  google: { bg: '#FFF3CD', color: '#856404', label: '📅 Google Calendar' },
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// US State → IANA timezone mapping
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

function getTimezoneOffset(timezone, date) {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  return (utcDate - tzDate) / 60000;
}

function formatInTimezone(date, timezone) {
  return new Date(date).toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true });
}

function convertClientTimeToUTC(dateStr, hour, min, clientTimezone) {
  // Build a local date string as if in client timezone
  const localStr = `${dateStr}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
  const localDate = new Date(localStr);
  const offset = getTimezoneOffset(clientTimezone, localDate);
  return new Date(localDate.getTime() + offset * 60000);
}

export default function Calendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [clients, setClients] = useState([]);
  const [teamUsers, setTeamUsers] = useState([]); 
  const navigate = useNavigate();
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

  const [form, setForm] = useState({
    title: '', description: '', meeting_type: 'google_meet',
    date: '', start_hour: '10', start_min: '00',
    end_hour: '11', end_min: '00',
    company_id: '', client_id: '', person_id: '',
    attendee_emails: '', is_internal: false,
    client_timezone: null, client_state: '',
  });

  const fetchPeopleForCompany = async (companyId) => {
    if (!companyId) { setFormPeople([]); return; }
    try {
      const res = await axios.get(`${API}/contacts/companies/${companyId}`, { headers: getHeaders() });
      setFormPeople(res.data.crm_people || []);
    } catch (err) { setFormPeople([]); }
  };

  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  useEffect(() => { fetchEvents(); }, [currentDate, view]);
  useEffect(() => { fetchCompaniesAndClients(); }, []);

  const fetchEvents = async () => {
    try {
      const { start, end } = getDateRange();
      const res = await axios.get(`${API}/calendar/events?start=${start}&end=${end}`, { headers: getHeaders() });
      setEvents(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setEvents([]);
      } else {
        console.error(err);
      }
    }
    setLoading(false);
  };

  const fetchCompaniesAndClients = async () => {
    try {
      const [compRes, clientRes, usersRes] = await Promise.all([
        axios.get(`${API}/contacts/companies`, { headers: getHeaders() }),
        axios.get(`${API}/clients`, { headers: getHeaders() }),
        axios.get(`${API}/users`, { headers: getHeaders() }).catch(() => ({ data: [] })),
      ]);
      setCompanies(compRes.data);
      setClients(clientRes.data);
      setTeamUsers(usersRes.data);
    } catch (err) { console.error(err); }
  };

  const getDateRange = () => {
    const d = new Date(currentDate);
    if (view === 'month') {
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      end.setDate(end.getDate() + (6 - end.getDay()));
      end.setHours(23, 59, 59);
      return { start: start.toISOString(), end: end.toISOString() };
    } else if (view === 'week') {
      const start = new Date(d);
      start.setDate(d.getDate() - d.getDay());
      start.setHours(0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59);
      return { start: start.toISOString(), end: end.toISOString() };
    } else {
      const start = new Date(d);
      start.setHours(0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59);
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

  const goToday = () => setCurrentDate(new Date());

  const getEventsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(e => {
      const eventDate = new Date(e.start_time).toISOString().split('T')[0];
      return eventDate === dateStr;
    });
  };

  const getEventColor = (event) => {
    if (event.is_internal) return EVENT_COLORS.internal;
    if (event.source === 'crm') return EVENT_COLORS[event.meeting_type] || EVENT_COLORS.google_meet;
    return EVENT_COLORS.google;
  };

  const openCreateModal = (date) => {
    const d = date || new Date();
    setForm({
      title: '', description: '', meeting_type: 'google_meet',
      date: d.toISOString().split('T')[0],
      start_hour: String(d.getHours() || 10), start_min: '00',
      end_hour: String((d.getHours() || 10) + 1), end_min: '00',
      company_id: '', client_id: '', person_id: '',
      attendee_emails: '', is_internal: false,
      client_timezone: null, client_state: '',
      auto_record: false,
    });
    setShowCreateModal(true);
  };


  
  const createMeeting = async () => {
    if (!form.title || !form.date) return;

    let start_time, end_time;

    if (form.client_timezone && !form.is_internal) {
      // Time entered is in the CLIENT's timezone — convert to UTC
      const startUTC = convertClientTimeToUTC(form.date, parseInt(form.start_hour), parseInt(form.start_min), form.client_timezone);
      const endUTC = convertClientTimeToUTC(form.date, parseInt(form.end_hour), parseInt(form.end_min), form.client_timezone);
      start_time = startUTC.toISOString();
      end_time = endUTC.toISOString();
    } else {
      // Internal meeting or no client timezone — time is in MY timezone
      start_time = new Date(`${form.date}T${String(form.start_hour).padStart(2, '0')}:${form.start_min.padStart(2, '0')}:00`).toISOString();
      end_time = new Date(`${form.date}T${String(form.end_hour).padStart(2, '0')}:${form.end_min.padStart(2, '0')}:00`).toISOString();
    }

    const attendee_emails = form.attendee_emails
      ? form.attendee_emails.split(',').map(e => e.trim()).filter(Boolean)
      : [];

      if (form.person_id) {
        const person = formPeople.find(p => p.id === form.person_id);
        if (person?.email && !attendee_emails.includes(person.email)) {
          attendee_emails.push(person.email);
        }
      }
    if (form.client_id) {
      const client = clients.find(c => c.id === form.client_id);
      if (client?.contact_email && !attendee_emails.includes(client.contact_email)) {
        attendee_emails.push(client.contact_email);
      }
    }

    try {
      await axios.post(`${API}/calendar/meetings`, {
        title: form.title,
        description: form.description,
        meeting_type: form.is_internal ? 'google_meet' : form.meeting_type,
        start_time,
        end_time,
        company_id: form.company_id || null,
        client_id: form.client_id || null,
        person_id: form.person_id || null,
        attendee_emails,
        is_internal: form.is_internal,
        auto_record: form.auto_record || false,
      }, { headers: getHeaders() });

      setShowCreateModal(false);
      fetchEvents();
    } catch (err) {
      console.error(err);
      alert('Failed to create meeting: ' + (err.response?.data?.error || err.message));
    }
  };

  const cancelMeeting = async (meetingId) => {
    if (!window.confirm('Cancel this meeting? It will also be removed from Google Calendar.')) return;
    try {
      await axios.delete(`${API}/calendar/meetings/${meetingId}`, { headers: getHeaders() });
      setSelectedEvent(null);
      fetchEvents();
    } catch (err) { console.error(err); }
  };

  const completeMeeting = async (meetingId) => {
    setSavingCompletion(true);
    try {
      await axios.put(`${API}/calendar/meetings/${meetingId}`, {
        status: 'completed',
        notes: completionNotes,
      }, { headers: getHeaders() });
      setSelectedEvent(null);
      setCompletingEvent(false);
      setCompletionNotes('');
      fetchEvents();
    } catch (err) { console.error(err); }
    setSavingCompletion(false);
  };

  const rescheduleMeeting = async (meetingId) => {
    if (!rescheduleForm.date) return;
    setSavingReschedule(true);
    try {
      const start_time = new Date(`${rescheduleForm.date}T${String(rescheduleForm.start_hour).padStart(2, '0')}:${rescheduleForm.start_min}:00`).toISOString();
      const end_time = new Date(`${rescheduleForm.date}T${String(rescheduleForm.end_hour).padStart(2, '0')}:${rescheduleForm.end_min}:00`).toISOString();
      await axios.put(`${API}/calendar/meetings/${meetingId}/reschedule`, { start_time, end_time }, { headers: getHeaders() });
      setSelectedEvent(null);
      setReschedulingEvent(false);
      fetchEvents();
    } catch (err) { console.error(err); alert('Reschedule failed'); }
    setSavingReschedule(false);
  };

  const importAndCompleteMeeting = async (event) => {
    setSavingCompletion(true);
    try {
      await axios.post(`${API}/calendar/import-complete`, {
        google_event_id: event.id,
        title: event.title,
        description: event.description,
        meeting_type: event.meet_link ? 'google_meet' : 'phone',
        start_time: event.start_time,
        end_time: event.end_time,
        meet_link: event.meet_link,
        attendees: event.attendees,
        notes: completionNotes,
      }, { headers: getHeaders() });
      setSelectedEvent(null);
      setCompletingEvent(false);
      setCompletionNotes('');
      fetchEvents();
    } catch (err) { console.error(err); }
    setSavingCompletion(false);
  };

  // ─── MONTH VIEW ────────────────────────────────────────────────────────────

  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const weeks = [];
    const d = new Date(startDate);
    for (let w = 0; w < 6; w++) {
      const days = [];
      for (let i = 0; i < 7; i++) {
        days.push(new Date(d));
        d.setDate(d.getDate() + 1);
      }
      weeks.push(days);
      if (d.getMonth() !== month && d.getDay() === 0) break;
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    return (
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(62,66,61,0.1)' }}>
          {DAYS.map(day => (
            <div key={day} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#717182', textTransform: 'uppercase', letterSpacing: 1 }}>
              {day}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', height: 120, overflow: 'hidden', borderBottom: wi < weeks.length - 1 ? '1px solid rgba(62,66,61,0.06)' : 'none' }}>
            {week.map((day, di) => {
              const isCurrentMonth = day.getMonth() === month;
              const isToday = day.toISOString().split('T')[0] === todayStr;
              const dayEvents = getEventsForDate(day);

              return (
                <div key={di}
                  onClick={() => openCreateModal(day)}
                  style={{
                    padding: '6px 8px', borderRight: di < 6 ? '1px solid rgba(62,66,61,0.06)' : 'none',
                    cursor: 'pointer', background: isToday ? '#F8F9FF' : 'transparent',
                    opacity: isCurrentMonth ? 1 : 0.4, height: 120, overflow: 'hidden',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isToday) e.currentTarget.style.background = '#FAFAF9'; }}
                  onMouseLeave={e => { if (!isToday) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: isToday ? '#8E9B8B' : 'transparent',
                    color: isToday ? '#fff' : '#3E423D',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: isToday ? 700 : 400, marginBottom: 4,
                  }}>
                    {day.getDate()}
                  </div>
                  {dayEvents.slice(0, 3).map((event, ei) => {
                    const ec = getEventColor(event);
                    return (
                      <div key={ei}
                        onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); }}
                        style={{
                          background: ec.bg, color: ec.color, fontSize: 10, fontWeight: 500,
                          padding: '2px 6px', borderRadius: 4, marginBottom: 2,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          cursor: 'pointer', borderLeft: `3px solid ${ec.color}`,
                        }}
                      >
                        {new Date(event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} {event.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div style={{ fontSize: 10, color: '#717182', padding: '2px 6px' }}>
                      +{dayEvents.length - 3} more
                    </div>
                  )}
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
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    const todayStr = new Date().toISOString().split('T')[0];
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', borderBottom: '1px solid rgba(62,66,61,0.1)' }}>
          <div style={{ padding: 8 }} />
          {days.map((day, i) => {
            const isToday = day.toISOString().split('T')[0] === todayStr;
            return (
              <div key={i} style={{ padding: '10px 8px', textAlign: 'center', borderLeft: '1px solid rgba(62,66,61,0.06)' }}>
                <div style={{ fontSize: 11, color: '#717182', textTransform: 'uppercase', letterSpacing: 1 }}>{DAYS[day.getDay()]}</div>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', margin: '4px auto 0',
                  background: isToday ? '#8E9B8B' : 'transparent',
                  color: isToday ? '#fff' : '#3E423D',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: isToday ? 700 : 400,
                }}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ maxHeight: 700, overflowY: 'auto' }}>
          {hours.map(hour => (
            <div key={hour} style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', minHeight: 48, borderBottom: '1px solid rgba(62,66,61,0.04)' }}>
              <div style={{ padding: '4px 8px', fontSize: 10, color: '#CBCED4', textAlign: 'right' }}>
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
              {days.map((day, di) => {
                const dayEvents = getEventsForDate(day).filter(e => {
                  const h = new Date(e.start_time).getHours();
                  return h === hour;
                });
                return (
                  <div key={di}
                    onClick={() => {
                      const d = new Date(day);
                      d.setHours(hour);
                      openCreateModal(d);
                    }}
                    style={{ borderLeft: '1px solid rgba(62,66,61,0.06)', padding: '2px 4px', cursor: 'pointer', position: 'relative', overflow: 'hidden', maxHeight: 48 }}
                  >
                    {dayEvents.map((event, ei) => {
                      const ec = getEventColor(event);
                      return (
                        <div key={ei}
                          onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); }}
                          style={{
                            background: ec.bg, color: ec.color, fontSize: 10, fontWeight: 500,
                            padding: '3px 6px', borderRadius: 4, marginBottom: 2, cursor: 'pointer',
                            borderLeft: `3px solid ${ec.color}`,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}
                        >
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
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(62,66,61,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#3E423D', fontSize: 15, fontWeight: 600 }}>
            {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>
          <span style={{ color: '#717182', fontSize: 12 }}>{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ maxHeight: 700, overflowY: 'auto' }}>
          {hours.map(hour => {
            const hourEvents = dayEvents.filter(e => new Date(e.start_time).getHours() === hour);
            return (
              <div key={hour}
                onClick={() => {
                  const d = new Date(currentDate);
                  d.setHours(hour);
                  openCreateModal(d);
                }}
                style={{
                  display: 'flex', gap: 12, padding: '8px 20px', minHeight: 48,
                  borderBottom: '1px solid rgba(62,66,61,0.04)', cursor: 'pointer',
                }}
              >
                <div style={{ width: 60, fontSize: 11, color: '#CBCED4', paddingTop: 4, flexShrink: 0 }}>
                  {hour === 0 ? '12:00 AM' : hour < 12 ? `${hour}:00 AM` : hour === 12 ? '12:00 PM' : `${hour - 12}:00 PM`}
                </div>
                <div style={{ flex: 1 }}>
                  {hourEvents.map((event, ei) => {
                    const ec = getEventColor(event);
                    return (
                      <div key={ei}
                        onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); }}
                        style={{
                          background: ec.bg, borderLeft: `4px solid ${ec.color}`, borderRadius: 6,
                          padding: '8px 12px', marginBottom: 4, cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: ec.color, fontSize: 13, fontWeight: 600 }}>{event.title}</span>
                          <span style={{ color: '#717182', fontSize: 11 }}>
                            {new Date(event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - {new Date(event.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                        {event.company_name && <div style={{ color: '#717182', fontSize: 11, marginTop: 2 }}>{event.client_id ? '🤝' : '🏢'} {event.company_name}</div>}
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

  const inputStyle = { width: '100%', background: '#F3F3F5', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '9px 12px', color: '#3E423D', fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 5 };

  return (
    <div style={{ display: 'flex', fontFamily: 'Inter, sans-serif', background: '#F5F3EF', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 240, flex: 1, padding: '32px 40px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>Schedule</p>
            <h1 style={{ color: '#3E423D', fontSize: 28, fontWeight: 600, fontStyle: 'italic', fontFamily: "'Playfair Display', Georgia, serif", margin: 0 }}>Calendar</h1>
          </div>
          <button onClick={() => openCreateModal(new Date())}
            style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            + New Meeting
          </button>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate_date(-1)} style={{ background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: '#3E423D' }}>←</button>
            <button onClick={goToday} style={{ background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: '#3E423D' }}>Today</button>
            <button onClick={() => navigate_date(1)} style={{ background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: '#3E423D' }}>→</button>
            <h2 style={{ margin: 0, color: '#3E423D', fontSize: 20, fontWeight: 600, fontFamily: "'Playfair Display', Georgia, serif" }}>
              {view === 'day'
                ? currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                : `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
              }
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 0, background: '#fff', borderRadius: 8, border: '1px solid rgba(62,66,61,0.1)', overflow: 'hidden' }}>
            {['month', 'week', 'day'].map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{
                  background: view === v ? '#3E423D' : '#fff',
                  color: view === v ? '#fff' : '#717182',
                  border: 'none', padding: '8px 16px', fontSize: 12,
                  fontWeight: view === v ? 600 : 400, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', textTransform: 'capitalize',
                  borderRight: '1px solid rgba(62,66,61,0.08)',
                }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar Grid */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#717182' }}>Loading calendar...</div>
        ) : (
          <>
            {view === 'month' && renderMonthView()}
            {view === 'week' && renderWeekView()}
            {view === 'day' && renderDayView()}
          </>
        )}

        {/* Event Detail Popup */}
        {selectedEvent && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(62,66,61,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => { setSelectedEvent(null); setCompletingEvent(false); setCompletionNotes(''); setShowZoomInput(false); setZoomLinkInput(''); setReschedulingEvent(false); }}
          >
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 32, width: 480, boxShadow: '0 20px 60px rgba(62,66,61,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h2 style={{ color: '#3E423D', fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>{selectedEvent.title}</h2>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {(() => {
                      const ec = getEventColor(selectedEvent);
                      return <span style={{ background: ec.bg, color: ec.color, fontSize: 11, borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>{ec.label}</span>;
                    })()}
                    {selectedEvent.crm_status && (
                      <span style={{ background: '#F5F3EF', color: '#717182', fontSize: 11, borderRadius: 20, padding: '2px 10px' }}>{selectedEvent.crm_status}</span>
                    )}
                  </div>
                </div>
                <button onClick={() => { setSelectedEvent(null); setCompletingEvent(false); setCompletionNotes(''); setShowZoomInput(false); setZoomLinkInput(''); setReschedulingEvent(false); }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#717182' }}>✕</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>🕐</span>
                  <div>
                    <p style={{ color: '#3E423D', fontSize: 13, margin: 0 }}>
                      {new Date(selectedEvent.start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                    <p style={{ color: '#717182', fontSize: 12, margin: 0 }}>
                      {new Date(selectedEvent.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} — {new Date(selectedEvent.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} ({getMyTimezone().split('/').pop().replace(/_/g, ' ')})
                    </p>
                  </div>
                </div>
                {selectedEvent.meet_link && (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
    <span style={{ fontSize: 16 }}>📹</span>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <a href={selectedEvent.meet_link} target="_blank" rel="noreferrer" style={{ color: '#1a6fad', fontSize: 13, textDecoration: 'none' }}>
        Join Google Meet
      </a>
      {selectedEvent.crm_meeting_id && (selectedEvent.crm_status === 'scheduled' || selectedEvent.crm_status === 'confirmed') && !selectedEvent.recall_bot_id && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={async () => {
              try {
                await axios.post(`${API}/calendar/meetings/${selectedEvent.crm_meeting_id}/record`,
                  { meeting_url: selectedEvent.meet_link },
                  { headers: getHeaders() }
                );
                alert('🎙️ Recording bot sent! Planfor Assistant will join the Google Meet shortly.');
                setSelectedEvent(null);
                fetchEvents();
              } catch (err) {
                alert('Failed: ' + (err.response?.data?.error || err.message));
              }
            }} style={{ background: '#D4183D', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              🔴 Google Meet
            </button>
            <button onClick={() => setShowZoomInput(prev => !prev)}
              style={{ background: showZoomInput ? '#2D8CFF' : '#F5F3EF', color: showZoomInput ? '#fff' : '#2D8CFF', border: '1px solid #2D8CFF', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer' }}>
              🎥 Zoom
            </button>
          </div>
          {showZoomInput && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                value={zoomLinkInput}
                onChange={e => setZoomLinkInput(e.target.value)}
                placeholder="Paste Zoom meeting link..."
                style={{ flex: 1, background: '#fff', border: '1px solid #2D8CFF', borderRadius: 6, padding: '5px 10px', fontSize: 11, outline: 'none', fontFamily: 'Inter, sans-serif' }}
              />
              <button
                onClick={async () => {
                  if (!zoomLinkInput || !zoomLinkInput.includes('zoom')) {
                    alert('Please paste a valid Zoom meeting link');
                    return;
                  }
                  try {
                    await axios.post(`${API}/calendar/meetings/${selectedEvent.crm_meeting_id}/record`,
                      { meeting_url: zoomLinkInput },
                      { headers: getHeaders() }
                    );
                    alert('🎙️ Recording bot sent! Planfor Assistant will join the Zoom shortly.');
                    setShowZoomInput(false);
                    setZoomLinkInput('');
                    setSelectedEvent(null);
                    fetchEvents();
                  } catch (err) {
                    alert('Failed: ' + (err.response?.data?.error || err.message));
                  }
                }}
                disabled={!zoomLinkInput}
                style={{ background: zoomLinkInput ? '#2D8CFF' : '#D5CEC0', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: zoomLinkInput ? 'pointer' : 'default' }}>
                Send Bot
              </button>
            </div>
          )}
        </div>
      )}
      {selectedEvent.recording_status === 'recording' && (
        <span style={{ background: '#FFEBEE', color: '#D4183D', fontSize: 11, borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>⏺️ Recording...</span>
      )}
      {selectedEvent.recording_status === 'processing' && (
        <span style={{ background: '#FFF3CD', color: '#856404', fontSize: 11, borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>⏳ Processing...</span>
      )}
    </div>
  </div>
)}
              </div>
                {/* Reschedule flow */}
                {selectedEvent.crm_meeting_id && (selectedEvent.crm_status === 'scheduled' || selectedEvent.crm_status === 'confirmed') && (
                  <div style={{ marginBottom: 12 }}>
                    {!reschedulingEvent ? (
                      <button onClick={() => { setReschedulingEvent(true); setRescheduleForm({ date: '', start_hour: '10', start_min: '00', end_hour: '11', end_min: '00' }); }}
                        style={{ background: '#F5F3EF', color: '#717182', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', width: '100%' }}>
                        📅 Reschedule Meeting
                      </button>
                    ) : (
                      <div style={{ background: '#F8F9FF', borderRadius: 10, padding: 16 }}>
                        <p style={{ color: '#717182', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 12px', fontWeight: 600 }}>New Date & Time</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <input type="date" value={rescheduleForm.date} onChange={e => setRescheduleForm(prev => ({ ...prev, date: e.target.value }))}
                            style={{ background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box' }} />
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <select value={rescheduleForm.start_hour} onChange={e => setRescheduleForm(prev => ({ ...prev, start_hour: e.target.value }))}
                              style={{ flex: 1, background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px', fontSize: 12, outline: 'none' }}>
                              {Array.from({ length: 24 }, (_, i) => <option key={i} value={String(i)}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>)}
                            </select>
                            <select value={rescheduleForm.start_min} onChange={e => setRescheduleForm(prev => ({ ...prev, start_min: e.target.value }))}
                              style={{ width: 70, background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px', fontSize: 12, outline: 'none' }}>
                              {['00', '15', '30', '45'].map(m => <option key={m} value={m}>:{m}</option>)}
                            </select>
                            <span style={{ color: '#717182', fontSize: 12 }}>→</span>
                            <select value={rescheduleForm.end_hour} onChange={e => setRescheduleForm(prev => ({ ...prev, end_hour: e.target.value }))}
                              style={{ flex: 1, background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px', fontSize: 12, outline: 'none' }}>
                              {Array.from({ length: 24 }, (_, i) => <option key={i} value={String(i)}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>)}
                            </select>
                            <select value={rescheduleForm.end_min} onChange={e => setRescheduleForm(prev => ({ ...prev, end_min: e.target.value }))}
                              style={{ width: 70, background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px', fontSize: 12, outline: 'none' }}>
                              {['00', '15', '30', '45'].map(m => <option key={m} value={m}>:{m}</option>)}
                            </select>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => rescheduleMeeting(selectedEvent.crm_meeting_id)} disabled={savingReschedule || !rescheduleForm.date}
                              style={{ flex: 1, background: rescheduleForm.date ? '#8E9B8B' : '#D5CEC0', color: '#fff', border: 'none', borderRadius: 8, padding: '9px', fontSize: 12, cursor: rescheduleForm.date ? 'pointer' : 'default' }}>
                              {savingReschedule ? '⏳ Rescheduling...' : '✓ Confirm & Notify Contact'}
                            </button>
                            <button onClick={() => setReschedulingEvent(false)}
                              style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '9px 14px', fontSize: 12, cursor: 'pointer' }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              {/* Completion flow for past CRM meetings */}
              {new Date(selectedEvent.end_time) < new Date() && selectedEvent.crm_status !== 'completed' && selectedEvent.crm_status !== 'cancelled' && (
                <div style={{ background: '#FFF3CD', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                  {!completingEvent ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ color: '#856404', fontSize: 13, fontWeight: 500, margin: 0 }}>This meeting has passed — how did it go?</p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setCompletingEvent(true)}
                          style={{ background: '#8E9B8B', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
                          ✓ Complete
                        </button>
                        <button onClick={() => { if (selectedEvent.crm_meeting_id) { cancelMeeting(selectedEvent.crm_meeting_id); } else { setSelectedEvent(null); } }}
                          style={{ background: '#F5F3EF', color: '#D4183D', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>
                          ✗ No-show
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p style={{ color: '#856404', fontSize: 12, fontWeight: 600, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Meeting Notes</p>
                      <textarea value={completionNotes} onChange={e => setCompletionNotes(e.target.value)}
                        placeholder="What was discussed? Key takeaways, next steps..."
                        rows={4} style={{ width: '100%', background: '#fff', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '10px 14px', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', lineHeight: 1.6 }} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={() => selectedEvent.crm_meeting_id ? completeMeeting(selectedEvent.crm_meeting_id) : importAndCompleteMeeting(selectedEvent)} disabled={savingCompletion}
                          style={{ flex: 1, background: savingCompletion ? '#A5B2A3' : '#4CAF50', color: '#fff', border: 'none', borderRadius: 8, padding: '8px', fontSize: 13, cursor: 'pointer' }}>
                          {savingCompletion ? '⏳ Saving...' : '✓ Mark Complete & Save'}
                        </button>
                        <button onClick={() => { setCompletingEvent(false); setCompletionNotes(''); }}
                          style={{ background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Show notes if already completed */}
              {selectedEvent.notes && (
                <div style={{ background: '#F5F3EF', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                  <p style={{ color: '#717182', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 6px', fontWeight: 600 }}>Meeting Notes</p>
                  <p style={{ color: '#3E423D', fontSize: 13, margin: 0, lineHeight: 1.6 }}>{selectedEvent.notes}</p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                {selectedEvent.html_link && (
                  <a href={selectedEvent.html_link} target="_blank" rel="noreferrer"
                    style={{ flex: 1, background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '10px', fontSize: 13, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                    Open in Google Calendar
                  </a>
                )}
                {selectedEvent.crm_meeting_id && selectedEvent.crm_status !== 'completed' && selectedEvent.crm_status !== 'cancelled' && new Date(selectedEvent.end_time) >= new Date() && (
                  <button onClick={() => cancelMeeting(selectedEvent.crm_meeting_id)}
                    style={{ background: 'none', color: '#D4183D', border: '1px solid #D4183D', borderRadius: 8, padding: '10px 16px', fontSize: 13, cursor: 'pointer' }}>
                    Cancel Meeting
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Create Meeting Modal */}
        {showCreateModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(62,66,61,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 540, boxShadow: '0 20px 60px rgba(62,66,61,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ color: '#3E423D', fontSize: 20, fontStyle: 'italic', fontFamily: "'Playfair Display', Georgia, serif", margin: '0 0 20px' }}>New Meeting</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Title *</label>
                  <input value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} style={inputStyle} placeholder="e.g. Venue walkthrough with..." />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Type</label>
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
                            padding: '8px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                          }}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Internal Meeting?</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 12px', background: '#F3F3F5', borderRadius: 8 }}>
                      <input type="checkbox" checked={form.is_internal} onChange={e => setForm(prev => ({ ...prev, is_internal: e.target.checked, client_timezone: null, client_state: '' }))} style={{ accentColor: '#8E9B8B' }} />
                      <span style={{ color: '#3E423D', fontSize: 13 }}>Team only</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Date *</label>
                  <input type="date" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))} style={inputStyle} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Start Time {form.client_timezone && !form.is_internal ? `(${form.client_state} time)` : ''}</label>
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
                    <label style={labelStyle}>End Time {form.client_timezone && !form.is_internal ? `(${form.client_state} time)` : ''}</label>
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
                {form.client_timezone && !form.is_internal && (
                  <div style={{ background: '#FFF3CD', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>🌍</span>
                    <div style={{ fontSize: 12, color: '#856404', lineHeight: 1.6 }}>
                      <strong>Timezone conversion:</strong><br />
                      Client time ({form.client_state}): {parseInt(form.start_hour) === 0 ? '12' : parseInt(form.start_hour) > 12 ? parseInt(form.start_hour) - 12 : form.start_hour}:{form.start_min} {parseInt(form.start_hour) >= 12 ? 'PM' : 'AM'} — {form.client_timezone}<br />
                      Your time: {(() => {
                        try {
                          const converted = convertClientTimeToUTC(form.date, parseInt(form.start_hour), parseInt(form.start_min), form.client_timezone);
                          return formatInTimezone(converted, getMyTimezone());
                        } catch { return '—'; }
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
                          if (client?.converted_from) fetchPeopleForCompany(client.converted_from);
                          else setFormPeople([]);
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
                          {formPeople.filter(p => p.email).map(p => (
                            <option key={p.id} value={p.id}>👤 {p.first_name} {p.last_name} — {p.email}</option>
                          ))}
                        </select>
                      </div>
                    )}


                  </>
                )}

                <div>
                  <label style={labelStyle}>Additional Attendees (comma-separated emails)</label>
                  <input value={form.attendee_emails} onChange={e => setForm(prev => ({ ...prev, attendee_emails: e.target.value }))} style={inputStyle} placeholder="e.g. john@venue.com, sarah@planfor.io" />
                </div>

                <div>
                  <label style={labelStyle}>Description</label>
                  <textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }}
                    placeholder="Meeting agenda, notes..." />
                </div>

                {form.meeting_type === 'google_meet' && !form.is_internal && (
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

              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button onClick={createMeeting} disabled={!form.title || !form.date}
                  style={{ flex: 1, background: form.title && form.date ? '#8E9B8B' : '#D5CEC0', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, cursor: form.title && form.date ? 'pointer' : 'default', fontWeight: 600 }}>
                  Create & Send Invite
                </button>
                <button onClick={() => setShowCreateModal(false)}
                  style={{ flex: 1, background: '#F5F3EF', color: '#3E423D', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}