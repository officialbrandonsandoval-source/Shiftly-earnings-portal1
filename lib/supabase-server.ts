import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client with service role key for API routes
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key";

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
