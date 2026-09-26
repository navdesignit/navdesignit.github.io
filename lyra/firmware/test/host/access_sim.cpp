// Lyra access model: host test.
//
//   make -C test/host access
//
// One day in 김순자's four compartments, fed as raw load-cell samples at 10 Hz.
// Checks what Lyra is allowed to claim, and only that: which compartment was
// opened, when, and whether something came out.
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <random>

#include "lyra/access.h"

using namespace lyra;

static int g_fail = 0;
#define CHECK(cond, ...)                                  \
  do {                                                    \
    std::printf((cond) ? "  ok    " : "  FAIL  ");        \
    if (!(cond)) ++g_fail;                                \
    std::printf(__VA_ARGS__);                             \
    std::printf("\n");                                    \
  } while (0)

static std::mt19937 rng(std::getenv("LYRA_SEED") ? std::atoi(std::getenv("LYRA_SEED")) : 42);
static float gauss(float s) { return std::normal_distribution<float>(0, s)(rng); }

struct Comp {
  AccessDetector det;
  float w;  // true weight on the cell
};

static Comp comp[kCompartments] = {
    {AccessDetector(0), 82.0f},   // 1 sachet roll
    {AccessDetector(1), 35.0f},   // 2 blister cards
    {AccessDetector(2), 454.0f},  // 3 ginseng box, eye drops, ointment
    {AccessDetector(3), 324.0f},  // 4 three bottles
};

static AccessEngine eng;
static int32_t g_min = 0;
static int accesses = 0, returned = 0, opened_again = 0, not_scheduled = 0, family = 0;
static AccessEngine::Output last_out;

static void feed(int c, float g, float secs, float noise, uint32_t& t) {
  for (int i = 0; i < static_cast<int>(secs * 10); ++i) {
    t += 100;
    const bool was = comp[c].det.active();
    const bool fired = comp[c].det.push(g + gauss(noise), t);
    if (std::getenv("LYRA_TRACE") && c == 0 && was != comp[c].det.active())
      std::printf("   trace C1 %s at %02d:%02d +%.1fs g=%.2f\n", comp[c].det.active() ? "active" : "idle", (g_min % kMinPerDay) / 60, g_min % 60,
                  (t % 60000) / 1000.0, g);
    if (fired) {
      const Access a = comp[c].det.last();
      last_out = eng.onAccess(a, g_min);
      if (last_out.notice == AccessEngine::NoticeKind::Opened) ++accesses;
      if (last_out.notice == AccessEngine::NoticeKind::Returned) ++returned;
      if (last_out.notice == AccessEngine::NoticeKind::OpenedAgain) ++opened_again;
      if (last_out.notice == AccessEngine::NoticeKind::NotScheduled) ++not_scheduled;
      if (std::getenv("LYRA_DEBUG"))
        std::printf("   access: %02d:%02d C%d net %+.3f g took %d -> notice %d slot %d\n", (g_min % kMinPerDay) / 60, g_min % 60, c + 1,
                    a.net_g, a.took, (int)last_out.notice, last_out.slot);
    }
  }
}

// Hand in the compartment for `secs`, `out` grams leave for good.
static void takeOut(int c, float out, float secs) {
  uint32_t t = static_cast<uint32_t>(g_min) * 60000u;
  feed(c, comp[c].w + 25.0f, secs, 12.0f, t);  // fingers pressing, rustling
  comp[c].w -= out;
  feed(c, comp[c].w + gauss(0.02f), 20, 0.02f, t);
}
// Lift an item of `item` grams out, hold it `secs`, put it back `used` lighter.
static void liftUse(int c, float item, float used, float secs) {
  uint32_t t = static_cast<uint32_t>(g_min) * 60000u;
  feed(c, comp[c].w + 20.0f, 1.0f, 10.0f, t);
  feed(c, comp[c].w - item + gauss(0.02f), secs, 0.02f, t);  // item in her hand
  comp[c].w -= used;
  feed(c, comp[c].w + 20.0f, 0.5f, 10.0f, t);
  feed(c, comp[c].w + gauss(0.02f), 20, 0.02f, t);
}
static void knock(int c) {
  uint32_t t = static_cast<uint32_t>(g_min) * 60000u;
  feed(c, comp[c].w + 6.0f, 0.3f, 3.0f, t);
  feed(c, comp[c].w, 12, 0.02f, t);
}
static void idle(int c) {
  uint32_t t = static_cast<uint32_t>(g_min) * 60000u;
  feed(c, comp[c].w, 2, 0.02f, t);
}

static void runTo(int32_t until, bool present) {
  for (; g_min < until; ++g_min) {
    const AccessEngine::Output o = eng.tick(g_min, present);
    if (o.notify_family) ++family;
  }
}

int main() {
  AccessEngine::Config cfg;
  cfg.need[0] = 0b1111;  // 아침: 1 sachet, 2 blister, 3 stick + eye drops, 4 vitamin C
  cfg.need[1] = 0b0001;  // 점심: 1 sachet
  cfg.need[2] = 0b1011;  // 저녁: 1 sachet, 2 stomach tablet, 4 omega-3
  cfg.need[3] = 0b1100;  // 취침: 3 eye drops + ointment, 4 calcium
  cfg.quiet_comps = 0b1000;  // compartment 4 holds supplements only
  eng = AccessEngine(cfg);
  eng.threshold_g = comp[0].det.threshold();

  std::printf("\n[A] One day, four compartments\n");
  const int32_t day = 100;
  g_min = day * kMinPerDay + 7 * 60;
  eng.beginDay(day);
  for (int c = 0; c < kCompartments; ++c) idle(c);

  runTo(day * kMinPerDay + 8 * 60 + 41, true);
  liftUse(0, 82.0f, 1.85f, 10);  // lifts the roll, tears the morning sachet, puts the roll back
  ++g_min;
  takeOut(1, 0.14f, 6);          // pops an aspirin (130 mg + foil): may be below "took"
  ++g_min;
  takeOut(2, 12.0f, 4);          // one ginseng stick
  g_min += 2;
  liftUse(2, 9.0f, 0.04f, 40);   // eye drops: out 40 s, back 40 mg lighter
  g_min += 5;
  liftUse(3, 96.0f, 1.1f, 20);   // vitamin C bottle: out 20 s, back one tablet lighter
  runTo(day * kMinPerDay + 9 * 60 + 10, true);
  knock(0);                      // bumps the table

  const auto& A = [&](int slot, int c) -> const AccessEngine::Cell& { return eng.cell(day, slot, c); };
  CHECK(A(0, 0).mark == AccessEngine::Mark::Done && A(0, 0).at == day * kMinPerDay + 8 * 60 + 41 && A(0, 0).took,
        "morning, compartment 1 opened 08:41, something taken");
  CHECK(A(0, 1).mark == AccessEngine::Mark::Done, "morning, compartment 2 opened (took: %s)", A(0, 1).took ? "yes" : "not measurable");
  CHECK(A(0, 2).mark == AccessEngine::Mark::Done && A(0, 2).took, "morning, compartment 3 opened, stick taken");
  CHECK(A(0, 3).mark == AccessEngine::Mark::Done && A(0, 3).took, "morning, compartment 4 opened, bottle came back lighter");
  CHECK(opened_again >= 1, "eye drops after the stick: 'opened again', not a second dose (%d)", opened_again);
  CHECK(returned >= 2, "lifted items coming back are 'returned', not new openings (%d)", returned);
  CHECK(accesses == 4, "4 openings counted for the morning, the knock ignored (%d)", accesses);

  runTo(day * kMinPerDay + 12 * 60 + 40, true);
  takeOut(0, 1.10f, 5);          // lunch sachet
  g_min += 2;
  liftUse(3, 106.0f, 1.3f, 15);  // opens the bottles at lunch: nothing due there
  CHECK(A(1, 0).mark == AccessEngine::Mark::Done, "lunch, compartment 1 opened");
  CHECK(not_scheduled == 1, "compartment 4 at lunch: 'nothing due here, next 18:30'");

  runTo(day * kMinPerDay + 18 * 60 + 50, true);
  takeOut(0, 1.50f, 5);          // evening sachet
  g_min += 3;
  liftUse(3, 104.0f, 1.3f, 15);  // omega-3; she forgets compartment 2 (stomach tablet)
  runTo(day * kMinPerDay + 22 * 60 + 5, true);
  liftUse(2, 8.96f, 0.04f, 30);  // bedtime eye drops; she skips the calcium (compartment 4)
  runTo((day + 1) * kMinPerDay + 2 * 60, true);

  CHECK(A(2, 1).mark == AccessEngine::Mark::Missed && A(2, 1).why == AccessEngine::MissReason::Home,
        "evening, compartment 2 never opened: missed, she was home");
  CHECK(A(3, 2).mark == AccessEngine::Mark::Done, "bedtime, compartment 3 opened");
  CHECK(A(3, 3).mark == AccessEngine::Mark::Missed, "bedtime, compartment 4 missed");
  CHECK(family == 1, "one family message (evening compartment 2); supplement compartment stays quiet (%d)", family);

  std::printf("\n   access log:\n");
  for (const auto& e : eng.log())
    std::printf("   %02d:%02d  compartment %d  %s%s\n", (e.at % kMinPerDay) / 60, e.at % 60, e.comp + 1,
                e.kind == AccessEngine::NoticeKind::Returned ? "item put back" : e.took ? "opened, took something" : "opened",
                e.kind == AccessEngine::NoticeKind::NotScheduled ? " (nothing due)" : e.kind == AccessEngine::NoticeKind::OpenedAgain ? " (again)" : "");

  // [B] Knocks and table bumps never count.
  std::printf("\n[B] 500 knocks on a quiet compartment\n");
  AccessDetector k(0);
  uint32_t t = 0;
  int false_access = 0;
  for (int i = 0; i < 20; ++i) k.push(50.0f + gauss(0.02f), t += 100);
  for (int n = 0; n < 500; ++n) {
    for (int i = 0; i < 3; ++i) false_access += k.push(50.0f + 6.0f + gauss(3.0f), t += 100);
    for (int i = 0; i < 120; ++i) false_access += k.push(50.0f + gauss(0.02f), t += 100);
  }
  CHECK(false_access == 0, "knocks counted as openings: %d of 500", false_access);

  std::printf("\n%s (%d failure%s)\n", g_fail ? "FAILED" : "ALL PASSED", g_fail, g_fail == 1 ? "" : "s");
  return g_fail ? 1 : 0;
}
