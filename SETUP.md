# Chap CRM — Database Setup Guide

This guide covers everything you need to set up the Supabase database for Chap CRM. Follow the steps in order.

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Choose a region close to your users
3. Save your database password — you'll need it for the connection string

---

## 2. Enable the vector extension

Chap CRM uses pgvector for RAG memory (semantic search across your CRM history). Enable it before running the schema.

In the Supabase **SQL Editor**, run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

If you skip this step, the schema will fail when it tries to create the embeddings table.

---

## 3. Run the schema

In the Supabase **SQL Editor**:

1. Open `schema.sql` from the repo root
2. Copy the entire contents
3. Paste into the SQL Editor
4. Click **Run**

This creates all tables, indexes, and relationships. It is safe to run multiple times — all statements use `CREATE TABLE IF NOT EXISTS`.

---

## 4. Run the seed data (optional)

The seed file loads a realistic demo dataset — 9 team members, 15 companies, 2 campaigns with full recipient tracking, drip sequences, a completed meeting with AI summary, and a Team Superbrain insight.

In the Supabase **SQL Editor**:

1. Open `seed.sql` from the repo root
2. Copy the entire contents
3. Paste into the SQL Editor
4. Click **Run**

**Default login after seeding:**

| Email | Password | Role |
|---|---|---|
| admin@chapcrm.io | ChapCRM2024! | Admin |
| sales1@chapcrm.io | ChapCRM2024! | Sales |
| mktg1@chapcrm.io | ChapCRM2024! | Marketing |
| finance@chapcrm.io | ChapCRM2024! | Finance |

**Change all passwords after first login.**

To skip the seed and start fresh, insert your first admin user directly:

```sql
INSERT INTO crm_users (email, name, role, password)
VALUES (
  'you@yourcompany.com',
  'Your Name',
  'admin',
  '$2b$10$...'  -- bcrypt hash of your password
);
```

Generate a bcrypt hash at [bcrypt.online](https://bcrypt.online) or with `bcrypt.hashSync('yourpassword', 10)` in Node.js.

---

## 5. Get your connection string

In Supabase: **Settings → Database → Connection string → URI**

It looks like:
```
postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

Add this as `DATABASE_URL` in your `.env` file.

---

## 6. Get your API keys

In Supabase: **Settings → API**

You need:
- **URL** → `SUPABASE_URL`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — it bypasses RLS)

---

## 7. Security note on RLS

All tables ship with Row Level Security (RLS) **disabled**. This is intentional.

Chap CRM uses a backend-only architecture — all database access goes through the Express API using the service role key. No browser client ever connects to Supabase directly. In this setup, RLS is not required because the API layer handles all authorization.

If you build additional integrations that connect to Supabase directly (mobile apps, third-party tools, etc.), enable RLS on the relevant tables and define appropriate policies.

---

## 8. Verify the setup

After running the schema, confirm the tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see around 25-30 tables all prefixed with `crm_`.

---

## Troubleshooting

**"Could not find the table in the schema cache"**
The vector extension is not enabled. Run `CREATE EXTENSION IF NOT EXISTS vector;` and restart your backend.

**"operator does not exist: uuid ~~ unknown"**
You're trying to use `LIKE` on a UUID column. Cast it: `id::text LIKE 'prefix%'`

**"foreign key constraint violation" when deleting data**
Delete in reverse dependency order. Safe order for full wipe:
```sql
DELETE FROM crm_drip_sends;
DELETE FROM crm_drip_enrollments;
DELETE FROM crm_drip_steps;
DELETE FROM crm_drip_sequences;
DELETE FROM crm_campaign_recipients;
DELETE FROM crm_campaigns;
DELETE FROM crm_meetings;
DELETE FROM crm_activity_log;
DELETE FROM crm_team_insights;
DELETE FROM crm_clients;
DELETE FROM crm_people;
DELETE FROM crm_companies;
DELETE FROM crm_users;
```

**Password not working after seeding**
The seed uses a bcrypt hash. If you changed the hash manually, regenerate it properly. The default password for all seed users is `ChapCRM2024!`.