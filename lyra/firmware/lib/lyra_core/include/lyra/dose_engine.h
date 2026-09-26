// Dose engine: the brain of Lyra.
//
//  - builds each day's plan from the medicines on the tray
//  - runs the reminder ladder (silent glow → chime → voice → caregiver)
//  - matches every bay event to a planned dose
//  - applies the safety rules (already taken, too early, extra pills,
//    take-if-remembered window)
//  - keeps stock counts and learns each pill's weight
//
// It is pure logic: no I/O, no clocks. The app calls tick() once a minute
// and onBayEvent() whenever a BayDetector reports something.
#pragma once
#include <vector>

#include "lyra/types.h"

namespace lyra {

enum class Sound : uint8_t { None, Chime, Voice };

enum class Notice : uint8_t {
  None,
  DoseTaken,        // ✓ recorded
  AlreadyTaken,     // this dose was already taken today at taken_min
  TooEarly,         // next dose of this medicine isn't open yet
  ExtraPills,       // more pills than planned were removed
  PartialDose,      // fewer pills than planned
  PutBackThanks,    // extra pills returned to the container
  Refilled,
  LowStock,         // ≤ kLowStockDays left
  LeftOff,          // container not returned to its bay
  NewContainer,     // a different container sits on the bay: confirm on screen
  UnknownBay,       // pills taken from a bay with no medicine assigned
  ConfirmDose,      // container opened but the change was too small to count: ask
  DoseMissed,
};

struct EngineOutput {
  // Reminder state (drives LEDs, screen and speaker).
  int8_t active_slot = -1;      // slot currently due, -1 = none
  uint8_t level = 0;            // 0 none, 1 glow, 2 chime, 3 voice
  uint8_t glow_mask = 0;        // bit per bay to light
  Sound sound = Sound::None;    // play now (edge-triggered)

  // One-off message for the screen.
  Notice notice = Notice::None;
  int8_t notice_med = -1;
  int32_t notice_min = -1;      // e.g. when it was already taken / next due
  int8_t notice_pills = 0;

  // Caregiver message (sent by the app layer over LTE/Wi-Fi).
  bool notify_caregiver = false;
};

class DoseEngine {
 public:
  static constexpr int kLowStockDays = 7;
  static constexpr int kPutBackWindowMin = 10;
  static constexpr float kMinCountablePillG = 0.15f;  // lighter: always confirm by knob
  static constexpr float kRefinePillG = 0.25f;        // learned (not calibrated) and heavier: keep refining

  explicit DoseEngine(const ScheduleConfig& cfg = ScheduleConfig{}) : cfg_(cfg) {}

  ScheduleConfig& config() { return cfg_; }
  const ScheduleConfig& config() const { return cfg_; }
  Medicine& med(int i) { return meds_[i]; }
  const Medicine& med(int i) const { return meds_[i]; }
  int medAtBay(int bay) const;

  // Personal timing: shift reminders toward the person's natural time.
  void setSlotShift(int slot, int minutes) { shift_[slot] = minutes; }
  int slotShift(int slot) const { return shift_[slot]; }

  // Call at local midnight (and at boot). Closes still-open doses of earlier
  // days and creates today's plan.
  void beginDay(int32_t day);

  EngineOutput tick(int32_t now_min, bool present);
  EngineOutput onBayEvent(int bay, const BayEvent& e, int32_t now_min);

  // The person answered "Yes, taken" to a ConfirmDose question (knob press).
  EngineOutput confirmDose(int32_t now_min);
  static constexpr int kConfirmWindowMin = 5;

  const std::vector<DoseRecord>& history() const { return hist_; }
  std::vector<DoseRecord>& history() { return hist_; }
  float dailyUse(int med) const;     // pills per day
  float daysLeft(int med) const;     // -1 if unknown

  // Window in which a dose still counts (after due).
  int lateLimit(int med, int slot) const;

 private:
  int32_t dueMin(int32_t day, int slot) const { return day * kMinPerDay + cfg_.slot_min[slot]; }
  int32_t remindMin(const DoseRecord& r) const { return r.due_min + shift_[r.slot]; }
  void closeExpired(int32_t now_min, EngineOutput& out);
  void learnPillWeight(int med, float delta_g, int planned);
  DoseRecord* openDoseFor(int med, int32_t now_min);
  void markTaken(DoseRecord& r, int count, int32_t now_min, EngineOutput& out);

  ScheduleConfig cfg_;
  Medicine meds_[kMaxMeds];
  std::vector<DoseRecord> hist_;
  int16_t shift_[kSlots] = {};
  int32_t today_ = -1;

  // Reminder ladder bookkeeping.
  int8_t last_level_[kSlots] = {};
  int32_t last_voice_min_[kSlots] = {};
  uint8_t voice_repeats_[kSlots] = {};
  bool was_present_ = false;
  bool present_in_window_[kSlots] = {};

  // Extra-pill "put back" window.
  int8_t extra_med_ = -1;
  int8_t extra_pills_ = 0;
  int32_t extra_min_ = 0;

  // Pending "did you take it?" question.
  int8_t confirm_med_ = -1;
  int32_t confirm_min_ = 0;

  // Pill-weight learning.
  float learn_[kMaxMeds][5] = {};
  uint8_t learn_n_[kMaxMeds] = {};     // samples held (≤ 5)
  uint8_t learn_next_[kMaxMeds] = {};  // ring index
  bool low_stock_sent_[kMaxMeds] = {};
};

}  // namespace lyra
