# Pon Pon Prix 🛺💨

Kart racing through the streets of Indore with the Alquida gang. Make a room, send the link on WhatsApp, and your friends tap it and race from their own phones. No app, no sign-in.

**Play:** https://navdesignit.github.io/race/

- **2 to 5 riders online**, with 🤖 bots filling the rest of the gang, or practise alone against the bots.
- **The gang from [Alquida Landu](../ludo/)**, faces, names and trash talk straight from `ludo/js/characters.js`, each on their own ride:
  - 😎 **Ajay**: *Boss ki Bullet*. Dug-dug-dug. Fastest on the straights, heaviest in a bump.
  - 🧠 **Nav**: *Rocket Nano*, a Nano with a Diwali rocket on the roof. Drift sparks charge faster.
  - 🍛 **Chechu**: *Poha Express*, an auto-rickshaw with a poha stall on top. Mithai boxes sometimes give him two items.
  - ⚖️ **Vanshika**: *Advocate Scooter*. Quickest off the line; her nimbu-mirchi lasts longer.
  - 🎨 **Liu**: *Masterpiece Moped*, splashed with paint. Best steering, and the dusty shoulder barely slows her.
- **Three Indore tracks:** 🛕 *Rajwada Ring* (day, round the old palace), 🌙 *Sarafa Night Run* (fairy lights and jalebi stalls), 🌉 *Flyover Phataphat* (a figure of eight over a flyover at sunset). Cows wander across the road on their own timetable, potholes jolt you, speed breakers throw you in the air, and orange chevrons are masala boost strips.
- **Drifting:** hold DRIFT while turning. Sparks go white, yellow, orange, then pink; let go for a boost. Tap DRIFT just before the lights for a rocket start.
- **Items from mithai boxes:** 🩴 Mummy ki Chappal (homes in on the kart ahead), ♨️ Pressure Cooker (drop it; third seeti = boom), 🍋 Nimbu-Mirchi (blocks one hit), ☕ Cutting Chai (boost), 📯 Pon Pon Horn (shockwave), 🌿 Paan ki Peek (slippery puddle), 🚀 Diwali Rocket (autopilot boost, the back of the pack gets these), 🐄 Gaay Mata (parks a cow behind you).
- **Sounds:** engines, horns and tyre squeal are synthesised per ride (the Bullet thumps, the auto rattles, the moped goes nyeeee). The meme clips come from the Ludo packs, `ludo/sounds/fx.mp3` and `ludo/sounds/memes.mp3`.
- A commentator, trash talk when you overtake or hit someone, a 3D podium, awards (Chappal Champion, Gaay Bhakt, Pothole Inspector…) and a meme soundboard that plays on everyone's phone.

## Online play (Firebase)

Race rooms use the same free Firebase Realtime Database as the Ludo game (`ludo/js/firebase-config.js`). They live under `race/CODE` next to Ludo's `rooms/CODE`, so the database rules need a `race` section. **One-time step:** in the [Firebase console](https://console.firebase.google.com) open **Build → Realtime Database → Rules**, replace everything with the contents of [`ludo/database.rules.json`](../ludo/database.rules.json) (it has both games' rules) and tap **Publish**.

During a race each phone sends its kart about 12 times a second (bots about 8) and draws everyone else slightly in the past, interpolating along their speed and predicting ahead if an update is late. Items and hits are events; whoever gets hit decides it on their own phone, so lag never causes arguments.

**Cost:** nothing, on Firebase's free Spark plan, which has no card attached and can't charge you. If a limit were ever reached, the database would simply pause until the next month. A 3-lap race with two phones uses a few MB of the 10 GB a month. Check the plan in Firebase console → ⚙ Project settings → Usage and billing: it should say **Spark**.

## Changing things

| What | Where |
|---|---|
| Rides, handling, perks, race lines | `js/riders.js` (faces, names and trash talk come from `ludo/js/characters.js`) |
| Tracks: shape, potholes, cows, boxes, boost strips | `TRACKS` in `js/track.js` |
| Physics, items and their odds, bots | `js/sim.js` |
| Commentary lines and item names | `js/lines.js` |
| Scenery: shops and signboards, stalls, landmarks | `js/scenery.js` |
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
