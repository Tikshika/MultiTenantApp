import { headers } from "next/headers";

export async function getCurrentTenantFromRequest() {
  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const xTenantId = headersList.get("x-tenant-id") ?? "";

  if (xTenantId) return xTenantId;

  const subdomain = host.split(".")[0];
  if (!subdomain || subdomain === "localhost") {
    return null;
  }

  return subdomain;
}
