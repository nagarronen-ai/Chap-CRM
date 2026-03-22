# Planfor CRM

Internal sales CRM built for the Planfor.io team to manage wedding vendor outreach, convert leads to clients, send emails via Gmail API or SendGrid, sync inbox conversations, run marketing campaigns, schedule meetings with Google Calendar, manage client relationships, and track internal company finances — all in one place.

**Live:** [crm.planfor.io](https://crm.planfor.io) · **API:** [planfor-crm-api.onrender.com](https://planfor-crm-api.onrender.com)

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture: Email & Calendar](#architecture-email--calendar)
- [Features](#features)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Roles & Permissions](#roles--permissions)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Email System](#email-system)
- [Gmail Integration](#gmail-integration)
- [Calendar & Meetings](#calendar--meetings)
- [Marketing & Campaigns](#marketing--campaigns)
- [Client Management](#client-management)
- [Finance Module](#finance-module)
- [File Uploads](#file-uploads)
- [Design System](#design-system)
- [Changelog](#changelog)
- [Roadmap](#roadmap)

---

## Overview

Planfor CRM is a full-stack internal tool that allows the Planfor sales team to:

- Import wedding vendor leads from Apollo CSV exports
- Track companies and contacts through a visual sales pipeline
- Convert won deals into managed clients with contract tracking
- Send direct emails via Gmail API (with SendGrid fallback) using reusable templates with merge tags
- Two-way email sync — automatically capture inbound/outbound emails matching CRM contacts
- View a dedicated Email Inbox page with thread grouping and unread badges
- Schedule meetings with Google Calendar integration (Google Meet auto-link, timezone conversion)
- Run bulk marketing campaigns with open/click tracking via SendGrid
- Manage client vendor pages, documents, and finance
- Upload documents and receipts to Supabase Storage
- Track internal company expenses (servers, domains, tools, etc.)
- Monitor pipeline health, upcoming meetings, and team performance from a real-time dashboard
- Manage marketing unsubscribes with bulk resubscribe capabilities

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 (CRA), React Router, Axios, Tiptap Editor |
| Backend | Node.js, Express, Multer |
| Database | Supabase (PostgreSQL) |
| File Storage | Supabase Storage (client-documents, receipts buckets) |
| Auth | JWT (stored in localStorage) |
| Email — Direct | Gmail API (primary), SendGrid (fallback) |
| Email — Marketing | SendGrid (bulk send with webhook tracking) |
| Calendar | Google Calendar API (read/write sync) |
| OAuth | Google OAuth 2.0 (Gmail + Calendar scopes) |
| Rich Text | Tiptap (ProseMirror-based, React 19 compatible) |
| Styling | Inline styles with custom design system |
| Fonts | Playfair Display (serif), Inter (sans-serif) |
| Deployment | Cloudflare Pages (frontend), Render (backend) |
| DNS | Cloudflare |

---

## Architecture: Email & Calendar

```
┌─────────────────────────────────────────────────────────────────┐
│                        PLANFOR CRM                              │
├─────────────────────┬───────────────────────────────────────────┤
│   DIRECT EMAILS     │   MARKETING EMAILS                       │
│   (1-to-1)          │   (bulk campaigns)                       │
│                     │                                           │
│   Gmail API ────┐   │   SendGrid ──────┐                       │
│   (rep's email) │   │   (marketing@)   │                       │
│                 ▼   │                  ▼                        │
│   ┌───────────────┐ │   ┌───────────────┐                      │
│   │ Send from     │ │   │ Bulk send     │                      │
│   │ @planfor.io   │ │   │ with tracking │                      │
│   └───────┬───────┘ │   └───────┬───────┘                      │
│           │         │           │                               │
│           ▼         │           ▼                               │
│   ┌───────────────┐ │   ┌───────────────┐                      │
│   │ Smart Sync    │ │   │ Webhook       │                      │
│   │ (replies)     │ │   │ (opens/clicks)│                      │
│   └───────┬───────┘ │   └───────┬───────┘                      │
│           │         │           │                               │
│           ▼         │           ▼                               │
│   ┌─────────────────────────────────────┐                      │
│   │        Company / Client Profile     │                      │
│   │        Activity Timeline            │                      │
│   └─────────────────────────────────────┘                      │
├─────────────────────────────────────────────────────────────────┤
│   CALENDAR                                                      │
│                                                                  │
│   Google Calendar API ◄──► CRM Calendar Page                    │
│        │                    (Month/Week/Day)                     │
│        │                                                         │
│        ├── Create meetings from CRM → Push to Google Calendar   │
│        ├── Google Meet link auto-generated                       │
│        ├── Timezone conversion (US state → IANA)                │
│        └── Upcoming widget on Dashboard (next 7 days)           │
└─────────────────────────────────────────────────────────────────┘
```

### Smart Selective Sync (Gmail)

```
Gmail Inbox          CRM Database
    │                    │
    │  Every 3 min       │
    │  ──────────►       │
    │                    │
    │  Check sender/     │
    │  recipient email   │
    │       │            │
    │       ▼            │
    │  Match against     │
    │  crm_people +      │
    │  crm_clients       │
    │       │            │
    │   ┌───┴───┐        │
    │   │Match? │        │
    │   └───┬───┘        │
    │   Yes │  No        │
    │   ▼   │  ▼         │
    │ Ingest │ Skip      │
    │ to CRM │ (ignore)  │
    │       │            │
    └───────┴────────────┘
```

---

## Features

### Dashboard (v3)
- Top KPI bar: Contacts, People, Active Pipeline, Clients, Emails Sent, Campaigns, Expenses
- Pipeline breakdown by stage with horizontal bar chart and Won/Lost/Converted counts
- Client overview with stage breakdown (Onboarding, Active, Paused, Churned)
- Email performance: sent, open rate, click rate, bounced + campaign stats
- **Upcoming Meetings widget** — next 7 days, pulls from Google Calendar API + enriched with CRM data
- **Needs Completion widget** — past meetings needing completion, with inline Complete/No-show buttons and notes
- Stale leads section (contacts with no activity in 7+ days)
- Paginated activity feed (5 per page)
- Team performance: per-person leads + clients count
- Finance summary: this month, this year, pending, overdue

### Contacts (Company-First Architecture)
- Company list with search, stage filter, and origin filter
- "Converted" badge for companies that became clients (blue pill)
- Inline stage editing from the list view
- Duplicate detection on company name — prompts to add person to existing company
- CSV import from Apollo with 4-step flow: Upload → Select Rows → Review Groups → Done
- Auto-groups contacts by company name during import

### Company Profile
- Pipeline stepper — click any stage to update instantly
- Status bar: Last Activity, Next Action, Origin + Location, Assigned To (reassignable)
- **Overview tab** — Contact Info, Business, Social in 3-column grid, inline editing, people list, quick notes
- **People tab** — full contact list with add/edit/remove
- **Activity tab** — paginated timeline (5/10/25/50 per page), filterable by person, expandable email view
- **Meetings tab** — meeting history with summary cards (total/completed/scheduled/cancelled), completion flow with notes, status badges, Google Meet links
- **Emails tab** — unified direct + campaign emails with delivery/open/click tracking
- **Marketing tab** — per-contact campaign history, per-person unsubscribe management
- **📧 Send Email** button — Gmail API (primary) or SendGrid (fallback), with Gmail/SendGrid indicator badge
- **📅 Schedule Meeting** button — opens reusable modal with timezone conversion, contact person selection
- **🤝 Convert to Client** button (Closed Won stage) — contract type, commission/amount, signed date
- Global signature toggle in email composer (include/exclude)

### Client Profile
- Client stage stepper (Onboarding → Active → Paused → Churned)
- Contract management (RevShare, Commission, Subscription) with dynamic fields
- **Overview** — full details, people from original contact, quick notes
- **Activity** — combined CRM activity + synced Gmail emails, sorted chronologically
- **Meetings** — meeting history with summary cards, completion flow, notes display, status badges
- **Documents** — upload/manage contracts, proposals, invoices with file attachments
- **Emails** — 3 sections: Client emails (since conversion), Contact history (before conversion), Campaign history
- **Vendor Page** — marketplace listing editor (amenities, venue types, ceremonies, pricing, publish toggle)
- **Finance** — transaction tracking (Commission, Settlement, Refund, Fee) with totals
- **📧 Send Email** + **📅 Schedule Meeting** buttons in header

### Settings Page
- **Connected Gmail Accounts** — personal + shared, connect/disconnect via OAuth
- **Email Signature** — global HTML editor with live preview
- **Timezone** — worldwide list via `Intl.supportedValuesOf('timeZone')`
- Permission guards: only admins can connect shared accounts

### Email Templates
- Create, edit, delete reusable templates with team/private visibility
- Categories: Outreach, Follow-up, Proposal, Meeting Confirmation, General
- Tiptap visual editor + raw HTML editor
- Merge tags sidebar (click or drag & drop)
- Live preview with sample data
- Global signature preview (pulled from Settings, read-only in template editor)

### Email Inbox
- Dedicated page: all synced email threads grouped by `gmail_thread_id`
- Filters: All / Unread / Received / Sent + search
- Thread expansion: full conversation chronologically
- "View Client/Contact" quick-link buttons per thread
- **Quick Reply** — reply directly from inbox with inline composer, Gmail threading, quoted previous message
- "Sync Now" button for manual trigger
- **Unread count badge in sidebar** (polls every 60 seconds)

### Calendar
- Full-page calendar: Month / Week / Day views
- Pulls events from Google Calendar API (read/write sync)
- Create meetings: Google Meet (auto-link) or Phone Call
- **Timezone conversion** — auto-detect client timezone from US state, preview shows client time vs your time
- Meetings linked to companies/clients, logged to activity timeline
- Cancel meeting removes from Google Calendar
- Fixed-height cells (month + week) — events don't expand layout

### Marketing Campaigns
- Campaign builder: Content → Recipients → Review & Send
- Source filter: All / Contacts Only / Clients Only
- Tiptap visual + HTML side-by-side editor
- Unsubscribed sub-tab with bulk resubscribe
- Per-person unsubscribe via SendGrid webhook
- Converted companies excluded from contact recipients

### Finance Module
- Internal expense tracker (admin + finance roles)
- Client finance: per-client transactions (Commission, Settlement, Refund, Fee)
- Receipt upload to Supabase Storage
- Summary cards, category/status filters

### Team Management
- View, invite, manage CRM users
- Role assignment: admin, sales, marketing, csm, support, finance
- Admin-only access

---

## Project Structure

```
venueflow-crm/
├── server/
│   ├── routes/
│   │   ├── auth.js          # Login, JWT generation
│   │   ├── contacts.js      # Companies, people, activity, notes
│   │   ├── clients.js       # Client CRUD, conversion, documents, vendor page, finance
│   │   ├── emails.js        # Templates, sent emails, Gmail/SendGrid dual send
│   │   ├── google.js        # Gmail OAuth flow, token management, refresh
│   │   ├── sync.js          # Gmail inbox sync, unread count, inbox queries
│   │   ├── calendar.js      # Google Calendar events, meetings CRUD, upcoming
│   │   ├── marketing.js     # Campaigns, bulk send, webhook, stats, unsub mgmt
│   │   ├── finance.js       # Company expenses
│   │   ├── uploads.js       # Supabase Storage file upload/delete
│   │   └── users.js         # Team mgmt, user profile, signature, timezone
│   ├── services/
│   │   └── gmailSync.js     # Smart selective sync engine (polling + incremental)
│   ├── middleware/
│   │   ├── auth.js          # JWT verification middleware
│   │   └── rbac.js          # Role-based access control
│   ├── db.js                # Supabase client
│   └── index.js             # Express app entry point + sync interval
├── client/
│   └── src/
│       ├── hooks/
│       │   └── useRole.js   # Frontend permission hook
│       ├── pages/
│       │   ├── Login.js
│       │   ├── Dashboard.js         # v3 — with upcoming meetings widget
│       │   ├── Contacts.js          # Company list with Converted badge
│       │   ├── CompanyProfile.js    # Overview, email composer, meeting modal
│       │   ├── Clients.js           # Client list with stage filters
│       │   ├── ClientProfile.js     # 6-tab profile, synced emails, meeting modal
│       │   ├── Import.js
│       │   ├── Emails.js            # Templates with global signature preview
│       │   ├── EmailInbox.js        # Synced email threads, filters, unread
│       │   ├── Calendar.js          # Month/Week/Day views, Google Calendar sync
│       │   ├── Settings.js          # Gmail accounts, signature, timezone
│       │   ├── Marketing.js         # Campaigns + Unsubscribed sub-tabs
│       │   ├── Finance.js           # Expenses with receipt upload
│       │   └── Team.js
│       ├── components/
│       │   ├── Sidebar.js           # Nav with unread email badge
│       │   ├── TiptapEditor.js      # Reusable Tiptap rich text editor
│       │   └── ScheduleMeetingModal.js  # Reusable meeting creation modal
│       └── App.js
├── .env
├── .gitignore
└── README.md
```

---

## Database Schema

### `crm_users`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| email | text | Unique |
| password | text | bcrypt |
| name | text | Full name |
| role | text | admin / sales / marketing / csm / support / finance |
| timezone | text | IANA timezone (e.g. Asia/Jerusalem) |
| email_signature | text | Global HTML email signature |
| last_login | timestamp | |
| created_at | timestamp | |

### `crm_companies`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → crm_users |
| assigned_to | uuid | FK → crm_users (optional) |
| company_name | text | |
| website, category, business_type, industry, employees, annual_revenue | text | Business fields |
| stage | text | Pipeline stage (incl. "Converted") |
| origin | text | Upload / Cold / Hot / Instagram / Google / Referral |
| city, state, country, company_address | text | Location |
| company_linkedin, facebook_url, twitter_url | text | Social |
| next_action | text | Inline editable |
| marketing_unsubscribed | boolean | Legacy (per-person now) |
| created_at, updated_at | timestamp | |

### `crm_people`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| company_id | uuid | FK → crm_companies |
| first_name, last_name, title, email | text | |
| work_phone, mobile_phone | text | |
| marketing_unsubscribed | boolean | Per-person flag |
| marketing_unsubscribed_at | timestamp | |

### `crm_google_accounts` *(new in v1.4)*
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → crm_users |
| email | text | Google account email |
| access_token | text | OAuth access token |
| refresh_token | text | OAuth refresh token |
| token_expiry | timestamp | Token expiration |
| account_type | text | personal / shared |
| label | text | Display label |
| is_active | boolean | Connection status |
| scopes | text | Granted OAuth scopes |
| last_history_id | text | Gmail incremental sync cursor |
| last_sync_at | timestamp | Last successful sync |
| created_at | timestamp | |

### `crm_emails_sent`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| company_id | uuid | FK → crm_companies |
| person_id | uuid | FK → crm_people (optional) |
| subject, body_html, status, email_status | text | |
| gmail_message_id | text | Gmail API message ID *(new in v1.4)* |
| gmail_thread_id | text | Gmail thread ID *(new in v1.4)* |
| send_method | text | gmail / sendgrid *(new in v1.4)* |
| sendgrid_message_id | text | Webhook matching |
| opened_at, clicked_at, bounced_at, sent_at | timestamp | |

### `crm_synced_emails` *(new in v1.4)*
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| google_account_id | uuid | FK → crm_google_accounts |
| gmail_message_id | text | Unique Gmail message ID |
| gmail_thread_id | text | Gmail thread ID |
| company_id | uuid | FK → crm_companies |
| client_id | uuid | FK → crm_clients (optional) |
| person_id | uuid | FK → crm_people (optional) |
| direction | text | inbound / outbound |
| subject, body_snippet, body_html | text | |
| from_email, from_name | text | |
| to_emails | jsonb | Array of recipient emails |
| email_date | timestamp | Original email date |
| is_read | boolean | |
| has_attachments | boolean | |
| attachment_count | integer | |
| synced_at | timestamp | |

### `crm_meetings` *(new in v1.4)*
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| google_event_id | text | Google Calendar event ID |
| google_account_id | uuid | FK → crm_google_accounts |
| company_id | uuid | FK → crm_companies (optional) |
| client_id | uuid | FK → crm_clients (optional) |
| person_id | uuid | FK → crm_people (optional) |
| created_by | uuid | FK → crm_users |
| title, description | text | |
| meeting_type | text | google_meet / phone |
| status | text | scheduled / confirmed / completed / cancelled |
| start_time, end_time | timestamp | UTC |
| location, meet_link | text | |
| attendees | jsonb | Array of attendee objects |
| is_internal | boolean | |
| notes | text | |
| created_at, updated_at | timestamp | |

### `crm_clients`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| converted_from | uuid | FK → crm_companies |
| assigned_to | uuid | FK → crm_users |
| business_name, contact_first_name, contact_last_name, contact_email, contact_phone | text | |
| website, address, city, state, category, business_type | text | |
| stage | text | Onboarding / Active / Paused / Churned |
| contract_type | text | RevShare / Commission / Subscription |
| commission_rate | numeric | |
| contract_amount | numeric | |
| contract_signed_date | date | |
| notes | text | |
| created_by | uuid | FK → crm_users |
| created_at, updated_at | timestamp | |

### Other Tables
- `crm_client_documents` — file attachments per client
- `crm_client_vendor_page` — marketplace listing (jsonb arrays for amenities, services, etc.)
- `crm_client_finance` — per-client transactions
- `crm_activity_log` — audit trail (company + client)
- `crm_email_templates` — reusable templates with merge tags
- `crm_campaigns` / `crm_campaign_recipients` — marketing campaigns with SendGrid webhook tracking
- `crm_expenses` — internal company expenses

---

## Roles & Permissions

| Permission | admin | sales | marketing | csm | support | finance |
|---|---|---|---|---|---|---|
| company:edit | ✅ | | | | | |
| company:delete | ✅ | | | | | |
| company:assign | ✅ | | | | | |
| people:edit | ✅ | ✅ | | | | |
| pipeline:move | ✅ | ✅ | | | | |
| activity:write | ✅ | ✅ | | ✅ | ✅ | |
| email:send | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| email:templates | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| import:run | ✅ | ✅ | ✅ | | | |
| marketing:send | ✅ | | ✅ | | | |
| marketing:view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| finance:general | ✅ | | | | | ✅ |
| users:manage | ✅ | | | | | |

---

## Environment Variables

```env
PORT=5000
JWT_SECRET=your_jwt_secret_string
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=marketing@yourdomain.com
SENDGRID_FROM_NAME=Your Company Name
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/google/callback
CLIENT_URL=http://localhost:3000
```

> ⚠️ Never commit `.env` to GitHub. It is listed in `.gitignore`.

---

## Getting Started

### Prerequisites
- Node.js v18+
- Supabase project with schema applied
- SendGrid account with verified sender domain
- Google Cloud project with Gmail API + Calendar API enabled
- OAuth 2.0 consent screen configured

```bash
git clone https://github.com/4st3r1x/venueflow-crm.git
cd venueflow-crm
npm install
cd client && npm install && cd ..

# Terminal 1
node server/index.js

# Terminal 2
cd client && npm start
```

Frontend: `http://localhost:3000` · Backend: `http://localhost:5000`

### Production Deploy

```bash
# Frontend → Cloudflare Pages
cd client && REACT_APP_API=https://planfor-crm-api.onrender.com/api npm run build
npx wrangler pages deploy build --project-name=planfor-crm

# Backend → Render (auto-deploys from GitHub)
# Add production GOOGLE_REDIRECT_URI to .env
```

---

## API Reference

### Auth
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/login` | Login, returns JWT |

### Contacts
| Method | Route | Description |
|---|---|---|
| GET | `/api/contacts/companies` | List all companies |
| POST | `/api/contacts/companies` | Create company |
| GET | `/api/contacts/companies/:id` | Get company + people |
| PUT | `/api/contacts/companies/:id` | Update company field |
| DELETE | `/api/contacts/companies/:id` | Delete company |
| POST | `/api/contacts/companies/:id/people` | Add person |
| PUT | `/api/contacts/people/:id` | Update person |
| DELETE | `/api/contacts/people/:id` | Delete person |
| GET | `/api/contacts/companies/:id/activity` | Get activity log |
| POST | `/api/contacts/companies/:id/note` | Add note |
| GET | `/api/contacts/activity/recent` | Last 15 actions |
| DELETE | `/api/contacts/activity/:id` | Delete activity entry |

### Emails
| Method | Route | Description |
|---|---|---|
| GET | `/api/emails/templates` | List templates |
| POST | `/api/emails/templates` | Create template |
| PUT | `/api/emails/templates/:id` | Update template |
| DELETE | `/api/emails/templates/:id` | Delete template |
| GET | `/api/emails/sent` | List all sent/draft emails |
| GET | `/api/emails/sent/company/:id` | Emails for a company |
| POST | `/api/emails/send` | Send via Gmail API or SendGrid |
| GET | `/api/emails/gmail-status` | Check Gmail connection status |

### Google OAuth *(new in v1.4)*
| Method | Route | Description |
|---|---|---|
| GET | `/api/google/connect` | Initiate OAuth flow |
| GET | `/api/google/callback` | OAuth callback handler |
| GET | `/api/google/accounts` | List connected accounts |
| DELETE | `/api/google/accounts/:id` | Disconnect account |

### Gmail Sync *(new in v1.4)*
| Method | Route | Description |
|---|---|---|
| POST | `/api/sync/trigger` | Manually trigger sync |
| GET | `/api/sync/emails/company/:id` | Synced emails for a company |
| GET | `/api/sync/emails/client/:id` | Synced emails for a client |
| GET | `/api/sync/inbox` | Get inbox threads |
| GET | `/api/sync/unread-count` | Unread email count |

### Calendar *(new in v1.4)*
| Method | Route | Description |
|---|---|---|
| GET | `/api/calendar/events` | Google Calendar events (CRM-enriched) |
| POST | `/api/calendar/meetings` | Create meeting → Google Calendar |
| PUT | `/api/calendar/meetings/:id` | Update meeting |
| DELETE | `/api/calendar/meetings/:id` | Cancel meeting |
| GET | `/api/calendar/upcoming` | Next 7 days (Google Cal + CRM) |
| GET | `/api/calendar/needs-completion` | Past meetings needing completion |
| POST | `/api/calendar/import-complete` | Import Google event + mark complete |
| GET | `/api/calendar/meetings/company/:id` | Meetings for a company |
| GET | `/api/calendar/meetings/client/:id` | Meetings for a client |

### Clients
| Method | Route | Description |
|---|---|---|
| GET | `/api/clients` | List all clients |
| GET | `/api/clients/:id` | Get client details |
| PUT | `/api/clients/:id` | Update client |
| POST | `/api/clients/convert/:companyId` | Convert company to client |
| GET | `/api/clients/:id/activity` | Client activity log |
| POST | `/api/clients/:id/note` | Add note |
| GET/POST | `/api/clients/:id/documents` | Documents CRUD |
| GET/PUT | `/api/clients/:id/vendor-page` | Vendor page |
| GET/POST | `/api/clients/:id/finance` | Finance transactions |

### Users
| Method | Route | Description |
|---|---|---|
| GET | `/api/users` | List all users (admin) |
| POST | `/api/users/invite` | Create/invite user (admin) |
| PUT | `/api/users/:id/role` | Change role (admin) |
| DELETE | `/api/users/:id` | Delete user (admin) |
| GET | `/api/users/me` | Get current user profile |
| PUT | `/api/users/me/timezone` | Update own timezone |
| PUT | `/api/users/me/signature` | Update own email signature |

### Marketing
| Method | Route | Description |
|---|---|---|
| GET | `/api/marketing/campaigns` | List campaigns |
| POST | `/api/marketing/campaigns` | Create campaign |
| GET | `/api/marketing/campaigns/:id` | Campaign + stats |
| POST | `/api/marketing/campaigns/:id/send` | Send via SendGrid |
| POST | `/api/marketing/webhook` | SendGrid event webhook |
| GET | `/api/marketing/company/:id` | Campaign history for company |
| GET | `/api/marketing/stats` | Marketing overview stats |

### Finance
| Method | Route | Description |
|---|---|---|
| GET | `/api/finance/expenses` | List expenses |
| POST | `/api/finance/expenses` | Create expense (admin) |
| PUT | `/api/finance/expenses/:id` | Update expense (admin) |
| DELETE | `/api/finance/expenses/:id` | Delete expense (admin) |
| GET | `/api/finance/expenses/summary` | Finance summary |

All routes require `Authorization: Bearer <token>` header (except webhooks).

> ⚠️ **Route order matters:** In `users.js`, `/me` routes must come BEFORE `/:id` routes (Express 5 pattern matching).

---

## Email System

### Two-Channel Architecture
- **Direct (1-to-1):** Gmail API from rep's @planfor.io → replies captured via smart sync
- **Marketing (bulk):** SendGrid from marketing@planfor.io → tracked via webhooks

### Merge Tags
`{{first_name}}`, `{{last_name}}`, `{{company_name}}`, `{{sender_name}}`, `{{sender_email}}`, `{{city}}`, `{{stage}}`

### Global Signature
- Stored in `crm_users.email_signature`, editable in Settings
- Toggle on/off in email composer (checkbox: Included / Excluded)
- Removed from per-template editing — single source of truth

### Gmail/SendGrid Indicator
- Email composer shows green "via Gmail · email" badge or yellow "via SendGrid" badge
- Auto-detected based on whether rep has connected Gmail account

---

## Gmail Integration

### Smart Selective Sync
- Only syncs emails where sender/recipient matches `crm_people` or `crm_clients` email
- Ignores all non-CRM emails — no inbox clutter
- Polling every 3 minutes via `setInterval` on server startup
- Incremental sync via Gmail history API (`last_history_id` per account)
- Initial backfill: last 30 days, capped at 500 messages
- Deduplication: skips emails already sent from CRM (matches on `gmail_message_id`)
- Auto-detects if company was converted to client → links to correct profile

### Connected Accounts
- **Personal:** Per-rep, used for direct email send + inbox sync
- **Shared:** Admin-only (e.g. marketing@planfor.io) — for future marketing reply routing
- Configurable in Settings without code changes

---

## Calendar & Meetings

### Google Calendar Sync
- Full read/write with Google Calendar API (uses same OAuth tokens from Gmail)
- Events pulled from rep's primary calendar
- CRM-created meetings push to Google Calendar with invites

### Meeting Creation
- Create from Calendar page or Company/Client profile header buttons
- Types: Google Meet (auto-generated link via `conferenceData`) or Phone Call
- Select which contact person to invite (not all contacts)
- Auto-fill company context in description (editable before sending)
- Timezone conversion: auto-detect client timezone from US state, preview shows both times

### Dashboard Widget
- Next 7 days rolling from now
- Pulls from Google Calendar API + enriches with CRM company/client data
- Today/Tomorrow labels, meeting type icons, click-through to profile

### Meeting Management Workflow
- **Status tracking:** scheduled → confirmed → completed → cancelled
- **Needs Completion:** Dashboard shows past meetings needing completion with inline Complete/No-show buttons
- **Mark Complete with notes:** expand, add meeting notes, save — logged to activity timeline
- **Pipeline auto-update:** when meeting is created, company auto-moves to "Meeting Scheduled" (if current stage is earlier)
- **Meeting History tabs:** dedicated Meetings tab on both Company and Client profiles with summary cards and full history
- **Cancelled meeting handling:** cancel from CRM removes from Google Calendar, logs activity, pipeline NOT auto-reverted

---

## Marketing & Campaigns

### Campaign Flow
Content → Recipients (source filter: All/Contacts/Clients) → Review & Send

### Unsubscribe Management
- Per-person via SendGrid webhook
- Centralized Unsubscribed sub-tab with bulk resubscribe
- Banners on Company + Client profiles

---

## Client Management

### Conversion: Contact → Client
Company at "Closed Won" → Convert button → Modal (contract type, terms) → Client created, company marked "Converted"

### Contract Types
- **RevShare:** Base Amount ($) + Revenue Share (%)
- **Commission:** Commission Rate (%)
- **Subscription:** Monthly Amount ($)

### Stages
Onboarding → Active → Paused → Churned

---

## File Uploads

Supabase Storage with two private buckets: `client-documents` and `receipts`. Upload via `POST /api/uploads/:bucket` (multipart, 10MB max). Signed URLs with 1-year expiry.

---

## Design System

| Token | Hex | Usage |
|---|---|---|
| Sand Light | `#F5F3EF` | Cards, field backgrounds |
| Near Black | `#1a1d1a` | Field values, headings |
| Sage | `#8E9B8B` | Primary buttons |
| Charcoal | `#3E423D` | Primary text |
| Steel Blue | `#94B0BC` | Links |
| Muted | `#717182` | Labels |
| Lavender | `#B4A5D6` | Meeting Scheduled stage |
| Gold | `#D4A574` | Follow-up, warnings |
| Red | `#D4183D` | Destructive actions |
| Client Blue | `#1a6fad` | Converted/client indicators |
| Gmail Green | `#E8F5E9` / `#2E7D32` | Gmail connection badge |
| SendGrid Yellow | `#FFF3CD` / `#856404` | SendGrid fallback badge |

---

## Changelog

### v1.5.2 (March 2026) — Profile Consistency + LocationSelector
**Profile Redesign**
- Consistent Overview tab layout across Company and Client profiles
- Unified sections: Contact Info, Business, Marketing, Social (+ Contract on Client)
- Removed duplicate Business Name from Client Contact Info (already in header)
- LocationSelector component: reusable country/state dropdown shared by both profiles

**LocationSelector Component**
- 70+ countries sorted A-Z with timezone mapping
- Dynamic state/province dropdown for US (50 states + DC), Canada (10 provinces), Australia (8 states)
- Live clock badge showing current local time for selected country/state (updates every 30s)
- Timezone-aware: state-level precision for US/CA/AU, country-level for others

**Database Changes**
- Renamed `twitter_url` → `instagram_url` in `crm_companies`
- Added `origin`, `linkedin_url`, `facebook_url`, `instagram_url` columns to `crm_clients`

**New Components:** LocationSelector.js

### v1.5.1 (March 2026) — Recall.ai Webhook + Async Transcription
- Recall.ai webhook endpoint for `recording.done` and `transcript.done` events
- Async transcription via Recall.ai built-in transcriber
- Full end-to-end flow: recording → transcript → AI summary (production tested)

### v1.5.0 (March 2026) — Recall.ai Recording + AI Meeting Summaries
**Meeting Recording**
- One-click recording via Recall.ai bot ("Planfor Assistant" joins Google Meet)
- Recording status polling: sending_bot → recording → processing → completed
- Auto-record toggle on meeting creation (cron checks every 60s)

**AI Meeting Summaries (OpenAI GPT-4o-mini)**
- Automatic summary generation from meeting transcripts
- Key takeaways, action items with priority and owner, sentiment analysis
- Regenerate summary button · Cost: ~$0.36/meeting

**New Files:** `recallService.js`, `aiSummary.js`
**New DB Columns:** `recall_bot_id`, `recording_url`, `transcript`, `transcript_segments`, `ai_summary`, `ai_action_items`, `recording_status`, `auto_record`
**New Env Vars:** `RECALL_API_KEY`, `OPENAI_API_KEY`

### v1.4.2 (March 2026) — Calendar Completion Flow + Import Events
- Calendar event popup: completion prompt for past meetings
- Import & Complete: auto-creates CRM record from Google-only Calendar events
- Client meetings endpoint shows meetings from converted company too

### v1.4.1 (March 2026) — Meeting Management Workflow + Quick Reply
**Meeting Management (Task 7)**
- Pipeline auto-update to "Meeting Scheduled" on meeting creation
- Needs Completion widget on Dashboard
- Meetings tab on Company + Client profiles

**Quick Reply from Email Inbox**
- Inline reply composer with Gmail threading (In-Reply-To + References + threadId)
- Optimistic update: sent reply appears immediately in thread

### v1.4.0 (March 2026) — Gmail + Calendar + Polish
**Gmail OAuth & Connected Accounts**
- Google OAuth 2.0 flow with consent screen, token exchange, auto-refresh
- Settings page: connect/disconnect personal + shared Gmail accounts
- Permission guards: only admins can connect shared accounts

**Direct Email Send via Gmail API**
- Reps send from their real @planfor.io Gmail address
- Auto-detection: Gmail connected → Gmail API, not connected → SendGrid fallback
- Clean HTML for Gmail (no table wrapper), table wrapper for SendGrid
- Gmail message_id + thread_id stored for dedup and threading
- Gmail/SendGrid indicator badge in email composer

**Gmail Inbox Sync (Smart Selective)**
- Polling every 3 min, incremental via Gmail history API
- Only syncs emails matching CRM contacts — ignores everything else
- 30-day backfill on first connect, capped at 500 messages
- Auto-links to client profile if company was converted
- Activity log: "Email Received" entries for inbound matches
- Deduplication: skips CRM-sent emails

**Email Inbox Page**
- Thread view grouped by gmail_thread_id
- Filters: All / Unread / Received / Sent + search
- Thread expansion with full conversation
- Quick-link buttons to company/client profiles

**Google Calendar + Meeting Scheduler**
- Full read/write sync with Google Calendar API
- Calendar page: Month / Week / Day views (fixed-height cells)
- Create meetings: Google Meet (auto-link) or Phone Call
- Timezone conversion: US state → IANA, dual-time preview
- Schedule Meeting button on Company + Client profiles
- Reusable ScheduleMeetingModal component
- Cancel removes from Google Calendar

**Dashboard v3**
- Upcoming Meetings widget (next 7 days, Google Calendar API)

**Polish**
- Global email signature (Settings) with toggle in email composer
- Removed per-template signature editor — single source of truth
- Calendar CSS fix (month + week views, fixed height, overflow hidden)
- Gmail/SendGrid indicator in email composer header
- Sidebar unread email count badge (polls every 60s)

**New Database Tables:** `crm_google_accounts`, `crm_synced_emails`, `crm_meetings`
**Modified Tables:** `crm_emails_sent` (+gmail_message_id, gmail_thread_id, send_method), `crm_users` (+timezone, email_signature)
**New Server Routes:** google.js, sync.js, calendar.js, gmailSync.js service
**New Client Pages:** EmailInbox.js, Calendar.js, Settings.js
**New Components:** ScheduleMeetingModal.js

### v1.3.0 (March 2026)
- Client Management System (DB, API, list, 6-tab profile, conversion flow)
- Contract types: RevShare / Commission / Subscription with dynamic fields
- Dashboard v2 (clean, minimal, pipeline, clients, email, team, finance)
- File uploads (Supabase Storage for documents + receipts)
- Campaign recipients: source filter, exclude converted, all people from original company
- Marketing Unsubscribed sub-tab with bulk resubscribe
- Tiptap Rich Text Editor (Email Composer, Templates, Campaigns)
- Email tracking (SendGrid webhooks, status priority)
- UX redesign: 3-column grid, sand background fields, organized sections

### v1.2.0 (March 2026)
- Per-person unsubscribe, campaign preview, unified Emails tab, side-by-side editor

### v1.1.0 (March 2026)
- Finance module, Tiptap integration, email tracking, production deployment

### v1.0.0 (March 2026)
- Initial release: contacts, pipeline, templates, composer, campaigns, RBAC, dashboard

---

## Roadmap

| Feature | Status |
|---|---|
| Core CRM (contacts, pipeline, emails, campaigns) | ✅ Done |
| Client Management System | ✅ Done |
| Dashboard v3 (with meetings widget) | ✅ Done |
| File Uploads | ✅ Done |
| Finance Module | ✅ Done |
| Unsubscribe Management | ✅ Done |
| Gmail OAuth + Connected Accounts | ✅ Done |
| Direct Email Send via Gmail API | ✅ Done |
| Gmail Inbox Sync (Smart Selective) | ✅ Done |
| Email Inbox Page | ✅ Done |
| Google Calendar + Meeting Scheduler | ✅ Done |
| Schedule Meeting from profiles | ✅ Done |
| Global signature with toggle | ✅ Done |
| Gmail/SendGrid indicator | ✅ Done |
| Dashboard upcoming meetings | ✅ Done |
| Sidebar unread badge | ✅ Done |
| Marketing Reply Routing (Task 4) | ⏭️ Waiting for marketing@ email |
| Meeting Management Workflow (Task 7) | ✅ Done |
| Quick Reply from Email Inbox | ✅ Done |
| Gmail threading (In-Reply-To + threadId) | ✅ Done |
| Calendar completion flow + Google event import | ✅ Done |
| Version tag in sidebar | ✅ Done |
| Recall.ai recording + transcription + AI summary | ✅ Done |
| Production Google OAuth redirect URI | 🔵 Pending |
| Stripe integration | 🔵 Pending API key |

---

Built by the Planfor.io team.