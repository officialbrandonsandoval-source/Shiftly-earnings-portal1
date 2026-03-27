import { NextResponse } from "next/server";
import { getAllRepDeals, getMockDeals } from "@/lib/sheets";
import type { SheetDeal } from "@/lib/sheets";
import { supabaseAdmin, isSupabaseServerConfigured } from "@/lib/supabase-server";
import type { Deal, ProductType, TermLength } from "@/lib/types";

// In-memory store for demo mode deals (persists per server process)
const demoDeals: Deal[] = [];

function sheetDealToDeal(d: SheetDeal): Deal {
  // Normalize date from "M/D/YYYY" or "YYYY-MM-DD" to "YYYY-MM-DD"
  let date = d.date;
  if (date.includes("/")) {
    const parts = date.split("/");
    const m = parts[0].padStart(2, "0");
    const day = parts[1].padStart(2, "0");
    const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    date = `${y}-${m}-${day}`;
  }
  return {
    date,
    client: d.clientName,
    dealer: d.dealerName,
    product: (d.product || "Tool") as ProductType,
    monthly_price: Number(d.monthlyPrice) || 0,
    setup_fee: Number(d.setupFee) || 0,
    term: (Number(d.term) || 1) as TermLength,
    rep_name: d.repName || "",
    rep_email: d.repEmail || "",
  };
}

export async function GET() {
  if (!isSupabaseServerConfigured()) {
    // Demo mode: use mock deals + any submitted demo deals
    const sheetDeals = await getAllRepDeals().catch(() => []);
    let mockConverted: Deal[] = [];

    if (sheetDeals.length > 0) {
      mockConverted = sheetDeals.map(sheetDealToDeal);
    } else {
      mockConverted = getMockDeals().map(sheetDealToDeal);
    }

    // Merge mock + submitted demo deals, dedup
    const seen = new Set<string>();
    const merged: Deal[] = [];
    for (const deal of demoDeals) {
      const key = `${deal.date}|${deal.dealer.toLowerCase()}|${deal.monthly_price}`;
      seen.add(key);
      merged.push(deal);
    }
    for (const deal of mockConverted) {
      const key = `${deal.date}|${deal.dealer.toLowerCase()}|${deal.monthly_price}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(deal);
      }
    }

    return NextResponse.json(merged);
  }

  // Fetch from both sources in parallel
  const [sheetDeals, supabaseResult] = await Promise.all([
    getAllRepDeals().catch(() => []),
    supabaseAdmin.from("deals").select("*").order("deal_date", { ascending: false }),
  ]);

  // Convert Supabase deals to Deal shape
  const sbDeals: Deal[] = (supabaseResult.data ?? []).map((d) => ({
    date: d.deal_date,
    client: d.client_name,
    dealer: d.dealer_name,
    product: d.product as ProductType,
    monthly_price: Number(d.monthly_price),
    setup_fee: Number(d.setup_fee),
    term: Number(d.term) as TermLength,
    rep_name: d.rep_name,
    rep_email: d.rep_email,
  }));

  // Convert sheet deals to Deal shape
  const convertedSheetDeals: Deal[] = sheetDeals.map(sheetDealToDeal);

  // Deduplicate: if same date + dealer + monthly_price, prefer Supabase version
  const seen = new Set<string>();
  const merged: Deal[] = [];

  for (const deal of sbDeals) {
    const key = `${deal.date}|${deal.dealer.toLowerCase()}|${deal.monthly_price}`;
    seen.add(key);
    merged.push(deal);
  }

  for (const deal of convertedSheetDeals) {
    const key = `${deal.date}|${deal.dealer.toLowerCase()}|${deal.monthly_price}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(deal);
    }
  }

  return NextResponse.json(merged);
}

// Export for use by submit route in demo mode
export { demoDeals };
