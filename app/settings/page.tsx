"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";

export default function SettingsPage() {
  const { user, loading, logout, changePassword } = useAuth();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    setSaving(true);
    const { error: changeError } = await changePassword(currentPassword, newPassword);
    setSaving(false);

    if (changeError) {
      setError(changeError);
      return;
    }

    setSuccess("Password changed successfully");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-white">
      <Navbar
        userName={user.name}
        userRole={user.role === "manager" ? "Manager" : "Rep"}
        onLogout={logout}
      />

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-[#111827]">Settings</h2>
          <p className="mt-1 text-sm text-[#6b7280]">Manage your account settings</p>
        </div>

        {/* Profile Info */}
        <div className="rounded-xl bg-white border border-[#e5e7eb] p-6 space-y-4">
          <h3 className="text-lg font-semibold text-[#111827]">Profile</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-[#6b7280] uppercase tracking-wider mb-1">Name</p>
              <p className="text-sm text-[#111827] font-medium">{user.name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#6b7280] uppercase tracking-wider mb-1">Email</p>
              <p className="text-sm text-[#111827] font-medium">{user.email}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#6b7280] uppercase tracking-wider mb-1">Role</p>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                user.role === "manager"
                  ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
                  : "bg-[#0066FF]/10 text-[#0066FF] border-[#0066FF]/20"
              }`}>
                {user.role === "manager" ? "Manager" : "Rep"}
              </span>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="rounded-xl bg-white border border-[#e5e7eb] p-6">
          <h3 className="text-lg font-semibold text-[#111827] mb-4">Change Password</h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#6b7280] uppercase tracking-wider">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full rounded-xl bg-[#f9fafb] border border-[#e5e7eb] px-4 py-3 text-sm text-[#111827] placeholder-[#9ca3af] focus:border-[#0066FF] focus:outline-none"
                placeholder="Enter current password"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#6b7280] uppercase tracking-wider">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full rounded-xl bg-[#f9fafb] border border-[#e5e7eb] px-4 py-3 text-sm text-[#111827] placeholder-[#9ca3af] focus:border-[#0066FF] focus:outline-none"
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#6b7280] uppercase tracking-wider">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-xl bg-[#f9fafb] border border-[#e5e7eb] px-4 py-3 text-sm text-[#111827] placeholder-[#9ca3af] focus:border-[#0066FF] focus:outline-none"
                placeholder="Confirm new password"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
            {success && (
              <p className="text-green-600 text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2">{success}</p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#0066FF] hover:bg-[#2563EB] px-6 py-3 text-sm font-semibold text-white transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Change Password"}
            </button>
          </form>
        </div>

        {/* Back link */}
        <button
          onClick={() => router.back()}
          className="text-sm text-[#0066FF] hover:text-[#2563EB] font-medium transition"
        >
          &larr; Back to Dashboard
        </button>
      </div>
    </div>
  );
}
