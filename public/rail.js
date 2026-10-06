// Two room-wide switches on the rail (Mel, 7 Oct 2026; brief in the 7 Oct Session Diary row):
// - the bookcase slides away to the left for more room (⌃B), and back. Kept per Mac as room-books; index.html sets
//   `books-away` on <html> before the page draws, so a reload never slides. The width is one animated value
//   (--shelf-w, registered in styles.css), so the wall, desk, kitchen and board grow with it in one movement; once it
//   settles, everything that measures the screen (greeting, clocks, plant, the desk's layout and windows) is told by a
//   `resize`. Phones keep their strip of books across the top: nothing changes there.
// - light / dark beside Focus: Always light or Always dark at a touch (⌃D). "Follow my Mac" and "Follow the lights"
//   stay in Settings → Appearance; the switch always shows what's on screen now.
import { $, isNarrow, reducedMotion, store } from "./lib.js";
import { setAppearance } from "./appearance.js";

const root = document.documentElement, shelf = document.querySelector(".shelf"), books = $("ts-books"), dark = $("ts-dark");
const SLIDE_MS = 360; // the same as --shelf-w's transition in styles.css

function showBooks() {
  const away = root.classList.contains("books-away");
  books.ariaPressed = String(away);
  const say = away ? "Show the bookcase (⌃B)" : "Hide the bookcase (⌃B)";
  books.dataset.tip = say; books.ariaLabel = say.replace(/ \(.*/, "");
  if (shelf) shelf.inert = away && !isNarrow(); // nothing to tab into while it's off screen
}
let settle;
function toggleBooks() {
  const away = !root.classList.contains("books-away");
  store("room-books", away ? "away" : "here");
  if (!reducedMotion) root.classList.add("books-moving");
  root.classList.toggle("books-away", away);
  showBooks();
  clearTimeout(settle);
  settle = setTimeout(() => { root.classList.remove("books-moving"); dispatchEvent(new Event("resize")); }, reducedMotion ? 0 : SLIDE_MS + 40);
}
books.addEventListener("click", toggleBooks);
addEventListener("resize", showBooks);
showBooks();

function showDark() {
  const on = root.classList.contains("dark");
  dark.ariaChecked = String(on);
  dark.dataset.tip = on ? "Dark (⌃D for light)" : "Light (⌃D for dark)";
}
dark.addEventListener("click", () => setAppearance(root.classList.contains("dark") ? "light" : "dark"));
new MutationObserver(showDark).observe(root, { attributes: true, attributeFilter: ["class"] }); // the Mac, the lights, Settings
showDark();

const typing = (t) => t?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName || "");
document.addEventListener("keydown", (e) => {
  if (!e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
  const k = e.key.toLowerCase();
  if (k === "b" && !isNarrow()) { e.preventDefault(); toggleBooks(); }
  else if (k === "d") { e.preventDefault(); dark.click(); }
});
