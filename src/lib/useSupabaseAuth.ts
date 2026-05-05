import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

export type AuthStatus =
  | { kind: "loading" }
  | { kind: "unconfigured" } // env vars missing
  | { kind: "anonymous"; session: Session; user: User }
  | { kind: "authenticated"; session: Session; user: User }
  | { kind: "error"; message: string };

export interface AuthApi {
  status: AuthStatus;
  /**
   * Send a magic link to claim the current anonymous identity. Same
   * `user.id` is preserved — emotional state is NOT reset. The user
   * clicks the link, the page reloads, and the identity is upgraded.
   */
  claimWithEmail: (email: string) => Promise<{ error: string | null }>;
  /**
   * Sign in on a new device (existing email).
   */
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

/**
 * Bootstraps a Supabase session.
 *
 * Flow:
 *   - On mount: read current session.
 *   - If none: signInAnonymously() so the user has an auth.uid() right
 *     away. (Requires anonymous sign-ins enabled in Supabase Auth
 *     settings.)
 *   - Listen for onAuthStateChange so claim/sign-in/sign-out updates
 *     propagate to the rest of the app.
 *
 * The hook is safe to call once at the top of <App/>. Subsequent
 * components read the JWT off `status.session.access_token`.
 */
export function useSupabaseAuth(): AuthApi {
  const [status, setStatus] = useState<AuthStatus>({ kind: "loading" });

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setStatus({ kind: "unconfigured" });
      return;
    }
    const supabase = getSupabaseClient();
    let cancelled = false;

    async function bootstrap() {
      const { data: existing, error: getErr } = await supabase.auth.getSession();
      if (cancelled) return;
      if (getErr) {
        setStatus({ kind: "error", message: getErr.message });
        return;
      }
      if (existing.session) {
        applySession(existing.session);
        return;
      }
      const { data: anon, error: anonErr } =
        await supabase.auth.signInAnonymously();
      if (cancelled) return;
      if (anonErr || !anon.session) {
        setStatus({
          kind: "error",
          message:
            anonErr?.message ??
            "Couldn't start an anonymous session. Make sure anonymous sign-ins are enabled in Supabase.",
        });
        return;
      }
      applySession(anon.session);
    }

    function applySession(session: Session) {
      const user = session.user;
      const isAnon = Boolean(
        // Supabase exposes is_anonymous on the user object since 2024.
        (user as User & { is_anonymous?: boolean }).is_anonymous
      );
      setStatus({
        kind: isAnon ? "anonymous" : "authenticated",
        session,
        user,
      });
    }

    bootstrap();

    const sub = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (!session) {
        // Signed out — re-bootstrap as anonymous.
        bootstrap();
        return;
      }
      applySession(session);
    });

    return () => {
      cancelled = true;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  const claimWithEmail = async (
    email: string
  ): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured()) {
      return { error: "Auth is not configured." };
    }
    const supabase = getSupabaseClient();
    // updateUser triggers a confirmation email that, when clicked,
    // promotes the anonymous user to a permanent one (same uid).
    const { error } = await supabase.auth.updateUser({ email });
    return { error: error?.message ?? null };
  };

  const signInWithEmail = async (
    email: string
  ): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured()) {
      return { error: "Auth is not configured." };
    }
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async (): Promise<void> => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
  };

  return { status, claimWithEmail, signInWithEmail, signOut };
}
