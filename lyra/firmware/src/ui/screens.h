// E-ink screens, 400 x 300, black on paper white.
//
// Design rules (for 70+ year-old eyes, any language):
//   - one question answered per screen, biggest type ≥ 40 px
//   - time-of-day pictograms (sunrise, sun, sunset, moon) instead of words
//   - state in shape, never in colour alone: ✓ filled circle = taken,
//     ring = still to take, cross = missed
//   - the home screen always answers "Did I take it?" at a glance, and holds
//     that answer with zero power
//   - full refresh when the page changes; fast partial refresh for clocks and
//     ticks (full refresh again every 10 partials to clear ghosting)
#pragma once
#include <cstdint>

#include "lyra/dose_engine.h"
#include "lyra/insights.h"

namespace ui {

enum class Page : uint8_t {
  Today,      // home: today's four slots with ticks
  DueNow,     // "Evening — take 2 pills", bays glowing
  Notice,     // one-off message from the engine
  Week,       // 7 x 4 grid of ticks
  Medicines,  // each medicine: pills left, run-out date
  Messages,   // notes from family
  InHand,     // an item has been lifted: name it and say how many to take
};

struct Context {
  const lyra::DoseEngine* engine = nullptr;
  int32_t now_min = 0;
  const char* date_label = "";        // localised, e.g. "Thu 26 Sep"
  int day0_weekday = 0;               // weekday of local day 0 (0 = Monday)
  int8_t active_slot = -1;
  lyra::EngineOutput notice;
  const char* family_note = nullptr;  // latest message from family, may be null
  const char* family_from = nullptr;
  bool online = true;
  uint8_t battery_pct = 100;
  bool on_battery = false;
  int8_t in_hand = -1;        // medicine lifted from a compartment; -2 = look-alike, checking
  int8_t in_hand_comp = -1;
  uint8_t which_cursor = 0;   // "which one?" list position
};

void begin();
// Draw a page. `partial` = fast refresh (only for small changes on the same page).
void show(Page page, const Context& ctx, bool partial);

}  // namespace ui
