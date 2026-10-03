"use client";

import { useState } from "react";
import type { Category, Frequency, Thing, ThingKind } from "@/lib/types";

const CATEGORY_OPTIONS: { id: Category; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "transport", label: "Transport" },
  { id: "money", label: "Money" },
  { id: "documents", label: "Documents" },
  { id: "family", label: "Family" },
  { id: "services", label: "Services" },
];

const KIND_OPTIONS: { id: ThingKind; label: string }[] = [
  { id: "rent", label: "Rent" },
  { id: "utility", label: "Utility" },
  { id: "bill", label: "Bill" },
  { id: "subscription", label: "Subscription" },
  { id: "school-fee", label: "School fee" },
  { id: "vehicle", label: "Vehicle" },
  { id: "fuel", label: "Fuel" },
  { id: "maintenance", label: "Maintenance" },
  { id: "insurance", label: "Insurance" },
  { id: "document", label: "Document" },
  { id: "asset", label: "Asset" },
  { id: "appointment", label: "Appointment" },
  { id: "reminder", label: "Reminder" },
  { id: "service-provider", label: "Service provider" },
];

const FREQUENCY_OPTIONS: { id: Frequency; label: string }[] = [
  { id: "none", label: "One-off" },
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Every 2 weeks" },
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
  { id: "biannual", label: "Twice a year" },
  { id: "annual", label: "Yearly" },
];

export interface EditorPreset {
  kind: ThingKind;
  category: Category;
  label: string;
}

export interface EditorValues {
  name: string;
  category: Category;
  kind: ThingKind;
  amount: string;
  dueDate: string;
  frequency: Frequency;
  notes: string;
}

export function toEditorValues(thing: Thing): EditorValues {
  return {
    name: thing.name,
    category: thing.category,
    kind: thing.kind,
    amount: thing.amount === null ? "" : String(thing.amount),
    dueDate: thing.dueDate ?? "",
    frequency: thing.recurrence?.frequency ?? "none",
    notes: thing.notes ?? "",
  };
}

export function fromEditorValues(v: EditorValues) {
  return {
    name: v.name.trim(),
    category: v.category,
    kind: v.kind,
    amount: v.amount.trim() === "" ? null : Number(v.amount),
    dueDate: v.dueDate.trim() === "" ? null : v.dueDate,
    recurrence:
      v.frequency === "none" ? null : { frequency: v.frequency, interval: 1 },
    notes: v.notes.trim() === "" ? null : v.notes.trim(),
  };
}

export default function ThingEditor({
  preset,
  initial,
  onSave,
  onCancel,
  busy,
}: {
  preset: EditorPreset;
  initial?: EditorValues;
  onSave: (values: EditorValues) => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [v, setV] = useState<EditorValues>(
    initial ?? {
      name: "",
      category: preset.category,
      kind: preset.kind,
      amount: "",
      dueDate: "",
      frequency: "none",
      notes: "",
    },
  );

  const set = <K extends keyof EditorValues>(key: K, value: EditorValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="editor">
      <p className="section-label">{initial ? "Edit" : "New"} {preset.label.toLowerCase()}</p>

      <div className="field">
        <label htmlFor="e-name">What is it?</label>
        <input
          id="e-name"
          value={v.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Water bill"
        />
      </div>

      <div className="field">
        <label htmlFor="e-category">Category</label>
        <select
          id="e-category"
          value={v.category}
          onChange={(e) => set("category", e.target.value as Category)}
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="e-kind">Type</label>
        <select
          id="e-kind"
          value={v.kind}
          onChange={(e) => set("kind", e.target.value as ThingKind)}
        >
          {KIND_OPTIONS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="e-amount">Amount (optional)</label>
        <input
          id="e-amount"
          inputMode="numeric"
          value={v.amount}
          onChange={(e) => set("amount", e.target.value)}
          placeholder="e.g. 45000"
        />
      </div>

      <div className="field">
        <label htmlFor="e-due">Due or expiry date</label>
        <input
          id="e-due"
          type="date"
          value={v.dueDate}
          onChange={(e) => set("dueDate", e.target.value)}
        />
        <div className="hint">Leave empty if there is no date yet.</div>
      </div>

      <div className="field">
        <label htmlFor="e-freq">Repeats</label>
        <select
          id="e-freq"
          value={v.frequency}
          onChange={(e) => set("frequency", e.target.value as Frequency)}
        >
          {FREQUENCY_OPTIONS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="e-notes">Note (optional)</label>
        <input
          id="e-notes"
          value={v.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="e.g. Pay before the 25th"
        />
      </div>

      <div className="quick-grid">
        <button className="btn btn-secondary" onClick={onCancel} type="button">
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={() => onSave(v)}
          disabled={!v.name.trim() || busy}
          type="button"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}