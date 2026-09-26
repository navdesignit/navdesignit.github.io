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
