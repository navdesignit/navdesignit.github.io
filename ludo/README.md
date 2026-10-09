# Alquida Landu 💣

Ludo, but with bombs. Make a room, send the link on WhatsApp, and your friends tap it and join from their phones. It works on iPhone and Android with no app to install.

**Play:** https://navdesignit.github.io/ludo/

- **2 to 5 players**, online or pass-and-play on one phone, with optional 🤖 bots. With 5 players the game switches to a pentagon board with five arms (pink is the 5th colour), so the whole gang can play together.
- **5 characters:** Ajay, Nav, Chechu, Vanshika and Liu. Type one of those names and you *become* that character. Anyone else picks a free one, and the real Nav always gets Nav.
  - 😎 Ajay, 🧠 Nav and 🍛 Chechu are childhood friends from Indore and roast each other in Indori.
  - ⚖️ Vanshika is a Delhi lawyer and Ajay's wife. If you need a 4 to kill her: "4 ni ayega 😌". If you get it anyway: "Toh maar do… haha 😂".
  - 🎨 Liu is an artist and Nav's girlfriend, who learned all her Hindi from Nav ("Chal dalleeeee!", "Yeeeee kuttaaaaa!").
  - 💕 **Besties pact:** Liu and Vanshika's bombs never hurt each other, the bots never kill each other, and a human gets an "are you sure?" first. Doing it anyway earns the 💔 Backstabber award.

## Rules

Normal Ludo:
- 🎲 Roll a 6 to bring a token out. A 6 also gives you another roll. Three 6s in a row means you were too greedy 🐷 and the turn ends.
- ⚔️ Landing on an enemy sends it back to its yard and gives you an extra roll.
- ⭐ Star squares and start squares are safe.
- 🏠 You need the exact number to get home. Getting home gives you an extra roll.

The Alquida extras:
- 💣 **KABOOM (self-destruct):** everyone gets one per game. Before you roll, if an enemy is within 2 squares of one of your tokens, you can blow that token up. Your token goes back to your yard, and so does every enemy within 2 squares. Star squares don't protect anyone from a bomb.
- ❓ **Mystery boxes:** three boxes sit on the track. Stop on one and you get one of these: 🚀 +5 squares · 🍌 slip back 3 · 🌀 swap places with a random enemy · 🛡️ shield for a round · 🎲 free roll · 💤 skip your next turn · 💣 an extra Kaboom.
- 💬 **Trash talk** changes with who you're talking to: husband and wife, girlfriend and boyfriend, the Indore boys, and the besties each get their own lines. Edit them in `js/characters.js`.
- 😂 **Emoji throws** fly across everyone's screen.
- 🤡 **The Landu badge** goes to whoever has been killed the most. End-of-game awards: Assassin, Biggest Landu, Kaboom King, Sleepyhead and 💔 Backstabber.
- ⏱️ **Turn timer** (host setting). If someone's phone goes to sleep or they leave, the game plays their turn for them.

## Turn on online play (one time, about 5 minutes, free)

Pass & play works straight away. Online rooms need a free Firebase Realtime Database:

1. Go to <https://console.firebase.google.com>, click **Create a project**, name it (for example `alquida-landu`) and create it. You can switch Google Analytics off.
2. In the left menu, open **Build → Realtime Database → Create Database**. Pick a location close to you (for India, **Singapore, asia-southeast1**) and choose **Start in locked mode**.
3. Open the **Rules** tab, delete what's there, paste in everything from [`database.rules.json`](database.rules.json), and click **Publish**.
4. Copy the database URL from the top of the **Data** tab. It looks like `https://alquida-landu-default-rtdb.asia-southeast1.firebasedatabase.app`.
5. Put it in [`js/firebase-config.js`](js/firebase-config.js):
   ```js
   export const firebaseConfig = {
     databaseURL: 'https://alquida-landu-default-rtdb.asia-southeast1.firebasedatabase.app',
   };
   ```
   Commit the change and GitHub Pages will update in a minute or two.

That's all: no sign-in setup and no billing. The free Spark plan allows 100 phones connected at once, which is far more than this needs. The URL is fine to publish because the rules only let people read or write a room if they know its 4-letter code.

## Changing things

| What | Where |
|---|---|
| Character names, nicknames, trash-talk lines, face drawings | `js/characters.js` |
| Rules: blast radius, box effects and their odds, Kaboom limits | `js/engine.js` |
| Board drawing and animations | `js/board.js` |
| Meme voice clips on a kill or a close call | `sounds/kill-memes.mp3`, cut into clips by `MEME_CLIPS` in `js/sound.js` |
| Screens and buttons | `index.html`, `style.css`, `js/app.js` |
| Online rooms (Firebase) | `js/net.js` |

`vendor/` holds an unmodified copy of the Firebase JS SDK 12.19.0 (Apache-2.0). Its one import is rewritten to a relative path, so the site doesn't depend on a CDN.

## Tests

```sh
node --test ludo/tests/*.mjs
```

The tests cover every rule, and they also play 600 full bot games to check that games always finish cleanly.

To try online play locally without a real Firebase project, run the Firebase Database emulator on port 9000 and open `http://localhost:8080/ludo/?emulator=9000`.
