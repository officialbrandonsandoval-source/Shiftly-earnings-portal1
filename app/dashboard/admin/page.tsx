"use client";

import { useAuth, DemoUser } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Deal, PayStructure } from "@/lib/types";
import { MOCK_PAY_STRUCTURES, getPayStructureForEmail } from "@/lib/mock-data";
import { calculateCommission } from "@/lib/commission";
import { formatPercent, formatCurrency, getMonthKey } from "@/lib/utils";
import EarningsGraph from "@/components/EarningsGraph";
import Navbar from "@/components/Navbar";

export default function AdminPayStructurePage() {
  const { user, loading, logout, addUser, removeUser, getUsers } = useAuth();
  const router = useRouter();

  const [payStructures] = useState<PayStructure[]>(MOCK_PAY_STRUCTURES);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const reps = useMemo(() => {
    const users = getUsers();
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      payStructureId: u.pay_structure_id || "00000000-0000-0000-0000-000000000001",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getUsers, refreshKey]);

  const [editingRep, setEditingRep] = useState<{ id: string; name: string; email: string; role: "manager" | "rep"; payStructureId: string } | null>(null);
  const [editPayStructureId, setEditPayStructureId] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("Shiftly123!");
  const [newRole, setNewRole] = useState<"manager" | "rep">("rep");
  const [newPayStructureId, setNewPayStructureId] = useState(MOCK_PAY_STRUCTURES[0]?.id || "");

  useEffect(() => {
    if (!loading && (!user || user.role !== "manager")) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchDeals() {
      try {
        const res = await fetch("/api/deals");
        if (res.ok) {
          const data = await res.json();
          setDeals(data.deals ?? data);
        }
      } catch {
        // silently fail
      }
    }
    if (user?.role === "manager") fetchDeals();
  }, [user]);

  const repMonthlyMrr = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const deal of deals) {
      const mk = getMonthKey(deal.date);
      if (!map[deal.rep_email]) map[deal.rep_email] = {};
      map[deal.rep_email][mk] = (map[deal.rep_email][mk] ?? 0) + deal.monthly_price;
    }
    return map;
  }, [deals]);

  const getCommission = useCallback(
    (deal: Deal) => {
      const ps = getPayStructureForEmail(deal.rep_email);
      const mk = getMonthKey(deal.date);
      const repMrr = repMonthlyMrr[deal.rep_email]?.[mk] ?? 0;
      return calculateCommission(deal, ps, repMrr).total;
    },
    [repMonthlyMrr]
  );

  function getStructureName(id: string): string {
    return payStructures.find((ps) => ps.id === id)?.name || "Unknown";
  }

  function openEditModal(rep: { id: string; name: string; email: string; role: "manager" | "rep"; payStructureId: string }) {
    setEditingRep(rep);
    setEditPayStructureId(rep.payStructureId);
  }

  function saveEditPayStructure() {
    if (!editingRep) return;
    const users = getUsers();
    const existing = users.find((u) => u.email.toLowerCase() === editingRep.email.toLowerCase());
    if (existing) {
      addUser({ ...existing, pay_structure_id: editPayStructureId });
      setRefreshKey((k) => k + 1);
    }
    setEditingRep(null);
  }

  function handleAddRep(e: React.FormEvent) {
    e.preventDefault();
    const newUser: DemoUser = {
      id: `demo-${Date.now()}`,
      name: newName.trim(),
      email: newEmail.trim().toLowerCase(),
      role: newRole,
      pay_structure_id: newPayStructureId,
      password: newPassword,
    };
    addUser(newUser);
    setRefreshKey((k) => k + 1);
    setNewName("");
    setNewEmail("");
    setNewPassword("Shiftly123!");
    setNewRole("rep");
    setNewPayStructureId(MOCK_PAY_STRUCTURES[0]?.id || "");
    setShowAddModal(false);
  }

  function handleRemoveRep(email: string) {
    removeUser(email);
    setRefreshKey((k) => k + 1);
    setConfirmRemove(null);
  }

  if (loading || !user || user.role !== "manager") return null;

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <Navbar 
        userName={user.name} 
        userRole="Manager" 
        onLogout={logout} 
      />

      <div className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#111827]">Pay Structure Management</h2>
            <p className="mt-1 text-sm text-[#6b7280]">View commission structures and manage rep assignments</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="rounded-lg bg-[#3B7FE1] hover:bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition"
          >
            + Add Rep
          </button>
        </div>

        {/* Earnings Graph */}
        {deals.length > 0 && (
          <EarningsGraph deals={deals} getCommission={getCommission} />
        )}

        {/* Pay Structures Table */}
        <div className="rounded-xl bg-white border border-[#e5e7eb] p-6">
          <h3 className="text-lg font-semibold text-[#111827] mb-4">Commission Structures</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e5e7eb] text-[#6b7280] text-left">
                  <th className="pb-3 font-medium">Structure</th>
                  <th className="pb-3 font-medium">MRR Tool</th>
                  <th className="pb-3 font-medium">MRR Ads</th>
                  <th className="pb-3 font-medium">MRR Bundle Tool</th>
                  <th className="pb-3 font-medium">MRR Bundle Ads</th>
                  <th className="pb-3 font-medium">Setup Tool</th>
                  <th className="pb-3 font-medium">Setup Ads</th>
                  <th className="pb-3 font-medium">Setup Bndl Tool</th>
                  <th className="pb-3 font-medium">Setup Bndl Ads</th>
                  <th className="pb-3 font-medium">Tier 1</th>
                  <th className="pb-3 font-medium">Tier 2</th>
                </tr>
              </thead>
              <tbody>
                {payStructures.map((ps, i) => (
                  <tr
                    key={ps.id}
                    className={`border-b border-[#e5e7eb] hover:bg-[#f9fafb] transition ${
                      i % 2 === 0 ? "bg-[#f9fafb]" : "bg-white"
                    }`}
                  >
                    <td className="py-3 text-[#111827] font-medium">{ps.name}</td>
                    <td className="py-3 text-[#6b7280]">{formatPercent(ps.mrr_rate_tool)}</td>
                    <td className="py-3 text-[#6b7280]">{formatPercent(ps.mrr_rate_ads)}</td>
                    <td className="py-3 text-[#6b7280]">{formatPercent(ps.mrr_rate_bundle_tool)}</td>
                    <td className="py-3 text-[#6b7280]">{formatPercent(ps.mrr_rate_bundle_ads)}</td>
                    <td className="py-3 text-[#6b7280]">{formatPercent(ps.setup_rate_tool)}</td>
                    <td className="py-3 text-[#6b7280]">{formatPercent(ps.setup_rate_ads)}</td>
                    <td className="py-3 text-[#6b7280]">{formatPercent(ps.setup_rate_bundle_tool)}</td>
                    <td className="py-3 text-[#6b7280]">{formatPercent(ps.setup_rate_bundle_ads)}</td>
                    <td className="py-3 text-[#6b7280]">
                      {ps.tier1_threshold !== null
                        ? `$${ps.tier1_threshold.toLocaleString()} / +${formatPercent(ps.tier1_bonus_rate!)}`
                        : "--"}
                    </td>
                    <td className="py-3 text-[#6b7280]">
                      {ps.tier2_threshold !== null
                        ? `$${ps.tier2_threshold.toLocaleString()} / +${formatPercent(ps.tier2_bonus_rate!)}`
                        : "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rep Assignments */}
        <div className="rounded-xl bg-white border border-[#e5e7eb] p-6">
          <h3 className="text-lg font-semibold text-[#111827] mb-4">Rep Assignments</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e5e7eb] text-[#6b7280] text-left">
                  <th className="pb-3 font-medium">Rep Name</th>
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium">Role</th>
                  <th className="pb-3 font-medium">Pay Structure</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reps.map((rep, i) => (
                  <tr
                    key={rep.id}
                    className={`border-b border-[#e5e7eb] hover:bg-[#f9fafb] transition ${
                      i % 2 === 0 ? "bg-[#f9fafb]" : "bg-white"
                    }`}
                  >
                    <td className="py-3 text-[#111827] font-medium">{rep.name}</td>
                    <td className="py-3 text-[#6b7280]">{rep.email}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                          rep.role === "manager"
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                            : "bg-[#3B7FE1]/10 text-[#3B7FE1] border-[#3B7FE1]/20"
                        }`}
                      >
                        {rep.role === "manager" ? "Manager" : "Rep"}
                      </span>
                    </td>
                    <td className="py-3 text-[#6b7280]">{getStructureName(rep.payStructureId)}</td>
                    <td className="py-3 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(rep)}
                        className="inline-flex items-center rounded-lg bg-[#3B7FE1] hover:bg-[#2563EB] px-3 py-1.5 text-xs font-medium text-white transition"
                      >
                        Edit
                      </button>
                      {rep.email !== user.email && (
                        <button
                          onClick={() => setConfirmRemove(rep.email)}
                          className="inline-flex items-center rounded-lg bg-red-500 hover:bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingRep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-[#e5e7eb] shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-[#e5e7eb]">
              <h3 className="text-lg font-semibold text-[#111827]">Edit Pay Structure</h3>
              <button onClick={() => setEditingRep(null)} className="text-[#6b7280] hover:text-[#111827] transition text-xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-[#6b7280] mb-1">Rep</p>
                <p className="text-[#111827] font-medium">{editingRep.name} <span className="text-[#6b7280]/60">({editingRep.email})</span></p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#6b7280] uppercase tracking-wider">Pay Structure</label>
                <select
                  value={editPayStructureId}
                  onChange={(e) => setEditPayStructureId(e.target.value)}
                  className="w-full rounded-xl bg-[#f9fafb] border border-[#e5e7eb] px-4 py-3 text-sm text-[#111827] focus:border-[#3B7FE1] focus:outline-none"
                >
                  {payStructures.map((ps) => (
                    <option key={ps.id} value={ps.id}>{ps.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditingRep(null)} className="flex-1 rounded-xl bg-[#f9fafb] border border-[#e5e7eb] px-4 py-3 text-sm font-medium text-[#6b7280] hover:text-[#111827] transition">Cancel</button>
                <button onClick={saveEditPayStructure} className="flex-1 rounded-xl bg-[#3B7FE1] hover:bg-[#2563EB] px-4 py-3 text-sm font-semibold text-white transition">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Remove Modal */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-[#e5e7eb] shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-[#111827]">Remove User</h3>
            <p className="text-sm text-[#6b7280]">Are you sure you want to remove <span className="font-medium text-[#111827]">{confirmRemove}</span>? They will no longer be able to log in.</p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setConfirmRemove(null)} className="flex-1 rounded-xl bg-[#f9fafb] border border-[#e5e7eb] px-4 py-3 text-sm font-medium text-[#6b7280] hover:text-[#111827] transition">Cancel</button>
              <button onClick={() => handleRemoveRep(confirmRemove)} className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 px-4 py-3 text-sm font-semibold text-white transition">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Rep Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-[#e5e7eb] shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-[#e5e7eb]">
              <h3 className="text-lg font-semibold text-[#111827]">Add New Rep</h3>
              <button onClick={() => setShowAddModal(false)} className="text-[#6b7280] hover:text-[#111827] transition text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleAddRep} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#6b7280] uppercase tracking-wider">Name</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="Jane Doe"
                  className="w-full rounded-xl bg-[#f9fafb] border border-[#e5e7eb] px-4 py-3 text-sm text-[#111827] placeholder-[#9ca3af] focus:border-[#3B7FE1] focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#6b7280] uppercase tracking-wider">Email</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required placeholder="jane@shiftlyauto.com"
                  className="w-full rounded-xl bg-[#f9fafb] border border-[#e5e7eb] px-4 py-3 text-sm text-[#111827] placeholder-[#9ca3af] focus:border-[#3B7FE1] focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#6b7280] uppercase tracking-wider">Password</label>
                <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="Shiftly123!"
                  className="w-full rounded-xl bg-[#f9fafb] border border-[#e5e7eb] px-4 py-3 text-sm text-[#111827] placeholder-[#9ca3af] focus:border-[#3B7FE1] focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#6b7280] uppercase tracking-wider">Role</label>
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value as "manager" | "rep")}
                    className="w-full rounded-xl bg-[#f9fafb] border border-[#e5e7eb] px-4 py-3 text-sm text-[#111827] focus:border-[#3B7FE1] focus:outline-none">
                    <option value="rep">Rep</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#6b7280] uppercase tracking-wider">Pay Structure</label>
                  <select value={newPayStructureId} onChange={(e) => setNewPayStructureId(e.target.value)}
                    className="w-full rounded-xl bg-[#f9fafb] border border-[#e5e7eb] px-4 py-3 text-sm text-[#111827] focus:border-[#3B7FE1] focus:outline-none">
                    {payStructures.map((ps) => (
                      <option key={ps.id} value={ps.id}>{ps.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 rounded-xl bg-[#f9fafb] border border-[#e5e7eb] px-4 py-3 text-sm font-medium text-[#6b7280] hover:text-[#111827] transition">Cancel</button>
                <button type="submit" className="flex-1 rounded-xl bg-[#3B7FE1] hover:bg-[#2563EB] px-4 py-3 text-sm font-semibold text-white transition">Add Rep</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
