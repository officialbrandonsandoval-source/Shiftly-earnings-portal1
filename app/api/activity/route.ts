import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const role = searchParams.get("role");

  let query = supabaseAdmin
    .from("activity_log")
    .select("*")
    .order("log_date", { ascending: false })
    .limit(50);

  // If rep, filter to their logs only
  if (role !== "manager" && email) {
    query = query.eq("rep_email", email);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rep_email, rep_name, log_date, scheduled_calls, shown_calls, sold_deals, revenue_collected, no_shows } = body;

    if (!rep_email || !rep_name || !log_date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("activity_log")
      .insert({
        rep_email,
        rep_name,
        log_date,
        scheduled_calls: Number(scheduled_calls) || 0,
        shown_calls: Number(shown_calls) || 0,
        sold_deals: Number(sold_deals) || 0,
        revenue_collected: Number(revenue_collected) || 0,
        no_shows: Number(no_shows) || 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Activity log error:", err);
    return NextResponse.json({ error: "Failed to log activity" }, { status: 500 });
  }
}
