import test from "node:test";

import { assert } from "./helpers.ts";

import { dayPart } from "../lib/dates.ts";
import { en } from "../lib/locales/en.ts";
import { greetingKey } from "../lib/useDayPart.ts";

/** Built in local time on purpose: dayPart reads the reader's own clock, so a
    test that pinned the zone would be testing the wrong thing. */
function at(hour: number, minute = 0): Date {
  const d = new Date(2026, 9, 3, hour, minute, 0, 0);
  return d;
}

test("dayPart", async (t) => {
  await t.test("calls the early hours evening, not morning", () => {
    // "Good morning" at 02:00 reads as though the app has the wrong idea of the
    // time, which is the complaint this whole change started from.
    assert.equal(dayPart(at(0)), "evening");
    assert.equal(dayPart(at(4, 59)), "evening");
  });

  await t.test("starts the morning at five", () => {
    assert.equal(dayPart(at(5)), "morning");
    assert.equal(dayPart(at(11, 59)), "morning");
  });

  await t.test("treats noon as the afternoon", () => {
    assert.equal(dayPart(at(12)), "afternoon");
    assert.equal(dayPart(at(17, 59)), "afternoon");
  });

  await t.test("starts the evening at six", () => {
    assert.equal(dayPart(at(18)), "evening");
    assert.equal(dayPart(at(23, 59)), "evening");
  });

  await t.test("covers all 24 hours with no hour unclaimed", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const part = dayPart(at(hour));
      assert.ok(
        part === "morning" || part === "afternoon" || part === "evening",
        `hour ${hour} produced ${part}`,
      );
    }
  });

  await t.test("never reports the same part on both sides of a boundary", () => {
    const boundaries: Array<[number, string, string]> = [
      [5, "evening", "morning"],
      [12, "morning", "afternoon"],
      [18, "afternoon", "evening"],
      // Midnight wraps rather than advancing to a fourth label.
      [0, "evening", "evening"],
    ];
    for (const [hour, before, after] of boundaries) {
      assert.equal(dayPart(at(hour)), after, `hour ${hour} should start ${after}`);
      assert.equal(dayPart(at(hour - 1 === -1 ? 23 : hour - 1)), before);
    }
  });
});

test("greetingKey", async (t) => {
  await t.test("maps each part to its own key", () => {
    assert.equal(greetingKey("morning"), "app.greeting.morning");
    assert.equal(greetingKey("afternoon"), "app.greeting.afternoon");
    assert.equal(greetingKey("evening"), "app.greeting.evening");
  });

  await t.test("the three keys are actually different sentences", () => {
    // Guards against a copy-paste that leaves every greeting identical, which
    // would pass the "differs from English" locale check while still being wrong.
    assert.notEqual(en["app.greeting.morning"], en["app.greeting.afternoon"]);
    assert.notEqual(en["app.greeting.afternoon"], en["app.greeting.evening"]);
    assert.notEqual(en["app.greeting.morning"], en["app.greeting.evening"]);
  });
});
