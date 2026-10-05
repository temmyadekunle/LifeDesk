/**
 * Session state for optional cloud sync.
 *
 * Every method is safe to call when the app was built without Supabase
 * credentials: `enabled` is false, `user` stays null and the sign-in methods
 * report a translated-friendly error instead of throwing. That is what lets the
 * signed-out experience stay exactly as it is today.
 *
 * Note that no password ever touches this module's callers beyond the moment of
 * submission, and the session itself is held by supabase-js in local storage.
 */

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { getSupabase, isCloudEnabled } from "./supabase/client.ts";

export type AuthStatus = "disabled" | "loading" | "signed-out" | "signed-in";

export interface AuthError {
  /** A key from the translation catalogue, so the UI stays multilingual. */
  code: "invalid-credentials" | "email-taken" | "rate-limited" | "unknown";
  message: string;
}

export interface UseAuth {
  enabled: boolean;
  status: AuthStatus;
  user: User | null;
  error: AuthError | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

/**
 * Supabase error codes are matched rather than shown raw, so the user sees a
 * translated explanation instead of an English library string in a Hausa or
 * Yoruba interface.
 */
function toAuthError(error: { message: string } | null): AuthError {
  const message = error?.message ?? "";
  if (/invalid login credentials/i.test(message)) {
    return { code: "invalid-credentials", message };
  }
  if (/already registered|already exists/i.test(message)) {
    return { code: "email-taken", message };
  }
  if (/rate limit|too many/i.test(message)) {
    return { code: "rate-limited", message };
  }
  return { code: "unknown", message };
}

export function useAuth(): UseAuth {
  const enabled = isCloudEnabled();
  const [user, setUser] = useState<User | null>(null);
  // Seeded from a constant so the disabled case never needs a state update,
  // which would be a cascading render inside the effect below.
  const [status, setStatus] = useState<AuthStatus>(() =>
    enabled ? "loading" : "disabled",
  );
  const [error, setError] = useState<AuthError | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const supabase = getSupabase();
    if (!supabase) return;

    let active = true;

    // The callback runs outside the effect body, so this is a subscription
    // rather than a synchronous render-phase state change.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setStatus(session ? "signed-in" : "signed-out");
    });

    void supabase.auth.getSession().then(({ data: sessionData }) => {
      if (!active) return;
      setUser(sessionData.session?.user ?? null);
      setStatus(sessionData.session ? "signed-in" : "signed-out");
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [enabled]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    const supabase = getSupabase();
    if (!supabase) return false;

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError(toAuthError(signInError));
      return false;
    }
    return true;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setError(null);
    const supabase = getSupabase();
    if (!supabase) return false;

    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (signUpError) {
      setError(toAuthError(signUpError));
      return false;
    }
    return true;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { enabled, status, user, error, signIn, signUp, signOut, clearError };
}