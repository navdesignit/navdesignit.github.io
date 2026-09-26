// Lyra OS — shared data types for the Lyra medication station.
//
// Portable C++17 with no Arduino dependency: the same core runs on the
// ESP32-S3 and on a desktop host for tests.
//
// Time convention: the core works in "local minutes" (minutes since
// 00:00 local time on day 0 of the device's calendar). The app layer turns
// RTC epoch time + timezone into local minutes, so the core never deals with
// time zones or DST.
#pragma once
#include <cstdint>

namespace lyra {

constexpr int kBays = 6;       // weighing bays on the tray
constexpr int kSlots = 4;      // dose times per day
constexpr int kMaxMeds = kBays;
constexpr int kMinPerDay = 24 * 60;

inline int32_t dayOf(int32_t local_min) { return local_min / kMinPerDay; }
inline int32_t minuteOfDay(int32_t local_min) { return local_min % kMinPerDay; }

// Pictogram-based slots, so no language is needed to read the plan.
enum class Slot : uint8_t { Morning = 0, Noon = 1, Evening = 2, Night = 3 };

// What sits on the bay. The unit is what the person takes out.
enum class Form : uint8_t {
  Pill,     // bottle or blister box; unit = one tablet or capsule
  Pouch,    // pharmacy dose-pouch strip (Korea: 약봉투); unit = one pouch holding
            // every pill for one dose time; each slot's pouch has its own weight
  Stick,    // single-serve stick or sachet (e.g. red ginseng 홍삼스틱); unit = one stick
};

struct Medicine {
  char name[24] = {};                // UTF-8; non-Latin names are drawn from cloud-rendered bitmaps
  Form form = Form::Pill;
  // Supplements (vitamins, red ginseng): glow and one chime only, no voice
  // escalation, no caregiver alert when missed.
  bool supplement = false;
  // Pouch only: weight of one pouch per slot (morning pouch ≠ evening pouch).
  // Learned from the first takes of each slot; 0 = still learning.
  float slot_unit_g[kSlots] = {};
  bool active = false;
  uint8_t bay = 0;                 // 0..kBays-1
  uint8_t per_slot[kSlots] = {};   // pills per slot, 0 = not taken at that time
  // Weight of one pill; 0 = still learning.
  // Standard setup calibrates it: "put 10 pills on the empty bay" (one
  // settled reading / 10 → about ±3 mg). If setup skips that, the engine
  // learns it from the first doses, which is only reliable for pills
  // ≥ 250 mg: for light pills the lightest readings fall under the detection
  // threshold, so learning is biased upward.
  float pill_g = 0;
  bool calibrated = false;         // pill_g came from the 10-pill setup step
  float stock_pills = -1;          // pills left in the container, -1 = unknown
  // How late a dose may still be taken ("if you forget, take it when you
  // remember unless it is almost time for the next one"). Set by the
  // pharmacist/caregiver during setup; 0 = use the engine default.
  uint16_t late_limit_min = 0;
};

struct ScheduleConfig {
  uint16_t slot_min[kSlots] = {8 * 60, 13 * 60, 19 * 60, 22 * 60};
  uint16_t early_min = 60;         // a dose may be taken this early
  uint16_t on_time_min = 60;       // within ±this = "on time"
  uint16_t chime_after_min = 15;   // reminder ladder steps, relative to due
  uint16_t voice_after_min = 30;
  uint16_t default_late_min = 180; // default take-if-remembered window
  // A weighed count is recorded silently only at this confidence or above;
  // below it Lyra asks "Did you take it?" (one knob press).
  uint8_t silent_confidence = 90;
};

// ---------------------------------------------------------------------------
// What the bay detector reports after the weight on a bay settles.
enum class BayEventKind : uint8_t {
  None,
  Lifted,        // container picked up (weight dropped to ~tare)
  Removed,       // settled lighter: pills taken out
  Added,         // settled heavier: refill
  NoChange,      // container put back, nothing taken
  Swapped,       // a different container was placed on the bay
  Placed,        // container placed on an empty bay
  Emptied,       // container taken away and not returned (bay empty)
  LeftOff,       // container has been off the bay for too long
};

struct BayEvent {
  BayEventKind kind = BayEventKind::None;
  uint32_t t_ms = 0;
  float before_g = 0;
  float after_g = 0;
  float delta_g = 0;       // before - after (positive = mass removed)
  int8_t pills = 0;        // pill count for Removed/Added, if pill weight known
  uint8_t confidence = 0;  // 0..100, how sure we are of `pills`
};

// ---------------------------------------------------------------------------
enum class DoseStatus : uint8_t {
  Upcoming,   // before the early window opens
  Open,       // may be taken now (early window reached, not yet due)
  Due,        // due time reached, not taken
  Taken,      // taken within ±on_time_min
  TakenLate,  // taken after on_time_min but inside the late limit
  Partial,    // fewer pills removed than planned
  Missed,     // late limit passed without a dose
};

enum class MissReason : uint8_t {
  None,
  Away,       // nobody near Lyra for the whole window
  Forgot,     // person was present and reminded, dose not taken
};

// How a dose was confirmed. Reports keep these apart, so nobody mistakes a
// button press for a weighed pill count.
enum class DoseSource : uint8_t {
  None,
  Weighed,       // pill count measured by the scale
  Learning,      // container opened while the pill weight was still being learned
  UserConfirmed, // weight change too small to count; the person pressed "Yes, taken"
};

// One planned dose of one medicine in one slot of one day.
struct DoseRecord {
  int32_t day = 0;
  uint8_t med = 0;
  uint8_t slot = 0;
  uint8_t planned = 0;          // pills
  uint8_t taken = 0;            // pills removed
  DoseStatus status = DoseStatus::Upcoming;
  MissReason miss = MissReason::None;
  int32_t due_min = 0;          // local minutes
  int32_t taken_min = -1;       // local minutes, -1 = not taken
  int16_t reminded_level = 0;   // highest reminder level reached
  uint8_t confidence = 0;       // detector confidence for `taken`
  DoseSource source = DoseSource::None;
};

// Hourly environment + presence summary, kept for the storage and routine
// analyses.
struct HourSample {
  int32_t hour_index = 0;       // local minutes / 60
  float temp_c = 0;
  float rh_pct = 0;
  uint8_t presence_min = 0;     // minutes in this hour someone was near Lyra
};

}  // namespace lyra
