// Two phones, one room, through the Firebase emulator. Phone A makes the room in the UI,
// phone B opens the share link. Both race on autopilot; position updates are held back by
// a simulated phone network (lag + jitter). Both clocks are stepped together so the
// recording is smooth even with software WebGL.
//
// Needs: the site served on http://localhost:8080 (e.g. `npx http-server -p 8080 .` in the
// repo root), the Firebase Database emulator on port 9000 loaded with
// ludo/database.rules.json, Playwright with Chromium, and ffmpeg for the video.
// usage: node race/tests/two-phones.cjs <seconds of video> <out.mp4> [track] [lag] [jitter] [metrics]
// With `metrics` it skips the video and just prints the sync, smoothness and data numbers.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const SECS = Number(process.argv[2] || 30), OUT = process.argv[3], TRACK = process.argv[4] || 'rajwada';
const LAG = process.argv[5] || '120', JIT = process.argv[6] || '60', METRICS = process.argv[7] === 'metrics';
const q = `autopilot=1&step=1&lag=${LAG}&jitter=${JIT}`;
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const phone = async name => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    const p = { name, page, rx: 0, tx: 0, frames: 0, errs: [], counting: false };
    cdp.on('Network.webSocketFrameReceived', e => { if (p.counting) { p.rx += Buffer.byteLength(e.response.payloadData); p.frames++; } });
    cdp.on('Network.webSocketFrameSent', e => { if (p.counting) p.tx += Buffer.byteLength(e.response.payloadData); });
    page.on('pageerror', e => p.errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') p.errs.push(m.text()); });
    return p;
  };
  const A = await phone('A'), B = await phone('B');
  const dir = OUT + '.frames';
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);

  // A: make a room through the UI
  await A.page.goto(`http://localhost:8080/race/?emulator=9000&${q}`);
  await A.page.click('#btn-online');
  await A.page.fill('#name-input', 'Nav');
  await A.page.click('#btn-profile-go');
  await A.page.waitForSelector('#lobby.on', { timeout: 20000 });
  const link = (await A.page.textContent('#share-link')).trim();
  console.log('share link:', link);
  // B: tap the link
  await B.page.goto(`http://${link}&${q}`);
  await B.page.waitForSelector('#profile.on');
  await B.page.fill('#name-input', 'Ajay');
  await B.page.click('#btn-profile-go');
  await B.page.waitForSelector('#lobby.on', { timeout: 20000 });
  await A.page.waitForFunction(() => window.__pp.S.state.players.length === 2);
  await A.page.click(`[data-track="${TRACK}"]`);
  await A.page.click('[data-laps="1"]');
  await B.page.waitForFunction(t => window.__pp.S.state.settings.laps === 1 && window.__pp.S.state.settings.track === t, TRACK);
  await A.page.waitForTimeout(800);
  await A.page.screenshot({ path: OUT.replace('.mp4', '-lobbyA.png') });
  await B.page.screenshot({ path: OUT.replace('.mp4', '-lobbyB.png') });
  // same clock on both phones, then the host taps Start
  const t0 = Date.now();
  for (const p of [A, B]) await p.page.evaluate(t => { window.__pp.clock.t = t; }, t0);
  await A.page.click('#btn-start');
  await A.page.waitForFunction(() => window.__pp.S.race);
  await B.page.waitForFunction(() => window.__pp.S.race, null, { timeout: 20000 });
  const ids = await A.page.evaluate(() => ({ a: window.__pp.S.me, karts: window.__pp.S.race.info.karts.map(k => k.id), runner: window.__pp.S.race.runner }));
  const idsB = await B.page.evaluate(() => ({ b: window.__pp.S.me, runner: window.__pp.S.race.runner }));
  console.log('karts', ids.karts.join(','), 'runner A', ids.runner, 'runner B', idsB.runner);
  A.counting = B.counting = true;
  const track = { aSeesB: [], bTrue: [], bSeesA: [], aTrue: [] };
  const sample = (p, other) => p.page.evaluate(o => {
    const r = window.__pp.race;
    const v = window.__pp.R.karts.get(o).root.position;
    return { t: r.W.time, ox: v.x, oz: v.z, mx: r.mine.x, mz: r.mine.z, P: r.mine.P, done: r.mine.done, rx: r.rx || 0 };
  }, other);
  const N = Math.round(SECS * 30);
  let i = 0;
  for (; ; i++) {
    if (i === 0 && METRICS) for (const p of [A, B]) await p.page.evaluate(() => { window.__pp.app.noRender = true; });
    if (i === N) for (const p of [A, B]) await p.page.evaluate(() => { window.__pp.app.noRender = true; });
    const per = i < N ? 1 : 3; // after the clip: fast-forward without drawing
    for (const p of [A, B]) await p.page.evaluate(n => { for (let k = 0; k < n; k++) window.__pp.step(1000 / 30); }, per);
    await A.page.waitForTimeout(5); // let the emulator deliver
    const sa = await sample(A, idsB.b), sb = await sample(B, ids.a);
    if (i < N) track.aSeesB.push([sa.t, sa.ox, sa.oz]); if (i < N) track.bTrue.push([sb.t, sb.mx, sb.mz]);
    if (i < N) track.bSeesA.push([sb.t, sb.ox, sb.oz]); if (i < N) track.aTrue.push([sa.t, sa.mx, sa.mz]);
    var lastT = sa.t;
    if (i < N && !METRICS) {
      await A.page.screenshot({ path: `${dir}/a${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 80 });
      await B.page.screenshot({ path: `${dir}/b${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 80 });
    }
    if (i % 100 === 0) console.log('frame', i, 't', sa.t.toFixed(1), 'A P', sa.P.toFixed(0), 'rx', sa.rx, sb.rx);
    const scr = await A.page.evaluate(() => window.__pp.S.screen);
    const scrB = await B.page.evaluate(() => window.__pp.S.screen);
    if (scr === 'podium' && scrB === 'podium') break;
    if (i > 30 * 120) { console.log('timeout'); break; }
  }
  A.counting = B.counting = false;
  const raceSecs = lastT + 5.2;
  for (const p of [A, B]) await p.page.evaluate(() => { window.__pp.app.noRender = false; });
  for (let k = 0; k < 45; k++) for (const p of [A, B]) await p.page.evaluate(() => window.__pp.step(1000 / 30));
  await A.page.screenshot({ path: OUT.replace('.mp4', '-podiumA.png') });
  await B.page.screenshot({ path: OUT.replace('.mp4', '-podiumB.png') });
  const resA = await A.page.evaluate(() => window.__pp.S.state.race.fin);
  const resB = await B.page.evaluate(() => window.__pp.S.state.race.fin);
  // smoothness: how much the drawn path of the other kart wobbles frame to frame,
  // compared with that kart's own true path
  const wobble = path => {
    const a = [];
    for (let k = 2; k < path.length; k++) {
      if (path[k][0] < 0.5) continue;
      const ax = path[k][1] - 2 * path[k - 1][1] + path[k - 2][1], az = path[k][2] - 2 * path[k - 1][2] + path[k - 2][2];
      a.push(Math.hypot(ax, az) * 900); // m/s² at 30 fps
    }
    a.sort((x, y) => x - y);
    return { p50: a[a.length >> 1].toFixed(1), p95: a[Math.floor(a.length * 0.95)].toFixed(1), max: a[a.length - 1].toFixed(1) };
  };
  const jitter = path => {
    const d = [];
    for (let k = 2; k < path.length - 2; k++) {
      if (path[k][0] < 0.5) continue;
      const mx = (path[k - 2][1] + path[k - 1][1] + path[k + 1][1] + path[k + 2][1]) / 4, mz = (path[k - 2][2] + path[k - 1][2] + path[k + 1][2] + path[k + 2][2]) / 4;
      d.push(Math.hypot(path[k][1] - mx, path[k][2] - mz) * 100);
    }
    d.sort((x, y) => x - y);
    return { p50cm: d[d.length >> 1].toFixed(2), p95cm: d[Math.floor(d.length * 0.95)].toFixed(2), maxcm: d[d.length - 1].toFixed(1) };
  };
  const gap = (seen, truth) => {
    const d = seen.map((s, k) => Math.hypot(s[1] - truth[k][1], s[2] - truth[k][2])).filter((_, k) => seen[k][0] > 1);
    d.sort((x, y) => x - y);
    return { p50: d[d.length >> 1].toFixed(2), p95: d[Math.floor(d.length * 0.95)].toFixed(2) };
  };
  const report = {
    frames: i, raceSeconds: raceSecs.toFixed(1),
    aSeesB_wobble: wobble(track.aSeesB), bTrue_wobble: wobble(track.bTrue),
    bSeesA_wobble: wobble(track.bSeesA), aTrue_wobble: wobble(track.aTrue),
    aSeesB_metresBehindTruth: gap(track.aSeesB, track.bTrue),
    jitter_aSeesB: jitter(track.aSeesB), jitter_bTrue: jitter(track.bTrue), jitter_bSeesA: jitter(track.bSeesA), jitter_aTrue: jitter(track.aTrue),
    bytes: { A_rx: A.rx, A_tx: A.tx, B_rx: B.rx, B_tx: B.tx, A_frames: A.frames },
    perPhoneKBps: ((A.rx + A.tx + B.rx + B.tx) / 2 / raceSecs / 1024).toFixed(2),
    finishTimesA: resA, finishTimesB: resB, errors: [...A.errs, ...B.errs].slice(0, 8),
  };
  console.log(JSON.stringify(report, null, 1));
  fs.writeFileSync(OUT.replace('.mp4', '-report.json'), JSON.stringify({ report, track }, null, 0));
  await browser.close();
  if (METRICS) { fs.rmSync(dir, { recursive: true, force: true }); return; }
  const n = Math.min(N, i);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', `${dir}/a%05d.jpg`, '-framerate', '30', '-i', `${dir}/b%05d.jpg`,
    '-filter_complex', '[0:v]scale=390:844[a];[1:v]scale=390:844[b];[a]pad=400:844:0:0:color=black[ap];[ap][b]hstack=inputs=2', '-frames:v', String(n),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', OUT]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('wrote', OUT);
})();
