-- Shiftly Earnings Portal — Supabase Schema
-- Run this in your Supabase SQL Editor if tables are missing.
-- It uses IF NOT EXISTS so it's safe to run even if tables already exist.

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manager', 'rep')),
  pay_structure_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Deals table
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  client TEXT NOT NULL,
  dealer TEXT NOT NULL,
  product TEXT NOT NULL CHECK (product IN ('Tool', 'Ads', 'Bundle Tool', 'Bundle Ads')),
  monthly_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  setup_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  term INTEGER NOT NULL CHECK (term IN (1, 3, 6, 12)),
  rep_name TEXT NOT NULL,
  rep_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_email TEXT NOT NULL,
  rep_name TEXT NOT NULL,
  log_date DATE NOT NULL,
  scheduled_calls INTEGER DEFAULT 0,
  shown_calls INTEGER DEFAULT 0,
  sold_deals INTEGER DEFAULT 0,
  revenue_collected NUMERIC(10,2) DEFAULT 0,
  no_shows INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rep_email, log_date)
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: allow authenticated users to read, service role to write
CREATE POLICY IF NOT EXISTS "Users can read own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Service role full access to users" ON users
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Authenticated users can read deals" ON deals
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Service role full access to deals" ON deals
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Users can read own activity" ON activity_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Service role full access to activity_logs" ON activity_logs
  FOR ALL USING (auth.role() = 'service_role');
