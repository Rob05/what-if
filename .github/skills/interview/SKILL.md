---
name: interview
description: "Interview me to clarify goals, constraints, and choices; create the best actionable plan, keep a reviewable interview log, then wait for my approval before doing the work. Use when a request needs discovery or planning before implementation, or when I invoke /interview."
argument-hint: "Describe the goal or task to plan"
user-invocable: true
---

# Interview and Plan

## Purpose

Turn an underspecified request into a clear, user-approved plan before taking action. The interview is an interactive discovery process, not a one-shot questionnaire.

## Procedure

1. **Frame the request.** Restate the intended outcome briefly. Identify what is already clear and what information would materially change the plan. Do not start implementation, modify files, or run task-related actions during discovery.
2. **Load project context.** If the interview concerns this game's mechanics or rules, read [the canonical game rules](../../../docs/requirements/what-if-game-rules.md) and [the online-game requirements](../../../docs/requirements/online-game-requirements.md) before asking questions. Check the [interview archive index](../../../docs/interviews/README.md) and relevant dated entries for prior decisions so you do not ask the user to repeat them.
3. **Interview in stages.** Ask one focused question at a time, in a useful order. Usually clarify:
   - the problem, intended users, and desired outcome;
   - what success looks like and how it can be verified;
   - scope, priorities, and what should be excluded;
   - constraints such as timeline, compatibility, tools, budget, or existing systems;
   - preferences and trade-offs when multiple reasonable approaches exist;
   - risks, dependencies, and how to handle important edge cases.
4. **Adapt the interview.** Use the user's answers and available project context to choose the next question. Do not ask for information already provided or readily established by safe inspection. Skip irrelevant topics, avoid leading questions, and ask only questions whose answers could affect the plan. For a small task, keep the interview short; for a broad or high-impact task, explore the consequential decisions until the plan is sound.
5. **Resolve ambiguity.** When choices have meaningful consequences, explain the options neutrally and ask the user to choose. If a detail is minor, use a sensible default, state it as an assumption, and let the user correct it. Do not silently decide a major scope or behavior trade-off.
6. **Present the proposed plan.** Summarize the confirmed goal, scope and exclusions, approach and ordered steps, expected deliverables, verification, and any material assumptions, risks, or open decisions. Keep it concrete enough to execute and avoid speculative details.
7. **Get explicit approval.** Ask the user to approve the plan or request changes. Use the available structured ask-user tool when possible. Do not begin execution until the user clearly approves the proposed plan. Silence, an answer to a discovery question, or a request to see the plan is not approval.
8. **Revise as needed.** If the user changes a requirement or rejects the plan, update it and obtain approval for the revised plan before acting. If the user asks only for a plan, stop after presenting it.
9. **Log the completed interview.** After the interview reaches a terminal outcome (approved plan, plan-only request, or user-declined plan), create a separate Markdown file for that interview in `docs/interviews/`; do not append interview details to a single long log file. Name it `YYYY-MM-DD-topic-slug.md` using the interview's local date, include that date and topic in the heading, and add a link with a short summary to the [interview archive index](../../../docs/interviews/README.md). If an entry already exists for that date and topic, add a numeric suffix to the filename. Record confirmed decisions, plan outcome/approval status, and links to relevant requirements documents. Summarize rather than transcribe; do not include sensitive personal information. Do not write to the archive during discovery or use logging as a reason to start unapproved implementation.
10. **Execute and verify.** After approval, follow the plan, respecting the user's scope and project conventions. For gameplay or rules changes, update the applicable canonical document(s) under `docs/requirements/` in the same change and add or update relevant tests. If new information requires a material change, pause, explain the change, propose an updated plan, and get approval before continuing. Report completed work, verification performed, and any deviations or remaining items.

## Interaction guidelines

- Ask concise, neutral questions; prefer one decision per turn rather than a long intake form.
- Make it easy to answer with clear options when useful, while allowing a custom answer.
- Do not turn the interview into unnecessary process for trivial, fully specified requests. If invocation is explicit, still provide a brief plan and wait for approval before taking action.
- If the user declines to answer or delegates a decision, proceed with the safest reasonable assumption, make it visible in the plan, and obtain approval.
- Never claim a plan is approved unless the user has explicitly approved it.
- Put game rules and product requirements under `docs/requirements/`; keep one dated file per completed interview under `docs/interviews/` and maintain its `README.md` index. Preserve historical entries with unknown dates as explicitly undated rather than guessing.
