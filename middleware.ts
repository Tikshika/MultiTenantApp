import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const host = request.headers.get("host") ?? "";
  const tenant = host.split(".")[0];

  const pathname = url.pathname;

  if (pathname === "/" || pathname.startsWith("/_") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/greenvalley-pharmacy") || pathname.startsWith("/forge-and-frame") || pathname.startsWith("/harvest-basket")) {
    const response = NextResponse.next();
    response.headers.set("x-tenant-id", pathname.replace("/", "").split("/")[0]);
    return response;
  }

  if (tenant && tenant !== "localhost") {
    const response = NextResponse.next();
    response.headers.set("x-tenant-id", tenant);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
