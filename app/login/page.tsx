"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: loginError } = await login(email, password);
    if (loginError) {
      setError(loginError);
      setLoading(false);
      return;
    }

    router.push("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFFFFF]">
      <div className="w-full max-w-sm mx-4">
        <div className="bg-[#FFFFFF] rounded-2xl shadow-lg overflow-hidden border border-[#E5E7EB]">
          {/* Logo header — black background matching Shiftly brand */}
          <div className="bg-black flex items-center justify-center py-8 px-8">
            <Image
              src="/Shiftly-Auto.png"
              alt="Shiftly Auto"
              width={220}
              height={80}
              className="object-contain"
              priority
            />
          </div>

          {/* Form */}
          <div className="p-8">
            <p className="text-[#1F2937] text-sm mb-6">Sign in to your earnings portal</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1F2937] mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
                  placeholder="you@shiftlyauto.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1F2937] mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
                  placeholder="Enter password"
                  required
                />
              </div>

              {error && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-[#0066FF] hover:bg-[#2563EB] disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
              >
                {loading ? "Signing in..." : "Login"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
