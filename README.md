# Planfor CRM

Internal sales CRM built for the Planfor.io team to manage wedding vendor outreach, convert leads to clients, send emails via Gmail API or SendGrid, sync inbox conversations, run marketing campaigns, schedule meetings with Google Calendar, manage client relationships, track internal company finances, and interact with Chappie — an AI assistant powered by GPT-4o-mini — all in one place.

**Live:** [crm.planfor.io](https://crm.planfor.io) · **API:** [crm-api.planfor.io](https://crm-api.planfor.io)

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Features](#features)
- [AI Assistant — Chappie](#ai-assistant--chappie)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Roles & Permissions](#roles--permissions)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
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
- Send branded emails using a design template system (Transactional / Campaign / Newsletter)
- Run automated drip sequences for waitlist couples
- Manage client vendor pages, documents, and finance
- Upload documents and receipts to Supabase Storage
- Track internal company expenses (servers, domains, tools, etc.)
- Interact with Chappie, an AI agent that can read CRM data, send emails, book meetings, and more
- Capture ideas on the go with My Thoughts — a personal whiteboard with Claude brainstorm chat

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Cloudflare Pages) |
| Backend | Express / Node.js (Render) |
| Database | Supabase (PostgreSQL) |
| Email | Gmail API + SendGrid |
| Calendar | Google Calendar API |
| AI (Chappie) | OpenAI GPT-4o-mini (function-calling agent) |
| AI (Thoughts) | Anthropic Claude (Haiku / Sonnet 4 / Opus 4) |
| Auth | JWT + bcrypt |
| Storage | Supabase Storage |
| Meeting Recording | Recall.ai |
| Waitlist | Vercel (comingsoon.planfor.io) |

---

## Architecture

### Email Send Flow
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
```

### Campaign Send Flow
```
User clicks Send Campaign
        │
        ▼
POST /api/marketing/campaigns/:id/send
        │
        ├─ Generate unsubscribe token per recipient
        ├─ Insert crm_campaign_recipients rows
        ├─ For each recipient:
        │     ├─ Resolve merge tags (first_name, company_name, city)
        │     ├─ Wrap with design template (campaign type)
        │     ├─ Replace {{unsubscribe_url}} with token URL
        │     └─ Send via SendGrid fetch API
        └─ Update campaign status → sent
```

### Drip Sequence Flow
```
New waitlist signup (POST /api/waitlist/subscribe)
        │
        ├─ Insert waitlist_couples
        ├─ Send confirmation email (transactional template)
        └─ Auto-enroll in all active drip sequences
                │
                ▼
        crm_drip_enrollments row created

Drip Runner (every hour, server/services/dripRunner.js)
        │
        ├─ Fetch all active sequences
        ├─ For each enrollment:
        │     ├─ Check which steps not yet sent
        │     ├─ Check if delay_days has passed since enrollment
        │     ├─ Send email via SendGrid
        │     ├─ Log to crm_drip_sends with sendgrid_message_id
        │     └─ Mark enrollment complete when all steps sent
        └─ Repeat hourly
```

### Gmail Sync Flow
```
Gmail Sync (every 3 min, server/services/gmailSync.js)
        │
        ▼
fetchNewMessages()
        │
        ├─ Matches from_email to crm_people → resolves company_id
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
- Reusable email templates with merge tags
- Tiptap visual editor + raw HTML mode
- User email signature (HTML, stored per user)
- Open/click/bounce tracking via SendGrid webhooks
- CC support for direct emails
- Thread reply support (gmail_thread_id pass-through)

### Email Design System
- 3 design template types: Transactional (600px), Campaign (600px), Newsletter (700px)
- Each template has header_html + footer_html + wrapper_html with `{{content}}` placeholder
- `{{unsubscribe_url}}` placeholder replaced server-side before send
- Per-campaign design template selector in campaign builder
- Drip steps can specify design template or fall back to Transactional default
- Design templates editable in CRM without code deploy
- Live preview in drip step editor — see full rendered email as you type
- Planfor branded templates: dark green header, logo, slogan, Instagram, privacy policy

### Email Inbox
- Two-way Gmail sync (incremental, runs every 3 minutes)
- Thread grouping — conversations chronologically
- Quick Reply — reply directly from inbox with Gmail threading
- Unread count badge in sidebar

### Calendar & Meetings
- Full-page calendar: Month / Week / Day views
- Google Calendar API (read/write sync)
- Create meetings: Google Meet (auto-link) or Phone Call
- Timezone conversion — auto-detect client timezone from US state
- Cancel / reschedule meeting (updates Google Calendar)
- Meeting recording via Recall.ai bot (Google Meet + Zoom)
- AI-generated meeting summary and action items via GPT-4o-mini
- Auto-record: bot sent 2 minutes before meeting start

### Marketing Campaigns
- Campaign builder: Content → Recipients → Review & Send
- Source filter: All / Contacts / Clients / Waitlist Couples
- Tiptap visual + HTML side-by-side editor
- Design template selector per campaign
- Token-based unsubscribe — clean URLs, no query params, SendGrid click tracking safe
- Smart unsubscribe routing: vendor contacts → crm_people, waitlist couples → waitlist_couples
- List-Unsubscribe headers for Gmail/Outlook one-click unsubscribe
- Campaign stats: opens, clicks, bounces, unsubscribes
- Hot leads: filter opened/clicked recipients, launch follow-up campaign directly
- Unsubscribe audit log: IP, user agent, timestamp, campaign ID

### Drip Sequences
- Visual sequence builder with step cards
- Each step: delay (days), subject, body HTML, design template, on/off toggle
- Connector lines showing timing between steps
- Auto-enroll on waitlist signup (active sequences only)
- Hourly cron runner checks enrollments and sends due steps
- Per-step tracking: Sent / Opened / Clicked / Bounced
- Global on/off toggle per sequence
- Live preview panel in step editor

### Waitlist
- Landing page at comingsoon.planfor.io (separate planfor-waitlist repo, Vercel)
- Confirmation email via CRM template (Waitlist Confirmation)
- Auto-enroll in active drip sequences on signup
- Full audit trail: IP, user agent, consent text, timestamp
- Unsubscribe audit: IP, user agent, timestamp
- Export CSV with full audit columns
- CRM Waitlist tab: stats, search, table, delete

### My Thoughts
- Personal whiteboard at /thoughts — private per user
- Each thought is a card with a dedicated Claude chat
- Model selector: Haiku (cheap), Sonnet 4 (balanced), Opus 4 (deep thinking)
- Slack trigger: `thought: your idea` or `idea: your idea` logs to My Thoughts
- Markdown stripped from Claude responses

### Client Management
- 6-tab client profile: Overview, Activity, Meetings, Documents, Emails, Vendor Page
- Unified emails tab (direct + campaign history)
- Document management with file upload (Supabase Storage)
- Vendor marketplace page editor
- Contract tracking (RevShare / Commission / Subscription)
- Finance tab: per-client transactions

### Finance Module
- Internal expense tracker (admin + finance roles)
- Per-client transactions
- Receipt upload to Supabase Storage

### Dashboard
- Pipeline velocity — avg days per stage, color-coded (green/amber/red)
- Waitlist growth sparkline — last 14 days + 4 stats (total, consented, this week, today)
- My Thoughts count this week
- Campaign avg open rate
- Stale leads, recent activity, upcoming meetings, team stats

---

## AI Assistant — Chappie

Chappie is a function-calling AI agent built into the CRM. It uses GPT-4o-mini and has access to 20+ tools covering the full CRM. Accessible via floating widget (bottom right) and conversation log at `/ai/log`.

### Architecture
- **Type:** Agentic loop (not RAG)
- **Model:** GPT-4o-mini
- **Max iterations:** 6 per request
- **History:** Persistent per conversation, stored in `crm_ai_conversations`
- **New Conversation:** "+ New Chat" button starts fresh with no memory of previous sessions
- **Timestamps:** Each message shows time sent

### Tools

**Read (instant):**
`search_contacts` · `get_company_people` · `get_company_brief` · `get_client_status` · `get_pipeline_summary` · `get_stale_leads` · `get_my_meetings` · `get_finance_summary` · `get_marketing_history` · `get_campaign_stats` · `get_last_thread` · `get_email_thread` · `get_all_campaigns` · `get_waitlist_stats` · `get_waitlist_list` · `search_conversation_history`

**Write instant:**
`add_note` · `update_pipeline_stage` · `update_client_stage` · `update_next_action`

**Write with confirmation:**
`send_email` · `send_bulk_email` · `book_meeting` · `cancel_meeting` · `reschedule_meeting` · `propose_meeting`

### Key Behaviors
- Always calls `search_contacts` before any action involving a name
- Uses `person.company_id` from people array to ensure valid FK
- Validates UUIDs before DB insert
- Thread replies: `get_last_thread` → `send_email` with thread_id
- No markdown in responses (stripped server-side)
- Slack: full Chappie functionality via DM with Block Kit confirmation buttons

---

## Project Structure

```
venueflow-crm/
├── server/
│   ├── routes/
│   │   ├── auth.js             # Login, JWT generation
│   │   ├── ai.js               # Chappie chat, history, new-conversation
│   │   ├── contacts.js         # Companies, people, activity, notes
│   │   ├── clients.js          # Client CRUD, conversion, documents, vendor page, finance
│   │   ├── emails.js           # Templates, sent emails, Gmail/SendGrid dual send
│   │   ├── google.js           # Gmail OAuth flow, token management
│   │   ├── sync.js             # Gmail inbox sync, unread count
│   │   ├── calendar.js         # Google Calendar events, meetings CRUD
│   │   ├── marketing.js        # Campaigns, bulk send, webhook, unsubscribe
│   │   ├── waitlist.js         # Waitlist subscribe, confirm, unsubscribe
│   │   ├── thoughts.js         # My Thoughts CRUD + Claude chat
│   │   ├── designTemplates.js  # Email design templates CRUD
│   │   ├── drip.js             # Drip sequences, steps, enrollments, stats
│   │   ├── finance.js          # Company expenses
│   │   ├── uploads.js          # Supabase Storage upload/delete
│   │   └── users.js            # Team mgmt, profile, signature, timezone
│   ├── services/
│   │   ├── aiBrain.js          # Chappie agentic loop + confirmation flow
│   │   ├── aiTools.js          # 20+ tool definitions + executors
│   │   ├── aiSummary.js        # GPT meeting summary generator
│   │   ├── gmailSync.js        # Smart selective sync engine
│   │   ├── dripRunner.js       # Hourly drip sequence processor
│   │   ├── emailWrapper.js     # Wraps email body with design template
│   │   ├── slackBot.js         # Chappie on Slack via Socket Mode
│   │   └── calendlySync.js     # Calendly polling sync
│   ├── middleware/
│   │   ├── auth.js             # JWT verification
│   │   └── rbac.js             # Role-based access control
│   ├── db.js                   # Supabase client
│   └── index.js                # Express entry + sync intervals + drip runner
├── client/
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.js         # Morning briefing — pipeline, waitlist, thoughts, campaigns
│       │   ├── Contacts.js
│       │   ├── CompanyProfile.js
│       │   ├── Clients.js
│       │   ├── ClientProfile.js
│       │   ├── Emails.js            # Email templates + Design Templates tab
│       │   ├── EmailInbox.js
│       │   ├── Calendar.js
│       │   ├── Marketing.js         # Campaigns + Drip + Waitlist + Unsubscribed
│       │   ├── Thoughts.js          # My Thoughts personal whiteboard
│       │   ├── Finance.js
│       │   ├── AiLog.js
│       │   ├── Settings.js
│       │   ├── Import.js
│       │   └── Team.js
│       ├── components/
│       │   ├── Sidebar.js
│       │   ├── AiBrain.js           # Chappie floating widget
│       │   ├── TiptapEditor.js
│       │   ├── HtmlEditor.js        # CodeMirror HTML editor with line wrapping
│       │   └── ScheduleMeetingModal.js
│       └── App.js
├── .env
└── README.md
```

---

## Database Schema

### Core Tables

#### `crm_users`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| email, name | text | |
| password | text | bcrypt |
| role | text | admin / sales / marketing / csm / support / finance |
| timezone | text | IANA (e.g. Asia/Jerusalem) |
| email_signature | text | HTML |
| slack_user_id | text | For Chappie Slack integration |

#### `crm_companies`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| company_name, website, category | text | |
| stage | text | New / Contacted / No Reply / Follow-up / Meeting Scheduled / Proposal Offered / Agreement Sent / Closed Won / Closed Lost / Not Interested / Converted |
| city, state, country | text | |
| origin | text | Upload / Cold / Hot / Instagram / Google / Referral |
| assigned_to | uuid | FK → crm_users |
| marketing_unsubscribed | boolean | |

#### `crm_people`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| company_id | uuid | FK → crm_companies |
| first_name, last_name, title, email | text | |
| marketing_unsubscribed | boolean | |
| marketing_unsubscribed_at | timestamptz | |
| unsubscribe_ip, unsubscribe_user_agent | text | Audit |
| unsubscribe_campaign_id | text | Which campaign triggered unsubscribe |

#### `crm_clients`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| converted_from | uuid | FK → crm_companies |
| assigned_to | uuid | FK → crm_users |
| business_name, contact_email | text | |
| stage | text | Onboarding / Active / Paused / Churned |
| contract_type | text | RevShare / Commission / Subscription |
| commission_rate, contract_amount | numeric | |

### Email Tables

#### `crm_email_templates`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name, subject, body_html | text | |
| category | text | Outreach / Follow-up / Proposal / Waitlist / General |
| visibility | text | team / private |
| include_signature | boolean | |
| created_by | uuid | FK → crm_users |

#### `crm_email_design_templates`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | |
| type | text | transactional / campaign / newsletter |
| width | integer | 600 or 700 |
| header_html, footer_html | text | |
| wrapper_html | text | Full wrapper with `{{content}}` placeholder |
| active | boolean | Only one active per type used as default |

#### `crm_emails_sent`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id, company_id, client_id, person_id | uuid | FKs |
| subject, body_html | text | |
| send_method | text | gmail / sendgrid |
| email_status | text | delivered / opened / clicked / bounced |
| sendgrid_message_id, gmail_thread_id | text | |
| opened_at, clicked_at, bounced_at | timestamptz | |

### Marketing Tables

#### `crm_campaigns`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name, subject, body_html | text | |
| from_name, from_email | text | |
| status | text | draft / sending / sent |
| design_template_id | uuid | FK → crm_email_design_templates |
| recipients_count | integer | |
| sent_at | timestamptz | |
| created_by | uuid | FK → crm_users |

#### `crm_campaign_recipients`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| campaign_id | uuid | FK → crm_campaigns |
| company_id, person_id | uuid | Optional FKs |
| email | text | |
| recipient_type | text | contact / waitlist |
| status | text | pending / delivered / opened / clicked / bounced / unsubscribed |
| unsubscribe_token | text | Unique per recipient, used in clean URL |
| opened_at, clicked_at, bounced_at, unsubscribed_at | timestamptz | |

### Drip Tables

#### `crm_drip_sequences`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | |
| audience | text | waitlist (default) |
| active | boolean | Global on/off |

#### `crm_drip_steps`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| sequence_id | uuid | FK → crm_drip_sequences |
| step_number | integer | Order |
| delay_days | integer | Days after signup (step 1) or previous step |
| subject, body_html | text | |
| design_template_id | uuid | FK → crm_email_design_templates (optional) |
| active | boolean | Per-step toggle |

#### `crm_drip_enrollments`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| sequence_id | uuid | FK → crm_drip_sequences |
| email, first_name | text | |
| recipient_type | text | waitlist |
| enrolled_at | timestamptz | |
| completed | boolean | True when all steps sent |

#### `crm_drip_sends`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| enrollment_id | uuid | FK → crm_drip_enrollments |
| step_id | uuid | FK → crm_drip_steps |
| email | text | |
| sendgrid_message_id | text | For webhook tracking |
| status | text | sent / opened / clicked / bounced |
| opened_at, clicked_at, bounced_at | timestamptz | |

### Waitlist Table

#### `waitlist_couples`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| email | text | Unique |
| first_name, last_name, name | text | |
| marketing_consent | boolean | |
| consent_at | timestamptz | |
| ip_address, user_agent | text | Signup audit |
| consent_text | text | Exact consent language shown |
| unsubscribed_at | timestamptz | |
| unsubscribe_ip, unsubscribe_user_agent | text | Unsubscribe audit |

### AI Tables

#### `crm_ai_conversations`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → crm_users |
| messages | jsonb | Clean text history (no tool messages) |
| last_message | text | |
| actions_taken | jsonb | Array of executed actions with timestamps |

#### `crm_thoughts`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → crm_users (private) |
| content | text | |
| created_at, updated_at | timestamptz | |

#### `crm_thought_conversations`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| thought_id | uuid | FK → crm_thoughts |
| messages | jsonb | Full Claude conversation history |

### Calendar & Meeting Tables

#### `crm_meetings`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| google_event_id, google_account_id | text/uuid | Google Calendar link |
| company_id, client_id, person_id | uuid | Optional FKs |
| title, description | text | |
| meeting_type | text | google_meet / phone |
| status | text | scheduled / completed / cancelled |
| start_time, end_time | timestamptz | UTC |
| meet_link | text | |
| ai_summary | text | GPT-generated |
| ai_action_items | jsonb | [{task, owner, priority}] |
| recall_bot_id | text | |
| auto_record | boolean | |

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
| Manage drip sequences | ✅ | — | ✅ | — | — | — |
| Manage team | ✅ | — | — | — | — | — |
| View AI log (all users) | ✅ | — | — | — | — | — |
| Use Chappie | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| My Thoughts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Environment Variables

```bash
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=

# Auth
JWT_SECRET=

# SendGrid
SENDGRID_API_KEY=                    # Main API key for campaigns + direct emails
SENDGRID_MARKETING_KEY=              # Full-access key (if separate)
SENDGRID_FROM_EMAIL=
SENDGRID_WEBHOOK_KEY_MARKETING=      # SendGrid webhook signature verification key

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://crm-api.planfor.io/api/google/callback

# App URLs
CLIENT_URL=https://crm.planfor.io
API_BASE_URL=https://crm-api.planfor.io/api

# OpenAI (meeting summaries + Chappie)
OPENAI_API_KEY=
OPENAI_API_KEY_BRAIN=

# Anthropic (My Thoughts Claude chat)
ANTHROPIC_API_KEY=

# Recall.ai (meeting recording)
RECALL_API_KEY=

# Slack (Chappie bot)
SLACK_BOT_TOKEN=
SLACK_APP_TOKEN=
SLACK_ALERTS_CHANNEL=#all-planfor

# Calendly
CALENDLY_API_KEY=
CALENDLY_WEBHOOK_SECRET=
```

---

## Getting Started

### Prerequisites
- Node.js v18+
- Supabase project with schema applied
- SendGrid account with verified sender domain
- Google Cloud project with Gmail API + Calendar API enabled
- OAuth 2.0 consent screen configured with redirect URI
- Anthropic API key (for My Thoughts Claude chat)

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

> ⚠️ **macOS port 5000 conflict:** AirPlay Receiver uses port 5000 on macOS Monterey+. Disable it in System Settings → AirPlay before starting the backend.

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
| PUT | `/api/contacts/companies/:id` | Update company |
| DELETE | `/api/contacts/companies/:id` | Delete company |
| POST | `/api/contacts/companies/:id/people` | Add person |
| PUT | `/api/contacts/people/:id` | Update person |
| DELETE | `/api/contacts/people/:id` | Delete person |
| GET | `/api/contacts/companies/:id/activity` | Activity log |
| POST | `/api/contacts/companies/:id/note` | Add note |
| GET | `/api/contacts/activity/recent` | Last 15 actions |

### Emails
| Method | Route | Description |
|---|---|---|
| GET | `/api/emails/templates` | List templates |
| POST | `/api/emails/templates` | Create template |
| PUT | `/api/emails/templates/:id` | Update template |
| DELETE | `/api/emails/templates/:id` | Delete template |
| POST | `/api/emails/send` | Send email (Gmail or SendGrid) |
| GET | `/api/emails/sent/company/:id` | Sent emails for company |

### Design Templates
| Method | Route | Description |
|---|---|---|
| GET | `/api/design-templates` | List all design templates |
| POST | `/api/design-templates` | Create design template |
| PUT | `/api/design-templates/:id` | Update design template |
| DELETE | `/api/design-templates/:id` | Delete design template |
| GET | `/api/design-templates/type/:type` | Get active template by type |

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

### Calendar
| Method | Route | Description |
|---|---|---|
| GET | `/api/calendar/events` | Google Calendar events |
| GET | `/api/calendar/meetings` | All CRM meetings |
| POST | `/api/calendar/meetings` | Create meeting |
| PUT | `/api/calendar/meetings/:id` | Update meeting |
| DELETE | `/api/calendar/meetings/:id` | Cancel meeting |
| PUT | `/api/calendar/meetings/:id/reschedule` | Reschedule |
| GET | `/api/calendar/upcoming` | Upcoming meetings |
| POST | `/api/calendar/meetings/:id/record` | Send Recall.ai bot |
| POST | `/api/calendar/meetings/:id/process-transcript` | Summarize transcript |

### Gmail & Sync
| Method | Route | Description |
|---|---|---|
| GET | `/api/google/auth-url` | Get OAuth URL |
| GET | `/api/google/callback` | OAuth callback |
| GET | `/api/google/accounts` | List connected accounts |
| DELETE | `/api/google/accounts/:id` | Disconnect account |
| GET | `/api/sync/emails/inbox` | Inbox threads |
| GET | `/api/sync/emails/unread-count` | Unread badge count |
| POST | `/api/sync/trigger` | Manual sync trigger |

### AI (Chappie)
| Method | Route | Description |
|---|---|---|
| POST | `/api/ai/chat` | Send message to Chappie |
| POST | `/api/ai/new-conversation` | Start fresh conversation |
| GET | `/api/ai/history` | Conversation history |
| GET | `/api/ai/history/:id` | Full conversation messages |
| GET | `/api/ai/agents` | List all agents (admin) |
| DELETE | `/api/ai/history/:id` | Delete conversation |

### My Thoughts
| Method | Route | Description |
|---|---|---|
| GET | `/api/thoughts` | Get my thoughts (private) |
| POST | `/api/thoughts` | Create thought |
| PUT | `/api/thoughts/:id` | Update thought |
| DELETE | `/api/thoughts/:id` | Delete thought |
| GET | `/api/thoughts/:id/chat` | Get Claude conversation |
| POST | `/api/thoughts/:id/chat` | Send message to Claude |

### Marketing
| Method | Route | Description |
|---|---|---|
| GET | `/api/marketing/campaigns` | List campaigns with stats |
| POST | `/api/marketing/campaigns` | Create campaign |
| GET | `/api/marketing/campaigns/:id` | Campaign + recipients + stats |
| PUT | `/api/marketing/campaigns/:id` | Update draft campaign |
| DELETE | `/api/marketing/campaigns/:id` | Delete draft campaign |
| POST | `/api/marketing/campaigns/:id/send` | Send campaign |
| POST | `/api/marketing/webhook` | SendGrid event webhook |
| GET | `/api/marketing/stats` | Global marketing stats |
| GET | `/api/marketing/recipients` | Filtered recipient list |
| GET | `/api/marketing/unsubscribed` | Unsubscribed contacts |
| GET | `/api/marketing/unsubscribe/:token` | One-click unsubscribe |
| POST | `/api/marketing/resubscribe/:personId` | Resubscribe person |
| POST | `/api/marketing/resubscribe-bulk` | Bulk resubscribe |
| GET | `/api/marketing/waitlist` | Waitlist subscribers |
| DELETE | `/api/marketing/waitlist/:id` | Delete subscriber |

### Drip Sequences
| Method | Route | Description |
|---|---|---|
| GET | `/api/drip/sequences` | List sequences with counts |
| POST | `/api/drip/sequences` | Create sequence |
| PUT | `/api/drip/sequences/:id` | Update sequence (incl. active toggle) |
| DELETE | `/api/drip/sequences/:id` | Delete sequence |
| GET | `/api/drip/sequences/:id/steps` | List steps for sequence |
| POST | `/api/drip/sequences/:id/steps` | Add step |
| PUT | `/api/drip/steps/:id` | Update step |
| DELETE | `/api/drip/steps/:id` | Delete step |
| GET | `/api/drip/steps/:id/stats` | Step tracking stats |
| GET | `/api/drip/sequences/:id/enrollments` | List enrollments |

### Waitlist
| Method | Route | Description |
|---|---|---|
| POST | `/api/waitlist/subscribe` | Public signup endpoint |
| GET | `/api/waitlist/unsubscribe` | Unsubscribe via email param |

### Users
| Method | Route | Description |
|---|---|---|
| GET | `/api/users` | List all users (admin) |
| POST | `/api/users/invite` | Create user (admin) |
| PUT | `/api/users/:id/role` | Change role (admin) |
| DELETE | `/api/users/:id` | Delete user (admin) |
| GET | `/api/users/me` | Current user profile |
| PUT | `/api/users/me/timezone` | Update timezone |
| PUT | `/api/users/me/signature` | Update email signature |

### Finance
| Method | Route | Description |
|---|---|---|
| GET | `/api/finance/expenses` | List expenses |
| POST | `/api/finance/expenses` | Create expense |
| PUT | `/api/finance/expenses/:id` | Update expense |
| DELETE | `/api/finance/expenses/:id` | Delete expense |
| GET | `/api/finance/expenses/summary` | Finance summary |

> All routes require `Authorization: Bearer <token>` header except public webhook and waitlist endpoints.

> ⚠️ **Route order matters:** In `users.js`, `/me` routes must come BEFORE `/:id` routes.

## Changelog

### v1.9.0 — Email Design System + Drip Sequences
- **Email Design System** — 3 design template types: Transactional (600px), Campaign (600px), Newsletter (700px). Each has header/footer/wrapper HTML with `{{content}}` placeholder. Editable in CRM without code deploy
- **Planfor branded templates** — dark green header (#3E423D), logo, "Your Wedding, Your Way" slogan, Instagram link, privacy policy footer, human copy ("Sent with care by the Planfor team")
- **`{{unsubscribe_url}}` injection** — placeholder replaced server-side before send for both campaigns and waitlist emails
- **Per-campaign design template selector** — campaign builder Step 1 lets you choose which design template wraps the email
- **Design template preview** — 👁 Preview button on each template card shows full rendered preview with placeholder content
- **`crm_email_design_templates` table** — id, name, type, width, header_html, footer_html, wrapper_html, active
- **`server/services/emailWrapper.js`** — `wrapWithDesignTemplate(body, type)` and `wrapWithDesignTemplateById(body, id)` — used by campaigns, waitlist, and drip
- **Drip Sequence builder** — create sequences with multiple email steps, each with delay (days), subject, body, design template, on/off toggle
- **Live preview panel** — split-panel drip step editor: HTML editor on left, full rendered email preview on right, updates as you type
- **Hourly drip runner** — `server/services/dripRunner.js` runs every hour, checks enrollments, sends due steps via SendGrid
- **Auto-enroll on signup** — new waitlist signups auto-enrolled in all active sequences immediately
- **Drip tracking** — `sendgrid_message_id` captured per send, webhook routes drip events to `crm_drip_sends` (opened_at, clicked_at, bounced_at)
- **Per-step stats** — step cards show Sent / Opened (%) / Clicked / Bounced counts
- **Waitlist as campaign audience** — campaign builder Source dropdown includes "Waitlist Couples Only" — pulls from `waitlist_couples` where consent is true and not unsubscribed
- **Smart unsubscribe routing** — `recipient_type` column on `crm_campaign_recipients` determines which table to update: vendor contacts → `crm_people`, waitlist couples → `waitlist_couples`
- **New Supabase tables** — `crm_drip_sequences`, `crm_drip_steps`, `crm_drip_enrollments`, `crm_drip_sends`
- **New Supabase columns** — `crm_campaigns.design_template_id`, `crm_campaign_recipients.recipient_type`, `crm_campaign_recipients.unsubscribe_token`, `crm_drip_sends.sendgrid_message_id`, `crm_drip_sends.email`, `crm_drip_sends.opened_at`, `crm_drip_sends.clicked_at`, `crm_drip_sends.bounced_at`, `crm_drip_enrollments.first_name`

### v1.8.0 — Dashboard Enhancement
- **Waitlist growth widget** — sparkline chart (last 14 days) + 4 stats: Total, Consented, This Week, Today
- **Pipeline velocity widget** — avg days per stage, color-coded: green (<7d), amber (7-14d), red (>14d)
- **My Thoughts widget** — thoughts captured this week with link to /thoughts
- **Campaign performance widget** — avg open rate across all sent campaigns + total campaigns count
- All 4 new widgets added as analytics row above existing bottom grid

### v1.7.0 — My Thoughts + Chappie Conversations
- **My Thoughts page** — personal whiteboard at `/thoughts`, private per user. Each thought is a card with a dedicated Claude brainstorm chat
- **Claude brainstorm chat** — model selector: Haiku (cheap/fast), Sonnet 4 (balanced), Opus 4 (deep thinking). Markdown stripped server-side
- **Slack thought logging** — prefix `thought:` or `idea:` in Chappie DM logs to My Thoughts automatically
- **New Conversation button** — "+ New Chat" in Chappie widget starts a fresh conversation with no memory of previous sessions
- **Message timestamps** — each Chappie message shows time sent
- **`conversationId` threading** — Chappie widget passes conversation ID to keep messages in correct thread
- **`POST /api/ai/new-conversation`** — creates fresh conversation record
- **`crm_thoughts` table** — id, user_id, content, created_at, updated_at
- **`crm_thought_conversations` table** — id, thought_id, messages (jsonb)
- **`ANTHROPIC_API_KEY`** env var added for direct Claude API calls

### v1.6.4 — Email Deliverability + Unsubscribe System
- **Token-based unsubscribe** — unique token per recipient stored in `crm_campaign_recipients.unsubscribe_token`. Clean URL `/api/marketing/unsubscribe/:token` — no query params, SendGrid click tracking safe
- **List-Unsubscribe headers** — `List-Unsubscribe` + `List-Unsubscribe-Post` on all campaign emails — Gmail/Outlook show one-click unsubscribe button next to sender name
- **`clicktrack="off"` on unsubscribe link** — body links still tracked, unsubscribe footer link exempt
- **Campaign send switched from sgMail to fetch** — prevents SendGrid library from stripping href attributes
- **Waitlist confirmation uses CRM template** — "Waitlist Confirmation" template fetched dynamically from `crm_email_templates`
- **Waitlist first_name + last_name** — split name fields on landing page and in `waitlist_couples`
- **Unsubscribe audit log** — IP, user agent, timestamp, campaign ID logged for both campaigns and waitlist
- **Export CSV** — full audit export for unsubscribed contacts and waitlist
- **New Supabase columns** — `crm_people`: unsubscribe_ip, unsubscribe_user_agent, unsubscribe_campaign_id. `waitlist_couples`: unsubscribe_ip, unsubscribe_user_agent, unsubscribed_at, first_name, last_name

### v1.6.3 — Campaign Analytics + AI Log + GTM v1.0
- **Campaign hot leads** — filter tabs (All/Opened/Clicked/Delivered/Bounced/Unsubscribed), checkboxes, "New Campaign from Selected" button
- **Email preview collapse** — collapsed by default in campaign detail, click to expand
- **Chappie tools** — `get_all_campaigns`, `get_waitlist_stats`, `get_waitlist_list`, `search_conversation_history`
- **Markdown strip** — all Chappie responses stripped of markdown server-side
- **AI Log redesign** — fixed height split panel, daily grouping (Today/Yesterday/date), independent scroll
- **Waitlist full stack** — landing page at `comingsoon.planfor.io` (Vercel), backend `POST /api/waitlist/subscribe`, CRM Waitlist tab with stats/search/export/delete
- **Calendar color coding** — Client (teal), Contact (green), Calendly unmatched (orange), Internal (purple), Google only (yellow)
- **Slack self-link** — Settings page lets each user paste their Slack Member ID

### v1.6.2 — Calendly Integration + Calendar UX
- **Calendly polling** — syncs every 5 minutes, creates CRM meetings, links Google Calendar event, matches invitee to contacts/clients
- **Auto-record** — Recall.ai bot sent 2 min before meeting start via autoRecordCheck
- **Calendar color coding + legend** — meetings colored by relationship type with hover legend
- **Gmail scope** — upgraded to `gmail.modify`

### v1.6.1 — Chappie Smart Scheduling + Slack Bot
- **Thread replies** — `get_last_thread` + `thread_id` pass-through to `/api/emails/send`
- **Email reading** — `get_email_thread` reads body_html; falls back to company_id search when thread_id yields no results
- **CC support** — send_email passes CC array through Gmail API RFC 2822 headers
- **Bulk email** — `send_bulk_email` tool sends to all contacts at a company
- **`client_id` auto-lookup** — email executor resolves `client_id` from `company_id` via `converted_from`
- **Phase 2** — `check_calendar_conflicts` tool, UTC offset via `Intl.DateTimeFormat shortOffset`
- **Phase 3** — `propose_meeting` tool, `crm_meeting_proposals` table, `get_pending_proposals`
- **Phase 4** — Gmail sync detects replies, GPT-4o-mini classifies intent, auto-books on confirmed
- **Phase 5** — Chappie on Slack: Socket Mode, Block Kit confirmation buttons, `#all-planfor` alerts
- **Calendar fix** — local date math fixes day-shift bug for UTC+3
- **`convertClientTimeToUTC` fix** — rewrote using `Intl.DateTimeFormat shortOffset`

### v1.6.0 — AI Brain (Chappie)
- Floating chat widget on all authenticated pages
- Function-calling agentic loop, MAX_ITERATIONS=6
- 20+ tools: read, write-instant, write-with-confirmation
- Confirmation card UI — yellow card with Confirm/Cancel
- Persistent conversation history in `crm_ai_conversations`
- UUID validation — rejects fabricated IDs before DB insert
- Conversation log at `/ai/log` — admin sees all, users see own

### v1.5.3 — Production Stability & Polish
- Custom domain `crm-api.planfor.io`
- Reschedule meeting flow in CompanyProfile, ClientProfile, Calendar popup
- Activity filter buttons (All / Meetings / Emails / Notes)
- Inline edit meeting notes with Markdown rendering
- Google Meet + Zoom bot selector on meeting cards

### v1.5.2 — Email Inbox
- Email Inbox with Gmail sync, thread grouping, unread badge
- Quick Reply with Gmail threading
- "View Client / View Contact" quick-links per thread

### v1.4.0 — Gmail + Calendar + Meetings
- Gmail API integration (OAuth, send, incremental sync)
- Google Calendar (create, cancel, reschedule)
- Meeting recording via Recall.ai
- AI meeting summaries via GPT-4o-mini
- Timezone detection from US state

### v1.3.0 — Marketing
- Campaigns with SendGrid bulk send
- Open/click/bounce tracking via webhooks
- Campaign builder with Tiptap visual + HTML editor

### v1.2.0 — Client Management
- Convert company to client flow
- ClientProfile with 6 tabs
- Client finance module
- Document management with Supabase Storage

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

## Roadmap

### Completed

**v1.9.0 ✅ — Email Design System + Drip Sequences**
- Email design template system (Transactional, Campaign, Newsletter)
- Planfor branded templates with logo, slogan, Instagram, privacy policy
- Per-campaign design template selector
- Drip sequence builder with step editor and live preview
- Hourly drip runner with auto-enroll on waitlist signup
- Drip tracking: sent/opened/clicked/bounced per step
- Waitlist couples as campaign audience
- Smart unsubscribe routing by recipient type

**v1.8.0 ✅ — Dashboard Enhancement**
- Waitlist growth sparkline + stats
- Pipeline velocity per stage
- My Thoughts weekly count
- Campaign avg open rate widget

**v1.7.0 ✅ — My Thoughts + Chappie Conversations**
- My Thoughts personal whiteboard with Claude brainstorm chat
- Model selector: Haiku, Sonnet 4, Opus 4
- Slack thought logging via thought:/idea: prefix
- New Conversation button in Chappie widget
- Message timestamps in Chappie

**v1.6.4 ✅ — Email Deliverability + Unsubscribe System**
- Token-based unsubscribe for campaigns
- List-Unsubscribe headers on all marketing emails
- Unsubscribe audit log with IP, user agent, campaign ID
- CSV export for unsubscribed contacts and waitlist
- Waitlist confirmation wired to CRM template
- Waitlist first_name + last_name

**v1.6.3 ✅ — Campaign Analytics + AI Log + GTM v1.0**
- Campaign hot leads, filter tabs, follow-up campaign launcher
- AI Log redesign: split panel, daily grouping, independent scroll
- Chappie tools: get_all_campaigns, get_waitlist_stats, get_waitlist_list, search_conversation_history
- Waitlist full stack: landing page + backend + CRM management

**v1.6.2 ✅ — Calendly Integration + Calendar UX**
- Calendly polling, Google Calendar event linking, CRM record creation
- Auto-record via autoRecordCheck (2 min before meeting start)
- Calendar color coding by relationship type + hover legend

**v1.6.1 ✅ — Chappie Smart Scheduling + Slack Bot**
- Thread replies, email reading, CC support, bulk email
- Conflict detection, proposal tracking, reply intent + auto-book
- Slack Bot: Socket Mode, Block Kit confirmations, #all-planfor alerts

**GTM v1.0 ✅ — Waitlist & Pre-Launch Email Capture**
- Landing page at comingsoon.planfor.io (Vercel)
- waitlist_couples table with full audit trail
- SendGrid confirmation email with tracking
- CRM Waitlist tab: stats, table, search, export CSV
- CAN-SPAM + GDPR compliant

---

### Planned

**v1.9.1 — Waitlist Email Validation**
- Track delivery/bounce status on waitlist confirmation emails
- Add email_status column to waitlist_couples
- Route SendGrid webhook events to update waitlist records
- Show ✅ Delivered / 📬 Opened / ❌ Bounced badges in Waitlist tab
- Bounce = likely fake email — flag for review

**v2.0 — Newsletter + RAG**
- Weekly newsletter flow: write content in CRM, AI writing assistant, image upload
- Claude RAG — Chappie ingests CRM history, emails, notes into vector store
- Proactive insights: "QualifAI hasn't replied in 14 days, here's a suggested follow-up"
- Multi-user context awareness
- Planned before open source release + LinkedIn post

**Open Source Release**
- Codebase cleanup and full documentation
- Remove all internal credentials and seed data
- LinkedIn announcement post
- Target: after v2.0 ships