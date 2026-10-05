"use client";

import { Icon } from "./Icons";
import { IconTile, Sheet } from "./ui";
import { dueMeta, TONE_CLASS } from "./labels";
import { CATEGORY_META, KIND_ICON } from "./maps";
import { formatFullDate } from "@/lib/dates";
import { formatNaira, type Translate } from "@/lib/i18n";
import { daysUntil } from "@/lib/risk";
import type { Frequency, Thing } from "@/lib/types";
import type { TKey } from "@/lib/locales/en";

const FREQUENCY_LABEL: Record<Frequency, TKey> = {
  none: "freq.none",
  weekly: "freq.weekly",
  biweekly: "freq.biweekly",
  monthly: "freq.monthly",
  quarterly: "freq.quarterly",
  biannual: "freq.biannual",
  annual: "freq.annual",
};

export function ThingDetailSheet({
  thing,
  t,
  leadDays,
  onClose,
  onEdit,
  onDelete,
  onHandle,
  busy,
}: {
  thing: Thing;
  t: Translate;
  leadDays: number[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onHandle: () => void;
  busy?: boolean;
}) {
  const meta = CATEGORY_META[thing.category];
  const due = dueMeta(thing, t);
  const handled = thing.lastHandledDate;

  const horizon = Math.max(7, ...leadDays);
  const days = thing.dueDate ? daysUntil(thing.dueDate) : null;
  const fill =
    days === null ? 0 : days <= 0 ? 1 : Math.max(0.06, Math.min(1, 1 - days / horizon));
  const meterTone = fill >= 0.999 ? "urgent" : fill > 0.66 ? "warn" : "ok";

  const phone =
    typeof thing.details.phone === "string" && thing.details.phone.trim()
      ? thing.details.phone
      : null;
  const address =
    typeof thing.details.address === "string" && thing.details.address.trim()
      ? thing.details.address
      : null;

  return (
    <Sheet title={t("thing.details")} onClose={onClose}>
      <div className="detail">
        <div className="detail__hero">
          <IconTile icon={KIND_ICON[thing.kind]} color={meta.color} size={20} />
          <div style={{ minWidth: 0, flex: "1 1 auto" }}>
            <h3 className="card-title" style={{ fontSize: "1.0625rem" }}>
              {thing.name}
            </h3>
            <div className="chips" style={{ marginTop: "0.375rem" }}>
              <span className={`badge ${TONE_CLASS[due.tone]}`}>{due.text}</span>
              <span className="badge b-brand" style={{ color: meta.color }}>
                {t(meta.labelKey)}
              </span>
              {thing.recurrence ? (
                <span className="badge b-done">
                  <Icon name="repeat" size={11} />
                  {t(FREQUENCY_LABEL[thing.recurrence.frequency])}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {thing.dueDate && thing.status !== "completed" ? (
          <div>
            <div className="meter">
              <div
                className={`meter__fill meter__fill--${meterTone}`}
                style={{ width: `${Math.round(fill * 100)}%` }}
              />
            </div>
            <p className="card-meta" style={{ marginTop: "0.375rem" }}>
              {t("thing.dueOn", { date: formatFullDate(thing.dueDate, t.locale) })}
            </p>
          </div>
        ) : null}

        <div className="card card--quiet" style={{ padding: "0.25rem 0.875rem" }}>
          {thing.dueDate ? (
            <Row k={t("thing.due")} v={formatFullDate(thing.dueDate, t.locale)} />
          ) : null}
          {thing.amount !== null ? (
            <Row k={t("thing.amount")} v={formatNaira(thing.amount)} />
          ) : null}
          <Row k={t("thing.category")} v={t(meta.labelKey)} />
          <Row k={t("thing.type")} v={t(`kind.${thing.kind}` as TKey)} />
          <Row k={t("thing.repeats")} v={t(FREQUENCY_LABEL[thing.recurrence?.frequency ?? "none"])} />
          <Row
            k={t("thing.lastHandled")}
            v={handled ? formatFullDate(handled, t.locale) : t("thing.neverHandled")}
          />
          {phone ? <Row k={t("thing.contact")} v={phone} /> : null}
          {address ? <Row k={t("thing.address")} v={address} /> : null}
        </div>

        <div>
          <p className="section-label">{t("thing.notesLabel")}</p>
          <p className="card-meta" style={{ whiteSpace: "pre-wrap" }}>
            {thing.notes?.trim() ? thing.notes : t("thing.noNotes")}
          </p>
        </div>

        <div className="quick-grid">
          {thing.status === "active" ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={onHandle}
              disabled={busy}
            >
              <Icon name="checkCircle" size={18} />
              {t("action.markHandled")}
            </button>
          ) : (
            <button type="button" className="btn btn--soft" disabled>
              <Icon name="checkCircle" size={18} />
              {t("row.completed")}
            </button>
          )}
          <button type="button" className="btn btn--secondary" onClick={onEdit}>
            <Icon name="edit" size={18} />
            {t("things.edit")}
          </button>
        </div>

        <button type="button" className="btn btn--danger btn--block" onClick={onDelete}>
          <Icon name="trash" size={18} />
          {t("things.delete")}
        </button>
      </div>
    </Sheet>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="kv">
      <span className="kv__k">{k}</span>
      <span className="kv__v">{v}</span>
    </div>
  );
}