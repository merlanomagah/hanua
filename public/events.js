// The page's signals (Foundations F6, 9 Oct 2026): one part of the page telling the others something happened. Every
// name used anywhere in public/ must be in this list, and each must be both sent and listened for: `npm run check`
// holds that (a mistyped name would otherwise fail without a word). Sent on `document` unless it says `window`.
export const EVENTS = {
  "hanua:room": "the other Mac changed something in the shared folder ({ kind, key }; public/sync.js)",
  "hanua:sync": "the shared folder's state was read again (/api/sync)",
  "hanua:day-saved": "a day's page was saved (its key)",
  "hanua:day-changed": "a day changed on the other Mac (its key, or null for all)",
  "hanua:day-refreshed": "an open day was read again (the other Mac, Use theirs, iCloud caught up)",
  "hanua:desk-stale": "page and server save a day differently: saving stops",
  "hanua:desk": "the desk slid in or out",
  "hanua:desk-settings": "open Desk Settings (from Hanua Settings)",
  "hanua:settings": "Settings arrived or changed (the settings)",
  "hanua:settings-saved": "Settings were saved here or arrived from the other Mac ({ before, here })",
  "hanua:appearance": "light / dark changed (window)",
  "hanua:focus": "At home / At work switched",
  "hanua:plan": "the day's focuses or ticks changed (the focus post-its)",
  "hanua:folds": "a task's subtasks were folded or unfolded (To-do.txt follows Plan my day)",
  "hanua:backup": "the nightly backup's status was read",
  "hanua:board": "the goals board opened or closed",
  "hanua:kitchen": "the kitchen opened or closed",
  "hanua:done": "a goal was finished (the canary hops)",
  "hanua:watered": "the plant was watered (the canary visits)",
  "hanua:plant": "the plant's log changed",
  "hanua:menu": "the week's menu changed",
  "hanua:weather": "the weather was read",
  "hanua:music": "what's playing changed",
};
