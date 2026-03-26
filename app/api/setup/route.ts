import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function POST() {
  const sb = createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: "public" },
  });

  // Check if deals table exists by trying to query it
  const { error: dealsError } = await sb.from("deals").select("id").limit(1);

  if (dealsError?.message?.includes("Could not find the table")) {
    // Tables don't exist — need to run migration in Supabase SQL Editor
    return NextResponse.json({
      status: "tables_missing",
      message: "Run the SQL from supabase/migrations/001_deals.sql in the Supabase SQL Editor",
      sql_url: `https://supabase.com/dashboard/project/wwrhrczdcfnatggbilug/sql`,
    });
  }

  return NextResponse.json({ status: "ok", message: "Tables exist" });
}
