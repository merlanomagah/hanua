# Panel brief: a room that comes alive (look down, menu whiteboard, plant, clock date)

**Request (as the problem):** Hanua should feel alive and reward coming back every day: a quick "look down" to the desk, a weekly food-menu whiteboard Mel draws on by hand (dates filled in for her), a plant that grows when she waters it each day and browns when she doesn't, and the day and date on the flip clock.
**Lane:** Large (a new panel, new stored data, five areas) · **Seats:** all core seats, Bula guest. Run in one pass by Claude rather than as separate agents: the code involved (room layout, clock, lights, shelves) was read in this session.
**Gate:** worth it. The plant goes straight at the Context's "done looks like": Mel opening Hanua every day. The whiteboard is **Probe it**: nobody can know in advance whether a hand-drawn menu gets used, so build it small and watch.
**Today, outside Hanua:** to ask Mel: where does the week's food plan live now (a note, the fridge, nowhere)?

## 1. Verdict
Go, in four pieces, smallest first. Drawings and the watering log are kept on this Mac (the `data/` folder, like the PIN), not in Notion: neither has another home, and Notion can't hold a drawing simply. Images are drawn in code to match the room; Canva prompts are given so Mel can swap in real objects later.

## 2. Premortem
| # | Why it failed | Seat | What this brief does |
|---|---|---|---|
| 1 | The browning plant became a guilt object, so Mel avoided opening Hanua | Daily-use coach | Browning is slow and fully reversible: one watering starts it recovering. Growth is never taken away. No red counts or alerts |
| 2 | Drawings vanished (browser data cleared, week rolled over) | Data steward | Saved on the Mac after every stroke; past weeks kept and viewable with ‹ |
| 3 | Drawing with a trackpad felt clumsy, so the menu went back to a note | Experience | Smoothed strokes, two pen colours, an eraser, Undo; it's a probe: if no week has drawing after 3 weeks, it goes on the cut list |
| 4 | The whiteboard pushed the desk further away | Room designer | It sits between wall and desk but compact, and the look-down jump goes straight past it |
| 5 | The menu showed at work | Privacy | At work the board is covered (blank, "Personal") like other personal things |

## 3. What the panel said
| # | Seat | Point |
|---|---|---|
| 1 | Daily-use coach | The plant is the strongest piece: a 3-second ritual tied to opening Hanua. Keep it kind (premortem 1) |
| 2 | Data steward | Plant rules (growth from days watered, health from days since) live in `public/shared/` with tests; the log is a list of dates, nothing else |
| 3 | Room designer | Plant moves from the deco shelf to the greeting shelf; its vine is drawn in code so it can grow along the shelf; can, whiteboard, marker drawn in code in the palette; works with the lights off |
| 4 | Experience | Watering: drag the can onto the plant (it tips and pours); on a phone, tap the can. Whiteboard: click the marker to pick it up, draw, put it back |
| 5 | Sceptic | The date already arches over the lamp; with the date on the clock it would say it twice (question 3) |
| 6 | Privacy | Whiteboard covered at work; the sleep screen covers everything as now |
| 7 | Test lead | Plant rules tested in `npm test`; sample server keeps its own plant and board files, never Mel's |

## 4. Questions for Mel
| # | Question | Recommendation |
|---|---|---|
| 1 | "Look down": a quick camera-tilt as the room moves to the desk (To the desk, the desk button, and a flick down from the bottom of the wall)? | Yes, all three |
| 2 | Plant rules: growth kept forever and browning reversed by one watering, or harsher (it can die and start again from a seedling)? | The kind version |
| 3 | With day and date on the clock, remove the date arched over the lamp? | Remove it (say it once) |

## 5. In and out
| In | Not now |
|---|---|
| Look-down movement; flip clock day + date; plant + can with growth and browning; weekly menu whiteboard with auto dates, pen, eraser, past weeks | Tying watering to finishing tasks; shopping list from the menu; Canva images (Mel's, later) |

## 6. Build plan
| # | Step | Files | Done when |
|---|---|---|---|
| 1 | Clock day and date | `app.js renderClock`, `index.html`, `styles.css` | Flip cards show e.g. MON 05 OCT |
| 2 | Look down | `app.js`, `styles.css` | A short tilt-and-glide to the desk from all three ways |
| 3 | Plant rules + log | `public/shared/plant.js`, `server/index.js` `/api/plant`, `data/plant.json`, tests | `npm test` covers growth and browning |
| 4 | Plant and can on the greeting shelf | `app.js` (or `public/plant.js`), `index.html`, `styles.css` | Drag to water; vine grows; browns by days missed |
| 5 | Whiteboard | `public/whiteboard.js`, `server/index.js` `/api/board/:week`, `data/whiteboard/` | Draw, erase, saved, dates auto, past weeks |

Needs `npm install`? No. New `.env` value? No. Notion changes? None.

## 7. Test plan
| # | Check | How |
|---|---|---|
| 1 | Plant growth and browning rules | `npm test` |
| 2 | 1440 / 1024 / 375, lights on and off | sample server |
| 3 | At work: board covered | Focus sign |
| 4 | Drawing saves and reloads; new week starts clean | sample server, faked date |

## 8. Close-out
Map rows: new "Plant and watering can", "Menu whiteboard"; "Flip clock" updated. Preferences: the plant's rules, the look-down. Image library: if Mel makes Canva images. Session Diary with the Panel line.
