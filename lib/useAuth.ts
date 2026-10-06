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
 *
 * The state lives in a module-level store rather than in each hook call. The
 * app calls `useAuth()` from both LivantaApp and useCloudSync, and two separate
 * instances each held their own `user` plus their own onAuthStateChange
 * subscription. That could drift: the UI could show signed-in while sync still
 * believed it was signed out, and the second subscription was pure overhead.
 * One store means one subscription, one session, and one error to read.
 */

import { useCallback, useSyncExternalStore } from "react";
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
  /** Sign in with Google OAuth. */
  signInWithGoogle: () => Promise<boolean>;
  /** Sign in with Apple OAuth. */
  signInWithApple: () => Promise<boolean>;
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

interface AuthState {
  status: AuthStatus;
  user: User | null;
  error: AuthError | null;
  needsEmailConfirmation: boolean;
  passwordResetReady: boolean;
}

/** Seeded from a constant, so an unconfigured build never needs a state update. */
function initialState(): AuthState {
  return {
    status: isCloudEnabled() ? "loading" : "disabled",
    user: null,
    error: null,
    needsEmailConfirmation: false,
    passwordResetReady: false,
  };
}

let state: AuthState = initialState();
const listeners = new Set<() => void>();
let started = false;

/**
 * Replaces the state object rather than mutating it, which is what lets
 * useSyncExternalStore see a new reference and re-render.
 */
function emit(patch: Partial<AuthState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

const getSnapshot = () => state;

function start() {
  if (started) return;
  started = true;

  if (!isCloudEnabled()) return;
  const supabase = getSupabase();
  if (!supabase) return;

  // Deliberately not torn down when the last hook unmounts. Tearing it down
  // would drop the session mid-navigation and re-run getSession on every mount,
  // which is the churn the shared store exists to remove. Supabase's
  // subscription lives for the lifetime of the page, as it would in any app.
  supabase.auth.onAuthStateChange((event, session) => {
    emit({ user: session?.user ?? null, status: session ? "signed-in" : "signed-out" });

    // A recovery link establishes a real session, so `status` alone reads as an
    // ordinary sign-in and the app would show the signed-in screen instead of
    // asking for the new password the user came to set. Only this event arms the
    // reset flow, and nothing else disarms it: TOKEN_REFRESHED fires straight
    // afterwards and must not clear the flag out from under the form.
    if (event === "PASSWORD_RECOVERY") {
      emit({ passwordResetReady: true, needsEmailConfirmation: false });
    }
  });

  void supabase.auth.getSession().then(({ data: sessionData }) => {
    emit({
      user: sessionData.session?.user ?? null,
      status: sessionData.session ? "signed-in" : "signed-out",
    });
  });
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAuth(): UseAuth {
  const enabled = isCloudEnabled();
  const session = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const signIn = useCallback(async (email: string, password: string) => {
    emit({ error: null });
    const supabase = getSupabase();
    if (!supabase) return false;

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      emit({ error: toAuthError(signInError) });
      return false;
    }
    return true;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    emit({ error: null, needsEmailConfirmation: false });
    const supabase = getSupabase();
    if (!supabase) return false;

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (signUpError) {
      emit({ error: toAuthError(signUpError) });
      return false;
    }
    // When email confirmation is switched on in the Supabase project there is
    // no session yet. Say so, otherwise the screen would look like nothing
    // happened after a successful sign-up.
    if (!data.session && data.user) emit({ needsEmailConfirmation: true });
    return true;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    emit({ error: null });
    const supabase = getSupabase();
    if (!supabase) return false;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      // Supabase appends the token to this and redirects back into the app.
      { redirectTo: `${window.location.origin}${window.location.pathname}` },
    );
    if (resetError) {
      emit({ error: toAuthError(resetError) });
      return false;
    }
    return true;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    emit({ error: null });
    const supabase = getSupabase();
    if (!supabase) return false;

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      emit({ error: toAuthError(updateError) });
      return false;
    }
    // The reset is done, so stop forcing the new-password form on the next
    // render. Clearing only on success means an expired or already-used link
    // leaves the form up with its error rather than dropping the user back to a
    // sign-in screen that cannot explain what went wrong.
    emit({ passwordResetReady: false });
    return true;
  }, []);

  const signOut = useCallback(async () => {
    emit({ needsEmailConfirmation: false, passwordResetReady: false });
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    emit({ error: null });
    const supabase = getSupabase();
    if (!supabase) return false;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });
    if (error) {
      emit({ error: toAuthError(error) });
      return false;
    }
    return true;
  }, []);

  const signInWithApple = useCallback(async () => {
    emit({ error: null });
    const supabase = getSupabase();
    if (!supabase) return false;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });
    if (error) {
      emit({ error: toAuthError(error) });
      return false;
    }
    return true;
  }, []);

  const clearError = useCallback(() => emit({ error: null }), []);

  return {
    enabled,
    status: session.status,
    user: session.user,
    error: session.error,
    needsEmailConfirmation: session.needsEmailConfirmation,
    passwordResetReady: session.passwordResetReady,
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    signOut,
    clearError,
    signInWithGoogle,
    signInWithApple,
  };
}
