import { test } from "node:test";
import assert from "node:assert/strict";
import { displayWidth, padTo, truncateToWidth } from "./width.ts";

test("displayWidth: plain ASCII counts one cell per character", () => {
  assert.equal(displayWidth("done"), 4);
  assert.equal(displayWidth(""), 0);
});

test("displayWidth: ANSI escape sequences occupy no cells", () => {
  assert.equal(displayWidth("\x1b[32mdone\x1b[0m"), 4);
});

test("displayWidth: narrow status glyphs count as one cell", () => {
  for (const glyph of ["✓", "▸", "●", "○", "·", "─"]) {
    assert.equal(displayWidth(glyph), 1, `expected ${glyph} to measure 1 cell`);
  }
});

test("displayWidth: wide emoji-presentation glyphs count as two cells", () => {
  // ⛔ is one UTF-16 code unit but renders two cells — the bug that misaligns columns.
  assert.equal(displayWidth("⛔"), 2);
  assert.equal(displayWidth("🧪"), 2);
  assert.equal(displayWidth("🤖"), 2);
});

test("displayWidth: variation selectors and ZWJ add no width", () => {
  assert.equal(displayWidth("✔️"), 2);
  assert.equal(displayWidth("‍"), 0);
});

test("padTo: pads to the requested display width using cells, not code units", () => {
  assert.equal(padTo("ab", 4), "ab  ");
  // "⛔" is 2 cells, so only 2 spaces of padding are needed to reach 4.
  assert.equal(padTo("⛔", 4), "⛔  ");
});

test("padTo: leaves strings already at or over the width untouched", () => {
  assert.equal(padTo("abcd", 4), "abcd");
  assert.equal(padTo("abcdef", 4), "abcdef");
});

test("padTo: ignores ANSI escapes when measuring padding", () => {
  assert.equal(padTo("\x1b[32mab\x1b[0m", 4), "\x1b[32mab\x1b[0m  ");
});

test("truncateToWidth: returns the string unchanged when it fits", () => {
  assert.equal(truncateToWidth("hello", 10), "hello");
  assert.equal(truncateToWidth("hello", 5), "hello");
});

test("truncateToWidth: clips to the width with a single-cell ellipsis", () => {
  assert.equal(truncateToWidth("abcdefgh", 5), "abcd…");
  assert.equal(displayWidth(truncateToWidth("abcdefgh", 5)), 5);
});

test("truncateToWidth: never splits a wide glyph across the boundary", () => {
  const result = truncateToWidth("ab⛔cd", 4);
  // Cells: a(1) b(1) ⛔(2). With one cell reserved for the ellipsis the budget is 3,
  // and ⛔ cannot be half-drawn — so it is dropped entirely rather than overflowing.
  assert.ok(displayWidth(result) <= 4, `overflowed: ${displayWidth(result)} cells`);
  assert.ok(result.endsWith("…"), `expected an ellipsis, got ${JSON.stringify(result)}`);
  assert.ok(!result.includes("⛔"), "a wide glyph must not be included when it does not fit");
});

test("truncateToWidth: preserves ANSI escapes while clipping visible text", () => {
  const result = truncateToWidth("\x1b[32mabcdefgh\x1b[0m", 5);
  assert.equal(displayWidth(result), 5);
  assert.ok(result.includes("\x1b[32m"));
});

test("truncateToWidth: degenerate widths do not throw", () => {
  assert.equal(displayWidth(truncateToWidth("abcdef", 1)), 1);
  assert.equal(truncateToWidth("abcdef", 0), "");
});
