"use client";

/**
 * Small shared interface pieces: bottom sheet, toast, empty state, meter,
 * confirm dialog.
 *
 * They exist as components rather than as page-level markup because the whole
 * app is a single scrolling column inside a fixed shell, and the pattern
 * repeats on every screen.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { TINT_BORDER, TINT_SOFT, tint } from "@/lib/color";
import { Icon, type IconName } from "./Icons";

/* ------------------------------------------------------------------ sheet */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapTab(e: KeyboardEvent, container: HTMLElement) {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (nodes.length === 0) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const active = document.activeElement;

  if (e.shiftKey) {
    if (active === first || active === container || !container.contains(active)) {
      e.preventDefault();
      last.focus();
    }
  } else if (active === last || !container.contains(active)) {
    e.preventDefault();
    first.focus();
  }
}

export function Sheet({
  title,
  onClose,
  children,
  footer,
  labelledBy,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  labelledBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Store the element that had focus before the sheet opened.
    previousFocusRef.current = document.activeElement as HTMLElement;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) trapTab(e, panelRef.current);
    };
    document.addEventListener("keydown", onKey);
    // Move focus into the sheet so keyboard and screen-reader users land here.
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      // Restore focus to the element that opened the sheet.
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div className="sheet" role="presentation">
      <button
        type="button"
        className="sheet__backdrop"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? headingId}
        tabIndex={-1}
        ref={panelRef}
      >
        <div className="sheet__grip" aria-hidden="true" />
        <header className="sheet__head">
          <h2 className="sheet__title" id={headingId}>
            {title}
          </h2>
          <button
            type="button"
            className="iconbtn"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="x" size={22} />
          </button>
        </header>
        <div className="sheet__body">{children}</div>
        {footer ? <div className="sheet__foot">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ toast */

export interface ToastMessage {
  id: number;
  text: string;
  tone?: "ok" | "info" | "danger";
}

export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string, tone?: ToastMessage["tone"]) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), text, tone });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { toast, showToast: show };
}

export function Toast({ toast }: { toast: ToastMessage | null }) {
  if (!toast) return null;
  const icon: IconName =
    toast.tone === "danger" ? "alert" : toast.tone === "info" ? "info" : "checkCircle";
  return (
    <div className="toast" role="status" aria-live="polite">
      <Icon name={icon} size={20} className="toast__icon" />
      <span className="toast__body">{toast.text}</span>
    </div>
  );
}

/* ------------------------------------------------------------- empty state */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty__icon">
        <Icon name={icon} size={24} />
      </div>
      <h3 className="empty__title">{title}</h3>
      {body ? <p className="empty__body">{body}</p> : null}
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

export function IconTile({
  icon,
  color,
  size = 18,
}: {
  icon: IconName;
  color?: string;
  size?: number;
}) {
  return (
    <span
      className="listrow__lead"
      style={color ? { color, background: tint(color, TINT_SOFT), borderColor: tint(color, TINT_BORDER) } : undefined}
    >
      <Icon name={icon} size={size} />
    </span>
  );
}

export function Meter({ tone }: { tone: "urgent" | "warn" | "ok" }) {
  return (
    <div className="meter" aria-hidden="true">
      <div className={`meter__fill meter__fill--${tone}`} />
    </div>
  );
}

export function Notice({
  tone,
  icon,
  children,
}: {
  tone: "warn" | "danger" | "info" | "ok";
  icon?: IconName;
  children: React.ReactNode;
}) {
  const fallback: Record<typeof tone, IconName> = {
    warn: "alert",
    danger: "alert",
    info: "info",
    ok: "checkCircle",
  };
  return (
    <div className={`notice notice--${tone}`} role={tone === "danger" ? "alert" : undefined}>
      <Icon name={icon ?? fallback[tone]} size={18} className="notice__icon" />
      <div className="notice__body">{children}</div>
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="skel skel--line"
          style={{ width: `${100 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ confirm modal */

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      if (e.key === "Tab" && panelRef.current) trapTab(e, panelRef.current);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previousFocusRef.current?.focus();
    };
  }, [onCancel]);

  return (
    <div className="sheet" role="presentation">
      <button
        type="button"
        className="sheet__backdrop"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onCancel}
      />
      <div
        className="sheet__panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        tabIndex={-1}
        ref={panelRef}
        style={{ margin: "auto 1rem 1rem" }}
      >
        <div className="sheet__body">
          <h2 className="ob-h" id="confirm-title">
            {title}
          </h2>
          <p className="card-meta" id="confirm-body">
            {message}
          </p>
        </div>
        <div className="sheet__foot">
          <div className="quick-grid">
            <button type="button" className="btn btn--secondary" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button
              type="button"
              className={destructive ? "btn btn--danger" : "btn btn--primary"}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}