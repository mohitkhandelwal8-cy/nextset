# NextSet — Future Feature Candidates (Competitive Roadmap)

Written 2026-07-06 (v68 era). Strategic ideation for making NextSet genuinely competitive — distinct from the near-term build plan (`IMPLEMENTATION-PLAN-2026-07-06.md`, Phases 0–5) and the UX fix backlog (`UX-REVIEW-2026-07-06.md`). Nothing here is committed; this is the menu.

**Strategic anchor (validated in the 2026-06 research rounds):**
- Beachhead = **"run your own program, smarter"** — progression that OBEYS your program, not overrides it (anti-Fitbod).
- Structural edges = per-gym machine reality, trust (transparent/deterministic, own-data), fast logging.
- Market gap = effortless + intelligent + fairly priced. Downplay "AI" branding.
- The best ideas below are ones only NextSet can build credibly because of infrastructure it already has (gym profiles, linkId/equivId, suggestNext engine, muscle taxonomy, exercise library, exMinutes/planMinutes, RPE + joint flags).

---

## Tier 1 — The wedge: features that ARE the positioning

### 1. Program runner ⭐ (the validated beachhead — the big one)
Run named programs — 5/3/1, GZCLP, PPL, nSuns, or user-defined — as first-class citizens: training maxes, percentage-based sets, AMRAP sets, cycle/week structure, scheduled deloads.
- **Why it wins:** when lifters plateau they reach for 5/3/1, never "an app" (confirmed via Reddit mining). Incumbents fail in opposite ways: Liftosaur requires literal coding; Boostcamp is rigid; Hevy/Strong are dumb notebooks.
- **NextSet's angle:** the program is law; the engine handles the details underneath — micro-loading, stall handling, rounding to the gym's increments.
- **Leverage:** plans + `suggestNext` + per-exercise increments already exist. A program = "a plan with a progression rule and a calendar attached." Real data-model implications — deserves its own phase doc before building.

### 2. Equipment-aware suggestions (make the gym profile do real work)
Extend gym profiles from *machines* to *equipment reality*: available plates (1.25s? micro-plates?), the dumbbell run (2.5–50 in 2.5 steps vs a jump from 30→35), fixed barbells. Suggestions snap to what's physically pickable at THIS gym; barbell targets show **plate math per side** ("67.5kg → 20 + 2.5 + 1.25 per side").
- **Why it wins:** nobody else models gyms at all — this compounds the existing moat. Also fixes a real failure mode: suggesting +2.5kg on dumbbells at a gym whose dumbbells jump by 5.

### 3. "Fit my time" — session compression
"I've got 40 minutes" → reshape today's plan to fit: superset the isolations, trim a set from accessories, drop the lowest-priority exercise — showing exactly what was cut and why, all reversible, never touching main lifts without asking.
- **Why it wins:** a daily-life scenario every lifter hits weekly, essentially unserved (Fitbod's duration knob is a black box; loggers have nothing). It's "coaching that obeys."
- **Leverage:** `exMinutes`/`planMinutes` + superset rest math already computed.

### 4. The glass-box engine ("Why this weight?")
Every suggestion gets a tap-through receipt: "Last time 60kg × 10,9,8 → volume 1,620. Target +4% → 1,685. You rated it Solid — no adjustment. Rounded to your 2.5kg plates."
- **Why it wins:** the trust brand made tangible; Fitbod structurally can't copy it without admitting its model is a black box. Cheap to build (all data already in `suggestNext`'s intermediate values), disproportionate to positioning.

---

## Tier 2 — Retention: make the daily loop sticky

### 5. Machine settings memory
Per machine per gym: seat height 4, back pad 3, handle position B — shown as a one-line "your settings" at the top of the logger card, editable in two taps, optionally with a photo of the machine.
- **Why:** the universal machine-gym pain nobody solves in a structured way. Trivially cheap (fields on the already-gym-scoped exercise record), weirdly beloved, deepens the per-gym identity.

### 6. Fatigue radar → earned deloads
Combine signals already collected — RPE creeping up while e1RM is flat across 2+ lifts, plus joint flags — into: "You've been grinding for three weeks — schedule a deload week?" One tap applies reduced volume to next week via the `pendingAdjust` mechanism (Phase 2 of the implementation plan).
- **Why:** the difference between a logger and a coach, using only deterministic, explainable signals.

### 7. Niggle-aware alternatives
When a joint is flagged repeatedly on a movement, offer library swaps hitting the same primary muscle with a different loading pattern ("shoulder complaining on overhead press → landmine press, high-incline DB press").
- **Guardrail:** frame strictly as "work around a niggle," never medical advice.
- **Leverage:** muscle taxonomy + library + joint flags make this nearly free. No competitor touches it.

### 8. Warm-up ramp generator
From today's top set: bar×10 → 40%×5 → 60%×3 → 80%×1. Collapsible, not logged as working volume. Synergy: respects per-gym plate math (feature 2).

### 9. Revive quick logging — and add voice
The NL parser (`parseNL`/`openQuickAdd`) is dead code — wire it up (also UX-review backlog item 6). Then add Web Speech API on top: hands chalked, phone on the floor — "leg press one-ten for ten."
- **Why:** attacks Hevy's #1 valued feature (logging speed) from a flank they don't have. PWA-compatible, offline-degradable.

---

## Tier 3 — Growth loops: going public with $0 CAC

### 10. Competitor import ("bring your history")
Strong and Hevy both export CSV. Importer maps exercise names → library, creates gyms/machines. Kills the biggest switching cost in the category; every "thinking of leaving Strong because they paywalled X" thread becomes the funnel. Cheap.

### 11. Plans as shareable links — community programs with NO backend
Encode a plan (movements, set schemes, progression rule) into a URL fragment or QR code. Friend taps → it materializes in their NextSet, resolved to THEIR gyms' machines via `resolveExerciseAtGym`.
- **Why:** program sharing — the seed of community — while staying 100% local-first, no server, no accounts. Nobody else can do this *because* they're account-based.

### 12. Shareable PR / year-wrapped cards
Render PR moments and a yearly recap to a canvas image → native share sheet. Instagram-ready, brand-stamped, works offline. How a solo PWA markets itself.

### 13. Strength identity (percentiles / standards)
Already Phase 3 in the implementation plan — flagged here because identity ("Intermediate, close to Advanced") is both a retention and a sharing feature.

---

## Tier 4 — Structural gaps: be honest

- **Watch apps** and **Apple Health / Google Fit integration**: a PWA structurally can't match these. Don't half-build them. Mitigation = be unapologetically the best phone-first tracker; the P2 sync roadmap eventually reopens these doors (and real social).
- **Don't build a social feed first**: Hevy owns it, it needs a backend, and the beachhead user wants a better tool, not a network.
- **Don't brand as AI**: research showed AI-labeled coaching triggers distrust; consistency + transparency + correct math beat the label.

---

## Recommended top 5 (if forced to choose)

1. **Program runner** — it's the beachhead; everything else supports it.
2. **Equipment-aware suggestions + plate math + settings memory** — one "your gym, for real" bundle; compounds the unique moat.
3. **Fit-my-time compression** — daily-relevance feature nobody serves.
4. **Glass-box engine** — cheapest way to make "trust" a visible feature, not a claim.
5. **Competitor import + shareable plan links** — the acquisition pair for launch.

**Through-line:** every feature here is deterministic, explainable, and local-first — the competitive story stays "the app that respects your program, your gym, and your data," and none of it forces the backend/accounts decision early.

**Next step when picking any of these:** spec it as a phase in the style of `IMPLEMENTATION-PLAN-2026-07-06.md` (data model → UX surfaces → engine touch-points → acceptance criteria). The program runner in particular needs a dedicated design doc before code.
