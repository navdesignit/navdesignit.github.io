// The commentator. {a} is whoever did it, {b} whoever it happened to.
export const LINES = {
  delhi: ['Dilli mein swagat hai! AQI 999, phir bhi race 😷', 'Tu jaanta hai mera baap kaun hai? 😎 Chal race kar', 'Sansad chal raha hai, race bhi 🏛️', 'Dilli ki sadak, VIP ki gaadi, hum sab side 😂'],
  start: ['Indore ki galiyon mein swagat hai! 🛺', 'Seat belt? Ye India hai bhai 😂', 'Gaadi bula rahi hai… 🏁', 'Poha kha liya? Chalo race karo 🍛'],
  chappal: ['Mummy ki chappal kabhi miss nahi hoti! 🩴', '{a} ne {b} ko chappal maari! THWACK 🩴', '{b} ko ghar ki yaad aa gayi 🩴', 'Chappal seedha {b} ke sar pe 🩴😵'],
  cooker: ['Teesri seeti… BOOM! 💥', 'Pressure cooker ne {b} ka poha bana diya 💥', '{a} ka cooker phata, {b} udd gaya 💥', 'Dal pak gayi, {b} bhi 💥'],
  paan: ['{b} paan ki peek pe phisal gaya 🤢', 'Peek maar ke bhaag gaya {a} 🤢', 'Indore ki sadak, paan ki peek 🤢'],
  horn: ['PON PON! 📯 {b} ki dhadkan badh gayi', 'Horn OK Please! {a} ne {b} ko hila diya 📯', '{a}: "Side hato!" 📯'],
  bump: ['{a} ke Diwali rocket ne {b} ko uda diya 🚀', 'Rocket ke aage kaun aaya? {b} 🚀'],
  gaay: ['{a} ne gaay chhod di, {b} ruk gaya 🐄', 'Gaay mata ne {b} ko rok diya 🐄🙏'],
  self: ['{b} apne hi jaal mein phas gaya 🤦', 'Khud ka hi maal, khud pe 🤦 {b}!', '{b}: "Ye mera hi tha kya?" 🤦'],
  block: ['Nimbu-mirchi ne nazar utaar di 🍋🌶️', '{b} bach gaya! Nazar battu kaam kar gaya 🍋'],
  cow: ['Gaay mata road pe hai, sab ruk jao 🐄', 'Cow has right of way. Always. 🐄', 'Moooo! 🐄 {b} ko brake lagana pada'],
  pothole: ['Gaddha! Smart city ka gift 🕳️', 'Bhai suspension gaya 🕳️', 'Gaddhe mein Indore ka itihaas hai 🕳️'],
  breaker: ['Speed breaker pe udd gaya! ✈️', 'Dhadaam! Speed breaker 😵', 'Uchhal gaya bhai ✈️'],
  wall: ['Dukaan mein ghus gaya kya? 😂', 'Shutter tod diya! 😂', 'Footpath pe gaadi? Indore style 😂'],
  wrong: ['Ulta ja raha hai bhai! 🔄', 'Galat side! Challan katega 👮', 'Arre U-turn le! 🔄'],
  rocket: ['Diwali rocket chalu! 🚀', '{a} ne rocket jalaya! Sab side ho jao 🚀'],
  chai: ['Cutting chai, full power ☕', '{a} chai pee ke udd gaya ☕'],
  turbo: ['Drift ka jalwa! 🔥', 'Masala boost! 🌶️'],
  rocketstart: ['Rocket start! 🚀 Ekdum perfect timing', 'Lights ke saath bhaag gaya! 🚀'],
  lastlap: ['Aakhri lap! Ab nahi toh kab? 🏁', 'Final lap — jalebi ki tarah ghumo 🌀', 'Last lap, poha thanda ho raha hai 🍛'],
  lead: ['{a} sabse aage! Bhaukaal 😎', '{a} number one! 👑'],
  finishFirst: ['Indore ka King! 👑', 'Pehla number! Poha-jalebi party 🍛'],
  finishLast: ['Sabse peeche… lekin dil se aage ❤️', 'Agli baar bhai, agli baar 😅'],
};

let last = {};
export function say(kind, vars = {}, rng = Math.random) {
  const list = LINES[kind];
  if (!list) return '';
  let i = Math.floor(rng() * list.length);
  if (list.length > 1 && i === last[kind]) i = (i + 1) % list.length;
  last[kind] = i;
  return list[i].replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : ''));
}

export const ITEM_INFO = {
  chappal: { icon: '🩴', name: 'Mummy ki Chappal', tip: 'Homes in on the kart ahead. Never misses.' },
  cooker: { icon: '♨️', name: 'Pressure Cooker', tip: 'Drop it behind. Third seeti = BOOM.' },
  nimbu: { icon: '🍋', name: 'Nimbu-Mirchi', tip: 'Nazar battu: blocks the next hit.' },
  chai: { icon: '☕', name: 'Cutting Chai', tip: 'Instant speed boost.' },
  horn: { icon: '📯', name: 'Pon Pon Horn', tip: 'Shockwave: wobbles everyone near you, clears traps.' },
  paan: { icon: '🌿', name: 'Paan ki Peek', tip: 'A red puddle behind you. Slippery!' },
  rocket: { icon: '🚀', name: 'Diwali Rocket', tip: 'Autopilot boost. Knocks karts aside.' },
  cow: { icon: '🐄', name: 'Gaay Mata', tip: 'A cow parks behind you. Everyone stops.' },
};
