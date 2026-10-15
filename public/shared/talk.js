// Talking into a Journal question (Mel, 16 Oct 2026; brief docs/plans/2026-10-journal-talk.md): what a settled
// stretch of speech adds to the box. Words land as she said them (no tidying: her choice), after what's there, never
// over it, with one space between when the box doesn't already end in a space or a new line.
export function spokenText(before, said) {
  const words = String(said || "").replace(/\s+/g, " ").trim();
  if (!words) return "";
  return !before || /\s$/.test(before) ? words : ` ${words}`;
}
