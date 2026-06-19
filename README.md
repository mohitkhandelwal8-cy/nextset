# NextSet

A local-first gym workout tracker (PWA). Log sets, reps and exact weights on any machine at any gym, and get told what to try next time. No account, no server, no subscription — all your data lives on your device.

## Run it

It's a static site — any web server works. From this folder:

```bash
python3 -m http.server 4178 --directory NextSet
# then open http://localhost:4178/index.html
```

(Or open `index.html` directly in a browser — logging works, but installability/offline caching needs to be served over http.)

## Put it on your phone (use it like an app)

1. Host the folder somewhere (e.g. Netlify drop, GitHub Pages, or your own server over HTTPS).
2. Open the URL on your phone in Safari/Chrome.
3. Share → **Add to Home Screen**. It launches full-screen and works offline.

## What it does

- **Gym profiles** — pick the gym you're at; see only that gym's machines. Same movement on different gyms' machines is tracked separately (so progressions stay honest).
- **Fast logging** — tap-to-adjust weight/reps with per-machine increments, "same as last", one-tap set completion.
- **Quick add (natural language)** — type `Leg press 100 x 10, 9, 8` and it logs all sets.
- **Progression suggestions** — double progression: hit the top of your rep range on every set → add weight; mid-range → add a rep; missed the bottom → repeat or deload. Optional "how did that feel?" (easy/solid/grind) makes it smarter.
- **Customizable today's plan** — suggestions pre-fill, but you assemble/edit the whole session.
- **Insights** — per-exercise est-1RM trend, plateau alerts, "haven't trained X in N days", and joint-flag patterns.
- **Joint/pain flag** — flag a tweaky set; recurring flags surface in Insights.
- **Export** — full CSV / JSON anytime. Your data, no lock-in.

## Tech

Single self-contained `index.html` (vanilla JS), IndexedDB for storage, a service worker for offline. No build step, no dependencies.

## Roadmap (fast-follow)

- New-gym calibration ("vs your usual, this felt easier/same/harder" → seed a starting weight)
- Optional Claude API hook for fuzzy NL parsing + open-ended "ask your data" questions
