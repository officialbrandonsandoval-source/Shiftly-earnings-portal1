import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// All users to seed into Supabase Auth + users table
const SEED_USERS = [
  { email: "ryan@shiftlyauto.com", name: "Ryan", role: "manager", pay_structure_id: "00000000-0000-0000-0000-000000000001", password: "Shiftly123!" },
  { email: "jr@shiftlyauto.com", name: "JR", role: "rep", pay_structure_id: "00000000-0000-0000-0000-000000000002", password: "Shiftly123!" },
  { email: "anthony@shiftlyauto.com", name: "Anthony", role: "rep", pay_structure_id: "00000000-0000-0000-0000-000000000001", password: "Shiftly123!" },
  { email: "dawson@shiftlyauto.com", name: "Dawson", role: "rep", pay_structure_id: "00000000-0000-0000-0000-000000000001", password: "Shiftly123!" },
  { email: "gdykema@shiftlyauto.com", name: "G Dykema", role: "rep", pay_structure_id: "00000000-0000-0000-0000-000000000001", password: "Shiftly123!" },
  { email: "alex@shiftlyauto.com", name: "Alex", role: "rep", pay_structure_id: "00000000-0000-0000-0000-000000000001", password: "Shiftly123!" },
  { email: "jeremy@shiftlyauto.com", name: "Jeremy", role: "rep", pay_structure_id: "00000000-0000-0000-0000-000000000001", password: "Shiftly123!" },
];

export async function POST() {
  const results: { email: string; status: string; error?: string }[] = [];

  for (const user of SEED_USERS) {
    try {
      // Try to create in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      });

      let userId: string | null = null;

      if (authError) {
        // User might already exist in auth - try to find them
        if (authError.message.includes("already") || authError.message.includes("exists")) {
          const { data: users } = await supabaseAdmin.auth.admin.listUsers();
          const existing = users?.users?.find(u => u.email?.toLowerCase() === user.email.toLowerCase());
          if (existing) {
            userId = existing.id;
            // Update their password
            await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: user.password });
          } else {
            results.push({ email: user.email, status: "error", error: authError.message });
            continue;
          }
        } else {
          results.push({ email: user.email, status: "error", error: authError.message });
          continue;
        }
      } else {
        userId = authData.user.id;
      }

      if (!userId) {
        results.push({ email: user.email, status: "error", error: "No user ID" });
        continue;
      }

      // Upsert into users table
      const { error: dbError } = await supabaseAdmin
        .from("users")
        .upsert({
          id: userId,
          email: user.email.toLowerCase(),
          name: user.name,
          role: user.role,
          pay_structure_id: user.pay_structure_id,
        }, { onConflict: "id" });

      if (dbError) {
        results.push({ email: user.email, status: "error", error: dbError.message });
      } else {
        results.push({ email: user.email, status: "ok" });
      }
    } catch (err) {
      results.push({ email: user.email, status: "error", error: String(err) });
    }
  }

  return NextResponse.json({ results });
}
