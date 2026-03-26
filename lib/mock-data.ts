import { PayStructure } from "./types";

export const MOCK_PAY_STRUCTURES: PayStructure[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Standard",
    mrr_rate_tool: 0.13,
    mrr_rate_ads: 0.13,
    mrr_rate_bundle_tool: 0.16,
    mrr_rate_bundle_ads: 0.16,
    setup_rate_tool: 0.25,
    setup_rate_ads: 0.25,
    setup_rate_bundle_tool: 0.30,
    setup_rate_bundle_ads: 0.30,
    tier1_threshold: 30000,
    tier1_bonus_rate: 0.03,
    tier2_threshold: 40000,
    tier2_bonus_rate: 0.05,
    term_multipliers: { "1": 1, "3": 2, "6": 4, "12": 7 },
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "JR Custom",
    mrr_rate_tool: 0.15,
    mrr_rate_ads: 0.15,
    mrr_rate_bundle_tool: 0.15,
    mrr_rate_bundle_ads: 0.15,
    setup_rate_tool: 0.50,
    setup_rate_ads: 0.50,
    setup_rate_bundle_tool: 0.50,
    setup_rate_bundle_ads: 0.50,
    tier1_threshold: null,
    tier1_bonus_rate: null,
    tier2_threshold: 40000,
    tier2_bonus_rate: 0.20,
    term_multipliers: { "1": 1, "3": 2, "6": 4, "12": 7 },
  },
];

export function getPayStructureForEmail(email: string): PayStructure {
  if (email === "jr@shiftlyauto.com") return MOCK_PAY_STRUCTURES[1];
  return MOCK_PAY_STRUCTURES[0];
}
