// ---------------------------------------------------------------- Signature (chosen direction)
// A 3-colour e-ink panel: black, paper, one red. Giant numerals, small technical labels,
// registration marks. Red always means "act now"; on a black-and-white panel it prints black.
const RED = '#c8102e';
// Tiles are placed by position, as seen from the front with the lid open:
// 0 back-left, 1 back-right, 2 front-left, 3 front-right. The carer picks each one's form.
window.FORMS = [3, 1, 0, 2]; // bottle, blister, sachets, sticks-and-drops
const POS = () => (window.LANG === 'en' ? ['BACK L', 'BACK R', 'FRONT L', 'FRONT R'] : ['뒤 왼쪽', '뒤 오른쪽', '앞 왼쪽', '앞 오른쪽']);
const FORMNAME = () => (window.LANG === 'en' ? ['SACHETS', 'BLISTER', 'STICKS · DROPS', 'BOTTLE'] : ['약봉투', '블리스터', '스틱 · 안약', '영양제']);
const icon = (i, x, y, s, col) => ICON[window.FORMS[i]](x, y, s, col);
const posOf = (form) => window.FORMS.indexOf(form);
// Example schedule by form: morning all; lunch sachets; evening sachets, blister, bottle; bedtime sticks, bottle.
const NEED = [[0, 1, 2, 3], [0], [0, 1, 3], [2, 3]];
const due = (slot) => [0, 1, 2, 3].map((i) => NEED[slot].includes(window.FORMS[i]));

function label(s, x, y, size = 8.5, align = 'left', col = INK) { ctx.letterSpacing = size * 0.12; txt(s, x, y, size, 700, align, col, NUM); ctx.letterSpacing = 0; }
function marks() { pen(INK, 1); for (const [x, y] of [[8, 8], [392, 8], [8, 292], [392, 292]]) { ln(x - 4, y, x + 4, y); ln(x, y - 4, x, y + 4); } }
function rule(x1, y, x2) { pen(INK, 1); ln(x1, y, x2, y); }
function top(mid, right) { marks(); label('LYRA', 16, 22); if (mid) label(mid, 200, 22, 8.5, 'center'); if (right) label(right, 384, 22, 8.5, 'right'); }
function sTile(i, st, x, y, w, h, o = {}) {
  const s = Math.min(w, h), code = POS()[i];
  if (st === 'due') { ctx.fillStyle = RED; rr(x, y, w, h, 4); ctx.fill(); icon(i, x + w / 2, y + h * .52, s * .5, PAPER); label(code, x + 7, y + 13, 7.5, 'left', PAPER); }
  else if (st === 'done') { pen(INK, 1.5); rr(x + .75, y + .75, w - 1.5, h - 1.5, 4); ctx.stroke(); icon(i, x + w / 2, y + h * .48, s * .42, INK); label(code, x + 7, y + 13, 7.5); check(x + w - 14, y + h - 13, 12); if (o.at) label(o.at, x + 7, y + h - 8, 8); }
  else if (st === 'missed') { pen(INK, 1.5); rr(x + .75, y + .75, w - 1.5, h - 1.5, 4); ctx.stroke(); icon(i, x + w / 2, y + h * .5, s * .42, INK); label(code, x + 7, y + 13, 7.5); pen(RED, 5); ln(x + 10, y + h - 10, x + w - 10, y + 10); }
  else if (st === 'ghost') { pen(RED, 2.5); ctx.setLineDash([6, 4]); rr(x + 1.25, y + 1.25, w - 2.5, h - 2.5, 4); ctx.stroke(); ctx.setLineDash([]); icon(i, x + w * .4, y + h * .52, s * .4, DITHER); label(code, x + 7, y + 13, 7.5, 'left', RED); arrow(x + w - 20, y + 20, x + w - 20, y + h - 18, RED, 4); }
  else if (st === 'focus') { pen(INK, 4); rr(x + 2, y + 2, w - 4, h - 4, 4); ctx.stroke(); icon(i, x + w / 2, y + h * .5, s * .44, INK); label(code, x + 8, y + 15, 7.5); }
  else if (st === 'plain') { pen(INK, 1.5); rr(x + .75, y + .75, w - 1.5, h - 1.5, 4); ctx.stroke(); icon(i, x + w / 2, y + h * .52, s * .46, INK); label(code, x + 7, y + 13, 7.5); }
  else { pen(INK, 1); ctx.setLineDash([1.5, 3]); rr(x + .5, y + .5, w - 1, h - 1, 4); ctx.stroke(); ctx.setLineDash([]); icon(i, x + w / 2, y + h * .52, s * .36, DITHER); label(code, x + 7, y + 13, 7.5, 'left', DITHER); }
}
function sGrid(states, x, y, s, gap = 6, o = {}) { for (let i = 0; i < 4; i++) sTile(i, states[i], x + (i % 2) * (s + gap), y + Math.floor(i / 2) * (s + gap), s, s, { at: (o.at || [])[i] }); }
function sMini(states, x, y, w = 16, h = 12, g = 3) {
  for (let i = 0; i < 4; i++) { const tx = x + (i % 2) * (w + g), ty = y + Math.floor(i / 2) * (h + g); const st = states[i];
    if (st === 'due') { ctx.fillStyle = RED; rr(tx, ty, w, h, 2); ctx.fill(); } else if (st === 'on') { ctx.fillStyle = INK; rr(tx, ty, w, h, 2); ctx.fill(); } else if (st === 'done') { pen(INK, 1.2); rr(tx + .6, ty + .6, w - 1.2, h - 1.2, 2); ctx.stroke(); check(tx + w / 2, ty + h / 2, h * .7); } else { pen(INK, 1); ctx.setLineDash([1.5, 2.5]); rr(tx + .5, ty + .5, w - 1, h - 1, 2); ctx.stroke(); ctx.setLineDash([]); } }
}
function ribbon(x, y, w, now, doses, band) { // the day as one line; dose times as beads
  const X = (m) => x + (m / 1440) * w;
  if (band) { ctx.fillStyle = DITHER; ctx.fillRect(X(band[0]), y - 6, X(band[1]) - X(band[0]), 12); }
  pen(INK, 1); ln(x, y, x + w, y); for (let hr = 0; hr <= 24; hr += 6) ln(X(hr * 60), y - 3, X(hr * 60), y + 3);
  pen(INK, 3); ln(x, y, X(now), y);
  for (const [m, st] of doses) { const cx = X(m); if (st === 'due') { ctx.fillStyle = RED; circ(cx, y, 5.5, true); } else if (st === 'done') { ctx.fillStyle = INK; circ(cx, y, 4.5, true); } else if (st === 'missed') { ctx.fillStyle = PAPER; circ(cx, y, 5, true); pen(RED, 2); circ(cx, y, 4.5, false); ln(cx - 3, y + 3, cx + 3, y - 3); } else { ctx.fillStyle = PAPER; circ(cx, y, 4.5, true); pen(INK, 1.5); circ(cx, y, 4.5, false); } }
}
function ribbonScale(x, y, w) { label('00', x, y, 7); label('12', x + w / 2, y, 7, 'center'); label('24', x + w, y, 7, 'right'); }
const SLOTM = [510, 750, 1110, 1320];
const DAY = (st) => SLOTM.map((m, k) => [m, st[k]]);
const streak = (x, y, miss, today = 29) => { for (let d = 0; d < 30; d++) { const cx = x + (d % 10) * 13, cy = y + Math.floor(d / 10) * 13; if (miss.includes(d)) { pen(INK, 1.2); rr(cx + .6, cy + .6, 9.8, 9.8, 1.5); ctx.stroke(); } else { ctx.fillStyle = d === today ? RED : INK; rr(cx, cy, 11, 11, 1.5); ctx.fill(); } } };
const SL = () => (window.LANG === 'en' ? ['MORNING', 'LUNCH', 'EVENING', 'BEDTIME'] : ['아침', '점심', '저녁', '자기 전']);
const map = (slot, over = {}) => [0, 1, 2, 3].map((i) => over[i] || (due(slot)[i] ? 'due' : 'none'));

function ambientSig({ time, dateL, weatherL, dust, next, nextSlot, now, doses, mask }) {
  top('', weatherL); label(dateL, 200, 22, 8.5, 'center');
  num(time, 14, 132, 104, 800);
  rule(16, 150, 384);
  label(L('30일', '30 DAYS'), 16, 170); streak(16, 180, [6, 17]); num('28/30', 16, 244, 22, 800);
  label(L('미세먼지', 'FINE DUST'), 170, 170);
  for (let i = 0; i < 4; i++) { const on = i < dust; ctx.fillStyle = on ? (dust === 4 ? RED : INK) : PAPER; pen(INK, 1.2); rr(170 + i * 22, 180, 19, 10, 1.5); if (on) ctx.fill(); else ctx.stroke(); }
  txt(['', '좋음', '보통', '나쁨', '매우나쁨'][dust], 170, 214, 18, 900, 'left', dust === 4 ? RED : INK);
  if (mask) label(L('외출 시 마스크', 'MASK OUTSIDE'), 170, 232, 8.5, 'left', RED);
  label(L('다음', 'NEXT'), 300, 170); num(next, 300, 196, 22, 800); sMini(map(nextSlot).map((s) => (s === 'due' ? 'on' : s)), 300, 206);
  ribbon(16, 272, 368, now, doses); ribbonScale(16, 290, 368);
}

SCREENS['S01-resting'] = () => ambientSig({ time: '14:20', dateL: L('9월 26일 토', 'SAT 26 SEP'), weatherL: L('24° · 맑음', '24° · CLEAR'), dust: 1, next: '18:30', nextSlot: 2, now: 860, doses: DAY(['done', 'done', 'up', 'up']) });
SCREENS['S02-resting-dust'] = () => ambientSig({ time: '07:10', dateL: L('9월 26일 토', 'SAT 26 SEP'), weatherL: L('3° · 흐림', '3° · CLOUD'), dust: 4, mask: true, next: '08:30', nextSlot: 0, now: 430, doses: DAY(['up', 'up', 'up', 'up']) });
SCREENS['S03-near-next'] = () => {
  top(L('다가오면', 'NEAR'), '14:22');
  label(L('다음 · ' + SL()[2], 'NEXT · ' + SL()[2]), 16, 52, 9);
  num('18:30', 12, 140, 84, 800);
  label(L('남은 시간', 'IN'), 16, 172, 9); num(L('4시간 8분', '4H 08M'), 16, 204, 26, 800, 'left', RED);
  sGrid(map(2).map((s) => (s === 'due' ? 'plain' : s)), 268, 36, 55, 6);
  label(L('열 칸 3', '3 TO OPEN'), 268, 170, 8.5);
  ribbon(16, 262, 368, 862, DAY(['done', 'done', 'up', 'up'])); ribbonScale(16, 280, 368);
};
SCREENS['S04-due'] = () => {
  top(L('아침 · 08:30', 'MORNING · 08:30'), '08:32');
  sGrid(map(0), 16, 32, 124, 8);
  num('4', 330, 170, 140, 800, 'center', RED); label(L('열 칸', 'TO OPEN'), 330, 196, 10, 'center');
  ribbon(282, 262, 100, 512, DAY(['due', 'up', 'up', 'up'])); label('00', 282, 280, 7); label('24', 382, 280, 7, 'right');
};
SCREENS['S05-partial'] = () => {
  top(L('아침 · 08:30', 'MORNING · 08:30'), '08:42');
  sGrid(map(0, { 2: 'done', 1: 'done' }), 16, 32, 124, 8, { at: [0, '08:42', '08:41'] });
  num('2', 330, 170, 140, 800, 'center', RED); label(L('남은 칸', 'LEFT'), 330, 196, 10, 'center');
  ribbon(282, 262, 100, 522, DAY(['due', 'up', 'up', 'up'])); label('00', 282, 280, 7); label('24', 382, 280, 7, 'right');
};
SCREENS['S06-done'] = () => {
  top(L('아침 완료', 'MORNING DONE'), '08:45');
  ctx.fillStyle = RED; circ(110, 152, 86, true); check(110, 154, 90, PAPER);
  num(L('29일째', 'DAY 29'), 222, 118, 38, 800); label(L('연속으로 제때', 'IN A ROW, ON TIME'), 224, 140, 9);
  rule(222, 166, 384);
  label(L('다음 · 점심', 'NEXT · LUNCH'), 222, 188); num('12:30', 222, 222, 32, 800); sMini(map(1).map((s) => (s === 'due' ? 'on' : s)), 332, 198, 20, 14, 3);
  ribbon(222, 262, 162, 525, DAY(['done', 'up', 'up', 'up']));
};
SCREENS['S07-not-now'] = () => {
  const b = posOf(3);
  top(L('지금은 아니에요', 'NOT NOW'), '12:32');
  sGrid([0, 1, 2, 3].map((i) => (i === b ? 'focus' : 'none')), 16, 32, 124, 8);
  label(L('이 칸의 다음', 'THIS ONE NEXT'), 282, 64, 8.5); slotIcon(2, 294, 92, 12); label(SL()[2], 312, 97, 9);
  num('18:30', 280, 150, 44, 800);
  label(L('알림 없음', 'NO ALARM'), 282, 180, 8.5); label(L('기록됨', 'LOGGED'), 282, 196, 8.5);
};
SCREENS['S08-leaving'] = () => {
  const f = posOf(0);
  top(L('나가시네요', 'LEAVING'), '11:50');
  door(22, 48, 60, 120); arrow(96, 110, 128, 110, RED, 3);
  sGrid([0, 1, 2, 3].map((i) => (i === f ? 'due' : 'none')), 140, 36, 60, 5);
  num('12:30', 268, 88, 36, 800); label(L('점심', 'LUNCH'), 270, 106, 9);
  rule(16, 190, 384);
  txt(L('점심 약 챙겨 가세요', 'Take your lunch sachet'), 16, 226, 26, 900);
  label(L(FORMNAME()[0] + ' · ' + POS()[f], FORMNAME()[0] + ' · ' + POS()[f]), 16, 250, 9, 'left', RED);
  ribbon(16, 278, 368, 710, DAY(['done', 'due', 'up', 'up']), [630, 900]);
};
SCREENS['S09-put-back'] = () => {
  const b = posOf(3);
  top(L('제자리에', 'PUT IT BACK'), '18:33');
  sGrid([0, 1, 2, 3].map((i) => (i === b ? 'ghost' : 'none')), 16, 32, 124, 8);
  num('10', 330, 150, 110, 800, 'center', RED); label(L('분째 밖에', 'MIN OUT'), 330, 176, 10, 'center');
  label(FORMNAME()[3] + ' · ' + POS()[b], 330, 206, 8.5, 'center');
};
SCREENS['S10-missed'] = () => {
  const bl = posOf(1);
  top(L('저녁 · 끝남', 'EVENING · CLOSED'), '21:31');
  const st = map(2, { [posOf(0)]: 'done', [posOf(3)]: 'done', [bl]: 'missed' });
  sGrid(st, 16, 32, 124, 8, { at: [0, 0, 0, 0].map((_, i) => (st[i] === 'done' ? (i === posOf(0) ? '18:35' : '18:36') : '')) });
  num('1', 330, 150, 110, 800, 'center', RED); label(L('놓친 칸', 'MISSED'), 330, 176, 10, 'center');
  label(L('지은님께 알림', 'JI-EUN TOLD'), 330, 206, 8.5, 'center'); label(L('1회만', 'ONCE'), 330, 222, 8.5, 'center');
  ribbon(282, 262, 100, 1291, DAY(['done', 'done', 'missed', 'up'])); label('00', 282, 280, 7); label('24', 382, 280, 7, 'right');
};
SCREENS['S11-night'] = () => {
  top(L('9월 26일 토', 'SAT 26 SEP'), L('17° · 흐림', '17° · CLOUD'));
  num('23:20', 14, 132, 104, 800);
  rule(16, 150, 384);
  check(34, 196, 34); num('10/10', 66, 208, 34, 800); label(L('오늘 연 칸', 'OPENED TODAY'), 68, 228, 9);
  label(L('내일 · 아침', 'TOMORROW · MORNING'), 250, 176); num('08:30', 250, 212, 30, 800);
  ribbon(16, 272, 368, 1400, DAY(['done', 'done', 'done', 'done'])); ribbonScale(16, 290, 368);
};
SCREENS['S12-supply'] = () => {
  const f = posOf(0);
  top(FORMNAME()[0] + ' · ' + POS()[f], '07:55');
  num('3', 14, 190, 180, 800, 'left', RED);
  label(L('일분 남음', 'DAYS LEFT'), 132, 76, 12); txt(L('월요일에 약국', 'Pharmacy on Monday'), 132, 104, 20, 900);
  for (let i = 0; i < 14; i++) { const x = 132 + i * 18; if (i < 3) { ctx.fillStyle = RED; rr(x, 124, 14, 40, 2); ctx.fill(); } else { pen(INK, 1); ctx.setLineDash([1.5, 2.5]); rr(x + .5, 124.5, 13, 39, 2); ctx.stroke(); ctx.setLineDash([]); } }
  label('0', 132, 178, 7); label(L('14일', '14 D'), 382, 178, 7, 'right');
  rule(16, 214, 384);
  label(L('계산', 'MATH'), 16, 234); txt('13.4 g ÷ 4.47 g/' + L('일', 'day') + ' = 3.0', 16, 258, 15, 700, 'left', INK, NUM);
  sachet(344, 256, 40, INK);
};
SCREENS['S13-outing'] = () => {
  const f = posOf(0);
  top(L('화요일 · 배운 습관', 'TUESDAY · LEARNED'), '10:00');
  label(L('보통 외출', 'USUALLY OUT'), 16, 52, 9); num('10:30–15:00', 14, 96, 40, 800);
  label(L('지난 4주 중 3주', '3 OF THE LAST 4 TUESDAYS'), 16, 116, 8.5);
  ribbon(16, 150, 368, 600, DAY(['done', 'due', 'up', 'up']), [630, 900]); ribbonScale(16, 168, 368);
  rule(16, 186, 384);
  txt(L('점심 약 챙기기', 'Pack your lunch sachet'), 16, 224, 26, 900);
  label(L('점심 12:30은 외출 중', 'LUNCH 12:30 FALLS INSIDE'), 16, 246, 9, 'left', RED);
  sMini([0, 1, 2, 3].map((i) => (i === f ? 'due' : 'none')), 330, 206, 22, 16, 4);
};
SCREENS['S14-week'] = () => {
  top(L('이번 주', 'THIS WEEK'), L('일 07:10', 'SUN 07:10'));
  num('96', 14, 150, 128, 800); txt('%', 150, 150, 40, 900, 'left', INK, NUM);
  label(L('제때 연 칸 67 / 70', 'OPENED ON TIME 67 / 70'), 18, 176, 9);
  const m = [[1, 1, 1, 1, 1, 1, 1], [2, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 2, 1, 2]];
  const days = L('일월화수목금토', 'SMTWTFS');
  for (let d = 0; d < 7; d++) label(days[d], 228 + d * 22, 46, 8, 'center');
  for (let r = 0; r < 4; r++) { slotIcon(r, 206, 64 + r * 28, 7); for (let d = 0; d < 7; d++) { const x = 228 + d * 22, y = 64 + r * 28; if (m[r][d] === 1) { ctx.fillStyle = INK; circ(x, y, 8, true); } else { ctx.fillStyle = RED; circ(x, y, 8, true); ctx.fillStyle = PAPER; circ(x, y, 3, true); } } }
  rule(16, 200, 384);
  label(L('습관', 'PATTERN'), 16, 220); txt(L('일요일 점심은 외출 중에 놓쳐요', 'Sunday lunch is missed while out'), 16, 244, 16, 900);
  label(L('제안', 'SUGGESTION'), 16, 268); txt(L('일요일엔 점심 약을 챙겨 나가세요', 'Pack the lunch sachet on Sundays'), 16, 288, 14, 500);
};
SCREENS['S15-button-today'] = () => {
  top(L('버튼 · 오늘', 'BUTTON · TODAY'), '16:40');
  const at = { 0: [['08:38', 0], [null, 2], [null, 3]], 1: [['08:39', 0], [null, 2]], 2: [['08:40', 0], ['12:38', 1], [null, 2]], 3: [['08:41', 0], [null, 3]] };
  for (let i = 0; i < 4; i++) {
    const x = 16 + (i % 2) * 188, y = 32 + Math.floor(i / 2) * 132, w = 180, h = 124;
    pen(INK, 1.5); rr(x + .75, y + .75, w - 1.5, h - 1.5, 4); ctx.stroke(); label(POS()[i], x + 8, y + 15, 7.5); icon(i, x + 30, y + 48, 34, INK);
    at[i].forEach(([t, k], r) => { const ry = y + 42 + r * 26; slotIcon(k, x + 76, ry - 5, 8); if (t) { num(t, x + 94, ry + 1, 16, 800); check(x + 164, ry - 5, 12); } else { pen(INK, 1.5); circ(x + 164, ry - 5, 5.5, false); label(L('예정', 'LATER'), x + 94, ry, 8, 'left', DITHER); } });
  }
};
SCREENS['S16-button-refill'] = () => {
  top(L('버튼 3초 · 채우기', 'HOLD 3 S · REFILL'), '');
  sGrid([0, 1, 2, 3].map((i) => (i === posOf(0) || i === posOf(3) ? 'plain' : 'none')), 16, 32, 124, 8);
  for (const [i, g] of [[posOf(0), '+42 g'], [posOf(3), '+118 g']]) { const x = 16 + (i % 2) * 132, y = 32 + Math.floor(i / 2) * 132; ctx.fillStyle = PAPER; ctx.fillRect(x + 60, y + 96, 60, 22); num(g, x + 118, y + 114, 15, 800, 'right', RED); }
  num('2', 330, 150, 110, 800, 'center'); label(L('채운 칸', 'REFILLED'), 330, 176, 10, 'center');
  label(L('기록 안 함', 'NOT COUNTED'), 330, 206, 8.5, 'center'); label(L('한 번 누르면 끝', 'PRESS TO FINISH'), 330, 222, 8.5, 'center');
};

window.sigBoard = () => {
  const names = Object.keys(SCREENS).filter((n) => n.startsWith('S'));
  const caps = { 'S01-resting': 'Resting', 'S02-resting-dust': 'Resting, very bad air', 'S03-near-next': 'Someone near, nothing due', 'S04-due': 'Dose time: red = open', 'S05-partial': 'Count drops as tiles are opened', 'S06-done': 'Done, days in a row', 'S07-not-now': 'Opened when not due', 'S08-leaving': 'Leaving near a dose time', 'S09-put-back': 'Container out 10 min', 'S10-missed': 'Dose time closed, one missed', 'S11-night': 'Night, all done', 'S12-supply': 'AI: sachets running out', 'S13-outing': 'AI: learned outing', 'S14-week': 'AI: the week', 'S15-button-today': 'Button press: today', 'S16-button-refill': 'Button hold: refill' };
  const bodies = Object.fromEntries(names.map((n) => [n, content(n)]));
  const H = 200 + 4 * 390;
  reset(1760, H); ctx.out = [];
  txt('Lyra · Signature', 60, 90, 44, 900, 'left', INK, NUM);
  txt(L('3색 전자잉크 (검정, 종이, 빨강) · 빨강은 언제나 "지금 하세요"', '3-colour e-ink (black, paper, red) · red always means "do this now"'), 62, 126, 18, 500);
  names.forEach((n, i) => frame(64 + (i % 4) * 424, 170 + Math.floor(i / 4) * 390, bodies[n], String(i + 1).padStart(2, '0') + ' · ' + caps[n]));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1760 ${H}" width="1760" height="${H}"><rect width="1760" height="${H}" fill="#f4f3ef"/>${ctx.out.join('')}</svg>`;
};
