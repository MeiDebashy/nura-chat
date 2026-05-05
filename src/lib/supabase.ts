const URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

if (!URL || !ANON_KEY) {
  // Don't throw at module load — let the app render the missing-env screen.
  console.error(
    "[nura] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
      "Set them in your Vercel project's environment variables."
  );
}

export const isSupabaseConfigured = (): boolean =>
  Boolean(URL) && Boolean(ANON_KEY);

let _clientPromise: Promise<
  import("@supabase/supabase-js").SupabaseClient
> | null = null;

export async function getSupabaseClient(): Promise<
  import("@supabase/supabase-js").SupabaseClient
> {
  if (!_clientPromise) {
    _clientPromise = (async () => {
      const { createClient } = await import("@supabase/supabase-js");
      return createClient(URL, ANON_KEY, {
        auth: {
          // Persist session in localStorage so the user stays signed in
          // across reloads. Auto-refresh keeps the JWT fresh.
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true, // for magic-link callbacks
        },
      });
    })();
  }
  return _clientPromise;
}
