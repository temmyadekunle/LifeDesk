"use client";

import { useState } from "react";
import { Icon } from "./Icons";
import type { EditorPreset, EditorValues } from "@/lib/editor";
import type { Translate } from "@/lib/i18n";
import type { TKey } from "@/lib/locales/en";
import type { Category, Frequency, ThingKind } from "@/lib/types";

export { fromEditorValues, toEditorValues } from "@/lib/editor";
export type { EditorPreset, EditorValues } from "@/lib/editor";

const CATEGORY_OPTIONS: { id: Category; labelKey: TKey }[] = [
  { id: "home", labelKey: "cat.home" },
  { id: "transport", labelKey: "cat.transport" },
  { id: "money", labelKey: "cat.money" },
  { id: "documents", labelKey: "cat.documents" },
  { id: "family", labelKey: "cat.family" },
  { id: "services", labelKey: "cat.services" },
];

const KIND_OPTIONS: { id: ThingKind; labelKey: TKey }[] = [
  { id: "rent", labelKey: "kind.rent" },
  { id: "utility", labelKey: "kind.utility" },
  { id: "bill", labelKey: "kind.bill" },
  { id: "subscription", labelKey: "kind.subscription" },
  { id: "school-fee", labelKey: "kind.school-fee" },
  { id: "vehicle", labelKey: "kind.vehicle" },
  { id: "fuel", labelKey: "kind.fuel" },
  { id: "maintenance", labelKey: "kind.maintenance" },
  { id: "insurance", labelKey: "kind.insurance" },
  { id: "document", labelKey: "kind.document" },
  { id: "asset", labelKey: "kind.asset" },
  { id: "appointment", labelKey: "kind.appointment" },
  { id: "reminder", labelKey: "kind.reminder" },
  { id: "service-provider", labelKey: "kind.service-provider" },
  { id: "task", labelKey: "kind.task" },
  { id: "birthday", labelKey: "kind.birthday" },
  { id: "important-date", labelKey: "kind.important-date" },
];

const FREQUENCY_OPTIONS: { id: Frequency; labelKey: TKey }[] = [
  { id: "none", labelKey: "freq.none" },
  { id: "weekly", labelKey: "freq.weekly" },
  { id: "biweekly", labelKey: "freq.biweekly" },
  { id: "monthly", labelKey: "freq.monthly" },
  { id: "quarterly", labelKey: "freq.quarterly" },
  { id: "biannual", labelKey: "freq.biannual" },
  { id: "annual", labelKey: "freq.annual" },
];

export default function ThingEditor({
  preset,
  initial,
  defaultFrequency = "none",
  onSave,
  onCancel,
  busy,
  t,
}: {
  preset: EditorPreset;
  initial?: EditorValues;
  /** Used by Quick Add so a birthday starts life repeating yearly. */
  defaultFrequency?: Frequency;
  onSave: (values: EditorValues) => void;
  onCancel: () => void;
  busy?: boolean;
  t: Translate;
}) {
  const [v, setV] = useState<EditorValues>(
    initial ?? {
      name: "",
      category: preset.category,
      kind: preset.kind,
      amount: "",
      dueDate: "",
      frequency: defaultFrequency,
      notes: "",
    },
  );

  const set = <K extends keyof EditorValues>(key: K, value: EditorValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="editor">
      <p className="section-label">
        {initial
          ? t("ed.editPrefix", { label: preset.label.toLowerCase() })
          : t("ed.newPrefix", { label: preset.label.toLowerCase() })}
      </p>

      <div className="field">
        <label htmlFor="e-name">{t("ed.whatIsIt")}</label>
        <input
          id="e-name"
          value={v.name}
          onChange={(e) => set("name", e.target.value.slice(0, 100))}
          placeholder={t("ed.whatPlaceholder")}
          maxLength={100}
          required
        />
        {v.name.length >= 100 && (
          <p className="hint" style={{ color: "var(--danger)" }}>
            {t("ed.nameTooLong")}
          </p>
        )}
      </div>

      <div className="field field--row">
        <div>
          <label htmlFor="e-kind">{t("ed.type")}</label>
          <select
            id="e-kind"
            value={v.kind}
            onChange={(e) => set("kind", e.target.value as ThingKind)}
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.id} value={k.id}>
                {t(k.labelKey)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="e-category">{t("ed.category")}</label>
          <select
            id="e-category"
            value={v.category}
            onChange={(e) => set("category", e.target.value as Category)}
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {t(c.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field field--row">
        <div>
          <label htmlFor="e-due">{t("ed.dueDate")}</label>
          <input
            id="e-due"
            type="date"
            value={v.dueDate}
            onChange={(e) => set("dueDate", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="e-amount">{t("ed.amount")}</label>
          <input
            id="e-amount"
            inputMode="decimal"
            value={v.amount}
            onChange={(e) => {
              const val = e.target.value;
              // Only allow digits, decimal point, and leading minus sign
              if (/^-?\d*\.?\d*$/.test(val) || val === "-" || val === "") {
                set("amount", val);
              }
            }}
            placeholder={t("ed.amountPlaceholder")}
          />
          {v.amount && !/^-?\d+(\.\d+)?$/.test(v.amount) && (
            <p className="hint" style={{ color: "var(--danger)" }}>
              {t("ed.amountInvalid")}
            </p>
          )}
        </div>
      </div>
      <p className="field hint" style={{ marginTop: "-0.5rem" }}>
        {t("ed.dueHint")}
      </p>

      <div className="field">
        <label htmlFor="e-freq">{t("ed.repeats")}</label>
        <select
          id="e-freq"
          value={v.frequency}
          onChange={(e) => set("frequency", e.target.value as Frequency)}
        >
          {FREQUENCY_OPTIONS.map((f) => (
            <option key={f.id} value={f.id}>
              {t(f.labelKey)}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="e-notes">{t("ed.note")}</label>
        <textarea
          id="e-notes"
          value={v.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder={t("ed.notePlaceholder")}
          rows={2}
        />
      </div>

      <div className="quick-grid" style={{ marginTop: "0.25rem" }}>
        <button className="btn btn--secondary" onClick={onCancel} type="button">
          {t("ed.cancel")}
        </button>
        <button
          className="btn btn--primary"
          onClick={() => onSave(v)}
          disabled={!v.name.trim() || busy}
          type="button"
        >
          <Icon name="check" size={18} />
          {busy ? t("ed.saving") : t("ed.save")}
        </button>
      </div>
    </div>
  );
}