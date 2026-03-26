"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Deal, PayStructure, CommissionResult, ProductType, TermLength } from "@/lib/types";
import { calculateCommission, getTierForMrr } from "@/lib/commission";
import { getPayStructureForEmail } from "@/lib/mock-data";
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
import EarningsGraph from "@/components/EarningsGraph";
import Navbar from "@/components/Navbar";

interface ActivityLog {
  id: string;
  log_date: string;
  scheduled_calls: number;
  shown_calls: number;
  sold_deals: number;
  revenue_collected: number;
  no_shows: number;
}

export default function RepDashboard() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [showYTD, setShowYTD] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [tierToast, setTierToast] = useState<string | null>(null);

  // Deal entry modal state
  const [showDealModal, setShowDealModal] = useState(false);
  const [dealForm, setDealForm] = useState({
    deal_date: new Date().toISOString().slice(0, 10),
    dealer_name: "",
    client_name: "",
    product: "Tool" as ProductType,
    monthly_price: "",
    setup_fee: "",
    term: "1" as string,
  });
  const [dealSubmitting, setDealSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Activity log state
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [showActivity, setShowActivity] = useState(false);
  const [activityForm, setActivityForm] = useState({
    log_date: new Date().toISOString().slice(0, 10),
    scheduled_calls: "",
    shown_calls: "",
    sold_deals: "",
    revenue_collected: "",
    no_shows: "",
  });
  const [activitySubmitting, setActivitySubmitting] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== "rep")) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  const fetchDeals = useCallback(async () => {
    try {
      const res = await fetch("/api/deals");
      if (res.ok) {
        const data: Deal[] = await res.json();
        setDeals(data);
      }
    } catch (err) {
      console.error("Failed to fetch deals:", err);
    } finally {
      setFetchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchDeals();
  }, [user, fetchDeals]);

  // Fetch activity logs
  useEffect(() => {
    if (!user) return;
    fetch(`/api/activity?email=${encodeURIComponent(user.email)}&role=rep`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setActivityLogs(data); })
      .catch(() => {});
  }, [user]);

  const myDeals = useMemo(() => {
    if (!user) return [];
    return deals.filter(
      (d) => d.rep_email.toLowerCase() === user.email.toLowerCase()
    );
  }, [deals, user]);

  const payStructure = useMemo<PayStructure | null>(() => {
    if (!user) return null;
    return getPayStructureForEmail(user.email);
  }, [user]);

  const availableMonths = useMemo(() => {
    return getAvailableMonths(myDeals.map((d) => d.date));
  }, [myDeals]);

  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  const periodDeals = useMemo(() => {
    if (showYTD) {
      const year = selectedMonth.slice(0, 4);
      return myDeals.filter((d) => d.date.startsWith(year));
    }
    return myDeals.filter((d) => getMonthKey(d.date) === selectedMonth);
  }, [myDeals, selectedMonth, showYTD]);

  const repMonthlyMrr = useMemo(() => {
    const monthDeals = myDeals.filter(
      (d) => getMonthKey(d.date) === selectedMonth
    );
    return monthDeals.reduce((sum, d) => sum + d.monthly_price, 0);
  }, [myDeals, selectedMonth]);

  const dealCommissions = useMemo(() => {
    if (!payStructure) return new Map<string, CommissionResult>();
    const map = new Map<string, CommissionResult>();
    periodDeals.forEach((deal) => {
      const monthMrr = myDeals
        .filter((d) => getMonthKey(d.date) === getMonthKey(deal.date))
        .reduce((sum, d) => sum + d.monthly_price, 0);
      const key = `${deal.date}-${deal.client}-${deal.dealer}`;
      map.set(key, calculateCommission(deal, payStructure, monthMrr));
    });
    return map;
  }, [periodDeals, payStructure, myDeals]);

  const stats = useMemo(() => {
    let totalMrr = 0;
    let totalSetup = 0;
    let totalCommission = 0;
    periodDeals.forEach((deal) => {
      totalMrr += deal.monthly_price;
      totalSetup += deal.setup_fee;
      const key = `${deal.date}-${deal.client}-${deal.dealer}`;
      const comm = dealCommissions.get(key);
      if (comm) totalCommission += comm.total;
    });
    return { totalMrr, totalSetup, totalCommission, dealCount: periodDeals.length };
  }, [periodDeals, dealCommissions]);

  const tierInfo = useMemo(() => {
    if (!payStructure) return null;
    return getTierForMrr(repMonthlyMrr, payStructure);
  }, [repMonthlyMrr, payStructure]);

  useEffect(() => {
    if (!tierInfo || !payStructure) return;
    const monthKey = getCurrentMonthKey();
    const storageKey = `shiftly_tier_shown_${monthKey}`;
    if (localStorage.getItem(storageKey)) return;

    if (tierInfo.tier === "Tier 1" || tierInfo.tier === "Tier 2") {
      setTierToast(
        tierInfo.tier === "Tier 2"
          ? `You hit Tier 2 this month! +${((payStructure.tier2_bonus_rate ?? 0) * 100).toFixed(0)}% bonus on all deals!`
          : `You hit Tier 1 this month! +${((payStructure.tier1_bonus_rate ?? 0) * 100).toFixed(0)}% bonus on all deals!`
      );
      localStorage.setItem(storageKey, "true");
    }
  }, [tierInfo, payStructure]);

  // Live commission preview for deal form
  const dealPreview = useMemo(() => {
    if (!payStructure || !dealForm.monthly_price) return null;
    const price = Number(dealForm.monthly_price) || 0;
    const setup = Number(dealForm.setup_fee) || 0;
    const term = Number(dealForm.term) as TermLength;
    const fakeDeal: Deal = {
      date: dealForm.deal_date,
      client: dealForm.client_name,
      dealer: dealForm.dealer_name,
      product: dealForm.product,
      monthly_price: price,
      setup_fee: setup,
      term,
      rep_name: user?.name ?? "",
      rep_email: user?.email ?? "",
    };
    return calculateCommission(fakeDeal, payStructure, 0);
  }, [payStructure, dealForm, user]);

  // Half auto-detection
  const dealHalf = useMemo(() => {
    const day = parseInt(dealForm.deal_date.split("-")[2] || "1");
    return day <= 15 ? "Front" : "Back";
  }, [dealForm.deal_date]);

  async function handleDealSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || dealSubmitting) return;
    setDealSubmitting(true);
    try {
      const res = await fetch("/api/deals/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rep_email: user.email,
          rep_name: user.name,
          deal_date: dealForm.deal_date,
          dealer_name: dealForm.dealer_name,
          client_name: dealForm.client_name,
          product: dealForm.product,
          monthly_price: Number(dealForm.monthly_price),
          setup_fee: Number(dealForm.setup_fee) || 0,
          term: Number(dealForm.term),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowDealModal(false);
        const earned = data.commission?.total ?? 0;
        setToast(`Deal logged! You earned ${formatCurrency(earned)} in commission`);
        setTimeout(() => setToast(null), 4000);
        setDealForm({
          deal_date: new Date().toISOString().slice(0, 10),
          dealer_name: "",
          client_name: "",
          product: "Tool",
          monthly_price: "",
          setup_fee: "",
          term: "1",
        });
        fetchDeals();
      } else {
        setToast(`Error: ${data.error}`);
        setTimeout(() => setToast(null), 4000);
      }
    } catch {
      setToast("Failed to submit deal");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setDealSubmitting(false);
    }
  }

  async function handleActivitySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || activitySubmitting) return;
    setActivitySubmitting(true);
    try {
      const res = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rep_email: user.email,
          rep_name: user.name,
          log_date: activityForm.log_date,
          scheduled_calls: Number(activityForm.scheduled_calls) || 0,
          shown_calls: Number(activityForm.shown_calls) || 0,
          sold_deals: Number(activityForm.sold_deals) || 0,
          revenue_collected: Number(activityForm.revenue_collected) || 0,
          no_shows: Number(activityForm.no_shows) || 0,
        }),
      });
      if (res.ok) {
        const entry = await res.json();
        setActivityLogs((prev) => [entry, ...prev]);
        setActivityForm({
          log_date: new Date().toISOString().slice(0, 10),
          scheduled_calls: "",
          shown_calls: "",
          sold_deals: "",
          revenue_collected: "",
          no_shows: "",
        });
        setToast("Activity logged!");
        setTimeout(() => setToast(null), 3000);
      }
    } catch {
      setToast("Failed to log activity");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setActivitySubmitting(false);
    }
  }

  // This week's activity
  const thisWeekActivity = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    const mondayStr = monday.toISOString().slice(0, 10);
    return activityLogs.filter((l) => l.log_date >= mondayStr);
  }, [activityLogs]);

  const firstHalfDeals = useMemo(
    () => periodDeals.filter((d) => isFirstHalf(d.date)).sort((a, b) => a.date.localeCompare(b.date)),
    [periodDeals]
  );
  const backHalfDeals = useMemo(
    () => periodDeals.filter((d) => !isFirstHalf(d.date)).sort((a, b) => a.date.localeCompare(b.date)),
    [periodDeals]
  );

  function toggleRow(key: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleExportCSV() {
    const headers = [
      "Date", "Client", "Dealer", "Product", "Monthly Price",
      "Setup Fee", "Term", "MRR Commission", "Setup Commission", "Total Commission",
    ];
    const rows = periodDeals.map((deal) => {
      const key = `${deal.date}-${deal.client}-${deal.dealer}`;
      const comm = dealCommissions.get(key);
      return [
        deal.date, deal.client, deal.dealer, deal.product,
        deal.monthly_price.toString(), deal.setup_fee.toString(), deal.term.toString(),
        comm ? comm.mrrCommission.toFixed(2) : "0",
        comm ? comm.setupCommission.toFixed(2) : "0",
        comm ? comm.total.toFixed(2) : "0",
      ];
    });
    const label = showYTD
      ? `YTD-${selectedMonth.slice(0, 4)}`
      : getMonthLabel(selectedMonth).replace(" ", "-");
    downloadCSV(`shiftly-rep-${label}.csv`, headers, rows);
  }

  const tierProgress = useMemo(() => {
    if (!payStructure) return { percent: 0, t1: 0, t2: 0 };
    const t1 = payStructure.tier1_threshold ? Number(payStructure.tier1_threshold) : 0;
    const t2 = payStructure.tier2_threshold ? Number(payStructure.tier2_threshold) : 0;
    const maxThreshold = t2 || t1 || 1;
    const percent = Math.min((repMonthlyMrr / maxThreshold) * 100, 100);
    return { percent, t1, t2 };
  }, [payStructure, repMonthlyMrr]);

  const getCommission = useCallback(
    (deal: Deal) => {
      const key = `${deal.date}-${deal.client}-${deal.dealer}`;
      return dealCommissions.get(key)?.total ?? 0;
    },
    [dealCommissions]
  );

  if (loading || !user || user.role !== "rep") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse text-[#6B7280] text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#1F2937]">
      {tierToast && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-[#10B981] px-6 py-3 text-sm font-medium text-white shadow-lg">
          <span>{tierToast}</span>
          <button
            onClick={() => setTierToast(null)}
            className="ml-4 rounded-md bg-[#059669] px-3 py-1 text-xs hover:bg-[#047857] transition"
          >
            Dismiss
          </button>
        </div>
      )}

      <Navbar 
        userName={user.name} 
        userRole={user.role === "rep" ? "Rep" : "Admin"} 
        onLogout={logout} 
      />

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Month Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg bg-white border border-[#E5E7EB] px-4 py-2 text-sm text-[#6B7280] focus:outline-none focus:border-[#0066FF]"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {getMonthLabel(m)}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowYTD((prev) => !prev)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              showYTD
                ? "bg-[#0066FF] border-[#0066FF] text-white"
                : "bg-white border-[#E5E7EB] text-[#6B7280] hover:text-[#FFFFFF]"
            }`}
          >
            YTD
          </button>
          <button
            onClick={handleExportCSV}
            className="rounded-lg bg-white border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#6B7280] hover:text-[#FFFFFF] transition"
          >
            Export CSV
          </button>
          <div className="ml-auto text-sm text-[#6B7280]">
            {showYTD
              ? `Year to Date ${selectedMonth.slice(0, 4)}`
              : getMonthLabel(selectedMonth)}
          </div>
        </div>

        {/* Earnings Graph */}
        <EarningsGraph deals={periodDeals} getCommission={getCommission} />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="My MRR Sold" value={formatCurrency(stats.totalMrr)} />
          <SummaryCard label="My Setup Collected" value={formatCurrency(stats.totalSetup)} />
          <SummaryCard label="My Total Commission" value={formatCurrency(stats.totalCommission)} highlight />
          <SummaryCard label="My Deal Count" value={String(stats.dealCount)} />
        </div>

        {/* Tier Progress */}
        {payStructure && tierInfo && (
          <div className="rounded-xl bg-white border border-[#E5E7EB] p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider">
                Tier Progress
              </h3>
              <span className="text-sm font-medium text-[#0066FF]">
                {tierInfo.tier}
              </span>
            </div>
            <div className="relative h-4 rounded-full bg-[#F9FAFB] overflow-hidden mb-3">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#0066FF] to-[#2563EB] transition-all duration-700 ease-out"
                style={{ width: `${tierProgress.percent}%` }}
              />
              {tierProgress.t1 > 0 && tierProgress.t2 > 0 && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-[#94A3B8]/40"
                  style={{ left: `${(tierProgress.t1 / tierProgress.t2) * 100}%` }}
                />
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-[#6B7280]">
              <span>{formatCurrency(repMonthlyMrr)} MRR</span>
              <span>
                {tierInfo.tier === "Tier 2" ? (
                  <span className="text-[#10B981] font-medium">
                    Tier 2 reached! +{((payStructure.tier2_bonus_rate ?? 0) * 100).toFixed(0)}% bonus
                  </span>
                ) : tierInfo.tier === "Tier 1" ? (
                  <>
                    Tier 1 reached!{" "}
                    {tierInfo.nextTier && (
                      <span className="text-[#0066FF]">
                        {formatCurrency(tierInfo.amountToNext)} away from Tier 2
                      </span>
                    )}
                  </>
                ) : tierInfo.nextTier ? (
                  <span>
                    {formatCurrency(tierInfo.amountToNext)} away from {tierInfo.nextTier}
                    {tierInfo.nextTier === "Tier 1" && payStructure.tier1_bonus_rate &&
                      ` (+${(payStructure.tier1_bonus_rate * 100).toFixed(0)}%)`}
                  </span>
                ) : "No tier thresholds"}
              </span>
            </div>
            {(tierProgress.t1 > 0 || tierProgress.t2 > 0) && (
              <div className="flex items-center gap-4 mt-2 text-xs text-[#6B7280]/60">
                {tierProgress.t1 > 0 && <span>Tier 1: {formatCurrency(tierProgress.t1)}</span>}
                {tierProgress.t2 > 0 && <span>Tier 2: {formatCurrency(tierProgress.t2)}</span>}
              </div>
            )}
          </div>
        )}

        {/* Deals Tables */}
        {fetchLoading ? (
          <div className="text-center py-12 text-[#6B7280] text-sm">Loading deals...</div>
        ) : periodDeals.length === 0 ? (
          <div className="rounded-xl bg-white border border-[#E5E7EB] p-12 text-center">
            <p className="text-[#6B7280] text-sm">No deals found for this period.</p>
          </div>
        ) : (
          <>
            <DealsSection
              title="Front of Month (1st-15th)"
              deals={firstHalfDeals}
              dealCommissions={dealCommissions}
              expandedRows={expandedRows}
              onToggleRow={toggleRow}
            />
            <DealsSection
              title="Back of Month (16th-End)"
              deals={backHalfDeals}
              dealCommissions={dealCommissions}
              expandedRows={expandedRows}
              onToggleRow={toggleRow}
            />
          </>
        )}

        {/* Daily Activity Section */}
        <div className="rounded-xl bg-white border border-[#E5E7EB] overflow-hidden">
          <button
            onClick={() => setShowActivity(!showActivity)}
            className="w-full px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between hover:bg-[#F9FAFB] transition"
          >
            <h3 className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider">Daily Activity</h3>
            <span className="text-[#6B7280] text-xs">{showActivity ? "Collapse" : "Expand"}</span>
          </button>
          {showActivity && (
            <div className="p-6 space-y-6">
              {/* Activity Form */}
              <form onSubmit={handleActivitySubmit} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">Date</label>
                  <input
                    type="date"
                    value={activityForm.log_date}
                    onChange={(e) => setActivityForm({ ...activityForm, log_date: e.target.value })}
                    className="w-full rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0066FF]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">Scheduled</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={activityForm.scheduled_calls}
                    onChange={(e) => setActivityForm({ ...activityForm, scheduled_calls: e.target.value })}
                    className="w-full rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0066FF]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">Shown</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={activityForm.shown_calls}
                    onChange={(e) => setActivityForm({ ...activityForm, shown_calls: e.target.value })}
                    className="w-full rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0066FF]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">Sold</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={activityForm.sold_deals}
                    onChange={(e) => setActivityForm({ ...activityForm, sold_deals: e.target.value })}
                    className="w-full rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0066FF]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">Revenue</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={activityForm.revenue_collected}
                    onChange={(e) => setActivityForm({ ...activityForm, revenue_collected: e.target.value })}
                    className="w-full rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0066FF]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">No Shows</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={activityForm.no_shows}
                    onChange={(e) => setActivityForm({ ...activityForm, no_shows: e.target.value })}
                    className="w-full rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0066FF]"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={activitySubmitting}
                    className="w-full rounded-lg bg-[#0066FF] hover:bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
                  >
                    {activitySubmitting ? "Saving..." : "Log Activity"}
                  </button>
                </div>
              </form>

              {/* This Week's Activity Table */}
              {thisWeekActivity.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-2">This Week</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280] text-left text-xs">
                          <th className="px-4 py-2">Date</th>
                          <th className="px-4 py-2 text-right">Scheduled</th>
                          <th className="px-4 py-2 text-right">Shown</th>
                          <th className="px-4 py-2 text-right">Sold</th>
                          <th className="px-4 py-2 text-right">Revenue</th>
                          <th className="px-4 py-2 text-right">No Shows</th>
                        </tr>
                      </thead>
                      <tbody>
                        {thisWeekActivity.map((log, i) => (
                          <tr key={log.id} className={`${i % 2 === 0 ? "bg-[#F9FAFB]/40" : "bg-white/40"} border-b border-[#E5E7EB]/30 hover:bg-[#F9FAFB]/60 transition`}>
                            <td className="px-4 py-2 text-[#6B7280]">{formatDate(log.log_date)}</td>
                            <td className="px-4 py-2 text-right text-white">{log.scheduled_calls}</td>
                            <td className="px-4 py-2 text-right text-white">{log.shown_calls}</td>
                            <td className="px-4 py-2 text-right text-white">{log.sold_deals}</td>
                            <td className="px-4 py-2 text-right text-white">{formatCurrency(log.revenue_collected)}</td>
                            <td className="px-4 py-2 text-right text-white">{log.no_shows}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* FAB - Log a Deal */}
      <button
        onClick={() => setShowDealModal(true)}
        className="fixed bottom-8 right-8 z-50 w-14 h-14 rounded-full bg-[#3B7FE1] hover:bg-[#2563EB] text-white shadow-lg flex items-center justify-center transition-transform hover:scale-110"
        title="Log a Deal"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-28 right-8 z-50 bg-[#10B981] text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium max-w-sm">
          {toast}
        </div>
      )}

      {/* Deal Entry Modal */}
      {showDealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowDealModal(false)}>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Log a Deal</h2>
              <button onClick={() => setShowDealModal(false)} className="text-[#6B7280] hover:text-white text-xl">&times;</button>
            </div>
            <form onSubmit={handleDealSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={dealForm.deal_date}
                    onChange={(e) => setDealForm({ ...dealForm, deal_date: e.target.value })}
                    className="w-full rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0066FF]"
                  />
                </div>
                <div className="flex items-end">
                  <span className="inline-flex rounded-full bg-[#0066FF]/10 border border-[#0066FF]/20 px-3 py-2 text-xs font-medium text-[#0066FF]">
                    {dealHalf} Half
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#6B7280] mb-1">Dealer Name</label>
                <input
                  type="text"
                  required
                  placeholder="ABC Motors"
                  value={dealForm.dealer_name}
                  onChange={(e) => setDealForm({ ...dealForm, dealer_name: e.target.value })}
                  className="w-full rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0066FF] placeholder:text-[#6B7280]/40"
                />
              </div>
              <div>
                <label className="block text-xs text-[#6B7280] mb-1">Client Name</label>
                <input
                  type="text"
                  required
                  placeholder="John Smith"
                  value={dealForm.client_name}
                  onChange={(e) => setDealForm({ ...dealForm, client_name: e.target.value })}
                  className="w-full rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0066FF] placeholder:text-[#6B7280]/40"
                />
              </div>
              <div>
                <label className="block text-xs text-[#6B7280] mb-1">Product</label>
                <select
                  value={dealForm.product}
                  onChange={(e) => setDealForm({ ...dealForm, product: e.target.value as ProductType })}
                  className="w-full rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0066FF]"
                >
                  <option value="Tool">Tool</option>
                  <option value="Ads">Ads</option>
                  <option value="Bundle Tool">Bundle Tool</option>
                  <option value="Bundle Ads">Bundle Ads</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">Monthly Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm">$</span>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={dealForm.monthly_price}
                      onChange={(e) => setDealForm({ ...dealForm, monthly_price: e.target.value })}
                      className="w-full rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] pl-7 pr-3 py-2 text-sm text-white focus:outline-none focus:border-[#0066FF] placeholder:text-[#6B7280]/40"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">Setup Fee</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={dealForm.setup_fee}
                      onChange={(e) => setDealForm({ ...dealForm, setup_fee: e.target.value })}
                      className="w-full rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] pl-7 pr-3 py-2 text-sm text-white focus:outline-none focus:border-[#0066FF] placeholder:text-[#6B7280]/40"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#6B7280] mb-1">Term</label>
                <select
                  value={dealForm.term}
                  onChange={(e) => setDealForm({ ...dealForm, term: e.target.value })}
                  className="w-full rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0066FF]"
                >
                  <option value="1">1 month</option>
                  <option value="3">3 months</option>
                  <option value="6">6 months</option>
                  <option value="12">12 months</option>
                </select>
              </div>

              {/* Live Commission Preview */}
              {dealPreview && (
                <div className="rounded-lg bg-[#F9FAFB] border border-[#0066FF]/30 p-4">
                  <p className="text-xs font-medium text-[#0066FF] uppercase tracking-wider mb-2">Commission Preview</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-[#6B7280]">MRR <span className="text-white font-medium">{formatCurrency(dealPreview.mrrCommission)}</span></span>
                    <span className="text-[#6B7280]">+</span>
                    <span className="text-[#6B7280]">Setup <span className="text-white font-medium">{formatCurrency(dealPreview.setupCommission)}</span></span>
                    <span className="text-[#6B7280]">=</span>
                    <span className="text-[#0066FF] font-bold text-lg">{formatCurrency(dealPreview.total)}</span>
                  </div>
                  {dealPreview.termMultiplier > 1 && (
                    <p className="text-xs text-[#6B7280] mt-1">{dealPreview.termMultiplier}x term multiplier applied</p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={dealSubmitting}
                className="w-full rounded-lg bg-[#0066FF] hover:bg-[#2563EB] py-3 text-sm font-semibold text-white transition disabled:opacity-50"
              >
                {dealSubmitting ? "Submitting..." : "Log Deal"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl bg-white border border-[#E5E7EB] p-5 relative overflow-hidden">
      {/* Subtle blue accent border on top and left */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#0066FF] to-transparent opacity-60" />
      <div className="absolute top-0 left-0 w-[2px] h-full bg-gradient-to-b from-[#0066FF] to-transparent opacity-60" />
      
      <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? "text-[#0066FF]" : "text-[#FFFFFF]"}`}>{value}</p>
    </div>
  );
}

function DealsSection({
  title, deals, dealCommissions, expandedRows, onToggleRow,
}: {
  title: string;
  deals: Deal[];
  dealCommissions: Map<string, CommissionResult>;
  expandedRows: Set<string>;
  onToggleRow: (key: string) => void;
}) {
  if (deals.length === 0) return null;

  return (
    <div className="rounded-xl bg-white border border-[#E5E7EB] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#E5E7EB]">
        <h3 className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280] text-left">
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium">Client</th>
              <th className="px-6 py-3 font-medium">Dealer</th>
              <th className="px-6 py-3 font-medium">Product</th>
              <th className="px-6 py-3 font-medium text-right">Monthly Price</th>
              <th className="px-6 py-3 font-medium text-right">Setup Fee</th>
              <th className="px-6 py-3 font-medium text-right">Term</th>
              <th className="px-6 py-3 font-medium text-right">MRR Comm</th>
              <th className="px-6 py-3 font-medium text-right">Setup Comm</th>
              <th className="px-6 py-3 font-medium text-right">Total Comm</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal, i) => {
              const key = `${deal.date}-${deal.client}-${deal.dealer}`;
              const comm = dealCommissions.get(key);
              const isExpanded = expandedRows.has(key);
              const rowBg = i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]";

              return (
                <DealRow
                  key={key}
                  deal={deal}
                  commission={comm ?? null}
                  isExpanded={isExpanded}
                  onToggle={() => onToggleRow(key)}
                  rowBg={rowBg}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DealRow({
  deal, commission, isExpanded, onToggle, rowBg,
}: {
  deal: Deal;
  commission: CommissionResult | null;
  isExpanded: boolean;
  onToggle: () => void;
  rowBg: string;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`${rowBg} border-b border-[#E5E7EB]/50 hover:bg-[#F9FAFB] transition cursor-pointer`}
      >
        <td className="px-6 py-3 text-[#6B7280] whitespace-nowrap">{formatDate(deal.date)}</td>
        <td className="px-6 py-3 text-[#FFFFFF] font-medium">{deal.client}</td>
        <td className="px-6 py-3 text-[#6B7280]">{deal.dealer}</td>
        <td className="px-6 py-3">
          <span className="inline-flex rounded-full bg-[#0066FF]/10 border border-[#0066FF]/20 px-2.5 py-0.5 text-xs font-medium text-[#0066FF]">
            {deal.product}
          </span>
        </td>
        <td className="px-6 py-3 text-right text-[#FFFFFF]">{formatCurrency(deal.monthly_price)}</td>
        <td className="px-6 py-3 text-right text-[#FFFFFF]">{formatCurrency(deal.setup_fee)}</td>
        <td className="px-6 py-3 text-right text-[#6B7280]">{deal.term}mo</td>
        <td className="px-6 py-3 text-right text-[#6B7280]">
          {commission ? formatCurrency(commission.mrrCommission) : "-"}
        </td>
        <td className="px-6 py-3 text-right text-[#6B7280]">
          {commission ? formatCurrency(commission.setupCommission) : "-"}
        </td>
        <td className="px-6 py-3 text-right font-semibold text-[#0066FF]">
          {commission ? formatCurrency(commission.total) : "-"}
        </td>
      </tr>
      {isExpanded && commission && (
        <tr className="bg-[#F9FAFB]">
          <td colSpan={10} className="px-6 py-3">
            <p className="text-xs text-[#6B7280]">
              <span className="font-medium text-[#FFFFFF]">Breakdown:</span> {commission.breakdown}
            </p>
          </td>
        </tr>
      )}
    </>
  );
}
