"use client";

/**
 * Dedicated account screens: sign in, sign up, and password reset.
 *
 * These are separate screens rather than the inline panel on Profile because
 * typing an email and a password inside a scrolling settings list is exactly
 * the pattern that makes an app feel like a website.
 */

import { useState } from "react";

import { Icon } from "./Icons";
import { Notice } from "./ui";
import type { Translate } from "@/lib/i18n";
import type { UseAuth } from "@/lib/useAuth";

type Mode = "sign-in" | "sign-up" | "forgot" | "new-password";

export function AuthScreen({
  t,
  auth,
  onClose,
  onDone,
}: {
  t: Translate;
  auth: UseAuth;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [manualMode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  /* Arriving from an emailed recovery link means the only useful thing to show
     is the new-password form, whichever mode the user last left this screen in.
     Derived rather than synced in an effect: a recovery link establishes a real
     session, so this screen can mount with manualMode at its default, and an
     effect would need a second render to correct it. Naming the derived value
     `mode` keeps every mode comparison below, and the submit handler, correct
     without special-casing. */
  const mode: Mode = auth.passwordResetReady ? "new-password" : manualMode;

  if (!auth.enabled) {
    return (
      <div className="stack">
        <Notice tone="info" icon="cloud">
          <strong>{t("account.offlineOnly")}</strong>
          <br />
          {t("account.offlineOnlyBody")}
        </Notice>
        <button className="btn btn--secondary btn--block" onClick={onClose}>
          {t("app.back")}
        </button>
      </div>
    );
  }

  /* A recovery link signs the user in, so this must not claim they are done.
     Without the second condition the recovery session renders the signed-in
     panel and the new-password form is unreachable. */
  if (auth.status === "signed-in" && !auth.passwordResetReady) {
    return (
      <div className="stack">
        <div className="card">
          <div className="rowline">
            <span className="listrow__lead" style={{ color: "var(--ok)" }}>
              <Icon name="checkCircle" size={19} />
            </span>
            <div className="listrow__body">
              <p className="listrow__title">{auth.user?.email}</p>
              <p className="listrow__sub">{t("account.subtitle")}</p>
            </div>
          </div>
        </div>
        <button
          className="btn btn--danger btn--block"
          onClick={() => void auth.signOut()}
        >
          <Icon name="logOut" size={18} />
          {t("account.signOut")}
        </button>
        <button className="btn btn--ghost btn--block" onClick={onClose}>
          {t("app.back")}
        </button>
      </div>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    if (mode === "forgot") {
      if (!email.trim()) return;
      setBusy(true);
      const ok = await auth.resetPassword(email);
      setBusy(false);
      if (ok) {
        setSent(true);
        onDone(t("auth.resetSent"));
      }
      return;
    }

    if (mode === "new-password") {
      if (password.length < 6) return;
      setBusy(true);
      const ok = await auth.updatePassword(password);
      setBusy(false);
      if (ok) {
        setPassword("");
        setMode("sign-in");
        onDone(t("auth.passwordUpdated"));
      }
      return;
    }

    if (!email.trim() || !password) return;
    setBusy(true);
    const ok =
      mode === "sign-in"
        ? await auth.signIn(email, password)
        : await auth.signUp(email, password);
    setBusy(false);

    if (!ok) {
      setPassword("");
      return;
    }
    if (auth.needsEmailConfirmation) {
      onDone(t("auth.checkEmail"));
    } else {
      onDone(mode === "sign-in" ? t("auth.signedInToast") : t("auth.signedUpToast"));
    }
  }

  const title =
    mode === "sign-in"
      ? t("auth.signInTitle")
      : mode === "sign-up"
        ? t("auth.signUpTitle")
        : mode === "forgot"
          ? t("auth.forgotTitle")
          : t("auth.newPasswordTitle");

  const blurb =
    mode === "sign-in"
      ? t("auth.signInBlurb")
      : mode === "sign-up"
        ? t("auth.signUpBlurb")
        : mode === "forgot"
          ? t("auth.forgotBlurb")
          : t("auth.newPasswordBlurb");

  return (
    <div>
      <div className="ob-brand" style={{ textAlign: "left", marginBottom: "1rem" }}>
        <h2 className="ob-h" style={{ marginBottom: "0.25rem" }}>
          {title}
        </h2>
        <p className="card-meta">{blurb}</p>
      </div>

      {auth.needsEmailConfirmation && mode === "sign-in" ? (
        <div style={{ marginBottom: "0.875rem" }}>
          <Notice tone="info" icon="mail">
            <strong>{t("auth.checkEmailTitle")}</strong>
            <br />
            {t("auth.checkEmailBody")}
          </Notice>
        </div>
      ) : null}

      <form onSubmit={submit}>
        {mode !== "new-password" ? (
          <div className="field">
            <label htmlFor="a-email">{t("account.email")}</label>
            <input
              id="a-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>
        ) : null}

        {mode !== "forgot" ? (
          <div className="field">
            <label htmlFor="a-password">{t("account.password")}</label>
            <div style={{ position: "relative" }}>
              <input
                id="a-password"
                type={show ? "text" : "password"}
                autoComplete={
                  mode === "sign-in" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: "3rem" }}
              />
              <button
                type="button"
                className="searchbar__clear"
                style={{ right: "0.125rem" }}
                onClick={() => setShow((v) => !v)}
                aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")}
              >
                <Icon name={show ? "eyeOff" : "eye"} size={18} />
              </button>
            </div>
            {mode === "sign-up" ? (
              <p className="hint">{t("auth.passwordHint")}</p>
            ) : null}
          </div>
        ) : null}

        {auth.error ? (
          <div style={{ marginBottom: "0.875rem" }}>
            <Notice tone="danger">{errorLabel(t, auth.error.code)}</Notice>
          </div>
        ) : null}

        {sent && mode === "forgot" ? (
          <div style={{ marginBottom: "0.875rem" }}>
            <Notice tone="ok" icon="mail">
              {t("auth.resetSentBody")}
            </Notice>
          </div>
        ) : null}

<button
          type="submit"
          className="btn btn--primary btn--lg btn--block"
          disabled={
            busy ||
            (mode === "forgot" ? !email.trim() : mode === "new-password" ? password.length < 6 : !email.trim() || !password)
          }
        >
          {busy ? (
            t("auth.working")
          ) : mode === "sign-in" ? (
            t("auth.signInTitle")
          ) : mode === "sign-up" ? (
            t("auth.signUpTitle")
          ) : mode === "forgot" ? (
            t("auth.forgotTitle")
          ) : (
            t("auth.savePassword")
          )}
        </button>

        {mode === "sign-in" && auth.enabled && (
          <div className="stack stack--tight" style={{ marginTop: "0.875rem" }}>
            <div className="divider" style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--ink-400)", fontSize: "0.75rem" }}>
              <span style={{ flex: 1, borderTop: "1px solid var(--line)" }} />
              {t("auth.or")}
              <span style={{ flex: 1, borderTop: "1px solid var(--line)" }} />
            </div>
            <button
              type="button"
              className="btn btn--secondary btn--block"
              onClick={() => void auth.signInWithGoogle()}
              disabled={busy}
            >
              <Icon name="google" size={20} />
              <span style={{ marginLeft: "0.5rem" }}>{t("auth.signInWithGoogle")}</span>
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--block"
              onClick={() => void auth.signInWithApple()}
              disabled={busy}
            >
              <Icon name="apple" size={20} />
              <span style={{ marginLeft: "0.5rem" }}>{t("auth.signInWithApple")}</span>
            </button>
          </div>
        )}

        <div className="stack stack--tight" style={{ marginTop: "0.875rem" }}>
        {mode === "sign-in" ? (
          <>
            <button
              type="button"
              className="btn btn--ghost btn--block"
              onClick={() => {
                auth.clearError();
                setMode("sign-up");
              }}
            >
              {t("account.needAccount")}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--block"
              onClick={() => {
                auth.clearError();
                setMode("forgot");
              }}
            >
              {t("auth.forgotLink")}
            </button>
          </>
        ) : null}

        {mode === "sign-up" ? (
          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={() => {
              auth.clearError();
              setMode("sign-in");
            }}
          >
            {t("account.haveAccount")}
          </button>
        ) : null}

        {mode === "forgot" ? (
          <>
            <button
              type="button"
              className="btn btn--ghost btn--block"
              onClick={() => {
                setSent(false);
                setMode("sign-in");
              }}
            >
              {t("auth.backToSignIn")}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--block"
              onClick={() => {
                setSent(false);
                setMode("new-password");
              }}
            >
              {t("auth.haveResetLink")}
            </button>
          </>
        ) : null}

        {mode === "new-password" && !auth.passwordResetReady ? (
          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={() => {
              setMode("sign-in");
            }}
          >
            {t("auth.backToSignIn")}
          </button>
        ) : null}
      </div>

      </form>

      <p className="card-meta" style={{ marginTop: "1rem", textAlign: "center" }}>
        {t("sync.offline")}
      </p>
    </div>
  );
}

function errorLabel(t: Translate, code: string): string {
  if (code === "invalid-credentials") return t("auth.invalid");
  if (code === "email-taken") return t("auth.emailTaken");
  if (code === "rate-limited") return t("auth.rateLimited");
  return t("auth.unknown");
}