# Handoff: Hanua "Room" Dashboard

## Prompt for Claude Code

> Update our existing dashboard home page to match the design in `design_handoff_room_dashboard/`. Read this README end to end first, then open `Room Dashboard.dc.html` in a browser as the visual reference (it needs `support.js` beside it). Recreate it in our codebase's existing framework, components and data layer. Don't paste the HTML in. Keep all existing data wiring (Notion, Pūtea, Claude, feed input, calendar events, spending) and change only the presentation. Copy the images in `assets/` into our public/static folder with the same names. Work section by section in this order: layout shell, sidebar bookcase, wall view, desk view, interactions. After each section, compare against the reference at 1440×900 and 1024×768.

## Overview
The home dashboard is presented as a physical room:
- **Left:** a sticky walnut bookcase sidebar, where each nav item is a book spine.
- **Top (Wall view):** a painted-brick wall with floating shelves, a working lamp, a live clock, a wall-mounted monitor showing spending, a hanging calendar and pinned sticky notes.
- **Bottom (Desk view):** scrolling down moves onto an oak desk with a notepad (today's list), an agenda card, a weekly spending receipt and desk objects.
- **Throughout:** a feed input stays docked at the bottom across both views.

## About the design files
The files here are **design references built in HTML**. They are prototypes of the intended look and behaviour, not production code. Rebuild them in the target app's framework (React, Vue, etc.) using its existing patterns. `Room Dashboard.dc.html` uses a small custom runtime (`support.js`) only so it can be previewed. Ignore that runtime when implementing.

## Fidelity
**High fidelity.** The colours, type, spacing, imagery and interactions are final. Match them closely. All copy is final unless it's driven by data.

## Design tokens
These come from the Bula Collective design system.

Colours:
- Cream: `#FAF7F2` (paper/cards), `#F5F0E8` (page), `#EDE5D4` (hairlines), `#E0D5BF`, `#D4C8B0` (borders)
- Ink: `#1C1814` (primary text, dark buttons), `#2E2620`, `#42382C`, `#5C4F3A` (secondary text), `#7A6B55` (muted), `#A08D74` (placeholder)
- Terracotta: `#C4602A` (accent, today marker, ADD button), hover `#B84E1E`, `#EAAA84` (FEED label), `#F0C9AE` (lamp glow)
- Green: `#3B6B5A` (positive, status dot), `#2E5243` / `#4D8470` (spend bars), `#D8EDE8` (dot halo)
- Wall fallback colour (matches the photo's bottom edge): `#C1B6AC`

Type (Google Fonts):
- **Cormorant Garamond** 300/400/500 + italics: display, greeting, headings, spine titles, handwritten-feel copy. Use `font-variant-numeric: lining-nums` for numbers.
- **DM Sans** 400/500: body and inputs.
- **DM Mono** 400/500: labels and eyebrows, uppercase, letter-spacing 0.12–0.22em, 9–11px.

Radius:
- 2–5px everywhere (monitor bezel 5px, cards 2–3px). No pills except status dots.

Shadows:
- Objects use `filter: drop-shadow(...)` (they're transparent PNGs), lit from the top-left: `drop-shadow(-6px 8px 10px rgba(28,24,20,.28))`.
- Shelves: `drop-shadow(0 14px 12px rgba(28,24,20,.32))`.
- Desk items: `drop-shadow(6px 14px 12px rgba(28,24,20,.4))`.

## Layout shell
- Two-column grid: `280px` sidebar plus a fluid main column. The sidebar is `position: sticky; top: 0; height: 100vh`, with 14px padding on the top, bottom and left.
- The main column stacks: Wall section (min-height 100vh), a 26px desk-edge strip, then the Desk section (min-height 100vh).
- The feed bar is `position: fixed`:
  - bottom 26px, centred over the main column: `left: calc(280px + (100vw - 280px)/2)`, `translateX(-50%)`
  - `width: min(720px, 100vw - 300px)`, 56px tall
  - background `#1C1814`, radius 4px

## Sidebar: bookcase
- **Container:** background `assets/shelf/case.png` at `background-size: 100% 100%`, with padding 22px 20px 18px and a shadow of `14px 0 30px -12px rgba(28,24,20,.5)`.
- **Header:** centred "Hanua" in Cormorant italic 32px `#F5F0E8`, with `text-shadow: 0 1px 0 rgba(0,0,0,.6), 0 0 18px rgba(240,201,174,.35)`. It sits in the photo's spotlight. Below it, "LIBRARY" in DM Mono 9px, tracking 0.28em, `#D4C8B0`.
- **Two shelves,** 22px apart. Each shelf is a stack of three books lying flat, then `assets/shelf/plank.png` (full width, height auto). The books overlap the plank by 3px.
  - Shelf 1: Work (I), Calendar (II), Money (III). Shelf 2: Health (IV), Learning (V), People (VI).
  - Images: `assets/shelf/book-{work|calendar|money|health|learning|people}.png`.
  - Each book is a full-width button, 36px tall. The image is stretched to 100% × 100%, all books flush left with no stagger or rotation.
  - Overlaid on the spine is a flex row with space-between: padding-left 13% (16% for Calendar), padding-right 12%.
    - Title: Cormorant italic 500, 18px, nowrap, gold-foil fill `linear-gradient(180deg,#FAF0EA,#F0C9AE 55%,#C9A27A)` via `background-clip: text`, with `drop-shadow(0 1px 0 rgba(0,0,0,.55))`.
    - Volume: Roman numeral in DM Mono 9px, `#E0D5BF` at 85% opacity.
  - States:
    - Rest: `drop-shadow(0 2px 3px rgba(0,0,0,.5))`.
    - Hover: `translateX(6px)`.
    - Active (current section): `translateX(12px)`, `brightness(1.08)`, shadow `drop-shadow(-2px 5px 6px rgba(0,0,0,.6))`.
    - Transition: 300ms `cubic-bezier(.25,.1,.25,1)`.
- **Bottom shelf** (pinned to the bottom): `assets/shelf/bookend.png` at 46px wide, next to the tagline "Plan with purpose. / Live with others in mind." in Cormorant italic 14px `#D4C8B0`, then a plank.

## Wall view
**Background**
- `assets/wall.jpg` (3072×2048), drawn once, never tiled:
  - `background-size: max(100vw - 280px, 1500px) auto`, positioned centre top, no-repeat
  - background-color `#C1B6AC`
- Overlays on top of the photo:
  - a fade `linear-gradient(180deg, rgba(193,182,172,0) 80%, #C1B6AC 99%)`, sized to the image box, so the photo blends into the fallback colour on tall screens
  - a soft top and bottom shade `linear-gradient(180deg, rgba(28,24,20,.10) 0, transparent 14%, transparent 80%, rgba(28,24,20,.12) 100%)`
- Optional "window light": a skewed white gradient blob at top right (`skewX(-18deg)`, blur 18px, 55% → 0 alpha).

**Layout**
- Inner wrapper: max-width 1240px, centred, padding `36px clamp(28px,5vw,72px) 0`.
- **Row 0:** status pills, right-aligned.
  - Each pill: `#FAF7F2` background, 1px `#E0D5BF` border, radius 2px, padding 6px 10px, DM Mono 10px `#42382C`.
  - Each has a 6px dot with a 2px halo:
    - "Notion 5/5": green `#3B6B5A`, halo `#D8EDE8`
    - "Pūtea · sample": `#D4733E`, halo `#F5DDD0`
    - "Claude on": green
- **Row 1:** a flex-wrap row with gap `48px 64px`. Left column is `flex: 1.4 1 520px`, right column is `flex: 1 1 360px`. On narrow screens the columns stack.
  - **Left column** (padding-top 34px; stack gap 44px, with the monitor pushed to the bottom via `margin-top: auto`):
    1. **Greeting shelf.** A row aligned to the bottom (gap 6px, padding 0 4%) sitting on a floating shelf, overlapping the plank by 7px:
       - **Lamp** (left), a button `clamp(84px,16%,118px)` wide:
         - `lamp-off.png` with `lamp-on.png` stacked absolutely on top; the on image's opacity is 1 when on and 0 when off, with a 400ms crossfade.
         - Behind it, a 440px radial glow `rgba(240,201,174,.75) → 0` that fades in over 600ms when on.
       - **Text block:**
         - Date eyebrow (e.g. "SATURDAY, 3 OCTOBER"): DM Mono 11px, tracking 0.22em, `#42382C`.
         - Greeting below it: "Good morning." / "Good afternoon." / "Good evening." chosen by local hour (<12, <18, otherwise), in Cormorant 300 italic, `clamp(42px,4.4vw,74px)`, line-height 0.9, tracking -0.025em, `#2E2620`, nowrap.
       - **Clock** (right): `clock.png` at `clamp(88px,17%,118px)` with live hands drawn on top. All hands rotate from the face centre (50%, 50.1%):
         - hour: 3px wide, 19% of the clock height, `#2E2620`
         - minute: 2px wide, 29%, `#2E2620`
         - second: 1px, 32%, `#C4602A`
         - centre cap: 6px, `#C4602A`
         - Tick every second.
    2. **Floating shelf component** (reused twice):
       - `assets/shelf/plank.png`, width 100%, height `clamp(26px,2.4vw,36px)`, `object-fit: fill`
       - Two brackets: `assets/shelf/bookend.png` rotated 180°, width `clamp(26px,6%,40px)`, at 12% from each end, top 60%, sitting behind the plank.
    3. **Ask Claude bar:**
       - Container: 56px tall, `#FAF7F2`, 1px `#E0D5BF` border, radius 3px, padding 0 6px 0 20px.
       - Contents, left to right:
         - "CLAUDE" label: DM Mono 10px, `#C4602A`.
         - Divider: 1px × 20px.
         - Input: Cormorant italic 21px, placeholder "Ask about anything on your wall…".
         - Button: dark 44px "ASK", hover `#C4602A`.
    4. **Monitor:**
       - Bezel padding 9px, `linear-gradient(#2E2620,#1C1814)`, radius 5px.
       - Screen: `#FAF7F2` with a faint top-left glare `linear-gradient(125deg, rgba(255,255,255,.6), transparent 32%)`, padding 24px 28px 18px.
       - Contents (spending card):
         - Header row (wraps): "OCTOBER SPENDING" on the left; "↓ 22% vs last month" on the right in green mono.
         - Total: "$" 28px `#7A6B55` + "1,868" at 64px, Cormorant, lining tabular numbers.
         - Category rows: grid `80px | minmax(48px,1fr) | 56px`, 8px vertical padding, `#EDE5D4` top border. Label DM Sans 14px; bar track 2px `#EDE5D4`; fill 4px (first row `#2E5243`, others `#4D8470`), width = value ÷ largest value; amount DM Mono 12px.
         - Footer: "SAMPLE · PŪTEA ISN'T RUNNING" / "LAST MONTH $2,411" in DM Mono 9px `#A08D74`.
       - When the lamp is off, add a screen glow to the bezel: `0 0 90px 24px rgba(216,237,232,.22)`.
  - **Right column** (flex column, gap 40px):
    1. **Hanging calendar:**
       - Hanging: a nail (3.5px dot, `#42382C`) with two 1px `#7A6B55` strings to the top corners.
       - Card: `#FAF7F2` with a dark 16px binding strip and two punched holes.
       - Header: "October" in Cormorant 300 italic 44px and "2026" in mono, above a 1px `#1C1814` rule.
       - Grid: weekday initials, then a 7-column hairline grid with 60px rows. Day numbers are Cormorant 18px in a 30px circle. Days outside the month use `#D4C8B0`. Clicking a day selects it (selected background `#F5F0E8`).
       - Today: a filled `#C4602A` circle with cream text.
       - Footer: the selected date in mono (e.g. "SATURDAY 3 OCTOBER") on the left, "Nothing coming up." in Cormorant italic on the right (or the events list).
    2. **Books and plant shelf,** pushed to the bottom (`margin-top: auto`) so its plank lines up with the bottom of the monitor:
       - `books.png` at `clamp(150px,46%,210px)`, with `margin-top: -90px` so it rises over the bottom of the calendar
       - `plant.png` at `clamp(136px,42%,190px)`, with `margin-bottom: -44px` so the pot sits on the plank
       - Same floating-shelf component as above.
- **Row 2: Pinned notes** (left column width):
  - Empty state: a dashed 132×120 placeholder with a tape strip, plus "Your notes will pin here." in Cormorant italic 19px `#7A6B55`.
  - Notes: 150px sticky notes, rotations cycling −2°, 1.5°, −0.8°, 2.4°, −1.6°, colours cycling `#F5DDD0`, `#D8EDE8`, `#EDE5D4`, `#D0E8F0`, each with a translucent tape strip. Content: time in DM Mono 9px, text in Cormorant 19px.
- **"TO THE DESK ↓"** link, centred (DM Mono 10px, tracking 0.2em): smooth-scrolls to the desk edge.
- **Lamp off:** a full-wall overlay `#1C1814` at 34% opacity (600ms) sits above everything on the wall except the lamp, monitor and shelves.

## Desk view
- **Desk edge strip:** 26px, `linear-gradient(180deg,#C79A72,#A87650 35%,#7A4E30)`, with a shadow below.
- **Surface:** `assets/desk.png` at `background-size: 1400px auto`, repeating, under a soft top-left highlight and a top shadow. Padding `56px clamp(24px,4vw,52px) 140px`, with an extra 130px on the right to leave room for the cup.
- **Grid** `repeat(auto-fit, minmax(min(100%,260px), 1fr))`, gap 44px:
  1. **Notepad:**
     - `assets/obj/notepad.png`, rotated −1.5°.
     - Text is overlaid in container-query units so it stays on the printed ruled lines (`container-type: inline-size`; first rule at 17.3cqw, line pitch 4.52cqw).
     - Lines: "Today's list" in Cormorant italic 6.5cqw (top at 11cqw, under the spiral rings); "0 TO DO · FROM YOUR WORK BOOK" in mono 2.4cqw on the first rule; "Nothing due today. Enjoy it." in Cormorant italic 4cqw two rules down.
  2. **Agenda card:**
     - `#FAF7F2`, rotated 0.6°, with a 30px green leather band (`#2E5243` → `#243F34`) and a dashed stitch line.
     - Content: "Agenda" in Cormorant italic 32px, the date in mono, then "No meetings today."
  3. **Weekly receipt:**
     - `#FAF7F2` thermal-receipt style, rotated 1.8°, entirely in DM Mono.
     - Header: "THIS WEEK", then "27 Sep – 3 Oct", then "$412" at 40px.
     - Progress bar: green fill to 72% with a marker at 86%. Labels "$68 under usual" / "Usual $480".
     - Daily bars S M T W T F S (values 38, 112, 30, 62, 18, 84, 68). Today is green `#3B6B5A`, other days `#D4C8B0`.
     - Rows: "Daily average $58.86", "Biggest day (Mon) $112.00". Footer: "SAMPLE · START PŪTEA FOR LIVE".
     - Zigzag torn bottom edge via two 135°/225° gradients at 10px.
- **Scatter row** (full width, 220px tall, absolutely positioned objects):
  - `sticky-pad.png`: 120px, −7°
  - `pencil.png`: `min(240px,30%)`, −6°, left 24%, top 150px
  - `clips.png`: 110px, 12°, left 58%
- **Cup:** `assets/obj/cup.png` at 124px, absolutely positioned top-right of the desk.

## Interactions and state
- `activeSection`: which book is pulled out. Wire it to existing routing.
- `lampOn`: boolean, saved to localStorage as `room-lamp` (`on`/`off`), defaulting to on. It controls the lamp image crossfade, the glow, the wall dim and the monitor glow.
- `now`: updated every second for the clock (clear the interval on unmount). Also drives the greeting.
- `selectedDay`: calendar selection, defaulting to today.
- `notes[]`: the feed bar's ADD (or Enter) adds a pinned note `{text, time}` to the front, then clears the input. In production, route this through the existing feed parser (expenses, events, learnings).
- `ask`: the Ask Claude input. On submit, call the existing Claude handler.
- **Desk link:** "To the desk" smooth-scrolls to the desk-edge strip. Don't use `scrollIntoView`; use `window.scrollTo({top, behavior:'smooth'})`.
- **Responsive:** the wall's two columns stack below about 950px of main width. The shelves keep their contents bottom-aligned. Keep tap targets at least 44px.

## Assets (`assets/`)
- `wall.jpg`: painted brick wall, 3072×2048
- `desk.png`: oak desk surface, 1680×944
- `shelf/case.png`: bookcase interior
- `shelf/plank.png`: walnut plank
- `shelf/bookend.png`: brass arch, used as bookend and (rotated) shelf brackets
- `shelf/book-*.png`: 6 spines
- `obj/lamp-on.png`, `obj/lamp-off.png`: same framing, crossfaded
- `obj/clock.png`: face only, no hands
- `obj/plant.png`, `obj/books.png`, `obj/notepad.png`, `obj/cup.png`, `obj/pencil.png`, `obj/clips.png`, `obj/sticky-pad.png`
- Unused: `obj/shelf.png` (old oak shelf), `obj/monitor.png` (the bezel is drawn in CSS instead)

All objects are transparent PNGs generated with Canva AI. Check licensing or regenerate before going public.

## Files
- `Room Dashboard.dc.html`: the full reference (template plus logic class at the bottom). Open it in a browser with `support.js` beside it.
- `assets/`: all images listed above.
