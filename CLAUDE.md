# Grinder’s Manual Trainer: context for Claude Code

A mobile-first study companion for *The Grinder’s Manual* (Peter Clarke, 6-max NLHE, 100bb): 14 chapter lessons with quizzes, a range trainer on a poker table, math drills, spaced-repetition flashcards. Sister app of `hail75/holdem-drill`: same table and card design and fonts (Fraunces + Instrument Sans), but its own palette, **Midnight & Brass** (the owner chose it from four in v2.2; there is no palette picker).

## Files
- `index.html`: the whole app (HTML, CSS, JS in one file, no build step, no dependencies).
- `manifest.webmanifest`, `sw.js`, `icon-*.png`, `apple-touch-icon.png`: installable PWA with offline support. **Every release: bump `CACHE` in `sw.js` (`grinders-manual-X.Y.Z`) and `BUILD.v` in `index.html` together, and set `BUILD.at` to the release time in UTC (`"2026-11-19T10:15Z"`).** Small fix bumps Z, new feature bumps Y, big change bumps X. Settings shows the version and build time, so you can tell when a deploy has loaded.
- `icon.svg`: the one source for the logo (header and rail inline the same markup). PNGs are rendered from it with Playwright: 192 and 512 with transparent rounded corners, apple-touch (180) and maskable (512, mark scaled to 78%) without corners.
- `fonts/`: bundled web fonts, cached by `sw.js`. Nothing loads from Google Fonts.
- `docs/`: README screenshots. Retake them after a visible UI change.
- `tests/verify.mjs`: **run `node tests/verify.mjs` after every change; it must print "All checks passed".**
- Hosted on GitHub Pages from `main`, repo root.

## Code map (inside `index.html`)
Everything above `/* ===================== UI` is data and pure functions; the tests load it in Node, so keep DOM code below the marker.
1. `RANGES` (opens by seat), `CALLS` (flat tiers), `MODES` (range-trainer spots: `grp` Open / Flat / BB defend, `seat`, `vill`, `act`, `set`, `info`), `rangePct`.
2. `LESSONS`: `{id, ch, title, mins, sum, tool?, blocks:[[heading, html]], quiz:[[q, options, answerIndex, why]]}`. Helpers `P` (HUD stat pill), `GB` (good/bad factor table), `KEYBOX`. Lesson text reads range sizes from the data (`rangePct`), not typed numbers.
3. `CARDS`: flashcards `[front, back]`; ids are `c<index>`, so **only append** new cards, never reorder (saved schedules use the index).
4. `toolHTML`/`bindTool`: the interactive lesson tools. `MATH`: drill generators returning `{q, opts, a, why}`.
5. UI: hash routes `#home`, `#lesson-<id>`, `#ranges[/<mode>|/mix-<group>]`, `#math`, `#review`, `#progress`, `#settings`. `render()` per view. The range trainer draws the table with `tableHTML` (seats on an oval, hero at the bottom, chips `.stk` between seat and pot, dealer button on BU) and the chart with `gridHTML`.
6. Storage: localStorage key `gm-trainer-v1`, state `{lessons, quiz, drills, cards, days, math, theme}`. Keep the key and shape; add fields with defaults in `BLANK()`.

## Conventions
- Phone first: tap targets at least 44px, the main action in the sticky `.actions` bar above the bottom nav. At 960px and up the nav becomes a left rail and drills go two columns.
- Every colour is a CSS variable with light and dark values (`:root`, the dark media query, and `[data-theme="dark"]`). Check both themes and both widths after a visual change.
- Colour roles: `--felt*` is the navy primary (table, primary buttons, hero card; the name is historical), `--gold` the brass accent, `--accent` links and the active tab. Right and wrong use only `--good*` and `--bad*` (teal-green, brick-red, with `-mark` for the ✓/✗ circles); never colour a right answer with the primary.
- Touch feedback: `.press` is added on `pointerdown` (touch browsers apply `:active` late), the picked answer pops or shakes, and right/wrong options get ✓/✗ marks. Touch screens hide the 1–4 key badges and the keyboard help (`.kbd-only`). No vibration (the owner asked for visual feedback only).
- Cards show **10**; labels and charts use **T**. Suits are two-colour (red hearts and diamonds).
- Before adding a CSS class, search the file for the name. v2.0.1 reused `mid` (the table’s pot-centring class) for a 5/6 quiz result and for 75–90% progress bars, and both floated over the page as absolute boxes (holdem-drill had the same bug with `chips`). The tests now fail if a class with its own rule is also used as a modifier.
- Keyboard: 1–4 answer, Enter next, ← → lesson pages, R / F in the range trainer, Space flips a card.
- Lesson text is a summary in our own words; do not paste text from the book.
