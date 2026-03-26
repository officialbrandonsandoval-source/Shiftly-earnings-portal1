"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Deal } from "@/lib/types";
import { formatCurrency, getMonthKey } from "@/lib/utils";

type Period = "daily" | "monthly" | "quarterly" | "yearly";

interface EarningsGraphProps {
  deals: Deal[];
  /** Commission totals keyed by deal key (date-client-dealer) */
  getCommission: (deal: Deal) => number;
}

export default function EarningsGraph({ deals, getCommission }: EarningsGraphProps) {
  const [period, setPeriod] = useState<Period>("monthly");

  const chartData = useMemo(() => {
    if (deals.length === 0) return [];

    const buckets: Record<string, number> = {};

    for (const deal of deals) {
      let key: string;
      const d = deal.date; // YYYY-MM-DD
      switch (period) {
        case "daily":
          key = d;
          break;
        case "monthly":
          key = getMonthKey(d);
          break;
        case "quarterly": {
          const [y, m] = d.split("-");
          const q = Math.ceil(Number(m) / 3);
          key = `${y}-Q${q}`;
          break;
        }
        case "yearly":
          key = d.slice(0, 4);
          break;
      }
      buckets[key] = (buckets[key] ?? 0) + getCommission(deal);
    }

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, value]) => {
        let displayLabel = label;
        if (period === "daily") {
          const parts = label.split("-");
          displayLabel = `${parts[1]}/${parts[2]}`;
        } else if (period === "monthly") {
          const [y, m] = label.split("-");
          const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          displayLabel = `${months[Number(m) - 1]} '${y.slice(2)}`;
        }
        return { label: displayLabel, earnings: Math.round(value * 100) / 100 };
      });
  }, [deals, getCommission, period]);

  const periodTotal = useMemo(
    () => chartData.reduce((sum, d) => sum + d.earnings, 0),
    [chartData]
  );

  const tabs: { key: Period; label: string }[] = [
    { key: "daily", label: "Daily" },
    { key: "monthly", label: "Monthly" },
    { key: "quarterly", label: "Quarterly" },
    { key: "yearly", label: "Yearly" },
  ];

  return (
    <div className="rounded-xl bg-white border border-[#E5E7EB] p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-1">
            Period Total
          </p>
          <p className="text-2xl font-bold text-[#1F2937]">
            {formatCurrency(periodTotal)}
          </p>
        </div>
        <div className="flex rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setPeriod(tab.key)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === tab.key
                  ? "bg-[#0066FF] text-white"
                  : "text-[#6B7280] hover:text-[#1F2937]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0066FF" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#0066FF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fill: "#6B7280", fontSize: 12 }}
              axisLine={{ stroke: "#E5E7EB" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#6B7280", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) =>
                v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
                color: "#1F2937",
              }}
              formatter={((value: number) => [formatCurrency(value), "Earnings"]) as never}
              labelStyle={{ color: "#6B7280" }}
            />
            <Area
              type="monotone"
              dataKey="earnings"
              stroke="#0066FF"
              strokeWidth={2}
              fill="url(#earningsGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[280px] flex items-center justify-center text-[#6B7280]">
          No earnings data available
        </div>
      )}
    </div>
  );
}
