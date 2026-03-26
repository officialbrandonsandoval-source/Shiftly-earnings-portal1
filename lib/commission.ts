import { Deal, PayStructure, CommissionResult, ProductType } from "./types";

function getMrrRate(product: ProductType, ps: PayStructure): number {
  switch (product) {
    case "Tool": return Number(ps.mrr_rate_tool);
    case "Ads": return Number(ps.mrr_rate_ads);
    case "Bundle Tool": return Number(ps.mrr_rate_bundle_tool);
    case "Bundle Ads": return Number(ps.mrr_rate_bundle_ads);
  }
}

function getSetupRate(product: ProductType, ps: PayStructure): number {
  switch (product) {
    case "Tool": return Number(ps.setup_rate_tool);
    case "Ads": return Number(ps.setup_rate_ads);
    case "Bundle Tool": return Number(ps.setup_rate_bundle_tool);
    case "Bundle Ads": return Number(ps.setup_rate_bundle_ads);
  }
}

export function calculateCommission(
  deal: Deal,
  payStructure: PayStructure,
  totalMrrThisMonth: number = 0
): CommissionResult {
  const mrrRate = getMrrRate(deal.product, payStructure);
  const setupRate = getSetupRate(deal.product, payStructure);
  const termKey = String(deal.term);
  const termMultiplier = payStructure.term_multipliers[termKey] ?? 1;

  const mrrCommission = deal.monthly_price * mrrRate * termMultiplier;
  const setupCommission = deal.setup_fee * setupRate;

  // Tier bonus on MRR commission
  let tierBonus = 0;
  let tierLabel = "";
  const t1 = payStructure.tier1_threshold ? Number(payStructure.tier1_threshold) : null;
  const t1Rate = payStructure.tier1_bonus_rate ? Number(payStructure.tier1_bonus_rate) : 0;
  const t2 = payStructure.tier2_threshold ? Number(payStructure.tier2_threshold) : null;
  const t2Rate = payStructure.tier2_bonus_rate ? Number(payStructure.tier2_bonus_rate) : 0;

  if (t2 && totalMrrThisMonth >= t2) {
    tierBonus = deal.monthly_price * t2Rate * termMultiplier;
    tierLabel = `+${(t2Rate * 100).toFixed(0)}% tier 2 bonus`;
  } else if (t1 && totalMrrThisMonth >= t1) {
    tierBonus = deal.monthly_price * t1Rate * termMultiplier;
    tierLabel = `+${(t1Rate * 100).toFixed(0)}% tier 1 bonus`;
  }

  const total = mrrCommission + setupCommission + tierBonus;

  const mrrPct = (mrrRate * 100).toFixed(0);
  const setupPct = (setupRate * 100).toFixed(0);
  let breakdown = `${mrrPct}% MRR`;
  if (termMultiplier > 1) breakdown += ` × ${termMultiplier}x (${deal.term}mo term)`;
  if (tierLabel) breakdown += ` ${tierLabel}`;
  breakdown += ` + ${setupPct}% setup = $${total.toFixed(2)}`;

  return {
    mrrCommission,
    setupCommission,
    termMultiplier,
    tierBonus,
    total,
    breakdown,
  };
}

export function getTierForMrr(
  totalMrr: number,
  ps: PayStructure
): { tier: "Base" | "Tier 1" | "Tier 2"; nextTier: string | null; amountToNext: number } {
  const t1 = ps.tier1_threshold ? Number(ps.tier1_threshold) : null;
  const t2 = ps.tier2_threshold ? Number(ps.tier2_threshold) : null;

  if (t2 && totalMrr >= t2) {
    return { tier: "Tier 2", nextTier: null, amountToNext: 0 };
  }
  if (t1 && totalMrr >= t1) {
    const amountToNext = t2 ? t2 - totalMrr : 0;
    return { tier: "Tier 1", nextTier: t2 ? "Tier 2" : null, amountToNext };
  }
  const firstThreshold = t1 ?? t2;
  const firstName = t1 ? "Tier 1" : t2 ? "Tier 2" : null;
  return {
    tier: "Base",
    nextTier: firstName,
    amountToNext: firstThreshold ? firstThreshold - totalMrr : 0,
  };
}
