// Insight engine: turns the dose log into the results Lyra shows on its
// screen and sends to the caregiver.
//
// Every result carries the sample size it was computed from, and a result is
// only *shown* when it passes the minimum-evidence rule written next to it.
// Lyra never shows a pattern it cannot back with data.
#pragma once
#include <vector>

#include "lyra/types.h"

namespace lyra {

// ---- 1. Adherence (standard electronic-monitoring measures) ---------------
struct Adherence {
  int planned = 0;        // doses planned in the period
  int taken = 0;          // doses fully taken (on time or late)
  int on_time = 0;        // taken within ±on_time_min of due
  int days = 0;
  int correct_days = 0;   // days where every dose was taken in full
  int missed_away = 0;    // missed while nobody was home
  int missed_forgot = 0;  // missed although the person was near Lyra
  float takingPct() const { return planned ? 100.0f * taken / planned : 0; }
  float timingPct() const { return planned ? 100.0f * on_time / planned : 0; }
  float correctDaysPct() const { return days ? 100.0f * correct_days / days : 0; }
};
// Closed days in [from_day, to_day]. med = -1 for all medicines.
Adherence adherence(const std::vector<DoseRecord>& h, int32_t from_day, int32_t to_day, int med = -1);

// ---- 2. Personal rhythm ---------------------------------------------------
// When does this person actually take the dose of a slot?
struct Rhythm {
  int n = 0;
  int median_offset = 0;  // minutes after due (negative = early)
  int iqr = 0;            // spread, minutes
};
Rhythm rhythm(const std::vector<DoseRecord>& h, int slot, int32_t from_day, int32_t to_day);

// Shift the reminder toward the person's own time, so Lyra stays silent when
// they are on track. Shown/used only with n ≥ 7 and IQR ≤ 60 min.
int suggestedShift(const Rhythm& r);

// ---- 3. Routine drift -----------------------------------------------------
// Last 7 days vs the 21 days before. Flag when the median moved ≥ 45 min and
// by more than 1.5× the usual spread (n_recent ≥ 5, n_base ≥ 10).
struct Drift {
  bool flagged = false;
  int base_min = 0;       // usual take time (minute of day)
  int recent_min = 0;
  int n_base = 0, n_recent = 0;
};
Drift drift(const std::vector<DoseRecord>& h, int slot, int32_t today);

// ---- 4. Miss pattern --------------------------------------------------------
// A weekday+slot missed ≥ 3 times in the last 4 weeks.
struct MissPattern {
  bool flagged = false;
  int weekday = 0;        // 0 = Monday
  int slot = 0;
  int misses = 0;
  int occurrences = 0;
};
MissPattern missPattern(const std::vector<DoseRecord>& h, int32_t today, int day0_weekday);

// ---- 5. Storage conditions -------------------------------------------------
struct StorageReport {
  int hours = 0;
  int hours_hot = 0;      // above max_c
  int hours_humid = 0;    // above max_rh
  float peak_c = 0;
};
StorageReport storage(const std::vector<HourSample>& s, float max_c = 30.0f, float max_rh = 75.0f);

// ---- 6. Daily activity check (living-alone safety) ---------------------------
// Minute of day someone was first seen near Lyra; -1 if not yet.
int firstSeenMinute(const std::vector<HourSample>& s, int32_t day);

}  // namespace lyra
