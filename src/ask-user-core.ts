/**
 * Pure questionnaire logic for ask_user_question — zero runtime imports.
 * Pattern: juicesharp/rpiv-mono rpiv-ask-user-question rpc-fallback (166-line path).
 */
export const MAX_QUESTIONS = 4;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;

export interface QuestionOption {
  label: string;
  description: string;
}

export interface QuestionSpec {
  question: string;
  header: string;
  options: QuestionOption[];
  multiSelect?: boolean;
}

export type QuestionAnswer =
  | { questionIndex: number; question: string; kind: "option"; answer: string }
  | { questionIndex: number; question: string; kind: "multi"; answer: null; selected: string[] }
  | { questionIndex: number; question: string; kind: "custom"; answer: string };

export interface QuestionnaireResult {
  answers: QuestionAnswer[];
  cancelled: boolean;
}

export interface DialogUI {
  select: (title: string, options: string[]) => Promise<string | undefined>;
  input: (title: string, placeholder?: string) => Promise<string | undefined>;
}

/** Structural gate — both dialog primitives must exist. */
export function hasDialogUI(ui: unknown): ui is DialogUI {
  const u = ui as Partial<Record<"select" | "input", unknown>> | null | undefined;
  return typeof u?.select === "function" && typeof u?.input === "function";
}

/** Parse "N. label" token to 0-based index; out-of-range/NaN → null. */
export function parseIndex(token: string, count: number): number | null {
  const i = Number.parseInt(token, 10) - 1;
  return i >= 0 && i < count ? i : null;
}

const RESERVED_LABELS = new Set(["other", "type something."]);

/** Validate params before touching the UI. */
export function validateQuestionnaire(
  params: unknown
): { ok: true; questions: QuestionSpec[] } | { ok: false; error: string } {
  if (typeof params !== "object" || params === null) return { ok: false, error: "params must be an object" };
  const p = params as { questions?: unknown };
  if (!Array.isArray(p.questions)) return { ok: false, error: "questions must be an array (1-4)" };
  if (p.questions.length < 1 || p.questions.length > MAX_QUESTIONS)
    return { ok: false, error: `questions must be 1-${MAX_QUESTIONS}, got ${p.questions.length}` };
  for (const q of p.questions) {
    if (typeof q !== "object" || q === null) return { ok: false, error: "each question must be an object" };
    const qq = q as Record<string, unknown>;
    if (typeof qq.question !== "string" || qq.question.trim().length === 0)
      return { ok: false, error: "each question needs non-empty 'question' text" };
    if (typeof qq.header !== "string" || qq.header.length === 0 || qq.header.length > 16)
      return { ok: false, error: "each question needs a 'header' (1-16 chars)" };
    if (!Array.isArray(qq.options)) return { ok: false, error: "each question needs an 'options' array" };
    if (qq.options.length < MIN_OPTIONS || qq.options.length > MAX_OPTIONS)
      return { ok: false, error: `options must be ${MIN_OPTIONS}-${MAX_OPTIONS}, got ${qq.options.length}` };
    for (const o of qq.options) {
      if (typeof o !== "object" || o === null) return { ok: false, error: "each option must be an object" };
      const oo = o as Record<string, unknown>;
      if (typeof oo.label !== "string" || oo.label.trim().length === 0) return { ok: false, error: "each option needs a 'label'" };
      if (typeof oo.description !== "string") return { ok: false, error: "each option needs a 'description'" };
      if (RESERVED_LABELS.has(oo.label.trim().toLowerCase()))
        return { ok: false, error: `reserved label "${oo.label}" — the free-text row is appended automatically` };
    }
  }
  return { ok: true, questions: p.questions as QuestionSpec[] };
}

/** Walk questions via ui.select/ui.input; any dismissal cancels the whole questionnaire. */
export async function runQuestionnaire(ui: DialogUI, questions: QuestionSpec[]): Promise<QuestionnaireResult> {
  const answers: QuestionAnswer[] = [];
  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi];
    const header = q.header ? `[${q.header}] ` : "";
    const answer = q.multiSelect
      ? await askMultiSelect(ui, q, qi, header)
      : await askSingleSelect(ui, q, qi, header);
    if (answer === undefined) return { answers, cancelled: true };
    answers.push(answer);
  }
  return { answers, cancelled: false };
}

async function askSingleSelect(
  ui: DialogUI,
  q: QuestionSpec,
  qi: number,
  header: string
): Promise<QuestionAnswer | undefined> {
  const options = q.options.map((o, i) => `${i + 1}. ${o.label} — ${o.description}`);
  options.push(`${q.options.length + 1}. Type something.`);
  const chosen = await ui.select(`${header}${q.question}`, options);
  if (chosen == null) return undefined;
  const idx = parseIndex(chosen, options.length);
  if (idx == null) return undefined; // off-list = dismissal
  if (idx < q.options.length) {
    return { questionIndex: qi, question: q.question, kind: "option", answer: q.options[idx].label };
  }
  const typed = await ui.input(`${header}${q.question}\n\nType your answer:`, "");
  if (typed == null) return undefined;
  return { questionIndex: qi, question: q.question, kind: "custom", answer: typed };
}

async function askMultiSelect(
  ui: DialogUI,
  q: QuestionSpec,
  qi: number,
  header: string
): Promise<QuestionAnswer | undefined> {
  const list = q.options.map((o, i) => `${i + 1}. ${o.label} — ${o.description}`).join("\n");
  const value = await ui.input(
    `${header}${q.question}\n\n${list}\n\nEnter numbers of all that apply, comma-separated (e.g. "1,3"), or type a custom answer.`,
    "1,3"
  );
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { questionIndex: qi, question: q.question, kind: "multi", answer: null, selected: [] };
  }
  const tokens = trimmed.split(/[,\s]+/).filter((t) => t.length > 0);
  const indices = tokens.map((t) => (/^\d+\.?$/.test(t) ? parseIndex(t, q.options.length) : null));
  if (indices.every((i): i is number => i != null)) {
    const selected: string[] = [];
    for (const i of indices) {
      const label = q.options[i].label;
      if (!selected.includes(label)) selected.push(label);
    }
    return { questionIndex: qi, question: q.question, kind: "multi", answer: null, selected };
  }
  return { questionIndex: qi, question: q.question, kind: "custom", answer: trimmed };
}
