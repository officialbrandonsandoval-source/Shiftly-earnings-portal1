"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "./supabase";
import { AppUser } from "./types";

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  login: async () => ({ error: "Not initialized" }),
  logout: async () => {},
});

// Demo mode fallback users (when Supabase is not configured)
const DEMO_USERS: Record<string, AppUser & { password: string }> = {
  "sarah@shiftlyauto.com": {
    id: "demo-sarah",
    email: "sarah@shiftlyauto.com",
    name: "Sarah Mitchell",
    role: "manager",
    pay_structure_id: "00000000-0000-0000-0000-000000000001",
    password: "Shiftly123!",
  },
  "mike@shiftlyauto.com": {
    id: "demo-mike",
    email: "mike@shiftlyauto.com",
    name: "Mike Torres",
    role: "rep",
    pay_structure_id: "00000000-0000-0000-0000-000000000001",
    password: "Shiftly123!",
  },
  "jr@shiftlyauto.com": {
    id: "demo-jr",
    email: "jr@shiftlyauto.com",
    name: "JR Patel",
    role: "rep",
    pay_structure_id: "00000000-0000-0000-0000-000000000002",
    password: "Shiftly123!",
  },
};

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!url && !url.includes("placeholder");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isSupabaseConfigured()) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          fetchUserProfile(data.session.user.id);
        } else {
          setLoading(false);
        }
      });

      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          fetchUserProfile(session.user.id);
        } else {
          setUser(null);
          setLoading(false);
        }
      });

      return () => listener.subscription.unsubscribe();
    } else {
      const stored = localStorage.getItem("shiftly_user");
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch {
          // ignore
        }
      }
      setLoading(false);
    }
  }, []);

  async function fetchUserProfile(authId: string) {
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", authId)
      .single();

    if (data) {
      setUser(data as AppUser);
    }
    setLoading(false);
  }

  async function login(email: string, password: string): Promise<{ error: string | null }> {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      return { error: null };
    }

    // Demo mode
    const demoUser = DEMO_USERS[email.toLowerCase()];
    if (!demoUser || demoUser.password !== password) {
      return { error: "Invalid email or password" };
    }

    const { password: _, ...userWithoutPassword } = demoUser;
    setUser(userWithoutPassword);
    localStorage.setItem("shiftly_user", JSON.stringify(userWithoutPassword));
    return { error: null };
  }

  async function logout() {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
    setUser(null);
    localStorage.removeItem("shiftly_user");
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
