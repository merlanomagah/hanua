# Panel brief: show clearly when Hanua is waiting on Claude (and a Fix: the Jump team lost work)

**Status:** approved by Mel 16 Oct 2026 ("yes, go ahead", with Stop waiting) and built the same day, together with a Fix.

**Request (as the problem):** after pressing a ✦ button Mel couldn't tell Hanua was working, so she pressed again, worried about wasted usage. Checked first: a repeat press never sent a second request (each handler ignored presses while waiting), but the only sign was a faded button.
**Lane:** Small (one shared behaviour, about 12 places) · **Seats:** Chair, Experience designer, Frontend engineer, Test lead

**Fix (same day):** leaving a Jump team member (the Stand-up tab) and opening its card again started it fresh, wiping what Mel had typed and the member's reply (`memberEl`'s card click reset its context). Nothing had reached Notion, so the session was lost. Now each member's work and the stand-up are kept on this Mac (`team-drafts`: what she typed, the reply, her answers, what's done) until **Start fresh** (with Undo), through tab switches, closing and reloading, dropped after a week untouched; a reply that comes back while she's elsewhere is kept for the member who was asked; the card says "Your work in progress is kept". **Rule:** anything Mel typed or Claude answered stays until she clears it.

## Built

`public/wait.js` (rules `public/shared/wait.js`, `test/wait.test.js`): `wait(key, label, fn)` sends one request per key (another press: "Still working: it's only been sent once"), passes an abort signal (`api(path, body, { signal })` in lib.js), marks the button (spinner, what's happening, seconds; small buttons spinner and seconds only), `waitNote(key, usually)` shimmers where the answer will appear, after 60 s "Taking longer than usual · Stop waiting" (stops waiting only, never re-sends; usage already spent can't be undone), `arrived(el)` brings the answer into view, briefly lit. Used by: Jump team stand-up and Answer again, a member's Fold it in and Answer again, Work reflection's panels, Brain dump's Reflect, Ask (rail and books), ⌘S drafting, the goal coach and Ideas (form and Plan), Plan the week's Ask Claude. Reduced motion: no spinning or shimmer, the counter still counts.

## Tested

`npm run check` (250). Preview with Claude slowed to 6 s: one request for three presses, the message on the second, the counter ticking, a tab switch mid-wait and back with the reply kept, a reload with the note and reply kept, the button back to normal after. **Not proven:** Safari, Stop waiting on a real slow call (the 60 s rule is unit-tested).
