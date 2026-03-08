# Planfor CRM

Internal sales CRM built for the Planfor.io team to manage wedding vendor outreach, track leads through a pipeline, and send templated emails — all in one place.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Email System](#email-system)
- [Roadmap](#roadmap)

---

## Overview

Planfor CRM is a full-stack internal tool that allows the Planfor sales team to:

- Import wedding vendor leads from Apollo CSV exports
- Track companies and contacts through a visual sales pipeline
- Log all activity and notes against each company
- Compose and save email drafts using reusable templates with merge tags
- Monitor pipeline health from a real-time dashboard

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Create React App), React Router, Axios |
| Backend | Node.js, Express |
| Database | Supabase (PostgreSQL) |
| Auth | JWT (stored in localStorage) |
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
- **Overview tab** — inline editable company fields (click any field to edit, blur/Enter to save), all changes logged to activity
- **People tab** — full contact list with add/edit/remove
- **Activity tab** — full audit timeline with notes, field changes, email logs; filterable by person
- Quick Note box with last 3 notes preview

### Email Templates
- Create, edit, delete reusable email templates
- Categories: Outreach, Follow-up, Proposal, Meeting Confirmation, General
- Visual editor (contentEditable with B/I/U/List toolbar) and raw HTML editor
- Merge tags sidebar — click to insert at cursor or drag & drop into subject or body
- Live preview with sample data resolution
- Custom HTML signature editor

### Email Composer (from Company Profile)
- 2-step flow: pick recipient + template → full editor
- Merge tags auto-resolved with real company/person data
- Visual and HTML editing modes
- Saves as draft to database, logs to company activity timeline
- Gmail send integration: **pending (Task 4)**

---

## Project Structure

```
venueflow-crm/
├── server/
│   ├── routes/
│   │   ├── auth.js          # Login, JWT generation
│   │   ├── contacts.js      # Companies, people, activity, notes
│   │   └── emails.js        # Templates, sent emails, drafts
│   ├── middleware/
│   │   └── auth.js          # JWT verification middleware
│   ├── db.js                # Supabase client
│   └── index.js             # Express app entry point
├── client/
│   └── src/
│       ├── pages/
│       │   ├── Login.js
│       │   ├── Dashboard.js
│       │   ├── Contacts.js
│       │   ├── CompanyProfile.js
│       │   ├── Import.js
│       │   └── Emails.js
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
| password_hash | text | bcrypt |
| full_name | text | |
| created_at | timestamp | |

### `crm_companies`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | FK → crm_users |
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
| action | text | e.g. Note Added, Stage Changed, Email Draft Saved |
| details | text | Full log message |
| created_at | timestamp | |

### `crm_email_templates`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | FK → crm_users |
| name | text | Template display name |
| category | text | Outreach / Follow-up / Proposal etc. |
| subject | text | Supports merge tags |
| body_html | text | HTML body, supports merge tags |
| signature_html | text | HTML signature |
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

---

## Environment Variables

Create a `.env` file in the root of the project:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
JWT_SECRET=your_jwt_secret_string
PORT=5000
```

> ⚠️ Never commit `.env` to GitHub. It is listed in `.gitignore`.

---

## Getting Started

### Prerequisites
- Node.js v18+
- A Supabase project with the schema above applied

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
| POST | `/api/emails/send` | Save draft / send email |
| DELETE | `/api/emails/sent/:id` | Delete email record |

All routes require `Authorization: Bearer <token>` header.

---

## Email System

### Merge Tags
The following tags are supported in both subject and body:

| Tag | Resolves To |
|---|---|
| `{{first_name}}` | Recipient first name |
| `{{last_name}}` | Recipient last name |
| `{{company_name}}` | Company name |
| `{{sender_name}}` | Logged-in user full name |
| `{{sender_email}}` | Logged-in user email |
| `{{city}}` | Company city |
| `{{stage}}` | Current pipeline stage |

Tags are resolved at send/save time using real data from the company and selected person.

### Flow
1. Sales rep clicks **📧 Send Email** on a company profile
2. Selects recipient (person) and template (or blank)
3. Edits in Visual or HTML mode, inserts merge tags via click or drag & drop
4. Saves as draft → stored in `crm_emails_sent`, logged in activity timeline
5. **Gmail send**: pending Task 4 (Gmail OAuth integration)

---

## Roadmap

| Task | Status |
|---|---|
| Database schema | ✅ In Production |
| Contacts list with filters | ✅ In Production |
| Company Profile page | ✅ In Production |
| CSV import (Apollo) | ✅ In Production |
| Activity timeline & audit log | ✅ In Production |
| Dashboard | ✅ In Production |
| Email Templates Manager | ✅ In Production |
| Email Composer (Company Profile) | ✅ In Production |
| Email Database & Backend | ✅ In Production |
| Gmail OAuth Integration | 🔵 Pending |

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

Built by the Planfor.io team.
