"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "./supabase";
import { AppUser } from "./types";

export type DemoUser = AppUser & { password: string };

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: string | null }>;
  addUser: (user: DemoUser) => void;
  removeUser: (email: string) => void;
  getUsers: () => DemoUser[];
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  login: async () => ({ error: "Not initialized" }),
  logout: async () => {},
  changePassword: async () => ({ error: "Not initialized" }),
  addUser: () => {},
  removeUser: () => {},
  getUsers: () => [],
});

// Default demo users (when Supabase is not configured)
const DEFAULT_DEMO_USERS: Record<string, DemoUser> = {
  "ryan@shiftlyauto.com": {
    id: "demo-ryan",
    email: "ryan@shiftlyauto.com",
    name: "Ryan",
    role: "manager",
    pay_structure_id: "00000000-0000-0000-0000-000000000001",
    password: "Shiftly123!",
  },
  "jr@shiftlyauto.com": {
    id: "demo-jr",
    email: "jr@shiftlyauto.com",
    name: "JR",
    role: "rep",
    pay_structure_id: "00000000-0000-0000-0000-000000000002",
    password: "Shiftly123!",
  },
  "anthony@shiftlyauto.com": {
    id: "demo-anthony",
    email: "anthony@shiftlyauto.com",
    name: "Anthony",
    role: "rep",
    pay_structure_id: "00000000-0000-0000-0000-000000000001",
    password: "Shiftly123!",
  },
  "dawson@shiftlyauto.com": {
    id: "demo-dawson",
    email: "dawson@shiftlyauto.com",
    name: "Dawson",
    role: "rep",
    pay_structure_id: "00000000-0000-0000-0000-000000000001",
    password: "Shiftly123!",
  },
  "gdykema@shiftlyauto.com": {
    id: "demo-gdykema",
    email: "gdykema@shiftlyauto.com",
    name: "G Dykema",
    role: "rep",
    pay_structure_id: "00000000-0000-0000-0000-000000000001",
    password: "Shiftly123!",
  },
  "alex@shiftlyauto.com": {
    id: "demo-alex",
    email: "alex@shiftlyauto.com",
    name: "Alex",
    role: "rep",
    pay_structure_id: "00000000-0000-0000-0000-000000000001",
    password: "Shiftly123!",
  },
  "jeremy@shiftlyauto.com": {
    id: "demo-jeremy",
    email: "jeremy@shiftlyauto.com",
    name: "Jeremy",
    role: "rep",
    pay_structure_id: "00000000-0000-0000-0000-000000000001",
    password: "Shiftly123!",
  },
};

function loadDemoUsers(): Record<string, DemoUser> {
  if (typeof window === "undefined") return { ...DEFAULT_DEMO_USERS };
  const stored = localStorage.getItem("shiftly_demo_users");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // ignore
    }
  }
  return { ...DEFAULT_DEMO_USERS };
}

function saveDemoUsers(users: Record<string, DemoUser>) {
  localStorage.setItem("shiftly_demo_users", JSON.stringify(users));
}

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!url && !url.includes("placeholder");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoUsers, setDemoUsers] = useState<Record<string, DemoUser>>({});

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
      const users = loadDemoUsers();
      setDemoUsers(users);
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
    const currentUsers = loadDemoUsers();
    const demoUser = currentUsers[email.toLowerCase()];
    if (!demoUser || demoUser.password !== password) {
      return { error: "Invalid email or password" };
    }

    const { password: _, ...userWithoutPassword } = demoUser;
    setUser(userWithoutPassword);
    localStorage.setItem("shiftly_user", JSON.stringify(userWithoutPassword));
    return { error: null };
  }

  async function changePassword(currentPassword: string, newPassword: string): Promise<{ error: string | null }> {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { error: error.message };
      return { error: null };
    }

    // Demo mode
    if (!user) return { error: "Not logged in" };
    const currentUsers = loadDemoUsers();
    const demoUser = currentUsers[user.email.toLowerCase()];
    if (!demoUser) return { error: "User not found" };
    if (demoUser.password !== currentPassword) return { error: "Current password is incorrect" };

    demoUser.password = newPassword;
    currentUsers[user.email.toLowerCase()] = demoUser;
    saveDemoUsers(currentUsers);
    setDemoUsers(currentUsers);
    return { error: null };
  }

  function addUser(newUser: DemoUser) {
    const currentUsers = loadDemoUsers();
    currentUsers[newUser.email.toLowerCase()] = newUser;
    saveDemoUsers(currentUsers);
    setDemoUsers({ ...currentUsers });
  }

  function removeUser(email: string) {
    const currentUsers = loadDemoUsers();
    delete currentUsers[email.toLowerCase()];
    saveDemoUsers(currentUsers);
    setDemoUsers({ ...currentUsers });
  }

  function getUsers(): DemoUser[] {
    return Object.values(demoUsers);
  }

  async function logout() {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
    setUser(null);
    localStorage.removeItem("shiftly_user");
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, changePassword, addUser, removeUser, getUsers }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
