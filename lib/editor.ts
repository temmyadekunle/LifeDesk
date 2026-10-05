import type { Category, Frequency, Thing, ThingKind } from "./types.ts";
import { hasAmount, parseAmount } from "./money.ts";

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
    amount: hasAmount(thing.amount) ? String(thing.amount) : "",
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
    amount: parseAmount(v.amount),
    dueDate: v.dueDate.trim() === "" ? null : v.dueDate,
    recurrence:
      v.frequency === "none" ? null : { frequency: v.frequency, interval: 1 },
    notes: v.notes.trim() === "" ? null : v.notes.trim(),
  };
}