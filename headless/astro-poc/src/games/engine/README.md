# The Eliyahu game engine

One shared runtime for the games in `/games`. A game is a *spec*: a list of
steps plus the wording. The engine owns the card, the mascot, the scoring and
the finish report, so a new game is a single file in `src/games/specs/`.

## How a game is served

`src/lib/eliyahuGameDocument.ts` renders a small HTML shell: the font faces
from `fonts.css`, the theme, and the mascot sprite sheet in `mascot.html`. The
Hebrew and Latin faces point at the site's own `/fonts/` files; the remaining
subsets in `fonts/`, `engine.css`, `engine.js` and the game's own spec are
imported with `?url`, so Vite emits them as hashed static files under `/_astro/`. Keep it that way: anything imported with `?raw` lands in
the Wix server bundle, which has a size budget
(`scripts/check-wix-worker-payload.mjs`). Specs never call `fetch`.

`/games/<slug>` is the indexable wrapper page; it embeds `/games/<slug>/play`,
which carries `noindex`. Both routes are driven by `src/lib/eliyahuGames.ts`,
where the slug, the wording and the palette live.

## Writing a spec

```js
window.NoamGame.boot({
  slug: 'my-game',
  mascot: 'אליהו',
  steps: [ /* … */ ],
  skills: [{ step: 2, name: 'שם המיומנות', math: 'a × b' }],
  bonus: { label: '…', hint: '…', setup: function (box, ctx) {} }
});
```

Each entry of `skills` points at a quiz step and is worth 80 points. The finish
screen builds its bars and its "חזק ב־" / "כדאי לחזק" summary from that list.

### Fields shared by every step

`tA` plus optional `tM` (mathematics, isolated LTR) and `tB` form the title.
`sub` is the line under it, `btn` is the label of the forward button, `cue` is
the hint strip above it, and `tip` is **required**: it is what Eliyahu says when
the step opens. Never call `ctx.say` from `setup` for the opening line; use
`tip`.

Mathematics inside Hebrew text must be wrapped with `NoamGame.m('7 × 8')`, which
isolates it so RTL never reorders it. Never write a fraction with a slash in
visible text; use words, a vertical layout or the `÷` sign.

### `mode: 'intro'`

`emoji`, `eq` (the headline formula), `note`, and optionally `art` for raw SVG.

### `mode: 'quiz'`

`opts` is an array of `{ t, c, f }`: the label, `c: true` on the single correct
option, and `f`, the sentence shown after choosing it. `win` is what Eliyahu
says on success, `wrongSay` on a miss, and `hints` is an array of progressive
hints. A quiz may also carry `aspect`, `alt` and `setup` to draw a picture above
the question.

### `mode: 'scene'`

`aspect: [w, h]` sets the drawing's viewBox, `alt` its accessible label,
`cueDone` the cue after the learner succeeds, and `nudge: { target, text }` what
Eliyahu says if nothing happens for nine seconds. `setup(ctx)` builds the scene
once; optional `paint(ctx)` runs on every repaint and `enter(ctx)` half a second
after the step opens. Set `needDone: false` to let the learner move on without
solving.

### `mode: 'finish'`

`finalLead` and `formula` — the rule the game taught.

## The scene context

| Call | What it does |
| --- | --- |
| `ctx.draw(html)` | replaces the drawing (SVG markup, in viewBox units) |
| `ctx.el(id)` | an element inside the drawing, by id |
| `ctx.button(label, onClick, { ghost, id, target })` | a control under the drawing |
| `ctx.extra(html)` | arbitrary markup between the drawing and the buttons |
| `ctx.caption(text)` | the formula line under the drawing |
| `ctx.note(text, tone)` | the status line; `tone: 'good'` turns it green |
| `ctx.solved()` | unlocks the forward button |
| `ctx.drag(el, { start, move, end })` | pointer drag, reported in viewBox units |
| `ctx.tween(ms, fn)` | animation loop; `fn(l)` with `l` from 0 to 1 |
| `ctx.say(text, opts)` / `ctx.point(target, text)` | the mascot speaks or points |
| `ctx.register(key, el)` | names an element the mascot can point at |
| `ctx.sfx(k)` | `click`, `tick`, `correct`, `error`, `win` |
| `ctx.burst(n)` / `ctx.floatPts(el, n)` | confetti and a floating score |
| `ctx.busy(on)` / `ctx.dragging(on)` | suppress nudges during an animation |
| `ctx.get(k)` / `ctx.set(patch)` | per-scene scratch state |
| `ctx.wait(ms)` / `ctx.later(fn, ms)` / `ctx.an(el, frames, opts)` | timing |
| `ctx.m(text)` | the mathematics isolator |

`NoamGame.ez(l)` is the shared easing curve and `NoamGame.shuffle(arr)` a
non-mutating shuffle.

Attach a drag once, outside any redraw loop, and update attributes in place
rather than rebuilding the markup on every pointer move.

## Styling

The palette arrives as custom properties (`--main`, `--main-soft`,
`--main-line`, `--ink`, `--bg-a`…) from the theme in `eliyahuGames.ts`, so a
spec should use those variables or its own explicit colours. `engine.css` also
offers `.sceneStrip` for a row of readouts and `.stepper` with `.unit` and
`.var` for plus and minus controls.

## Running one locally

```
npx astro dev --config astro.config.preview.mjs --host 127.0.0.1 --port 4321
```

Then open `/games/<slug>/play`. The route sets a five minute cache, so add a
unique query string while iterating.
