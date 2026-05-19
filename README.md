# Chap CRM

**Open-source CRM with a built-in AI assistant. Self-hosted, fully yours.**

Most CRMs charge you per seat, lock features behind paywalls, and give you zero control over your data. Chap CRM gives small businesses and startups the power of an enterprise CRM — pipeline, email, calendar, marketing automation, finance tracking, and an AI assistant that can actually take actions — without the price tag or the lock-in.

Fork it. Deploy it in an afternoon. Own it forever.

---

## Why Chap CRM

**You own the data.** Everything lives in your own database. No vendor has access to your contacts, deals, or conversations.

**The AI actually does things.** Chappie — the built-in assistant — doesn't just answer questions. Ask it to send an email, book a meeting, update a pipeline stage, or pull a deal summary. It confirms before acting, then executes.

**Meetings become intelligence.** With one click, a Recall.ai bot joins your Google Meet or Zoom, records and transcribes the conversation, and the AI automatically generates a structured summary, KPIs, and action items — all saved directly to the contact profile. Chappie reads those summaries, so every future interaction is informed by what was actually said.

**It's a complete operating system for your team.** Pipeline, email inbox, calendar, drip sequences with per-email stats, finance tracking, and role-based team management — all in one place, all in your stack.

**It grows with you.** Clean, modular codebase. Swap the AI provider, add pipeline stages, build new automations. You're not waiting on anyone's roadmap.

---

## What's inside

### Pipeline & Contacts
Full company and contact management with customizable pipeline stages. People profiles linked to companies. Notes, activity timeline, next actions. Bulk import from Apollo.io CSV exports. Duplicate detection on company creation.

### AI Assistant — Chappie
Ask Chappie anything about your pipeline in plain English. It reads your data and can take real actions:
- Send emails to contacts
- Book and reschedule meetings
- Update pipeline stages
- Add notes to profiles
- Pull deal summaries and stale lead reports

Every action goes through a confirmation step — Chappie shows you exactly what it's about to do before doing it. Powered by Anthropic Claude. The AI layer is isolated in a single service file so you can swap to any LLM.

### Meeting Intelligence (Recall.ai)
One of the most powerful features in the system:

1. Schedule a meeting from any contact profile
2. One click sends a Recall.ai bot to join the Google Meet or Zoom
3. The bot records and transcribes the full conversation
4. The AI processes the transcript and generates:
   - **AI Summary** — plain language overview of what was discussed
   - **Action Items** — structured list with owner and priority (high / medium / low)
5. Everything is saved to the contact profile automatically
6. Chappie has access to all of this — ask "what did we discuss with [company]?" and it knows

This replaces a stack of separate tools (Otter.ai, manual note-taking, task creation) with one integrated flow.

*Requires a Recall.ai API key. Optional — the rest of the CRM works without it.*

### Email
- Send directly from your real Gmail address — no "sent via" footers
- Smart inbox sync: replies from contacts appear on their company profile
- Rich text campaign builder with Tiptap editor
- Drip sequence automation: multi-step sequences with configurable delays
- Per-email tracking: sent, opened, clicked, bounced, unsubscribed
- Unsubscribe handling that routes correctly to contacts vs waitlist

### Calendar
- Two-way Google Calendar sync
- Automatic timezone detection by US state — enter times in the client's timezone, the system converts to yours
- Meeting completion flow with notes saved to the contact profile
- Meeting recording via Recall.ai (above)

### Marketing
- Campaign manager with full delivery stats (sent / opened / clicked / bounced / unsubscribed)
- Drip sequence builder with per-step stats
- CSV export

### Finance
- Invoice and expense tracking
- Revenue vs expense dashboard
- Commission tracking for client accounts

### Team
- Role-based permissions: admin, sales, marketing, CSM, support, finance
- Granular permission matrix — control exactly what each role can see and do
- Custom role creation
- Team invite flow with temporary passwords


### Team Superbrain
Every team member has a private **Thoughts** page — a personal whiteboard for capturing ideas, observations, and hunches about deals, clients, or the market. Each thought has its own Claude-powered brainstorm chat.

Once a day, the system anonymizes all team thoughts from the last 7 days and synthesizes them into a single **Team Superbrain insight** — a structured analysis of what the team is collectively thinking, what patterns are emerging, and what opportunities or risks are surfacing.

The insight appears on the Dashboard in a dark gradient card, visible to the whole team. Admins can trigger a fresh generation at any time with one click.

Chappie has access to the Superbrain — ask "what is the team focused on this week?" and it draws from the collective intelligence of everyone's thoughts, without attribution.

This turns individual observations into shared organizational knowledge without the overhead of weekly standups or status reports.
### Customization
- 4 built-in color palettes: Sage, Ocean, Midnight, Rose
- Company branding: logo and name
- B2B or B2C mode with category sets
- Timezone-aware throughout

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, Cloudflare Pages |
| Backend | Express (Node.js), Render |
| Database | Supabase (PostgreSQL) |
| Email | SendGrid, Gmail API |
| AI | Anthropic Claude API |
| Meeting Recording | Recall.ai (optional) |
| Calendar | Google Calendar API |
| Rich Text | Tiptap |
| Auth | JWT |

---

## Deploy your own

Chap CRM runs on any stack that supports Node.js and PostgreSQL. The reference setup is **Supabase + Render + Cloudflare Pages**. Alternatives are listed below each step.

### 1. Database

**Supabase (recommended)**
1. Create a project at [supabase.com](https://supabase.com)
2. Open **SQL Editor**, paste `schema.sql` from the repo root, and run it
3. Optionally run `seed.sql` to load sample data — 9 team members, 15 companies, campaigns, drip sequences, and a completed meeting with full AI summary and action items
4. Copy your connection string: **Settings → Database → Connection string (URI)**

**Other PostgreSQL options:** Railway, Neon, DigitalOcean Managed Databases, or any self-hosted Postgres instance. Run `schema.sql` to initialize.

---

### 2. Backend

**Render**
1. Fork this repo
2. New Web Service → connect your fork
3. Root directory: `server/` · Build: `npm install` · Start: `node index.js`

**Other options:** Railway, Fly.io, DigitalOcean App Platform, or any VPS with `pm2 start server/index.js`

**Environment variables:**

```env
DATABASE_URL=postgresql://...
JWT_SECRET=any_strong_random_string
SENDGRID_API_KEY=SG.xxx
ANTHROPIC_API_KEY=sk-ant-xxx
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=https://your-api-domain/api/google/callback
FRONTEND_URL=https://your-frontend-domain
RECALL_API_KEY=xxx                   # Optional — for meeting recording
```

---

### 3. Frontend

**Cloudflare Pages**
1. New Pages project → connect your fork
2. Root directory: `client/` · Build: `npm run build` · Output: `build`

**Other options:** Vercel, Netlify, or self-hosted Nginx serving the `build/` folder.

**Environment variable:**

```env
REACT_APP_API=https://your-api-domain/api
```

---

### 4. Google OAuth (Gmail + Calendar)

1. [Google Cloud Console](https://console.cloud.google.com) → new project
2. Enable **Gmail API** and **Google Calendar API**
3. Create OAuth 2.0 credentials → Web application
4. Add authorized redirect URI: `https://your-api-domain/api/google/callback`
5. Add Client ID and Secret to your backend env vars

---

### 5. AI Setup (Chappie)

1. Get an API key at [console.anthropic.com](https://console.anthropic.com)
2. Add as `ANTHROPIC_API_KEY` in backend env vars
3. Default model: `claude-sonnet-4` — change in `server/services/aiBrain.js`

**Bring your own LLM:** The AI layer lives entirely in `server/services/aiBrain.js`. Replace the Anthropic client with OpenAI, Gemini, Mistral, or a local Ollama instance. The tool-calling interface is the only thing that needs updating — everything else works with any provider.

---

### 6. Meeting Recording Setup (Optional)

1. Get a Recall.ai API key at [recall.ai](https://recall.ai)
2. Add as `RECALL_API_KEY` in backend env vars
3. The recording button will appear automatically on any scheduled Google Meet or Zoom meeting

---

## First login

After running `seed.sql`:

| Email | Password | Role |
|---|---|---|
| admin@chapcrm.io | ChapCRM2024! | Admin |
| sales1@chapcrm.io | ChapCRM2024! | Sales |
| mktg1@chapcrm.io | ChapCRM2024! | Marketing |
| finance@chapcrm.io | ChapCRM2024! | Finance |

**Change all passwords after first login.**

To see the Recall AI meeting feature in action: go to **Contacts → Sunbelt REI Holdings → Meetings tab**. You'll see a completed meeting with a full AI summary and action items already populated from the seed data.

Starting fresh without seed data: insert the first admin directly into `crm_users` with a bcrypt-hashed password, then invite the rest of the team through the UI.

---

## Project structure

```
chap-crm/
├── client/src/
│   ├── pages/          # Page components
│   ├── components/     # Shared components (LocationSelector, TiptapEditor, etc.)
│   ├── context/        # AppContext — palette system and global settings
│   └── hooks/          # useRole, useApp
├── server/
│   ├── routes/         # API route files (one per domain)
│   ├── services/       # aiBrain.js, emailWrapper.js, dripRunner.js
│   └── index.js        # Entry point
├── schema.sql          # Full database schema — all tables, indexes, RLS
├── seed.sql            # Sample data for real estate wholesaling use case
└── README.md
```

---

## License

MIT — use it, fork it, build on it.

---

*Built with the belief that powerful software should be accessible to everyone, not just companies with six-figure SaaS budgets.*

---

## Security note

All Supabase tables ship with Row Level Security (RLS) **disabled** by default. This is intentional — Chap CRM is designed as a backend-only architecture where all database access goes through the Express API using the Supabase service role key. No client ever touches the database directly.

If you expose your Supabase project publicly or build additional integrations that bypass the API, you should enable RLS on all tables and define appropriate policies. For standard self-hosted deployments following this guide, the default setup is safe.

See `SETUP.md` for the full database setup checklist.