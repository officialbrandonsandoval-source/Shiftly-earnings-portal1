"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Deal,
  ProductType,
  CommissionResult,
} from "@/lib/types";
import { calculateCommission, getTierForMrr } from "@/lib/commission";
import { getPayStructureForEmail } from "@/lib/mock-data";
import Navbar from "@/components/Navbar";
import {
  formatCurrency,
  formatDate,
  getMonthKey,
  getMonthLabel,
  getCurrentMonthKey,
  getAvailableMonths,
  isFirstHalf,
  downloadCSV,
} from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import EarningsGraph from "@/components/EarningsGraph";

const PRODUCT_TYPES: ProductType[] = ["Tool", "Ads", "Bundle Tool", "Bundle Ads"];
const PIE_COLORS = ["#0066FF", "#2563EB", "#60a5fa", "#93c5fd"];
const TERM_LABELS: Record<number, string> = { 1: "1 mo", 3: "3 mo", 6: "6 mo", 12: "12 mo" };

interface DealWithCommission extends Deal {
  commission: CommissionResult;
}

interface ActivityLog {
  id: string;
  rep_email: string;
  rep_name: string;
  log_date: string;
  scheduled_calls: number;
  shown_calls: number;
  sold_deals: number;
  revenue_collected: number;
  no_shows: number;
}

export default function ManagerDashboard() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [ytdMode, setYtdMode] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("Earnings");
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    if (!loading && (!user || user.role !== "manager")) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || user.role !== "manager") {
      setFetchLoading(false);
      return;
    }
    async function fetchDeals() {
      try {
        const res = await fetch("/api/deals");
        const data = await res.json();
        const arr = Array.isArray(data) ? data : (Array.isArray(data?.deals) ? data.deals : []);
        setDeals(arr);
      } catch {
        setDeals([]);
      } finally {
        setFetchLoading(false);
      }
    }
    fetchDeals();
  }, [user]);

  // Fetch activity logs for manager (all reps)
  useEffect(() => {
    if (!user || user.role !== "manager") return;
    async function fetchActivity() {
      try {
        const res = await fetch("/api/activity?role=manager");
        const data = await res.json();
        if (Array.isArray(data)) setActivityLogs(data);
      } catch {
        setActivityLogs([]);
      }
    }
    fetchActivity();
  }, [user]);

  const availableMonths = useMemo(
    () => getAvailableMonths(deals.map((d) => d.date)),
    [deals]
  );

  const currentYear = selectedMonth.slice(0, 4);

  const filteredDeals = useMemo(() => {
    if (ytdMode) return deals.filter((d) => d.date.startsWith(currentYear));
    return deals.filter((d) => getMonthKey(d.date) === selectedMonth);
  }, [deals, selectedMonth, ytdMode, currentYear]);

  const repMonthlyMrr = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const deal of deals) {
      const mk = getMonthKey(deal.date);
      if (!map[deal.rep_email]) map[deal.rep_email] = {};
      map[deal.rep_email][mk] = (map[deal.rep_email][mk] ?? 0) + deal.monthly_price;
    }
    return map;
  }, [deals]);

  const dealsWithCommission: DealWithCommission[] = useMemo(() => {
    return filteredDeals.map((deal) => {
      const ps = getPayStructureForEmail(deal.rep_email);
      const mk = getMonthKey(deal.date);
      const repMrr = repMonthlyMrr[deal.rep_email]?.[mk] ?? 0;
      const commission = calculateCommission(deal, ps, repMrr);
      return { ...deal, commission };
    });
  }, [filteredDeals, repMonthlyMrr]);

  const summary = useMemo(() => {
    const totalMRR = dealsWithCommission.reduce((s, d) => s + d.monthly_price, 0);
    const totalSetup = dealsWithCommission.reduce((s, d) => s + d.setup_fee, 0);
    const totalCommission = dealsWithCommission.reduce((s, d) => s + d.commission.total, 0);
    return {
      totalMRR,
      totalSetup,
      totalRevenue: totalMRR + totalSetup,
      totalDeals: dealsWithCommission.length,
      totalCommission,
    };
  }, [dealsWithCommission]);

  const productBreakdown = useMemo(() => {
    const map: Record<string, { deals: number; mrr: number; setup: number; commission: number }> = {};
    for (const pt of PRODUCT_TYPES) map[pt] = { deals: 0, mrr: 0, setup: 0, commission: 0 };
    for (const d of dealsWithCommission) {
      const entry = map[d.product];
      if (entry) {
        entry.deals++;
        entry.mrr += d.monthly_price;
        entry.setup += d.setup_fee;
        entry.commission += d.commission.total;
      }
    }
    return PRODUCT_TYPES.map((pt) => ({
      product: pt,
      ...map[pt],
      totalRev: map[pt].mrr + map[pt].setup,
    }));
  }, [dealsWithCommission]);

  const productTotals = useMemo(() => {
    return productBreakdown.reduce(
      (acc, row) => ({
        deals: acc.deals + row.deals,
        mrr: acc.mrr + row.mrr,
        setup: acc.setup + row.setup,
        totalRev: acc.totalRev + row.totalRev,
        commission: acc.commission + row.commission,
      }),
      { deals: 0, mrr: 0, setup: 0, totalRev: 0, commission: 0 }
    );
  }, [productBreakdown]);

  const leaderboard = useMemo(() => {
    const repMap: Record<string, { name: string; email: string; commission: number; mrr: number; deals: number }> = {};
    for (const d of dealsWithCommission) {
      if (!repMap[d.rep_email]) {
        repMap[d.rep_email] = { name: d.rep_name, email: d.rep_email, commission: 0, mrr: 0, deals: 0 };
      }
      repMap[d.rep_email].commission += d.commission.total;
      repMap[d.rep_email].mrr += d.monthly_price;
      repMap[d.rep_email].deals++;
    }
    return Object.values(repMap)
      .sort((a, b) => b.commission - a.commission)
      .map((rep, i) => {
        const ps = getPayStructureForEmail(rep.email);
        const { tier } = getTierForMrr(rep.mrr, ps);
        return { rank: i + 1, ...rep, tier };
      });
  }, [dealsWithCommission]);

  const momData = useMemo(() => {
    const monthMap: Record<string, { mrr: number; deals: number }> = {};
    for (const deal of deals) {
      const mk = getMonthKey(deal.date);
      if (!monthMap[mk]) monthMap[mk] = { mrr: 0, deals: 0 };
      monthMap[mk].mrr += deal.monthly_price;
      monthMap[mk].deals++;
    }
    const allMonths = Object.keys(monthMap).sort();
    const last6 = allMonths.slice(-6);
    return last6.map((mk) => ({
      month: getMonthLabel(mk).replace(/\s\d{4}$/, (m) => ` '${m.trim().slice(2)}`),
      MRR: monthMap[mk].mrr,
      Deals: monthMap[mk].deals,
    }));
  }, [deals]);

  const termData = useMemo(() => {
    const termMap: Record<number, number> = { 1: 0, 3: 0, 6: 0, 12: 0 };
    for (const d of dealsWithCommission) {
      termMap[d.term] = (termMap[d.term] ?? 0) + 1;
    }
    const total = dealsWithCommission.length || 1;
    return [1, 3, 6, 12]
      .filter((t) => termMap[t] > 0)
      .map((t) => ({
        name: TERM_LABELS[t],
        value: termMap[t],
        pct: ((termMap[t] / total) * 100).toFixed(1),
      }));
  }, [dealsWithCommission]);

  // Deals split into front/back half
  const frontHalfDeals = useMemo(
    () => dealsWithCommission.filter((d) => isFirstHalf(d.date)).sort((a, b) => a.date.localeCompare(b.date)),
    [dealsWithCommission]
  );
  const backHalfDeals = useMemo(
    () => dealsWithCommission.filter((d) => !isFirstHalf(d.date)).sort((a, b) => a.date.localeCompare(b.date)),
    [dealsWithCommission]
  );

  async function handleSyncSheet() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/deals/sync-sheet", { method: "POST" });
      if (res.headers.get("Content-Type")?.includes("text/csv")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "deals-sync.csv";
        a.click();
        URL.revokeObjectURL(url);
        const text = await blob.text();
        const count = text.trim().split("\n").length - 1;
        setSyncMessage(`${count} deal${count !== 1 ? "s" : ""} synced`);
      } else {
        const data = await res.json();
        setSyncMessage(data.message || data.error || "No deals to sync");
      }
    } catch {
      setSyncMessage("Sync failed");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  }

  function handleExportCSV() {
    const headers = [
      "Date", "Client", "Dealer", "Product", "Monthly Price", "Setup Fee",
      "Term", "Rep Name", "Rep Email", "MRR Commission", "Setup Commission", "Total Commission",
    ];
    const rows = dealsWithCommission.map((d) => [
      d.date, d.client, d.dealer, d.product,
      d.monthly_price.toFixed(2), d.setup_fee.toFixed(2), String(d.term),
      d.rep_name, d.rep_email,
      d.commission.mrrCommission.toFixed(2), d.commission.setupCommission.toFixed(2),
      d.commission.total.toFixed(2),
    ]);
    const label = ytdMode ? `YTD-${currentYear}` : selectedMonth;
    downloadCSV(`shiftly-team-${label}.csv`, headers, rows);
  }

  function TierBadge({ tier }: { tier: "Base" | "Tier 1" | "Tier 2" }) {
    const styles: Record<string, string> = {
      Base: "bg-[#F3F4F6] text-[#6B7280]",
      "Tier 1": "bg-[#0066FF] text-white",
      "Tier 2": "bg-[#10B981] text-white",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[tier]}`}>
        {tier}
      </span>
    );
  }

  const getCommission = useCallback(
    (deal: Deal) => {
      const ps = getPayStructureForEmail(deal.rep_email);
      const mk = getMonthKey(deal.date);
      const repMrr = repMonthlyMrr[deal.rep_email]?.[mk] ?? 0;
      return calculateCommission(deal, ps, repMrr).total;
    },
    [repMonthlyMrr]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#6B7280] text-lg">Loading...</div>
      </div>
    );
  }

  if (!user || user.role !== "manager") return null;

  return (
    <div className="min-h-screen bg-white text-[#1F2937]">
      {/* Sync toast */}
      {syncMessage && (
        <div className="fixed bottom-8 right-8 z-50 bg-[#10B981] text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium">
          {syncMessage}
        </div>
      )}
      <Navbar
        userName={user.name}
        userRole="Manager"
        onLogout={logout}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Top Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={selectedMonth}
            onChange={(e) => { setSelectedMonth(e.target.value); setYtdMode(false); }}
            className="bg-white border border-[#E5E7EB] text-[#1F2937] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
          >
            {availableMonths.map((mk) => (
              <option key={mk} value={mk}>{getMonthLabel(mk)}</option>
            ))}
          </select>
          <button
            onClick={() => setYtdMode(!ytdMode)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              ytdMode
                ? "bg-[#0066FF] text-white"
                : "bg-white border border-[#E5E7EB] text-[#6B7280] hover:text-[#1F2937]"
            }`}
          >
            Year to Date
          </button>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard/admin")}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors"
            >
              Manage Users
            </button>
            {activeTab === "Earnings" && (
              <>
                <button
                  onClick={handleSyncSheet}
                  disabled={syncing}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-[#10B981] hover:bg-[#059669] text-white transition-colors disabled:opacity-50"
                >
                  {syncing ? "Syncing..." : "Sync to Sheet"}
                </button>
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-[#0066FF] hover:bg-[#2563EB] text-white transition-colors"
                >
                  Export CSV
                </button>
              </>
            )}
            {activeTab === "Deals" && (
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#0066FF] hover:bg-[#2563EB] text-white transition-colors"
              >
                Export CSV
              </button>
            )}
          </div>
        </div>

        {/* ===== EARNINGS TAB ===== */}
        {activeTab === "Earnings" && (
          <>
            {fetchLoading ? (
              <div className="rounded-xl bg-white border border-[#E5E7EB] p-12 text-center">
                <p className="text-[#6B7280] text-sm">Loading earnings data...</p>
              </div>
            ) : (
            <>
            {/* Earnings Graph */}
            <EarningsGraph deals={filteredDeals} getCommission={getCommission} />

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { label: "Total MRR Sold", value: formatCurrency(summary.totalMRR) },
                { label: "Total Setup Fees", value: formatCurrency(summary.totalSetup) },
                { label: "Total Revenue", value: formatCurrency(summary.totalRevenue) },
                { label: "Total Deals Closed", value: String(summary.totalDeals) },
                { label: "Commission Paid Out", value: formatCurrency(summary.totalCommission) },
              ].map((card) => (
                <div
                  key={card.label}
                  className="bg-white border border-[#E5E7EB] border-l-[3px] border-l-[#0066FF] rounded-xl p-5"
                >
                  <p className="text-[#6B7280] text-xs font-medium uppercase tracking-wider mb-1">
                    {card.label}
                  </p>
                  <p className="text-2xl font-bold text-[#1F2937]">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Product Breakdown */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E5E7EB]">
                <h2 className="text-lg font-semibold text-[#1F2937]">Product Breakdown</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280] text-xs uppercase tracking-wider">
                      <th className="text-left px-5 py-3">Product</th>
                      <th className="text-right px-5 py-3"># Deals</th>
                      <th className="text-right px-5 py-3">MRR</th>
                      <th className="text-right px-5 py-3">Setup</th>
                      <th className="text-right px-5 py-3">Total Rev</th>
                      <th className="text-right px-5 py-3">Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productBreakdown.map((row, i) => (
                      <tr
                        key={row.product}
                        className={`border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors ${
                          i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"
                        }`}
                      >
                        <td className="px-5 py-3 font-medium text-[#1F2937]">{row.product}</td>
                        <td className="px-5 py-3 text-right text-[#6B7280]">{row.deals}</td>
                        <td className="px-5 py-3 text-right text-[#6B7280]">{formatCurrency(row.mrr)}</td>
                        <td className="px-5 py-3 text-right text-[#6B7280]">{formatCurrency(row.setup)}</td>
                        <td className="px-5 py-3 text-right text-[#6B7280]">{formatCurrency(row.totalRev)}</td>
                        <td className="px-5 py-3 text-right text-[#6B7280]">{formatCurrency(row.commission)}</td>
                      </tr>
                    ))}
                    <tr className="bg-[#F9FAFB] font-semibold">
                      <td className="px-5 py-3 text-[#1F2937]">TOTAL</td>
                      <td className="px-5 py-3 text-right text-[#1F2937]">{productTotals.deals}</td>
                      <td className="px-5 py-3 text-right text-[#1F2937]">{formatCurrency(productTotals.mrr)}</td>
                      <td className="px-5 py-3 text-right text-[#1F2937]">{formatCurrency(productTotals.setup)}</td>
                      <td className="px-5 py-3 text-right text-[#1F2937]">{formatCurrency(productTotals.totalRev)}</td>
                      <td className="px-5 py-3 text-right text-[#1F2937]">{formatCurrency(productTotals.commission)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rep Leaderboard */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E5E7EB]">
                <h2 className="text-lg font-semibold text-[#1F2937]">Rep Leaderboard</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280] text-xs uppercase tracking-wider">
                      <th className="text-left px-5 py-3">Rank</th>
                      <th className="text-left px-5 py-3">Name</th>
                      <th className="text-right px-5 py-3">Commission</th>
                      <th className="text-right px-5 py-3">MRR Sold</th>
                      <th className="text-right px-5 py-3">Deals</th>
                      <th className="text-center px-5 py-3">Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((rep, i) => (
                      <tr
                        key={rep.email}
                        className={`border-b border-[#E5E7EB]/50 hover:bg-[#F9FAFB] transition-colors ${
                          i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"
                        }`}
                      >
                        <td className="px-5 py-3 font-medium text-[#6B7280]">#{rep.rank}</td>
                        <td className="px-5 py-3 font-medium text-[#1F2937]">{rep.name}</td>
                        <td className="px-5 py-3 text-right text-[#10B981] font-semibold">
                          {formatCurrency(rep.commission)}
                        </td>
                        <td className="px-5 py-3 text-right text-[#6B7280]">{formatCurrency(rep.mrr)}</td>
                        <td className="px-5 py-3 text-right text-[#6B7280]">{rep.deals}</td>
                        <td className="px-5 py-3 text-center">
                          <TierBadge tier={rep.tier} />
                        </td>
                      </tr>
                    ))}
                    {leaderboard.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-[#6B7280]">
                          No deals found for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
                <h2 className="text-lg font-semibold text-[#1F2937] mb-4">Month-over-Month</h2>
                {momData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={momData}>
                      <XAxis
                        dataKey="month"
                        tick={{ fill: "#6B7280", fontSize: 12 }}
                        axisLine={{ stroke: "#E5E7EB" }}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="mrr"
                        orientation="left"
                        tick={{ fill: "#6B7280", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <YAxis
                        yAxisId="deals"
                        orientation="right"
                        tick={{ fill: "#6B7280", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#FFFFFF",
                          border: "1px solid #E5E7EB",
                          borderRadius: "8px",
                          color: "#1F2937",
                        }}
                        formatter={((value: number, name: string) =>
                          name === "MRR" ? [formatCurrency(Number(value)), name] : [value, name]
                        ) as never}
                      />
                      <Bar yAxisId="mrr" dataKey="MRR" fill="#0066FF" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="deals" dataKey="Deals" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-[#6B7280]">
                    No data available
                  </div>
                )}
              </div>

              <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
                <h2 className="text-lg font-semibold text-[#1F2937] mb-4">Term Breakdown</h2>
                {termData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={termData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={3}
                        dataKey="value"
                        label={((props: { name: string; pct: string }) => `${props.name} (${props.pct}%)`) as never}
                      >
                        {termData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#FFFFFF",
                          border: "1px solid #E5E7EB",
                          borderRadius: "8px",
                          color: "#1F2937",
                        }}
                        formatter={((value: number) => [`${value} deals`, "Count"]) as never}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-[#6B7280]">
                    No data available
                  </div>
                )}
              </div>
            </div>
          </>
            )}
          </>
        )}

        {/* ===== DEALS TAB ===== */}
        {activeTab === "Deals" && (
          <>
            {fetchLoading ? (
              <div className="rounded-xl bg-white border border-[#E5E7EB] p-12 text-center">
                <p className="text-[#6B7280] text-sm">Loading deals...</p>
              </div>
            ) : dealsWithCommission.length === 0 ? (
              <div className="rounded-xl bg-white border border-[#E5E7EB] p-12 text-center">
                <p className="text-[#6B7280] text-sm">No deals found for this period. Reps can submit deals from their dashboard, or connect a Google Sheet in Manage Users.</p>
              </div>
            ) : (
              <>
                {/* Front Half */}
                {frontHalfDeals.length > 0 && (
                  <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-[#E5E7EB]">
                      <h2 className="text-lg font-semibold text-[#1F2937]">Front of Month (1st-15th)</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280] text-xs uppercase tracking-wider">
                            <th className="text-left px-5 py-3">Date</th>
                            <th className="text-left px-5 py-3">Rep</th>
                            <th className="text-left px-5 py-3">Client</th>
                            <th className="text-left px-5 py-3">Dealer</th>
                            <th className="text-left px-5 py-3">Product</th>
                            <th className="text-right px-5 py-3">MRR</th>
                            <th className="text-right px-5 py-3">Setup</th>
                            <th className="text-right px-5 py-3">Term</th>
                            <th className="text-right px-5 py-3">Commission</th>
                          </tr>
                        </thead>
                        <tbody>
                          {frontHalfDeals.map((deal, i) => (
                            <tr key={`f-${i}`} className={`border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}`}>
                              <td className="px-5 py-3 text-[#6B7280]">{formatDate(deal.date)}</td>
                              <td className="px-5 py-3 font-medium text-[#1F2937]">{deal.rep_name}</td>
                              <td className="px-5 py-3 text-[#6B7280]">{deal.client}</td>
                              <td className="px-5 py-3 text-[#6B7280]">{deal.dealer}</td>
                              <td className="px-5 py-3 text-[#6B7280]">{deal.product}</td>
                              <td className="px-5 py-3 text-right text-[#6B7280]">{formatCurrency(deal.monthly_price)}</td>
                              <td className="px-5 py-3 text-right text-[#6B7280]">{formatCurrency(deal.setup_fee)}</td>
                              <td className="px-5 py-3 text-right text-[#6B7280]">{deal.term} mo</td>
                              <td className="px-5 py-3 text-right text-[#10B981] font-semibold">{formatCurrency(deal.commission.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Back Half */}
                {backHalfDeals.length > 0 && (
                  <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-[#E5E7EB]">
                      <h2 className="text-lg font-semibold text-[#1F2937]">Back of Month (16th-End)</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280] text-xs uppercase tracking-wider">
                            <th className="text-left px-5 py-3">Date</th>
                            <th className="text-left px-5 py-3">Rep</th>
                            <th className="text-left px-5 py-3">Client</th>
                            <th className="text-left px-5 py-3">Dealer</th>
                            <th className="text-left px-5 py-3">Product</th>
                            <th className="text-right px-5 py-3">MRR</th>
                            <th className="text-right px-5 py-3">Setup</th>
                            <th className="text-right px-5 py-3">Term</th>
                            <th className="text-right px-5 py-3">Commission</th>
                          </tr>
                        </thead>
                        <tbody>
                          {backHalfDeals.map((deal, i) => (
                            <tr key={`b-${i}`} className={`border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}`}>
                              <td className="px-5 py-3 text-[#6B7280]">{formatDate(deal.date)}</td>
                              <td className="px-5 py-3 font-medium text-[#1F2937]">{deal.rep_name}</td>
                              <td className="px-5 py-3 text-[#6B7280]">{deal.client}</td>
                              <td className="px-5 py-3 text-[#6B7280]">{deal.dealer}</td>
                              <td className="px-5 py-3 text-[#6B7280]">{deal.product}</td>
                              <td className="px-5 py-3 text-right text-[#6B7280]">{formatCurrency(deal.monthly_price)}</td>
                              <td className="px-5 py-3 text-right text-[#6B7280]">{formatCurrency(deal.setup_fee)}</td>
                              <td className="px-5 py-3 text-right text-[#6B7280]">{deal.term} mo</td>
                              <td className="px-5 py-3 text-right text-[#10B981] font-semibold">{formatCurrency(deal.commission.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ===== ACTIVITY LOG TAB ===== */}
        {activeTab === "Activity Log" && (
          <>
            {activityLogs.length === 0 ? (
              <div className="rounded-xl bg-white border border-[#E5E7EB] p-12 text-center">
                <p className="text-[#6B7280] text-sm">No activity logged yet. Reps can log daily activity from their dashboard.</p>
              </div>
            ) : (
              <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#E5E7EB]">
                  <h2 className="text-lg font-semibold text-[#1F2937]">Team Activity Log</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280] text-xs uppercase tracking-wider">
                        <th className="text-left px-5 py-3">Date</th>
                        <th className="text-left px-5 py-3">Rep</th>
                        <th className="text-right px-5 py-3">Scheduled</th>
                        <th className="text-right px-5 py-3">Shown</th>
                        <th className="text-right px-5 py-3">Sold</th>
                        <th className="text-right px-5 py-3">Revenue</th>
                        <th className="text-right px-5 py-3">No Shows</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityLogs.map((log, i) => (
                        <tr key={log.id} className={`border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}`}>
                          <td className="px-5 py-3 text-[#6B7280]">{formatDate(log.log_date)}</td>
                          <td className="px-5 py-3 font-medium text-[#1F2937]">{log.rep_name}</td>
                          <td className="px-5 py-3 text-right text-[#1F2937]">{log.scheduled_calls}</td>
                          <td className="px-5 py-3 text-right text-[#1F2937]">{log.shown_calls}</td>
                          <td className="px-5 py-3 text-right text-[#1F2937]">{log.sold_deals}</td>
                          <td className="px-5 py-3 text-right text-[#1F2937]">{formatCurrency(log.revenue_collected)}</td>
                          <td className="px-5 py-3 text-right text-[#1F2937]">{log.no_shows}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
