"use client";

import { useMemo, useState } from "react";

import { Icon } from "../Icons";
import { EmptyState } from "../ui";
import { ThingLine } from "./HomeScreen";
import { CATEGORIES, CATEGORY_META } from "../maps";
import { daysUntil, type DayDiff } from "@/lib/risk";
import type { Category, Thing } from "@/lib/types";
import type { useLivanta } from "@/lib/useLivanta";

type Desk = ReturnType<typeof useLivanta>;
type StatusFilter = "active" | "all" | "completed";
type Group = "overdue" | "today" | "week" | "later" | "nodate";

const GROUP_LABEL: Record<Group, string> = {
  overdue: "things.group.overdue",
  today: "things.group.today",
  week: "things.group.week",
  later: "things.group.later",
  nodate: "things.group.nodate",
};

  function groupOf(thing: Thing, now?: Date, dayDiff?: DayDiff): Group {
    if (!thing.dueDate) return "nodate";
    const days = (dayDiff ?? daysUntil)(thing.dueDate, now ?? new Date());
    if (days < 0) return "overdue";
    if (days === 0) return "today";
    if (days <= 7) return "week";
    return "later";
  }

export function ThingsScreen({
    desk,
    onOpenThing,
    onAdd,
    now,
    dayDiff,
  }: {
    desk: Desk;
    onOpenThing: (thing: Thing) => void;
    onAdd: () => void;
    /** See ThingLine's 
ow: pins the clock for the static mockups. */
    now?: Date;
    /** See ThingLine's dayDiff. */
    dayDiff?: DayDiff;
  }) {
  const { t } = desk;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("active");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return desk.things
      .filter((thing) => {
        if (status === "active" && thing.status !== "active") return false;
        if (status === "completed" && thing.status !== "completed") return false;
        return true;
      })
      .filter((thing) => (category === "all" ? true : thing.category === category))
      .filter((thing) =>
        q === ""
          ? true
          : thing.name.toLowerCase().includes(q) ||
            (thing.notes ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "active" ? -1 : 1;
        if (a.dueDate === null) return 1;
        if (b.dueDate === null) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [desk.things, query, category, status]);

  const groups = useMemo(() => {
    const map = new Map<Group, Thing[]>();
    for (const thing of filtered) {
      const key =
        thing.status === "completed" ? "later" : groupOf(thing, now, dayDiff);
      const list = map.get(key) ?? [];
      list.push(thing);
      map.set(key, list);
    }
      return map;
    }, [filtered, now, dayDiff]);

  const completedCount = desk.things.filter((x) => x.status === "completed").length;

  return (
    <>
      <div className="searchbar">
        <Icon name="search" size={19} className="searchbar__icon" />
        <input
          id="t-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("things.searchPlaceholder")}
          aria-label={t("things.search")}
          type="search"
        />
        {query ? (
          <button
            type="button"
            className="searchbar__clear"
            onClick={() => setQuery("")}
            aria-label={t("ui.clear")}
          >
            <Icon name="x" size={18} />
          </button>
        ) : null}
      </div>

      <div className="chips" style={{ marginTop: "0.625rem" }}>
        <button
          className={category === "all" ? "chip chip--on" : "chip"}
          onClick={() => setCategory("all")}
        >
          {t("things.filterAll")}
        </button>
        {CATEGORIES.map((id) => {
          const meta = CATEGORY_META[id];
          return (
            <button
              key={id}
              className={category === id ? "chip chip--on" : "chip"}
              onClick={() => setCategory(id)}
              style={
                category === id
                  ? undefined
                  : { color: meta.color, borderColor: `${meta.color}44` }
              }
            >
              <Icon name={meta.icon} size={15} />
              {t(meta.labelKey)}
            </button>
          );
        })}
      </div>

      <div className="chips" style={{ marginTop: "0.5rem" }}>
        {(
          [
            ["active", t("things.active")],
            ["all", t("things.all")],
            ["completed", t("things.showCompleted", { n: completedCount })],
          ] as [StatusFilter, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            className={status === id ? "chip chip--on" : "chip chip--quiet"}
            onClick={() => setStatus(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">{t.n("things.count", filtered.length)}</h2>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon="inbox"
            title={query || category !== "all" ? t("things.nothingMatches") : t("things.emptyTitle")}
            body={query || category !== "all" ? undefined : t("things.emptyBody")}
            action={
              <button className="btn btn--soft" onClick={onAdd}>
                <Icon name="plus" size={18} />
                {t("home.quickAdd")}
              </button>
            }
          />
        ) : (
          <div className="stack">
            {[...groups.entries()].map(([group, items]) => (
              <div key={group}>
                <p className="agenda__day">{t(GROUP_LABEL[group] as never)}</p>
                <div className="list">
                  {items.map((thing) => (
                    <ThingLine
                      key={thing.id}
                      thing={thing}
                      desk={desk}
                      onOpen={onOpenThing}
                      now={now}
                      dayDiff={dayDiff}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}