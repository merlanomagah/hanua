# Panel brief: talk into a Journal question

**Status:** approved by Mel 16 Oct 2026 ("yes to the brief, and no tidying for now") and built the same day.

**Request (as the problem):** typing slows Mel's thinking; she wants to talk it through and have the words land in the answer, without the listening cutting out.
**Lane:** Small · **Seats:** Chair, Sceptic, Experience designer, Privacy and safety, Test lead
**Gate:** worth it: the rail's Ask already uses the browser's own speech-to-text. Sceptic: macOS Dictation (🎤 / Fn twice) already works in any box; a button is easier to find and stays on until she says.

## Built

A **Talk** button on every question tile, both types (`public/desk/talk.js` `talkFor`): click → red, pulsing, **Done**, "Listening…" under the box with the words still being worked out; settled words go into the box after what's there (`spokenText` in `public/shared/talk.js`: one space between, **untidied**, Mel's choice), inserted like typing so each stretch is one ⌘Z and the draft keeps it. The browser stops after a pause; Hanua starts it again until Done (gives up after 5 failed starts in a row). Stops on Done, Next / Back / any redraw, closing the window, Esc (first press only stops listening), the page going out of sight, Hanua sleeping, the box disappearing (at work). No button where the browser has no speech-to-text. A refused microphone says where to allow it in Safari.

**Privacy:** Safari's speech-to-text is Apple's, like Mac Dictation; nothing goes to Claude or Notion until Mel chooses.

## Tested

Sample preview with a pretend microphone (the browser's own recogniser, played back with invented words): the button's states, faint words while speaking, settled words added after typed ones, the restart after a pause, ⌘Z taking back a spoken stretch, the draft keeping it, Next and Esc stopping it. `test/talk.test.js`; `npm run check` 240. **Not proven:** a real microphone in Safari (only Mel's Mac can), how well it hears her.
