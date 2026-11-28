# Pon Pon Prix 🛺💨

Kart racing through the streets of Indore with the Alquida gang. Make a room, send the link on WhatsApp, and your friends tap it and race from their own phones. No app, no sign-in.

**Play:** https://navdesignit.github.io/race/

- **2 to 7 riders online**, with 🤖 bots filling the rest of the gang, or practise alone against the bots.
- **The gang from [Alquida Landu](../ludo/)**, faces, names and trash talk straight from `ludo/js/characters.js`, each on their own ride:
  - 😎 **Ajay**: *Boss ki Bullet*. Dug-dug-dug. Fastest on the straights, heaviest in a bump.
  - 🧠 **Nav**: *Rocket Nano*, a Nano with a Diwali rocket on the roof. Drift sparks charge faster.
  - 🍛 **Chechu**: *Poha Express*, an auto-rickshaw with a poha stall on top. Mithai boxes sometimes give him two items.
  - ⚖️ **Vanshika**: *Advocate Scooter*. Quickest off the line; her nimbu-mirchi lasts longer.
  - 🎨 **Liu**: *Masterpiece Moped*, splashed with paint. Best steering, and the dusty shoulder barely slows her.
- **Two friends ride with the gang too** (they're not in the Ludo game, so their faces, rides and lines are in `js/riders.js`):
  - 🐎 **Lisa**, the Agnica partner from Kazakhstan: *Steppe Express*, an Indore tonga behind a horse from the steppe. Gallops straight over potholes.
  - 🚲 **Jihye**, from Korea: *Ppali-Ppali Rickshaw*, a cycle-rickshaw with a secret battery, K-pop fairy lights, a lightstick and a jar of kimchi on the seat. Every boost lasts longer (ppali-ppali means hurry-hurry).
- **Eight tracks, seven of them on real streets** (traced from OpenStreetMap, with the real buildings, side streets, gardens and landmarks):
  - 🛕 *Rajwada*: round the palace by Rajwada Square, MG Road, Jawahar Marg and Prince Yashwant Road, with the Krishnapura chhatris.
  - 🌙 *Sarafa Night Run*: the Sarafa lanes after midnight, fairy lights and jalebi stalls.
  - 🌭 *Chhappan Dukan*: Janjeerwala Square, MG Marg past 56 Dukan (and its food plaza), Old A.B. Road, at dusk.
  - 🏙️ *Vijay Nagar*: Vijay Nagar Square, A.B. Road, Bombay Hospital and the Ring Road, at night among glass towers.
  - 🏘️ *Rajiv Awas Vihar*: Scheme 114. In at the Aastha Hospital gate, through the blocks with their X-shaped lanes and the A, B, C and D block gardens, round the giant water tower and the community hall.
  - 🏛️ *Sansad Marg, Delhi*: round Parliament, old and new, by Patel Chowk and Windsor Place.
  - ⚖️ *Supreme Court, Delhi*: India Gate to the Supreme Court along Tilak Marg.
  - 🌉 *Flyover Phataphat*: a made-up figure of eight over a flyover at sunset.
  Cows wander across the road on their own timetable, pigeons scatter as you pass, potholes jolt you, speed breakers throw you in the air, and orange chevrons are masala boost strips.
- **Drifting:** hold DRIFT while turning. Sparks go white, yellow, orange, then pink; let go for a boost. Tap DRIFT just before the lights for a rocket start.
- **Items from mithai boxes:** 🩴 Mummy ki Chappal (homes in on the kart ahead), ♨️ Pressure Cooker (drop it; third seeti = boom), 🍋 Nimbu-Mirchi (blocks one hit), ☕ Cutting Chai (boost), 📯 Pon Pon Horn (shockwave), 🌿 Paan ki Peek (slippery puddle), 🚀 Diwali Rocket (autopilot boost, the back of the pack gets these), 🐄 Gaay Mata (parks a cow behind you).
- **Sounds:** engines, horns and tyre squeal are synthesised per ride (the Bullet thumps, the auto rattles, the moped goes nyeeee). The meme clips come from the Ludo packs, `ludo/sounds/fx.mp3` and `ludo/sounds/memes.mp3`.
- A commentator, trash talk when you overtake or hit someone, a 3D podium, awards (Chappal Champion, Gaay Bhakt, Pothole Inspector…) and a meme soundboard that plays on everyone's phone.
- **Music:** a synthesised soundtrack per track (dhol and tumbi by day, shehnai at night, a baraat brass band in Delhi) that speeds up on the last lap. Switch it off in the ⏸ menu.
- **How to play** is on the home screen and in the lobby, and for your first two races an on-screen coach points at the joystick, DRIFT and the item button.

## Online play (Firebase)

Race rooms use the same free Firebase Realtime Database as the Ludo game (`ludo/js/firebase-config.js`). They live under `race/CODE` next to Ludo's `rooms/CODE`, so the database rules need a `race` section. **One-time step:** in the [Firebase console](https://console.firebase.google.com) open **Build → Realtime Database → Rules**, replace everything with the contents of [`ludo/database.rules.json`](../ludo/database.rules.json) (it has both games' rules) and tap **Publish**.

During a race each phone sends its kart about 12 times a second (bots about 8) and draws everyone else slightly in the past, interpolating along their speed and predicting ahead if an update is late. Items and hits are events; whoever gets hit decides it on their own phone, so lag never causes arguments.

**Cost:** nothing, on Firebase's free Spark plan, which has no card attached and can't charge you. If a limit were ever reached, the database would simply pause until the next month. A 3-lap race with two phones uses a few MB of the 10 GB a month. Check the plan in Firebase console → ⚙ Project settings → Usage and billing: it should say **Spark**.

## Real streets (OpenStreetMap)

The real-street tracks come from [OpenStreetMap](https://www.openstreetmap.org/copyright) (map data © OpenStreetMap contributors, ODbL 1.0). `tools/build-tracks.mjs` routes along the real roads between a few waypoints, closes the loop, scales it to race size, eases the corners until karts can take them, and keeps the real building outlines, side streets, gardens and named places along the way. It writes the centre lines to `js/tracks-osm.js` and the rest to `tracks/<id>.json`, which loads when you race there. To rebuild, download each area with the OpenStreetMap API (`https://api.openstreetmap.org/api/0.6/map?bbox=minLon,minLat,maxLon,maxLat`, one small area at a time) into a folder and run `node race/tools/build-tracks.mjs <folder>`.

Google Maps' imagery and data can't be copied into a game, so the look (facades, the water tower, the IDA blocks) is modelled by hand from reference photos.

## Changing things

| What | Where |
|---|---|
| Rides, handling, perks, race lines | `js/riders.js` (faces, names and trash talk come from `ludo/js/characters.js`) |
| Tracks: shape, potholes, cows, boxes, boost strips | `TRACKS` in `js/track.js`; real-street routes and landmark spots in `CONFIG` in `tools/build-tracks.mjs` |
| Real buildings and their facades | `js/realcity.js` |
| Music | `Music` and `STYLES` in `js/audio.js` |
| Physics, items and their odds, bots | `js/sim.js` |
| Commentary lines and item names | `js/lines.js` |
| Scenery: shops and signboards, stalls, landmarks, arches, themes | `js/scenery.js` (signboard text in `SHOPS`, `BOARDS`, `FOOD56`, `MODERN`) |
| Vehicle models | `js/karts.js` |
| Camera, explosions, podium | `js/render.js` |
| Sounds | `js/audio.js` |
| Screens and HUD | `index.html`, `style.css`, `js/main.js`, `js/hud.js` |
| Online rooms | `js/net.js`, `js/room.js` |

three.js 0.170.0 loads from cdnjs (`js/three.js` pins the version).

## Tests

```sh
node --test race/tests/*.mjs
```

The tests check the track maths and items, and race five bots three laps round every track.

`tests/two-phones.cjs` races two browser phones against each other through the Firebase emulator, with a simulated slow network, and checks they agree on the result, how smoothly each draws the other's kart, and how much data a race uses.

To try online play locally, run the Firebase Database emulator on port 9000 with `ludo/database.rules.json` and open `http://localhost:8080/race/?emulator=9000`. Test-only URL options: `practice=1&go=1` starts a practice race straight away, `autopilot=1` lets a bot drive your kart, `step=1` advances the game only when a script calls `__pp.step()` (for smooth recordings), and `lag=120&jitter=60` pretends position updates arrive that late.
