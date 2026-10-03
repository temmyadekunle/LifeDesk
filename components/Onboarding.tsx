"use client";

import Image from "next/image";
import { useState } from "react";
import type { Category } from "@/lib/types";

const OPTIONS: { id: Category; label: string; ico: string }[] = [
  { id: "home", label: "Home", ico: "🏠" },
  { id: "transport", label: "Vehicle", ico: "🚗" },
  { id: "money", label: "Bills", ico: "💳" },
  { id: "documents", label: "Documents", ico: "📄" },
  { id: "family", label: "Family", ico: "👨‍👩‍👧" },
  { id: "services", label: "Maintenance", ico: "🔧" },
];

export interface OnboardingResult {
  displayName: string;
  categories: Category[];
  firstThing: { name: string; amount: string; dueDate: string } | null;
  loadSample: boolean;
}

export default function Onboarding({
  onDone,
  onSample,
}: {
  onDone: (result: OnboardingResult) => void;
  onSample: () => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Category[]>([]);
  const [thingName, setThingName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  function toggle(id: Category) {
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  function finish(loadSample: boolean) {
    onDone({
      displayName: name.trim(),
      categories: picked,
      firstThing: thingName.trim()
        ? { name: thingName.trim(), amount, dueDate }
        : null,
      loadSample,
    });
  }

  return (
    <div className="ob">
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
        <p>One place to manage the things that keep your life running.</p>
      </div>

      <div className="ob-steps">
        <span className={step === 0 ? "ob-step on" : "ob-step"} />
        <span className={step === 1 ? "ob-step on" : "ob-step"} />
        <span className={step === 2 ? "ob-step on" : "ob-step"} />
      </div>

      {step === 0 && (
        <section className="card">
          <p className="section-label">Welcome</p>
          <h2 className="ob-h">What should we call you?</h2>
          <p className="card-meta">
            LifeDesk lives on your device. Nothing is uploaded and no account is
            needed.
          </p>
          <div className="field">
            <label htmlFor="ob-name">First name</label>
            <input
              id="ob-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Temmy"
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setStep(1)}
            disabled={!name.trim()}
          >
            Continue
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="card">
          <p className="section-label">Step 2</p>
          <h2 className="ob-h">What do you want to manage?</h2>
          <p className="card-meta">Pick everything that applies. You can change this later.</p>
          <div className="chips" style={{ marginTop: 12 }}>
            {OPTIONS.map((o) => (
              <button
                key={o.id}
                className={picked.includes(o.id) ? "chip on" : "chip"}
                onClick={() => toggle(o.id)}
              >
                {o.ico} {o.label}
              </button>
            ))}
          </div>
          <div className="quick-grid" style={{ marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => setStep(0)}>
              Back
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setStep(2)}
              disabled={picked.length === 0}
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="card">
          <p className="section-label">Step 3</p>
          <h2 className="ob-h">Add your first important item</h2>
          <p className="card-meta">
            LifeDesk will create reminders around the date you set.
          </p>
          <div className="field">
            <label htmlFor="ob-thing">What is it?</label>
            <input
              id="ob-thing"
              value={thingName}
              onChange={(e) => setThingName(e.target.value)}
              placeholder="e.g. Rent"
            />
          </div>
          <div className="field">
            <label htmlFor="ob-amount">Amount (optional)</label>
            <input
              id="ob-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 1200000"
            />
          </div>
          <div className="field">
            <label htmlFor="ob-due">Next due date</label>
            <input
              id="ob-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="quick-grid">
            <button className="btn btn-secondary" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              className="btn btn-primary"
              onClick={() => finish(false)}
              disabled={!thingName.trim()}
            >
              Finish
            </button>
          </div>
          <button
            className="btn btn-secondary"
            style={{ width: "100%", marginTop: 10 }}
            onClick={onSample}
          >
            Explore with sample data instead
          </button>
        </section>
      )}
    </div>
  );
}