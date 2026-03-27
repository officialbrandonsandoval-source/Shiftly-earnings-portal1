import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST() {
  const results: { step: string; status: string; error?: string }[] = [];

  // Step 1: Add sheet_tab column if it doesn't exist
  // We can't run raw DDL via PostgREST, so we try to select the column first
  // If it fails, we use a workaround via Supabase's built-in RPC
  try {
    const { error: checkError } = await supabaseAdmin
      .from("users")
      .select("sheet_tab")
      .limit(1);

    if (checkError && checkError.message.includes("sheet_tab")) {
      // Column doesn't exist - try to add it via rpc if available
      // Since we can't run raw DDL, inform the user
      results.push({
        step: "add_sheet_tab_column",
        status: "needs_manual",
        error: "Run this SQL in your Supabase dashboard SQL editor: ALTER TABLE users ADD COLUMN IF NOT EXISTS sheet_tab TEXT DEFAULT NULL;",
      });
    } else {
      results.push({ step: "add_sheet_tab_column", status: "ok (column exists)" });
    }
  } catch (err) {
    results.push({ step: "add_sheet_tab_column", status: "error", error: String(err) });
  }

  // Step 2: Update existing users with their sheet_tab values
  const sheetTabDefaults: Record<string, string> = {
    "jr@shiftlyauto.com": "JR",
    "anthony@shiftlyauto.com": "Anthony",
    "dawson@shiftlyauto.com": "Dawson",
    "gdykema@shiftlyauto.com": "Gabriel",
    "alex@shiftlyauto.com": "Alex",
    "jeremy@shiftlyauto.com": "Jeremy",
  };

  for (const [email, tab] of Object.entries(sheetTabDefaults)) {
    try {
      const { error } = await supabaseAdmin
        .from("users")
        .update({ sheet_tab: tab })
        .eq("email", email);

      if (error) {
        results.push({ step: `set_tab_${email}`, status: "error", error: error.message });
      } else {
        results.push({ step: `set_tab_${email}`, status: "ok" });
      }
    } catch (err) {
      results.push({ step: `set_tab_${email}`, status: "error", error: String(err) });
    }
  }

  return NextResponse.json({ results });
}
