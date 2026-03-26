import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST() {
  try {
    // Fetch all unsynced deals
    const { data: deals, error } = await supabaseAdmin
      .from("deals")
      .select("*")
      .eq("synced_to_sheet", false)
      .order("deal_date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!deals || deals.length === 0) {
      return NextResponse.json({ message: "No unsynced deals", count: 0 });
    }

    // Generate CSV
    const headers = ["Date", "Dealer Name", "Client Name", "Product", "Monthly Price", "Setup Fee", "Term (Mo)", "Rep Name"];
    const rows = deals.map((d) =>
      [d.deal_date, d.dealer_name, d.client_name, d.product, d.monthly_price, d.setup_fee, d.term, d.rep_name]
        .map((v) => `"${v}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");

    // Mark as synced
    const ids = deals.map((d) => d.id);
    await supabaseAdmin
      .from("deals")
      .update({ synced_to_sheet: true })
      .in("id", ids);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="shiftly-deals-sync-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    console.error("Sync error:", err);
    return NextResponse.json({ error: "Failed to sync deals" }, { status: 500 });
  }
}
