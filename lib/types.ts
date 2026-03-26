export type UserRole = "manager" | "rep";

export type ProductType = "Tool" | "Ads" | "Bundle Tool" | "Bundle Ads";

export type TermLength = 1 | 3 | 6 | 12;

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  pay_structure_id: string | null;
}

export interface PayStructure {
  id: string;
  name: string;
  mrr_rate_tool: number;
  mrr_rate_ads: number;
  mrr_rate_bundle_tool: number;
  mrr_rate_bundle_ads: number;
  setup_rate_tool: number;
  setup_rate_ads: number;
  setup_rate_bundle_tool: number;
  setup_rate_bundle_ads: number;
  tier1_threshold: number | null;
  tier1_bonus_rate: number | null;
  tier2_threshold: number | null;
  tier2_bonus_rate: number | null;
  term_multipliers: Record<string, number>;
}

export interface Deal {
  date: string; // YYYY-MM-DD
  client: string;
  dealer: string;
  product: ProductType;
  monthly_price: number;
  setup_fee: number;
  term: TermLength;
  rep_name: string;
  rep_email: string;
}

export interface CommissionResult {
  mrrCommission: number;
  setupCommission: number;
  termMultiplier: number;
  tierBonus: number;
  total: number;
  breakdown: string;
}

export interface MonthlyStats {
  totalMRR: number;
  totalSetup: number;
  totalRevenue: number;
  totalDeals: number;
  totalCommission: number;
}

export interface ProductBreakdown {
  product: ProductType;
  deals: number;
  mrr: number;
  setup: number;
  totalRev: number;
  commission: number;
}

export interface RepLeaderboardEntry {
  rank: number;
  name: string;
  email: string;
  commission: number;
  mrrSold: number;
  dealCount: number;
  tier: "Base" | "Tier 1" | "Tier 2";
}
