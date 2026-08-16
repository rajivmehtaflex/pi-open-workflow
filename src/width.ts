/**
 * Terminal display-width helpers.
 *
 * Measuring with `String.length` counts UTF-16 code units, which is wrong twice over:
 * `⛔` is one code unit but occupies two terminal cells, while `🧪` is two code units
 * and also two cells. Tree output tolerates the discrepancy because nothing has to line
 * up; a column layout does not — a single wide glyph shifts every later column on that
 * row. These helpers count cells.
 *
 * Zero imports on purpose: this module is consumed by the pure renderers that run
 * directly under `node --test`.
 */

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

/** Code points that render two cells wide. */
const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f], // Hangul Jamo
  [0x2329, 0x232a],
  [0x2e80, 0x303e], // CJK radicals, Kangxi
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff], // CJK unified ideographs
  [0xa000, 0xa4cf],
  [0xac00, 0xd7a3], // Hangul syllables
  [0xf900, 0xfaff],
  [0xfe10, 0xfe19],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60], // Fullwidth forms
  [0xffe0, 0xffe6],
  [0x1f300, 0x1f64f], // Misc symbols & pictographs, emoticons
  [0x1f680, 0x1f6ff], // Transport & map
  [0x1f900, 0x1f9ff], // Supplemental symbols & pictographs
  [0x1fa70, 0x1faff],
  [0x20000, 0x3fffd],
];

/**
 * Individually wide code points in the Miscellaneous Symbols blocks. These default to
 * emoji presentation, so terminals draw them two cells wide even without U+FE0F —
 * `⛔` (U+26D4) is the one that actually appears in this dashboard.
 */
const WIDE_SINGLETONS: ReadonlySet<number> = new Set([
  0x231a, 0x231b, 0x23e9, 0x23ea, 0x23eb, 0x23ec, 0x23f0, 0x23f3, 0x25fd, 0x25fe, 0x2614, 0x2615,
  0x2648, 0x2649, 0x264a, 0x264b, 0x264c, 0x264d, 0x264e, 0x264f, 0x2650, 0x2651, 0x2652, 0x2653,
  0x267f, 0x2693, 0x26a1, 0x26aa, 0x26ab, 0x26bd, 0x26be, 0x26c4, 0x26c5, 0x26ce, 0x26d4, 0x26ea,
  0x26f2, 0x26f3, 0x26f5, 0x26fa, 0x26fd, 0x2705, 0x270a, 0x270b, 0x2728, 0x274c, 0x274e, 0x2753,
  0x2754, 0x2755, 0x2757, 0x2795, 0x2796, 0x2797, 0x27b0, 0x27bf, 0x2b1b, 0x2b1c, 0x2b50, 0x2b55,
]);

function isZeroWidth(cp: number): boolean {
  if (cp === 0x200d) return true; // zero-width joiner
  if (cp >= 0x0300 && cp <= 0x036f) return true; // combining diacriticals
  if (cp >= 0x200b && cp <= 0x200f) return true; // zero-width space .. RTL mark
  if (cp >= 0xfe00 && cp <= 0xfe0f) return true; // variation selectors
  if (cp >= 0x1ab0 && cp <= 0x1aff) return true; // combining diacriticals extended
  if (cp >= 0x20d0 && cp <= 0x20ff) return true; // combining marks for symbols
  return false;
}

function isWide(cp: number): boolean {
  if (WIDE_SINGLETONS.has(cp)) return true;
  for (const [lo, hi] of WIDE_RANGES) {
    if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

/** Cells a single code point occupies. */
export function codePointWidth(cp: number): number {
  if (isZeroWidth(cp)) return 0;
  if (isWide(cp)) return 2;
  return 1;
}

/** Terminal cells the string occupies, ignoring ANSI colour escapes. */
export function displayWidth(str: string): number {
  const stripped = str.replace(ANSI_PATTERN, "");
  let total = 0;
  let previousWidth = 0;
  for (const char of stripped) {
    const cp = char.codePointAt(0)!;
    // U+FE0F promotes the preceding glyph to emoji presentation, which renders two
    // cells: `✔` alone is one cell, `✔️` is two.
    if (cp === 0xfe0f && previousWidth === 1) {
      total += 1;
      previousWidth = 2;
      continue;
    }
    const cellWidth = codePointWidth(cp);
    total += cellWidth;
    previousWidth = cellWidth;
  }
  return total;
}

/** Right-pad with spaces to `width` cells. Strings at or over the width are returned as-is. */
export function padTo(str: string, width: number): string {
  const deficit = width - displayWidth(str);
  return deficit > 0 ? str + " ".repeat(deficit) : str;
}

/**
 * Clip to `width` cells, appending a single-cell ellipsis when text is dropped.
 * ANSI escapes are preserved; a wide glyph is never half-drawn across the boundary.
 */
export function truncateToWidth(str: string, width: number): string {
  if (width <= 0) return "";
  if (displayWidth(str) <= width) return str;

  const budget = width - 1; // reserve one cell for the ellipsis
  let used = 0;
  let result = "";
  let i = 0;

  while (i < str.length) {
    if (str[i] === "\x1b") {
      const match = /^\x1b\[[0-9;]*m/.exec(str.slice(i));
      if (match) {
        result += match[0];
        i += match[0].length;
        continue;
      }
    }
    const cp = str.codePointAt(i)!;
    const char = String.fromCodePoint(cp);
    const cellWidth = codePointWidth(cp);
    if (used + cellWidth > budget) break;
    result += char;
    used += cellWidth;
    i += char.length;
  }

  return result + "…";
}
