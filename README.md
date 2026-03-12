# Planfor CRM

Internal sales CRM built for the Planfor.io team to manage wedding vendor outreach, track leads through a pipeline, send emails via SendGrid, run marketing campaigns, and track internal company finances — all in one place.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Roles & Permissions](#roles--permissions)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Email System](#email-system)
- [Marketing & Campaigns](#marketing--campaigns)
- [Finance Module](#finance-module)
- [Design System](#design-system)
- [Roadmap](#roadmap)

---

## Overview

Planfor CRM is a full-stack internal tool that allows the Planfor sales team to:

- Import wedding vendor leads from Apollo CSV exports
- Track companies and contacts through a visual sales pipeline
- Log all activity and notes against each company
- Compose and send emails via SendGrid using reusable templates with merge tags
- Run bulk marketing campaigns with open/click tracking
- View per-contact campaign history on each company profile
- Track internal company expenses (servers, domains, tools, etc.)
- Monitor pipeline health from a real-time dashboard

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Create React App), React Router, Axios |
| Backend | Node.js, Express |
| Database | Supabase (PostgreSQL) |
| Auth | JWT (stored in localStorage) |
| Email Delivery | SendGrid (@sendgrid/mail) |
| Styling | Inline styles with custom design system |
| Fonts | Playfair Display (serif), Inter (sans-serif) |
| Deployment | Local / to be configured |

---

## Features

### Dashboard
- Total companies, total people, added this week, active pipeline stats
- Pipeline breakdown by stage with color-coded progress bars
- Companies by origin (Upload, Cold, Hot, Instagram, Google, Referral)
- Outcome tracking (Closed Won / Closed Lost / Not Interested)
- Recent activity feed across all companies

### Contacts (Company-First Architecture)
- Company list with search, stage filter, and origin filter
- Inline stage editing from the list view
- Duplicate detection on company name — prompts to add person to existing company
- CSV import from Apollo with 4-step flow: Upload → Select Rows → Review Groups → Done
- Auto-groups contacts by company name during import

### Company Profile
- Pipeline stepper — click any stage to update instantly
- Status bar: Last Activity, Next Action (inline editable), Origin + Location
- **Overview tab** — inline editable company fields, all changes logged to activity
- **People tab** — full contact list with add/edit/remove
- **Activity tab** — paginated audit timeline (5/10/25/50 per page), filterable by person, expandable email view inline
- **Marketing tab** — per-contact campaign history (campaign name, sent date, status, opens, clicks), unsubscribe banner if applicable
- Quick Note box with last 3 notes preview

### Email Templates
- Create, edit, delete reusable email templates
- Team or private visibility per template
- Categories: Outreach, Follow-up, Proposal, Meeting Confirmation, General
- Visual editor (contentEditable with B/I/U/List toolbar) and raw HTML editor
- Merge tags sidebar — click to insert at cursor or drag & drop into subject or body
- Live preview with sample data resolution
- Custom HTML signature editor

### Email Composer (from Company Profile)
- 2-step flow: pick recipient + template → full editor
- Merge tags auto-resolved with real company/person data
- Visual and HTML editing modes
- Sends live via SendGrid if recipient has an email address
- Falls back to draft if no email address available
- Logs `Email Sent` or `Email Draft Saved` to activity timeline
- Expandable email view in activity — click ▼ to read the full email inline

### Marketing Campaigns
- Campaign builder with subject, body, from name/email
- Recipient selection — filter by stage, origin, category; excludes unsubscribed contacts
- SendGrid bulk send with custom args per recipient for webhook tracking
- Real-time campaign analytics: delivered, opened, clicked, bounced, unsubscribed
- SendGrid event webhook handler (`/api/marketing/webhook`) — processes open, click, bounce, unsubscribe events
- Per-contact marketing history visible on Company Profile → Marketing tab
- Unsubscribe handling — sets `marketing_unsubscribed` flag on company record

### Finance Module *(in development)*
- Internal company expense tracker (servers, domains, software, legal, etc.)
- Add/edit/delete expenses — admin only
- Summary cards: total this month, total this year, pending, overdue
- Filter by category, status, date range
- Stripe foundation — *(pending API key)*

### Team Management
- View and manage CRM users
- Assign roles: admin, sales, marketing, csm, support, finance
- Admin-only access

---

## Project Structure

```
venueflow-crm/
├── server/
│   ├── routes/
│   │   ├── auth.js          # Login, JWT generation
│   │   ├── contacts.js      # Companies, people, activity, notes
│   │   ├── emails.js        # Templates, sent emails, SendGrid direct send
│   │   ├── marketing.js     # Campaigns, SendGrid bulk send, webhook, stats
│   │   ├── finance.js       # Company expenses (in development)
│   │   └── users.js         # Team management
│   ├── middleware/
│   │   ├── auth.js          # JWT verification middleware
│   │   └── rbac.js          # Role-based access control
│   ├── db.js                # Supabase client
│   └── index.js             # Express app entry point
├── client/
│   └── src/
│       ├── hooks/
│       │   └── useRole.js   # Frontend permission hook
│       ├── pages/
│       │   ├── Login.js
│       │   ├── Dashboard.js
│       │   ├── Contacts.js
│       │   ├── CompanyProfile.js
│       │   ├── Import.js
│       │   ├── Emails.js
│       │   ├── Marketing.js
│       │   ├── Finance.js
│       │   └── Team.js
│       ├── components/
│       │   └── Sidebar.js
│       └── App.js
├── .env                     # Never commit this
├── .gitignore
└── README.md
```

---

## Database Schema

### `crm_users`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| email | text | Unique |
| password | text | bcrypt |
| name | text | Full name |
| role | text | admin / sales / marketing / csm / support / finance |
| last_login | timestamp | |
| created_at | timestamp | |

### `crm_companies`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | FK → crm_users |
| assigned_to | uuid | FK → crm_users (optional) |
| company_name | text | |
| website | text | |
| category | text | e.g. Venue & Spaces |
| business_type | text | e.g. Barn, Rooftop |
| industry | text | |
| employees | text | |
| annual_revenue | text | |
| stage | text | Pipeline stage |
| origin | text | Upload / Cold / Hot etc. |
| city | text | |
| state | text | |
| country | text | |
| company_address | text | |
| company_linkedin | text | |
| facebook_url | text | |
| twitter_url | text | |
| keywords | text | |
| apollo_account_id | text | |
| next_action | text | Inline editable next step |
| marketing_unsubscribed | boolean | Default false |
| marketing_unsubscribed_at | timestamp | |
| created_at | timestamp | |
| updated_at | timestamp | Auto-updated via trigger |

### `crm_people`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| company_id | uuid | FK → crm_companies |
| user_id | uuid | FK → crm_users |
| first_name | text | |
| last_name | text | |
| title | text | |
| email | text | |
| work_phone | text | |
| mobile_phone | text | |
| created_at | timestamp | |

### `crm_activity_log`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| company_id | uuid | FK → crm_companies |
| user_id | uuid | FK → crm_users |
| person_id | uuid | FK → crm_people (optional) |
| action | text | e.g. Note Added, Stage Changed, Email Sent |
| details | text | Full log message |
| created_at | timestamp | |

### `crm_email_templates`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | FK → crm_users (created_by) |
| name | text | Template display name |
| category | text | Outreach / Follow-up / Proposal etc. |
| subject | text | Supports merge tags |
| body_html | text | HTML body, supports merge tags |
| signature_html | text | HTML signature |
| visibility | text | team / private |
| created_at | timestamp | |
| updated_at | timestamp | |

### `crm_emails_sent`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | FK → crm_users |
| company_id | uuid | FK → crm_companies |
| person_id | uuid | FK → crm_people (optional) |
| template_id | uuid | FK → crm_email_templates (optional) |
| subject | text | Resolved subject (tags replaced) |
| body_html | text | Resolved body (tags replaced) |
| status | text | draft / sent |
| sent_at | timestamp | |
| created_at | timestamp | |

### `crm_campaigns`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| name | text | Campaign display name |
| subject | text | Email subject |
| body_html | text | Email body HTML |
| template_id | uuid | FK → crm_email_templates (optional) |
| from_name | text | Sender display name |
| from_email | text | Sender email address |
| status | text | draft / sending / sent |
| recipients_count | integer | Total recipients |
| created_by | uuid | FK → crm_users |
| sent_at | timestamp | |
| created_at | timestamp | |

### `crm_campaign_recipients`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| campaign_id | uuid | FK → crm_campaigns |
| company_id | uuid | FK → crm_companies |
| person_id | uuid | FK → crm_people (optional) |
| email | text | Recipient email address |
| status | text | pending / delivered / opened / clicked / bounced / unsubscribed |
| opened_at | timestamp | |
| clicked_at | timestamp | |
| bounced_at | timestamp | |
| unsubscribed_at | timestamp | |
| sendgrid_message_id | text | |
| created_at | timestamp | |

### `crm_expenses` *(in development)*
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| title | text | Expense name |
| amount | numeric | Amount in USD |
| date | date | Expense date |
| category | text | Server / Domain / Software / Marketing / Legal / Office / Salaries / Other |
| vendor | text | Supplier name (optional) |
| paid_by | uuid | FK → crm_users (admin only) |
| status | text | pending / paid / overdue |
| recurring | boolean | Default false |
| notes | text | Optional notes |
| receipt_url | text | Link to receipt (optional) |
| created_at | timestamp | |
| updated_at | timestamp | |

---

## Roles & Permissions

| Permission | admin | sales | marketing | csm | support | finance |
|---|---|---|---|---|---|---|
| company:edit | ✅ | | | | | |
| company:delete | ✅ | | | | | |
| company:assign | ✅ | | | | | |
| company:export | ✅ | | ✅ | | | ✅ |
| people:edit | ✅ | ✅ | | | | |
| people:delete | ✅ | | | | | |
| pipeline:move | ✅ | ✅ | | | | |
| activity:write | ✅ | ✅ | | ✅ | ✅ | |
| activity:delete | ✅ | | | | | |
| email:send | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| email:templates | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| import:run | ✅ | ✅ | ✅ | | | |
| marketing:send | ✅ | | ✅ | | | |
| marketing:view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| finance:general | ✅ | | | | | ✅ |
| finance:company | ✅ | | | ✅ | ✅ | ✅ |
| users:manage | ✅ | | | | | |

---

## Environment Variables

Create a `.env` file in the root of the project:

```env
PORT=5000
JWT_SECRET=your_jwt_secret_string
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=marketing@yourdomain.com
SENDGRID_FROM_NAME=Your Company Name
```

> ⚠️ Never commit `.env` to GitHub. It is listed in `.gitignore`.

---

## Getting Started

### Prerequisites
- Node.js v18+
- A Supabase project with the schema above applied
- A SendGrid account with a verified sender domain

### Installation

```bash
# Clone the repo
git clone https://github.com/4st3r1x/venueflow-crm.git
cd venueflow-crm

# Install server dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..
```

### Running locally

```bash
# Terminal 1 — Start the backend
node server/index.js

# Terminal 2 — Start the frontend
cd client && npm start
```

Frontend runs on `http://localhost:3000`
Backend runs on `http://localhost:5000`

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
| GET | `/api/contacts/activity/recent` | Last 15 actions (dashboard) |
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
| POST | `/api/emails/send` | Send via SendGrid or save draft |
| DELETE | `/api/emails/sent/:id` | Delete email record |

### Marketing
| Method | Route | Description |
|---|---|---|
| GET | `/api/marketing/campaigns` | List all campaigns |
| POST | `/api/marketing/campaigns` | Create campaign |
| GET | `/api/marketing/campaigns/:id` | Get campaign + stats |
| POST | `/api/marketing/campaigns/:id/send` | Send campaign via SendGrid |
| GET | `/api/marketing/recipients` | List recipients with filters |
| POST | `/api/marketing/webhook` | SendGrid event webhook (opens, clicks, bounces) |
| GET | `/api/marketing/company/:companyId` | Campaign history for a company |

### Finance *(in development)*
| Method | Route | Description |
|---|---|---|
| GET | `/api/finance/expenses` | List all expenses (admin + finance) |
| POST | `/api/finance/expenses` | Create expense (admin only) |
| PUT | `/api/finance/expenses/:id` | Update expense (admin only) |
| DELETE | `/api/finance/expenses/:id` | Delete expense (admin only) |

### Users
| Method | Route | Description |
|---|---|---|
| GET | `/api/users` | List all users (admin only) |
| POST | `/api/users` | Create user (admin only) |
| PUT | `/api/users/:id` | Update user (admin only) |
| DELETE | `/api/users/:id` | Delete user (admin only) |

All routes require `Authorization: Bearer <token>` header.

---

## Email System

### Merge Tags
| Tag | Resolves To |
|---|---|
| `{{first_name}}` | Recipient first name |
| `{{last_name}}` | Recipient last name |
| `{{company_name}}` | Company name |
| `{{sender_name}}` | Logged-in user full name |
| `{{sender_email}}` | Logged-in user email |
| `{{city}}` | Company city |
| `{{stage}}` | Current pipeline stage |

### Direct Email Flow
1. Sales rep clicks **📧 Send Email** on a company profile
2. Selects recipient (person) and template (or blank)
3. Edits in Visual or HTML mode, inserts merge tags
4. Clicks Send — email delivered via SendGrid from the rep's own @planfor.io address
5. Activity log shows `Email Sent` — expandable inline to read full email
6. Falls back to `Email Draft Saved` if recipient has no email address

---

## Marketing & Campaigns

### Campaign Flow
1. Marketing user creates a campaign (name, subject, body, from details)
2. Selects recipients — filtered by stage, origin, category; unsubscribed contacts excluded automatically
3. Sends via SendGrid bulk API — each recipient gets a unique message with custom args for tracking
4. SendGrid webhook posts events (open, click, bounce, unsubscribe) back to `/api/marketing/webhook`
5. Events update `crm_campaign_recipients` status and timestamps in real time
6. Campaign analytics page shows delivered / opened / clicked / bounced / unsubscribed counts
7. Per-contact history visible on Company Profile → Marketing tab

> ⚠️ Webhook requires a public URL. Use ngrok for local development or deploy to production.

---

## Finance Module

Internal expense tracker for Planfor founders (admin role only for write access).

### Expense Categories
Server, Domain, Software, Marketing, Legal, Office, Salaries, Other

### Status Types
- **Pending** — expense logged, not yet paid
- **Paid** — payment confirmed
- **Overdue** — past due date, unpaid

### Stripe Integration
Stripe foundation is planned for future PlanMe marketplace payment flows. Pending API key setup.

---

## Design System

| Token | Hex | Usage |
|---|---|---|
| Sand Background | `#E5E1D8` | Page background |
| Sand Light | `#F5F3EF` | Cards, nav |
| Sand Medium | `#D5CEC0` | Borders, hover |
| Sage | `#8E9B8B` | Primary buttons, active states |
| Sage Dark | `#7A8677` | Button hover |
| Charcoal | `#3E423D` | Primary text |
| Charcoal Light | `#5A6059` | Secondary text |
| Steel Blue | `#94B0BC` | Links, actions |
| Muted | `#717182` | Labels, placeholders |
| Lavender | `#B4A5D6` | Meeting Scheduled stage |
| Gold | `#D4A574` | Follow-up stage |
| Red | `#D4183D` | Destructive actions, Closed Lost |

---

## Roadmap

| Feature | Status |
|---|---|
| Database schema | ✅ Done |
| Contacts list with filters | ✅ Done |
| Company Profile page | ✅ Done |
| CSV import (Apollo) | ✅ Done |
| Activity timeline & audit log | ✅ Done |
| Activity tab pagination | ✅ Done |
| Activity tab inline email expand | ✅ Done |
| Dashboard | ✅ Done |
| Email Templates Manager | ✅ Done |
| Email Composer with SendGrid send | ✅ Done |
| Roles & Permissions (RBAC) | ✅ Done |
| Team Management page | ✅ Done |
| Marketing Campaigns module | ✅ Done |
| SendGrid campaign webhook | ✅ Done |
| Company Profile — Marketing tab | ✅ Done |
| Finance Module — Expenses tracker | 🔧 In Development |
| SendGrid webhook for direct emails | 🔵 Pending (needs public URL) |
| Gmail OAuth + inbox sync | 🔵 Pending |
| Two-way conversation view | 🔵 Pending |
| Google Calendar + Meeting Scheduler | 🔵 Pending |
| Stripe integration | 🔵 Pending (waiting for API key) |
| Production deployment | 🔵 Pending |
| Open source public version | 🔵 Pending |

---

Built by the Planfor.io team.