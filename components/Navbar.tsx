"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface NavbarProps {
  userName: string;
  userRole: string;
  onLogout: () => void;
}

export default function Navbar({ userName, userRole, onLogout }: NavbarProps) {
  const pathname = usePathname();

  const tabs = [
    { label: "Earnings", href: "/" },
    { label: "Deals", href: "/#deals" },
    { label: "Activity Log", href: "/#activity" },
    { label: "Settings", href: "/settings" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href.split("#")[0]);
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-[#E5E7EB] bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo + Brand */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            {/* Check for SVG logo, fall back to text */}
            <div className="flex items-center">
              <Image
                src="/Shiftly-Auto.png"
                alt="Shiftly Auto"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="hidden sm:flex items-center gap-6">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={`text-sm font-medium transition-colors relative pb-1 ${
                  isActive(tab.href)
                    ? "text-[#1F2937]"
                    : "text-[#6B7280] hover:text-[#1F2937]"
                }`}
              >
                {tab.label}
                {isActive(tab.href) && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0066FF]" />
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* User Info + Logout */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#1F2937]/70">{userName}</span>
            <span className="rounded-full bg-[#0066FF]/20 px-2.5 py-0.5 text-xs font-medium text-[#0066FF] border border-[#0066FF]/30">
              {userRole}
            </span>
          </div>
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
