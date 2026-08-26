# NextSet Implementation Plan — Volume Unification, Cross-Machine Calibration, Prescriptive Insights

**Handover doc.** Written 2026-07-06 against v68. Self-contained: read this top to bottom before touching code. Companion doc: `UX-REVIEW-2026-07-06.md` (full UX review + backlog — Phase 0 below pulls its P0 items).

---

## 0. Project context & ground rules

**What NextSet is:** a local-first gym workout tracker PWA. Single self-contained `index.html` (~3,100 lines, vanilla JS), IndexedDB storage, `sw.js` offline cache, no build step, no dependencies, no accounts. Live at https://mohitkhandelwal8-cy.github.io/nextset/ via GitHub Pages (repo `mohitkhandelwal8-cy/nextset`, main branch root; git repo lives in this folder).

**Non-negotiable invariants:**
1. **Local-first, no network required** for core function. No new external dependencies, no frameworks, no accounts.
2. **Single-file architecture stays.** All JS lives in `index.html`. Keep the existing code style (compact vanilla JS, `el()` DOM helper, section banner comments).
3. **Anti-nanny principle (locked product positioning):** suggestions are hints, never overrides. The app must never silently change a value the user entered, and every automated adjustment must show its reasoning in plain language.
4. **Trust the data:** per-machine raw history and PRs are never merged across machines, even when calibrated/linked. Calibration produces *hints and normalized trends*, not merged records.
5. **Deploy protocol:** every shipped change bumps `APP_VERSION` in index.html AND `CACHE` in sw.js in lockstep (e.g. v68 → v69). Commit + push to main only with the user's explicit OK. Confirm deploy by polling `/sw.js` for the new `nextset-vN` marker.
6. **Units:** exercises carry `unit` = `"kg"` | `"lb"` | `"lvl"` (numbered stack levels, no kg meaning). `equipment` ∈ machine/plate/freeplate/cable/barbell/dumbbell/kettlebell/bodyweight/other. Bodyweight exercises log ADDED load (0 = pure bodyweight). Plate machines log added plates only (sled excluded).

**Key existing code landmarks (function names are real — find them in index.html):**
- DB layer: `DB` IIFE (stores: gyms, exercises, sessions, sets, plans, meta; **DB VER = 2 — do not bump; everything below fits in existing stores**). `setMeta(k,v)` / `getMeta(k)` for key-value settings.
- State: global `State` {gyms, exercises, plans, currentGymId, activeSession, volTargetPct}; `loadState()` on boot; `render()` re-renders the current tab.
- Progression engine: `suggestNext(ex)` → {plan, note, kind, prev, targetVol}; `volumeProgress()` (volume-target solver), `classicNext()` (double progression for bodyweight/sled-only), `lastSetsFor(exerciseId)`, `stallCount(exerciseId)`, `epley(w,r)` for est-1RM.
- Cross-gym: machines confirmed identical share `ex.linkId`; `linkedIds(exerciseId)` returns the pooled group; `resolveExerciseAtGym()` maps plan items to the current gym.
- Insights: `viewInsights()` (the whole tab), `overloadScore()`, `volumeSeries()`, `bodyHeatmap()`, `consistencyCard()`, `openMuscleDetail(mk)`, `openExerciseProgress(exId)`, `lineChart()`, `statTile()`, `mondayOf()/lastNWeeks()/weekStreak()`.
- Logging: `loggerCard(item, isCurrent)`, `finishSession()`, `persistSession()`, `prCheck()`.
- Taxonomy: `MUSCLES` (16 keys), `guessMuscles()`, `EQUIP`, `guessEquipment()`, `isBW(ex)`, `isPlate(ex)`.

**Verification:** there is no persisted test suite in the folder. Historic practice: extract the app JS, run logic tests on a shimmed IndexedDB via `bun` (no Node available), plus live browser verification. Minimum bar for this plan: (a) any pure function you add gets a quick bun-shim test or console-verified table of cases; (b) every feature is verified live in a browser served via `python3 -m http.server` (or bun static server), with seeded history — seed by writing sessions/sets via `DB.put` in the console, then **reload** so `loadState()` picks it up. Check the console for errors after every phase.

---

## Phase 0 — Data-integrity prerequisites (do first; small)

Insights and calibration are only as good as logged data. Three P0 bugs from the UX review corrupt or lose data. Full detail in `UX-REVIEW-2026-07-06.md`.

**0.1 Stop clobbering user-entered values on set completion.**
In `loggerCard`'s done-toggle (~line 1095): ticking a set copies its weight AND reps onto the next un-done set whenever `nxt.weight <= set.weight`, destroying values the user typed (pre-fill 10/9/8 → tick set 1 → becomes 10/10/10).
- Fix: add a `touched` flag to session set objects. Set `set.touched=true` in the stepper `onChange` handlers (weight or reps edited by hand). The pull-up logic runs only when `!nxt.touched`.
- `touched` is session-state only (lives in activeSession meta blob, never committed to the `sets` store).
- Acceptance: pre-fill 10/9/8 via steppers, tick set 1 → sets 2–3 keep 9 and 8. Fresh suggested sets (untouched) still pull up as before.

**0.2 Finish guard for entered-but-unticked sets.**
`finishSession` saves only `done` sets. If any non-done set has `reps>0` AND (`touched` or differs from its suggested seed), show a confirm: "N sets have reps but aren't ticked — Save them too / Leave them out / Cancel". Implement as a small `openSheet` (not `confirm()`) with those three buttons.
- Acceptance: log 2 of 3 sets, hit Finish → sheet appears; "Save them too" commits all 3.

**0.3 Confirm before removing an exercise with completed sets.**
The "Remove" button in `loggerCard` removes the item instantly. If `item.sets.some(s=>s.done)`, require `confirm(\`Remove ${ex.name} and its N logged sets from this workout?\`)`.

Ship Phase 0 as its own version bump (v69) before starting Phase 1.

---

## Phase 1 — Bodyweight setting + honest volume accounting

**Goal:** one new setting (user bodyweight) + a consistent volume story across kg / bodyweight / level exercises. Sets remain the headline metric everywhere; tonnage becomes honest.

**1.1 Bodyweight setting.**
- Storage: `setMeta("bodyweight", {kg: <number>, updatedAt: ISO})`. Single current value (no history for now).
- UI: new field in More → a small "You" card (above Progression): label "Bodyweight", numeric input + kg/lb toggle (store normalized kg; if user picks lb, convert on save, display in their chosen unit — store the display pref as `setMeta("bwUnit","kg"|"lb")`).
- Copy: "Used to count bodyweight exercises in your volume, and for strength standards. Never leaves your device."
- Load into `State.bodyweightKg` in `loadState()` (null if unset).

**1.2 Bodyweight movement coefficients.**
Add a keyword-rule table `BW_COEF` (same first-match-wins pattern as `MUSCLE_RULES`), mapping exercise names to the fraction of bodyweight actually moved:

| keywords | coef |
|---|---|
| pull up, pull-up, pullup, chin up, chin-up, chinup, muscle up | 1.00 |
| dip | 0.96 |
| push up, push-up, pushup | 0.64 |
| inverted row | 0.50 |
| pistol, single leg squat | 0.85 |
| squat (bodyweight), lunge, step up, step-up | 0.85 |
| sit up, sit-up, situp, crunch | 0.35 |
| leg raise, knee raise, hanging | 0.50 |
| plank, hold | 0 (isometric — excluded from tonnage) |
| default (unmatched bodyweight exercise) | 0.60 |

`bwCoef(name)` helper. Effective set load for `isBW(ex)`: `State.bodyweightKg ? (State.bodyweightKg * bwCoef(ex.name) + addedLoad) : addedLoad`.

**1.3 One shared tonnage function.**
Today tonnage is computed inline in ≥4 places (History rows, `openSessionDetail`, `openMuscleDetail` wkTon, muscle-drilldown "kg moved") with inconsistent rules. Create a single helper and use it everywhere:

```js
// Effective tonnage of one committed set, in kg. Returns null when kg isn't knowable.
function setTonnage(ex, weight, reps){
  if(!ex || !(reps>0)) return null;
  if(ex.unit==="lvl"){
    const kpl = levelKg(ex);            // Phase 4: calibrated kg-per-level, else user-entered ex.kgPerLevel, else null
    return kpl!=null ? kpl*weight*reps : null;
  }
  if(isBW(ex)){
    const c=bwCoef(ex.name);
    if(c===0) return null;              // isometrics
    return State.bodyweightKg!=null ? (State.bodyweightKg*c + (+weight||0))*reps : null;
  }
  return (+weight||0)*reps;             // plate machines stay added-plates-only (documented behavior)
}
```

- Aggregations sum non-null results and separately count excluded sets.
- **Relabel:** wherever a kg total is shown next to excluded sets, label it "loaded volume" and, if any sets were excluded, append "· excludes N sets (levels/holds)" as a `.tiny muted` note. Surfaces: History row meta, `openSessionDetail` stat tile ("kg volume" → "kg loaded volume"), muscle drilldown "kg moved this week".
- If `State.bodyweightKg` is set, bodyweight exercises now contribute real kg — call this out in the release toast/note.

**1.4 Keep sets primary (no regressions).**
The Insights volume trend (`volumeSeries`) and muscle breakdown stay set-count based. Do not switch them to tonnage. Optional (nice-to-have, de-scope if tight): a "Sets / Tonnage" toggle chip on the Training volume card, where Tonnage mode uses `setTonnage` sums and shows the exclusion note.

**Acceptance (Phase 1):**
- No bodyweight set → behavior identical to today except relabels.
- Set bodyweight 75kg → a 10-rep pull-up set adds ~750kg to loaded volume; a plank adds 0 and shows in the excluded count; a level-machine set is excluded until Phase 4 calibration or manual kg-per-level.
- All tonnage surfaces agree with each other for the same session.

---

## Phase 2 — Prescriptive Insights: targets, actionable alerts, structure

**Goal:** convert Insights from a report into a coach. Three sub-features, shippable together as one version.

**2.1 Per-muscle weekly set targets.**
- Storage: `setMeta("muscleTargets", {<muscleKey>: <setsPerWeek>})`. Default 10 for every muscle the user has trained in the last 8 weeks; untrained muscles have no target (no nagging about neck).
- UI: in the Muscle groups card, each `.vbar` becomes progress-toward-target: fill = `min(setsThisWeek/target,1)`, value text = `7/10`. Over-target (>1.3×) tints the value amber with a title "above the typical 10–20 productive range".
- Editing: tap-through — `openMuscleDetail(mk)` gets a "Weekly target" stepper (1–30, default 10) that writes `muscleTargets`.
- The muscle drilldown's existing tips section keys off the target instead of hardcoded 6/20 bounds.

**2.2 Alerts with actions ("What needs attention" → buttons).**
Every insight in the alerts card gains a one-tap action. Mechanism first, then wiring:

- **Deload queue:** `setMeta("pendingAdjust:"+ (ex.linkId||ex.id), {type:"deload", pct:10, created: todayISO()})`. In `suggestNext(ex)`, FIRST check this key: if present, return a deload plan (top weight ×0.9 rounded to `ex.increment`, reps at `repMin`, kind `"deload"`, note "Deload you scheduled from Insights — rebuild from here.") and DELETE the key (consumed once). This respects anti-nanny: it only exists because the user tapped it, and the note says so.
- **Queue-for-next-workout:** `setMeta("queuedExercises", [exerciseId,...])`. In `startSession()` (and `startSessionFromPlan` after plan items load), if the queue is non-empty, `addToPlan` each resolvable exercise (via `resolveExerciseAtGym`), toast "Added N you queued from Insights", clear the queue. De-dupe against items already in the session.
- Wiring per alert type:
  - Stall alert ("X has stalled") → button **"Deload next session (−10%)"** → pendingAdjust. Second button "Ignore" hides the alert for 14 days (`setMeta("muteAlert:stall:"+exId, date)`).
  - "X — N days since last time" → **"Add to next workout"** → queuedExercises.
  - Region neglect ("Legs — 12 days") → **"Queue a leg exercise"** → opens a mini-sheet listing that region's exercises sorted by `sortForAd­d` (favorites first), tap one → queuedExercises.
  - Joint flags → **"See history"** → `openExerciseProgress(exId)`. Also fix the count wording: count *sessions* with flags, not sets ("flagged in 2 workouts", not "×6").
- Button style: existing `.btn secondary sm` inside the `.insight` block.

**2.3 Restructure the tab as three questions.**
Reorder/group existing cards under three `.sectionhead`s — no card rewrites, just narrative:
1. **"Am I consistent?"** — Overview tiles (days/streak/sets), Consistency calendar, Training volume trend.
2. **"Am I progressing?"** — Progressive overload tile+breakdown (move out of Overview into its own card here), Strength progress, (Phase 3 forecasts slot here).
3. **"What should I change?"** — Muscle targets (2.1 bars), Muscle map, Balance, What needs attention (2.2).

**Acceptance (Phase 2):**
- Bars show `n/target`; editing a target in the drilldown updates the bar immediately.
- Tap "Deload next session" on a stalled lift → next time that exercise is added to a workout, the suggestion is −10% with the "you scheduled" note; the flag is gone after one use.
- Queue an exercise from an alert → next `startSession()` at any gym includes it (resolved to that gym) with a toast.
- All existing insights still render with zero-data, one-session, and multi-week seeds (test all three).

---

## Phase 3 — Motivation layer: weekly recap, forecasts, standards, frequency

Independent widgets; ship in any order; each degrades gracefully with thin data.

**3.1 Weekly recap card.**
- When: top of Insights, only when `getMeta("lastRecapWeek") !== mondayOf(todayISO())` AND the previous calendar week had ≥1 session. Dismiss button writes `lastRecapWeek` = current Monday.
- Content (previous completed week, computed from sessions/sets): workouts done; total sets vs sum of muscle targets; best moment — priority: any PR (re-run `computePRs` per exercise excluding that week, compare) → biggest e1RM % jump → most sets in a week for any muscle; one fix — the muscle with the largest target shortfall, phrased as an action ("Chest landed 4/10 — one push day covers it").
- Keep it 4 lines max, `.statuscard` styling so it reads as "the" card.

**3.2 Forecasts + milestone countdowns (per-exercise detail).**
- In `openExerciseProgress`, under the e1RM chart, when the exercise has ≥4 sessions spanning ≥28 days: ordinary least squares on (dayIndex, e1RM) over the last 10 weeks. Show only if slope > 0 and r² ≥ 0.4 (else show nothing — no negative forecasts, no noise).
- Copy: "On pace for **{next milestone}** around **{month day}**" where milestone = next round number above current e1RM (next multiple of 10kg; or if bodyweight is set and the lift is bench/squat/deadlift/ohp family, the next 0.25×BW multiple — "1.25× bodyweight").
- Cap the horizon at 16 weeks ("…later this year" beyond that). Tiny-print: "Straight-line estimate from your last 10 weeks — not a promise."

**3.3 Strength standards (only if bodyweight is set).**
- Optional `setMeta("sex","m"|"f"|null)` selector next to the bodyweight field ("Used only for strength standards — leave unset to hide them").
- Hardcode a standards table (e1RM as multiple of bodyweight) for four movement families matched by `normName` keywords: bench press, squat, deadlift, overhead press. Bands Beginner/Novice/Intermediate/Advanced/Elite. Use the commonly cited strengthlevel.com-style multiples, e.g. male bench 0.50/0.75/1.00/1.50/2.00 × BW, female bench 0.35/0.50/0.75/1.00/1.40 (fill the other lifts from the same source family; keep the table in one commented block for easy correction).
- Surface: a small band chip in `openExerciseProgress` records section ("Intermediate — next: Advanced at {kg}"). No leaderboard, no card of its own.

**3.4 Frequency insight.**
- Per muscle over the last 4 completed weeks: sessions-per-week that trained it (from primary muscle of each set's exercise). If a muscle has ≥6 sets/week but frequency < 1.5×/week, add ONE insight to "What should I change?": "Chest: all {n} weekly sets land in one day — splitting across two days usually lets you do more quality sets." Max one such insight per render (pick the highest-volume qualifying muscle) to avoid nagging.

**Acceptance (Phase 3):** recap appears Monday once and stays dismissed; forecast hidden for noisy/declining lifts and sensible for a clean +2.5kg/week seed; standards hidden until bodyweight+sex set; frequency insight absent when everything is 2×/week.

---

## Phase 4 — Cross-machine calibration ("equivalent machines")

**Goal:** answer "I did 60kg on gym 1's chest press — what do I pick on gym 2's different chest press (or level machine)?" using the user's own history. This extends, not replaces, the `linkId` system: `linkId` = *same physical machine* (histories pool). New `equivId` = *same movement, different machine* (histories stay separate; only a conversion hint is shared).

**4.1 Data model.**
- `ex.equivId` (string) on exercise records: machines the user marked equivalent share one. A `linkId` group counts as a single node in an equivalence group.
- Calibration state per (equiv pair) in meta: `setMeta("calib:"+equivId, {pairs:[{a:<e1RM_A>, b:<e1RM_B>, date}], ratio, updatedAt, anchor:<exerciseId of A>})`. Anchor = the machine with the longest history at link time (the reference ruler).

**4.2 Linking UX.**
- In `openExerciseProgress`, when the exercise is a gym-scoped machine/cable and other gyms have machines with an overlapping `primary` muscle, show a quiet row: "Train this movement at another gym? **Link as equivalent**" → stacked sheet listing candidate machines at other gyms (same `primary`, not already linked/equiv), each with gym dot + name. Picking one sets `equivId` on both and computes the initial ratio (4.3).
- Also hook the existing `maybePromptSameMachine` flow: its "Different machine" button becomes "Different machine — but same movement?" offering equivalent-link as the middle option (Same / Equivalent / Unrelated).
- Unlink: "Unlink equivalent" row in the same place.

**4.3 Ratio computation (the exchange rate).**
```js
// best per-session e1RM series for a machine group: [{date, m}] (reps for isBW — but
// restrict equivalence to loaded machines/cables in v1; exclude bodyweight & plate-at-0)
async function e1rmSeries(exId){ /* pool linkedIds, epley per set, max per session date */ }

// calibration pairs: windows where both machines were trained within 14 days
function calibPairs(seriesA, seriesB){
  // for each B session, find nearest A session ≤14 days away (each A used once);
  // pair = {a: that A e1RM, b: B e1RM, date}
}
// ratio: with 1 pair → b/a. With ≥2 → least-squares through origin: sum(a*b)/sum(a*a).
// (Through-origin, not affine: zero strength = zero on both rulers; robust with few points.)
```
- Recompute lazily: after `finishSession` commits sets for any exercise in an equivalence group, recompute and store. Keep last 8 pairs max (rolling).
- **RPE correction:** if the first session on machine B after a mapped suggestion is rated Grind, multiply stored ratio by 0.95; all-Easy, by 1.05. Clamp total drift to ±15% of the fitted ratio. (Reuses the existing per-item `rpe` the logger already collects.)

**4.4 Where the hint appears (hint, never override).**
- In `addToPlan`/`suggestNext` path: when an exercise has an `equivId`, no recent own-history (nothing in 21 days), but its equivalent DOES have recent history and a stored ratio → compute the equivalent's suggested plan, map weights through the ratio, round to this machine's `increment`, and return it with kind `"mapped"` and note: "Based on {other machine} at {gym} ({X}×{r} there) — ≈ {Y} here. First time mapping, so treat it as a starting point."
- If the exercise has BOTH own recent history and an equivalent's newer history, prefer own history (normal engine) but append a one-line note when the mapped value disagrees by >10%: "Your {other gym} sessions suggest you're stronger than this — try {Y} if it feels light."
- `progBadge` gets a `"mapped"` pill ("≈ from your other gym", `.progpill.hold` styling).

**4.5 Level machines → kg (closes the Phase 1 gap).**
- `levelKg(ex)`: return `ex.kgPerLevel` if user entered it; else if `ex.unit==="lvl"` and it has an `equivId` ratio against a kg machine, the through-origin ratio IS kg-per-level (e1RM_kg / e1RM_level) — return `ratio` from the calib record (anchor must be a kg machine; if anchor is the level machine, invert).
- Manual entry: in `openExerciseSheet` when unit = `lvl`, optional field "kg per level (if the stack shows it)" → `ex.kgPerLevel`.
- Once available, `setTonnage` (Phase 1) starts counting these sets; the exclusion note shrinks. Show inferred value transparently in `openExerciseProgress`: "1 level ≈ {n} kg (from your {machine} history — edit in exercise settings)".

**4.6 Insights: one normalized trend line.**
- In Strength progress, when an equivalence group exists, render ONE block for the group: headline = movement name, one `lineChart` of **relative strength** (each machine's e1RM ÷ its own first value, merged on the date axis, so the line is in % terms), caption "combined trend across {n} machines · {gyms}". Below it, the per-machine rows exactly as today (raw units, separate PRs).
- The `combined across N gyms` label already exists for linkId groups; reuse the pattern, but label equiv groups "equivalent machines · normalized".

**4.7 Cold start (no data on machine B at all).**
Keep the roadmapped seeding: first session on a machine that has an `equivId` but zero pairs → after the first completed set, ask once "vs {machine A}, did that feel Easier / Same / Harder?" → seed ratio = (b_e1RM_from_that_set / a_recent_e1RM) adjusted ±7% by the answer. Store as pair #1. This is one small sheet + one meta write; do it last, de-scope if the phase runs long.

**Acceptance (Phase 4):**
- Seed: machine A (kg) 8 sessions climbing 40→60kg; machine B (lvl) 3 sessions interleaved within the window at levels 7/8/8. Link as equivalent → ratio ≈ level-per-kg fits the seed; suggestion on B maps A's latest target through the ratio, rounded to increment 1; note names machine A and the gym.
- PRs on A and B remain separate; nothing in History changes.
- Level sets now appear in loaded volume via inferred kg-per-level; the drilldown "kg moved" grows accordingly.
- Unlink removes hints and normalized chart, harms nothing else.
- With NO equivalence links, every code path behaves exactly as v68 (this must be explicitly verified — the engine change in 4.4 must be inert when `equivId` is absent).

---

## Sequencing, sizing, deploys

| Phase | Ships as | Size | Depends on |
|---|---|---|---|
| 0 Data integrity | v69 | S (½ day) | — |
| 1 Bodyweight + honest volume | v70 | S–M (1 day) | 0 |
| 2 Targets + actionable alerts + structure | v71 | M (1–2 days) | 0 |
| 3 Recap, forecasts, standards, frequency | v72 | M (1–2 days) | 1 (BW for standards), 2 (targets for recap) |
| 4 Equivalent-machine calibration | v73 | L (2–3 days) | 1 (levelKg wiring), 0 |
| 5 Color semantics | v74 | S (½–1 day) | 0 only — can slot anywhere after Phase 0 |

Each phase: implement → verify live with seeded data (fresh profile AND a seeded 4-week profile) → console clean → bump `APP_VERSION` + sw `CACHE` → ask the user before pushing to main.

**Out of scope (explicitly):** cloud sync, accounts, rest-timer countdown and the rest of the UX-review backlog (tracked separately in `UX-REVIEW-2026-07-06.md` — items 4–15), gender-specific anything beyond the optional standards toggle, bodyweight history tracking, per-set RPE UI changes.

## Phase 5 — Color semantics (v74)

**Goal:** make color carry meaning again — orange = interactive/brand, a neutral hue = data, green = positive/success, amber = caution. No redesign; targeted fixes to the existing palette. All changes must be applied to BOTH themes and verified in both.

**5.1 Give data visualization its own hue (the taste call — confirm the exact hue with the user before shipping; default below).**
Today orange is simultaneously brand, primary action, current-exercise highlight, chart line, heatmap ramp, volume-bar fill, and selected-filter state — so it no longer signals "tap me". Introduce a data color:
- New CSS vars: `--data: #60A5FA` (dark theme) / `#2563EB` (light) — the existing Legs blue family, already proven legible in both themes.
- Switch to `var(--data)`: `lineChart` polyline/fill/end-dot, `sparkline` stroke/dot, `bodyHeatmap` ramp base (see 5.3), Balance card `.vbar .fill` (currently default orange), and the Training-volume chart.
- KEEP orange: all buttons, `.fchip.on` selected filters, `.card.current` highlight, NOW tag, `.statuscard` border, brand icon, muscle-group bars (those are already region-hued — untouched).
- Acceptance: on the Insights tab, the only orange elements are interactive (chips, buttons); every chart reads in the data hue; nothing became low-contrast (spot-check with computed styles in both themes).

**5.2 De-collide warn vs Shoulders (mechanical).**
`--warn: #FBBF24` (dark) is nearly identical to Shoulders `REGION_HUE.Shoulders: #EAB308`. Change **Shoulders**, not warn: `REGION_HUE.Shoulders → #CA8A04` (gold, still reads "yellow-family" for shoulders), `REGION_HUE_LIGHT.Shoulders` stays `#B45309`… which now collides with light `--warn: #B45309` — so also shift light warn to `#A16207` OR light Shoulders to `#92700C`; pick whichever keeps ≥4.5:1 on light surfaces (verify with a contrast check). Acceptance: an amber deload `.progpill.down` next to a Shoulders `.mtag` is visibly different in both themes.

**5.3 Theme-aware heatmap ramp (bug-level fix).**
`bodyHeatmap`'s fill is hardcoded `rgba(249,115,22, 0.10+0.85*v/max)` — dark-theme orange regardless of theme; near-invisible at low alpha on the light theme's white surface. Fix: derive the ramp from the data hue per resolved theme (mirror the `regionHue()` pattern): dark → `rgba(96,165,250, 0.10+0.85*x)`, light → `rgba(37,99,235, 0.16+0.80*x)` (higher alpha floor so faint muscles stay visible on white). If 5.1 is deferred, apply the same theme-split using the orange pair (`#F97316`/`#E2620C`) — the theme-awareness is the fix; the hue is policy.

**5.4 Light-theme accent contrast (mechanical).**
White text on light-accent `#E2620C` is ~3.3:1 — passes only for large/bold. Darken light `--accent` to `#C2410C` (Tailwind orange-700; white text ≈4.9:1) and keep `--on-accent: #FFFFFF`. Check knock-ons: `gymPick` tint, `.fchip.on`, `progpill` tints, and the `tintStyle()` alpha-hex composites still render correctly with the new base. Dark theme unchanged.

**5.5 In-workout green hierarchy (small).**
Two solid-green CTAs at different scopes compete: per-exercise "Done — log & minimize" (full-width, every card) vs the session-level "Finish" (statuscard). Demote the per-exercise button to outline-green (transparent bg, `1px solid var(--accent-2)`, green text — mirror `.btn.danger`'s pattern as `.btn.success-ghost`), keeping solid green exclusively for Finish. Acceptance: in a 3-exercise workout, exactly one solid-green button is on screen.

Sizing: S (½–1 day) total. Independent of Phases 0–4; slot anywhere after Phase 0. Ships as its own version bump with before/after screenshots of Today (in-workout), Insights, and the muscle heatmap in both themes.

## Addendum (2026-07-06, after design review with the user) — engine insulation rules

The progression engine and implied-kg layer must stay firewalled. Three binding clarifications:

**A1. Native units rule (absolute).** `suggestNext`/`volumeProgress`/`classicNext` operate ONLY in each exercise's native units (kg, levels, reps). `setTonnage`, `bwCoef`, and `levelKg` are display/insights-layer only and must never feed a prescribed target — with the single exception of A2. Rationale: calibrated `levelKg` drifts as the ratio refines; recomputed *display* history is honest, but a prescription that shifts because a calibration moved would violate the anti-nanny/trust principle.

**A2. Weighted-bodyweight fix (existing v68 distortion — fold into Phase 1).** In `suggestNext`, an exercise with any added load in its last session (`base>0`) enters the volume model computed on ADDED LOAD ONLY — so a +4% target on 10kg added to a weighted dip is ~+0.5% of true stimulus, and low added loads swing wildly (2.5→5kg reads +100% added, ≈+3% true). Fix: when `isBW(ex)` AND `State.bodyweightKg` is set, run the volume solver on implied total load per set (`State.bodyweightKg*bwCoef(ex.name) + added`), then convert the solved plan back to added load for display/logging (subtract the constant, clamp ≥0, round to increment). Bodyweight enters as a constant here — never the drifting `levelKg`. When bodyweight is unset, keep current behavior unchanged.

**A3. Overload-score magnitude damping (fold into Phase 2 or wherever `overloadScore` is next touched).** The magnitude term (20% of the composite) averages per-lift fractional gains; rep-based lifts inflate it (8→10 reps = +25% vs +2.5kg on 60 = +4%), and small denominators explode it (level 2→3 = +50%). Two changes: (a) for `isBW` lifts use `epley(1, reps)` = `1+reps/30` as the metric instead of raw reps (+1 rep ≈ +3%, same scale as loaded lifts, needs no bodyweight value); (b) clamp each lift's contribution to `avgGain` to ±20%. The up/hold/down classification (relative sign) is unit-robust and stays as is.

**Open questions to confirm with the user before Phase 3/4 (defaults in parentheses):**
1. Standards bands source/values — OK to use strengthlevel-style multiples? (yes, with a "rough bands" disclaimer)
2. Equivalence linking restricted to machines/cables in v1, excluding bodyweight and barbell variants? (yes — free weights are already global, no mapping needed)
3. Recap cadence weekly only, or monthly too? (weekly only in v1)
