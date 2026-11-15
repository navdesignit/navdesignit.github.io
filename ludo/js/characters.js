// The five Alquida Landu characters. Type one of these names when you join
// and you become that character. Faces are hand-drawn SVG (viewBox 0 0 100 100)
// so they stay crisp on every phone.
//
// Trash talk: `lines` are said to anyone; `to.<id>` replaces them when talking
// to that particular person. {n} in a threat line becomes the number the other
// player needs to roll to kill you.
//
// The gang: Ajay, Nav and Chechu are childhood friends from Indore. Vanshika is
// a lawyer in Delhi and Ajay's wife. Liu is Nav's girlfriend, an artist from
// China who learned all her Hindi from Nav. Liu and Vanshika are besties and
// try not to kill each other.

// Indori banter the three boys throw at each other.
const INDORI_KILL = [
  'Chal be dalle, jaldi chal! 🏃',
  'Lavde lage hai tere 😂',
  'Dalle ki dukan hai kya? 😂',
  'Chor aadmi! Ghar ja 🫵',
  'Jeeravan chatwa ke hi manega kya? 🌶️',
  'Bas jhuk jao… dheere se 😏',
  'Thoda sa le lo 😂',
];
const INDORI_DIE = [
  'Bhara baitha hai kya? 😤',
  'Sex game hai ye 😤',
  'Chor aadmi! 😤',
  'Dalle ki dukan hai ye game 😤',
  'Lavde lag gaye 😭',
];

export const CHARACTERS = {
  ajay: {
    name: 'Ajay',
    title: 'Indore ka Boss',
    emoji: '😎',
    weapon: '🏏',
    accent: '#FF8A3D',
    aliases: [],
    lines: {
      kill: ['Ghar ja! 🏠', 'Boss move 😎', 'Chal be, jaldi chal 🏃', 'Chor aadmi! Ghar ja 🫵'],
      die: ['Arre yaar! 😤', 'Bhara baitha hai kya? 😤', 'Revenge loading… ⏳'],
      kaboom: ['Chal be dalle, sab saath chalo! 💣', 'Boss exit 😎💥'],
      home: ['Boss ghar pahunch gaya 😎'],
      threat: ['Aaja {n} laake dikha 😏', '{n}? Sapne dekh 😎'],
    },
    to: {
      nav: { kill: INDORI_KILL, die: INDORI_DIE },
      chechu: { kill: INDORI_KILL, die: INDORI_DIE },
      vanshika: {
        kill: ['Sorry jaan… game hai 🙈', 'Aaj khana main bana dunga 🙏', 'Wakeel saab, ghar jao 😂'],
        die: ['Jaan?! 😳 Theek hai…', 'Ghar pe baat karte hain 😶'],
      },
    },
  },
  nav: {
    name: 'Nav',
    title: 'The Mastermind',
    emoji: '🧠',
    weapon: '🔫',
    accent: '#4DA3FF',
    aliases: ['navendu', 'navu'],
    lines: {
      kill: ['All according to plan 🧠', 'Ghar jao beta! 👋', 'Calculated 🧠'],
      die: ['This game is rigged! 😭', 'Who coded this?! Oh wait… me 😭', 'Bhara baitha hai kya? 😤'],
      kaboom: ['Plan B: KABOOM! 💣', 'Dheere se… BOOM 💥'],
      home: ['Calculated. 🧠'],
      threat: ['Aaja {n}, dekhte hain 😏', '{n} chahiye? Best of luck 😂'],
    },
    to: {
      ajay: { kill: INDORI_KILL, die: INDORI_DIE },
      chechu: { kill: INDORI_KILL, die: INDORI_DIE },
      liu: {
        kill: ['Sorry baby 🙈 game hai', 'This is why I taught you "dalle" 😂', 'Love you, but ghar jao ❤️'],
        die: ['Liu?! Maine hi sikhaya tha tujhe 😭', 'Kuttaaaa bolke maar diya 😭', 'Baby, no dinner for you 😤'],
      },
    },
  },
  chechu: {
    name: 'Chechu',
    title: 'Indori Bhiya',
    emoji: '🍛',
    weapon: '🍳',
    accent: '#B67CFF',
    aliases: [],
    lines: {
      kill: ['Bhiya ghar jao 😎', 'Indore se hu bhiya 😎', 'Chor aadmi! 🫵'],
      die: ['Bhara baitha hai! 😤', 'Chor aadmi 😤', 'Sex game hai ye 😤'],
      kaboom: ['Bhiya sab saath chalenge 💣', 'Jeeravan blast! 🌶️💥'],
      home: ['Poha-jalebi time 😎🍛'],
      threat: ['{n} laa ke dikha bhiya 😏', '{n}? Na ho payega bhiya 😂'],
    },
    to: {
      ajay: { kill: INDORI_KILL, die: INDORI_DIE },
      nav: { kill: INDORI_KILL, die: INDORI_DIE },
    },
  },
  vanshika: {
    name: 'Vanshika',
    title: 'The Lawyer',
    emoji: '⚖️',
    weapon: '🔨',
    accent: '#FF4FA3',
    aliases: ['vanshi'],
    lines: {
      kill: ['Case closed ⚖️', 'Judgement passed: ghar jao 👩‍⚖️', 'Bail rejected 😌', 'Order order! Out 🔨'],
      die: ['Toh maar do… haha 😂', 'Toh maar do na 😂', 'Objection! 👩‍⚖️', 'See you in court ⚖️'],
      kaboom: ['Final verdict: KABOOM ⚖️💥', 'Sabko saath le jaungi 💣'],
      home: ['Case won ⚖️'],
      threat: ['{n} ni ayega 😌', 'Ni ayenge {n}. Likh ke le lo ⚖️', '{n}? 1 in 6 chance. Relax 😌', 'Objection! {n} ni ayega 👩‍⚖️'],
    },
    to: {
      liu: {
        kill: ['Sorry Liu! 🥺 Rules are rules', 'Liu, I didn\'t want to 😭'],
        die: ['Liu?! Hum dost the 🥺', 'Liu… et tu? 💔'],
      },
      ajay: {
        kill: ['Ghar pe baat karte hain, Ajay 😌', 'Pati ho toh kya, rules are rules ⚖️'],
        die: ['Ajay. Ghar aao aaj 😤', 'Divorce papers ready hain ⚖️😂'],
      },
    },
  },
  liu: {
    name: 'Liu',
    title: 'The Artist',
    emoji: '🎨',
    weapon: '🖌️',
    accent: '#33CA7F',
    aliases: ['ehan'],
    lines: {
      kill: ['Yeeeeeee! Kuttaaaaaa! 🎨', 'Lend ho kya? 😂', 'Chal dalleeeee 💅', 'Bhavda sala! 🤣', 'Chutai! 🤣', 'Yeeeeee ghar jaooooo 👋'],
      die: ['Kuttaaaaaaaa! 😭', 'Yeeeeee no no no 😭', 'Bhavda sala… my masterpiece 😭', 'Chutaiiii 😤'],
      kaboom: ['Yeeeeeeee KABOOM! 🎨💥', 'Art is explosion! Chal dalleeeee 💣'],
      home: ['Yeeeeeeee! Masterpiece home 🎨'],
      threat: ['Yeeeee don\'t come {n}! 🙏', '{n}? No no no. Kuttaaaa 😤'],
    },
    to: {
      vanshika: {
        kill: ['Sorry Vanshikaaaaa 😭 my hand slip!', 'Noooo not Vanshika! 🥺 Still friends?'],
        die: ['Vanshikaaaa?! 🥺 Whyyyy', 'Okay okay… only you can do this 🥺'],
      },
      nav: {
        kill: ['Sorry babyyy 😘 Chal dalleeee!', 'You teach me "dalle", now you go home 😂'],
        die: ['Naaaaav! Kuttaaaaa! 😤', 'Baby?! Bhavda sala! 😤'],
      },
    },
  },
};

// Besties never hurt each other with a KABOOM, and bots avoid killing each other.
export const BESTIES = [['liu', 'vanshika']];
export const areBesties = (a, b) => BESTIES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

// A line for `id` to say. `targetId` (who they're talking to) can switch to special lines.
export function pickLine(id, kind, targetId, rng = Math.random, vars = {}) {
  const c = CHARACTERS[id] || CHARACTERS.nav;
  const special = targetId && c.to && c.to[targetId] && c.to[targetId][kind];
  const list = special && special.length ? special : c.lines[kind];
  if (!list || !list.length) return null;
  return list[Math.floor(rng() * list.length) % list.length].replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

export const CHAR_IDS = Object.keys(CHARACTERS);

// "Ajay", "ajay kumar", "NAV!!" → the character that name belongs to (or null).
export function charForName(name) {
  const first = String(name || '').toLowerCase().replace(/[^a-z\s]/g, ' ').trim().split(/\s+/)[0] || '';
  return CHAR_IDS.find(id => id === first || CHARACTERS[id].aliases.includes(first)) || null;
}

const DARK = '#1d1d1f';

function head(skin, ears = true) {
  return (ears ? `<circle cx="23" cy="58" r="6" fill="${skin}"/><circle cx="77" cy="58" r="6" fill="${skin}"/>` : '') +
    `<circle cx="50" cy="56" r="27" fill="${skin}"/>`;
}
const cheeks = '<circle cx="33" cy="66" r="4.5" fill="#ff6b81" opacity=".35"/><circle cx="67" cy="66" r="4.5" fill="#ff6b81" opacity=".35"/>';
// Big cartoon eyes; the f-eye group blinks (style.css), staggered per avatar.
const eye = (x, y = 56, r = 4.6) => `<g class="f-eye"><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r + 1.2}" fill="#fff"/>` +
  `<ellipse cx="${x}" cy="${y + 0.5}" rx="${(r * 0.62).toFixed(2)}" ry="${(r * 0.82).toFixed(2)}" fill="${DARK}"/><circle cx="${x + 1.4}" cy="${y - 1.8}" r="1.4" fill="#fff"/></g>`;
const brow = d => `<path d="${d}" fill="none" stroke="${DARK}" stroke-width="2.4" stroke-linecap="round"/>`;
const star = (x, y, r, fill) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    d += `${i ? 'L' : 'M'}${(x + rr * Math.cos(a)).toFixed(2)} ${(y - rr * Math.sin(a)).toFixed(2)}`;
  }
  return `<path d="${d}Z" fill="${fill}"/>`;
};

const FACES = {
  ajay: () => { // Indore ka Boss: mega shades with a glint, toothpick, gold tooth
    const skin = '#C68642';
    return head(skin) +
      '<path d="M22 52 C20 34 27 24 34 22 L32 10 L41 20 L44 6 L51 19 L58 5 L62 20 L71 10 L69 24 C77 28 80 38 78 52 C71 41 62 37 50 37 C38 37 29 41 22 52Z" fill="#1b1b1b"/>' +
      brow('M30 45 Q38 41 46 45') + brow('M54 45 Q62 41 70 45') +
      '<path d="M33 67 Q50 90 67 67 Q63 81 50 83 Q37 81 33 67Z" fill="#000" opacity=".13"/>' +
      '<path d="M39 70 Q51 78 63 66" fill="none" stroke="#5a2a14" stroke-width="3" stroke-linecap="round"/>' +
      '<rect x="52" y="70" width="5" height="5" rx="1" fill="#f5b400"/>' +
      '<path d="M62 68 L79 61" stroke="#d9b38c" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path d="M28 54 L20 50 M72 54 L80 50" stroke="#111" stroke-width="2.4"/>' +
      '<rect x="27" y="49" width="21" height="13" rx="5" fill="#111"/><rect x="52" y="49" width="21" height="13" rx="5" fill="#111"/>' +
      '<path d="M47 54 h6" stroke="#111" stroke-width="2.8"/>' +
      '<path d="M31 53 h7 M56 53 h7" stroke="#fff" stroke-width="2" opacity=".8" stroke-linecap="round"/>' +
      star(74, 48, 3.5, '#fff');
  },
  nav: () => { // The Mastermind: backwards cap, evil-genius brows, buck teeth, a lightbulb
    const skin = '#D9A066';
    return head(skin) +
      '<path d="M24 56 Q22 46 27 41 L31 56Z M76 56 Q78 46 73 41 L69 56Z" fill="#2b1a10"/>' +
      '<path d="M21 49 C21 26 35 17 50 17 C65 17 79 26 79 49 C71 43 61 40 50 40 C39 40 29 43 21 49Z" fill="#2D6CDF"/>' +
      '<path d="M21 49 C29 43 39 40 50 40 C61 40 71 43 79 49" fill="none" stroke="#1a4fb8" stroke-width="3.2"/>' +
      `<rect x="43" y="36.5" width="14" height="6" rx="2.5" fill="${skin}"/>` +
      '<circle cx="50" cy="18" r="2.8" fill="#1a4fb8"/>' +
      '<text x="85" y="24" font-size="16" text-anchor="middle">💡</text>' +
      brow('M32 46 Q38 40 46 45') + brow('M54 45 Q62 40 68 46') +
      eye(40) + eye(60) + cheeks +
      '<path d="M36 65 Q50 86 64 65 Z" fill="#fff" stroke="#5a2a14" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<rect x="44" y="65" width="6" height="9" fill="#fff" stroke="#5a2a14" stroke-width="1.2"/><rect x="50" y="65" width="6" height="9" fill="#fff" stroke="#5a2a14" stroke-width="1.2"/>' +
      '<path d="M44 77 Q50 81 56 77 Q50 74 44 77Z" fill="#ff6b81"/>';
  },
  chechu: () => { // Indori foodie: unibrow, a mustache you could sweep the floor with, gold tooth, chain, mirchi
    const skin = '#B5754A';
    return head(skin) +
      '<path d="M23 53 C21 33 34 21 51 21 C68 21 80 31 77 51 C74 42 68 37 61 35 C53 40 39 38 30 42 C27 45 25 49 23 53Z" fill="#1a0f0a"/>' +
      brow('M32 47 Q50 40 68 47') +
      eye(40) + eye(60) +
      '<path d="M20 70 C30 57 44 60 50 65 C56 60 70 57 80 70 C70 66 58 68 50 71 C42 68 30 66 20 70Z" fill="#1a0f0a"/>' +
      '<path d="M40 76 Q50 84 60 76" fill="none" stroke="#5a2a14" stroke-width="2.6" stroke-linecap="round"/>' +
      '<rect x="46" y="76" width="5" height="4" rx="1" fill="#f5b400"/>' +
      '<path d="M33 85 Q50 97 67 85" fill="none" stroke="#f5b400" stroke-width="2.6"/><circle cx="50" cy="91" r="2.6" fill="#f5b400"/>' +
      '<text x="82" y="90" font-size="15" text-anchor="middle">🌶️</text>';
  },
  vanshika: () => { // Delhi lawyer: judge's wig, one raised brow, lipstick smile, objection!
    const skin = '#E0AC69';
    return head(skin) +
      '<path d="M22 50 C22 28 36 20 50 20 C64 20 78 28 78 50 L72 48 C72 34 62 28 50 28 C38 28 28 34 28 48Z" fill="#f3f0e6"/>' +
      '<circle cx="22" cy="54" r="6" fill="#f3f0e6"/><circle cx="22" cy="65" r="6" fill="#f3f0e6"/><circle cx="78" cy="54" r="6" fill="#f3f0e6"/><circle cx="78" cy="65" r="6" fill="#f3f0e6"/>' +
      brow('M33 49 Q40 47 46 49') + brow('M54 45 Q61 39 67 44') +
      eye(40, 57, 4) + eye(60, 56, 4.8) +
      cheeks +
      '<path d="M40 68 Q50 78 60 68 Q50 73 40 68Z" fill="#c8102e"/>' +
      star(23, 78, 4, '#f5b400') + star(77, 78, 4, '#f5b400');
  },
  liu: () => { // Artist: beret, huge round glasses, paint on the cheeks, tongue out while concentrating
    const skin = '#F1C27D';
    return '<path d="M19 72 C15 38 31 22 50 22 C69 22 85 38 81 72 Z" fill="#141414"/>' +
      head(skin, false) +
      '<path d="M24 51 C24 32 36 25 50 25 C64 25 76 32 76 51 L71 48 L66 44 L60 47 L54 43 L48 47 L42 43 L36 47 L30 44 Z" fill="#141414"/>' +
      '<path d="M25 31 C29 16 66 9 79 23 C81 28 75 32 60 32 C46 32 32 35 25 31Z" fill="#E63946"/>' +
      '<path d="M56 13 l2 -4" stroke="#E63946" stroke-width="3" stroke-linecap="round"/>' +
      eye(40, 57) + eye(60, 57) +
      '<g fill="rgba(255,255,255,.18)" stroke="#222" stroke-width="2.6"><circle cx="40" cy="57" r="10"/><circle cx="60" cy="57" r="10"/></g>' +
      '<path d="M49.5 57 h1 M30 55 L22 52 M70 55 L78 52" stroke="#222" stroke-width="2.4"/>' +
      cheeks +
      '<circle cx="70" cy="71" r="4" fill="#4392F1" opacity=".85"/><circle cx="74" cy="75" r="2.4" fill="#33CA7F"/><circle cx="27" cy="73" r="2.6" fill="#ff4fa3"/>' +
      '<path d="M44 70 Q50 74 56 70" fill="none" stroke="#7a2e2e" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M50 72 Q54 80 48 79 Q45 75 50 72Z" fill="#ff6b81"/>';
  },
};

// Raw face drawing (no background), for <symbol> definitions.
export function faceMarkup(id) {
  return (FACES[id] || FACES.nav)();
}

// A standalone round avatar <svg>. bg defaults to the character's accent colour.
// A standalone round avatar <svg>. bg defaults to the character's accent colour; the
// character's weapon pokes into the corner unless weapon: false (board pieces hold their own).
export function avatar(id, { bg, size, weapon = true } = {}) {
  const c = CHARACTERS[id] || CHARACTERS.nav;
  const dim = size ? ` width="${size}" height="${size}"` : '';
  return `<svg class="avatar" viewBox="0 0 100 100"${dim} style="--bd:-${(Math.random() * 4).toFixed(2)}s" aria-label="${c.name}" role="img">` +
    `<defs><clipPath id="av-${id}"><circle cx="50" cy="50" r="50"/></clipPath></defs>` +
    `<g clip-path="url(#av-${id})"><rect width="100" height="100" fill="${bg || c.accent}"/>${faceMarkup(id)}</g>` +
    `${weapon && c.weapon ? `<text class="f-weapon" x="80" y="94" font-size="30" text-anchor="middle">${c.weapon}</text>` : ''}</svg>`;
}
