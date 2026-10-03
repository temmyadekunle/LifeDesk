"use client";

import Image from "next/image";
import { useState } from "react";
import { LOCALES, LOCALE_NAMES, makeT, type Locale, type Translate } from "@/lib/i18n";
import type { TKey } from "@/lib/locales/en";
import type { Category } from "@/lib/types";

const OPTIONS: { id: Category; labelKey: TKey; ico: string }[] = [
  { id: "home", labelKey: "cat.home", ico: "🏠" },
  { id: "transport", labelKey: "kind.vehicle", ico: "🚗" },
  { id: "money", labelKey: "kind.bill", ico: "💳" },
  { id: "documents", labelKey: "cat.documents", ico: "📄" },
  { id: "family", labelKey: "cat.family", ico: "👨‍👩‍👧" },
  { id: "services", labelKey: "cat.services", ico: "🔧" },
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
          className={id === locale ? "chip on" : "chip"}
          aria-pressed={id === locale}
          onClick={() => onChange(id)}
        >
          {LOCALE_NAMES[id]}
        </button>
      ))}
    </div>
  );
}

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
        <div className="ob-logo-box">
          <Image
            src="/logo.jpeg"
            alt="LifeDesk logo"
            width={1080}
            height={720}
            priority
            className="ob-logo"
          />
        </div>
        <h1>LifeDesk</h1>
        <p>{t("app.tagline")}</p>
      </div>

      <div className="ob-steps">
        <span className={step === 0 ? "ob-step on" : "ob-step"} />
        <span className={step === 1 ? "ob-step on" : "ob-step"} />
        <span className={step === 2 ? "ob-step on" : "ob-step"} />
      </div>

      {step === 0 && (
        <section className="card">
          <p className="section-label">{t("ob.welcome")}</p>
          <h2 className="ob-h">{t("ob.whatCallYou")}</h2>
          <p className="card-meta">{t("ob.localOnly")}</p>
          <div className="field">
            <label htmlFor="ob-lang">{t("ob.language")}</label>
            <LocalePicker locale={locale} onChange={setLocale} t={t} />
          </div>
          <div className="field">
            <label htmlFor="ob-name">{t("ob.firstName")}</label>
            <input
              id="ob-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("ob.namePlaceholder")}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setStep(1)}
            disabled={!name.trim()}
          >
            {t("ob.continue")}
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="card">
          <p className="section-label">{t("ob.step2")}</p>
          <h2 className="ob-h">{t("ob.whatManage")}</h2>
          <p className="card-meta">{t("ob.pickAll")}</p>
          <div className="chips" style={{ marginTop: 12 }}>
            {OPTIONS.map((o) => (
              <button
                key={o.id}
                className={picked.includes(o.id) ? "chip on" : "chip"}
                onClick={() => toggle(o.id)}
              >
                {o.ico} {t(o.labelKey)}
              </button>
            ))}
          </div>
          <div className="quick-grid" style={{ marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => setStep(0)}>
              {t("ob.back")}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setStep(2)}
              disabled={picked.length === 0}
            >
              {t("ob.continue")}
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="card">
          <p className="section-label">{t("ob.step3")}</p>
          <h2 className="ob-h">{t("ob.addFirst")}</h2>
          <p className="card-meta">{t("ob.willRemind")}</p>
          <div className="field">
            <label htmlFor="ob-thing">{t("ob.whatIsIt")}</label>
            <input
              id="ob-thing"
              value={thingName}
              onChange={(e) => setThingName(e.target.value)}
              placeholder={t("ob.thingPlaceholder")}
            />
          </div>
          <div className="field">
            <label htmlFor="ob-amount">{t("ob.amount")}</label>
            <input
              id="ob-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t("ob.amountPlaceholder")}
            />
          </div>
          <div className="field">
            <label htmlFor="ob-due">{t("ob.dueDate")}</label>
            <input
              id="ob-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="quick-grid">
            <button className="btn btn-secondary" onClick={() => setStep(1)}>
              {t("ob.back")}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => finish(false)}
              disabled={!thingName.trim()}
            >
              {t("ob.finish")}
            </button>
          </div>
          <button
            className="btn btn-secondary"
            style={{ width: "100%", marginTop: 10 }}
            onClick={() => finish(true)}
          >
            {t("ob.sample")}
          </button>
        </section>
      )}
    </div>
  );
}