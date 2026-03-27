-- Add sheet_tab column to users table for Google Sheet tab name per user
ALTER TABLE users ADD COLUMN IF NOT EXISTS sheet_tab TEXT DEFAULT NULL;
