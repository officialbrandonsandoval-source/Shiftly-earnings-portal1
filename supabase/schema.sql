-- Shiftly Earnings Portal — Supabase Schema
-- Run this in Supabase SQL editor to set up the database

-- Pay structures table
CREATE TABLE IF NOT EXISTS pay_structures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  mrr_rate_tool NUMERIC(5,4) NOT NULL DEFAULT 0.13,
  mrr_rate_ads NUMERIC(5,4) NOT NULL DEFAULT 0.13,
  mrr_rate_bundle_tool NUMERIC(5,4) NOT NULL DEFAULT 0.16,
  mrr_rate_bundle_ads NUMERIC(5,4) NOT NULL DEFAULT 0.16,
  setup_rate_tool NUMERIC(5,4) NOT NULL DEFAULT 0.25,
  setup_rate_ads NUMERIC(5,4) NOT NULL DEFAULT 0.25,
  setup_rate_bundle_tool NUMERIC(5,4) NOT NULL DEFAULT 0.30,
  setup_rate_bundle_ads NUMERIC(5,4) NOT NULL DEFAULT 0.30,
  tier1_threshold NUMERIC(10,2) DEFAULT 30000,
  tier1_bonus_rate NUMERIC(5,4) DEFAULT 0.03,
  tier2_threshold NUMERIC(10,2) DEFAULT 40000,
  tier2_bonus_rate NUMERIC(5,4) DEFAULT 0.05,
  term_multipliers JSONB NOT NULL DEFAULT '{"1": 1, "3": 2, "6": 4, "12": 7}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manager', 'rep')) DEFAULT 'rep',
  pay_structure_id UUID REFERENCES pay_structures(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE pay_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS policies: authenticated users can read
CREATE POLICY "Authenticated users can read pay_structures"
  ON pay_structures FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage pay_structures"
  ON pay_structures FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'manager')
  );

CREATE POLICY "Authenticated users can read users"
  ON users FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage users"
  ON users FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'manager')
  );

-- Seed pay structures
INSERT INTO pay_structures (id, name, mrr_rate_tool, mrr_rate_ads, mrr_rate_bundle_tool, mrr_rate_bundle_ads, setup_rate_tool, setup_rate_ads, setup_rate_bundle_tool, setup_rate_bundle_ads, tier1_threshold, tier1_bonus_rate, tier2_threshold, tier2_bonus_rate, term_multipliers)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Standard', 0.13, 0.13, 0.16, 0.16, 0.25, 0.25, 0.30, 0.30, 30000, 0.03, 40000, 0.05, '{"1": 1, "3": 2, "6": 4, "12": 7}'),
  ('00000000-0000-0000-0000-000000000002', 'JR Custom', 0.15, 0.15, 0.15, 0.15, 0.50, 0.50, 0.50, 0.50, NULL, NULL, 40000, 0.20, '{"1": 1, "3": 2, "6": 4, "12": 7}')
ON CONFLICT (id) DO NOTHING;

-- Note: Users must be created via Supabase Auth first, then inserted here.
-- Use supabase/seed-users.ts or the Supabase dashboard to create auth users,
-- then run the following (replacing UUIDs with actual auth.users IDs):
--
-- INSERT INTO users (id, email, name, role, pay_structure_id) VALUES
--   ('<sarah-auth-uid>', 'sarah@shiftlyauto.com', 'Sarah Mitchell', 'manager', '00000000-0000-0000-0000-000000000001'),
--   ('<mike-auth-uid>', 'mike@shiftlyauto.com', 'Mike Torres', 'rep', '00000000-0000-0000-0000-000000000001'),
--   ('<jr-auth-uid>', 'jr@shiftlyauto.com', 'JR Patel', 'rep', '00000000-0000-0000-0000-000000000002');
