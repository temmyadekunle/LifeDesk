import test from "node:test";

import { amountOrZero, hasAmount, parseAmount } from "../lib/money.ts";
import { formatNaira } from "../lib/i18n.ts";
import { assert } from "./helpers.ts";

test("parseAmount", async (t) => {
  await t.test("reads a plain figure", () => {
    assert.equal(parseAmount("45000"), 45_000);
    assert.equal(parseAmount("1200000"), 1_200_000);
  });

  await t.test("reads a decimal", () => {
    assert.equal(parseAmount("45000.50"), 45_000.5);
  });

  // These are the inputs that used to produce NaN. Number() rejects every one
  // of them, which is the bug this module exists to fix.
  await t.test("reads grouped thousands, which Number() cannot", () => {
    assert.equal(parseAmount("45,000"), 45_000);
    assert.equal(parseAmount("1,200,000"), 1_200_000);
  });

  await t.test("reads a naira sign, which Number() cannot", () => {
    assert.equal(parseAmount("₦45000"), 45_000);
    assert.equal(parseAmount("₦ 1,200,000"), 1_200_000);
  });

  await t.test("reads a spaced or padded figure", () => {
    assert.equal(parseAmount(" 45000 "), 45_000);
    assert.equal(parseAmount("45 000"), 45_000);
  });

  await t.test("treats blank as no amount", () => {
    assert.equal(parseAmount(""), null);
    assert.equal(parseAmount("   "), null);
    assert.equal(parseAmount("₦"), null);
  });

  // The critical property: junk must become null, never NaN.
  await t.test("turns junk into null rather than NaN", () => {
    for (const junk of ["abc", "1.2.3", "12abc", "NaN", "Infinity", "--5", "₦abc"]) {
      assert.equal(parseAmount(junk), null, `${junk} should not parse`);
    }
  });

  await t.test("never returns NaN or a non-finite value", () => {
    for (const input of ["1,000", "abc", "", "  ", "₦", "1.2.3", "45 000"]) {
      const out = parseAmount(input);
      assert.ok(out === null || Number.isFinite(out), `${input} produced ${out}`);
    }
  });
});

test("hasAmount", async (t) => {
  await t.test("accepts real numbers including zero", () => {
    assert.ok(hasAmount(0));
    assert.ok(hasAmount(45_000));
    assert.ok(hasAmount(-1));
  });

  // The defect: NaN is not null, so `amount !== null` let it through to the
  // formatter and it rendered as ₦NaN.
  await t.test("rejects NaN, which !== null lets through", () => {
    assert.ok(!hasAmount(NaN));
  });

  await t.test("rejects null, undefined and non-numbers", () => {
    assert.ok(!hasAmount(null));
    assert.ok(!hasAmount(undefined));
    assert.ok(!hasAmount("45000" as never));
    assert.ok(!hasAmount(Infinity));
  });
});

test("amountOrZero", async (t) => {
  await t.test("passes through real amounts", () => {
    assert.equal(amountOrZero(250_000), 250_000);
    assert.equal(amountOrZero(0), 0);
  });

  await t.test("maps missing amounts to zero", () => {
    assert.equal(amountOrZero(null), 0);
    assert.equal(amountOrZero(undefined), 0);
  });

  // The reason ?? 0 was not good enough.
  await t.test("maps NaN to zero, unlike ??", () => {
    assert.equal(amountOrZero(NaN), 0);
    assert.ok((NaN ?? 0) !== 0);
  });

  await t.test("a single corrupt row cannot poison a total", () => {
    const rows = [{ amount: 150_000 }, { amount: NaN }, { amount: 250_000 }];
    const broken = rows.reduce((s, r) => s + (r.amount ?? 0), 0);
    const fixed = rows.reduce((s, r) => s + amountOrZero(r.amount), 0);
    assert.ok(Number.isNaN(broken), "the old expression is the bug being fixed");
    assert.equal(fixed, 400_000);
  });
});

test("formatNaira", async (t) => {
  await t.test("formats a figure", () => {
    assert.equal(formatNaira(1_200_000), "\u20A61,200,000");
  });

  await t.test("renders nothing for NaN rather than ₦NaN", () => {
    assert.equal(formatNaira(NaN), "");
    assert.notEqual(formatNaira(NaN), `\u20A6NaN`);
  });

  await t.test("renders nothing for a non-finite value", () => {
    assert.equal(formatNaira(Infinity), "");
    assert.equal(formatNaira(-Infinity), "");
  });
});

test("the reported symptom", async (t) => {
  await t.test("a grouped amount survives parsing and totals", () => {
    const amount = parseAmount("1,200,000");
    assert.equal(amount, 1_200_000);
    assert.ok(hasAmount(amount));
    assert.equal(formatNaira(amount), "\u20A61,200,000");
  });

  await t.test("a typo degrades to no amount, not a broken app", () => {
    // "1,200,000 naira" strips to "1200000naira", which is not a number.
    const amount = parseAmount("1,200,000 naira");
    assert.equal(amount, null);
    assert.ok(!hasAmount(amount));
    assert.equal(amountOrZero(amount), 0);
  });

  await t.test("odd grouping is still read as the number it spells", () => {
    // Stripping separators cannot distinguish sloppy grouping from correct
    // grouping, and 1200000 is what the user meant.
    assert.equal(parseAmount("1,2,0,0,0,0"), 120_000);
  });
});
