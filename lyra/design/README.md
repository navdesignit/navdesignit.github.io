# Lyra design files

Everything for the Lyra brief in one place. The screens are for a 4.2-inch e-ink panel (400 × 300 px). The four compartments sit in a 2 × 2 square, and the screen draws the same square.

## Start here

| File | What it is |
| --- | --- |
| `Lyra-Brief.pdf` | The whole brief in one file: problem, logic, step-by-step calculations, failure scenarios, value, novelty and competitors, Agvika OS data, AI, every screen, concepts and the plan. Vector: open it in Adobe Illustrator page by page. |
| `Lyra-UI-Kit.svg` | One artboard with the device-to-screen map, form icons, tile states, what-shows-when rules, all 16 screens and concepts B and C. |
| `Lyra-UI-Kit-outlined.svg` | The same with text turned into outlines, so it needs no fonts. |
| `Lyra-Map.svg` | Lyra top view next to the matching screen. |

## Folders

| Folder | Contents |
| --- | --- |
| `screens/svg` | Each screen as an editable SVG (live text) |
| `screens/svg-outlined` | Each screen with text as outlines |
| `screens/png` | Each screen as PNG at 2× (800 × 600) |
| `diagrams` | Lyra ↔ Agvika OS data flow and the proposed plan, as SVG and PNG |
| `source` | The generator: `screens2.html` draws every screen, `render.mjs` writes SVG and PNG, `outline.py` outlines text, `build_html.py` and `pdf.mjs` build the PDF |

## Opening in Illustrator

- SVG with live text uses **Noto Sans KR** (400, 500, 700, 900) and **Schibsted Grotesk** (500, 700, 800). Both are free on Google Fonts. Without them installed, use the `-outlined` files.
- Colours: ink `#1B1B1B`, paper `#E8E7E1`, grey `#8F8D86`. A 1-bit e-ink panel shows the grey as a 50% dither.
- Each screen is 400 × 300 px, the panel's real pixel size.

## Rebuilding

From `source/`: run `./fetch-fonts.sh`, then `node render.mjs out` (needs Playwright), then `python3 outline.py <in.svg> <out.svg>` (needs `fonttools`).

## Signature direction (chosen for investors)

`signature/` holds the chosen look: a 3-colour e-ink panel (black, paper, one red), giant numerals, small technical labels and registration marks. Red always means "do this now".

| Path | Contents |
| --- | --- |
| `signature/Lyra-Signature-en.svg`, `-ko.svg` | All 16 screens on one board, English and Korean (plus `-outlined` and `.png`) |
| `signature/en/`, `signature/ko/` | Each screen as `svg`, `svg-outlined` and `png` (800 × 600) |
| `signature/mockups/` | The screens placed into the product renders (front, angled, lid open, room), English and Korean |

Tiles sit by position as seen from the front with the lid open (back left, back right, front left, front right). The form in each is set by the carer; the example is bottle, blister, sachets, sticks and drops.

Panel note: 3-colour e-ink panels need a full refresh of about 15 seconds and cannot do quick partial updates, so tiles cannot flip instantly. The same layout works on a black-and-white panel, with red printing as black.

## One Screen (what the user sees)

`one-screen/` is the user-facing design: one fixed layout, no pages and no navigation.

- **Left, the box now:** a 2 × 2 map placed like the compartments. Red means open now, a check shows the time it was opened, and grey means not needed.
- **Right, today's plan:** 4 rows (08:30, 12:30, 18:30, 22:00). Each row shows which compartments by position, and its status: done, now, next, later or missed.
- **Bottom, the reminder line:** what Lyra will do next ("chime 08:45, voice 09:00"). It turns red while ringing, and the button quiets the alarm for 10 minutes. It also carries notices: out, missed and family told, put it back, sachets running out.
- The button's only job for the user is to quiet an alarm. Holding it for 3 s (refill mode) is for the carer.

Each of the 9 states is in `en/` and `ko/` as SVG (live and outlined) and PNG. There are boards and 8 mockups in the renders.

## Concept 2 · Calm (ultra-minimal)

`concept2-calm/`: one sentence per screen, black and white only (the fast panel, so tiles flip instantly), with no labels or codes. The part of the day is written in words ("Saturday afternoon"). At the alarm the whole screen turns black, so it can be seen from across the room. There are 10 states in `en/` and `ko/` (SVG live and outlined, PNG), two boards, and 8 mockups.

Why: dementia-friendly clocks work because they give one unambiguous message and name the part of the day. Older eyes read black on white best, with heavy weights and large text. Grey should never carry information.

## Concept 3 · Always, and the interaction storyboard

`concept3-always/` splits the screen into two parts:
- **Left rail, which never moves:** the time, the part of the day, air quality (a word and 4 dots), the temperature and the next alarm.
- **Right side, the box:** black means open now. After opening, each tile shows the time that compartment was opened, so the whole day's record is readable at a glance.

At the alarm, only the right side turns black; the rail stays readable.

`Lyra-Storyboard-en/ko` shows how a day feels, in 8 steps:
1. Silent resting.
2. The ring glows softly at dose time.
3. One chime if the person is near.
4. A voice line and the screen inverting if still not opened.
5. Each tile shows its time as it is opened.
6. The ring goes off and the next alarm is shown.
7. No sound or light while the person is out.
8. The day's record.

Files: 10 states in `en/` and `ko/` (SVG live and outlined, PNG), boards, storyboards, 8 mockups.

## Concept 5 · Anchor (evidence-based, simplest)

`concept5-anchor/` keeps only what research shows helps older adults take medicine:

1. **Tie each dose to a daily routine** ("after breakfast"). Implementation intentions and routine anchoring come from the JAGS 2026 systematic review and the PATTERN study.
2. **Show the exact compartment.** Taking from the wrong compartment is the most common pill-organizer error.
3. **Confirm with the time it was opened.** This removes "did I take it?" and prevents missed or double doses.
4. **One timely cue, then one more.** Digital reminders help (Haile 2026).
5. **Family only on a miss.** Caregiver support improves adherence.

The time and air quality are always on top. There are 6 states in `en/` and `ko/` (SVG live and outlined, PNG), plus a board with the evidence.

## Concept 6 · Fade (recommended for competitions and investors)

The first medicine reminder designed to be needed less. At the same routine moment ("after breakfast"), the reminder is drawn as strong as the habit is weak:

| Habit strength | What the screen shows | Cue |
| --- | --- | --- |
| Below 50% | Bold black tiles and the words | Light, chime and voice |
| 50–80% | Smaller black tiles | Light and chime |
| 80% or more | Outlines and a short word | Light only |
| 95% | A tiny mark in the corner | Nothing: the person starts it themselves |

Habit strength is the share of doses opened before any cue, over the last 14 days. After a missed dose, full reminders come back at once. The ink on the screen is the habit.

The files are the poster board (`Lyra-Fade-en/ko`), 7 states (SVG live and outlined, PNG), and mockups including a Day 1 vs Day 60 pair.
