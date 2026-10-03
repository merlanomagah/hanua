# Hanua: notes for Claude

A personal daily dashboard drawn as a room: a bookcase menu (Notion databases), a wall (monthly spending from Pūtea, a wall calendar, sticky notes) and a table (today's checklist, agenda, weekly spend). The owner runs it locally on a Mac.

## Workflow

- Do the work on a working branch. When a change is finished and tested, **also update `main`** (fast-forward it to the finished work and push). The owner has given standing permission for this. They pull `main` with GitHub Desktop.
- The owner isn't a developer. Explain steps in plain language, using numbered tables. If a change needs `npm install` or a new `.env` value, say so explicitly.
- Never commit `.env` (it holds the Notion and Claude keys).

## Running and checking

- `npm start`, or `scripts/start.sh` (it backgrounds the server, then opens the browser). Port comes from `.env` (`PORT`), default 3000.
- Without keys, everything runs on sample data (`data/sample.json`, dates shifted to today) and sample money. Use that to check changes in a browser at desktop and phone widths before pushing.

## Layout

- `server/index.js`: Express API. `/api/areas` (Notion records per book), `/api/money` (Pūtea), `/api/areas/:id/records/:recordId/done` (tick a task), `/api/ask`, `/api/feed/draft` + `/api/feed/commit` (Claude drafts a Notion row; the user confirms before it's written).
- `server/notion.js`: Notion REST calls (API version 2022-06-28).
- `server/claude.js`: Claude calls (Anthropic SDK).
- `server/money.js`: reads Pūtea's read-only local API (`PUTEA_URL`, default `http://127.0.0.1:3456`). Pūtea lives in the separate `merlanomagah/putea` repo and syncs Akahu bank data.
- `config/areas.json`: one entry per book (Notion database ID and column names). The page uses `work` for tasks, `calendar` for events, `learning` for notes and `relationships` for people.
- `public/`: the page (plain HTML, CSS and JS, no build step). It follows the Claude Design "Room Dashboard" handoff (Bula Collective palette).
- `public/assets/`: the room images (wall, desk, bookcase, objects), resized from the design handoff. They were generated with Canva AI, so check licensing before making anything public.
- `prototypes/`: the product blueprint and an earlier 3D room prototype. For reference only.
