import test from "node:test";
import { computeLifeStatus } from "../lib/status.ts";
import { assert, buildAlerts, iso, makeAlert, makeThing, NOW } from "./helpers.ts";

test("computeLifeStatus", async (t) => {
  await t.test("stable when nothing is urgent or important", () => {
    const s = computeLifeStatus([], [], NOW);
    assert.equal(s.level, "stable");
    assert.equal(s.label, "Stable");
  });

  await t.test("needs attention when only important items exist", () => {
    const s = computeLifeStatus([], [makeAlert({ priority: "important" })], NOW);
    assert.equal(s.level, "needs-attention");
    assert.equal(s.headline, "1 thing should be handled soon.");
  });

  await t.test("pluralises the important headline", () => {
    const s = computeLifeStatus(
      [],
      [
        makeAlert({ id: "1", priority: "important" }),
        makeAlert({ id: "2", priority: "important" }),
      ],
      NOW,
    );
    assert.equal(s.headline, "2 things should be handled soon.");
  });

  await t.test("immediate attention when anything is urgent", () => {
    const s = computeLifeStatus(
      [],
      [
        makeAlert({ id: "1", priority: "important" }),
        makeAlert({ id: "2", priority: "urgent" }),
      ],
      NOW,
    );
    assert.equal(s.level, "immediate");
    assert.equal(s.headline, "1 thing needs attention now.");
  });

  await t.test("dismissed alerts are ignored", () => {
    const s = computeLifeStatus(
      [],
      [makeAlert({ priority: "urgent", dismissed: true })],
      NOW,
    );
    assert.equal(s.level, "stable");
    assert.equal(s.urgentCount, 0);
  });

  await t.test("counts this week as 0-7 days out, excluding overdue", () => {
    const things = [
      makeThing({ id: "a", dueDate: iso(0) }),
      makeThing({ id: "b", dueDate: iso(7) }),
      makeThing({ id: "c", dueDate: iso(8) }),
      makeThing({ id: "d", dueDate: iso(-2) }),
    ];
    assert.equal(computeLifeStatus(things, [], NOW).thisWeekCount, 2);
  });

  await t.test("counts on-track excluding urgent and important things", () => {
    const things = [
      makeThing({ id: "far", dueDate: iso(200) }),
      makeThing({ id: "none", dueDate: null }),
      makeThing({ id: "overdue", dueDate: iso(-1) }),
    ];
    assert.equal(computeLifeStatus(things, [], NOW).onTrackCount, 2);
  });

  await t.test("ignores non-active things in all counts", () => {
    const things = [
      makeThing({ id: "a", status: "archived", dueDate: iso(1) }),
      makeThing({ id: "b", status: "completed", dueDate: iso(1) }),
    ];
    const s = computeLifeStatus(things, [], NOW);
    assert.equal(s.thisWeekCount, 0);
    assert.equal(s.onTrackCount, 0);
  });

  await t.test("derives status from real alerts", () => {
    const alerts = buildAlerts(
      [makeThing({ name: "Rent", kind: "rent", dueDate: iso(-3) })],
      NOW,
    );
    assert.equal(computeLifeStatus([], alerts, NOW).level, "immediate");
  });
});