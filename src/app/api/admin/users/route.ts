import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// GET /api/admin/users — list all users
export async function GET() {
  // Verify caller is admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = user.app_metadata?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = await createServiceClient();
  const {
    data: { users },
    error,
  } = await admin.auth.admin.listUsers({ perPage: 100 });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return only needed fields
  const formatted = users.map((u) => ({
    id: u.id,
    email: u.email,
    full_name: u.user_metadata?.full_name || "",
    role: u.app_metadata?.role || "viewer",
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    email_confirmed_at: u.email_confirmed_at,
  }));

  return NextResponse.json({ users: formatted });
}

// POST /api/admin/users — invite a new user
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const callerRole = user.app_metadata?.role;
  if (callerRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email, role } = await request.json();
  if (!email || !role) {
    return NextResponse.json(
      { error: "Email and role are required" },
      { status: 400 }
    );
  }

  const admin = await createServiceClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { role },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Set the role in app_metadata
  if (data.user) {
    await admin.auth.admin.updateUserById(data.user.id, {
      app_metadata: { role },
    });
  }

  return NextResponse.json({ success: true, user: data.user });
}

// PATCH /api/admin/users — update user role
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const callerRole = user.app_metadata?.role;
  if (callerRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, role } = await request.json();
  if (!userId || !role) {
    return NextResponse.json(
      { error: "User ID and role are required" },
      { status: 400 }
    );
  }

  // Prevent admin from changing their own role
  if (userId === user.id) {
    return NextResponse.json(
      { error: "Cannot change your own role" },
      { status: 400 }
    );
  }

  const admin = await createServiceClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
