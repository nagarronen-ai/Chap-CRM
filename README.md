# Planfor CRM

Internal sales CRM built for the Planfor.io team to manage wedding vendor outreach, convert leads to clients, send emails via Gmail API or SendGrid, sync inbox conversations, run marketing campaigns, schedule meetings with Google Calendar, manage client relationships, track internal company finances, and interact with Chappie — an AI assistant powered by GPT-4o-mini — all in one place.

**Live:** [crm.planfor.io](https://crm.planfor.io) · **API:** [crm-api.planfor.io](https://crm-api.planfor.io)

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture: Email & Calendar](#architecture-email--calendar)
- [Features](#features)
- [AI Assistant — Chappie](#ai-assistant--chappie)
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
- Interact with Chappie, an AI agent that can read CRM data, send emails, book meetings, and more

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Cloudflare Pages) |
| Backend | Express / Node.js (Render) |
| Database | Supabase (PostgreSQL) |
| Email | Gmail API + SendGrid fallback |
| Calendar | Google Calendar API |
| AI | OpenAI GPT-4o-mini (function-calling agent) |
| Auth | JWT + bcrypt |
| Storage | Supabase Storage |
| Meeting Recording | Recall.ai |

---

## Architecture: Email & Calendar

```
User clicks Send Email
        │
        ▼
POST /api/emails/send
        │
        ├─ Gmail connected? ──YES──▶ sendViaGmail()
        │                              Gmail API sends email
        │                              Stores gmail_message_id + gmail_thread_id
        │                              Inserts row into crm_emails_sent
        │
        └─ NO ──▶ sendViaSendGrid()
                   SendGrid delivers email
                   Returns sendgrid_message_id
                   Inserts row into crm_emails_sent

Gmail Sync (every 3 min)
        │
        ▼
gmailSync.js → fetchNewMessages()
        │
        ├─ Matches from_email to crm_people → links company_id
        ├─ Deduplicates by gmail_message_id
        └─ Inserts into crm_synced_emails
```

---

## Features

### Pipeline & Contacts
- Company list with stage filters, search, and bulk import (CSV)
- Visual pipeline stepper per company
- People management per company (multiple contacts)
- Next action reminders
- Activity timeline — notes, emails, meetings, stage changes
- Assigned-to with team user picker (admin only)
- Convert to Client flow with contract setup

### Email
- Gmail API send (primary) with SendGrid fallback
- Reusable email templates with merge tags (`{{first_name}}`, `{{company_name}}`, etc.)
- Tiptap visual editor + raw HTML mode
- User email signature (HTML, stored per user)
- Open/click/bounce tracking via SendGrid webhooks
- CC support for direct emails
- Thread reply support (gmail_thread_id pass-through)
- Emails logged to `crm_emails_sent` with company_id + person_id + client_id

### Email Inbox
- Two-way Gmail sync (incremental, runs every 60 seconds)
- Thread grouping — conversations chronologically
- "View Client/Contact" quick-link buttons per thread
- Quick Reply — reply directly from inbox with Gmail threading
- "Sync Now" button for manual trigger
- Unread count badge in sidebar (polls every 60 seconds)

### Calendar & Meetings
- Full-page calendar: Month / Week / Day views
- Google Calendar API (read/write sync)
- Create meetings: Google Meet (auto-link) or Phone Call
- Timezone conversion — auto-detect client timezone from US state
- Meetings linked to companies/clients, logged to activity timeline
- Cancel / reschedule meeting (updates Google Calendar)
- Meeting recording via Recall.ai bot (Google Meet + Zoom)
- AI-generated meeting summary and action items via GPT-4o-mini
- Inline meeting notes with Markdown rendering

### Marketing Campaigns
- Campaign builder: Content → Recipients → Review & Send
- Source filter: All / Contacts Only / Clients Only
- Tiptap visual + HTML side-by-side editor
- Unsubscribed sub-tab with bulk resubscribe
- Per-person unsubscribe via SendGrid webhook
- Converted companies excluded from contact recipients
- Campaign stats: opens, clicks, bounces, unsubscribes

### Client Management
- 6-tab client profile: Overview, Activity, Meetings, Documents, Emails, Vendor Page
- Unified emails tab (direct + campaign history in one table)
- Document management with file upload (Supabase Storage)
- Vendor marketplace page editor (amenities, venue types, services, pricing, social links)
- Contract tracking (RevShare / Commission / Subscription)
- Finance tab: per-client transactions with status tracking

### Finance Module
- Internal expense tracker (admin + finance roles)
- Per-client transactions (Commission, Settlement, Refund, Fee)
- Receipt upload to Supabase Storage
- Summary cards, category/status filters

### Team Management
- View, invite, manage CRM users
- Role assignment: admin, sales, marketing, csm, support, finance
- Admin-only access

---

## AI Assistant — Chappie

Chappie is a function-calling AI agent built into the CRM. It uses GPT-4o-mini and has access to 20+ tools covering the full CRM. It is accessible via a floating widget (bottom right of every page) and a full conversation log at `/ai/log`.

### Architecture
- **Type:** Agentic loop (not RAG) — calls tools, gets results, loops until final answer
- **Model:** GPT-4o-mini
- **Max iterations:** 6 per request
- **History:** Persistent across sessions (last 50 messages), stored in `crm_ai_conversations`
- **History cleaning:** Tool messages stripped before saving to DB to prevent orphaned tool_call corruption

### Tools

**Read (instant, no confirmation):**
- `search_contacts` — search companies, clients, and people by name or email
- `get_company_people` — get all contacts at a company with titles and emails
- `get_company_brief` — full company details + recent activity
- `get_client_status` — client details + contract + finance + people
- `get_pipeline_summary` — pipeline stage breakdown
- `get_stale_leads` — leads with no activity in X days
- `get_my_meetings` — upcoming/recent meetings by period
- `get_finance_summary` — revenue totals, pending, this month/year
- `get_marketing_history` — campaigns sent to a company
- `get_campaign_stats` — full campaign stats (opens, clicks, bounces) by name
- `get_last_thread` — most recent Gmail thread with a person/company
- `get_email_thread` — full content of an email thread (sent + received)

**Write instant (no confirmation):**
- `add_note` — add note to company or client
- `update_pipeline_stage` — move company to new pipeline stage
- `update_client_stage` — move client to new stage
- `update_next_action` — set next action on company

**Write with confirmation (yellow card + Confirm/Cancel):**
- `send_email` — send email to one person (supports CC, thread reply)
- `send_bulk_email` — send same email to all contacts at a company
- `book_meeting` — create Google Calendar meeting with Meet link
- `cancel_meeting` — cancel a meeting
- `reschedule_meeting` — reschedule a meeting to new date/time

### Key Behaviors
- Always calls `search_contacts` before any action involving a name
- Uses `person.company_id` from people array (not companies array) to ensure valid FK
- Auto-resolves `client_id` from `company_id` via `converted_from` lookup
- Validates UUIDs before DB insert — rejects fabricated IDs from GPT
- Thread replies: calls `get_last_thread` → passes `thread_id` to `send_email`
- Email reading: `get_email_thread` falls back to company_id search if thread_id yields no results
- No markdown in responses (enforced in system prompt)
- Confirmation cards show CC recipients and meeting details before execution
- After booking a meeting, shows the Google Meet link in the chat

### Conversation Log
- Route: `/ai/log`
- Admin sees all agents' conversations with filter dropdown
- Non-admin users see only their own conversations
- Each conversation shows last message, action count, and timestamp

---

## Project Structure

```
venueflow-crm/
├── server/
│   ├── routes/
│   │   ├── auth.js          # Login, JWT generation
│   │   ├── ai.js            # Chappie chat, history, agents endpoints
│   │   ├── contacts.js      # Companies, people, activity, notes
│   │   ├── clients.js       # Client CRUD, conversion, documents, vendor page, finance
│   │   ├── emails.js        # Templates, sent emails, Gmail/SendGrid dual send, CC support
│   │   ├── google.js        # Gmail OAuth flow, token management, refresh
│   │   ├── sync.js          # Gmail inbox sync, unread count, inbox queries
│   │   ├── calendar.js      # Google Calendar events, meetings CRUD, reschedule
│   │   ├── marketing.js     # Campaigns, bulk send, webhook, stats, unsub mgmt
│   │   ├── finance.js       # Company expenses
│   │   ├── uploads.js       # Supabase Storage file upload/delete
│   │   └── users.js         # Team mgmt, user profile, signature, timezone
│   ├── services/
│   │   ├── aiBrain.js       # Chappie agent — agentic loop, confirmation flow, history mgmt
│   │   ├── aiTools.js       # 20+ tool definitions + executors
│   │   ├── aiSummary.js     # GPT meeting summary generator
│   │   └── gmailSync.js     # Smart selective sync engine (polling + incremental)
│   ├── middleware/
│   │   ├── auth.js          # JWT verification middleware
│   │   └── rbac.js          # Role-based access control
│   ├── db.js                # Supabase client
│   └── index.js             # Express app entry point + sync interval + auto-record check
├── client/
│   └── src/
│       ├── hooks/
│       │   └── useRole.js
│       ├── pages/
│       │   ├── Login.js
│       │   ├── Dashboard.js
│       │   ├── Contacts.js
│       │   ├── CompanyProfile.js    # Overview, activity, meetings, emails, marketing tabs
│       │   ├── Clients.js
│       │   ├── ClientProfile.js     # 6-tab profile with unified emails tab
│       │   ├── Import.js
│       │   ├── Emails.js            # Templates with global signature preview
│       │   ├── EmailInbox.js        # Synced email threads, filters, unread
│       │   ├── Calendar.js          # Month/Week/Day views, Google Calendar sync
│       │   ├── Settings.js          # Gmail accounts, signature, timezone
│       │   ├── Marketing.js         # Campaigns + Unsubscribed sub-tabs
│       │   ├── Finance.js           # Expenses with receipt upload
│       │   ├── AiLog.js             # Chappie conversation log (admin + user)
│       │   └── Team.js
│       ├── components/
│       │   ├── Sidebar.js               # Nav with unread email badge + AI Assistant link
│       │   ├── AiBrain.js               # Chappie floating widget (all authenticated pages)
│       │   ├── TiptapEditor.js          # Reusable Tiptap rich text editor
│       │   ├── ScheduleMeetingModal.js  # Reusable meeting creation modal
│       │   └── LocationSelector.js
│       └── App.js                       # AuthenticatedApp wrapper with AiBrain mount
├── .env
├── .gitignore
└── README.md
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
| POST | `/api/emails/send` | Send email (Gmail or SendGrid) |
| GET | `/api/emails/sent/company/:id` | Sent emails for a company |
| GET | `/api/emails/gmail-status` | Check Gmail connection status |

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
| PUT/DELETE | `/api/clients/documents/:docId` | Update/delete document |
| GET/PUT | `/api/clients/:id/vendor-page` | Vendor page |
| GET/POST | `/api/clients/:id/finance` | Finance transactions |
| PUT/DELETE | `/api/clients/finance/:id` | Update/delete transaction |

### Calendar
| Method | Route | Description |
|---|---|---|
| GET | `/api/calendar/events` | Google Calendar events |
| GET | `/api/calendar/meetings` | All CRM meetings |
| POST | `/api/calendar/meetings` | Create meeting + Google Calendar event |
| GET | `/api/calendar/meetings/:id` | Single meeting |
| PUT | `/api/calendar/meetings/:id` | Update meeting (complete, notes) |
| DELETE | `/api/calendar/meetings/:id` | Cancel meeting |
| PUT | `/api/calendar/meetings/:id/reschedule` | Reschedule meeting |
| GET | `/api/calendar/meetings/company/:id` | Meetings for a company |
| GET | `/api/calendar/meetings/client/:id` | Meetings for a client |
| POST | `/api/calendar/meetings/:id/record` | Send Recall.ai bot |
| GET | `/api/calendar/meetings/:id/recording-status` | Poll recording status |
| POST | `/api/calendar/meetings/:id/process-transcript` | Fetch + summarize transcript |
| POST | `/api/calendar/meetings/:id/regenerate-summary` | Regenerate AI summary |
| GET | `/api/calendar/upcoming` | Upcoming meetings (merged Google + CRM) |

### Gmail & Sync
| Method | Route | Description |
|---|---|---|
| GET | `/api/google/auth-url` | Get OAuth URL |
| GET | `/api/google/callback` | OAuth callback |
| GET | `/api/google/accounts` | List connected accounts |
| DELETE | `/api/google/accounts/:id` | Disconnect account |
| GET | `/api/sync/emails/inbox` | Inbox threads |
| GET | `/api/sync/emails/client/:id` | Synced emails for client |
| GET | `/api/sync/emails/unread-count` | Unread badge count |
| POST | `/api/sync/trigger` | Manual sync trigger |

### AI (Chappie)
| Method | Route | Description |
|---|---|---|
| POST | `/api/ai/chat` | Send message to Chappie |
| GET | `/api/ai/history` | Get conversation history |
| GET | `/api/ai/agents` | List all agents (admin) |
| DELETE | `/api/ai/history/:id` | Delete conversation |

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
| POST | `/api/marketing/resubscribe/:personId` | Resubscribe person |

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

### Dual Send Architecture
Every outbound email tries Gmail first, falls back to SendGrid:

```javascript
// server/routes/emails.js
1. Check crm_google_accounts for connected Gmail
2. If connected → sendViaGmail(token, payload)
3. If not → sendViaSendGrid(payload)
4. Insert row in crm_emails_sent with send_method + IDs
```

### Merge Tags
Available in subject + body of templates and direct emails:

| Tag | Resolves To |
|---|---|
| `{{first_name}}` | Contact first name |
| `{{last_name}}` | Contact last name |
| `{{company_name}}` | Company / business name |
| `{{sender_name}}` | Logged-in user's name |
| `{{sender_email}}` | Logged-in user's email |
| `{{city}}` | Company city |
| `{{stage}}` | Current pipeline stage |

### Email Tracking
SendGrid webhooks update `crm_emails_sent.email_status`:
- `delivered` → email reached inbox
- `opened` → pixel fired (sets `opened_at`)
- `clicked` → link click (sets `clicked_at`)
- `bounced` → hard/soft bounce (sets `bounced_at`)

Webhook endpoint: `POST /api/marketing/webhook`

---

## Gmail Integration

### OAuth Flow
1. User clicks "Connect Gmail" in Settings
2. Frontend calls `GET /api/google/auth-url`
3. Redirects to Google consent screen
4. Google redirects to `GET /api/google/callback`
5. Backend stores access + refresh tokens in `crm_google_accounts`
6. Auto-refresh on token expiry

### Sync Engine (`gmailSync.js`)
- Runs every 3 minutes via `setInterval` in `server/index.js`
- **Initial sync:** fetches last 100 messages
- **Incremental sync:** uses `historyId` to fetch only new messages since last sync
- **Matching logic:** matches `from_email` to `crm_people.email` → resolves `company_id`
- **Deduplication:** checks `gmail_message_id` before insert
- Stores full `body_html` + `body_snippet` in `crm_synced_emails`

### Production Config
```bash
GOOGLE_REDIRECT_URI=https://crm-api.planfor.io/api/google/callback
CLIENT_URL=https://crm.planfor.io
```

---

## Calendar & Meetings

### Meeting Creation Flow
1. User opens ScheduleMeetingModal (from CompanyProfile, ClientProfile, or Calendar page)
2. Selects person, date, time, meeting type (Google Meet / Phone)
3. POST `/api/calendar/meetings`
4. Backend creates Google Calendar event via googleapis
5. Google returns `meet_link` + `google_event_id`
6. CRM stores meeting in `crm_meetings`
7. Google sends calendar invite to attendees automatically

### Timezone Support
- User timezone stored in `crm_users.timezone` (IANA format)
- `ScheduleMeetingModal` detects contact timezone from US state
- Shows "Your time / Their time" preview when timezones differ

### Reschedule Flow
- Inline form in CompanyProfile, ClientProfile, and Calendar popup
- PUT `/api/calendar/meetings/:id/reschedule` updates Google Calendar + CRM record

### Meeting Recording (Recall.ai)
- "🔴 Google Meet" button sends bot to live meeting
- "🎥 Zoom" button accepts a paste-in Zoom URL
- Bot polls recording status every 10 seconds
- On completion, `POST /api/calendar/meetings/:id/process-transcript` fetches transcript from Recall.ai
- GPT-4o-mini generates summary + action items stored in `crm_meetings`

### Auto-Record
- `auto_record: true` on a meeting triggers bot send 2 minutes before start
- Checked via `setInterval` every 60 seconds in `server/index.js`

---

## Marketing & Campaigns

### Campaign Builder
1. **Content** — name, subject, Tiptap visual/HTML body
2. **Recipients** — filter: All / Contacts / Clients; preview list with unsubscribe status
3. **Review & Send** — final preview with recipient count

### Sending
- `POST /api/marketing/campaigns/:id/send`
- Iterates recipients, calls SendGrid per person with merge tag resolution
- Inserts row in `crm_campaign_recipients` per send

### Tracking
SendGrid webhook updates `crm_campaign_recipients`:
- `opened_at`, `clicked_at`, `bounced_at`, `unsubscribed_at`
- `status` field reflects latest event

### Unsubscribe
- SendGrid webhook sets `crm_people.marketing_unsubscribed = true`
- Unsubscribed contacts excluded from all future recipient lists
- Unsubscribed sub-tab in Marketing page with bulk/individual resubscribe

---

## Client Management

### Conversion Flow
1. Company reaches "Closed Won" in pipeline
2. Admin clicks "Convert to Client"
3. Modal: choose contract type (RevShare / Commission / Subscription), rates, signed date
4. POST `/api/clients/convert/:companyId` creates `crm_clients` record with `converted_from` FK
5. Company stage set to "Converted"
6. Redirect to new ClientProfile

### Client Profile Tabs
| Tab | Contents |
|---|---|
| Overview | Contact info, business details, contract, social links, quick notes |
| Activity | Merged timeline: activity log + synced emails, filterable |
| Meetings | Meeting cards with complete/reschedule/record actions |
| Documents | File attachments (upload to Supabase Storage) |
| Emails | Unified table: direct sent emails + campaign history |
| Vendor Page | Marketplace listing editor (amenities, types, pricing, etc.) |
| Finance | Transactions: Commission, Settlement, Refund, Fee |

### Vendor Page Fields
Stored as jsonb arrays in `crm_client_vendor_page`:
- `amenities` — Ceremony Area, Dressing Room, etc.
- `venue_type` — Ballroom, Barn, Beach, etc.
- `services` — Bar & Drinks, Catering, etc.
- `ceremony_types` — Religious, Civil Union, etc.
- `diversity_tags` — LGBTQ+-owned, Woman-owned, etc.
- `guest_capacity`, `price_tier`, `about`, `social_links`

---

## Finance Module

### Internal Expenses (`/finance`)
Tracks company operating costs:
- Categories: Servers, Software, Marketing, Legal, Salaries, Other
- Receipt upload to Supabase Storage (`receipts/` bucket)
- Admin + finance roles only
- Summary: total, this month, by category

### Client Finance (`/clients/:id/finance`)
Per-client revenue tracking:
- Types: Commission, Settlement, Refund, Fee, Other
- Statuses: Pending, Completed, Failed
- Summary cards: Total Earned, Pending, Transaction count

---

## File Uploads

All uploads go to Supabase Storage via `POST /api/uploads/:bucket`.

| Bucket | Used For |
|---|---|
| `client-documents` | Client profile document attachments |
| `receipts` | Finance expense receipts |

Returns a public URL stored in the relevant DB column (`file_url`, `receipt_url`).

---

## Design System

| Token | Value |
|---|---|
| Primary green | `#8E9B8B` |
| Dark text | `#3E423D` |
| Muted text | `#717182` |
| Light text | `#CBCED4` |
| Background | `#F5F3EF` |
| Accent blue | `#94B0BC` |
| Success | `#4CAF50` |
| Danger | `#D4183D` |
| Warning | `#D4A574` |
| Purple (meetings) | `#B4A5D6` |

**Typography:**
- UI: `Inter, sans-serif`
- Headings / italics: `Playfair Display, Georgia, serif`

**Patterns:**
- Cards: `border-radius: 12px`, `border: 1px solid rgba(62,66,61,0.1)`
- Inputs: `background: #F3F3F5`, `border-radius: 8px`
- Buttons: rounded-pill for stage tags, rounded-8 for actions
- Status badges: colored pill spans (inline)

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
| assigned_to | uuid | FK → crm_users |
| company_name, website, category, business_type | text | |
| stage | text | New / Contacted / No Reply / Follow-up / Meeting Scheduled / Proposal Offered / Agreement Sent / Closed Won / Closed Lost / Not Interested / Converted |
| city, state, country, company_address | text | |
| next_action | text | |
| origin | text | Upload / Cold / Hot / Instagram / Google / Referral |
| company_linkedin, facebook_url, instagram_url | text | |
| last_activity_at | timestamp | |
| created_at, updated_at | timestamp | |

### `crm_people`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| company_id | uuid | FK → crm_companies |
| first_name, last_name, title | text | |
| email, work_phone, mobile_phone | text | |
| marketing_unsubscribed | boolean | |

### `crm_activity_log`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| company_id | uuid | FK → crm_companies (optional) |
| client_id | uuid | FK → crm_clients (optional) |
| user_id | uuid | FK → crm_users |
| person_id | uuid | FK → crm_people (optional) |
| action | text | Note Added / Stage Updated / Email Sent / Meeting Scheduled / etc. |
| details | text | Human-readable description |
| created_at | timestamp | |

### `crm_email_templates`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name, subject | text | |
| body_html | text | HTML with merge tags |
| signature_html | text | Optional per-template signature |
| category | text | General / Follow-up / Proposal / etc. |
| visibility | text | global / private |
| created_by | uuid | FK → crm_users |

### `crm_emails_sent`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → crm_users |
| company_id | uuid | FK → crm_companies |
| client_id | uuid | FK → crm_clients |
| person_id | uuid | FK → crm_people |
| template_id | uuid | FK → crm_email_templates (optional) |
| subject, body_html | text | |
| status | text | sent / draft |
| email_status | text | delivered / opened / clicked / bounced |
| send_method | text | gmail / sendgrid |
| gmail_message_id, gmail_thread_id | text | |
| sendgrid_message_id | text | |
| opened_at, clicked_at, bounced_at, sent_at | timestamp | |

### `crm_google_accounts`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → crm_users |
| email | text | Connected Gmail address |
| access_token, refresh_token | text | Encrypted |
| token_expiry | timestamp | |
| label | text | personal / work |
| history_id | text | Gmail incremental sync cursor |

### `crm_synced_emails`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| google_account_id | uuid | FK → crm_google_accounts |
| company_id | uuid | FK → crm_companies |
| client_id | uuid | FK → crm_clients (optional) |
| gmail_message_id, gmail_thread_id | text | |
| direction | text | inbound / outbound |
| subject, body_snippet, body_html | text | |
| from_email, from_name | text | |
| to_emails | jsonb | Array of recipient emails |
| email_date | timestamp | |
| is_read | boolean | |
| has_attachments | boolean | |
| attachment_count | integer | |
| synced_at | timestamp | |

### `crm_meetings`
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
| start_time, end_time | timestamptz | UTC |
| location, meet_link | text | |
| attendees | jsonb | Array of {email, name, status} |
| is_internal | boolean | |
| notes | text | Markdown |
| ai_summary | text | GPT-generated |
| ai_action_items | jsonb | Array of {task, owner, priority} |
| transcript | text | Raw Recall.ai output |
| transcript_segments | jsonb | Array of {speaker, text, startTime} |
| recall_bot_id, recording_url | text | |
| recording_status | text | sending_bot / recording / processing / completed / failed |
| auto_record | boolean | |
| created_at, updated_at | timestamp | |

### `crm_clients`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| converted_from | uuid | FK → crm_companies |
| assigned_to | uuid | FK → crm_users |
| business_name | text | |
| contact_first_name, contact_last_name | text | |
| contact_email, contact_phone | text | |
| website, address, city, state, country | text | |
| category, business_type | text | |
| stage | text | Onboarding / Active / Paused / Churned |
| contract_type | text | RevShare / Commission / Subscription |
| commission_rate | numeric | |
| contract_amount | numeric | |
| contract_signed_date | date | |
| origin | text | |
| notes | text | |
| created_by | uuid | FK → crm_users |
| created_at, updated_at | timestamp | |

### `crm_client_documents`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| client_id | uuid | FK → crm_clients |
| title | text | |
| doc_type | text | Contract / Proposal / Invoice / NDA / Other |
| status | text | Draft / Sent / Signed / Expired |
| file_url | text | Supabase Storage URL |
| signed_date, expires_date | date | |
| notes | text | |
| created_by | uuid | FK → crm_users |

### `crm_client_vendor_page`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| client_id | uuid | FK → crm_clients |
| display_name, tagline, about | text | |
| venue_type, guest_capacity, price_tier | text | |
| amenities, services, ceremony_types, diversity_tags | jsonb | Arrays |
| social_links | jsonb | {instagram, facebook, website, tiktok} |
| published | boolean | |

### `crm_client_finance`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| client_id | uuid | FK → crm_clients |
| user_id | uuid | FK → crm_users |
| type | text | Commission / Settlement / Refund / Fee / Other |
| amount | numeric | |
| description | text | |
| status | text | Pending / Completed / Failed |
| date | date | |

### `crm_campaigns`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name, subject | text | |
| body_html | text | |
| status | text | draft / sent |
| sent_at | timestamp | |
| recipients_count | integer | |
| created_by | uuid | FK → crm_users |

### `crm_campaign_recipients`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| campaign_id | uuid | FK → crm_campaigns |
| company_id | uuid | FK → crm_companies |
| person_id | uuid | FK → crm_people (optional) |
| email | text | |
| status | text | sent / delivered / opened / clicked / bounced / unsubscribed |
| opened_at, clicked_at, bounced_at, unsubscribed_at | timestamp | |

### `crm_ai_conversations`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → crm_users |
| messages | jsonb | Clean text history (no tool messages) |
| last_message | text | Last user message for display |
| actions_taken | jsonb | Array of executed actions |
| created_at, updated_at | timestamp | |

### `crm_finance_expenses`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → crm_users |
| category | text | Servers / Software / Marketing / Legal / Salaries / Other |
| amount | numeric | |
| description | text | |
| receipt_url | text | Supabase Storage URL |
| date | date | |
| created_at | timestamp | |
---

## Roles & Permissions

| Permission | admin | sales | marketing | csm | support | finance |
|---|---|---|---|---|---|---|
| View pipeline | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit companies | ✅ | ✅ | — | — | — | — |
| Move pipeline stage | ✅ | ✅ | — | — | — | — |
| Delete companies | ✅ | — | — | — | — | — |
| Send email | ✅ | ✅ | ✅ | ✅ | — | — |
| View clients | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit clients | ✅ | — | — | ✅ | — | — |
| Convert to client | ✅ | ✅ | — | — | — | — |
| View finance | ✅ | — | — | — | — | ✅ |
| Manage campaigns | ✅ | — | ✅ | — | — | — |
| Manage team | ✅ | — | — | — | — | — |
| View AI log (all) | ✅ | — | — | — | — | — |
| Use Chappie | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Environment Variables

```bash
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=

# Auth
JWT_SECRET=

# SendGrid
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
SENDGRID_FROM_NAME=Planfor

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://crm-api.planfor.io/api/google/callback

# App URLs
CLIENT_URL=https://crm.planfor.io
API_BASE_URL=https://crm-api.planfor.io/api

# OpenAI (meeting summaries)
OPENAI_API_KEY=

# OpenAI (Chappie AI Brain — separate key)
OPENAI_API_KEY_BRAIN=

# Recall.ai (meeting recording)
RECALL_API_KEY=
```

---

## Getting Started

### Prerequisites
- Node.js v18+
- Supabase project with schema applied
- SendGrid account with verified sender domain
- Google Cloud project with Gmail API + Calendar API enabled
- OAuth 2.0 consent screen configured with redirect URI

```bash
git clone https://github.com/4st3r1x/venueflow-crm.git
cd venueflow-crm
npm install
cd client && npm install && cd ..

# Copy and fill in environment variables
cp .env.example .env

# Terminal 1 — backend
node server/index.js

# Terminal 2 — frontend
cd client && npm start
```

Frontend: `http://localhost:3000` · Backend: `http://localhost:5000`

### Production Deploy

```bash
# Frontend → Cloudflare Pages
cd client
REACT_APP_API=https://crm-api.planfor.io/api npm run build
npx wrangler pages deploy build --project-name=planfor-crm

# Backend → Render
# Auto-deploys from GitHub main branch
# Set all env vars in Render dashboard
# Custom domain: crm-api.planfor.io (CNAME to Render)
```

---

## Changelog

### v1.6.2 — Calendly Integration + Calendar UX
- **Calendly polling** — syncs every 5 minutes, creates CRM meetings, links Google Calendar event, matches invitee to CRM contacts/clients
- **Auto-record** — Recall.ai bot sent 2 min before meeting via autoRecordCheck (not immediately on creation)
- **Calendar color coding** — meetings colored by relationship: Client (teal), Contact (green), Calendly unmatched (orange), Internal (purple), Google only (yellow)
- **Color legend** — hover widget on calendar showing color guide
- **Slack self-link** — Settings page lets each user paste their Slack Member ID
- **Gmail scope** — upgraded to `gmail.modify` (enables mark-as-read)

### v1.6.1 — Chappie Smart Scheduling ✅
- **Thread replies** — Chappie replies in existing Gmail threads via `get_last_thread` + `thread_id` pass-through to `/api/emails/send`
- **Email reading** — `get_email_thread` tool reads received + sent messages; uses `body_html` (not `body_text`); falls back to `company_id` search when thread_id yields no results
- **Reply detection** — Chappie now correctly detects inbound replies by resolving `company_id` from `person_id` before querying `crm_synced_emails`
- **CC support** — `send_email` passes CC array through Gmail API RFC 2822 headers; CC shown in confirmation card
- **Bulk email** — `send_bulk_email` tool sends to all contacts at a company
- **`client_id` auto-lookup** — email executor looks up `client_id` from `company_id` via `converted_from` so emails appear in client profile
- **`client_id` column** — added to `crm_emails_sent` via `ALTER TABLE`
- **Campaign analytics** — `get_campaign_stats` tool with opens/clicks/bounces/unsubscribes
- **`get_company_people`** — tool for team-level email targeting with CC
- **Unified emails tab** — `ClientProfile.js` emails tab merged into one table (removed Before/After Conversion split)
- **Meet link in chat** — after booking a meeting, Chappie shows the Google Meet link in the chat response
- **Date calculation** — Chappie shows exact calculated date in confirmation card before booking
- **Role-based CC** — system prompt instructs Chappie to call `get_company_people` before CCing a role
- **Phase 2 — Conflict detection** — `check_calendar_conflicts` tool fetches Google Calendar for the proposed day, finds overlapping events, suggests next available slot of same duration. Enforced before every `book_meeting` or `reschedule_meeting`. UTC offset via `Intl.DateTimeFormat shortOffset`
- **Phase 3 — Proposal tracking** — `propose_meeting` tool sends proposal email via Gmail API + inserts row in `crm_meeting_proposals` (`gmail_thread_id`, `proposed_start`, `proposed_end`, `status: pending`). `get_pending_proposals` tool queries pending proposals by company
- **Phase 4 — Reply intent detection + auto-book** — `gmailSync.js` checks every inbound message against `crm_meeting_proposals` by `gmail_thread_id`. GPT-4o-mini classifies reply intent (confirmed/declined/reschedule/unclear). On confirmed: auto-creates Google Calendar event + `crm_meetings` row + activity log entry
- **Phase 5 — Slack Bot** — Chappie available via Slack DMs using Socket Mode (`@slack/bolt`). Full tool access same as CRM widget. Block Kit confirmation cards with Confirm/Cancel buttons. Auto-book notifications post to `#all-planfor` channel
- **Note routing fix** — `add_note` now detects if company is converted to client and logs to both company + client activity timeline
- **Gmail scope fix** — replaced `gmail.readonly` with `gmail.modify` — enables mark-as-read on synced emails
- **Calendar monthly view fix** — `getEventsForDate` uses local date math instead of `.toISOString()` UTC comparison — fixes day-shift bug for UTC+3
- **Event popup timezone chip** — fetches linked company/client country+state, resolves via `getTimezone()` from `LocationSelector.js`, shows client local time alongside Jerusalem time
- **`convertClientTimeToUTC` fix** — rewrote using `Intl.DateTimeFormat shortOffset`. Previous `toLocaleString` round-trip was broken in IL browser locale

### v1.6.0 — AI Brain (Chappie)
- Floating chat widget on all authenticated pages (`AiBrain.js`)
- Function-calling agentic loop with MAX_ITERATIONS=6 per request
- 17 initial tools: read, write-instant, write-with-confirmation
- Confirmation card UI — yellow card with Confirm/Cancel buttons
- Persistent conversation history in `crm_ai_conversations` (last 50 messages)
- **Critical:** working history (with tool messages) kept separate from saved history (clean text only) — prevents orphaned `tool_calls` DB corruption
- UUID validation — rejects fabricated IDs from GPT before DB insert
- Conversation log page at `/ai/log` — admin sees all, users see own
- `AuthenticatedApp` wrapper in `App.js` to mount `AiBrain` once across all routes
- Chappie routes email via `/api/emails/send` (Gmail API), not SendGrid directly
- `person.company_id` from `crm_people` used for email FK (not companies array)

### v1.5.3 — Production Stability & Polish
- Custom domain `crm-api.planfor.io` (Render custom domain + Cloudflare CNAME)
- Production Google OAuth: `GOOGLE_REDIRECT_URI=https://crm-api.planfor.io/api/google/callback`
- Reschedule meeting flow — inline form in CompanyProfile, ClientProfile, and Calendar popup
- Activity filter buttons (All / Meetings / Emails / Notes) in client profile
- Inline edit meeting notes with Markdown rendering (react-markdown + remark-gfm)
- Google Meet + Zoom bot selector on meeting cards
- Calendar create form: person selector loads contacts from linked company

### v1.5.2 — Email Inbox
- Email Inbox page with Gmail sync, thread grouping, and unread count badge
- Quick Reply from inbox with Gmail threading (Re: prefix + thread_id)
- Sync Now button for manual trigger
- "View Client / View Contact" quick-link buttons per thread

### v1.4.0 — Gmail + Calendar + Meetings
- Gmail API integration (OAuth flow, send, incremental sync)
- Google Calendar integration (create, cancel, reschedule meetings)
- Meeting recording via Recall.ai (Google Meet + Zoom)
- AI meeting summaries and action items via GPT-4o-mini
- Timezone detection from US state with meeting time preview

### v1.3.0 — Marketing
- Marketing campaigns with SendGrid bulk send
- Open/click/bounce tracking via SendGrid webhooks
- Unsubscribe webhook + resubscribe flow
- Campaign builder with Tiptap visual + HTML editor
- Campaign stats dashboard

### v1.2.0 — Client Management
- Convert company to client flow
- ClientProfile with 6 tabs: Overview, Activity, Meetings, Documents, Emails, Vendor Page
- Client finance module (transactions per client)
- Document management with Supabase Storage upload

### v1.1.0 — Email & Templates
- Email templates with merge tags
- Direct email send via SendGrid
- Open/click tracking
- Activity timeline per company

### v1.0.0 — Foundation
- Pipeline management with stage stepper
- Company + people CRUD
- CSV import from Apollo
- Role-based access control (6 roles)
- JWT authentication

---

## Roadmap

### Completed
**v1.6.1 ✅ — Chappie Smart Scheduling + Slack Bot**
- Phase 1 ✅ — Thread replies, email reading, reply detection, CC support, bulk email, client_id auto-lookup, unified emails tab
- Phase 2 ✅ — Conflict detection: `check_calendar_conflicts` tool, Intl shortOffset UTC fix, enforced before every book/reschedule
- Phase 3 ✅ — Proposal tracking: `propose_meeting` tool, `crm_meeting_proposals` table, `get_pending_proposals` tool
- Phase 4 ✅ — Reply intent detection + auto-book: Gmail sync detects replies, GPT classifies intent, auto-books on confirmed
- Phase 5 ✅ — Slack Bot: Chappie on Slack via Socket Mode, Block Kit confirmations, #all-planfor alerts

**v1.6.2 ✅ — Calendly Integration + Calendar UX**
- Calendly polling every 5 minutes — creates CRM meetings, links Google Calendar event, matches invitee to CRM
- Auto-record via autoRecordCheck (2 min before meeting start)
- Calendar color coding by relationship type + hover legend
- Slack self-link in Settings page
- Note: will upgrade to webhook when Calendly plan upgraded

### In Progress
- **v1.7.0** — Stripe vendor subscription billing

### Planned
- **v1.7.1** — Internal task & to-do system
- **v1.8.0** — Reporting & analytics dashboard
- **v1.9.0** — Automation rules (trigger → action)

### Parallel Track
**GTM v1.0 — Waitlist & Pre-Launch Email Capture**
- Landing page at `comingsoon.planfor.io` (Cloudflare Pages, mobile-first, Instagram bio link)
- `waitlist_couples` table in Supabase (separate `couples_` prefix data layer)
- `POST /api/waitlist/subscribe` — double opt-in via SendGrid
- `GET /api/waitlist/confirm/:token` — email confirmation
- CRM Waitlist page: subscriber list, stats, export, send campaign
- SendGrid unsubscribe webhook branch for waitlist emails
- Foundation for future couples user management (`couples_users`, `couples_events`)