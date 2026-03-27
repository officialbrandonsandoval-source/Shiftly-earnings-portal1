"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

interface NavbarProps {
  userName: string;
  userRole: string;
  onLogout: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const TABS = ["Earnings", "Deals", "Activity Log"];

export default function Navbar({ userName, userRole, onLogout, activeTab = "Earnings", onTabChange }: NavbarProps) {
  const router = useRouter();

  return (
    <nav className="sticky top-0 z-40 bg-black">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo + Brand */}
        <div className="flex items-center gap-10">
          <div className="flex items-center">
            <Image
              src="/Shiftly-Auto.png"
              alt="Shiftly Auto"
              width={160}
              height={56}
              className="object-contain"
            />
          </div>

          {/* Navigation Tabs */}
          <div className="hidden sm:flex items-center gap-6">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => onTabChange?.(tab)}
                className={`text-sm font-medium transition-colors relative pb-1 ${
                  activeTab === tab
                    ? "text-white"
                    : "text-[#9CA3AF] hover:text-white"
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0066FF]" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* User Info + Settings + Logout */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/70">{userName}</span>
            <span className="rounded-full bg-[#0066FF]/20 px-2.5 py-0.5 text-xs font-medium text-[#0066FF] border border-[#0066FF]/30">
              {userRole}
            </span>
          </div>
          <button
            onClick={() => router.push("/settings")}
            className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-medium text-white transition"
          >
            Settings
          </button>
          <button
            onClick={onLogout}
            className="rounded-lg bg-[#0066FF] hover:bg-[#2563EB] px-3 py-1.5 text-xs font-medium text-white transition"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
