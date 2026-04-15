// client/src/components/LocationSelector.js
import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

// ─── ALL 195 COUNTRIES ───────────────────────────────────────────────────────

const COUNTRIES = [
  { name: 'Afghanistan', code: 'AF', hasStates: false, tz: 'Asia/Kabul' },
  { name: 'Albania', code: 'AL', hasStates: false, tz: 'Europe/Tirane' },
  { name: 'Algeria', code: 'DZ', hasStates: false, tz: 'Africa/Algiers' },
  { name: 'Andorra', code: 'AD', hasStates: false, tz: 'Europe/Andorra' },
  { name: 'Angola', code: 'AO', hasStates: false, tz: 'Africa/Luanda' },
  { name: 'Antigua and Barbuda', code: 'AG', hasStates: false, tz: 'America/Antigua' },
  { name: 'Argentina', code: 'AR', hasStates: false, tz: 'America/Argentina/Buenos_Aires' },
  { name: 'Armenia', code: 'AM', hasStates: false, tz: 'Asia/Yerevan' },
  { name: 'Australia', code: 'AU', hasStates: true, tz: 'Australia/Sydney' },
  { name: 'Austria', code: 'AT', hasStates: false, tz: 'Europe/Vienna' },
  { name: 'Azerbaijan', code: 'AZ', hasStates: false, tz: 'Asia/Baku' },
  { name: 'Bahamas', code: 'BS', hasStates: false, tz: 'America/Nassau' },
  { name: 'Bahrain', code: 'BH', hasStates: false, tz: 'Asia/Bahrain' },
  { name: 'Bangladesh', code: 'BD', hasStates: false, tz: 'Asia/Dhaka' },
  { name: 'Barbados', code: 'BB', hasStates: false, tz: 'America/Barbados' },
  { name: 'Belarus', code: 'BY', hasStates: false, tz: 'Europe/Minsk' },
  { name: 'Belgium', code: 'BE', hasStates: false, tz: 'Europe/Brussels' },
  { name: 'Belize', code: 'BZ', hasStates: false, tz: 'America/Belize' },
  { name: 'Benin', code: 'BJ', hasStates: false, tz: 'Africa/Porto-Novo' },
  { name: 'Bhutan', code: 'BT', hasStates: false, tz: 'Asia/Thimphu' },
  { name: 'Bolivia', code: 'BO', hasStates: false, tz: 'America/La_Paz' },
  { name: 'Bosnia and Herzegovina', code: 'BA', hasStates: false, tz: 'Europe/Sarajevo' },
  { name: 'Botswana', code: 'BW', hasStates: false, tz: 'Africa/Gaborone' },
  { name: 'Brazil', code: 'BR', hasStates: false, tz: 'America/Sao_Paulo' },
  { name: 'Brunei', code: 'BN', hasStates: false, tz: 'Asia/Brunei' },
  { name: 'Bulgaria', code: 'BG', hasStates: false, tz: 'Europe/Sofia' },
  { name: 'Burkina Faso', code: 'BF', hasStates: false, tz: 'Africa/Ouagadougou' },
  { name: 'Burundi', code: 'BI', hasStates: false, tz: 'Africa/Bujumbura' },
  { name: 'Cambodia', code: 'KH', hasStates: false, tz: 'Asia/Phnom_Penh' },
  { name: 'Cameroon', code: 'CM', hasStates: false, tz: 'Africa/Douala' },
  { name: 'Canada', code: 'CA', hasStates: true, tz: 'America/Toronto' },
  { name: 'Cape Verde', code: 'CV', hasStates: false, tz: 'Atlantic/Cape_Verde' },
  { name: 'Central African Republic', code: 'CF', hasStates: false, tz: 'Africa/Bangui' },
  { name: 'Chad', code: 'TD', hasStates: false, tz: 'Africa/Ndjamena' },
  { name: 'Chile', code: 'CL', hasStates: false, tz: 'America/Santiago' },
  { name: 'China', code: 'CN', hasStates: false, tz: 'Asia/Shanghai' },
  { name: 'Colombia', code: 'CO', hasStates: false, tz: 'America/Bogota' },
  { name: 'Comoros', code: 'KM', hasStates: false, tz: 'Indian/Comoro' },
  { name: 'Congo', code: 'CG', hasStates: false, tz: 'Africa/Brazzaville' },
  { name: 'Costa Rica', code: 'CR', hasStates: false, tz: 'America/Costa_Rica' },
  { name: 'Croatia', code: 'HR', hasStates: false, tz: 'Europe/Zagreb' },
  { name: 'Cuba', code: 'CU', hasStates: false, tz: 'America/Havana' },
  { name: 'Cyprus', code: 'CY', hasStates: false, tz: 'Asia/Nicosia' },
  { name: 'Czech Republic', code: 'CZ', hasStates: false, tz: 'Europe/Prague' },
  { name: 'DR Congo', code: 'CD', hasStates: false, tz: 'Africa/Kinshasa' },
  { name: 'Denmark', code: 'DK', hasStates: false, tz: 'Europe/Copenhagen' },
  { name: 'Djibouti', code: 'DJ', hasStates: false, tz: 'Africa/Djibouti' },
  { name: 'Dominica', code: 'DM', hasStates: false, tz: 'America/Dominica' },
  { name: 'Dominican Republic', code: 'DO', hasStates: false, tz: 'America/Santo_Domingo' },
  { name: 'East Timor', code: 'TL', hasStates: false, tz: 'Asia/Dili' },
  { name: 'Ecuador', code: 'EC', hasStates: false, tz: 'America/Guayaquil' },
  { name: 'Egypt', code: 'EG', hasStates: false, tz: 'Africa/Cairo' },
  { name: 'El Salvador', code: 'SV', hasStates: false, tz: 'America/El_Salvador' },
  { name: 'Equatorial Guinea', code: 'GQ', hasStates: false, tz: 'Africa/Malabo' },
  { name: 'Eritrea', code: 'ER', hasStates: false, tz: 'Africa/Asmara' },
  { name: 'Estonia', code: 'EE', hasStates: false, tz: 'Europe/Tallinn' },
  { name: 'Eswatini', code: 'SZ', hasStates: false, tz: 'Africa/Mbabane' },
  { name: 'Ethiopia', code: 'ET', hasStates: false, tz: 'Africa/Addis_Ababa' },
  { name: 'Fiji', code: 'FJ', hasStates: false, tz: 'Pacific/Fiji' },
  { name: 'Finland', code: 'FI', hasStates: false, tz: 'Europe/Helsinki' },
  { name: 'France', code: 'FR', hasStates: false, tz: 'Europe/Paris' },
  { name: 'Gabon', code: 'GA', hasStates: false, tz: 'Africa/Libreville' },
  { name: 'Gambia', code: 'GM', hasStates: false, tz: 'Africa/Banjul' },
  { name: 'Georgia', code: 'GE', hasStates: false, tz: 'Asia/Tbilisi' },
  { name: 'Germany', code: 'DE', hasStates: false, tz: 'Europe/Berlin' },
  { name: 'Ghana', code: 'GH', hasStates: false, tz: 'Africa/Accra' },
  { name: 'Greece', code: 'GR', hasStates: false, tz: 'Europe/Athens' },
  { name: 'Grenada', code: 'GD', hasStates: false, tz: 'America/Grenada' },
  { name: 'Guatemala', code: 'GT', hasStates: false, tz: 'America/Guatemala' },
  { name: 'Guinea', code: 'GN', hasStates: false, tz: 'Africa/Conakry' },
  { name: 'Guinea-Bissau', code: 'GW', hasStates: false, tz: 'Africa/Bissau' },
  { name: 'Guyana', code: 'GY', hasStates: false, tz: 'America/Guyana' },
  { name: 'Haiti', code: 'HT', hasStates: false, tz: 'America/Port-au-Prince' },
  { name: 'Honduras', code: 'HN', hasStates: false, tz: 'America/Tegucigalpa' },
  { name: 'Hong Kong', code: 'HK', hasStates: false, tz: 'Asia/Hong_Kong' },
  { name: 'Hungary', code: 'HU', hasStates: false, tz: 'Europe/Budapest' },
  { name: 'Iceland', code: 'IS', hasStates: false, tz: 'Atlantic/Reykjavik' },
  { name: 'India', code: 'IN', hasStates: false, tz: 'Asia/Kolkata' },
  { name: 'Indonesia', code: 'ID', hasStates: false, tz: 'Asia/Jakarta' },
  { name: 'Iran', code: 'IR', hasStates: false, tz: 'Asia/Tehran' },
  { name: 'Iraq', code: 'IQ', hasStates: false, tz: 'Asia/Baghdad' },
  { name: 'Ireland', code: 'IE', hasStates: false, tz: 'Europe/Dublin' },
  { name: 'Israel', code: 'IL', hasStates: false, tz: 'Asia/Jerusalem' },
  { name: 'Italy', code: 'IT', hasStates: false, tz: 'Europe/Rome' },
  { name: 'Ivory Coast', code: 'CI', hasStates: false, tz: 'Africa/Abidjan' },
  { name: 'Jamaica', code: 'JM', hasStates: false, tz: 'America/Jamaica' },
  { name: 'Japan', code: 'JP', hasStates: false, tz: 'Asia/Tokyo' },
  { name: 'Jordan', code: 'JO', hasStates: false, tz: 'Asia/Amman' },
  { name: 'Kazakhstan', code: 'KZ', hasStates: false, tz: 'Asia/Almaty' },
  { name: 'Kenya', code: 'KE', hasStates: false, tz: 'Africa/Nairobi' },
  { name: 'Kiribati', code: 'KI', hasStates: false, tz: 'Pacific/Tarawa' },
  { name: 'Kuwait', code: 'KW', hasStates: false, tz: 'Asia/Kuwait' },
  { name: 'Kyrgyzstan', code: 'KG', hasStates: false, tz: 'Asia/Bishkek' },
  { name: 'Laos', code: 'LA', hasStates: false, tz: 'Asia/Vientiane' },
  { name: 'Latvia', code: 'LV', hasStates: false, tz: 'Europe/Riga' },
  { name: 'Lebanon', code: 'LB', hasStates: false, tz: 'Asia/Beirut' },
  { name: 'Lesotho', code: 'LS', hasStates: false, tz: 'Africa/Maseru' },
  { name: 'Liberia', code: 'LR', hasStates: false, tz: 'Africa/Monrovia' },
  { name: 'Libya', code: 'LY', hasStates: false, tz: 'Africa/Tripoli' },
  { name: 'Liechtenstein', code: 'LI', hasStates: false, tz: 'Europe/Vaduz' },
  { name: 'Lithuania', code: 'LT', hasStates: false, tz: 'Europe/Vilnius' },
  { name: 'Luxembourg', code: 'LU', hasStates: false, tz: 'Europe/Luxembourg' },
  { name: 'Madagascar', code: 'MG', hasStates: false, tz: 'Indian/Antananarivo' },
  { name: 'Malawi', code: 'MW', hasStates: false, tz: 'Africa/Blantyre' },
  { name: 'Malaysia', code: 'MY', hasStates: false, tz: 'Asia/Kuala_Lumpur' },
  { name: 'Maldives', code: 'MV', hasStates: false, tz: 'Indian/Maldives' },
  { name: 'Mali', code: 'ML', hasStates: false, tz: 'Africa/Bamako' },
  { name: 'Malta', code: 'MT', hasStates: false, tz: 'Europe/Malta' },
  { name: 'Marshall Islands', code: 'MH', hasStates: false, tz: 'Pacific/Majuro' },
  { name: 'Mauritania', code: 'MR', hasStates: false, tz: 'Africa/Nouakchott' },
  { name: 'Mauritius', code: 'MU', hasStates: false, tz: 'Indian/Mauritius' },
  { name: 'Mexico', code: 'MX', hasStates: false, tz: 'America/Mexico_City' },
  { name: 'Micronesia', code: 'FM', hasStates: false, tz: 'Pacific/Pohnpei' },
  { name: 'Moldova', code: 'MD', hasStates: false, tz: 'Europe/Chisinau' },
  { name: 'Monaco', code: 'MC', hasStates: false, tz: 'Europe/Monaco' },
  { name: 'Mongolia', code: 'MN', hasStates: false, tz: 'Asia/Ulaanbaatar' },
  { name: 'Montenegro', code: 'ME', hasStates: false, tz: 'Europe/Podgorica' },
  { name: 'Morocco', code: 'MA', hasStates: false, tz: 'Africa/Casablanca' },
  { name: 'Mozambique', code: 'MZ', hasStates: false, tz: 'Africa/Maputo' },
  { name: 'Myanmar', code: 'MM', hasStates: false, tz: 'Asia/Rangoon' },
  { name: 'Namibia', code: 'NA', hasStates: false, tz: 'Africa/Windhoek' },
  { name: 'Nauru', code: 'NR', hasStates: false, tz: 'Pacific/Nauru' },
  { name: 'Nepal', code: 'NP', hasStates: false, tz: 'Asia/Kathmandu' },
  { name: 'Netherlands', code: 'NL', hasStates: false, tz: 'Europe/Amsterdam' },
  { name: 'New Zealand', code: 'NZ', hasStates: false, tz: 'Pacific/Auckland' },
  { name: 'Nicaragua', code: 'NI', hasStates: false, tz: 'America/Managua' },
  { name: 'Niger', code: 'NE', hasStates: false, tz: 'Africa/Niamey' },
  { name: 'Nigeria', code: 'NG', hasStates: false, tz: 'Africa/Lagos' },
  { name: 'North Korea', code: 'KP', hasStates: false, tz: 'Asia/Pyongyang' },
  { name: 'North Macedonia', code: 'MK', hasStates: false, tz: 'Europe/Skopje' },
  { name: 'Norway', code: 'NO', hasStates: false, tz: 'Europe/Oslo' },
  { name: 'Oman', code: 'OM', hasStates: false, tz: 'Asia/Muscat' },
  { name: 'Pakistan', code: 'PK', hasStates: false, tz: 'Asia/Karachi' },
  { name: 'Palau', code: 'PW', hasStates: false, tz: 'Pacific/Palau' },
  { name: 'Palestine', code: 'PS', hasStates: false, tz: 'Asia/Gaza' },
  { name: 'Panama', code: 'PA', hasStates: false, tz: 'America/Panama' },
  { name: 'Papua New Guinea', code: 'PG', hasStates: false, tz: 'Pacific/Port_Moresby' },
  { name: 'Paraguay', code: 'PY', hasStates: false, tz: 'America/Asuncion' },
  { name: 'Peru', code: 'PE', hasStates: false, tz: 'America/Lima' },
  { name: 'Philippines', code: 'PH', hasStates: false, tz: 'Asia/Manila' },
  { name: 'Poland', code: 'PL', hasStates: false, tz: 'Europe/Warsaw' },
  { name: 'Portugal', code: 'PT', hasStates: false, tz: 'Europe/Lisbon' },
  { name: 'Qatar', code: 'QA', hasStates: false, tz: 'Asia/Qatar' },
  { name: 'Romania', code: 'RO', hasStates: false, tz: 'Europe/Bucharest' },
  { name: 'Russia', code: 'RU', hasStates: false, tz: 'Europe/Moscow' },
  { name: 'Rwanda', code: 'RW', hasStates: false, tz: 'Africa/Kigali' },
  { name: 'Saint Kitts and Nevis', code: 'KN', hasStates: false, tz: 'America/St_Kitts' },
  { name: 'Saint Lucia', code: 'LC', hasStates: false, tz: 'America/St_Lucia' },
  { name: 'Saint Vincent and the Grenadines', code: 'VC', hasStates: false, tz: 'America/St_Vincent' },
  { name: 'Samoa', code: 'WS', hasStates: false, tz: 'Pacific/Apia' },
  { name: 'San Marino', code: 'SM', hasStates: false, tz: 'Europe/San_Marino' },
  { name: 'Sao Tome and Principe', code: 'ST', hasStates: false, tz: 'Africa/Sao_Tome' },
  { name: 'Saudi Arabia', code: 'SA', hasStates: false, tz: 'Asia/Riyadh' },
  { name: 'Senegal', code: 'SN', hasStates: false, tz: 'Africa/Dakar' },
  { name: 'Serbia', code: 'RS', hasStates: false, tz: 'Europe/Belgrade' },
  { name: 'Seychelles', code: 'SC', hasStates: false, tz: 'Indian/Mahe' },
  { name: 'Sierra Leone', code: 'SL', hasStates: false, tz: 'Africa/Freetown' },
  { name: 'Singapore', code: 'SG', hasStates: false, tz: 'Asia/Singapore' },
  { name: 'Slovakia', code: 'SK', hasStates: false, tz: 'Europe/Bratislava' },
  { name: 'Slovenia', code: 'SI', hasStates: false, tz: 'Europe/Ljubljana' },
  { name: 'Solomon Islands', code: 'SB', hasStates: false, tz: 'Pacific/Guadalcanal' },
  { name: 'Somalia', code: 'SO', hasStates: false, tz: 'Africa/Mogadishu' },
  { name: 'South Africa', code: 'ZA', hasStates: false, tz: 'Africa/Johannesburg' },
  { name: 'South Korea', code: 'KR', hasStates: false, tz: 'Asia/Seoul' },
  { name: 'South Sudan', code: 'SS', hasStates: false, tz: 'Africa/Juba' },
  { name: 'Spain', code: 'ES', hasStates: false, tz: 'Europe/Madrid' },
  { name: 'Sri Lanka', code: 'LK', hasStates: false, tz: 'Asia/Colombo' },
  { name: 'Sudan', code: 'SD', hasStates: false, tz: 'Africa/Khartoum' },
  { name: 'Suriname', code: 'SR', hasStates: false, tz: 'America/Paramaribo' },
  { name: 'Sweden', code: 'SE', hasStates: false, tz: 'Europe/Stockholm' },
  { name: 'Switzerland', code: 'CH', hasStates: false, tz: 'Europe/Zurich' },
  { name: 'Syria', code: 'SY', hasStates: false, tz: 'Asia/Damascus' },
  { name: 'Taiwan', code: 'TW', hasStates: false, tz: 'Asia/Taipei' },
  { name: 'Tajikistan', code: 'TJ', hasStates: false, tz: 'Asia/Dushanbe' },
  { name: 'Tanzania', code: 'TZ', hasStates: false, tz: 'Africa/Dar_es_Salaam' },
  { name: 'Thailand', code: 'TH', hasStates: false, tz: 'Asia/Bangkok' },
  { name: 'Togo', code: 'TG', hasStates: false, tz: 'Africa/Lome' },
  { name: 'Tonga', code: 'TO', hasStates: false, tz: 'Pacific/Tongatapu' },
  { name: 'Trinidad and Tobago', code: 'TT', hasStates: false, tz: 'America/Port_of_Spain' },
  { name: 'Tunisia', code: 'TN', hasStates: false, tz: 'Africa/Tunis' },
  { name: 'Turkey', code: 'TR', hasStates: false, tz: 'Europe/Istanbul' },
  { name: 'Turkmenistan', code: 'TM', hasStates: false, tz: 'Asia/Ashgabat' },
  { name: 'Tuvalu', code: 'TV', hasStates: false, tz: 'Pacific/Funafuti' },
  { name: 'UAE', code: 'AE', hasStates: false, tz: 'Asia/Dubai' },
  { name: 'Uganda', code: 'UG', hasStates: false, tz: 'Africa/Kampala' },
  { name: 'Ukraine', code: 'UA', hasStates: false, tz: 'Europe/Kyiv' },
  { name: 'United Kingdom', code: 'GB', hasStates: false, tz: 'Europe/London' },
  { name: 'United States', code: 'US', hasStates: true, tz: 'America/New_York' },
  { name: 'Uruguay', code: 'UY', hasStates: false, tz: 'America/Montevideo' },
  { name: 'Uzbekistan', code: 'UZ', hasStates: false, tz: 'Asia/Tashkent' },
  { name: 'Vanuatu', code: 'VU', hasStates: false, tz: 'Pacific/Efate' },
  { name: 'Vatican City', code: 'VA', hasStates: false, tz: 'Europe/Vatican' },
  { name: 'Venezuela', code: 'VE', hasStates: false, tz: 'America/Caracas' },
  { name: 'Vietnam', code: 'VN', hasStates: false, tz: 'Asia/Ho_Chi_Minh' },
  { name: 'Yemen', code: 'YE', hasStates: false, tz: 'Asia/Aden' },
  { name: 'Zambia', code: 'ZM', hasStates: false, tz: 'Africa/Lusaka' },
  { name: 'Zimbabwe', code: 'ZW', hasStates: false, tz: 'Africa/Harare' },
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

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getStatesForCountry(countryName) {
  if (!countryName) return [];
  const n = countryName.trim();
  if (n === 'United States' || n === 'US' || n === 'USA') return US_STATES;
  if (n === 'Canada' || n === 'CA') return CA_PROVINCES;
  if (n === 'Australia' || n === 'AU') return AU_STATES;
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

// ─── LIVE CLOCK ──────────────────────────────────────────────────────────────

function LiveClock({ timezone }) {
  const [time, setTime] = useState('');
  useEffect(() => {
    if (!timezone) return;
    const update = () => {
      try { setTime(new Date().toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true, weekday: 'short' })); }
      catch { setTime(''); }
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [timezone]);
  if (!time) return null;
  return (
    <span style={{ background: '#EBF4FF', color: '#1a6fad', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      🕐 {time}
    </span>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function LocationSelector({ country, state, onCountryChange, onStateChange, editable = true, labelStyle, inputStyle }) {
  const { palette: p } = useApp();

  const states = getStatesForCountry(country);
  const hasStates = states.length > 0;
  const timezone = getTimezone(country, state);

  const defaultLabelStyle = { color: p.textSecondary, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 5 };
  const defaultInputStyle = { width: '100%', background: p.inputBg, border: `1px solid ${p.inputBorder}`, borderRadius: 6, padding: '6px 10px', color: p.text, fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif', height: 35 };

  const ls = labelStyle || defaultLabelStyle;
  const is = inputStyle || defaultInputStyle;

  // Sorted alphabetically for the dropdown
  const sortedCountries = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <div>
        <label style={ls}>Country</label>
        {editable ? (
          <select value={country || ''} onChange={e => { onCountryChange(e.target.value); if (onStateChange) onStateChange(''); }} style={{ ...is, height: 35 }}>
            <option value="">Select country...</option>
            {sortedCountries.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
          </select>
        ) : (
          <p style={{ color: country ? p.text : p.textMuted, fontSize: 13, fontWeight: country ? 500 : 400, margin: 0, padding: '6px 10px', background: p.inputBg, borderRadius: 6 }}>
            {country || '—'}
          </p>
        )}
      </div>

      {hasStates && (
        <div>
          <label style={ls}>{country === 'Canada' ? 'Province' : 'State'}</label>
          {editable ? (
            <select value={state || ''} onChange={e => onStateChange(e.target.value)} style={{ ...is, height: 35 }}>
              <option value="">Select {country === 'Canada' ? 'province' : 'state'}...</option>
              {states.map(s => <option key={s.code} value={s.name}>{s.name}</option>)}
            </select>
          ) : (
            <p style={{ color: state ? p.text : p.textMuted, fontSize: 13, fontWeight: state ? 500 : 400, margin: 0, padding: '6px 10px', background: p.inputBg, borderRadius: 6 }}>
              {state || '—'}
            </p>
          )}
        </div>
      )}

      {timezone && (
        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
          <LiveClock timezone={timezone} />
        </div>
      )}
    </>
  );
}

export { COUNTRIES, US_STATES, CA_PROVINCES, AU_STATES, getStatesForCountry, getTimezone, LiveClock };