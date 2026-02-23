import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During `next build` without env vars, return a placeholder that won't be
  // invoked at runtime (pages are behind auth proxy). This prevents
  // createBrowserClient from throwing during static-analysis / SSR prerender.
  if (!url || !key) {
    if (typeof window !== "undefined") {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
      );
    }
    return createBrowserClient<Database>(
      "http://localhost:54321",
      "placeholder-key-for-build"
    );
  }

  return createBrowserClient<Database>(url, key);
}
