# Tutorial Stage — Design Draft

> **Status (implemented as draft):** the extended `tutorial_step` schema below
> (`action_prompt`, `highlight.selector`, `image`/`image_caption`, `equations`)
> is rendered by `public/shared/overlay.js`. Class-A sims (Newton, Fluid flow, Rotational
> Motion) are tagged with `data-tut-id` and use live spotlight highlights.
> Class-B PhET sims (Energy Skate Park, Buoyancy, Under Pressure) currently use
> text + action prompts only — annotated screenshots (Approach B1) can be
> dropped into `public/assets/tutorials/` later and referenced via `image`
> without code changes. The "confirmation gate" option is implemented: when
> `action_prompt` is set, the Lanjut button unlocks after the student clicks
> "Saya sudah mencoba".

## Goal

Replace the current "tutorial = text card" stage with an interactive, guided walkthrough that:

1. **Darkens** the sim background (does NOT block interaction — students should still drag sliders while the tutorial is open)
2. **Highlights** a specific control or area of the sim with a glowing outline / cutout
3. **Explains** what that variable is and how to measure it via a tooltip / callout
4. **Prompts** the student to do a small action ("Geser slider Massa ke 20 kg") before advancing

The tutorial *teaches the simulation* — what each variable means, where to read its value, what to manipulate. It is **not** assessed; it gates progress only via a "Lanjut" button.

## Two classes of sims

### Class A — Self-built sims (we own the HTML)
Newton, Fluid flow, Rotational Motion.

We can add `data-tut-id="..."` attributes to controls inside `index.html`:
```html
<input type="range" id="mass" data-tut-id="mass-slider" ...>
<div class="hud-item" data-tut-id="hud-velocity">Kecepatan: <strong>0.0</strong></div>
```

The overlay reaches into the iframe (same-origin → `iframe.contentDocument`), queries `[data-tut-id="mass-slider"]`, gets its `getBoundingClientRect()`, and draws an SVG mask with a cutout over it.

**Effort:** low — ~150 lines of overlay JS + tagging maybe 5–10 elements per sim.

### Class B — PhET HTML sims (we don't own the markup)
Energy Skate Park, Buoyancy Lab, Under Pressure.

Internals are minified, controls have no stable IDs, layout shifts per device. We cannot reliably target elements inside.

Three viable approaches, ranked:

#### Approach B1 (recommended) — Annotated image + "try it" prompt

The tutorial step shows:
- A **pre-captured screenshot** of the PhET sim with arrows/labels drawn on top (PNG produced once, committed to repo)
- A short instruction telling the student what to find on screen and try
- An "OK, sudah dicoba" button to advance

```
┌──────────────────────────────────────────────┐
│ Tahap 1: Mengenal kontrol gesekan           │
│                                              │
│ [annotated screenshot, ~200px tall]         │
│                                              │
│ Pada panel kanan-bawah ada slider           │
│ "Friction". Coba geser ke kiri (off)        │
│ lalu ke kanan (high) sambil mengamati        │
│ skater. Apa yang berubah?                    │
│                                              │
│         [ Saya sudah mencoba → ]            │
└──────────────────────────────────────────────┘
```

**Pros:** Robust against PhET version changes (you re-capture if needed), works on any screen size, no fragile DOM probing.
**Cons:** Manual screenshot work per step. Static — no live highlight.

**Effort:** ~30 min per sim to capture + annotate 3–5 screenshots.

#### Approach B2 — Coordinate-region highlight

Hardcode rectangles relative to the iframe's content size, e.g.
```json
{ "highlight": { "iframe_rect": { "x": 720, "y": 480, "w": 220, "h": 60 } } }
```
The overlay computes the iframe's actual pixel offsets, scales the rect, and draws the mask.

**Pros:** Live, no screenshots needed.
**Cons:** Breaks if PhET reflows on different aspect ratios; needs per-resolution tuning. Brittle.

#### Approach B3 — Heuristic DOM probing inside PhET iframe

Walk the iframe's DOM looking for elements with text matching "Friction", "Mass", etc. PhET uses `<button aria-label="...">` for many controls.

**Pros:** No screenshots, somewhat resilient.
**Cons:** PhET label text changes per locale (English embed vs. Indonesian). Minified DOM. Will break unpredictably.

### Recommendation per sim
| Sim                | Class | Approach |
|--------------------|-------|----------|
| Newton             | A     | `data-tut-id` highlights                         |
| Fluid flow         | A     | `data-tut-id` highlights                         |
| Rotational Motion  | A     | `data-tut-id` highlights                         |
| Energy Skate Park  | B     | **B1** annotated screenshots + try-it prompts    |
| Buoyancy Lab       | B     | **B1** annotated screenshots + try-it prompts    |
| Under Pressure     | B     | **B1** annotated screenshots + try-it prompts    |

## Schema changes

Extend the `tutorial_step` payload (backwards compatible — `body` still works):

```jsonc
{
  "type": "tutorial_step",
  "stage": "tutorial",
  "payload": {
    "title": "Slider Massa",
    "body": "Massa benda diukur dalam kilogram (kg). Geser slider ini untuk mengubahnya.",

    // Class A: live highlight on a sim element
    "highlight": {
      "selector": "[data-tut-id=mass-slider]",
      "shape": "rect"            // or "circle"
    },

    // Class B: annotated screenshot
    "image": "/assets/tutorials/energy/01-friction.png",
    "image_caption": "Lokasi slider Friction di panel kanan-bawah",

    // Optional: confirmation gate before "Lanjut" enables
    "action_prompt": "Coba geser slider lalu klik tombol di bawah.",

    // Optional: formula reference card. Used on each sim's LAST tutorial
    // step (right before the quiz) to present the equations that some quiz
    // items use as the basis of calculation.
    "equations": [
      { "label": "Hukum II Newton", "formula": "ΣF = m × a",
        "legend": "ΣF = resultan gaya (N), m = massa (kg), a = percepatan (m/s²)" }
    ]
  }
}
```

`highlight`, `image`, and `equations` are all optional; if none is present the tutorial falls back to the current text-only card.

## Overlay rendering

### Darkening mask (Class A)
SVG element layered between the iframe and the quiz panel:
```html
<svg id="tut-mask" style="position:fixed; inset:0; pointer-events:none;">
  <defs>
    <mask id="cutout">
      <rect width="100%" height="100%" fill="white"/>
      <rect x={hx} y={hy} width={hw} height={hh} rx="8" fill="black"/>
    </mask>
  </defs>
  <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#cutout)"/>
  <rect x={hx} y={hy} width={hw} height={hh} rx="8"
        fill="none" stroke="#fbbf24" stroke-width="3"
        style="filter: drop-shadow(0 0 8px #fbbf24);"/>
</svg>
```

`pointer-events: none` on the SVG means the student can still click/drag the highlighted control through the mask. The dimmed area visually backgrounds the rest.

A small callout box (the quiz panel's body) shows the title + body + an arrow pointing at the highlighted region.

### Annotated image card (Class B)
Just an `<img>` tag in the quiz panel body with caption text. No iframe manipulation. The student looks at the image, then at the sim, and tries the action manually.

## File-system layout for screenshots

```
public/assets/tutorials/
  energy/
    01-friction.png
    02-skater-position.png
    03-energy-graph.png
  buoyancy/
    01-density-slider.png
    ...
  pressure/
    01-depth-sensor.png
    ...
```

Screenshots are taken at a known viewport (e.g. 1280×720), saved as PNG with arrows/labels drawn in any image editor. Served as static assets — no special endpoint needed.

## Build order (when ready)

1. **Phase 1**: Extend `tutorial_step` schema + overlay rendering to support both `highlight` and `image` (no actual data yet — just the renderer).
2. **Phase 2**: Tag Class-A sims with `data-tut-id` and write tutorial entries for Newton (smallest, fastest).
3. **Phase 3**: Capture screenshots for Energy Skate Park, write tutorial entries. Repeat for Buoyancy and Pressure.
4. **Phase 4**: Class A sims for Fluid flow and Rotational Motion.

Newton first because we can validate the highlight renderer end-to-end on a sim we fully control before committing to the workflow for the harder cases.

## Out of scope for this draft

- "Action verification" (detecting that the student actually moved the slider) — possible for Class A via input listeners, infeasible for Class B without intrusive probing. Defer.
- Translations of PhET labels — students will see English PhET UI either way; we narrate in Bahasa Indonesia in the tutorial text.
- Animated GIF walkthroughs — heavier asset, can be added later inside `image` field if needed (browsers render GIFs in `<img>` fine).
