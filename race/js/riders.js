// The gang from Alquida Landu (ludo/js/characters.js), and what each of them rides.
// Faces, names, weapons and trash talk all come from the Ludo game, so edit them there.
// Here: the vehicles, their handling, and lines that only make sense on a road.

import { CHARACTERS as LUDO_CHARS, CHAR_IDS as LUDO_IDS, avatar as ludoAvatar, faceMarkup as ludoFace, pickLine as ludoLine, charForName as ludoName, areBesties } from '../../ludo/js/characters.js';

export { areBesties };

// Lisa, the gang's Agnica partner from Kazakhstan, races here too (the Ludo board
// stays at five). Her face is drawn in the same style as the others.
const LISA = {
  name: 'Lisa',
  title: 'The Agnica Partner',
  emoji: '🦅',
  weapon: '🪕',
  accent: '#00AFCA',
  aliases: ['liza', 'lisaa'],
  lines: {
    kill: ['Davai davai, ghar jao! 👋', 'Deal closed 🤝', 'Rakhmet for the overtake 😘', 'Business is business 💼', 'Invoice bhej dungi 🧾'],
    die: ['Bozhe moi! 😱', 'Ye contract mein nahi tha! 😤', 'Ai-yai-yai 😭', 'Partner, not fair 😤'],
    kaboom: ['Steppe style KABOOM! 💥', 'Davai… BOOM! 💣'],
    home: ['Deal done! Rakhmet 🤝'],
    threat: ['{n}? Nyet 😏'],
  },
  to: {
    nav: { kill: ['Partner, no discount on this one 😎', 'Nav, meeting mein baat karenge 😘'], die: ['Nav! Partnership khatam 😤', 'Nav, this goes in the minutes 📝😤'] },
    liu: { kill: ['Sorry Liu, davai davai! 😘'], die: ['Liu?! Dostoi! 😭'] },
  },
};
export const CHARACTERS = { ...LUDO_CHARS, lisa: LISA };
export const CHAR_IDS = [...LUDO_IDS, 'lisa'];

const DARK = '#1d1d1f';
const eye = (x, y = 57, r = 4.6) => `<g class="f-eye"><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r + 1.2}" fill="#fff"/>` +
  `<ellipse cx="${x}" cy="${y + 0.5}" rx="${(r * 0.62).toFixed(2)}" ry="${(r * 0.82).toFixed(2)}" fill="#3b6fb6"/><ellipse cx="${x}" cy="${y + 0.8}" rx="${(r * 0.32).toFixed(2)}" ry="${(r * 0.45).toFixed(2)}" fill="${DARK}"/><circle cx="${x + 1.4}" cy="${y - 1.8}" r="1.4" fill="#fff"/></g>`;
const sun = (x, y) => `<circle cx="${x}" cy="${y}" r="3.2" fill="#FEC50C"/>` + [0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = (i * Math.PI) / 4; return `<path d="M${(x + Math.cos(a) * 4).toFixed(1)} ${(y + Math.sin(a) * 4).toFixed(1)} L${(x + Math.cos(a) * 6).toFixed(1)} ${(y + Math.sin(a) * 6).toFixed(1)}" stroke="#FEC50C" stroke-width="1.4" stroke-linecap="round"/>`; }).join('');

// Lisa: long hair, an embroidered sky-blue kalpak with an owl feather, golden sun earrings, a deal-closing smile.
function lisaFace() {
  const skin = '#F2D0B5', hair = '#8a5a34';
  return `<path d="M19 62 C14 34 30 20 50 20 C70 20 86 34 81 62 L86 92 C72 98 28 98 14 92 Z" fill="${hair}"/>` +
    `<circle cx="23" cy="58" r="6" fill="${skin}"/><circle cx="77" cy="58" r="6" fill="${skin}"/><circle cx="50" cy="57" r="27" fill="${skin}"/>` +
    `<path d="M23 54 C22 36 36 28 50 28 C64 28 78 36 77 54 C72 44 62 40 54 41 C46 42 38 40 32 45 C28 47 25 50 23 54Z" fill="${hair}"/>` +
    '<path d="M27 37 C27 17 73 17 73 37 C62 33 38 33 27 37Z" fill="#00AFCA"/>' +
    '<path d="M27 37 C38 33 62 33 73 37" stroke="#FEC50C" stroke-width="3.2" fill="none"/>' +
    '<path d="M36 28 q4 -4 8 0 q4 -4 8 0 q4 -4 8 0" stroke="#FEC50C" stroke-width="1.8" fill="none"/>' +
    '<path d="M58 22 C60 10 68 4 74 1 C73 9 69 17 62 24Z" fill="#f7f2e8" stroke="#9a9a9a" stroke-width="1"/><path d="M60 21 L71 5" stroke="#9a9a9a" stroke-width="0.8"/>' +
    `<path d="M32 49 Q39 44 46 48" fill="none" stroke="${hair}" stroke-width="2.4" stroke-linecap="round"/><path d="M54 48 Q61 44 68 49" fill="none" stroke="${hair}" stroke-width="2.4" stroke-linecap="round"/>` +
    eye(40) + eye(60) +
    `<path d="M34 53 l-3 -2 M66 53 l3 -2" stroke="${DARK}" stroke-width="1.6" stroke-linecap="round"/>` +
    '<circle cx="33" cy="66" r="4.5" fill="#ff6b81" opacity=".35"/><circle cx="67" cy="66" r="4.5" fill="#ff6b81" opacity=".35"/>' +
    '<path d="M38 67 Q50 81 62 67 Q50 72 38 67Z" fill="#fff" stroke="#c8102e" stroke-width="2.4" stroke-linejoin="round"/>' +
    sun(21, 69) + sun(79, 69);
}

export function faceMarkup(id) { return id === 'lisa' ? lisaFace() : ludoFace(id); }

export function avatar(id, opts = {}) {
  if (id !== 'lisa') return ludoAvatar(id, opts);
  const { bg, size, weapon = true } = opts;
  const dim = size ? ` width="${size}" height="${size}"` : '';
  return `<svg class="avatar" viewBox="0 0 100 100"${dim} style="--bd:-${(Math.random() * 4).toFixed(2)}s" aria-label="Lisa" role="img">` +
    `<defs><clipPath id="av-lisa"><circle cx="50" cy="50" r="50"/></clipPath></defs>` +
    `<g clip-path="url(#av-lisa)"><rect width="100" height="100" fill="${bg || LISA.accent}"/>${lisaFace()}</g>` +
    `${weapon ? `<text class="f-weapon" x="80" y="94" font-size="30" text-anchor="middle">${LISA.weapon}</text>` : ''}</svg>`;
}

export function pickLine(id, kind, targetId, rng = Math.random, vars = {}) {
  if (id !== 'lisa') return ludoLine(id, kind, targetId === 'lisa' ? null : targetId, rng, vars);
  const special = targetId && LISA.to[targetId] && LISA.to[targetId][kind];
  const list = special && special.length ? special : LISA.lines[kind];
  if (!list || !list.length) return null;
  return list[Math.floor(rng() * list.length) % list.length].replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

export function charForName(name) {
  const first = String(name || '').toLowerCase().replace(/[^a-z\s]/g, ' ').trim().split(/\s+/)[0] || '';
  if (first === 'lisa' || LISA.aliases.includes(first)) return 'lisa';
  return ludoName(name);
}

// stats: speed and accel multiply the base car; turn is steering; weight wins bumps;
// offroad is how much top speed is kept on the dirt; charge = drift spark speed.
export const RIDES = {
  ajay: {
    veh: 'bullet', ride: 'Boss ki Bullet', icon: '🏍️',
    blurb: 'Dug-dug-dug. Top speed king, heavy as a buffalo. Nobody pushes the Boss around.',
    stats: { speed: 1.05, accel: 0.9, turn: 0.95, weight: 1.35, offroad: 0.55, charge: 1, shield: 12 },
    bars: { speed: 5, accel: 2, turn: 3, weight: 5 },
    perk: 'Fastest on the straights, wins every bump',
    lines: {
      start: ['Bullet ki dug-dug se pehchaan lena 😎', 'Side ho jao, Boss aa raha hai 😎', 'Seat belt? Bullet pe? 😂'],
      boost: ['Boss mode ON 😎', 'Dug dug DUG! 🔥'],
      pass: ['Side de na bhai 😎', 'Bullet ke aage? Kabhi nahi 😎', 'Chal be, Indore ka Boss aaya'],
      win: ['Boss ghar pahunch gaya 😎', 'Indore ka Boss, Indore ka King 👑'],
      last: ['Bullet ka petrol khatam tha 😤', 'Ye Bullet nahi, bail gaadi hai 😤'],
    },
  },
  nav: {
    veh: 'nano', ride: 'Rocket Nano', icon: '🚗',
    blurb: 'A tiny Nano with a Diwali rocket strapped to the roof. Pure jugaad, pure genius.',
    stats: { speed: 0.99, accel: 1.05, turn: 1.04, weight: 0.95, offroad: 0.58, charge: 1.18, shield: 12 },
    bars: { speed: 3, accel: 4, turn: 4, weight: 2 },
    perk: 'Drift sparks charge faster (calculated 🧠)',
    lines: {
      start: ['Nano mein rocket fit kiya hai. Jugaad 🧠', 'Sab calculate kar liya hai 🧠', 'One lakh ki gaadi, crore ka dimaag 🧠'],
      boost: ['Calculated. 🧠🚀', 'Rocket science hai bhai 🚀'],
      pass: ['All according to plan 🧠', 'Bye bye 👋 Nano zindabad'],
      win: ['Calculated. 🧠', 'Nano ne sabko pela 🧠'],
      last: ['Who coded this game?! Oh wait… me 😭', 'This game is rigged! 😭'],
    },
  },
  chechu: {
    veh: 'auto', ride: 'Poha Express', icon: '🛺',
    blurb: 'An auto-rickshaw with a poha stall on the roof. Meter down, poha up.',
    stats: { speed: 0.98, accel: 1.0, turn: 0.99, weight: 1.2, offroad: 0.6, charge: 1, shield: 12, jugaad: true },
    bars: { speed: 3, accel: 3, turn: 3, weight: 4 },
    perk: 'Jugaad: mithai boxes sometimes give two items',
    lines: {
      start: ['Auto mein poha bhi milega, sawari bhi 🍛', 'Meter se chalega bhiya 🛺', 'Indore se hu bhiya 😎'],
      boost: ['Bhiya full speed! 🛺💨', 'Jeeravan power! 🌶️'],
      pass: ['Bhiya side hato 🛺', 'Auto wale se panga? 😎', 'Chalo bhiya, poha thanda ho raha hai'],
      win: ['Poha-jalebi time 😎🍛', 'Auto number one bhiya! 🛺'],
      last: ['Bhara baitha hai ye game! 😤', 'Auto ka meter kharab tha 😤'],
    },
  },
  vanshika: {
    veh: 'scooter', ride: 'Advocate Scooter', icon: '🛵',
    blurb: 'Pink scooter with an ADVOCATE sticker. The traffic police salute it.',
    stats: { speed: 0.99, accel: 1.1, turn: 1.02, weight: 0.85, offroad: 0.57, charge: 1, shield: 17 },
    bars: { speed: 3, accel: 5, turn: 4, weight: 1 },
    perk: 'Nimbu-mirchi lasts longer (bail granted)',
    lines: {
      start: ['ADVOCATE sticker hai, challan nahi katega ⚖️', 'Order order! Race shuru 🔨', 'Sab ko court mein dekh lungi 😌'],
      boost: ['Bail granted 😌💨', 'Objection overruled! 💨'],
      pass: ['Objection! Side do 👩‍⚖️', 'Case closed ⚖️', 'Judgement: tum peeche 😌'],
      win: ['Case won ⚖️', 'Verdict: main jeeti 😌'],
      last: ['Toh maar do… haha 😂', 'Appeal karungi ⚖️'],
    },
  },
  liu: {
    veh: 'moped', ride: 'Masterpiece Moped', icon: '🛵',
    blurb: 'A moped splashed with every colour she owns. Light, nimble and loud.',
    stats: { speed: 0.97, accel: 1.08, turn: 1.12, weight: 0.8, offroad: 0.72, charge: 1, shield: 12 },
    bars: { speed: 2, accel: 4, turn: 5, weight: 1 },
    perk: 'Best steering, and barely slows on the dirt',
    lines: {
      start: ['My moped is masterpiece. Yeeeee! 🎨', 'Chal dalleeeee! 🛵', 'Art is speed! 🎨'],
      boost: ['Yeeeeeeee! 🎨💨', 'Chal dalleeeee 💅'],
      pass: ['Lend ho kya? 😂', 'Bye byeeeee 👋', 'Yeeeee side side side!'],
      win: ['Yeeeeeeee! Masterpiece 🎨', 'I learn Hindi AND racing 🏆'],
      last: ['Kuttaaaaaaaa! 😭', 'Bhavda sala… 😭'],
    },
  },
  lisa: {
    veh: 'tonga', ride: 'Steppe Express', icon: '🐎',
    blurb: 'An Indore tonga pulled by a horse straight off the Kazakh steppe. Clip-clop, davai davai!',
    stats: { speed: 1.0, accel: 1.02, turn: 1.0, weight: 1.1, offroad: 0.62, charge: 1, shield: 12, hooves: true },
    bars: { speed: 4, accel: 3, turn: 3, weight: 3 },
    perk: 'Horse power: gallops straight over potholes',
    lines: {
      start: ['Salem, Indore! Davai davai! 🐎', 'Ghoda taiyaar hai, deal bhi 🤝', 'Steppe se seedha Rajwada 🐎'],
      boost: ['Davai davai! 🐎💨', 'Full horse power! 🐎'],
      pass: ['Davai, side please 😘', 'Partner, see you at the finish 👋', 'Rakhmet, bye bye! 👋'],
      win: ['Deal closed! 🤝🏆', 'Kazakhstan zindabad! 🇰🇿'],
      last: ['Ghoda thak gaya 😭', 'Bozhe moi… 😭'],
    },
  },
};

// Pairs that get special lines when one overtakes the other.
const PASS_TO = {
  'ajay>vanshika': ['Jaan, side do 😘', 'Aaj dinner main banaunga, abhi side do 🙏'],
  'vanshika>ajay': ['Ajay. Ghar aao aaj 😤', 'Pati ho toh kya, side do ⚖️'],
  'nav>liu': ['Sorry baby 🙈 race hai', 'Love you, but bye 👋❤️'],
  'liu>nav': ['Naaaaav! Kuttaaaaa! 😂', 'Babyyy byeeeee 😘'],
  'liu>vanshika': ['Sorry Vanshikaaaa 🥺 still friends?'],
  'vanshika>liu': ['Liu, I didn\'t want to 😭 but bye'],
  'lisa>nav': ['Partner, I take this deal 😎', 'Nav, see you in the meeting 👋'],
  'nav>lisa': ['Sorry partner, business is business 💼', 'Lisa, invoice mein likh lena 😂'],
};

export function rideLine(id, kind, otherId, rng = Math.random) {
  const pair = otherId && PASS_TO[`${id}>${otherId}`];
  if (kind === 'pass' && pair && rng() < 0.6) return pair[Math.floor(rng() * pair.length)];
  const list = (RIDES[id] || RIDES.nav).lines[kind];
  return list ? list[Math.floor(rng() * list.length)] : null;
}

// Hit lines reuse the Ludo kill/die trash talk (with the right person-to-person lines).
export function hitLines(attacker, victim, rng = Math.random) {
  return {
    kill: attacker ? pickLine(attacker, 'kill', victim, rng) : null,
    die: victim ? pickLine(victim, 'die', attacker, rng) : null,
  };
}
