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
  /** True right after signing up on a project that requires email confirmation. */
  needsEmailConfirmation: boolean;
  /**
   * True when the session in hand came from an emailed recovery link, so the
   * only sensible next step is choosing a new password. See the PASSWORD_RECOVERY
   * branch in the subscription below for why this is not just `signed-in`.
   */
  passwordResetReady: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  /** Sends a password-reset email. */
  resetPassword: (email: string) => Promise<boolean>;
  /** Completes a reset once the user has followed the emailed link. */
  updatePassword: (password: string) => Promise<boolean>;
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
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [passwordResetReady, setPasswordResetReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const supabase = getSupabase();
    if (!supabase) return;

    let active = true;

    // The callback runs outside the effect body, so this is a subscription
    // rather than a synchronous render-phase state change.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setStatus(session ? "signed-in" : "signed-out");

      // A recovery link establishes a real session, so `status` alone reads as
      // an ordinary sign-in and the app would show the signed-in screen instead
      // of asking for the new password the user came to set. Only this event
      // arms the reset flow, and nothing else disarms it: TOKEN_REFRESHED fires
      // straight afterwards and must not clear the flag out from under the form.
      if (event === "PASSWORD_RECOVERY") {
        setPasswordResetReady(true);
        setNeedsEmailConfirmation(false);
      }
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
    setNeedsEmailConfirmation(false);
    const supabase = getSupabase();
    if (!supabase) return false;

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (signUpError) {
      setError(toAuthError(signUpError));
      return false;
    }
    // When email confirmation is switched on in the Supabase project there is
    // no session yet. Say so, otherwise the screen would look like nothing
    // happened after a successful sign-up.
    if (!data.session && data.user) setNeedsEmailConfirmation(true);
    return true;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    const supabase = getSupabase();
    if (!supabase) return false;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      // Supabase appends the token to this and redirects back into the app.
      { redirectTo: `${window.location.origin}${window.location.pathname}` },
    );
    if (resetError) {
      setError(toAuthError(resetError));
      return false;
    }
    return true;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    setError(null);
    const supabase = getSupabase();
    if (!supabase) return false;

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(toAuthError(updateError));
      return false;
    }
    // The reset is done, so stop forcing the new-password form on the next
    // render. Clearing only on success means an expired or already-used link
    // leaves the form up with its error rather than dropping the user back to a
    // sign-in screen that cannot explain what went wrong.
    setPasswordResetReady(false);
    return true;
  }, []);

  const signOut = useCallback(async () => {
    setNeedsEmailConfirmation(false);
    setPasswordResetReady(false);
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    enabled,
    status,
    user,
    error,
    needsEmailConfirmation,
    passwordResetReady,
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    signOut,
    clearError,
  };
}