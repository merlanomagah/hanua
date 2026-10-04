# Panel brief: a kitchen to the left, a weather window, three wall clocks, a greeting in many languages

**Request (as the problem):** the wall is crowded and says little about the world outside the room: Mel wants the menu in its own place, to see the day's weather at a glance, to keep Sydney (the move) and Suva (family) time in view, and a little more gentle movement on the wall.
**Lane:** Large (a new view, a new data source, 3+ areas) · **Seats:** Chair, Sceptic, Daily-use coach, Experience designer, Room designer, Data steward, Frontend engineer, Backend engineer, Test lead, Privacy and safety, Release keeper, guest Bula
**Gate:** worth it, with one guard. The menu board is a probe until about 26 Oct, so the kitchen is built as a *room with a window*, not as a home for the menu: if the menu probe is cut, the window stays. Clocks and weather serve the purpose sentence directly (show information beautifully; Sydney is a current goal).
**Today, outside Hanua:** the phone's Weather and World Clock apps. They are quick but out of sight; the room puts the same facts where Mel already looks.
**How the panel ran:** the seats were run in one pass rather than as separate agents: no Notion schema or writes are involved, so an independent Data steward read had little to find.

## 1. Verdict
Go. Three panes side by side: goals board ← wall → kitchen. Swipe left (two fingers on the trackpad, or a finger on a phone) to the kitchen, right to come back; the same quick glide as looking down. The kitchen has a wide, short window looking out on today's weather, split by its frame into morning, midday and evening, with the menu board under it and the desk below. On the wall: the shelf moves down, three wall clocks hang above it (local in black, Sydney and Suva in white), the greeting changes language every 10 s with a fixed ", Mel.", and the words over the lamp drift slowly round its dome with today's weather.

## 2. Premortem
Three weeks later this failed, or Mel stopped using it. Why?
| # | Why it failed | Seat | What this brief does |
|---|---|---|---|
| 1 | Out of sight, out of mind: the menu stopped being filled in once it left the wall | Daily-use coach | A KITCHEN tab on the wall's right edge (like GOALS on the left), a kitchen button on the top rail, and today's meals as a line on the desk |
| 2 | The weather was wrong (wrong town) or quietly empty | Backend / Experience | The town is named on the window sill; a failed fetch shows "Weather unavailable" in the window, never a blank sky |
| 3 | The changing greeting made the shelf jump about | Experience / Frontend | The greeting box keeps one size (the longest greeting); words crossfade in place; ", Mel." never moves |
| 4 | Three clocks crowded the wall at laptop width | Room designer | Clocks scale with the wall; under 1100px they shrink; on a phone only the local clock shows, with Sydney and Suva as small text under it |
| 5 | The words round the lamp were too fast or upside down to read | Experience | They glide along the dome's arc like a slow ticker (about 20 px a second), never turning upside down; still with reduced motion |
| 6 | Corn kept landing on air | Frontend | Corn's perches move with the clocks and shelf, and get new ones on the clocks and the window sill |

## 3. What the panel said
| # | Seat | Verdict | The point that matters |
|---|---|---|---|
| 1 | Chair | go | Build the kitchen as a room with a window; the menu stays a probe |
| 2 | Sceptic | reshape | No new image needed: window frame, sky and weather drawn in code. Reuse the board's swipe code for the second direction instead of a new mechanism |
| 3 | Daily-use coach | go | Premortem 1. Weather and Sydney time are glanceable every morning: that is the habit to win |
| 4 | Experience designer | go | One cohesive sky across three panes; each pane has a small label (Morning 14° · showers). A soft "now" marker. After evening the window shows tomorrow, labelled |
| 5 | Room designer | go | A real window: painted wooden frame, two mullions at the thirds (the frame *is* the split), a sill. Clocks hang from a nail like real wall clocks, with a soft shadow. The lamp's glow on the greeting's first letters stays: the greeting stays in the glow's reach when the shelf moves |
| 6 | Data steward | go | Weather is a new data source: a Map row (Owned by Open-Meteo). Hanua only keeps a 30-minute cache, never a store (signpost rule) |
| 7 | Backend engineer | go | Open-Meteo: free, no key, so no `.env` key. `/api/weather` on the server, cached 30 min; sample weather when offline |
| 8 | Privacy and safety | go | The repo is public, so the town goes in `.env` (WEATHER_PLACE), never in the code. Weather isn't personal: it shows At work too |
| 9 | Guest Bula | go | The greeting languages are a chance to carry Bula's Pacific roots: Fijian, te reo Māori and other Pacific languages first |
| 10 | Test lead | go | New rules (which third an hour falls in, greeting order by time of day) go in `public/shared/` with tests |

Passed: Release keeper (standard list below).

## 4. Questions for Mel
| # | Question | Recommendation |
|---|---|---|
| 1 | Which town should the window look out on? | Put it in `.env` as `WEATHER_PLACE` (the repo is public). Your current town now; change it to Sydney when you move |
| 2 | Which languages for the greeting? | English, te reo Māori, Fijian, Fiji Hindi, Samoan, Tongan, plus French and Spanish. Each says the right thing for the time of day where the language has it (Mōrena / Ni sa yadra), otherwise its everyday hello (Kia ora, Bula) |
| 3 | The words over the lamp: glide along the curve like a ticker, or turn in a full circle round the lamp? | Glide along the curve: it never turns upside down, so it stays readable |

Assumed unless Mel says otherwise: from the kitchen, looking down lands on the same desk (one desk, today).

## 5. In and out
| In this change | Deliberately not (and what would earn it) |
|---|---|
| Kitchen pane (swipe left), KITCHEN edge tab, top-rail button, look down to the desk | A separate kitchen bench below (only if the desk gets crowded) |
| Weather window: three panes, blended sky, drifting clouds / rain / sun, temperature per third, now marker, tomorrow after evening | Hourly detail, rain radar, alerts (the phone does it) |
| Three wall clocks: local black, Sydney and Suva white, hours ahead/behind under each | More cities (only if asked) |
| Greeting in 8 languages, crossfade every 10 s, ", Mel." fixed | Translation of the rest of the room |
| Words on the lamp's curve glide slowly: week, season, today's weather emoji and temperature | Sound, or anything faster |

## 6. Build plan, in dependency order
| # | Step | Files | Done when |
|---|---|---|---|
| 1 | Weather from Open-Meteo, cached 30 min, sample fallback | `server/weather.js`, `server/index.js` (`/api/weather`), `.env.example` | `/api/weather` returns today's hours and the town |
| 2 | Shared rules: thirds of the day, greeting by language and time | `public/shared/dates.js`, `public/shared/greetings.js`, tests | `npm test` passes |
| 3 | Kitchen pane and the swipe both ways | `public/index.html`, `public/goals/board.js` swipe, `public/kitchen.js`, `styles.css` | Wall ↔ kitchen by trackpad, touch, edge tab, rail button; look down works from both |
| 4 | Menu board moves into the kitchen | `public/whiteboard.js`, `index.html` | Typing, weeks and Plan the week work as before |
| 5 | The window, drawn in code | `public/weather-window.js`, `styles.css` | Thirds blend, animate, labelled; still with reduced motion; dims with the lights |
| 6 | Three wall clocks and the shelf moved down | `renderClock` in `public/app.js`, `index.html`, `styles.css` | Correct times for local, Sydney, Suva; lamp glow still on the greeting |
| 7 | Greeting languages and the gliding curve | `public/app.js`, `styles.css` | Crossfade every 10 s, no jump; curve readable |
| 8 | Corn's perches | `public/bird.js` | Lands on clocks, shelf, window sill |

Needs `npm install`? No. New `.env` value? Yes: `WEATHER_PLACE` (a town name), optional; without it the window shows sample weather. Notion changes? None.

## 7. Test plan
| # | Check | How |
|---|---|---|
| 1 | `npm test` | New shared rules have tests |
| 2 | Sample server at 1440 / 1024 / 375, lights on and off | Browser preview, never real Notion |
| 3 | Swipe left/right both ways from the wall, board and kitchen | Trackpad events and touch in the preview |
| 4 | Clock times against Intl for Sydney and Fiji, including NZ/Sydney daylight-saving differences | Script |
| 5 | Greeting box size stays fixed through every language | Measure with script |
| 6 | What could break: menu board, Plan the week, calendar zoom, look down, Corn, Focus (At work) | Click through each |

## 8. Close-out
| # | Record | What to update |
|---|---|---|
| 1 | Map | New rows: Kitchen, Weather (data source). Updated: Wall, Menu board, Clock, Canary |
| 2 | Cascade | New data source and new room rows; `.env` named to Mel |
| 3 | Session Diary | "Panel: Large; seats that caught something: …" |
| 4 | Preferences | Kitchen to the left, wall clocks, greeting languages; image library unchanged (no new images) |
