// client/src/components/LocationSelector.js
import { useState, useEffect } from 'react';

// ─── COUNTRIES WITH TIMEZONE ─────────────────────────────────────────────────

const COUNTRIES = [
  { name: 'United States', code: 'US', hasStates: true, tz: 'America/New_York' },
  { name: 'Canada', code: 'CA', hasStates: true, tz: 'America/Toronto' },
  { name: 'United Kingdom', code: 'GB', hasStates: false, tz: 'Europe/London' },
  { name: 'Australia', code: 'AU', hasStates: true, tz: 'Australia/Sydney' },
  { name: 'Germany', code: 'DE', hasStates: false, tz: 'Europe/Berlin' },
  { name: 'France', code: 'FR', hasStates: false, tz: 'Europe/Paris' },
  { name: 'Italy', code: 'IT', hasStates: false, tz: 'Europe/Rome' },
  { name: 'Spain', code: 'ES', hasStates: false, tz: 'Europe/Madrid' },
  { name: 'Netherlands', code: 'NL', hasStates: false, tz: 'Europe/Amsterdam' },
  { name: 'Belgium', code: 'BE', hasStates: false, tz: 'Europe/Brussels' },
  { name: 'Switzerland', code: 'CH', hasStates: false, tz: 'Europe/Zurich' },
  { name: 'Austria', code: 'AT', hasStates: false, tz: 'Europe/Vienna' },
  { name: 'Sweden', code: 'SE', hasStates: false, tz: 'Europe/Stockholm' },
  { name: 'Norway', code: 'NO', hasStates: false, tz: 'Europe/Oslo' },
  { name: 'Denmark', code: 'DK', hasStates: false, tz: 'Europe/Copenhagen' },
  { name: 'Finland', code: 'FI', hasStates: false, tz: 'Europe/Helsinki' },
  { name: 'Ireland', code: 'IE', hasStates: false, tz: 'Europe/Dublin' },
  { name: 'Portugal', code: 'PT', hasStates: false, tz: 'Europe/Lisbon' },
  { name: 'Greece', code: 'GR', hasStates: false, tz: 'Europe/Athens' },
  { name: 'Poland', code: 'PL', hasStates: false, tz: 'Europe/Warsaw' },
  { name: 'Czech Republic', code: 'CZ', hasStates: false, tz: 'Europe/Prague' },
  { name: 'Romania', code: 'RO', hasStates: false, tz: 'Europe/Bucharest' },
  { name: 'Hungary', code: 'HU', hasStates: false, tz: 'Europe/Budapest' },
  { name: 'Israel', code: 'IL', hasStates: false, tz: 'Asia/Jerusalem' },
  { name: 'Turkey', code: 'TR', hasStates: false, tz: 'Europe/Istanbul' },
  { name: 'UAE', code: 'AE', hasStates: false, tz: 'Asia/Dubai' },
  { name: 'Saudi Arabia', code: 'SA', hasStates: false, tz: 'Asia/Riyadh' },
  { name: 'India', code: 'IN', hasStates: false, tz: 'Asia/Kolkata' },
  { name: 'China', code: 'CN', hasStates: false, tz: 'Asia/Shanghai' },
  { name: 'Japan', code: 'JP', hasStates: false, tz: 'Asia/Tokyo' },
  { name: 'South Korea', code: 'KR', hasStates: false, tz: 'Asia/Seoul' },
  { name: 'Singapore', code: 'SG', hasStates: false, tz: 'Asia/Singapore' },
  { name: 'Thailand', code: 'TH', hasStates: false, tz: 'Asia/Bangkok' },
  { name: 'Indonesia', code: 'ID', hasStates: false, tz: 'Asia/Jakarta' },
  { name: 'Philippines', code: 'PH', hasStates: false, tz: 'Asia/Manila' },
  { name: 'Vietnam', code: 'VN', hasStates: false, tz: 'Asia/Ho_Chi_Minh' },
  { name: 'Malaysia', code: 'MY', hasStates: false, tz: 'Asia/Kuala_Lumpur' },
  { name: 'New Zealand', code: 'NZ', hasStates: false, tz: 'Pacific/Auckland' },
  { name: 'Brazil', code: 'BR', hasStates: false, tz: 'America/Sao_Paulo' },
  { name: 'Mexico', code: 'MX', hasStates: false, tz: 'America/Mexico_City' },
  { name: 'Argentina', code: 'AR', hasStates: false, tz: 'America/Argentina/Buenos_Aires' },
  { name: 'Colombia', code: 'CO', hasStates: false, tz: 'America/Bogota' },
  { name: 'Chile', code: 'CL', hasStates: false, tz: 'America/Santiago' },
  { name: 'Peru', code: 'PE', hasStates: false, tz: 'America/Lima' },
  { name: 'South Africa', code: 'ZA', hasStates: false, tz: 'Africa/Johannesburg' },
  { name: 'Nigeria', code: 'NG', hasStates: false, tz: 'Africa/Lagos' },
  { name: 'Egypt', code: 'EG', hasStates: false, tz: 'Africa/Cairo' },
  { name: 'Kenya', code: 'KE', hasStates: false, tz: 'Africa/Nairobi' },
  { name: 'Morocco', code: 'MA', hasStates: false, tz: 'Africa/Casablanca' },
  { name: 'Russia', code: 'RU', hasStates: false, tz: 'Europe/Moscow' },
  { name: 'Ukraine', code: 'UA', hasStates: false, tz: 'Europe/Kyiv' },
  { name: 'Croatia', code: 'HR', hasStates: false, tz: 'Europe/Zagreb' },
  { name: 'Bulgaria', code: 'BG', hasStates: false, tz: 'Europe/Sofia' },
  { name: 'Serbia', code: 'RS', hasStates: false, tz: 'Europe/Belgrade' },
  { name: 'Slovakia', code: 'SK', hasStates: false, tz: 'Europe/Bratislava' },
  { name: 'Slovenia', code: 'SI', hasStates: false, tz: 'Europe/Ljubljana' },
  { name: 'Estonia', code: 'EE', hasStates: false, tz: 'Europe/Tallinn' },
  { name: 'Latvia', code: 'LV', hasStates: false, tz: 'Europe/Riga' },
  { name: 'Lithuania', code: 'LT', hasStates: false, tz: 'Europe/Vilnius' },
  { name: 'Iceland', code: 'IS', hasStates: false, tz: 'Atlantic/Reykjavik' },
  { name: 'Luxembourg', code: 'LU', hasStates: false, tz: 'Europe/Luxembourg' },
  { name: 'Cyprus', code: 'CY', hasStates: false, tz: 'Asia/Nicosia' },
  { name: 'Malta', code: 'MT', hasStates: false, tz: 'Europe/Malta' },
  { name: 'Taiwan', code: 'TW', hasStates: false, tz: 'Asia/Taipei' },
  { name: 'Hong Kong', code: 'HK', hasStates: false, tz: 'Asia/Hong_Kong' },
  { name: 'Pakistan', code: 'PK', hasStates: false, tz: 'Asia/Karachi' },
  { name: 'Bangladesh', code: 'BD', hasStates: false, tz: 'Asia/Dhaka' },
  { name: 'Sri Lanka', code: 'LK', hasStates: false, tz: 'Asia/Colombo' },
  { name: 'Nepal', code: 'NP', hasStates: false, tz: 'Asia/Kathmandu' },
  { name: 'Jordan', code: 'JO', hasStates: false, tz: 'Asia/Amman' },
  { name: 'Lebanon', code: 'LB', hasStates: false, tz: 'Asia/Beirut' },
  { name: 'Qatar', code: 'QA', hasStates: false, tz: 'Asia/Qatar' },
  { name: 'Kuwait', code: 'KW', hasStates: false, tz: 'Asia/Kuwait' },
  { name: 'Bahrain', code: 'BH', hasStates: false, tz: 'Asia/Bahrain' },
  { name: 'Oman', code: 'OM', hasStates: false, tz: 'Asia/Muscat' },
];

// ─── US STATES ───────────────────────────────────────────────────────────────

const US_STATES = [
  { name: 'Alabama', code: 'AL', tz: 'America/Chicago' },
  { name: 'Alaska', code: 'AK', tz: 'America/Anchorage' },
  { name: 'Arizona', code: 'AZ', tz: 'America/Phoenix' },
  { name: 'Arkansas', code: 'AR', tz: 'America/Chicago' },
  { name: 'California', code: 'CA', tz: 'America/Los_Angeles' },
  { name: 'Colorado', code: 'CO', tz: 'America/Denver' },
  { name: 'Connecticut', code: 'CT', tz: 'America/New_York' },
  { name: 'Delaware', code: 'DE', tz: 'America/New_York' },
  { name: 'Florida', code: 'FL', tz: 'America/New_York' },
  { name: 'Georgia', code: 'GA', tz: 'America/New_York' },
  { name: 'Hawaii', code: 'HI', tz: 'Pacific/Honolulu' },
  { name: 'Idaho', code: 'ID', tz: 'America/Boise' },
  { name: 'Illinois', code: 'IL', tz: 'America/Chicago' },
  { name: 'Indiana', code: 'IN', tz: 'America/Indiana/Indianapolis' },
  { name: 'Iowa', code: 'IA', tz: 'America/Chicago' },
  { name: 'Kansas', code: 'KS', tz: 'America/Chicago' },
  { name: 'Kentucky', code: 'KY', tz: 'America/New_York' },
  { name: 'Louisiana', code: 'LA', tz: 'America/Chicago' },
  { name: 'Maine', code: 'ME', tz: 'America/New_York' },
  { name: 'Maryland', code: 'MD', tz: 'America/New_York' },
  { name: 'Massachusetts', code: 'MA', tz: 'America/New_York' },
  { name: 'Michigan', code: 'MI', tz: 'America/Detroit' },
  { name: 'Minnesota', code: 'MN', tz: 'America/Chicago' },
  { name: 'Mississippi', code: 'MS', tz: 'America/Chicago' },
  { name: 'Missouri', code: 'MO', tz: 'America/Chicago' },
  { name: 'Montana', code: 'MT', tz: 'America/Denver' },
  { name: 'Nebraska', code: 'NE', tz: 'America/Chicago' },
  { name: 'Nevada', code: 'NV', tz: 'America/Los_Angeles' },
  { name: 'New Hampshire', code: 'NH', tz: 'America/New_York' },
  { name: 'New Jersey', code: 'NJ', tz: 'America/New_York' },
  { name: 'New Mexico', code: 'NM', tz: 'America/Denver' },
  { name: 'New York', code: 'NY', tz: 'America/New_York' },
  { name: 'North Carolina', code: 'NC', tz: 'America/New_York' },
  { name: 'North Dakota', code: 'ND', tz: 'America/Chicago' },
  { name: 'Ohio', code: 'OH', tz: 'America/New_York' },
  { name: 'Oklahoma', code: 'OK', tz: 'America/Chicago' },
  { name: 'Oregon', code: 'OR', tz: 'America/Los_Angeles' },
  { name: 'Pennsylvania', code: 'PA', tz: 'America/New_York' },
  { name: 'Rhode Island', code: 'RI', tz: 'America/New_York' },
  { name: 'South Carolina', code: 'SC', tz: 'America/New_York' },
  { name: 'South Dakota', code: 'SD', tz: 'America/Chicago' },
  { name: 'Tennessee', code: 'TN', tz: 'America/Chicago' },
  { name: 'Texas', code: 'TX', tz: 'America/Chicago' },
  { name: 'Utah', code: 'UT', tz: 'America/Denver' },
  { name: 'Vermont', code: 'VT', tz: 'America/New_York' },
  { name: 'Virginia', code: 'VA', tz: 'America/New_York' },
  { name: 'Washington', code: 'WA', tz: 'America/Los_Angeles' },
  { name: 'West Virginia', code: 'WV', tz: 'America/New_York' },
  { name: 'Wisconsin', code: 'WI', tz: 'America/Chicago' },
  { name: 'Wyoming', code: 'WY', tz: 'America/Denver' },
  { name: 'District of Columbia', code: 'DC', tz: 'America/New_York' },
];

// ─── CANADIAN PROVINCES ──────────────────────────────────────────────────────

const CA_PROVINCES = [
  { name: 'Alberta', code: 'AB', tz: 'America/Edmonton' },
  { name: 'British Columbia', code: 'BC', tz: 'America/Vancouver' },
  { name: 'Manitoba', code: 'MB', tz: 'America/Winnipeg' },
  { name: 'New Brunswick', code: 'NB', tz: 'America/Moncton' },
  { name: 'Newfoundland and Labrador', code: 'NL', tz: 'America/St_Johns' },
  { name: 'Nova Scotia', code: 'NS', tz: 'America/Halifax' },
  { name: 'Ontario', code: 'ON', tz: 'America/Toronto' },
  { name: 'Prince Edward Island', code: 'PE', tz: 'America/Halifax' },
  { name: 'Quebec', code: 'QC', tz: 'America/Montreal' },
  { name: 'Saskatchewan', code: 'SK', tz: 'America/Regina' },
];

// ─── AUSTRALIAN STATES ───────────────────────────────────────────────────────

const AU_STATES = [
  { name: 'Australian Capital Territory', code: 'ACT', tz: 'Australia/Canberra' },
  { name: 'New South Wales', code: 'NSW', tz: 'Australia/Sydney' },
  { name: 'Northern Territory', code: 'NT', tz: 'Australia/Darwin' },
  { name: 'Queensland', code: 'QLD', tz: 'Australia/Brisbane' },
  { name: 'South Australia', code: 'SA', tz: 'Australia/Adelaide' },
  { name: 'Tasmania', code: 'TAS', tz: 'Australia/Hobart' },
  { name: 'Victoria', code: 'VIC', tz: 'Australia/Melbourne' },
  { name: 'Western Australia', code: 'WA', tz: 'Australia/Perth' },
];

function getStatesForCountry(countryName) {
  if (!countryName) return [];
  const normalized = countryName.trim();
  if (normalized === 'United States' || normalized === 'US' || normalized === 'USA') return US_STATES;
  if (normalized === 'Canada' || normalized === 'CA') return CA_PROVINCES;
  if (normalized === 'Australia' || normalized === 'AU') return AU_STATES;
  return [];
}

function getTimezone(country, state) {
  if (state) {
    const states = getStatesForCountry(country);
    const found = states.find(s => s.name === state || s.code === state);
    if (found) return found.tz;
  }
  if (country) {
    const found = COUNTRIES.find(c => c.name === country || c.code === country);
    if (found) return found.tz;
  }
  return null;
}

// ─── LIVE CLOCK COMPONENT ────────────────────────────────────────────────────

function LiveClock({ timezone }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    if (!timezone) return;
    const update = () => {
      try {
        const now = new Date();
        const formatted = now.toLocaleString('en-US', {
          timeZone: timezone,
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          weekday: 'short',
        });
        setTime(formatted);
      } catch { setTime(''); }
    };
    update();
    const interval = setInterval(update, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [timezone]);

  if (!time) return null;

  return (
    <span style={{
      background: '#EBF4FF', color: '#1a6fad', fontSize: 11, fontWeight: 600,
      padding: '3px 10px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      🕐 {time}
    </span>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

/**
 * LocationSelector — Country + State dropdowns with live clock
 * 
 * Props:
 * - country: string (current value)
 * - state: string (current value)
 * - onCountryChange: (value) => void
 * - onStateChange: (value) => void
 * - editable: boolean (default true)
 * - labelStyle: object
 * - inputStyle: object
 */
export default function LocationSelector({ country, state, onCountryChange, onStateChange, editable = true, labelStyle, inputStyle }) {
  const states = getStatesForCountry(country);
  const hasStates = states.length > 0;
  const timezone = getTimezone(country, state);

  const defaultLabelStyle = {
    color: '#717182', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase',
    display: 'block', marginBottom: 5,
  };

  const defaultInputStyle = {
    width: '100%', background: '#F5F3EF', border: '1px solid rgba(62,66,61,0.1)', borderRadius: 6,
    padding: '6px 10px', color: '#3E423D', fontSize: 13, boxSizing: 'border-box', outline: 'none',
    fontFamily: 'Inter, sans-serif', height: 35,
  };

  const ls = labelStyle || defaultLabelStyle;
  const is = inputStyle || defaultInputStyle;

  return (
    <>
      {/* Country */}
      <div>
        <label style={ls}>Country</label>
        {editable ? (
          <select value={country || ''} onChange={e => {
            onCountryChange(e.target.value);
            // Clear state when country changes
            if (onStateChange) onStateChange('');
        }} style={{ ...is, height: 35 }}>
            <option value="">Select country...</option>
            {[...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)).map(c => (
              <option key={c.code} value={c.name}>{c.name}</option>
            ))}
          </select>
        ) : (
          <p style={{ color: country ? '#1a1d1a' : '#CBCED4', fontSize: 13, fontWeight: country ? 500 : 400, margin: 0, padding: '6px 10px', background: '#F5F3EF', borderRadius: 6 }}>
            {country || '—'}
          </p>
        )}
      </div>

      {/* State (only if country has states) */}
      {hasStates && (
        <div>c
          <label style={ls}>{country === 'Canada' ? 'Province' : 'State'}</label>
          {editable ? (
            <select value={state || ''} onChange={e => onStateChange(e.target.value)} style={{ ...is, height: 35 }}>
              <option value="">Select {country === 'Canada' ? 'province' : 'state'}...</option>
              {states.map(s => (
                <option key={s.code} value={s.name}>{s.name}</option>
              ))}
            </select>
          ) : (
            <p style={{ color: state ? '#1a1d1a' : '#CBCED4', fontSize: 13, fontWeight: state ? 500 : 400, margin: 0, padding: '6px 10px', background: '#F5F3EF', borderRadius: 6 }}>
              {state || '—'}
            </p>
          )}
        </div>
      )}

      {/* Live Clock */}
      {timezone && (
        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
          <LiveClock timezone={timezone} />
        </div>
      )}
    </>
  );
}

// Export helpers for use elsewhere
export { COUNTRIES, US_STATES, CA_PROVINCES, AU_STATES, getStatesForCountry, getTimezone, LiveClock };