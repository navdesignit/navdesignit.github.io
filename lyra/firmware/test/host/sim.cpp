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

  StorageReport st = storage(hours);
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

int main() {
  testDetector();
  confidenceTable(0.02f);  // design target
  confidenceTable(0.03f);  // sensitivity: a sloppier bay cup
  g_place = 0.02f;
  simulate();
  std::printf("\n%s (%d failure%s)\n", g_fail ? "FAILED" : "ALL PASSED", g_fail, g_fail == 1 ? "" : "s");
  return g_fail ? 1 : 0;
}
