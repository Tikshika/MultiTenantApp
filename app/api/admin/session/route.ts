import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/admin-session";

export async function GET() {
  try {
    const account = await getCurrentAdminSession();
    if (!account) {
      return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    }

    return NextResponse.json({
      id: account.id,
      email: account.email,
      role: account.role,
      tenantId: account.tenant_id,
      mustChangePassword: account.must_change_password,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not verify the admin session.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
