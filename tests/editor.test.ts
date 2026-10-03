import test from "node:test";
import { fromEditorValues, toEditorValues } from "../lib/editor.ts";
import { assert, makeThing } from "./helpers.ts";

const BLANK = {
  name: "",
  category: "home" as const,
  kind: "rent" as const,
  amount: "",
  dueDate: "",
  frequency: "none" as const,
  notes: "",
};

test("toEditorValues", async (t) => {
  await t.test("maps a populated thing", () => {
    const v = toEditorValues(
      makeThing({
        name: "Rent",
        category: "home",
        kind: "rent",
        amount: 250_000,
        dueDate: "2026-11-01",
        recurrence: { frequency: "monthly", interval: 1 },
        notes: "Pay the agent",
      }),
    );
    assert.deepEqual(v, {
      name: "Rent",
      category: "home",
      kind: "rent",
      amount: "250000",
      dueDate: "2026-11-01",
      frequency: "monthly",
      notes: "Pay the agent",
    });
  });

  await t.test("renders null amount, dueDate and notes as empty strings", () => {
    const v = toEditorValues(
      makeThing({ amount: null, dueDate: null, notes: null, recurrence: null }),
    );
    assert.equal(v.amount, "");
    assert.equal(v.dueDate, "");
    assert.equal(v.notes, "");
    assert.equal(v.frequency, "none");
  });
});

test("fromEditorValues", async (t) => {
  await t.test("trims the name", () => {
    assert.equal(fromEditorValues({ ...BLANK, name: "  Rent  " }).name, "Rent");
  });

  await t.test("converts a blank amount to null", () => {
    assert.equal(fromEditorValues({ ...BLANK, amount: "" }).amount, null);
    assert.equal(fromEditorValues({ ...BLANK, amount: "   " }).amount, null);
  });

  await t.test("converts a numeric amount to a number", () => {
    assert.equal(fromEditorValues({ ...BLANK, amount: "250000" }).amount, 250_000);
  });

  await t.test("converts a blank due date to null", () => {
    assert.equal(fromEditorValues({ ...BLANK, dueDate: "" }).dueDate, null);
    assert.equal(fromEditorValues({ ...BLANK, dueDate: "  " }).dueDate, null);
  });

  await t.test("keeps a supplied due date", () => {
    assert.equal(
      fromEditorValues({ ...BLANK, dueDate: "2026-11-01" }).dueDate,
      "2026-11-01",
    );
  });

  await t.test("maps a frequency to a recurrence with interval 1", () => {
    assert.deepEqual(
      fromEditorValues({ ...BLANK, frequency: "monthly" }).recurrence,
      { frequency: "monthly", interval: 1 },
    );
  });

  await t.test("maps none to a null recurrence", () => {
    assert.equal(fromEditorValues({ ...BLANK, frequency: "none" }).recurrence, null);
  });

  await t.test("trims notes and converts blank to null", () => {
    assert.equal(fromEditorValues({ ...BLANK, notes: "  hi  " }).notes, "hi");
    assert.equal(fromEditorValues({ ...BLANK, notes: "   " }).notes, null);
  });

  await t.test("passes category and kind through", () => {
    const out = fromEditorValues({
      ...BLANK,
      category: "documents",
      kind: "document",
    });
    assert.equal(out.category, "documents");
    assert.equal(out.kind, "document");
  });

  await t.test("round-trips a populated thing without drift", () => {
    const thing = makeThing({
      name: "Insurance",
      category: "documents",
      kind: "insurance",
      amount: 45_000,
      dueDate: "2026-12-31",
      recurrence: { frequency: "annual", interval: 1 },
      notes: "Compare quotes first",
    });
    const out = fromEditorValues(toEditorValues(thing));
    assert.equal(out.name, thing.name);
    assert.equal(out.amount, thing.amount);
    assert.equal(out.dueDate, thing.dueDate);
    assert.deepEqual(out.recurrence, thing.recurrence);
    assert.equal(out.notes, thing.notes);
  });

  await t.test("round-trips a sparse thing without drift", () => {
    const thing = makeThing({
      amount: null,
      dueDate: null,
      notes: null,
      recurrence: null,
    });
    const out = fromEditorValues(toEditorValues(thing));
    assert.equal(out.amount, null);
    assert.equal(out.dueDate, null);
    assert.equal(out.notes, null);
    assert.equal(out.recurrence, null);
  });
});