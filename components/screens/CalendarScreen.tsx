"use client";

import { useMemo, useState } from "react";

import { Icon } from "../Icons";
import { EmptyState } from "../ui";
import { ThingLine } from "./HomeScreen";
import { addMonths, formatDate, formatMonthYear, monthMatrix, parseISO, toISO, weekdayInitials } from "@/lib/dates";
import type { Thing } from "@/lib/types";
import type { useLivanta } from "@/lib/useLivanta";

type Desk = ReturnType<typeof useLivanta>;

export function CalendarScreen({
  desk,
  onOpenThing,
  onAdd,
}: {
  desk: Desk;
  onOpenThing: (thing: Thing) => void;
  onAdd: () => void;
}) {
  const { t } = desk;
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const today = useMemo(() => new Date(), []);
  const [selected, setSelected] = useState<string>(() => toISO(today));

  const byDate = useMemo(() => {
    const map = new Map<string, Thing[]>();
    for (const thing of desk.things) {
      if (thing.status !== "active" || !thing.dueDate) continue;
      const list = map.get(thing.dueDate) ?? [];
      list.push(thing);
      map.set(thing.dueDate, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    }
    return map;
  }, [desk.things]);

  const cells = useMemo(() => monthMatrix(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const dow = useMemo(() => weekdayInitials(t.locale), [t.locale]);
  const todayIso = toISO(today);

  const selectedItems = byDate.get(selected) ?? [];

  const upcoming = useMemo(
    () =>
      desk.things
        .filter((thing) => thing.status === "active" && thing.dueDate && thing.dueDate >= todayIso)
        .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
        .slice(0, 5),
    [desk.things, todayIso],
  );

  return (
    <>
      <div className="month">
        <div className="month__head">
          <button
            type="button"
            className="iconbtn"
            onClick={() => setCursor(addMonths(cursor, -1))}
            aria-label={t("cal.prevMonth")}
          >
            <Icon name="chevronLeft" size={20} />
          </button>
          <h2 className="month__title">{formatMonthYear(cursor, t.locale)}</h2>
          <button
            type="button"
            className="iconbtn"
            onClick={() => setCursor(addMonths(cursor, 1))}
            aria-label={t("cal.nextMonth")}
          >
            <Icon name="chevronRight" size={20} />
          </button>
        </div>

        <div className="month__dow" aria-hidden="true">
          {dow.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>

        <div className="month__grid" role="grid" aria-label={t("cal.title")}>
          {cells.map((date) => {
            const iso = toISO(date);
            const items = byDate.get(iso) ?? [];
            const outside = date.getMonth() !== cursor.getMonth();
            const classes = [
              "day",
              outside ? "day--out" : "",
              iso === todayIso ? "day--today" : "",
              iso === selected ? "day--on" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <button
                key={iso}
                type="button"
                className={classes}
                onClick={() => setSelected(iso)}
                aria-label={formatDate(date, t.locale, { day: "numeric", month: "long" })}
                aria-current={iso === todayIso ? "date" : undefined}
              >
                {date.getDate()}
                {items.length > 0 ? (
                  <span className="day__dots" aria-hidden="true">
                    {items.slice(0, 3).map((item) => (
                      <span
                        key={item.id}
                        className={`day__dot${
                          item.priority === "urgent" ? " day__dot--urgent" : ""
                        }`}
                      />
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="btn btn--soft btn--block btn--sm"
          style={{ marginTop: "0.625rem" }}
          onClick={() => {
            setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
            setSelected(todayIso);
          }}
        >
          <Icon name="target" size={16} />
          {t("cal.jumpToday")}
        </button>
      </div>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">
            {formatDate(parseISO(selected), t.locale, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h2>
        </div>

        {selectedItems.length === 0 ? (
          <EmptyState
            icon="calendar"
            title={t("cal.noEvents")}
            body={t("cal.noEventsBody")}
            action={
              <button className="btn btn--soft" onClick={onAdd}>
                <Icon name="plus" size={18} />
                {t("home.quickAdd")}
              </button>
            }
          />
        ) : (
          <div className="list">
            {selectedItems.map((thing) => (
              <ThingLine key={thing.id} thing={thing} desk={desk} onOpen={onOpenThing} />
            ))}
          </div>
        )}
      </section>

      {upcoming.length > 0 ? (
        <section className="section">
          <div className="section__head">
            <h2 className="section__title">{t("cal.upcoming")}</h2>
          </div>
          <div className="list">
            {upcoming.map((thing) => (
              <ThingLine key={thing.id} thing={thing} desk={desk} onOpen={onOpenThing} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}