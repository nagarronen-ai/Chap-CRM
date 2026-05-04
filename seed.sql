-- ============================================================
-- Chap CRM — Seed Data
-- Real estate wholesaling demo dataset
-- Run AFTER schema.sql
--
-- Default login credentials after seeding:
--   admin@chapcrm.io     / ChapCRM2024!  (admin)
--   sales1@chapcrm.io    / ChapCRM2024!  (sales)
--   sales2@chapcrm.io    / ChapCRM2024!  (sales)
--   mktg1@chapcrm.io     / ChapCRM2024!  (marketing)
--   finance@chapcrm.io   / ChapCRM2024!  (finance)
--
-- Change all passwords after first login.
-- ============================================================

-- ─── USERS ───────────────────────────────────────────────────
-- Password hash = bcrypt of 'ChapCRM2024!'
INSERT INTO crm_users (id, email, name, password, role, timezone) VALUES
  ('11111111-0000-0000-0000-000000000001', 'admin@chapcrm.io',   'Alex Morgan',  '$2b$10$8.aSEXA2lD178L0ywMrY4OJDX/aplOiyF4sN7ArQ9H/XshdhjrqnW', 'admin',     'America/New_York'),
  ('11111111-0000-0000-0000-000000000002', 'sales1@chapcrm.io',  'Jordan Lee',   '$2b$10$8.aSEXA2lD178L0ywMrY4OJDX/aplOiyF4sN7ArQ9H/XshdhjrqnW', 'sales',     'America/Chicago'),
  ('11111111-0000-0000-0000-000000000003', 'sales2@chapcrm.io',  'Taylor Kim',   '$2b$10$8.aSEXA2lD178L0ywMrY4OJDX/aplOiyF4sN7ArQ9H/XshdhjrqnW', 'sales',     'America/Los_Angeles'),
  ('11111111-0000-0000-0000-000000000004', 'mktg1@chapcrm.io',   'Casey Rivera', '$2b$10$8.aSEXA2lD178L0ywMrY4OJDX/aplOiyF4sN7ArQ9H/XshdhjrqnW', 'marketing', 'America/New_York'),
  ('11111111-0000-0000-0000-000000000005', 'finance@chapcrm.io', 'Morgan Patel', '$2b$10$8.aSEXA2lD178L0ywMrY4OJDX/aplOiyF4sN7ArQ9H/XshdhjrqnW', 'finance',   'America/New_York')
ON CONFLICT (email) DO NOTHING;

-- ─── SETTINGS ────────────────────────────────────────────────
UPDATE crm_settings SET
  company_name         = 'Apex Wholesale Group',
  industry             = 'Real Estate',
  what_you_sell        = 'Off-market property deals to cash buyers and fix-and-flip investors',
  business_type        = 'b2b',
  team_size            = '5-10',
  onboarding_completed = true;

-- ─── COMPANIES ───────────────────────────────────────────────
INSERT INTO crm_companies (id, company_name, website, category, business_type, stage, city, state, country, origin, assigned_to, next_action, created_at) VALUES
  ('22222222-0000-0000-0000-000000000001', 'Cornerstone Capital Investments', 'cornerstonecapital.com',  'Buyer',  'Cash Buyer',         'Active',            'Atlanta',       'GA', 'United States', 'Cold',     '11111111-0000-0000-0000-000000000002', 'Send new batch of off-market deals',     now() - interval '45 days'),
  ('22222222-0000-0000-0000-000000000002', 'Blue Ridge Realty Group',         'blueridgerealty.com',     'Buyer',  'Fix & Flip',         'Meeting Scheduled', 'Charlotte',     'NC', 'United States', 'Referral', '11111111-0000-0000-0000-000000000002', 'Confirm deal parameters before meeting', now() - interval '30 days'),
  ('22222222-0000-0000-0000-000000000003', 'Sunbelt Property Partners',       'sunbeltpp.com',           'Buyer',  'Buy & Hold',         'Proposal Offered',  'Dallas',        'TX', 'United States', 'Cold',     '11111111-0000-0000-0000-000000000003', 'Follow up on portfolio offer',           now() - interval '60 days'),
  ('22222222-0000-0000-0000-000000000004', 'Harbor View Acquisitions',        'harborviewacq.com',       'Buyer',  'Cash Buyer',         'Contacted',         'Jacksonville',  'FL', 'United States', 'Cold',     '11111111-0000-0000-0000-000000000002', 'Send proof of funds request',            now() - interval '20 days'),
  ('22222222-0000-0000-0000-000000000005', 'Ironwood REI Fund',               'ironwoodfund.com',        'Buyer',  'Fund',               'Closed Won',        'Nashville',     'TN', 'United States', 'Hot',      '11111111-0000-0000-0000-000000000003', 'Onboard to client portal',               now() - interval '90 days'),
  ('22222222-0000-0000-0000-000000000006', 'Maple Street Wholesalers',        'maplestreetwholesale.com','Seller', 'Wholesaler',         'Follow-up',         'Columbus',      'OH', 'United States', 'Referral', '11111111-0000-0000-0000-000000000002', 'Review JV agreement draft',              now() - interval '15 days'),
  ('22222222-0000-0000-0000-000000000007', 'Pacific Crest Property Group',    'pacificcrestpg.com',      'Buyer',  'Fix & Flip',         'No Reply',          'Phoenix',       'AZ', 'United States', 'Cold',     '11111111-0000-0000-0000-000000000003', 'Send follow-up #2',                      now() - interval '25 days'),
  ('22222222-0000-0000-0000-000000000008', 'Delta Land Holdings',             'deltalandholdings.com',   'Seller', 'Land Seller',        'New',               'Memphis',       'TN', 'United States', 'Upload',   '11111111-0000-0000-0000-000000000002', 'Initial outreach email',                 now() - interval '5 days'),
  ('22222222-0000-0000-0000-000000000009', 'Sterling Bridge Capital',         'sterlingbridgecap.com',   'Buyer',  'Hard Money Lender',  'Active',            'Miami',         'FL', 'United States', 'Hot',      '11111111-0000-0000-0000-000000000003', 'Introduce to Ironwood deal flow',        now() - interval '55 days'),
  ('22222222-0000-0000-0000-000000000010', 'Ridgeline Property Solutions',    'ridgelineps.com',         'Buyer',  'Cash Buyer',         'Agreement Sent',    'Denver',        'CO', 'United States', 'Cold',     '11111111-0000-0000-0000-000000000002', 'Chase contract signature',               now() - interval '10 days'),
  ('22222222-0000-0000-0000-000000000011', 'Tidewater Investment Group',      'tidewaterig.com',         'Buyer',  'Buy & Hold',         'Closed Lost',       'Virginia Beach','VA', 'United States', 'Cold',     '11111111-0000-0000-0000-000000000003', NULL,                                     now() - interval '80 days'),
  ('22222222-0000-0000-0000-000000000012', 'Granite Peak Holdings',           'granitepeakholdings.com', 'Buyer',  'Fix & Flip',         'Contacted',         'Salt Lake City','UT', 'United States', 'Instagram','11111111-0000-0000-0000-000000000002', 'Send buyer criteria form',               now() - interval '8 days'),
  ('22222222-0000-0000-0000-000000000013', 'Magnolia Capital Group',          'magnoliacapgroup.com',    'Buyer',  'Cash Buyer',         'Proposal Offered',  'Houston',       'TX', 'United States', 'Referral', '11111111-0000-0000-0000-000000000003', 'Follow up on 3-property bundle offer',   now() - interval '35 days'),
  ('22222222-0000-0000-0000-000000000014', 'Clearwater Asset Management',     'clearwateram.com',        'Buyer',  'Fund',               'Meeting Scheduled', 'Tampa',         'FL', 'United States', 'Google',   '11111111-0000-0000-0000-000000000002', 'Prepare deal room before call',          now() - interval '12 days'),
  ('22222222-0000-0000-0000-000000000015', 'Summit Ridge Investments',        'summitridgeinv.com',      'Buyer',  'Fix & Flip',         'Follow-up',         'Raleigh',       'NC', 'United States', 'Cold',     '11111111-0000-0000-0000-000000000003', 'Third touch — try phone',                now() - interval '18 days')
ON CONFLICT DO NOTHING;

-- ─── PEOPLE ──────────────────────────────────────────────────
INSERT INTO crm_people (id, company_id, first_name, last_name, title, email, work_phone, mobile_phone) VALUES
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'Robert',  'Hargrove',  'Managing Partner',      'robert.h@cornerstonecapital.com',  '404-555-0101', '404-555-0201'),
  ('33333333-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', 'Patricia','Voss',      'Acquisitions Director', 'pvoss@cornerstonecapital.com',     '404-555-0102', NULL),
  ('33333333-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000002', 'Marcus',  'Thornton',  'CEO',                   'marcus@blueridgerealty.com',       '704-555-0103', '704-555-0203'),
  ('33333333-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000003', 'Angela',  'Wu',        'Portfolio Manager',     'angela.wu@sunbeltpp.com',          '214-555-0104', '214-555-0204'),
  ('33333333-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000004', 'Dwayne',  'Okafor',    'Principal',             'dokafor@harborviewacq.com',        '904-555-0105', NULL),
  ('33333333-0000-0000-0000-000000000006', '22222222-0000-0000-0000-000000000005', 'Sophia',  'Castellano','Fund Manager',          'sophia@ironwoodfund.com',          '615-555-0106', '615-555-0206'),
  ('33333333-0000-0000-0000-000000000007', '22222222-0000-0000-0000-000000000006', 'Derek',   'Simmons',   'Owner',                 'derek@maplestreetwholesale.com',   '614-555-0107', '614-555-0207'),
  ('33333333-0000-0000-0000-000000000008', '22222222-0000-0000-0000-000000000009', 'Yvonne',  'Fairbanks', 'Director of Lending',   'yfairbanks@sterlingbridgecap.com', '305-555-0108', NULL),
  ('33333333-0000-0000-0000-000000000009', '22222222-0000-0000-0000-000000000010', 'Nathan',  'Coyle',     'Investment Director',   'ncoyle@ridgelineps.com',           '303-555-0109', '303-555-0209'),
  ('33333333-0000-0000-0000-000000000010', '22222222-0000-0000-0000-000000000013', 'Brenda',  'Nakamura',  'Partner',               'bnakamura@magnoliacapgroup.com',   '713-555-0110', '713-555-0210'),
  ('33333333-0000-0000-0000-000000000011', '22222222-0000-0000-0000-000000000014', 'Victor',  'Delgado',   'Managing Director',     'vdelgado@clearwateram.com',        '813-555-0111', NULL),
  ('33333333-0000-0000-0000-000000000012', '22222222-0000-0000-0000-000000000015', 'Heather', 'Quinlan',   'Acquisitions Manager',  'hquinlan@summitridgeinv.com',      '919-555-0112', '919-555-0212')
ON CONFLICT DO NOTHING;

-- ─── CLIENTS ─────────────────────────────────────────────────
INSERT INTO crm_clients (id, converted_from, assigned_to, business_name, contact_first_name, contact_last_name, contact_email, contact_phone, city, state, country, stage, contract_type, commission_rate, contract_amount, contract_signed_date, created_by, created_at) VALUES
  ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000003', 'Ironwood REI Fund',      'Sophia', 'Castellano', 'sophia@ironwoodfund.com',          '615-555-0106', 'Nashville', 'TN', 'United States', 'Active', 'RevShare',    3.5, 2000, '2024-09-15', '11111111-0000-0000-0000-000000000001', now() - interval '85 days'),
  ('44444444-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000009', '11111111-0000-0000-0000-000000000003', 'Sterling Bridge Capital','Yvonne', 'Fairbanks',  'yfairbanks@sterlingbridgecap.com', '305-555-0108', 'Miami',     'FL', 'United States', 'Active', 'Subscription',0,   1500, '2024-11-01', '11111111-0000-0000-0000-000000000001', now() - interval '50 days')
ON CONFLICT DO NOTHING;

-- ─── ACTIVITY LOG ────────────────────────────────────────────
INSERT INTO crm_activity_log (company_id, user_id, action, details, created_at) VALUES
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'Note Added',        'Spoke with Robert — they are actively looking for distressed SFRs in Atlanta metro. ARV range $180k-$350k. No condos.',  now() - interval '40 days'),
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'Email Sent',        'Email Sent: "New Off-Market Batch — 6 Atlanta SFRs"',                                                                  now() - interval '38 days'),
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'Stage changed',     'Stage changed from "Contacted" to "Active"',                                                                           now() - interval '35 days'),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 'Note Added',        'Marcus confirmed he can close in 14 days cash. Looking for 20-30% below ARV. Prefers Charlotte suburbs.',             now() - interval '28 days'),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 'Meeting Scheduled', '📹 Google Meet: "Deal Review Call — Blue Ridge" on Mon, Jan 15 at 2:00 PM',                                           now() - interval '25 days'),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000003', 'Email Sent',        'Email Sent: "Portfolio Offer — 4 Dallas Properties"',                                                                  now() - interval '55 days'),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000003', 'Note Added',        'Angela reviewed the portfolio. Interested in 2 of the 4. Will counter on price. Expects 7-cap minimum.',              now() - interval '50 days'),
  ('22222222-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000003', 'Stage changed',     'Stage changed from "Proposal Offered" to "Closed Won"',                                                               now() - interval '88 days'),
  ('22222222-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001', 'Converted to Client','Ironwood REI Fund converted to client. Contract: RevShare, Commission: 3.5%',                                       now() - interval '85 days'),
  ('22222222-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000002', 'Note Added',        'Derek wants a JV on his Dayton deals. He does the acquisition, we bring the buyers. 50/50 split on assignment fee.',  now() - interval '14 days'),
  ('22222222-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000002', 'Email Sent',        'Email Sent: "Purchase Agreement — 4218 Elm Street, Denver"',                                                          now() - interval '9 days'),
  ('22222222-0000-0000-0000-000000000013', '11111111-0000-0000-0000-000000000003', 'Note Added',        'Brenda is interested in the 3-property Houston bundle. Wants title report on all 3 before committing. Budget up to $890k.', now() - interval '30 days'),
  ('22222222-0000-0000-0000-000000000014', '11111111-0000-0000-0000-000000000002', 'Meeting Scheduled', '📹 Google Meet: "Clearwater Intro Call" on Wed, Jan 22 at 11:00 AM',                                                  now() - interval '10 days')
ON CONFLICT DO NOTHING;

-- ─── CAMPAIGNS ───────────────────────────────────────────────
INSERT INTO crm_campaigns (id, name, subject, body_html, from_name, from_email, status, recipients_count, sent_at, created_by, created_at) VALUES
  ('55555555-0000-0000-0000-000000000001',
   'Q1 Off-Market Buyer Blast',
   'New Deals Available — January Off-Market Batch',
   '<p>Hi {{first_name}},</p><p>We have a fresh batch of off-market properties ready to move.</p><ul><li>6 SFRs in Atlanta metro — ARV $180k–$350k, asking 65–70% ARV</li><li>3-property bundle in Houston — total ask $850k</li><li>Fix & flip in Charlotte — 4BR/2BA, needs cosmetics only</li></ul><p>Reply or book a call to get the full deal packages.</p><p>Best,<br>The Apex Team</p>',
   'Alex Morgan', 'alex@apexwholesale.com', 'sent', 8,
   now() - interval '20 days', '11111111-0000-0000-0000-000000000001', now() - interval '22 days'),
  ('55555555-0000-0000-0000-000000000002',
   'JV Partner Outreach',
   'Looking for Wholesale JV Partners in the Southeast',
   '<p>Hi {{first_name}},</p><p>We are expanding our JV network and looking for experienced wholesalers in the Southeast.</p><ul><li>You bring the deal, we bring a verified cash buyer</li><li>50/50 split on assignment fee</li><li>We handle paperwork and closing coordination</li></ul><p>Let us set up a quick call.</p><p>Jordan Lee<br>Apex Wholesale Group</p>',
   'Jordan Lee', 'jordan@apexwholesale.com', 'sent', 4,
   now() - interval '14 days', '11111111-0000-0000-0000-000000000002', now() - interval '15 days')
ON CONFLICT DO NOTHING;

-- ─── CAMPAIGN RECIPIENTS ─────────────────────────────────────
INSERT INTO crm_campaign_recipients (campaign_id, company_id, person_id, email, recipient_type, status, opened_at, clicked_at, created_at) VALUES
  ('55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'robert.h@cornerstonecapital.com',  'contact', 'clicked', now() - interval '19 days', now() - interval '19 days', now() - interval '20 days'),
  ('55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000003', 'marcus@blueridgerealty.com',        'contact', 'opened',  now() - interval '19 days', NULL,                       now() - interval '20 days'),
  ('55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000004', 'angela.wu@sunbeltpp.com',           'contact', 'clicked', now() - interval '18 days', now() - interval '18 days', now() - interval '20 days'),
  ('55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000004', '33333333-0000-0000-0000-000000000005', 'dokafor@harborviewacq.com',         'contact', 'sent',    NULL,                        NULL,                       now() - interval '20 days'),
  ('55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000007', NULL,                                   'info@pacificcrestpg.com',            'contact', 'bounced', NULL,                        NULL,                       now() - interval '20 days'),
  ('55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000013', '33333333-0000-0000-0000-000000000010', 'bnakamura@magnoliacapgroup.com',    'contact', 'opened',  now() - interval '19 days', NULL,                       now() - interval '20 days'),
  ('55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000014', '33333333-0000-0000-0000-000000000011', 'vdelgado@clearwateram.com',         'contact', 'clicked', now() - interval '18 days', now() - interval '17 days', now() - interval '20 days'),
  ('55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000015', '33333333-0000-0000-0000-000000000012', 'hquinlan@summitridgeinv.com',       'contact', 'sent',    NULL,                        NULL,                       now() - interval '20 days'),
  ('55555555-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000006', '33333333-0000-0000-0000-000000000007', 'derek@maplestreetwholesale.com',    'contact', 'clicked', now() - interval '13 days', now() - interval '13 days', now() - interval '14 days'),
  ('55555555-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000008', NULL,                                   'info@deltalandholdings.com',         'contact', 'opened',  now() - interval '13 days', NULL,                       now() - interval '14 days'),
  ('55555555-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000012', NULL,                                   'info@granitepeakholdings.com',       'contact', 'sent',    NULL,                        NULL,                       now() - interval '14 days'),
  ('55555555-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000015', '33333333-0000-0000-0000-000000000012', 'hquinlan@summitridgeinv.com',       'contact', 'opened',  now() - interval '12 days', NULL,                       now() - interval '14 days')
ON CONFLICT DO NOTHING;

-- ─── MEETINGS ────────────────────────────────────────────────
INSERT INTO crm_meetings (id, company_id, person_id, created_by, title, meeting_type, status, start_time, end_time, meet_link, notes, ai_summary, ai_action_items, created_at) VALUES
  ('66666666-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000002',
   '33333333-0000-0000-0000-000000000003',
   '11111111-0000-0000-0000-000000000002',
   'Deal Review Call — Blue Ridge Realty',
   'google_meet', 'completed',
   now() - interval '23 days',
   now() - interval '23 days' + interval '45 minutes',
   'https://meet.google.com/abc-defg-hij',
   'Marcus confirmed interest in the Charlotte fix & flip. Wants proof of clear title before proceeding. Discussed timeline — he can close in 12 days with cash. Agreed to send updated comp analysis by Friday.',
   'The call focused on a Charlotte fix-and-flip property. Marcus Thornton confirmed strong interest but requested a clear title report before committing. He emphasized a 12-day cash close capability and asked for an updated comp analysis. Overall tone was positive and deal-oriented.',
   '[{"task": "Send updated comp analysis for Charlotte property", "owner": "Jordan Lee", "priority": "high"}, {"task": "Order title report and share with Marcus", "owner": "Jordan Lee", "priority": "high"}, {"task": "Follow up Friday if no response", "owner": "Jordan Lee", "priority": "medium"}]'::jsonb,
   now() - interval '23 days'),
  ('66666666-0000-0000-0000-000000000002',
   '22222222-0000-0000-0000-000000000014',
   '33333333-0000-0000-0000-000000000011',
   '11111111-0000-0000-0000-000000000002',
   'Clearwater Intro Call',
   'google_meet', 'scheduled',
   now() + interval '2 days',
   now() + interval '2 days' + interval '30 minutes',
   'https://meet.google.com/xyz-uvwx-yzab',
   NULL, NULL, NULL,
   now() - interval '10 days'),
  ('66666666-0000-0000-0000-000000000003',
   '22222222-0000-0000-0000-000000000003',
   '33333333-0000-0000-0000-000000000004',
   '11111111-0000-0000-0000-000000000003',
   'Sunbelt Portfolio Review',
   'google_meet', 'completed',
   now() - interval '45 days',
   now() - interval '45 days' + interval '60 minutes',
   'https://meet.google.com/pqr-stuv-wxyz',
   'Reviewed all 4 properties with Angela. She wants to move on 2 of them — Plano and Irving. Passed on Mesquite and Garland due to school district concerns. Price negotiation ongoing.',
   'Portfolio review with Sunbelt Property Partners. Angela Wu confirmed interest in 2 of 4 properties (Plano and Irving). The other 2 were rejected due to school district concerns. Price negotiation is the next step.',
   '[{"task": "Prepare separate term sheets for Plano and Irving properties", "owner": "Taylor Kim", "priority": "high"}, {"task": "Research school district data for future deal sourcing", "owner": "Taylor Kim", "priority": "low"}]'::jsonb,
   now() - interval '45 days')
ON CONFLICT DO NOTHING;

-- ─── THOUGHTS ────────────────────────────────────────────────
INSERT INTO crm_thoughts (id, user_id, content, created_at) VALUES
  ('77777777-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'We should build a deal scoring system — automatically rank incoming properties by buyer match probability based on ARV range, location, and deal type. Would save hours of manual matching every week.', now() - interval '10 days'),
  ('77777777-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 'The JV model with Maple Street is working. Derek brought 3 deals this month and we closed 2. We should formalize this into a JV agreement template and pitch it to 5 more regional wholesalers.', now() - interval '7 days'),
  ('77777777-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000003', 'Texas is our best market right now. 4 active buyers, 2 clients, pipeline is full. Should we hire a dedicated TX acquisition manager? Volume justifies it if we close 2 more deals this quarter.', now() - interval '5 days'),
  ('77777777-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000004', 'Our email open rates hit 67% on the buyer blast — well above industry average. The personalization and short subject lines are working. Let us document this as a standard playbook.', now() - interval '3 days'),
  ('77777777-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001', 'Idea: private buyer portal where active clients see new deals before the general list. Exclusivity is a strong retention hook — could reduce churn on subscription clients.', now() - interval '1 day')
ON CONFLICT DO NOTHING;

-- ─── TEAM INSIGHT ────────────────────────────────────────────
INSERT INTO crm_team_insights (insight, thought_count, user_count, generated_at) VALUES
  ('The team is aligned around two growth levers: systematizing deal-to-buyer matching and expanding the JV partner network. Texas is emerging as the highest-volume market, and there is consensus that exclusive buyer perks could improve client retention. Email performance is a standout strength worth codifying into a repeatable playbook.', 5, 4, now() - interval '12 hours')
ON CONFLICT DO NOTHING;
