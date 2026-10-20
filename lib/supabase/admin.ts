import "server-only";
import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey || serviceRoleKey.startsWith("YOUR_")) {
    throw new Error(
      "Supabase server configuration is missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  if (serviceRoleKey.startsWith("sb_publishable_") || serviceRoleKey === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is set to a publishable/anon key. Use a Supabase secret key or legacy service_role key for server-side Storage uploads.",
    );
  }

  const jwtPayload = serviceRoleKey.split(".")[1];
  if (jwtPayload) {
    try {
      const role = JSON.parse(Buffer.from(jwtPayload, "base64url").toString("utf8")).role;
      if (role && role !== "service_role") {
        throw new Error(
          "SUPABASE_SERVICE_ROLE_KEY must have the service_role privilege; the configured key does not.",
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("SUPABASE_SERVICE_ROLE_KEY")) throw error;
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not a valid Supabase server key.");
    }
  } else if (!serviceRoleKey.startsWith("sb_secret_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY must be a Supabase secret key or legacy service_role key.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const productImageBucket = process.env.SUPABASE_PRODUCT_BUCKET || "Sulthan_porur";
