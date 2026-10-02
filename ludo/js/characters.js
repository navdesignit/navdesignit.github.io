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
const eye = (x, y = 56) => `<ellipse cx="${x}" cy="${y}" rx="3.6" ry="4.6" fill="${DARK}"/><circle cx="${x + 1.2}" cy="${y - 1.7}" r="1.3" fill="#fff"/>`;
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
  ajay: () => {
    const skin = '#C68642';
    return head(skin) +
      // spiky hair
      '<path d="M24 52 C22 36 28 26 34 24 L33 15 L41 22 L44 11 L51 21 L57 10 L61 22 L69 14 L68 25 C75 29 78 38 76 52 C70 42 62 38 50 38 C38 38 30 42 24 52Z" fill="#1b1b1b"/>' +
      brow('M31 46 Q38 43 45 46') + brow('M55 46 Q62 43 69 46') +
      // stubble + smirk
      '<path d="M33 67 Q50 90 67 67 Q63 81 50 83 Q37 81 33 67Z" fill="#000" opacity=".13"/>' +
      '<path d="M41 70 Q51 76 61 67" fill="none" stroke="#5a2a14" stroke-width="2.8" stroke-linecap="round"/>' +
      // sunglasses
      '<path d="M30 54 L23 51 M70 54 L77 51" stroke="#111" stroke-width="2.2"/>' +
      '<rect x="29" y="50" width="18" height="11" rx="4.5" fill="#111"/><rect x="53" y="50" width="18" height="11" rx="4.5" fill="#111"/>' +
      '<path d="M47 54 h6" stroke="#111" stroke-width="2.6"/>' +
      '<path d="M32.5 53.5 h6 M56.5 53.5 h6" stroke="#fff" stroke-width="1.8" opacity=".75" stroke-linecap="round"/>';
  },
  nav: () => {
    const skin = '#D9A066';
    return head(skin) +
      '<path d="M24 56 Q22 46 27 41 L31 56Z M76 56 Q78 46 73 41 L69 56Z" fill="#2b1a10"/>' +
      // backwards cap
      '<path d="M21 49 C21 26 35 17 50 17 C65 17 79 26 79 49 C71 43 61 40 50 40 C39 40 29 43 21 49Z" fill="#2D6CDF"/>' +
      '<path d="M21 49 C29 43 39 40 50 40 C61 40 71 43 79 49" fill="none" stroke="#1a4fb8" stroke-width="3.2"/>' +
      `<rect x="43" y="36.5" width="14" height="6" rx="2.5" fill="${skin}"/>` +
      '<path d="M41 39.5 h18" stroke="#fff" stroke-width="1.6"/>' +
      '<circle cx="50" cy="18" r="2.8" fill="#1a4fb8"/>' +
      brow('M33 47 Q39 42.5 45 46') + brow('M55 46 Q61 42.5 67 47') +
      eye(40) + eye(60) + cheeks +
      // big grin
      '<path d="M37 65 Q50 84 63 65 Z" fill="#fff" stroke="#5a2a14" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M44 73.5 Q50 79 56 73.5 Q50 70.5 44 73.5Z" fill="#ff6b81"/>';
  },
  chechu: () => {
    const skin = '#B5754A';
    return head(skin) +
      // short side-parted hair
      '<path d="M23 53 C21 33 34 21 51 21 C68 21 80 31 77 51 C74 42 68 37 61 35 C53 40 39 38 30 42 C27 45 25 49 23 53Z" fill="#1a0f0a"/>' +
      '<path d="M61 35 C56 30 50 26 43 25" fill="none" stroke="#4a3328" stroke-width="1.6" stroke-linecap="round"/>' +
      brow('M33 47.5 Q39 44.5 45 46.5') + brow('M55 46.5 Q61 44.5 67 47.5') +
      eye(40) + eye(60) +
      // big Indori mustache
      '<path d="M35 66.5 C39 60.5 46 60.5 50 64 C54 60.5 61 60.5 65 66.5 C60 65 55 66.5 50 68 C45 66.5 40 65 35 66.5Z" fill="#1a0f0a"/>' +
      '<path d="M42 71 Q50 78 58 71" fill="none" stroke="#5a2a14" stroke-width="2.6" stroke-linecap="round"/>' +
      // gold chain
      '<path d="M33 85 Q50 97 67 85" fill="none" stroke="#f5b400" stroke-width="2.6"/>' +
      '<circle cx="50" cy="91" r="2.6" fill="#f5b400"/>';
  },
  vanshika: () => {
    const skin = '#E0AC69';
    return '<path d="M66 27 C86 24 95 44 89 64 C86 75 80 81 73 85 C80 70 82 55 73 40Z" fill="#3b2416"/>' +
      head(skin) +
      '<path d="M23 54 C22 34 36 24 52 24 C68 24 79 34 77 52 C72 40 64 34 54 34 C44 40 32 45 23 54Z" fill="#3b2416"/>' +
      '<circle cx="72" cy="30" r="3.8" fill="#ff4fa3"/>' +
      brow('M34 48 Q40 46 45 48') + brow('M55 46 Q61 41.5 66 45.5') +
      `<path d="M35.5 57 Q40 52.5 44.5 57" fill="none" stroke="${DARK}" stroke-width="2.6" stroke-linecap="round"/>` +
      eye(60) + cheeks +
      '<path d="M41 67 Q50 76 59 67" fill="none" stroke="#7a2e2e" stroke-width="2.8" stroke-linecap="round"/>' +
      '<path d="M46.5 71.5 Q50 79 54 71.5Z" fill="#ff6b81"/>' +
      star(23, 68, 4, '#f5b400') + star(77, 68, 4, '#f5b400');
  },
  liu: () => {
    const skin = '#F1C27D';
    return '<path d="M19 72 C15 38 31 22 50 22 C69 22 85 38 81 72 Z" fill="#141414"/>' +
      head(skin, false) +
      '<path d="M24 51 C24 32 36 25 50 25 C64 25 76 32 76 51 L71 48 L66 44 L60 47 L54 43 L48 47 L42 43 L36 47 L30 44 Z" fill="#141414"/>' +
      // beret
      '<path d="M25 31 C29 16 66 9 79 23 C81 28 75 32 60 32 C46 32 32 35 25 31Z" fill="#E63946"/>' +
      '<path d="M56 13 l2 -4" stroke="#E63946" stroke-width="3" stroke-linecap="round"/>' +
      eye(40, 57) + eye(60, 57) +
      '<g fill="rgba(255,255,255,.22)" stroke="#222" stroke-width="2.4"><circle cx="40" cy="57" r="7.8"/><circle cx="60" cy="57" r="7.8"/></g>' +
      '<path d="M47.8 57 h4.4" stroke="#222" stroke-width="2.4"/>' +
      cheeks +
      '<path d="M44 70 Q50 74.5 56 70" fill="none" stroke="#7a2e2e" stroke-width="2.6" stroke-linecap="round"/>' +
      '<circle cx="69" cy="69" r="2.6" fill="#4392F1"/><circle cx="72.5" cy="71.5" r="1.6" fill="#33CA7F"/>';
  },
};

// Raw face drawing (no background), for <symbol> definitions.
export function faceMarkup(id) {
  return (FACES[id] || FACES.nav)();
}

// A standalone round avatar <svg>. bg defaults to the character's accent colour.
export function avatar(id, { bg, size } = {}) {
  const c = CHARACTERS[id] || CHARACTERS.nav;
  const dim = size ? ` width="${size}" height="${size}"` : '';
  return `<svg class="avatar" viewBox="0 0 100 100"${dim} aria-label="${c.name}" role="img">` +
    `<defs><clipPath id="av-${id}"><circle cx="50" cy="50" r="50"/></clipPath></defs>` +
    `<g clip-path="url(#av-${id})"><rect width="100" height="100" fill="${bg || c.accent}"/>${faceMarkup(id)}</g></svg>`;
}
