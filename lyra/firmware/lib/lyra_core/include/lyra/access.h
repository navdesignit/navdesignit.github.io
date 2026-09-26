// Compartment access: what Lyra records and shows.
//
// Lyra has four compartments on four load cells. What it can say for
// certain is:
//
//     compartment N was opened at HH:MM, and something came out (or not).
//
// It does NOT claim which sachet on a roll, which bottle in a compartment, or
// how many pills: tearing one sachet off a roll and putting the roll back
// looks the same for the morning and the evening sachet.
//
// The schedule says which compartments each dose time needs. A dose time is
// done when those compartments were opened inside its window.
//
//   AccessDetector  load cell (and optional lid switch) → one Access per interaction
//   AccessEngine    Access + clock + presence → day grid, screen notices,
//                   reminders, family alerts
#pragma once
#include <vector>

#include "lyra/types.h"

namespace lyra {

// One interaction with one compartment: hand in → settled again.
struct Access {
  uint8_t comp = 0;
  uint32_t start_ms = 0;
  uint32_t end_ms = 0;
  float net_g = 0;     // weight that left (+) or came in (−) over the interaction
  bool took = false;   // net_g above the detection threshold: something came out
};

class AccessDetector {
 public:
  struct Config {
    float noise_g = 0.02f;           // per-sample load-cell noise (1σ)
    float place_g = 0.02f;           // put-down repeatability (1σ)
    uint32_t quiet_ms = 8000;        // settled and unchanged this long ends an interaction
    uint32_t min_touch_ms = 1500;    // a disturbance shorter than this with no net change is a knock
    bool has_lid = false;            // lid switch fitted: the lid defines the interaction
  };

  explicit AccessDetector(uint8_t comp = 0) : comp_(comp) {}
  AccessDetector(uint8_t comp, const Config& c) : cfg_(c), comp_(comp) {}

  // Feed one sample (~10 Hz). Returns true when an interaction has just
  // ended; read it with last().
  bool push(float grams, uint32_t t_ms, bool lid_open = false);
  const Access& last() const { return last_; }
  bool active() const { return state_ == State::Active; }

  // Smallest settled change reported as "took something": 4σ of a before/after pair.
  float threshold() const;

 private:
  enum class State : uint8_t { Starting, Idle, Active };
  static constexpr int kWin = 10;

  Config cfg_;
  uint8_t comp_;
  State state_ = State::Starting;
  float buf_[kWin] = {};
  int n_ = 0, head_ = 0;
  float ref_ = 0;            // settled weight before the interaction
  float level_ = 0;          // most recent settled weight
  uint32_t start_ms_ = 0;
  uint32_t last_busy_ms_ = 0;  // last moment the reading was unsettled or the lid open
  uint32_t busy_ms_ = 0;       // total disturbed time in this interaction
  uint32_t prev_ms_ = 0;
  Access last_;
};

class AccessEngine {
 public:
  enum class Mark : uint8_t { None, Upcoming, Due, Done, Missed };
  enum class MissReason : uint8_t { None, Away, Home };

  struct Config {
    uint16_t slot_min[kSlots] = {8 * 60 + 30, 12 * 60 + 30, 18 * 60 + 30, 22 * 60};
    uint8_t need[kSlots] = {};       // bit per compartment each dose time needs
    uint8_t quiet_comps = 0;         // supplement-only compartments: glow + one chime, no family alert
    uint16_t early_min = 60;
    uint16_t on_time_min = 60;
    uint16_t chime_after_min = 15;
    uint16_t voice_after_min = 30;
    uint16_t default_late_min = 180;
    uint16_t return_merge_min = 10;  // weight coming back this soon after an access is the item returning
  };

  struct Cell {
    Mark mark = Mark::None;
    int32_t at = -1;       // local minute it was opened
    bool took = false;
    MissReason why = MissReason::None;
    bool seen_home = false;
  };

  enum class NoticeKind : uint8_t {
    None,
    Opened,         // "Compartment 2 · 08:42 ✓" (+ what is still left for this dose time)
    OpenedAgain,    // opened again in a dose time already done (normal when a compartment
                    // holds several items); shown with the first time
    NotScheduled,   // nothing due from this compartment now: "next: evening 18:30"
    Returned,       // weight came back (a bottle put back after use)
    Missed,         // a dose time closed with this compartment unopened
  };

  struct Output {
    int8_t due_slot = -1;        // dose time currently due (-1 none)
    uint8_t glow_mask = 0;       // compartments to light
    uint8_t level = 0;           // 0 none, 1 glow, 2 chime, 3 voice
    Sound sound = Sound::None;
    NoticeKind notice = NoticeKind::None;
    int8_t comp = -1;
    int8_t slot = -1;
    int32_t at = -1;             // when (opened / previously opened / next due)
    bool took = false;
    uint8_t remaining = 0;       // compartments still to open for this dose time
    bool notify_family = false;
    MissReason why = MissReason::None;
  };

  struct LogEntry {
    int32_t at;
    uint8_t comp;
    bool took;
    float net_g;
    int8_t slot;                 // dose time it counted for, -1 none
    NoticeKind kind;
  };

  AccessEngine() = default;
  explicit AccessEngine(const Config& c) : cfg_(c) {}
  Config& config() { return cfg_; }
  const Config& config() const { return cfg_; }

  void beginDay(int32_t day);
  Output onAccess(const Access& a, int32_t now_min);
  Output tick(int32_t now_min, bool present);

  // Day grid for the screen: dose time × compartment.
  const Cell& cell(int32_t day, int slot, int comp) const;
  const std::vector<LogEntry>& log() const { return log_; }
  int lateLimit(int slot, int comp) const;
  float threshold_g = 0.05f;     // set from the detector: what counts as "took"

 private:
  struct Day {
    int32_t day;
    Cell c[kSlots][kCompartments];
  };
  Day* dayRec(int32_t day);
  int32_t due(int32_t day, int slot) const { return day * kMinPerDay + cfg_.slot_min[slot]; }
  bool open(int32_t day, int slot, int comp, int32_t now) const;

  Config cfg_;
  std::vector<Day> days_;
  std::vector<LogEntry> log_;
  int32_t today_ = -1;
  int8_t last_level_[kSlots] = {};
  int32_t last_voice_[kSlots] = {};
  uint8_t voices_[kSlots] = {};
  bool was_present_ = false;
  int32_t last_access_[kCompartments] = {-100000, -100000, -100000, -100000};
  float last_net_[kCompartments] = {};
  int32_t last_day_[kCompartments] = {};   // dose the last access counted for, to settle "took" on return
  int8_t last_slot_[kCompartments] = {-1, -1, -1, -1};
};

}  // namespace lyra
