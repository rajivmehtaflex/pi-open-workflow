/**
 * ask_user_question — Pi tool registration (spec-driven clarification).
 * Core logic in ./ask-user-core.ts (pure, tested); this file is Pi glue.
 */
import type { ExtensionAPI, WorkflowState } from "./types.js";
import { Type } from "./types.js";
import { hasDialogUI, runQuestionnaire, validateQuestionnaire } from "./ask-user-core.js";

export function registerAskUserQuestion(pi: ExtensionAPI, _state: WorkflowState): void {
  pi.registerTool({
    name: "ask_user_question",
    label: "Ask User Question",
    description:
      "Ask the user one or more structured questions (up to 4 per call) when requirements are ambiguous. " +
      "Each question needs a short header (<=16 chars), 2-4 options with label + description, optional multiSelect. " +
      "The 'Type something.' row is appended automatically — do NOT author it or an 'Other' option. " +
      "If you recommend an option, put it FIRST with '(Recommended)' in the label. " +
      "Group all clarifying questions into ONE call — do not stack calls back-to-back.",
    parameters: Type.Object({
      questions: Type.Array(
        Type.Object({
          question: Type.String({ description: "The complete question, ending with a question mark" }),
          header: Type.String({ description: "Very short chip shown next to the question (e.g. 'Auth method')" }),
          options: Type.Array(
            Type.Object({
              label: Type.String({ description: "Concise choice label (1-5 words)" }),
              description: Type.String({ description: "What this choice means / its trade-offs" }),
            }),
            { minItems: 2, maxItems: 4 }
          ),
          multiSelect: Type.Optional(Type.Boolean({ description: "Allow multiple selections" })),
        }),
        { minItems: 1, maxItems: 4 }
      ),
    }),
    async execute(_toolCallId: string, params: any, _signal?: AbortSignal, _onUpdate?: (u: any) => void, ctx?: import("./types.js").ExtensionContext) {
      const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
      const validation = validateQuestionnaire(params);
      if (!validation.ok) return text(`ask_user_question: ${validation.error}`);
      if (!ctx?.hasUI || !hasDialogUI(ctx.ui)) {
        return text(
          "ask_user_question: UI not available in this host. The user never saw the questions — " +
            "do NOT treat this as a decline. Ask the questions as plain chat text instead."
        );
      }
      const result = await runQuestionnaire(ctx.ui, validation.questions);
      if (result.cancelled) {
        return text("User cancelled the questionnaire (Esc). Ask in plain chat, or proceed with safest defaults if the user says so.");
      }
      const lines = result.answers.map((a) => {
        const base =
          a.kind === "option" ? a.answer : a.kind === "multi" ? (a.selected ?? []).join(", ") : a.answer ?? "";
        const kindLabel = a.kind === "option" ? "picked" : a.kind === "multi" ? "picked multiple" : "typed";
        return `Q${a.questionIndex + 1} [${kindLabel}]: ${base}`;
      });
      return text(`User answers:\n${lines.join("\n")}`);
    },
  });
}
