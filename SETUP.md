# Chap CRM — Database Setup Guide

This guide covers everything you need to set up the Supabase database for Chap CRM. Follow the steps in order.

---

## 1. Create a Supabase project

1. Go to [supabase.com](http://supabase.com) and create a new project
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

This creates all tables, indexes, relationships, and the RAG search function. It is safe to run multiple times — all statements use `CREATE TABLE IF NOT EXISTS`.

---

## 4. Run the seed data (optional)

The seed file loads a realistic demo dataset — 9 team members, 15 companies, 2 campaigns with full recipient tracking, drip sequences, a completed meeting with AI summary, and a Team Superbrain insight.

In the Supabase **SQL Editor**:

1. Open `seed.sql` from the repo root
2. Copy the entire contents
3. Paste into the SQL Editor
4. Click **Run**

**Default login after seeding:**


| Email                                           | Password     | Role      |
| ----------------------------------------------- | ------------ | --------- |
| [admin@chapcrm.io](mailto:admin@chapcrm.io)     | ChapCRM2024! | Admin     |
| [sales1@chapcrm.io](mailto:sales1@chapcrm.io)   | ChapCRM2024! | Sales     |
| [mktg1@chapcrm.io](mailto:mktg1@chapcrm.io)     | ChapCRM2024! | Marketing |
| [finance@chapcrm.io](mailto:finance@chapcrm.io) | ChapCRM2024! | Finance   |


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

Generate a bcrypt hash at [bcrypt.online](http://bcrypt.online) or with `bcrypt.hashSync('yourpassword', 10)` in Node.js.

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

## 7. Migration for existing installs

If you already have Chap CRM deployed and are updating to the latest version, run these in your Supabase **SQL Editor**:

```sql
-- Add missing columns
ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS last_login timestamptz;
ALTER TABLE crm_people ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES crm_users(id) ON DELETE SET NULL;
ALTER TABLE crm_companies ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES crm_users(id) ON DELETE SET NULL;

-- Fix embeddings table
ALTER TABLE crm_embeddings ADD COLUMN IF NOT EXISTS chunk_text text;
ALTER TABLE crm_embeddings ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE crm_embeddings ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS idx_embeddings_unique ON crm_embeddings(source_table, source_id);

-- Add RAG search function
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  source_table text,
  source_id uuid,
  chunk_text text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id, source_table, source_id, chunk_text, metadata,
    1 - (embedding <=> query_embedding) AS similarity
  FROM crm_embeddings
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

-- Add roles table and system roles
CREATE TABLE IF NOT EXISTS crm_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text,
  is_system   boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
ALTER TABLE crm_permissions ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES crm_roles(id) ON DELETE CASCADE;
ALTER TABLE crm_permissions ADD COLUMN IF NOT EXISTS module text;
ALTER TABLE crm_permissions ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE crm_permissions ADD COLUMN IF NOT EXISTS enabled boolean DEFAULT false;
ALTER TABLE crm_permissions ALTER COLUMN role DROP NOT NULL;
ALTER TABLE crm_permissions ALTER COLUMN permission DROP NOT NULL;
ALTER TABLE crm_permissions ADD CONSTRAINT crm_permissions_role_id_module_action_key UNIQUE(role_id, module, action);

```

---

## 8. Security note on RLS

All tables ship with Row Level Security (RLS) **disabled**. This is intentional.

Chap CRM uses a backend-only architecture — all database access goes through the Express API using the service role key. No browser client ever connects to Supabase directly. In this setup, RLS is not required because the API layer handles all authorization.

If you build additional integrations that connect to Supabase directly (mobile apps, third-party tools, etc.), enable RLS on the relevant tables and define appropriate policies.

---

## 9. Verify the setup

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

**"Could not find the table in the schema cache"** The vector extension is not enabled. Run `CREATE EXTENSION IF NOT EXISTS vector;` and restart your backend.

**"operator does not exist: uuid ~~ unknown"** You're trying to use LIKE on a UUID column. Cast it: `id::text LIKE 'prefix%'`

**"foreign key constraint violation" when deleting data** Delete in reverse dependency order. Safe order for full wipe:

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

**Password not working after seeding** The seed uses a bcrypt hash. If you changed the hash manually, regenerate it properly. The default password for all seed users is `ChapCRM2024!`