import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// GET /api/users - list all users from the users table
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

// POST /api/users - create a new user in Supabase Auth + users table
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, role, pay_structure_id } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Missing required fields (email, password, name)" }, { status: 400 });
    }

    // 1. Create in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm email
    });

    if (authError) {
      // If user already exists in auth, try to get their ID
      if (authError.message.includes("already been registered") || authError.message.includes("already exists")) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existing = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (existing) {
          // Update password if they exist
          await supabaseAdmin.auth.admin.updateUserById(existing.id, { password });
          // Upsert into users table
          const { data: userData, error: userError } = await supabaseAdmin
            .from("users")
            .upsert({
              id: existing.id,
              email: email.toLowerCase(),
              name,
              role: role || "rep",
              pay_structure_id: pay_structure_id || null,
            }, { onConflict: "id" })
            .select()
            .single();

          if (userError) {
            return NextResponse.json({ error: userError.message }, { status: 500 });
          }
          return NextResponse.json(userData);
        }
      }
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // 2. Insert into users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .insert({
        id: authData.user.id,
        email: email.toLowerCase(),
        name,
        role: role || "rep",
        pay_structure_id: pay_structure_id || null,
      })
      .select()
      .single();

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    return NextResponse.json(userData);
  } catch (err) {
    console.error("Create user error:", err);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

// DELETE /api/users - remove a user from Supabase Auth + users table
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Find user in users table
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();

    if (user) {
      // Delete from users table
      await supabaseAdmin.from("users").delete().eq("id", user.id);
      // Delete from auth
      await supabaseAdmin.auth.admin.deleteUser(user.id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete user error:", err);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
