-- ============================================================
-- Chap CRM — Database Schema
-- Run this in your Supabase SQL Editor after enabling pgvector
-- All statements use CREATE TABLE IF NOT EXISTS — safe to re-run
-- ============================================================

-- Required extension for RAG memory (semantic search)
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── USERS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL UNIQUE,
  name              text,
  password          text,
  role              text DEFAULT 'viewer',
  timezone          text DEFAULT 'America/New_York',
  email_signature   text,
  slack_user_id     text,
  last_login        timestamptz,
  created_at        timestamptz DEFAULT now()
);

-- ─── PERMISSIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_permissions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role       text NOT NULL,
  permission text NOT NULL,
  UNIQUE(role, permission)
);

-- ─── SETTINGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_settings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name         text,
  industry             text,
  what_you_sell        text,
  business_type        text DEFAULT 'b2b',
  team_size            text,
  primary_color        text DEFAULT '#8E9B8B',
  logo_url             text,
  onboarding_completed boolean DEFAULT false,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- ─── COMPANIES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_companies (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name     text NOT NULL,
  website          text,
  category         text,
  business_type    text,
  stage            text DEFAULT 'New',
  city             text,
  state            text,
  country          text,
  company_address  text,
  origin           text,
  company_linkedin text,
  facebook_url     text,
  instagram_url    text,
  assigned_to      uuid REFERENCES crm_users(id) ON DELETE SET NULL,
  next_action      text,
  last_activity_at timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  user_id          uuid REFERENCES crm_users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now()
);

-- ─── PEOPLE ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_people (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                uuid REFERENCES crm_companies(id) ON DELETE CASCADE,
  first_name                text,
  last_name                 text,
  title                     text,
  email                     text,
  work_phone                text,
  mobile_phone              text,
  marketing_unsubscribed    boolean DEFAULT false,
  marketing_unsubscribed_at timestamptz,
  unsubscribe_ip            text,
  unsubscribe_user_agent    text,
  unsubscribe_campaign_id   text,
  user_id                   uuid REFERENCES crm_users(id) ON DELETE SET NULL,
  created_at                timestamptz DEFAULT now()
);

-- ─── CLIENTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_clients (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  converted_from       uuid REFERENCES crm_companies(id) ON DELETE SET NULL,
  assigned_to          uuid REFERENCES crm_users(id) ON DELETE SET NULL,
  business_name        text,
  contact_first_name   text,
  contact_last_name    text,
  contact_email        text,
  contact_phone        text,
  website              text,
  category             text,
  business_type        text,
  address              text,
  city                 text,
  state                text,
  country              text,
  stage                text DEFAULT 'Onboarding',
  contract_type        text DEFAULT 'Subscription',
  commission_rate      numeric DEFAULT 0,
  contract_amount      numeric DEFAULT 0,
  contract_signed_date date,
  linkedin_url         text,
  facebook_url         text,
  instagram_url        text,
  origin               text,
  notes                text,
  created_by           uuid REFERENCES crm_users(id) ON DELETE SET NULL,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- ─── CLIENT VENDOR PAGE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_client_vendor_page (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid REFERENCES crm_clients(id) ON DELETE CASCADE,
  display_name   text,
  tagline        text,
  about          text,
  venue_type     text,
  guest_capacity text,
  price_tier     text,
  amenities      text[],
  services       text[],
  ceremony_types text[],
  diversity_tags text[],
  social_links   jsonb,
  published      boolean DEFAULT false,
  created_at     timestamptz DEFAULT now()
);

-- ─── CLIENT FINANCE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_client_finance (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid REFERENCES crm_clients(id) ON DELETE CASCADE,
  type        text DEFAULT 'Commission',
  amount      numeric DEFAULT 0,
  description text,
  status      text DEFAULT 'Pending',
  date        date,
  created_by  uuid REFERENCES crm_users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

-- ─── ACTIVITY LOG ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_activity_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES crm_companies(id) ON DELETE CASCADE,
  client_id  uuid REFERENCES crm_clients(id) ON DELETE CASCADE,
  person_id  uuid REFERENCES crm_people(id) ON DELETE SET NULL,
  user_id    uuid REFERENCES crm_users(id) ON DELETE SET NULL,
  action     text,
  details    text,
  created_at timestamptz DEFAULT now()
);

-- ─── DOCUMENTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text,
  file_url    text,
  type        text DEFAULT 'Other',
  notes       text,
  company_id  uuid REFERENCES crm_companies(id) ON DELETE CASCADE,
  client_id   uuid REFERENCES crm_clients(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES crm_users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

-- ─── GOOGLE ACCOUNTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_google_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES crm_users(id) ON DELETE CASCADE,
  email         text,
  account_type  text DEFAULT 'personal',
  is_active     boolean DEFAULT true,
  access_token  text,
  refresh_token text,
  token_expiry  timestamptz,
  created_at    timestamptz DEFAULT now()
);

-- ─── SYNCED EMAILS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_synced_emails (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid REFERENCES crm_companies(id) ON DELETE CASCADE,
  gmail_message_id text,
  gmail_thread_id  text,
  from_email       text,
  from_name        text,
  subject          text,
  body_html        text,
  body_snippet     text,
  email_date       timestamptz,
  direction        text DEFAULT 'inbound',
  has_attachments  boolean DEFAULT false,
  attachment_count integer DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);

-- ─── EMAILS SENT ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_emails_sent (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES crm_users(id) ON DELETE SET NULL,
  company_id          uuid REFERENCES crm_companies(id) ON DELETE CASCADE,
  client_id           uuid REFERENCES crm_clients(id) ON DELETE CASCADE,
  template_id         uuid,
  subject             text,
  body_html           text,
  recipient_email     text,
  recipient_name      text,
  send_method         text DEFAULT 'sendgrid',
  status              text DEFAULT 'sent',
  email_status        text DEFAULT 'sent',
  sendgrid_message_id text,
  gmail_message_id    text,
  gmail_thread_id     text,
  opened_at           timestamptz,
  clicked_at          timestamptz,
  bounced_at          timestamptz,
  sent_at             timestamptz DEFAULT now()
);

-- ─── EMAIL TEMPLATES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_email_templates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text,
  subject           text,
  body_html         text,
  category          text DEFAULT 'General',
  visibility        text DEFAULT 'team',
  include_signature boolean DEFAULT true,
  created_by        uuid REFERENCES crm_users(id) ON DELETE SET NULL,
  created_at        timestamptz DEFAULT now()
);

-- ─── EMAIL DESIGN TEMPLATES ──────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_email_design_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text,
  type         text DEFAULT 'transactional',
  width        integer DEFAULT 600,
  header_html  text,
  footer_html  text,
  wrapper_html text,
  active       boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- ─── CAMPAIGNS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_campaigns (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text,
  subject            text,
  body_html          text,
  from_name          text,
  from_email         text,
  status             text DEFAULT 'draft',
  design_template_id uuid REFERENCES crm_email_design_templates(id) ON DELETE SET NULL,
  recipients_count   integer DEFAULT 0,
  sent_at            timestamptz,
  created_by         uuid REFERENCES crm_users(id) ON DELETE SET NULL,
  created_at         timestamptz DEFAULT now()
);

-- ─── CAMPAIGN RECIPIENTS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_campaign_recipients (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       uuid REFERENCES crm_campaigns(id) ON DELETE CASCADE,
  company_id        uuid REFERENCES crm_companies(id) ON DELETE CASCADE,
  person_id         uuid REFERENCES crm_people(id) ON DELETE SET NULL,
  email             text,
  recipient_type    text DEFAULT 'contact',
  status            text DEFAULT 'pending',
  unsubscribe_token text DEFAULT gen_random_uuid()::text,
  opened_at         timestamptz,
  clicked_at        timestamptz,
  bounced_at        timestamptz,
  unsubscribed_at   timestamptz,
  created_at        timestamptz DEFAULT now()
);

-- ─── DRIP SEQUENCES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_drip_sequences (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text,
  audience   text DEFAULT 'waitlist',
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ─── DRIP STEPS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_drip_steps (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id        uuid REFERENCES crm_drip_sequences(id) ON DELETE CASCADE,
  step_number        integer DEFAULT 1,
  delay_days         integer DEFAULT 1,
  subject            text,
  body_html          text,
  design_template_id uuid REFERENCES crm_email_design_templates(id) ON DELETE SET NULL,
  active             boolean DEFAULT true,
  created_at         timestamptz DEFAULT now()
);

-- ─── DRIP ENROLLMENTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_drip_enrollments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id    uuid REFERENCES crm_drip_sequences(id) ON DELETE CASCADE,
  email          text,
  first_name     text,
  recipient_type text DEFAULT 'waitlist',
  enrolled_at    timestamptz DEFAULT now(),
  completed      boolean DEFAULT false
);

-- ─── DRIP SENDS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_drip_sends (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id       uuid REFERENCES crm_drip_enrollments(id) ON DELETE CASCADE,
  step_id             uuid REFERENCES crm_drip_steps(id) ON DELETE CASCADE,
  email               text,
  sendgrid_message_id text,
  status              text DEFAULT 'sent',
  opened_at           timestamptz,
  clicked_at          timestamptz,
  bounced_at          timestamptz,
  sent_at             timestamptz DEFAULT now()
);

-- ─── MEETINGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_meetings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_event_id     text,
  google_account_id   uuid REFERENCES crm_google_accounts(id) ON DELETE SET NULL,
  company_id          uuid REFERENCES crm_companies(id) ON DELETE CASCADE,
  client_id           uuid REFERENCES crm_clients(id) ON DELETE CASCADE,
  person_id           uuid REFERENCES crm_people(id) ON DELETE SET NULL,
  created_by          uuid REFERENCES crm_users(id) ON DELETE SET NULL,
  title               text,
  description         text,
  meeting_type        text DEFAULT 'google_meet',
  status              text DEFAULT 'scheduled',
  start_time          timestamptz,
  end_time            timestamptz,
  location            text,
  meet_link           text,
  attendees           jsonb,
  notes               text,
  ai_summary          text,
  ai_action_items     jsonb,
  transcript          text,
  transcript_segments jsonb,
  recall_bot_id       text,
  recording_status    text,
  recording_url       text,
  is_internal         boolean DEFAULT false,
  auto_record         boolean DEFAULT false,
  updated_at          timestamptz DEFAULT now(),
  created_at          timestamptz DEFAULT now()
);

-- ─── MEETING PROPOSALS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_meeting_proposals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid REFERENCES crm_companies(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES crm_clients(id) ON DELETE CASCADE,
  person_id       uuid REFERENCES crm_people(id) ON DELETE SET NULL,
  proposed_start  timestamptz,
  proposed_end    timestamptz,
  gmail_thread_id text,
  status          text DEFAULT 'pending',
  created_at      timestamptz DEFAULT now()
);

-- ─── AI CONVERSATIONS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_ai_conversations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES crm_users(id) ON DELETE CASCADE,
  messages      jsonb DEFAULT '[]'::jsonb,
  last_message  text,
  actions_taken jsonb DEFAULT '[]'::jsonb,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ─── THOUGHTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_thoughts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES crm_users(id) ON DELETE CASCADE,
  content    text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ─── THOUGHT CONVERSATIONS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_thought_conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thought_id uuid REFERENCES crm_thoughts(id) ON DELETE CASCADE,
  messages   jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- ─── TEAM INSIGHTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_team_insights (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight       text,
  thought_count integer DEFAULT 0,
  user_count    integer DEFAULT 0,
  generated_at  timestamptz DEFAULT now()
);

-- ─── EXPENSES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_expenses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text,
  amount              numeric DEFAULT 0,
  date                date,
  category            text,
  vendor              text,
  status              text DEFAULT 'pending',
  recurring           boolean DEFAULT false,
  recurring_interval  text DEFAULT 'monthly',
  last_paid_date      date,
  recurring_parent_id uuid REFERENCES crm_expenses(id) ON DELETE SET NULL,
  receipt_url         text,
  paid_by             uuid REFERENCES crm_users(id) ON DELETE SET NULL,
  notes               text,
  created_at          timestamptz DEFAULT now()
);

-- ─── EMBEDDINGS (RAG) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_embeddings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  source_id    uuid NOT NULL,
  content      text NOT NULL,
  embedding    vector(1536),
  created_at   timestamptz DEFAULT now()
);

-- ─── MEMORY EMBEDDINGS (Chappie RAG) ─────────────────────────
CREATE TABLE IF NOT EXISTS crm_memory_embeddings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source     text,
  source_id  uuid,
  text       text,
  embedding  vector(1536),
  metadata   jsonb,
  created_at timestamptz DEFAULT now()
);

-- ─── INDEXES ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_companies_stage      ON crm_companies(stage);
CREATE INDEX IF NOT EXISTS idx_companies_assigned   ON crm_companies(assigned_to);
CREATE INDEX IF NOT EXISTS idx_people_company       ON crm_people(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_company     ON crm_activity_log(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_client      ON crm_activity_log(client_id);
CREATE INDEX IF NOT EXISTS idx_activity_created     ON crm_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_company     ON crm_meetings(company_id);
CREATE INDEX IF NOT EXISTS idx_meetings_client      ON crm_meetings(client_id);
CREATE INDEX IF NOT EXISTS idx_meetings_start       ON crm_meetings(start_time);
CREATE INDEX IF NOT EXISTS idx_emails_sent_company  ON crm_emails_sent(company_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients  ON crm_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_source    ON crm_embeddings(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_memory_source        ON crm_memory_embeddings(source, source_id);

-- ─── DEFAULT PERMISSIONS ─────────────────────────────────────
INSERT INTO crm_permissions (role, permission) VALUES
  ('admin', 'company:view'),    ('admin', 'company:edit'),
  ('admin', 'company:delete'),  ('admin', 'company:assign'),
  ('admin', 'people:view'),     ('admin', 'people:edit'),
  ('admin', 'people:delete'),
  ('admin', 'pipeline:view'),   ('admin', 'pipeline:move'),
  ('admin', 'email:send'),      ('admin', 'email:view'),
  ('admin', 'campaign:view'),   ('admin', 'campaign:send'),
  ('admin', 'client:view'),     ('admin', 'client:edit'),
  ('admin', 'finance:general'),
  ('admin', 'team:manage'),
  ('sales', 'company:view'),    ('sales', 'company:edit'),
  ('sales', 'people:view'),     ('sales', 'people:edit'),
  ('sales', 'pipeline:view'),   ('sales', 'pipeline:move'),
  ('sales', 'email:send'),      ('sales', 'email:view'),
  ('sales', 'client:view'),
  ('marketing', 'company:view'),
  ('marketing', 'people:view'),
  ('marketing', 'pipeline:view'),
  ('marketing', 'email:view'),
  ('marketing', 'campaign:view'), ('marketing', 'campaign:send'),
  ('finance', 'company:view'),
  ('finance', 'client:view'),
  ('finance', 'finance:general'),
  ('viewer', 'company:view'),
  ('viewer', 'people:view'),
  ('viewer', 'pipeline:view'),
  ('viewer', 'client:view')
ON CONFLICT (role, permission) DO NOTHING;

-- ─── DEFAULT SETTINGS ROW ────────────────────────────────────
INSERT INTO crm_settings (company_name, onboarding_completed)
VALUES ('My Company', false)
ON CONFLICT DO NOTHING;
