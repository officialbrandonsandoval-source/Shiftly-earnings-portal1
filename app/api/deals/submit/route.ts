import { NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseServerConfigured } from "@/lib/supabase-server";
import { getPayStructureForEmail } from "@/lib/mock-data";
import { calculateCommission } from "@/lib/commission";
import type { ProductType, TermLength } from "@/lib/types";
import { demoDeals } from "../route";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      rep_email,
      rep_name,
      deal_date,
      dealer_name,
      client_name,
      product,
      monthly_price,
      setup_fee,
      term,
    } = body;

    if (!rep_email || !rep_name || !deal_date || !dealer_name || !client_name || !product) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Auto-detect half
    const day = parseInt(deal_date.split("-")[2]);
    const half = day <= 15 ? "front" : "back";

    const dealData = {
      rep_email,
      rep_name,
      deal_date,
      dealer_name,
      client_name,
      product,
      monthly_price: Number(monthly_price),
      setup_fee: Number(setup_fee),
      term: Number(term),
      half,
      synced_to_sheet: false,
    };

    let savedDeal = dealData;

    if (isSupabaseServerConfigured()) {
      const { data, error } = await supabaseAdmin
        .from("deals")
        .insert(dealData)
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      savedDeal = data;
    } else {
      // Demo mode: store in memory
      demoDeals.push({
        date: deal_date,
        client: client_name,
        dealer: dealer_name,
        product: product as ProductType,
        monthly_price: Number(monthly_price),
        setup_fee: Number(setup_fee),
        term: Number(term) as TermLength,
        rep_name,
        rep_email,
      });
    }

    // Calculate commission for the response
    const ps = getPayStructureForEmail(rep_email);
    const commission = calculateCommission(
      {
        date: deal_date,
        client: client_name,
        dealer: dealer_name,
        product: product as ProductType,
        monthly_price: Number(monthly_price),
        setup_fee: Number(setup_fee),
        term: Number(term) as TermLength,
        rep_name,
        rep_email,
      },
      ps,
      0 // simplified — tier bonus not calculated here
    );

    return NextResponse.json({ deal: savedDeal, commission });
  } catch (err) {
    console.error("Deal submit error:", err);
    return NextResponse.json({ error: "Failed to submit deal" }, { status: 500 });
  }
}
