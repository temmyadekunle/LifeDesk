"use client";

import {
  summariseAssets,
  summariseBills,
  summariseDocuments,
  summariseHome,
  summariseVehicles,
} from "@/lib/modules";
import { daysUntil } from "@/lib/risk";
import type { Thing } from "@/lib/types";

export type ModuleId =
  | "home"
  | "vehicles"
  | "bills"
  | "documents"
  | "assets";

export const MODULES: {
  id: ModuleId;
  label: string;
  ico: string;
  blurb: string;
  color: string;
}[] = [
  {
    id: "home",
    label: "Home",
    ico: "🏠",
    blurb: "Rent, utilities and maintenance",
    color: "var(--home)",
  },
  {
    id: "vehicles",
    label: "Vehicles",
    ico: "🚗",
    blurb: "Service, fuel and documents",
    color: "var(--transport)",
  },
  {
    id: "bills",
    label: "Bills",
    ico: "💳",
    blurb: "Recurring payments and money due",
    color: "var(--money)",
  },
  {
    id: "documents",
    label: "Documents",
    ico: "📄",
    blurb: "Expiry dates and renewals",
    color: "var(--documents)",
  },
  {
    id: "assets",
    label: "Assets",
    ico: "📦",
    blurb: "Warranties and what you own",
    color: "var(--assets)",
  },
];

const naira = (n: number) => `\u20A6${n.toLocaleString("en-NG")}`;

export default function ModuleScreen({
  module,
  things,
  onOpenThing,
}: {
  module: ModuleId;
  things: Thing[];
  onOpenThing: (thing: Thing) => void;
}) {
  switch (module) {
    case "home":
      return <HomeModule things={things} onOpenThing={onOpenThing} />;
    case "vehicles":
      return <VehiclesModule things={things} onOpenThing={onOpenThing} />;
    case "bills":
      return <BillsModule things={things} onOpenThing={onOpenThing} />;
    case "documents":
      return <DocumentsModule things={things} onOpenThing={onOpenThing} />;
    case "assets":
      return <AssetsModule things={things} onOpenThing={onOpenThing} />;
  }
}

function Row({
  thing,
  onOpen,
  right,
}: {
  thing: Thing;
  onOpen: () => void;
  right?: React.ReactNode;
}) {
  return (
    <button className="row-btn" onClick={onOpen}>
      <div className="row">
        <span className="grow">
          <div className="name">{thing.name}</div>
          {thing.notes && <div className="sub">{thing.notes}</div>}
        </span>
        {right}
      </div>
    </button>
  );
}

function HomeModule({
  things,
  onOpenThing,
}: {
  things: Thing[];
  onOpenThing: (t: Thing) => void;
}) {
  const s = summariseHome(things);

  return (
    <>
      <section className="card">
        <p className="section-label">Properties</p>
        {s.properties.map((p) => (
          <div key={p.id}>
            <Row
              thing={p}
              onOpen={() => onOpenThing(p)}
              right={
                p.amount ? <span className="sub">{naira(p.amount)}</span> : undefined
              }
            />
            {typeof p.details.landlord === "string" && (
              <p className="sub" style={{ padding: "0 0 10px" }}>
                Landlord: {p.details.landlord}
                {typeof p.details.serviceCharge === "number"
                  ? ` · Service charge ${naira(p.details.serviceCharge)}`
                  : ""}
              </p>
            )}
          </div>
        ))}
        {s.properties.length === 0 && (
          <p className="card-meta">No property added yet.</p>
        )}
      </section>

      <section className="card">
        <p className="section-label">Home maintenance</p>
        {s.overdueMaintenance.length > 0 && (
          <p className="card-meta" style={{ marginBottom: 10 }}>
            {s.overdueMaintenance.length} item
            {s.overdueMaintenance.length === 1 ? "" : "s"} need servicing.
          </p>
        )}
        {s.maintenance.map((m) => (
          <Row
            key={m.id}
            thing={m}
            onOpen={() => onOpenThing(m)}
            right={
              m.lastHandledDate ? (
                <span className="sub">
                  {Math.round(
                    (Date.now() - new Date(m.lastHandledDate).getTime()) /
                      86_400_000,
                  )}{" "}
                  d ago
                </span>
              ) : undefined
            }
          />
        ))}
        {s.maintenance.length === 0 && (
          <p className="card-meta">Nothing tracked for maintenance.</p>
        )}
      </section>

      <section className="card">
        <p className="section-label">Next 30 days</p>
        <div className="amount">{naira(s.monthlyOutgoings)}</div>
        <p className="card-meta">Known household outgoings.</p>
      </section>
    </>
  );
}

function VehiclesModule({
  things,
  onOpenThing,
}: {
  things: Thing[];
  onOpenThing: (t: Thing) => void;
}) {
  const groups = summariseVehicles(things);

  if (groups.length === 0) {
    return (
      <section className="card">
        <p className="card-meta">No vehicles added yet.</p>
      </section>
    );
  }

  return (
    <>
      {groups.map((g) => (
        <section className="card" key={g.name}>
          <p className="section-label">{g.name}</p>
          {g.serviceDue.length > 0 && (
            <p className="card-meta" style={{ marginBottom: 10 }}>
              {g.serviceDue.length} service item
              {g.serviceDue.length === 1 ? "" : "s"} due or overdue.
            </p>
          )}
          {g.nextDue && (
            <p className="card-meta" style={{ marginBottom: 10 }}>
              Next due: {g.nextDue.name}
              {g.nextDue.dueDate
                ? ` in ${Math.max(0, daysUntil(g.nextDue.dueDate))} days`
                : ""}
              .
            </p>
          )}
          {g.things.map((t) => (
            <Row
              key={t.id}
              thing={t}
              onOpen={() => onOpenThing(t)}
              right={
                t.amount ? (
                  <span className="sub">{naira(t.amount)}</span>
                ) : (
                  <span className="sub">{t.kind}</span>
                )
              }
            />
          ))}
          <p className="sub" style={{ paddingTop: 10 }}>
            Recorded spend: {naira(g.totalSpend)}
          </p>
        </section>
      ))}
    </>
  );
}

function BillsModule({
  things,
  onOpenThing,
}: {
  things: Thing[];
  onOpenThing: (t: Thing) => void;
}) {
  const s = summariseBills(things);

  return (
    <>
      <section className="card">
        <p className="section-label">Next 30 days</p>
        <div className="amount">{naira(s.next30Total)}</div>
        <p className="card-meta">
          {s.recurring.length} recurring payment
          {s.recurring.length === 1 ? "" : "s"} · {naira(s.recurringTotal)} total
          per cycle
        </p>
      </section>

      {s.largest && (
        <section className="card alert-soon">
          <p className="section-label">Largest commitment</p>
          <h3 className="card-title">{s.largest.name}</h3>
          <p className="card-meta">{naira(s.largest.amount ?? 0)}</p>
        </section>
      )}

      <section className="card">
        <p className="section-label">Recurring payments</p>
        {s.recurring.map((t) => (
          <Row
            key={t.id}
            thing={t}
            onOpen={() => onOpenThing(t)}
            right={
              <span className="sub">
                {t.amount ? naira(t.amount) : ""}{" "}
                {t.dueDate ? `· ${daysUntil(t.dueDate)}d` : ""}
              </span>
            }
          />
        ))}
        {s.recurring.length === 0 && (
          <p className="card-meta">No recurring payments.</p>
        )}
      </section>

      {s.oneOff.length > 0 && (
        <section className="card">
          <p className="section-label">One-off payments</p>
          {s.oneOff.map((t) => (
            <Row
              key={t.id}
              thing={t}
              onOpen={() => onOpenThing(t)}
              right={
                t.amount ? <span className="sub">{naira(t.amount)}</span> : undefined
              }
            />
          ))}
        </section>
      )}
    </>
  );
}

function DocumentsModule({
  things,
  onOpenThing,
}: {
  things: Thing[];
  onOpenThing: (t: Thing) => void;
}) {
  const s = summariseDocuments(things);

  const group = (label: string, list: Thing[], tone?: string) =>
    list.length > 0 && (
      <section className={`card ${tone ?? ""}`} key={label}>
        <p className="section-label">{label}</p>
        {list.map((t) => (
          <Row
            key={t.id}
            thing={t}
            onOpen={() => onOpenThing(t)}
            right={
              t.dueDate ? (
                <span className="sub">{daysUntil(t.dueDate)}d left</span>
              ) : undefined
            }
          />
        ))}
      </section>
    );

  return (
    <>
      {group("Expiring soon", s.expiringSoon, "alert-soon")}
      {group("This year", s.thisYear)}
      {group("Later", s.later)}
      {s.noExpiry.length > 0 && group("No expiry recorded", s.noExpiry)}
      {s.expiringSoon.length + s.thisYear.length + s.later.length +
        s.noExpiry.length ===
        0 && (
        <section className="card">
          <p className="card-meta">No documents stored yet.</p>
        </section>
      )}
    </>
  );
}

function AssetsModule({
  things,
  onOpenThing,
}: {
  things: Thing[];
  onOpenThing: (t: Thing) => void;
}) {
  const s = summariseAssets(things);

  if (s.rows.length === 0) {
    return (
      <section className="card">
        <p className="card-meta">No assets registered yet.</p>
      </section>
    );
  }

  const badge = (state?: string) =>
    state === "expired" ? (
      <span className="badge b-urgent">expired</span>
    ) : state === "expiring" ? (
      <span className="badge b-important">expiring</span>
    ) : (
      <span className="badge b-upcoming">covered</span>
    );

  return (
    <>
      <section className="card">
        <p className="section-label">Portfolio</p>
        <div className="stat-row">
          <div className="stat">
            <div className="stat-num routine">{s.covered.length}</div>
            <div className="stat-label">covered</div>
          </div>
          <div className="stat">
            <div className="stat-num important">{s.expiring.length}</div>
            <div className="stat-label">expiring</div>
          </div>
          <div className="stat">
            <div className="stat-num urgent">{s.expired.length}</div>
            <div className="stat-label">expired</div>
          </div>
        </div>
        <p className="sub" style={{ paddingTop: 10 }}>
          Total value {naira(s.totalValue)}
        </p>
      </section>

      {s.expired.length > 0 && (
        <section className="card alert-urgent">
          <p className="section-label">Warranty expired</p>
          {s.expired.map((r) => (
            <Row
              key={r.thing.id}
              thing={r.thing}
              onOpen={() => onOpenThing(r.thing)}
              right={badge(r.warranty?.state)}
            />
          ))}
        </section>
      )}

      {s.expiring.length > 0 && (
        <section className="card alert-soon">
          <p className="section-label">Expiring soon</p>
          {s.expiring.map((r) => (
            <Row
              key={r.thing.id}
              thing={r.thing}
              onOpen={() => onOpenThing(r.thing)}
              right={
                <span className="sub">
                  {r.warranty?.daysLeft}d left
                </span>
              }
            />
          ))}
        </section>
      )}

      {s.covered.length > 0 && (
        <section className="card accent-teal">
          <p className="section-label">Under warranty</p>
          {s.covered.map((r) => (
            <Row
              key={r.thing.id}
              thing={r.thing}
              onOpen={() => onOpenThing(r.thing)}
              right={badge(r.warranty?.state)}
            />
          ))}
        </section>
      )}

      {s.rows.filter((r) => !r.warranty).length > 0 && (
        <section className="card">
          <p className="section-label">No warranty recorded</p>
          {s.rows
            .filter((r) => !r.warranty)
            .map((r) => (
              <Row
                key={r.thing.id}
                thing={r.thing}
                onOpen={() => onOpenThing(r.thing)}
              />
            ))}
        </section>
      )}
    </>
  );
}