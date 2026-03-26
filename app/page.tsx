"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (user.role === "manager") {
      router.replace("/dashboard/manager");
    } else {
      router.replace("/dashboard/rep");
    }
  }, [user, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f5]">
      <div className="text-[#6b7280] text-sm">Redirecting...</div>
    </div>
  );
}
