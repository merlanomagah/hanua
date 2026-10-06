// Dark mode on the page: one class, `dark` on <html>, set from Mel's choice (Settings → Appearance, kept per Mac in
// browser storage as room-appearance), macOS's own setting and the lights. The rule is public/shared/appearance.js;
// the colours are the "dark" section at the end of styles.css. index.html sets the class before the page draws, from
// the same choice, so a dark evening never flashes cream.
import { appearanceOf, darkFor } from "./shared/appearance.js";
import { store } from "./lib.js";

const mac = matchMedia("(prefers-color-scheme: dark)");
export let appearance = appearanceOf(store("room-appearance"));
const lightsOff = () => Boolean(document.getElementById("app")?.classList.contains("lamp-off"));
function apply() { document.documentElement.classList.toggle("dark", darkFor(appearance, { mac: mac.matches, lightsOff: lightsOff() })); }
export function setAppearance(a) { appearance = appearanceOf(a); store("room-appearance", appearance); apply(); dispatchEvent(new CustomEvent("hanua:appearance", { detail: appearance })); }

mac.addEventListener("change", apply); // macOS switched (by hand, or its own Auto at sunset)
const app = document.getElementById("app");
if (app) new MutationObserver(apply).observe(app, { attributes: true, attributeFilter: ["class"] }); // the lights (lamp-off)
apply();
