# Panel brief: a visual workbench, wider, and a name for each Jump team member

**Status:** approved by Mel 16 Oct 2026 ("yes, with the suggested names and colours to start; I'll change any in Settings") and built the same day. Stage 2 of the JD brief stays benched until three charters are confirmed.

**Request (as the problem):** the workbench was mostly text; Mel wanted it to show at a glance, in the visual style her OS sets out (the Brain Playbook's Output Standard: visuals that carry meaning, chosen from the shape of the information, colour only where it means something, one highlight, direct labels), using the width, with a clear cue for which member she's talking to, and a name for each.
**Lane:** Medium · **Seats:** Chair, Sceptic, Daily-use coach, Experience designer, Room designer, Frontend engineer, guest Bula, Test lead
**Gate:** worth it (the workbench is where the charters get confirmed, the step that unlocks the rest).

## Built

| Part | Shape | Visual |
|---|---|---|
| Who | one member | avatar (initial, their colour), name large, role small, a band in their colour; the same avatar on the Team card, in stand-up replies and in the window title |
| How current | a few numbers | stat cards: charter confirmed, on their desk, oldest |
| On their desk | items with an age | mini cards with age bars, oldest the one highlight, ↗ to Jump OS |
| This year's focus | 3–5 priorities | numbered tiles |
| Rhythm | meetings by cadence | lanes: weekly, fortnightly, monthly, quarterly, yearly, as needed; proposed ones outlined |
| Keeps updated | who, what, when | who in bold, the rest beside it |
| Works closely with | connections | a map: their avatar in the middle, linked members around (click to open theirs) |

Names live in each charter page's title ("Name · Role"), checked against the work OS so none matches a real person (Kiri and Rangi were swapped for Niko and Ari for that reason); the Jump team page says they're AI members. ⚙ Settings edits the name and the colour (a `Colour` heading) with the rest, one save, Undo. The window is about 1,320 px wide on a big screen; one column on a phone. Rules in `public/shared/team.js` (`memberName`, `titleOf`, `initialOf`, `COLOURS`, `colourOf`, `cadenceOf`, `plainLine`, `whoWhat`, `linksTo`), tested; colours in the stylesheet's `:root` (`--mc-*`), mixed with the page so they follow light and dark. The team reads the board itself if opened before the Jump Dashboard.

## Tested

`npm run check` (255). Preview at 1440, light and dark: the grid with avatars, a workbench with two desk items (oldest highlighted), rhythm lanes, keeps-updated, the map, a rename and colour change saved to the charter. Found and fixed on the way: age bars drawn as blocks over the text; map names crowding the middle; an empty desk when the team opened before the board was read. **Not proven:** Safari, phone width with real charters.
