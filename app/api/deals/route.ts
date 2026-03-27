import { NextResponse } from "next/server";
import { getAllRepDeals, getMockDeals, getSheetDealsByUrl } from "@/lib/sheets";
import type { SheetDeal } from "@/lib/sheets";
import { supabaseAdmin, isSupabaseServerConfigured } from "@/lib/supabase-server";
import type { Deal, ProductType, TermLength } from "@/lib/types";

// In-memory store for demo mode deals (persists per server process)
const demoDeals: Deal[] = [];

function sheetDealToDeal(d: SheetDeal): Deal {
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

async function fetchSheetDealsFromDB(): Promise<SheetDeal[]> {
  try {
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("email, name, sheet_tab, role")
      .eq("role", "rep");

    if (error || !users || users.length === 0) {
      return [];
    }

    const repsWithTabs = users.filter((u: { sheet_tab: string | null }) => u.sheet_tab);
    if (repsWithTabs.length === 0) return [];

    const results = await Promise.allSettled(
      repsWithTabs.map(async (rep: { email: string; name: string; sheet_tab: string }) => {
        const deals = await getSheetDealsByUrl(rep.sheet_tab);
        return deals.map(d => ({ ...d, repEmail: rep.email, repName: rep.name } as SheetDeal));
      })
    );

    return results
      .filter((r): r is PromiseFulfilledResult<SheetDeal[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    if (!isSupabaseServerConfigured()) {
      // Demo mode
      const sheetDeals = await getAllRepDeals().catch(() => []);
      const mockConverted = sheetDeals.length > 0
        ? sheetDeals.map(sheetDealToDeal)
        : getMockDeals().map(sheetDealToDeal);

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

    // Production: fetch from Supabase deals table + Google Sheets in parallel
    // Each source is independently try/caught so one failing doesn't break the other
    const [sheetDeals, supabaseResult] = await Promise.all([
      fetchSheetDealsFromDB().catch(() => [] as SheetDeal[]),
      supabaseAdmin.from("deals").select("*").order("deal_date", { ascending: false }).then(
        (res) => res,
        () => ({ data: null, error: { message: "fetch failed" } })
      ),
    ]);

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

    const convertedSheetDeals: Deal[] = sheetDeals.map(sheetDealToDeal);

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
  } catch (err) {
    console.error("Deals API error:", err);
    return NextResponse.json([]);
  }
}

export { demoDeals };
