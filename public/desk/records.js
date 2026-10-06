// The record player as a widget on the desk (Mel, 6 Oct 2026): the turntable seen from above, the record spinning
// while music plays, the song under it and ⏮ ⏯ ⏭ beneath. Clicking the deck opens the crate to pick a record (the
// same turntable as the wall's record player). It took over from the dock's record player. Drawn from the same music
// state as the wall's glass card (renderMusic in app.js fires hanua:music), so the two always agree.
import { $, h, state } from "../lib.js";
import { music, musicDo, openTurntable, placed, PAUSE_ICON, PLAY_ICON, RECORD_ART } from "../app.js";

const box = $("w-records");
const icon = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const PREV = "M6 5h2v14H6zM20 5v14L9 12z", NEXT = "M16 5h2v14h-2zM4 5v14l11-7z";

// built on first draw, which waits for app.js's first hanua:music: app.js (which this imports) finishes loading
// after the desk's modules, so nothing of it is touched while the page is still starting
let deck, vinyl, track, artist, prev, play, next;
function build() {
  vinyl = h("div", { className: "vinyl" });
  deck = h("button", { type: "button", className: "deck art wr-deck", ariaLabel: "Pick a record", title: "Pick a record" }, h("div", { className: "platter" }, vinyl));
  deck.style.setProperty("--deck-art", `url("${RECORD_ART.top}")`);
  deck.addEventListener("click", openTurntable);
  track = h("b", { className: "wr-track" }); artist = h("span", { className: "wr-artist" });
  const btn = (cls, label, d, action) => { const b = h("button", { type: "button", className: `wr-btn ${cls}`, ariaLabel: label, title: label, innerHTML: icon(d) }); b.addEventListener("click", () => musicDo(action)); return b; };
  prev = btn("", "Previous", PREV, "previous"); play = btn("wr-play", "Play", PLAY_ICON, "playpause"); next = btn("", "Next", NEXT, "next");
  box.replaceChildren(deck, h("div", { className: "wr-song" }, track, artist), h("div", { className: "wr-controls" }, prev, play, next));
  window.dispatchEvent(new Event("resize")); // it's taller now: the desk places everything again (arrange.js)
}

export function renderRecords() {
  if (!deck) build();
  const playing = music.state === "playing", active = playing || music.state === "paused";
  const record = state.records.find((r) => r.name === music.playlist) || placed;
  deck.classList.toggle("loaded", active || Boolean(placed));
  deck.classList.toggle("spinning", playing);
  vinyl.style.setProperty("--lc", record?.color || "#C4602A");
  track.textContent = active && music.track ? music.track : music.available ? "Nothing playing" : "Music";
  artist.textContent = music.state === "unknown" ? "Allow Hanua to control Music"
    : active ? [music.artist, music.playlist].filter(Boolean).join(" · ") : "Click the deck to pick a record";
  box.querySelector(".wr-song").title = `${track.textContent} — ${artist.textContent}`;
  play.innerHTML = icon(playing ? PAUSE_ICON : PLAY_ICON);
  play.ariaLabel = play.title = playing ? "Pause" : "Play";
  play.disabled = !music.available;
  prev.disabled = next.disabled = !active;
}
document.addEventListener("hanua:music", renderRecords); // first fired once app.js has loaded and asked the Music app
