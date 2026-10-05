/**
 * Money parsing and coercion.
 *
 * The amount field is a free-text input rather than type="number", because
 * type="number" silently discards anything it cannot parse: a user who types
 * "1,200,000" watches the field empty with nothing to indicate why. Free text
 * means the parser has to cope with the way people actually write money.
 *
 * Number() does not. It returns NaN for "1,200,000", for "₦45000" and for
 * "45 000" alike. A NaN amount is much worse than a missing one, because NaN
 * is not caught by ??: `NaN ?? 0` is NaN, not 0. Every headline figure in the
 * app sums amounts, so one row with a NaN turns the entire Home screen, the
 * Services module and the asset totals into NaN. Nothing else in the record
 * has that blast radius.
 */

/** Grouping separators and the naira sign, which carry no numeric meaning. */
const SEPARATORS = /[₦,\s]/g;

/**
 * Parses a user-typed amount into a number, or null when there is no amount.
 *
 * Junk becomes null rather than NaN so a mistyped figure is treated as "no
 * amount entered" and can be corrected, instead of poisoning every total. Only
 * the characters that genuinely cannot be part of a figure are stripped;
 * "1.2.3" stays unparseable rather than being quietly rewritten to "1.23".
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(SEPARATORS, "");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * True only for an amount that is a real number.
 *
 * Every display site has always tested `amount !== null`, which a stored NaN
 * passes, so NaN reached the formatter and rendered as "₦NaN". Test this
 * instead.
 */
export function hasAmount(amount: number | null | undefined): amount is number {
  return typeof amount === "number" && Number.isFinite(amount);
}

/**
 * Coerces an amount to something safe to sum. Unlike ??, this rejects NaN.
 */
export function amountOrZero(amount: number | null | undefined): number {
  return hasAmount(amount) ? amount : 0;
}
