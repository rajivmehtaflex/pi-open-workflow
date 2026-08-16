import { test } from "node:test";
import assert from "node:assert/strict";
import { validateQuestionnaire, runQuestionnaire, hasDialogUI, parseIndex } from "./ask-user-core.ts";

const Q = (over: Record<string, unknown> = {}) => ({
  question: "Which approach?",
  header: "Approach",
  options: [
    { label: "A", description: "first" },
    { label: "B", description: "second" },
  ],
  ...over,
});

test("validate: 0 questions → ok:false", () => {
  assert.equal(validateQuestionnaire({ questions: [] }).ok, false);
});

test("validate: reserved 'Other' label → ok:false", () => {
  const r = validateQuestionnaire({ questions: [Q({ options: [{ label: "Other", description: "x" }, { label: "B", description: "y" }] })] });
  assert.equal(r.ok, false);
});

test("validate: well-formed → ok:true", () => {
  assert.equal(validateQuestionnaire({ questions: [Q()] }).ok, true);
});

test("runQuestionnaire: select maps to option pick", async () => {
  const ui = { select: async () => "2. B — second", input: async () => undefined };
  const r = await runQuestionnaire(ui, [Q()]);
  assert.equal(r.cancelled, false);
  assert.equal(r.answers[0].kind, "option");
  assert.equal((r.answers[0] as any).answer, "B");
});

test("runQuestionnaire: 'Type something.' row routes to input follow-up", async () => {
  let n = 0;
  const ui = { select: async () => "3. Type something.", input: async () => { n++; return "my own answer"; } };
  const r = await runQuestionnaire(ui, [Q()]);
  assert.equal(r.answers[0].kind, "custom");
  assert.equal((r.answers[0] as any).answer, "my own answer");
  assert.equal(n, 1);
});

test("runQuestionnaire: multiSelect numeric input maps to selected labels", async () => {
  const ui = { select: async () => "1. A", input: async () => "1,2" };
  const r = await runQuestionnaire(ui, [Q({ multiSelect: true })]);
  assert.equal(r.answers[0].kind, "multi");
  assert.deepEqual((r.answers[0] as any).selected, ["A", "B"]);
});

test("runQuestionnaire: multiSelect free text becomes custom answer", async () => {
  const ui = { select: async () => "1. A", input: async () => "use Redis" };
  const r = await runQuestionnaire(ui, [Q({ multiSelect: true })]);
  assert.equal(r.answers[0].kind, "custom");
  assert.equal((r.answers[0] as any).answer, "use Redis");
});

test("runQuestionnaire: Esc (undefined select) cancels whole questionnaire", async () => {
  const ui = { select: async () => undefined, input: async () => "never" };
  const r = await runQuestionnaire(ui, [Q(), Q()]);
  assert.equal(r.cancelled, true);
  assert.equal(r.answers.length, 0);
});

test("hasDialogUI: structural check", () => {
  assert.equal(hasDialogUI({ select: () => {}, input: () => {} }), true);
  assert.equal(hasDialogUI({ select: () => {} }), false);
});

test("parseIndex: bounds", () => {
  assert.equal(parseIndex("2. B — second", 3), 1);
  assert.equal(parseIndex("13", 3), null);
  assert.equal(parseIndex("abc", 3), null);
});
