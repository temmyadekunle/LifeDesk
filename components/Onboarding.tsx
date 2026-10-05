"use client";

import { useState } from "react";

import { Icon, type IconName } from "./Icons";
import { Logo } from "./Logo";
import { BrandPanel } from "./BrandArt";
import { LOCALES, LOCALE_NAMES, makeT, type Locale, type Translate } from "@/lib/i18n";
import type { TKey } from "@/lib/locales/en";
import type { Category } from "@/lib/types";
import { TINT_SOFT, tint } from "@/lib/color";

const OPTIONS: { id: Category; labelKey: TKey; icon: IconName; color: string }[] = [
  { id: "home", labelKey: "cat.home", icon: "home", color: "var(--home)" },
  { id: "transport", labelKey: "cat.transport", icon: "car", color: "var(--transport)" },
  { id: "money", labelKey: "cat.money", icon: "wallet", color: "var(--money)" },
  { id: "documents", labelKey: "cat.documents", icon: "file", color: "var(--documents)" },
  { id: "family", labelKey: "cat.family", icon: "users", color: "var(--family)" },
  { id: "services", labelKey: "cat.services", icon: "wrench", color: "var(--services)" },
];

export interface OnboardingResult {
  displayName: string;
  categories: Category[];
  firstThing: { name: string; amount: string; dueDate: string } | null;
  loadSample: boolean;
  locale: Locale;
}

export function LocalePicker({
  locale,
  onChange,
  t,
}: {
  locale: Locale;
  onChange: (locale: Locale) => void;
  t: Translate;
}) {
  return (
    <div className="chips" role="group" aria-label={t("ob.language")}>
      {LOCALES.map((id) => (
        <button
          key={id}
          type="button"
          lang={id}
          className={id === locale ? "chip chip--on" : "chip"}
          aria-pressed={id === locale}
          onClick={() => onChange(id)}
        >
          <Icon name="globe" size={15} />
          {LOCALE_NAMES[id]}
        </button>
      ))}
    </div>
  );
}

const STEP_FEATURE: { icon: IconName; labelKey: TKey }[] = [
  { icon: "bell", labelKey: "ob.f.early" },
  { icon: "calendar", labelKey: "ob.f.calendar" },
  { icon: "cloud", labelKey: "ob.f.sync" },
];

export default function Onboarding({
  onDone,
  onSample,
  locale: initialLocale,
}: {
  onDone: (result: OnboardingResult) => void;
  onSample: (locale: Locale) => void;
  locale: Locale;
}) {
  const [step, setStep] = useState(0);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Category[]>([]);
  const [thingName, setThingName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const t = makeT(locale);

  function toggle(id: Category) {
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  function finish(loadSample: boolean) {
    if (loadSample) {
      onSample(locale);
      return;
    }
    onDone({
      displayName: name.trim(),
      categories: picked,
      firstThing: thingName.trim()
        ? { name: thingName.trim(), amount, dueDate }
        : null,
      loadSample: false,
      locale,
    });
  }

  return (
    <div className="ob" lang={locale}>
<div className="ob-brand">
        <Logo variant="wordmark" priority />
        <h1>Livanta</h1>
        <p>{t("app.tagline")}</p>
      </div>

      <div className="ob-steps" role="presentation">
        {[0, 1, 2].map((i) => (
          <span key={i} className={step === i ? "ob-step ob-step--on" : "ob-step"} />
        ))}
      </div>

      {step === 0 ? (
        <>
          <BrandPanel variant="adire" height={124}>
            <p style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600 }}>
              {t("ob.welcome")}
            </p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", opacity: 0.9 }}>
              {t("ob.localOnly")}
            </p>
          </BrandPanel>

          <h2 className="ob-h">{t("ob.whatCallYou")}</h2>
          <p className="card-meta" style={{ marginBottom: "0.875rem" }}>
            {t("ob.nameBlurb")}
          </p>

          <div className="field">
            <label htmlFor="ob-name">{t("ob.firstName")}</label>
            <input
              id="ob-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("ob.namePlaceholder")}
              autoComplete="given-name"
            />
          </div>

          <div className="field">
            <label htmlFor="ob-lang">{t("ob.language")}</label>
            <LocalePicker locale={locale} onChange={setLocale} t={t} />
          </div>

          <div className="stack stack--tight" style={{ marginTop: "0.25rem" }}>
            {STEP_FEATURE.map((f) => (
              <div className="rowline" key={f.labelKey}>
                <span className="listrow__lead" style={{ color: "var(--brand-700)" }}>
                  <Icon name={f.icon} size={18} />
                </span>
                <span className="listrow__sub" style={{ whiteSpace: "normal" }}>
                  {t(f.labelKey)}
                </span>
              </div>
            ))}
          </div>

          <button
            className="btn btn--primary btn--lg btn--block"
            onClick={() => setStep(1)}
            disabled={!name.trim()}
            style={{ marginTop: "1rem" }}
          >
            {t("ob.continue")}
            <Icon name="arrowRight" size={18} />
          </button>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <h2 className="ob-h">{t("ob.whatManage")}</h2>
          <p className="card-meta" style={{ marginBottom: "0.875rem" }}>
            {t("ob.pickAll")}
          </p>

          <div className="grid grid--2">
            {OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                className="tile"
                aria-pressed={picked.includes(o.id)}
                onClick={() => toggle(o.id)}
                style={
                  picked.includes(o.id)
                    ? { borderColor: o.color, background: tint(o.color, 5) }
                    : undefined
                }
              >
                <span
                  className="tile__icon"
                  style={{ color: o.color, background: tint(o.color, TINT_SOFT) }}
                >
                  <Icon name={o.icon} size={19} />
                </span>
                <span className="tile__label">{t(o.labelKey)}</span>
                {picked.includes(o.id) ? (
                  <span
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      color: o.color,
                    }}
                  >
                    <Icon name="checkCircle" size={18} />
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="quick-grid" style={{ marginTop: "1rem" }}>
            <button className="btn btn--secondary" onClick={() => setStep(0)}>
              {t("ob.back")}
            </button>
            <button
              className="btn btn--primary"
              onClick={() => setStep(2)}
              disabled={picked.length === 0}
            >
              {t("ob.continue")}
            </button>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <BrandPanel variant="chevron" height={96}>
            <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600 }}>
              {t("ob.addFirst")}
            </p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", opacity: 0.9 }}>
              {t("ob.willRemind")}
            </p>
          </BrandPanel>

          <h2 className="ob-h" style={{ marginTop: "0.25rem" }}>
            {t("ob.firstThingTitle")}
          </h2>

          <div className="field">
            <label htmlFor="ob-thing">{t("ob.whatIsIt")}</label>
            <input
              id="ob-thing"
              value={thingName}
              onChange={(e) => setThingName(e.target.value)}
              placeholder={t("ob.thingPlaceholder")}
            />
          </div>

          <div className="field field--row">
            <div>
              <label htmlFor="ob-amount">{t("ob.amount")}</label>
              <input
                id="ob-amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t("ob.amountPlaceholder")}
              />
            </div>
            <div>
              <label htmlFor="ob-due">{t("ob.dueDate")}</label>
              <input
                id="ob-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="quick-grid">
            <button className="btn btn--secondary" onClick={() => setStep(1)}>
              {t("ob.back")}
            </button>
            <button
              className="btn btn--primary"
              onClick={() => finish(false)}
              disabled={!thingName.trim()}
            >
              {t("ob.finish")}
            </button>
          </div>

          <button
            className="btn btn--soft btn--block"
            style={{ marginTop: "0.5rem" }}
            onClick={() => finish(true)}
          >
            <Icon name="sparkles" size={18} />
            {t("ob.sample")}
          </button>

          <p className="phase-note">{t("ob.sampleHint")}</p>
        </>
      ) : null}
    </div>
  );
}