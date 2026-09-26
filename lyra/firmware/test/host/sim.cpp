// Lyra OS host test + simulation.
//
//   make -C test/host run
//
// Part 1 checks the bay detector against scripted weight traces.
// Part 2 prints the pill-count confidence table used in the design spec.
// Part 3 simulates five weeks of a person living with Lyra (three medicines,
// real-ish habits, a double dose, an away day, a weekend habit and a routine
// drift) and checks that Lyra's results come out right.
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <random>
#include <vector>

#include "lyra/bay_detector.h"
#include "lyra/dose_engine.h"
#include "lyra/insights.h"

using namespace lyra;

static int g_fail = 0;
#define CHECK(cond, ...)                         \
  do {                                           \
    if (cond) {                                  \
      std::printf("  ok    ");                   \
    } else {                                     \
      std::printf("  FAIL  ");                   \
      ++g_fail;                                  \
    }                                            \
    std::printf(__VA_ARGS__);                    \
    std::printf("\n");                           \
  } while (0)

static std::mt19937 rng(std::getenv("LYRA_SEED") ? std::atoi(std::getenv("LYRA_SEED")) : 42);
static float gauss(float s) { return std::normal_distribution<float>(0, s)(rng); }

// Feed `secs` seconds of a constant weight (+noise) at 10 Hz; return the
// first non-None event.
static BayEvent feed(BayDetector& d, float g, float secs, uint32_t& t_ms, float noise = 0.02f) {
  BayEvent got;
  for (int i = 0; i < static_cast<int>(secs * 10); ++i) {
    t_ms += 100;
    BayEvent e = d.push(g + gauss(noise), t_ms);
    if (got.kind == BayEventKind::None && e.kind != BayEventKind::None) got = e;
  }
  return got;
}

// A realistic "take pills" interaction: lift, hold off the bay, put back.
// Each put-down lands slightly differently on the cell (placement error, 1σ).
static float g_place = 0.02f;
static BayEvent liftAndReturn(BayDetector& d, float before, float after, uint32_t& t_ms) {
  (void)before;
  feed(d, 0.0f, 6, t_ms);                            // container in hand
  feed(d, after + 25.0f, 0.3f, t_ms, 8.0f);           // put down with a thump
  return feed(d, after + gauss(g_place), 3, t_ms);    // settles
}

static void testDetector() {
  std::printf("\n[1] Bay detector\n");
  uint32_t t = 0;
  BayDetector d;
  d.setPillWeight(0.35f);

  BayEvent e = feed(d, 40.0f, 3, t);
  CHECK(e.kind == BayEventKind::Placed, "container placed -> Placed (%.2f g)", e.after_g);

  e = liftAndReturn(d, 40.0f, 40.0f - 2 * 0.35f, t);
  CHECK(e.kind == BayEventKind::Removed && e.pills == 2, "lift, take 2 x 350 mg -> Removed %d pills, confidence %d%%", e.pills,
        e.confidence);

  const float w = d.settledWeight();
  e = liftAndReturn(d, w, w, t);
  CHECK(e.kind == BayEventKind::NoChange, "lift and put back untouched -> NoChange");

  // Direct pick from an open organiser: hand presses, then 1 pill less.
  const float w2 = d.settledWeight();
  feed(d, w2 + 60.0f, 0.5f, t, 20.0f);
  e = feed(d, w2 - 0.35f, 3, t);
  CHECK(e.kind == BayEventKind::Removed && e.pills == 1, "direct pick without lifting -> Removed %d pill", e.pills);

  const float w3 = d.settledWeight();
  e = liftAndReturn(d, w3, w3 + 30 * 0.35f, t);
  CHECK(e.kind == BayEventKind::Added && e.pills == 30, "refill 30 pills -> Added %d pills (conf %d%%)", e.pills, e.confidence);

  // Container carried away and forgotten.
  BayEvent lifted = feed(d, 0.0f, 1, t);
  CHECK(lifted.kind == BayEventKind::Lifted, "lifted -> Lifted");
  BayEvent left;
  for (int i = 0; i < 11 * 60 && left.kind == BayEventKind::None; ++i) left = feed(d, 0.0f, 1, t);
  CHECK(left.kind == BayEventKind::LeftOff, "off the bay for 10 min -> LeftOff");

  // Knocks while stable must not create events.
  BayDetector k;
  uint32_t tk = 0;
  feed(k, 50.0f, 3, tk);
  int spurious = 0;
  for (int i = 0; i < 20; ++i) {
    BayEvent x = feed(k, 50.0f + (i % 2 ? 4.0f : -4.0f), 0.2f, tk, 2.0f);
    BayEvent y = feed(k, 50.0f, 2, tk);
    if (x.kind != BayEventKind::None || (y.kind != BayEventKind::None && y.kind != BayEventKind::NoChange)) ++spurious;
  }
  CHECK(spurious == 0, "20 knocks on the tray -> %d dose events", spurious);
}

// What happens to a real dose, by pill weight. Monte-Carlo through the full
// detector (noise 20 mg/sample, 20 mg per put-down, 4 % pill spread).
//   counted : right count, confidence >= 90 -> recorded silently
//   asked   : no change or confidence < 90 -> "Did you take it?" (1 knob press)
//   wrong   : wrong count with confidence >= 90 -> the dangerous case
// Pills under 150 mg are always confirmed by knob in the engine, whatever this says.
static void confidenceTable(float place) {
  g_place = place;
  BayDetector::Config cfg;
  cfg.place_g = place;
  std::printf("\n[2] Dose outcome by pill weight, placement error %.0f mg (Monte-Carlo, 2000 doses per cell)\n", place * 1000);
  std::printf("      pill   | 1 pill: counted  asked  wrong | 2 pills: counted  asked  wrong\n");
  for (float p : {0.08f, 0.10f, 0.12f, 0.15f, 0.20f, 0.25f, 0.30f, 0.50f}) {
    std::printf("   %4.0f mg  |", p * 1000);
    for (int n = 1; n <= 2; ++n) {
      int counted = 0, asked = 0, wrong = 0;
      const int kTrials = 2000;
      for (int i = 0; i < kTrials; ++i) {
        BayDetector d(cfg);
        d.setPillWeight(p);
        uint32_t t = 0;
        feed(d, 35.0f, 2, t);
        float taken = 0;
        for (int j = 0; j < n; ++j) taken += p * (1 + gauss(0.04f));
        BayEvent e = liftAndReturn(d, 35.0f, 35.0f - taken, t);
        if (e.kind != BayEventKind::Removed || e.confidence < ScheduleConfig{}.silent_confidence) ++asked;
        else if (e.pills == n) ++counted;
        else ++wrong;
      }
      std::printf("        %5.1f%% %5.1f%% %5.2f%% |", 100.0 * counted / kTrials, 100.0 * asked / kTrials, 100.0 * wrong / kTrials);
    }
    std::printf("\n");
  }
}

// ---------------------------------------------------------------------------
struct SimMed {
  const char* name;
  int bay;
  uint8_t per_slot[kSlots];
  float pill_g;
  float tare_g;
  int stock;
  bool calibrate;  // 10 pills weighed at setup (Metformin skips it: learned from doses)
};

static void simulate() {
  std::printf("\n[3] Five weeks with Lyra\n");
  SimMed sm[] = {
      {"Metformin 500", 0, {1, 0, 1, 0}, 0.62f, 24.0f, 60, false},
      {"Amlodipine 5", 1, {1, 0, 0, 0}, 0.20f, 18.0f, 40, true},
      {"Levothyroxine 50", 2, {0, 0, 0, 1}, 0.10f, 18.0f, 40, true},
  };
  const int nmed = 3;
  const int kDays = 35;
  const int kDay0Weekday = 0;  // day 0 is a Monday

  DoseEngine eng;
  BayDetector det[kBays];
  float weight[kBays] = {};
  int stock[kBays] = {};
  for (int i = 0; i < nmed; ++i) {
    Medicine& m = eng.med(i);
    std::snprintf(m.name, sizeof m.name, "%s", sm[i].name);
    m.active = true;
    m.bay = static_cast<uint8_t>(sm[i].bay);
    std::memcpy(m.per_slot, sm[i].per_slot, kSlots);
    m.stock_pills = static_cast<float>(sm[i].stock);  // entered once at setup (or read from the pack barcode)
    stock[sm[i].bay] = sm[i].stock;
    if (sm[i].calibrate) {
      // Setup: 10 pills on the empty bay, one settled reading.
      float ten = 0;
      for (int j = 0; j < 10; ++j) ten += sm[i].pill_g * (1 + gauss(0.04f));
      m.pill_g = (ten + gauss(0.03f)) / 10;
      m.calibrated = true;
      det[sm[i].bay].setPillWeight(m.pill_g);
    }
    weight[sm[i].bay] = sm[i].tare_g + sm[i].stock * sm[i].pill_g;
  }

  uint32_t t_ms = 0;
  // Place containers.
  for (int i = 0; i < nmed; ++i) feed(det[sm[i].bay], weight[sm[i].bay], 2, t_ms);

  std::vector<HourSample> hours;
  int already_taken_notices = 0, missed_notices = 0, low_stock_notices = 0, caregiver_msgs = 0;
  int already_taken_min = -1;
  int voice_prompts = 0;
  int confirm_questions = 0;
  int low_stock_day = -1;

  // Planned actions per day: (minute of day, med index, pills). Built each day.
  for (int day = 0; day < kDays; ++day) {
    const int wd = (day + kDay0Weekday) % 7;
    const bool away_day = day == 15;
    const bool saturday = wd == 5;
    struct Act { int minute; int med; int pills; };
    std::vector<Act> acts;
    if (!away_day) {
      const int morning = (day >= 28 ? 9 * 60 + 35 : 8 * 60 + 12) + static_cast<int>(gauss(10));
      acts.push_back({morning, 0, 1});
      acts.push_back({morning + 1, 1, 1});
      if (!saturday) acts.push_back({19 * 60 + 40 + static_cast<int>(gauss(12)), 0, 1});
      acts.push_back({22 * 60 + 5 + static_cast<int>(gauss(8)), 2, 1});
      if (day == 10) acts.push_back({21 * 60, 0, 1});  // forgets and takes the evening Metformin twice
    }
    std::sort(acts.begin(), acts.end(), [](const Act& x, const Act& y) { return x.minute < y.minute; });

    size_t next = 0;
    for (int minute = 0; minute < kMinPerDay; ++minute) {
      const int32_t now = day * kMinPerDay + minute;
      const bool present = !away_day && minute >= 7 * 60 && minute < 23 * 60;
      t_ms = static_cast<uint32_t>(now) * 60000u;

      // Person acts.
      while (next < acts.size() && acts[next].minute == minute) {
        const Act a = acts[next++];
        const int bay = sm[a.med].bay;
        float removed = 0;
        for (int j = 0; j < a.pills; ++j) removed += sm[a.med].pill_g * (1 + gauss(0.04f));
        const float before = weight[bay];
        weight[bay] -= removed;
        stock[bay] -= a.pills;
        uint32_t tt = t_ms;
        BayEvent e = liftAndReturn(det[bay], before, weight[bay], tt);
        if (std::getenv("LYRA_DEBUG"))
          std::printf("   event: day %d %02d:%02d bay %d kind %d delta %.3f pills %d conf %d\n", day, minute / 60, minute % 60, bay,
                      (int)e.kind, e.delta_g, e.pills, e.confidence);
        if (e.kind != BayEventKind::None) {
          EngineOutput o = eng.onBayEvent(bay, e, now);
          if (std::getenv("LYRA_DEBUG")) std::printf("          -> notice %d\n", (int)o.notice);
          if (o.notice == Notice::ConfirmDose) {
            ++confirm_questions;
            o = eng.confirmDose(now);  // the person presses "Yes, taken"
          }
          if (o.notice == Notice::AlreadyTaken) {
            ++already_taken_notices;
            already_taken_min = o.notice_min % kMinPerDay;
          }
          if (o.notify_caregiver) ++caregiver_msgs;
        }
        // Keep the detector's pill weight in step with what the engine learned.
        const int m = eng.medAtBay(bay);
        if (m >= 0) det[bay].setPillWeight(eng.med(m).pill_g);
      }

      EngineOutput o = eng.tick(now, present);
      if (o.sound == Sound::Voice) ++voice_prompts;
      if (o.notice == Notice::DoseMissed) ++missed_notices;
      if (o.notice == Notice::LowStock) {
        ++low_stock_notices;
        if (low_stock_day < 0) low_stock_day = day;
      }
      if (o.notify_caregiver) ++caregiver_msgs;

      if (minute % 60 == 59) {
        HourSample hs;
        hs.hour_index = now / 60;
        hs.temp_c = 27.0f + 5.0f * std::sin((minute / 60 - 9) * 3.14159f / 12) + (day > 20 ? 2.5f : 0);
        hs.rh_pct = 60;
        hs.presence_min = present ? 60 : 0;
        hours.push_back(hs);
      }
    }

    // Personal rhythm feeds back into reminder timing every night.
    for (int s = 0; s < kSlots; ++s) eng.setSlotShift(s, suggestedShift(rhythm(eng.history(), s, day - 13, day)));
  }

  const auto& h = eng.history();
  const int32_t today = kDays;

  std::printf("   learned pill weights:");
  for (int i = 0; i < nmed; ++i) std::printf(" %s %.0f mg (true %.0f)", sm[i].name, eng.med(i).pill_g * 1000, sm[i].pill_g * 1000);
  std::printf("\n");
  for (int i = 0; i < nmed; ++i)
    // 10-pill setup: ±3 mg reading error / 10 plus pill spread -> within 10 mg.
    // Learned from doses (heavy pills only): within 6 %.
    CHECK(sm[i].calibrate ? std::fabs(eng.med(i).pill_g - sm[i].pill_g) <= 0.010f
                          : std::fabs(eng.med(i).pill_g - sm[i].pill_g) / sm[i].pill_g < 0.06f,
          "pill weight for %s (%s)", sm[i].name, sm[i].calibrate ? "10-pill setup, within 10 mg" : "learned from doses, within 6%");

  if (std::getenv("LYRA_DEBUG"))
    for (const auto& r : h)
      if (r.status == DoseStatus::Missed || r.status == DoseStatus::Partial)
        std::printf("   debug: day %d med %d slot %d status %d taken %d/%d\n", r.day, r.med, r.slot, (int)r.status, r.taken, r.planned);
  Adherence a = adherence(h, 0, today - 1);
  std::printf("   adherence: taking %.1f%%  timing %.1f%%  correct days %.1f%%  (%d doses, %d days)\n", a.takingPct(), a.timingPct(),
              a.correctDaysPct(), a.planned, a.days);
  std::printf("   missed: %d while away, %d while home\n", a.missed_away, a.missed_forgot);
  // Expected: away day misses 4 doses; 5 Saturdays x 1 evening Metformin missed while home.
  CHECK(a.missed_away == 4, "away day classified: %d doses missed while away (expect 4)", a.missed_away);
  CHECK(a.missed_forgot == 5, "Saturday evenings: %d doses missed while home (expect 5)", a.missed_forgot);

  MissPattern mp = missPattern(h, today, kDay0Weekday);
  static const char* kWd[] = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"};
  static const char* kSl[] = {"morning", "noon", "evening", "night"};
  CHECK(mp.flagged && mp.weekday == 5 && mp.slot == 2, "miss pattern: %s %s, %d of %d missed", kWd[mp.weekday], kSl[mp.slot], mp.misses,
        mp.occurrences);

  Drift dr = drift(h, 0, today);
  CHECK(dr.flagged, "routine drift, morning: %02d:%02d -> %02d:%02d (n=%d/%d)", dr.base_min / 60, dr.base_min % 60, dr.recent_min / 60,
        dr.recent_min % 60, dr.n_base, dr.n_recent);
  Drift dn = drift(h, 3, today);
  CHECK(!dn.flagged, "no false drift on the night dose (%02d:%02d -> %02d:%02d)", dn.base_min / 60, dn.base_min % 60, dn.recent_min / 60,
        dn.recent_min % 60);

  Rhythm rn = rhythm(h, 2, today - 14, today - 1);
  std::printf("   evening rhythm: median %+d min, IQR %d min, n=%d -> reminder shift %+d min\n", rn.median_offset, rn.iqr, rn.n,
              suggestedShift(rn));
  CHECK(suggestedShift(rn) > 20, "reminder moved toward the person's own evening time");

  CHECK(already_taken_notices == 1 && already_taken_min >= 19 * 60 && already_taken_min < 21 * 60,
        "double dose on day 10 caught: 'already taken at %02d:%02d'", already_taken_min / 60, already_taken_min % 60);

  const float left_true = static_cast<float>(stock[sm[1].bay]);
  std::printf("   Amlodipine stock: Lyra says %.0f, true %.0f; low-stock alert on day %d\n", eng.med(1).stock_pills, left_true, low_stock_day);
  CHECK(std::fabs(eng.med(1).stock_pills - left_true) <= 1, "stock count within 1 pill");
  CHECK(low_stock_notices >= 1, "low-stock alert raised %d time(s)", low_stock_notices);

  StorageReport st = storageReport(hours);
  std::printf("   storage: %d of %d hours above 30 C (peak %.1f C)\n", st.hours_hot, st.hours, st.peak_c);
  CHECK(st.hours_hot > 0, "storage heat exposure detected");

  std::printf("   voice prompts: %d, caregiver messages: %d, missed notices: %d\n", voice_prompts, caregiver_msgs, missed_notices);
  int weighed = 0, learning = 0, confirmed = 0, taken_total = 0;
  int light_taken = 0, light_confirmed = 0;
  for (const auto& r : h) {
    if (r.taken_min < 0) continue;
    if (r.med == 2) {
      ++light_taken;
      if (r.source == DoseSource::UserConfirmed) ++light_confirmed;
      continue;
    }
    ++taken_total;
    if (r.source == DoseSource::Weighed) ++weighed;
    if (r.source == DoseSource::Learning) ++learning;
    if (r.source == DoseSource::UserConfirmed) ++confirmed;
  }
  std::printf("   how doses were confirmed: %d weighed, %d while learning, %d by one knob press (%d questions asked)\n", weighed, learning,
              confirmed, confirm_questions);
  CHECK(confirmed * 20 <= taken_total, "pills >= 150 mg: knob confirmation for <= 5%% of doses (%d of %d)", confirmed, taken_total);
  CHECK(light_confirmed == light_taken, "100 mg pill: every dose confirmed by knob, never guessed (%d of %d)", light_confirmed, light_taken);
}

// ---------------------------------------------------------------------------
// A Korean home: Kim Sun-ja, 78, lives alone.
//   bay 0 (double-wide tray, cells 1+2): pharmacy pouch strip 약봉투,
//          morning / lunch / evening, 14 days = 42 pouches
//   bay 2: aspirin 100 mg blister box, morning, 130 mg tablet (always confirmed)
//   bay 3: red ginseng sticks 홍삼스틱, morning, supplement
//   bay 4: omega-3 bottle, evening, supplement
//   bay 5: calcium + vitamin D bottle, night, supplement
static void simulateKorea() {
  std::printf("\n[4] Korean home: pouch strip, blister, red ginseng sticks, bottles (21 days)\n");
  enum { kPouch = 0, kAspirin = 1, kGinseng = 2, kOmega = 3, kCalcium = 4 };
  const int bay_of[5] = {0, 2, 3, 4, 5};
  const float film = 0.80f;
  const float pouch_true[kSlots] = {film + 0.35f + 0.20f + 0.50f, film + 0.30f, film + 0.50f + 0.20f, 0};  // 1.85 / 1.10 / 1.50 g
  const float unit_true[5] = {0, 0.13f, 12.0f, 1.30f, 1.50f};

  ScheduleConfig cfg;
  cfg.slot_min[0] = 8 * 60 + 30;   // 아침 식후
  cfg.slot_min[1] = 12 * 60 + 30;  // 점심 식후
  cfg.slot_min[2] = 18 * 60 + 30;  // 저녁 식후
  cfg.slot_min[3] = 22 * 60;       // 취침 전
  DoseEngine eng(cfg);

  auto setup = [&](int i, const char* name, Form form, bool supp, std::initializer_list<int> slots, float stock) {
    Medicine& m = eng.med(i);
    std::snprintf(m.name, sizeof m.name, "%s", name);
    m.active = true;
    m.form = form;
    m.supplement = supp;
    m.bay = static_cast<uint8_t>(bay_of[i]);
    int k = 0;
    for (int v : slots) m.per_slot[k++] = static_cast<uint8_t>(v);
    m.stock_pills = stock;
  };
  setup(kPouch, "Pouch (pharmacy)", Form::Pouch, false, {1, 1, 1, 0}, 42);
  setup(kAspirin, "Aspirin 100", Form::Pill, false, {1, 0, 0, 0}, 28);
  setup(kGinseng, "Red ginseng stick", Form::Stick, true, {1, 0, 0, 0}, 30);
  setup(kOmega, "Omega-3", Form::Pill, true, {0, 0, 1, 0}, 60);
  setup(kCalcium, "Calcium + D", Form::Pill, true, {0, 0, 0, 1}, 60);
  // Setup calibrates the light blister tablet (10 on the bay); the rest is learned.
  eng.med(kAspirin).pill_g = 0.13f;
  eng.med(kAspirin).calibrated = true;

  BayDetector::Config tray_cfg;
  tray_cfg.noise_g = 0.028f;  // two cells summed: √2 × noise
  tray_cfg.empty_g = 0.3f;    // the strip lies flat and is never lifted: the last pouch (1.1 g) still counts
  BayDetector det[kBays] = {BayDetector(tray_cfg), BayDetector(), BayDetector(), BayDetector(), BayDetector(), BayDetector()};
  float weight[kBays] = {};
  weight[0] = 14 * (pouch_true[0] + pouch_true[1] + pouch_true[2]);
  weight[2] = 9.0f + 28 * 0.14f;   // blister box
  weight[3] = 60.0f + 30 * 12.0f;  // stick box
  weight[4] = 30.0f + 60 * 1.3f;
  weight[5] = 30.0f + 60 * 1.5f;
  uint32_t t_ms = 0;
  for (int b : {0, 2, 3, 4, 5}) feed(det[b], weight[b], 2, t_ms);
  for (int i = 0; i < 5; ++i) det[bay_of[i]].setPillWeight(eng.detectorUnitG(i));  // as the app does at boot

  auto directPick = [&](BayDetector& d, float after, uint32_t& tt) {
    feed(d, after + 40.0f, 0.5f, tt, 15.0f);  // fingers on the tray
    return feed(d, after + gauss(0.01f), 3, tt);
  };

  int wrong_pouch = 0, double_pouch = 0, put_back = 0, confirms_aspirin = 0, new_strip = 0;
  int supplement_alerts = 0, med_alerts = 0, voice_for_supplement_only = 0, pouch_low_stock_day = -1;
  int wrong_pouch_slot = -1;
  bool holding_wrong = false;
  int asked_label = 0, silently_wrong = 0;

  for (int day = 0; day < 21; ++day) {
    const int wd = day % 7;  // day 0 = Monday
    const bool sunday = wd == 6;
    struct Act { int minute; int item; int slot; int kind; };  // kind: 0 normal, 1 wrong pouch, 2 double pouch, 3 new strip
    std::vector<Act> acts;
    const int morning = 8 * 60 + 40 + static_cast<int>(gauss(8));
    acts.push_back({morning, kPouch, 0, 0});
    acts.push_back({morning + 1, kAspirin, 0, 0});
    if (wd != 5 && wd != 6) acts.push_back({morning + 2, kGinseng, 0, 0});  // forgets ginseng at weekends
    if (!sunday) acts.push_back({12 * 60 + 45 + static_cast<int>(gauss(8)), kPouch, 1, day == 9 ? 1 : 0});
    acts.push_back({18 * 60 + 50 + static_cast<int>(gauss(8)), kPouch, 2, 0});
    acts.push_back({18 * 60 + 52 + static_cast<int>(gauss(3)), kOmega, 2, 0});
    acts.push_back({22 * 60 + 10 + static_cast<int>(gauss(6)), kCalcium, 3, 0});
    if (day == 12) acts[0].kind = 2;                         // morning + lunch pouches stuck together
    if (day == 13) acts.push_back({20 * 60, kPouch, -1, 3});  // pharmacy refill: new 14-day strip
    std::sort(acts.begin(), acts.end(), [](const Act& x, const Act& y) { return x.minute < y.minute; });

    size_t next = 0;
    for (int minute = 0; minute < kMinPerDay; ++minute) {
      const int32_t now = (100 + day) * kMinPerDay + minute;  // days 100.. to avoid overlap with the other household
      const bool away = sunday && minute >= 10 * 60 + 30 && minute < 16 * 60;  // church, lunch out, back after the lunch window
      const bool present = !away && minute >= 7 * 60 && minute < 23 * 60;
      t_ms = static_cast<uint32_t>(now) * 60000u;

      auto apply = [&](int bay, const BayEvent& e, int minute_now) -> EngineOutput {
        EngineOutput o = eng.onBayEvent(bay, e, minute_now);
        if (o.notice == Notice::WrongPouch) ++wrong_pouch, wrong_pouch_slot = o.notice_slot;
        if (o.notice == Notice::ExtraPills && eng.med(0).bay == bay) ++double_pouch;
        if (o.notice == Notice::PutBackThanks) ++put_back;
        if (o.notice == Notice::NewContainer) ++new_strip;
        if (std::getenv("LYRA_DEBUG") && bay == 2)
          std::printf("   k-event day %d kind %d delta %.3f pills %d -> notice %d\n", minute_now / kMinPerDay - 100, (int)e.kind, e.delta_g, e.pills, (int)o.notice);
        if (o.notice == Notice::ConfirmDose) {
          if (bay == 2) ++confirms_aspirin;
          // Pouch question: "Check it says <time>". She reads the label; if it's
          // the wrong or an extra pouch she puts it back instead of pressing.
          if (bay == 0 && holding_wrong) ++asked_label;
          else o = eng.confirmDose(minute_now);
        }
        const int m = eng.medAtBay(bay);
        if (m >= 0) det[bay].setPillWeight(eng.detectorUnitG(m));
        return o;
      };

      while (next < acts.size() && acts[next].minute == minute) {
        const Act a = acts[next++];
        const int bay = bay_of[a.item];
        uint32_t tt = t_ms;
        if (a.item == kPouch) {
          if (a.kind == 3) {  // old strip away, new strip on
            feed(det[bay], 0.0f, 90, tt);
            weight[bay] = 14 * (pouch_true[0] + pouch_true[1] + pouch_true[2]);
            BayEvent e = feed(det[bay], weight[bay], 3, tt);
            apply(bay, e, now);
            eng.med(kPouch).stock_pills = 42;  // count from the pharmacy label, confirmed on screen
            continue;
          }
          auto pouch = [&](int slot) { return pouch_true[slot] + gauss(0.03f) + (unit_true[0] + pouch_true[slot] - film) * gauss(0.04f); };
          float out_g = pouch(a.kind == 1 ? 2 : a.slot);
          if (a.kind == 2) out_g += pouch(1);
          weight[bay] -= out_g;
          BayEvent e = directPick(det[bay], weight[bay], tt);
          holding_wrong = a.kind == 1 || a.kind == 2;
          const int wp = wrong_pouch, dp = double_pouch, al = asked_label;
          apply(bay, e, now);
          holding_wrong = false;
          if ((a.kind == 1 || a.kind == 2) && wrong_pouch == wp && double_pouch == dp && asked_label == al) ++silently_wrong;
          if (a.kind == 1 || a.kind == 2) {
            // She hears Lyra, puts the extra/wrong pouch back two minutes later ...
            const float back = a.kind == 1 ? out_g : out_g - (e.delta_g - eng.med(kPouch).slot_unit_g[1]);
            weight[bay] += a.kind == 1 ? out_g : pouch_true[1];
            (void)back;
            e = directPick(det[bay], weight[bay], tt);
            apply(bay, e, now + 2);
            if (a.kind == 1) {  // ... and takes the lunch pouch
              const float lunch = pouch(1);
              weight[bay] -= lunch;
              e = directPick(det[bay], weight[bay], tt);
              apply(bay, e, now + 3);
            }
          }
          continue;
        }
        const float unit = unit_true[a.item] * (1 + gauss(a.item == kGinseng ? 0.02f : 0.04f));
        const float before = weight[bay];
        weight[bay] -= unit + (a.item == kAspirin ? 0.01f : 0);  // blister: tablet + a flake of foil
        BayEvent e = a.item == kGinseng ? directPick(det[bay], weight[bay], tt) : liftAndReturn(det[bay], before, weight[bay], tt);
        apply(bay, e, now);
      }

      EngineOutput o = eng.tick(now, present);
      if (o.notify_caregiver) {
        if (o.notice_med >= 0 && eng.med(o.notice_med).supplement) ++supplement_alerts;
        else ++med_alerts;
      }
      if (o.notice == Notice::LowStock && o.notice_med == kPouch && pouch_low_stock_day < 0) pouch_low_stock_day = day;
      if (o.sound == Sound::Voice) {
        bool any_med = false;
        for (const auto& r : eng.history())
          if (r.slot == o.active_slot && dayOf(now) == r.day && !eng.med(r.med).supplement &&
              r.status != DoseStatus::Taken && r.status != DoseStatus::TakenLate)
            any_med = true;
        if (!any_med) ++voice_for_supplement_only;
      }
    }
  }

  const auto& h = eng.history();
  std::printf("   learned pouch weights: morning %.2f g, lunch %.2f g, evening %.2f g (true %.2f / %.2f / %.2f)\n", eng.med(0).slot_unit_g[0],
              eng.med(0).slot_unit_g[1], eng.med(0).slot_unit_g[2], pouch_true[0], pouch_true[1], pouch_true[2]);
  bool pouch_ok = true;
  for (int k = 0; k < 3; ++k) pouch_ok &= std::fabs(eng.med(0).slot_unit_g[k] - pouch_true[k]) < 0.1f;
  CHECK(pouch_ok, "each time's pouch weight learned within 0.1 g");
  std::printf("   wrong pouch (day 9): %s; double pouch (day 12): %s\n",
              wrong_pouch ? "named by weight ('this is the evening pouch')" : "asked to check the printed time",
              double_pouch ? "caught by weight" : "asked to check the printed time");
  CHECK(silently_wrong == 0, "a wrong or extra pouch is never recorded silently (%d)", silently_wrong);
  CHECK(wrong_pouch == 0 || wrong_pouch_slot == 2, "when named, the wrong pouch is the evening one");
  CHECK(put_back == 2, "both put back -> thanked, nothing sent to family (%d)", put_back);
  CHECK(new_strip == 1, "new 14-day strip recognised (%d)", new_strip);
  CHECK(pouch_low_stock_day >= 5 && pouch_low_stock_day <= 8, "pouch strip low-stock alert on day %d (7 days left)", pouch_low_stock_day);

  int lunch_taken = 0, lunch_away = 0, pouch_weighed = 0, pouch_total = 0;
  for (const auto& r : h) {
    if (r.med != kPouch || r.day < 100) continue;
    if (r.taken_min >= 0) {
      ++pouch_total;
      if (r.source == DoseSource::Weighed) ++pouch_weighed;
    }
    if (r.slot == 1 && (r.status == DoseStatus::Taken || r.status == DoseStatus::TakenLate)) ++lunch_taken;
    if (r.slot == 1 && r.status == DoseStatus::Missed && r.miss == MissReason::Away) ++lunch_away;
  }
  CHECK(lunch_away == 3, "Sunday lunch pouches missed while out: %d, classed 'away'", lunch_away);
  if (std::getenv("LYRA_DEBUG"))
    for (const auto& r : h)
      if (r.day >= 100 && !eng.med(r.med).supplement && r.taken_min < 0)
        std::printf("   k-missed: day %d med %d slot %d status %d miss %d\n", r.day - 100, r.med, r.slot, (int)r.status, (int)r.miss);
  std::printf("   pouches: %d taken, %d weighed, %d while learning\n", pouch_total, pouch_weighed, pouch_total - pouch_weighed);

  int asp_taken = 0, asp_confirmed = 0;
  for (const auto& r : h)
    if (r.med == kAspirin && r.day >= 100 && r.taken_min >= 0) {
      ++asp_taken;
      if (r.source == DoseSource::UserConfirmed) ++asp_confirmed;
    }
  CHECK(asp_taken == 21 && asp_confirmed == 21, "aspirin (130 mg, blister): %d of %d confirmed by one knob press", asp_confirmed, asp_taken);

  int gin_taken = 0, gin_missed = 0;
  for (const auto& r : h)
    if (r.med == kGinseng && r.day >= 100) {
      if (r.taken_min >= 0) ++gin_taken;
      if (r.status == DoseStatus::Missed) ++gin_missed;
    }
  CHECK(gin_taken == 15 && gin_missed == 6, "red ginseng: %d sticks counted, %d weekend days missed", gin_taken, gin_missed);
  CHECK(supplement_alerts == 0, "supplements never alert the family (%d alerts)", supplement_alerts);
  CHECK(voice_for_supplement_only == 0, "no voice reminder when only supplements are left (%d)", voice_for_supplement_only);

  Adherence rx = adherence(h, 100, 120, kPouch);
  CHECK(rx.taken == rx.planned - 3, "prescription pouches: only the 3 Sunday lunches missed (%d of %d taken)", rx.taken, rx.planned);
  std::printf("   prescription pouches: taking %.1f%%, on time %.1f%% (%d doses); family alerts: %d\n", rx.takingPct(), rx.timingPct(), rx.planned,
              med_alerts);
}

int main() {
  testDetector();
  confidenceTable(0.02f);  // design target
  confidenceTable(0.03f);  // sensitivity: a sloppier bay cup
  g_place = 0.02f;
  simulate();
  simulateKorea();
  std::printf("\n%s (%d failure%s)\n", g_fail ? "FAILED" : "ALL PASSED", g_fail, g_fail == 1 ? "" : "s");
  return g_fail ? 1 : 0;
}
