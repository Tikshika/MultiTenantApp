import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, revokeAdminSession } from "@/lib/admin-session";
import { requireSameOrigin } from "@/lib/admin-request";

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  try {
    if (token) await revokeAdminSession(token);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not end the admin session.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
