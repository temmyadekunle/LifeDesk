"use client";

import { useState } from "react";

import { Icon } from "./Icons";
import { TINT_SOFT, tint } from "@/lib/color";
import { Sheet } from "./ui";
import ThingEditor, { fromEditorValues, type EditorPreset } from "./ThingEditor";
import type { Frequency } from "@/lib/types";
import type { Translate } from "@/lib/i18n";
import type { TKey } from "@/lib/locales/en";

/**
 * Add flow: pick what kind of thing this is, then fill a short form.
 *
 * The grid is the shortcut; the form still exposes category and type so the
 * quick choice is a starting point rather than a constraint.
 */

interface QuickType {
  key: TKey;
  icon: Parameters<typeof Icon>[0]["name"];
  kind: EditorPreset["kind"];
  category: EditorPreset["category"];
  color: string;
  /** Repeats every year unless the user changes it. */
  frequency?: Frequency;
}

export const QUICK_TYPES: QuickType[] = [
  { key: "qa.home", icon: "home", kind: "rent", category: "home", color: "var(--home)" },
  { key: "qa.vehicle", icon: "car", kind: "vehicle", category: "transport", color: "var(--transport)" },
  { key: "qa.bill", icon: "receipt", kind: "bill", category: "money", color: "var(--money)" },
  { key: "qa.subscription", icon: "repeat", kind: "subscription", category: "money", color: "var(--money)" },
  { key: "qa.document", icon: "file", kind: "document", category: "documents", color: "var(--documents)" },
  { key: "qa.family", icon: "users", kind: "birthday", category: "family", color: "var(--family)", frequency: "annual" },
  { key: "qa.appointment", icon: "calendar", kind: "appointment", category: "family", color: "var(--family)" },
  { key: "qa.service", icon: "wrench", kind: "service-provider", category: "services", color: "var(--services)" },
  { key: "qa.task", icon: "checkSquare", kind: "task", category: "family", color: "var(--family)" },
  { key: "qa.importantDate", icon: "flag", kind: "important-date", category: "documents", color: "var(--documents)", frequency: "annual" },
];

export function QuickAddSheet({
  t,
  onClose,
  onSave,
  busy,
  initial,
  initialCategory,
}: {
  t: Translate;
  onClose: () => void;
  onSave: (values: ReturnType<typeof fromEditorValues>) => void;
  busy?: boolean;
  /** Jump straight to the form for this type, skipping the picker. */
  initial?: EditorPreset;
  /** When arriving from a category, narrow the picker to that category only. */
  initialCategory?: EditorPreset["category"];
}) {
  const [picked, setPicked] = useState<QuickType | null>(() => {
    if (!initial) return null;
    return (
      QUICK_TYPES.find((qt) => qt.kind === initial.kind && qt.category === initial.category) ?? null
    );
  });

  if (picked) {
    return (
      <Sheet title={t(picked.key)} onClose={() => setPicked(null)}>
        <ThingEditor
          preset={{ label: t(picked.key), kind: picked.kind, category: picked.category }}
          defaultFrequency={picked.frequency}
          t={t}
          onSave={(values) => onSave(fromEditorValues(values))}
          onCancel={() => setPicked(null)}
          busy={busy}
        />
      </Sheet>
    );
  }

  const types = initialCategory
    ? QUICK_TYPES.filter((qt) => qt.category === initialCategory)
    : QUICK_TYPES;

  return (
    <Sheet title={t("qa.title")} onClose={onClose}>
      <p className="card-meta" style={{ marginBottom: "0.875rem" }}>
        {t("qa.blurb")}
      </p>
      <div className="grid grid--2">
        {types.map((qt) => {
          return (
            <button
              key={qt.key}
              type="button"
              className="tile"
              onClick={() => setPicked(qt)}
            >
              <span
                className="tile__icon"
                style={{ color: qt.color, background: tint(qt.color, TINT_SOFT) }}
              >
                <Icon name={qt.icon} size={19} />
              </span>
              <span className="tile__label">{t(qt.key)}</span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}