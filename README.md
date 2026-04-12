# Planfor CRM

Internal sales CRM built for the Planfor.io team to manage wedding vendor outreach, convert leads to clients, send emails via Gmail API or SendGrid, sync inbox conversations, run marketing campaigns, schedule meetings with Google Calendar, manage client relationships, track internal company finances, and interact with Chappie — an AI assistant powered by GPT-4o-mini with RAG memory, file uploads, and Slack integration.

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
- Record meetings via Recall.ai with AI-generated summaries and action items
- Run bulk marketing campaigns with open/click tracking via SendGrid
- Send branded emails using a design template system (Transactional / Campaign / Newsletter)
- Run automated drip sequences for waitlist couples
- Manage client vendor pages, documents, and finance
- Upload documents and receipts to Supabase Storage
- Parse invoices automatically using Claude Vision
- Track recurring payments with due-date alerts
- Track internal company expenses (servers, domains, tools, etc.)
- Interact with Chappie — an AI agent that reads CRM data, sends emails, books meetings, attaches files, and runs on Slack
- Use Team Superbrain — daily AI-generated team insight from anonymous thoughts
- Capture ideas with My Thoughts — a personal whiteboard with Claude brainstorm chat

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
| AI (Thoughts, Superbrain, Invoice) | Anthropic Claude (Haiku / Sonnet) |
| Auth | JWT + bcrypt |
| Storage | Supabase Storage |
| Meeting Recording | Recall.ai |
| Slack | Socket Mode Bot |
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

### Chappie Agent Loop
```
User message
     │
     ▼
aiBrain.js — build prompt + tool list
     │
     ▼
GPT-4o-mini (function calling)
     │
     ├─ Tool call? ──► executeTool() ──► DB / Gmail / Calendar
     │                      │
     │                      └──► Result injected back into loop
     │
     └─ Final response ──► strip markdown ──► return to user
```

### Document Upload Flow
```
User uploads file (UI or Chappie)
        │
        ▼
POST /api/uploads/receipts  (multer → memoryStorage)
        │
        ▼
Supabase Storage (receipts bucket)
        │
        ▼
POST /api/documents/upload  OR  attach_document Chappie tool
        │
        ▼
crm_documents (company_id + client_id both set for converted companies)
        │
        ▼
crm_activity_log — "Document Added"
```

### Invoice Parser Flow
```
File uploaded (PDF or image)
        │
        ▼
POST /api/finance/invoices/parse
        │
        ▼
Claude Vision — extract title/amount/date/vendor/category/recurring
        │
        ├─ Valid invoice? ──► return JSON → pre-fill expense form
        │
        └─ Not invoice? ──► return 422 NOT_AN_INVOICE → skip parse
```

---

## Features

### Pipeline & Contacts
- Company list with stage filters, search, and bulk import (CSV)
- Visual pipeline stepper per company
- People management per company (multiple contacts)
- Next action reminders
- Activity timeline — notes, emails, meetings, stage changes, documents
- Per-person activity filtering and notes
- Documents filter in activity tab
- Assigned-to with team user picker (admin only)
- Convert to Client flow with contract setup + document transfer

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
- Live preview in drip step editor
- Planfor branded templates: dark green header, logo, slogan, Instagram, privacy policy
- Direct emails NEVER use the design template wrapper — only campaigns, drip, and waitlist

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
- Full client profiles with contract details, vendor page, finance tab
- Stage management (Onboarding → Active → Paused → Churned)
- 7-tab client profile: Overview, Activity, Meetings, Documents, Emails, People, Vendor Page, Finance
- Unified emails tab (direct + campaign history)
- Document management — upload via UI or Chappie, supports all file types
- Documents automatically copied from contact to client on conversion
- Vendor marketplace page editor
- Contract tracking (RevShare / Commission / Subscription)
- Finance tab: per-client transactions
- Per-person activity filters and note tagging in activity tab

### Documents
- Unified `crm_documents` table shared between contacts and clients
- Upload via UI (contacts, clients) or via Chappie chat with paperclip button
- `attach_document` Chappie tool — links both `company_id` and `client_id` for converted companies
- Supports PDF, images, Word, Excel, CSV
- View (images/PDF) or Download based on file type
- Activity log entry on every upload
- Documents filter in activity tab

### Finance Module
- Internal expense tracker (admin + finance roles)
- Invoice parser — upload PDF or image, Claude Vision extracts title/amount/date/vendor/category/recurring
- Returns 422 with `NOT_AN_INVOICE` when file is not an invoice
- Recurring payments — `last_paid_date` + `recurring_parent_id` on `crm_expenses`
- Dashboard due-soon widget showing payments due within 7 days
- Mark Paid flow: creates NEW expense row linked to parent via `recurring_parent_id`, updates `last_paid_date` on parent
- Per-client transactions
- Receipt upload to Supabase Storage

### Intelligence
- My Thoughts — private idea capture with Claude brainstorm chat per thought
- Team Superbrain — daily anonymous insight generated from all team thoughts (Claude Haiku), runs every 24h
- RAG memory — Chappie searches past emails, notes, meetings, thoughts via pgvector semantic similarity
- Meeting AI summaries with action items and priority levels

### Dashboard
- Pipeline velocity — avg days per stage, color-coded (green/amber/red)
- Waitlist growth sparkline — last 14 days + 4 stats
- My Thoughts count this week
- Campaign avg open rate
- Recurring payments due-soon widget
- Stale leads, recent activity, upcoming meetings, team stats

### Admin
- DB-driven RBAC — roles: admin, manager, viewer
- Permission keys stored in `crm_permissions` table, editable without code deploy
- Team management — invite users, assign roles
- Admin password reset — generates 8-char hex temp password shown once
- Users can change their own password from Settings
- Timezone support per user

---

## AI Assistant — Chappie

Chappie is a full agentic AI assistant embedded in the CRM. It uses GPT-4o-mini and has access to 25+ tools. Accessible via floating widget (bottom right), conversation log at `/ai/log`, and Slack DMs.

### Architecture
- **Type:** Agentic loop (not RAG)
- **Model:** GPT-4o-mini
- **Max iterations:** 6 per request
- **History:** Persistent per conversation, stored in `crm_ai_conversations`
- **New Conversation:** "+ New Chat" button starts fresh
- **Timestamps:** Each message shows time sent
- **Memory:** RAG search over emails, notes, meetings, thoughts via `search_memory` tool
- **Slack:** Full functionality via Socket Mode DMs with Block Kit confirmation buttons
- **File upload:** Paperclip button — files uploaded to Supabase Storage, attached via `attach_document` tool

### Tools

**Read (instant):**
`search_contacts` · `get_company_people` · `get_company_brief` · `get_client_status` · `get_pipeline_summary` · `get_stale_leads` · `get_my_meetings` · `get_finance_summary` · `get_marketing_history` · `get_campaign_stats` · `get_last_thread` · `get_email_thread` · `get_all_campaigns` · `get_waitlist_stats` · `get_waitlist_list` · `search_conversation_history` · `search_memory` · `check_calendar_conflicts` · `get_pending_proposals`

**Write instant:**
`add_note` · `attach_document` · `update_pipeline_stage` · `update_client_stage` · `update_next_action`

**Write with confirmation:**
`send_email` · `send_bulk_email` · `book_meeting` · `cancel_meeting` · `reschedule_meeting` · `propose_meeting`

### Key Behaviors
- Always calls `search_contacts` before any action involving a name
- Uses `person.company_id` from people array to ensure valid FK
- Validates UUIDs before DB insert
- Thread replies: `get_last_thread` → `send_email` with thread_id
- No markdown in responses (stripped server-side)
- File uploads: extracts URL from message → calls `attach_document` → NEVER uses `add_note` for files
- Notes field in `attach_document`: only uses notes the USER explicitly provides — never Claude's analysis text
- Slack: full Chappie functionality via DM with Block Kit confirmation buttons

### Critical Architecture Notes for Developers
- **Two AI files exist:** `server/services/aiBrain.js` (backend agent) and `client/src/components/AiBrain.js` (frontend widget) — always be explicit which one
- Working history and saved history are kept separate in Chappie's architecture
- Direct emails NEVER use the design template wrapper (`emailWrapper.js` is for campaign/drip/waitlist only)
- `crm_synced_emails` uses `body_html` not `body_text`, and has NO `person_id` column
- `crm_synced_emails` uses `email_date` not `received_at`
- `convertClientTimeToUTC` uses `Intl` shortOffset only
- AirPlay Receiver conflicts with port 5000 on macOS — avoid that port
- Gmail reply threads get a new `thread_id`; `get_email_thread` falls back to `company_id` search when thread lookup yields no results
- `person.company_id` from `crm_people` is the valid FK — NOT from companies array
- Campaign unsubscribes route to `crm_people`; waitlist unsubscribes route to `waitlist_couples` — these are NEVER conflated

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
│   │   ├── finance.js          # Company expenses, invoice parser, recurring payments
│   │   ├── documents.js        # Unified documents CRUD + file upload
│   │   ├── uploads.js          # Supabase Storage upload/delete
│   │   ├── insights.js         # Team Superbrain — generate + fetch insights
│   │   └── users.js            # Team mgmt, profile, signature, timezone, password reset
│   ├── services/
│   │   ├── aiBrain.js          # Chappie agentic loop + confirmation flow
│   │   ├── aiTools.js          # 25+ tool definitions + executors
│   │   ├── aiSummary.js        # GPT meeting summary generator
│   │   ├── teamBrain.js        # Team Superbrain — Claude Haiku insight generator
│   │   ├── invoiceParser.js    # Claude Vision invoice extractor
│   │   ├── ragSearch.js        # pgvector semantic search
│   │   ├── gmailSync.js        # Smart selective sync engine
│   │   ├── dripRunner.js       # Hourly drip sequence processor
│   │   ├── emailWrapper.js     # Wraps email body with design template
│   │   ├── slackBot.js         # Chappie on Slack via Socket Mode
│   │   └── calendlySync.js     # Calendly webhook sync
│   ├── middleware/
│   │   ├── auth.js             # JWT verification
│   │   └── permissions.js      # DB-driven RBAC checkPermission()
│   ├── db.js                   # Supabase client
│   └── index.js                # Express app, route mounting, cron jobs
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
│       │   ├── Finance.js           # Expenses + recurring + invoice parser
│       │   ├── AiLog.js
│       │   ├── Settings.js
│       │   ├── Import.js
│       │   └── Team.js
│       ├── components/
│       │   ├── Sidebar.js
│       │   ├── AiBrain.js           # Chappie floating widget + file upload
│       │   ├── TiptapEditor.js
│       │   ├── HtmlEditor.js        # CodeMirror HTML editor with line wrapping
│       │   ├── ScheduleMeetingModal.js
│       │   └── LocationSelector.js
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
| role | text | admin / manager / viewer |
| timezone | text | IANA (e.g. Asia/Jerusalem) |
| email_signature | text | HTML |
| slack_user_id | text | For Chappie Slack integration |

#### `crm_permissions`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| role | text | admin / manager / viewer |
| permission | text | e.g. company:edit, pipeline:move, finance:general |

#### `crm_companies`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| company_name, website, category | text | |
| stage | text | New / Contacted / No Reply / Follow-up / Meeting Scheduled / Proposal Offered / Agreement Sent / Closed Won / Closed Lost / Not Interested / Converted |
| city, state, country | text | |
| origin | text | Upload / Cold / Hot / Instagram / Google / Referral |
| assigned_to | uuid | FK → crm_users |
| next_action | text | |
| last_activity_at | timestamptz | |

#### `crm_people`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| company_id | uuid | FK → crm_companies — this is the VALID FK to use, not from companies array |
| first_name, last_name, title, email | text | |
| work_phone, mobile_phone | text | |
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
| contact_first_name, contact_last_name | text | |
| stage | text | Onboarding / Active / Paused / Churned |
| contract_type | text | RevShare / Commission / Subscription |
| commission_rate, contract_amount | numeric | |
| contract_signed_date | date | |
| city, state, country | text | |
| category, business_type | text | |

#### `crm_activity_log`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| company_id | uuid | FK → crm_companies (optional) |
| client_id | uuid | FK → crm_clients (optional) |
| person_id | uuid | FK → crm_people (optional) |
| user_id | uuid | FK → crm_users |
| action | text | Note Added / Email Sent / Meeting Completed / Document Added / Converted to Client / etc. |
| details | text | |
| created_at | timestamptz | |

#### `crm_documents`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| title | text | |
| file_url | text | Supabase signed URL |
| type | text | Contract / Invoice / Proposal / NDA / Presentation / Other |
| notes | text | Optional — never populated with Claude's analysis |
| company_id | uuid | FK → crm_companies (optional) |
| client_id | uuid | FK → crm_clients (optional) |
| uploaded_by | uuid | FK → crm_users |
| created_at | timestamptz | |

> Both `company_id` and `client_id` are set when a document belongs to a converted company — ensures it appears on both the contact and client profile. Chappie's `attach_document` tool always resolves and sets both IDs.

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
| user_id, company_id, client_id | uuid | FKs — NO person_id column |
| subject, body_html | text | Uses body_html NOT body_text |
| send_method | text | gmail / sendgrid |
| email_status | text | delivered / opened / clicked / bounced |
| sendgrid_message_id, gmail_thread_id | text | |
| opened_at, clicked_at, bounced_at | timestamptz | |

#### `crm_synced_emails`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| company_id | uuid | FK → crm_companies |
| gmail_message_id, gmail_thread_id | text | Dedup key |
| from_email, from_name | text | |
| subject | text | |
| body_html | text | Uses body_html — NO body_text, NO person_id |
| email_date | timestamptz | Uses email_date NOT received_at |
| direction | text | inbound / outbound |
| has_attachments | boolean | |

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
| recipient_type | text | contact / waitlist — drives unsubscribe routing |
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
| email_status | text | pending / delivered / opened / bounced |
| email_delivered_at, email_opened_at, email_bounced_at | timestamptz | |
| sendgrid_message_id | text | For confirmation email tracking |

> Waitlist couples are entirely separate from vendor CRM data. Campaign unsubscribes → `crm_people`. Waitlist unsubscribes → `waitlist_couples`. These are NEVER conflated.

### AI Tables

#### `crm_ai_conversations`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → crm_users |
| messages | jsonb | Clean text history (no tool messages) |
| last_message | text | |
| actions_taken | jsonb | Array of executed actions with timestamps |
| updated_at | timestamptz | |

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

#### `crm_team_insights`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| insight | text | Claude-generated anonymous team insight |
| thought_count | integer | Number of thoughts used |
| user_count | integer | Number of users who contributed |
| generated_at | timestamptz | |

#### `crm_memory_embeddings`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| source | text | crm_synced_emails / crm_activity / crm_thoughts / crm_emails_sent / crm_meetings |
| source_id | uuid | FK to source record |
| text | text | Plain text content |
| embedding | vector | pgvector embedding |
| metadata | jsonb | company_id, client_id, person_id, date |

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
| notes | text | Manual meeting notes (markdown supported) |
| ai_summary | text | GPT-generated |
| ai_action_items | jsonb | [{task, owner, priority}] |
| transcript | text | Full Recall.ai transcript |
| transcript_segments | jsonb | [{speaker, text, startTime}] |
| recall_bot_id | text | |
| recording_status | text | sending_bot / recording / processing / completed / failed |

#### `crm_google_accounts`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → crm_users |
| email | text | Connected Gmail address |
| account_type | text | personal |
| is_active | boolean | |
| access_token, refresh_token | text | Encrypted |

#### `crm_meeting_proposals`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| company_id, client_id, person_id | uuid | Optional FKs |
| proposed_start, proposed_end | timestamptz | |
| gmail_thread_id | text | For reply tracking |
| status | text | pending / accepted / declined |

### Finance Tables

#### `crm_expenses`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| title, vendor | text | |
| amount | numeric | |
| date | date | |
| category | text | |
| status | text | pending / paid / overdue |
| recurring | boolean | |
| recurring_interval | text | monthly / yearly / weekly / quarterly |
| last_paid_date | date | Last time this recurring expense was paid — drives next_due calculation |
| recurring_parent_id | uuid | FK → crm_expenses — links payment history rows to the recurring template row |
| receipt_url | text | Supabase Storage URL |
| paid_by | uuid | FK → crm_users |
| notes | text | |

#### `crm_client_finance`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| client_id | uuid | FK → crm_clients |
| type | text | Commission / Settlement / Refund / Fee / Other |
| amount | numeric | |
| description | text | |
| status | text | Pending / Completed / Failed |
| date | date | |
| created_by | uuid | FK → crm_users |

#### `crm_client_vendor_page`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| client_id | uuid | FK → crm_clients |
| display_name, tagline, about | text | |
| venue_type | text | |
| guest_capacity, price_tier | text | |
| amenities, services, ceremony_types, diversity_tags | text[] | |
| social_links | jsonb | {instagram, facebook, website, tiktok} |
| published | boolean | |

---

## Roles & Permissions

Permissions are stored in `crm_permissions` table — no code deploy needed to change them.

### Permission Keys
| Permission Key | Description |
|---|---|
| `company:edit` | Edit company fields |
| `company:delete` | Delete companies |
| `company:assign` | Assign companies to team members |
| `pipeline:move` | Move companies between pipeline stages |
| `people:edit` | Edit contact people |
| `people:delete` | Delete people |
| `email:send` | Send emails from CRM |
| `finance:general` | View and manage finance tab |
| `client:edit` | Edit client records |

### Role Matrix
| Action | admin | manager | viewer |
|---|---|---|---|
| View pipeline | ✅ | ✅ | ✅ |
| Edit companies | ✅ | ✅ | — |
| Move pipeline stage | ✅ | ✅ | — |
| Delete companies | ✅ | — | — |
| Send email | ✅ | ✅ | ✅ |
| View clients | ✅ | ✅ | ✅ |
| Edit clients | ✅ | ✅ | — |
| Convert to client | ✅ | ✅ | — |
| View finance | ✅ | — | — |
| Manage campaigns | ✅ | — | — |
| Manage team | ✅ | — | — |
| Reset passwords | ✅ | — | — |
| Use Chappie | ✅ | ✅ | ✅ |
| My Thoughts | ✅ | ✅ | ✅ |
| Team Superbrain generate | ✅ | — | — |

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

# Anthropic (Thoughts, Superbrain, Invoice Parser)
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
- Anthropic API key (for Thoughts, Superbrain, Invoice Parser)

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
| GET | `/api/emails/gmail-status` | Gmail connection status |

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
| POST | `/api/clients/convert/:companyId` | Convert company to client (copies documents) |
| GET | `/api/clients/:id/activity` | Client activity log |
| POST | `/api/clients/:id/note` | Add note (supports person_id) |
| GET/PUT | `/api/clients/:id/vendor-page` | Vendor page |
| GET/POST | `/api/clients/:id/finance` | Finance transactions |

### Documents
| Method | Route | Description |
|---|---|---|
| GET | `/api/documents` | List documents (filter by company_id and/or client_id) |
| POST | `/api/documents/upload` | Upload file to Supabase + create crm_documents record |
| PUT | `/api/documents/:id` | Update document metadata |
| DELETE | `/api/documents/:id` | Delete document |

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
| POST | `/api/calendar/meetings/:id/regenerate-summary` | Regenerate AI summary |

### Gmail & Sync
| Method | Route | Description |
|---|---|---|
| GET | `/api/google/auth-url` | Get OAuth URL |
| GET | `/api/google/callback` | OAuth callback |
| GET | `/api/google/accounts` | List connected accounts |
| DELETE | `/api/google/accounts/:id` | Disconnect account |
| GET | `/api/sync/emails/inbox` | Inbox threads |
| GET | `/api/sync/emails/unread-count` | Unread badge count |
| GET | `/api/sync/emails/client/:id` | Synced emails for client |
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

### Intelligence
| Method | Route | Description |
|---|---|---|
| GET | `/api/insights/latest` | Latest Team Superbrain insight |
| POST | `/api/insights/generate` | Generate new insight (admin only) |
| GET | `/api/thoughts` | Get my thoughts (private per user) |
| POST | `/api/thoughts` | Create thought |
| PUT | `/api/thoughts/:id` | Update thought |
| DELETE | `/api/thoughts/:id` | Delete thought |
| GET | `/api/thoughts/:id/chat` | Get Claude conversation for thought |
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
| GET | `/api/marketing/company/:id` | Campaign history for company |

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
| GET | `/api/waitlist/unsubscribe` | Unsubscribe via token |

### Users
| Method | Route | Description |
|---|---|---|
| GET | `/api/users` | List all users (admin) |
| POST | `/api/users/invite` | Create user (admin) |
| PUT | `/api/users/:id/role` | Change role (admin) |
| PUT | `/api/users/:id/reset-password` | Admin reset password — returns temp password |
| DELETE | `/api/users/:id` | Delete user (admin) |
| GET | `/api/users/me` | Current user profile |
| PUT | `/api/users/me/password` | Change own password (requires current password) |
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
| GET | `/api/finance/expenses/recurring` | Recurring expenses with next_due, days_until, due_soon |
| POST | `/api/finance/invoices/parse` | Parse invoice with Claude Vision (422 if not invoice) |

> All routes require `Authorization: Bearer <token>` header except public webhook and waitlist endpoints.

> ⚠️ **Route order matters:** In `users.js`, `/me` routes must come BEFORE `/:id` routes. Same pattern applies to any route file mixing static and parameterized paths (e.g. `/expenses/recurring` before `/expenses/:id`).

---

## Changelog

### v2.3.0 ✅ — Documents System + Chappie File Upload + Activity Filters
- **`crm_documents` table** — unified documents for both contacts and clients. Both `company_id` and `client_id` set when attaching to converted companies
- **Documents tab on contacts and clients** — upload, view, edit, delete. View/Download based on file type
- **Chappie file upload** — paperclip button in widget, file uploaded to Supabase Storage, `attach_document` tool attaches to CRM record
- **`attach_document` Chappie tool** — in `aiTools.js`. Resolves both `company_id` and `client_id` for converted companies. Never uses `add_note` for files
- **Document notes policy** — Chappie only uses notes the user explicitly provides, never Claude's file analysis text
- **Documents automatically copied** from contact to client on conversion in `clients.js` convert route
- **Activity log** on every document upload (UI route in `documents.js` and Chappie tool in `aiTools.js`)
- **Documents filter** in activity tab on both contacts and clients
- **Per-person activity filters** on both CompanyProfile and ClientProfile activity tabs
- **Add Note with person selector** in ClientProfile activity tab
- **Activity card text truncation** — long text capped at 200 chars with `wordBreak: break-word, overflowWrap: anywhere`
- **Overview layout fixes** — `minWidth: 0`, `overflow: hidden` on grid columns to prevent horizontal scroll

### v2.2.0 ✅ — Team Superbrain + Invoice Parser + Recurring Payments + Password Management
- **Team Superbrain** — `crm_team_insights` table, `server/services/teamBrain.js`, Claude Haiku generates anonymous insight from all team thoughts (last 7 days). Runs 5min after startup then every 24h. Dashboard dark gradient widget with admin-only "✨ Generate Now" button
- **Invoice Parser** — `server/services/invoiceParser.js` uses Claude Vision. `POST /api/finance/invoices/parse` via multer memoryStorage. Returns 422 `NOT_AN_INVOICE` when file isn't an invoice (err.notAnInvoice flag). Finance.js: "📄 Upload Invoice" button pre-fills expense form
- **Recurring Payments** — `last_paid_date` and `recurring_parent_id` columns on `crm_expenses`. `GET /api/finance/expenses/recurring` calculates `next_due` from `last_paid_date`, `days_until`, `due_soon` (≤7 days). Mark Paid creates NEW expense row with `recurring_parent_id` + updates `last_paid_date` on parent. `while (nextDue < todayStart)` not `<=` — payments due today show correctly after being paid
- **Dashboard recurring widget** — only shows when items due within 7 days, Mark Paid button with optional invoice upload + amount confirmation
- **`recurring_interval` selector** — monthly / yearly / weekly / quarterly, shown when recurring=true
- **Password management** — `PUT /api/users/me/password` (change own, requires current password), `PUT /api/users/:id/reset-password` (admin generates 8-char hex temp password, shown once in modal)

### v2.1.0 ✅ — Permissions System (DB-driven RBAC)
- **`crm_permissions` table** — permission keys per role stored in DB, editable without code deploy
- **`checkPermission()` middleware** — `server/middleware/permissions.js` wraps all sensitive routes
- **Admin UI** — Team page lets admin manage roles and view permission matrix
- **Role-aware frontend** — buttons, tabs, actions hidden via `useRole()` hook and `can(permission)` function

### v2.0.0 ✅ — RAG Memory + Chappie Slack Bot + Meeting Recording
- **RAG search** — `crm_memory_embeddings` table (pgvector). `server/services/ragSearch.js`. `search_memory` tool searches emails, notes, meetings, thoughts by semantic similarity
- **Slack bot** — `server/services/slackBot.js` via Socket Mode. Full Chappie in DMs. Block Kit confirmations. `#all-planfor` alerts. `thought:` / `idea:` prefix logs to My Thoughts
- **Recall.ai** — meeting recording for Google Meet + Zoom. Transcript processing. AI summary + action items. `recording_status` polling
- **Calendly sync** — `server/services/calendlySync.js`. Inbound bookings auto-create CRM meetings, link Google Calendar, match invitee to contacts/clients
- **Gmail reply detection** — GPT-4o-mini classifies reply intent, auto-books on confirmed acceptance
- **`get_pending_proposals`** tool, `crm_meeting_proposals` table
- **`check_calendar_conflicts`** tool using Google Calendar API

### v1.9.0 ✅ — Email Design System + Drip Sequences
- **Email Design System** — 3 types: Transactional (600px), Campaign (600px), Newsletter (700px). header/footer/wrapper_html with `{{content}}` placeholder. Editable without code deploy
- **Planfor branded templates** — dark green header (#3E423D), logo, slogan, Instagram, privacy policy footer
- **`{{unsubscribe_url}}` injection** — replaced server-side for campaigns and waitlist emails
- **`server/services/emailWrapper.js`** — `wrapWithDesignTemplate(body, type)` and `wrapWithDesignTemplateById(body, id)`. Direct emails NEVER use this wrapper
- **Drip Sequence builder** — multi-step sequences with delay (days), subject, body, design template, on/off toggle per step
- **Live preview panel** — split-panel drip step editor: HTML editor left, full rendered preview right
- **Hourly drip runner** — `dripRunner.js`, checks enrollments, sends due steps via SendGrid
- **Auto-enroll on signup** — new waitlist signups auto-enrolled in all active sequences
- **Drip tracking** — `sendgrid_message_id` per send, webhook routes to `crm_drip_sends`
- **New tables** — `crm_drip_sequences`, `crm_drip_steps`, `crm_drip_enrollments`, `crm_drip_sends`, `crm_email_design_templates`
- **`recipient_type`** on `crm_campaign_recipients` routes unsubscribes to correct table

### v1.8.0 ✅ — Dashboard Enhancement
- Waitlist growth sparkline (last 14 days) + 4 stats
- Pipeline velocity widget — avg days per stage, color-coded green/amber/red
- My Thoughts weekly count widget
- Campaign avg open rate widget

### v1.7.0 ✅ — My Thoughts + Chappie Conversations
- My Thoughts page `/thoughts` — private per user, Claude brainstorm chat per thought
- Model selector: Haiku / Sonnet 4 / Opus 4
- "+ New Chat" button starts fresh Chappie conversation
- Message timestamps in Chappie
- `crm_thoughts` and `crm_thought_conversations` tables
- `ANTHROPIC_API_KEY` env var

### v1.6.4 ✅ — Email Deliverability + Unsubscribe System
- Token-based unsubscribe per recipient, clean URL, SendGrid click tracking safe
- List-Unsubscribe headers on all marketing emails
- Smart unsubscribe routing via `recipient_type`
- Unsubscribe audit log — IP, user agent, timestamp, campaign ID
- Export CSV with full audit columns

### v1.6.3 ✅ — Campaign Analytics + AI Log + GTM v1.0
- Campaign hot leads: filter tabs, checkboxes, "New Campaign from Selected"
- AI Log redesign: fixed height split panel, daily grouping, independent scroll
- Chappie tools: `get_all_campaigns`, `get_waitlist_stats`, `get_waitlist_list`, `search_conversation_history`
- Waitlist full stack: comingsoon.planfor.io landing page, backend, CRM tab

### v1.6.2 ✅ — Calendly Integration + Calendar UX
- Calendly polling every 5 min, CRM meeting creation, Google Calendar linking
- Auto-record: Recall.ai bot sent 2 min before meeting start
- Calendar color coding by relationship type with hover legend

### v1.6.1 ✅ — Chappie Smart Scheduling + Slack Bot
- Thread replies, email reading, CC support, bulk email
- Conflict detection, proposal tracking, reply intent + auto-book on confirm
- Slack Bot: Socket Mode, Block Kit, `#all-planfor` alerts
- `convertClientTimeToUTC` using `Intl.DateTimeFormat shortOffset`

### v1.6.0 ✅ — AI Brain (Chappie)
- Floating chat widget on all pages
- Function-calling agentic loop, MAX_ITERATIONS=6
- 20+ tools: read, write-instant, write-with-confirmation
- Confirmation card UI with Confirm/Cancel buttons
- Persistent history in `crm_ai_conversations`
- UUID validation before DB insert
- Conversation log at `/ai/log`

### v1.5.x ✅ — Production Stability + Email Inbox + Meetings
- Custom domain `crm-api.planfor.io`
- Email Inbox with Gmail sync, thread grouping, Quick Reply
- Reschedule meeting flow, activity filter buttons
- Inline meeting notes with Markdown rendering
- Google Meet + Zoom bot selector

### v1.4.0 ✅ — Gmail + Calendar + Meetings
- Gmail API OAuth, send, incremental sync
- Google Calendar create/cancel/reschedule
- Recall.ai meeting recording
- AI meeting summaries via GPT-4o-mini
- Timezone detection from US state

### v1.3.0 ✅ — Marketing
- Campaigns with SendGrid bulk send
- Open/click/bounce tracking via webhooks
- Campaign builder with Tiptap visual + HTML editor

### v1.2.0 ✅ — Client Management
- Convert company to client flow
- ClientProfile multi-tab layout
- Client finance module
- Document management with Supabase Storage

### v1.1.0 ✅ — Email & Templates
- Email templates with merge tags
- Direct email via SendGrid
- Open/click tracking + activity timeline

### v1.0.0 ✅ — Foundation
- Pipeline management with stage stepper
- Company + people CRUD
- CSV import from Apollo
- JWT authentication

---

## Roadmap

- **v2.4** — Onboarding wizard (first login: company name, logo, primary color), demo mode with seed data
- **v2.5** — Newsletter builder with AI writing assistant
- **Open Source Release** — remove Planfor branding, seed script with fake data, full setup docs, LinkedIn post
- **Couples data layer** — expand beyond `waitlist_couples` as GTM matures
- **v2.1 Learning Brain** — proactive Chappie insights once sufficient data volume exists