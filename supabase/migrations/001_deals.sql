-- Migration: deals + activity_log tables
-- Run this in Supabase SQL Editor (Dashboard > SQL > New Query)

CREATE TABLE IF NOT EXISTS deals (
  id uuid primary key default gen_random_uuid(),
  rep_email text not null,
  rep_name text not null,
  deal_date text not null,
  dealer_name text not null,
  client_name text not null,
  product text not null,
  monthly_price numeric not null default 0,
  setup_fee numeric not null default 0,
  term integer not null default 1,
  half text not null,
  synced_to_sheet boolean default false,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id uuid primary key default gen_random_uuid(),
  rep_email text not null,
  rep_name text not null,
  log_date text not null,
  scheduled_calls integer default 0,
  shown_calls integer default 0,
  sold_deals integer default 0,
  revenue_collected numeric default 0,
  no_shows integer default 0,
  created_at timestamptz default now()
);

-- Enable RLS
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (API routes use service role key)
CREATE POLICY "Service role full access on deals" ON deals FOR ALL USING (true);
CREATE POLICY "Service role full access on activity_log" ON activity_log FOR ALL USING (true);
