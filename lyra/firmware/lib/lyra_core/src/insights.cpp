#include "lyra/insights.h"

#include <algorithm>
#include <cmath>
#include <cstdlib>

namespace lyra {

namespace {

bool closed(const DoseRecord& r) {
  return r.status == DoseStatus::Taken || r.status == DoseStatus::TakenLate ||
         r.status == DoseStatus::Missed || r.status == DoseStatus::Partial;
}

int quantile(std::vector<int> v, float q) {
  if (v.empty()) return 0;
  std::sort(v.begin(), v.end());
  const float pos = q * (v.size() - 1);
  const size_t i = static_cast<size_t>(pos);
  const float f = pos - i;
  if (i + 1 >= v.size()) return v.back();
  return static_cast<int>(std::lround(v[i] * (1 - f) + v[i + 1] * f));
}

// Take times (minute of day) for a slot in [from, to].
std::vector<int> takeTimes(const std::vector<DoseRecord>& h, int slot, int32_t from, int32_t to) {
  // One sample per day: the first take of that slot.
  std::vector<int> out;
  int32_t last_day = -1;
  for (const auto& r : h) {
    if (r.slot != slot || r.day < from || r.day > to || r.taken_min < 0) continue;
    if (r.day == last_day) continue;
    last_day = r.day;
    out.push_back(r.taken_min - r.day * kMinPerDay);
  }
  return out;
}

}  // namespace

Adherence adherence(const std::vector<DoseRecord>& h, int32_t from, int32_t to, int med) {
  Adherence a;
  int32_t cur_day = -1;
  bool day_ok = true;
  bool day_seen = false;
  auto flush = [&]() {
    if (!day_seen) return;
    ++a.days;
    if (day_ok) ++a.correct_days;
  };
  for (const auto& r : h) {
    if (r.day < from || r.day > to || !closed(r)) continue;
    if (med >= 0 && r.med != med) continue;
    if (r.day != cur_day) {
      flush();
      cur_day = r.day;
      day_ok = true;
      day_seen = true;
    }
    ++a.planned;
    const bool full = (r.status == DoseStatus::Taken || r.status == DoseStatus::TakenLate) && r.taken == r.planned;
    if (r.status == DoseStatus::Taken || r.status == DoseStatus::TakenLate) ++a.taken;
    if (r.status == DoseStatus::Taken) ++a.on_time;
    if (r.status == DoseStatus::Missed) {
      if (r.miss == MissReason::Away) ++a.missed_away;
      else ++a.missed_forgot;
    }
    if (!full) day_ok = false;
  }
  flush();
  return a;
}

Rhythm rhythm(const std::vector<DoseRecord>& h, int slot, int32_t from, int32_t to) {
  std::vector<int> off;
  for (const auto& r : h)
    if (r.slot == slot && r.day >= from && r.day <= to && r.taken_min >= 0) off.push_back(r.taken_min - r.due_min);
  Rhythm out;
  out.n = static_cast<int>(off.size());
  if (off.empty()) return out;
  out.median_offset = quantile(off, 0.5f);
  out.iqr = quantile(off, 0.75f) - quantile(off, 0.25f);
  return out;
}

int suggestedShift(const Rhythm& r) {
  if (r.n < 7 || r.iqr > 60) return 0;
  // Remind at the person's usual time, but never more than 30 min early or
  // 45 min late relative to the prescribed time.
  return std::clamp(r.median_offset, -30, 45);
}

Drift drift(const std::vector<DoseRecord>& h, int slot, int32_t today) {
  Drift d;
  const auto base = takeTimes(h, slot, today - 28, today - 8);
  const auto recent = takeTimes(h, slot, today - 7, today - 1);
  d.n_base = static_cast<int>(base.size());
  d.n_recent = static_cast<int>(recent.size());
  if (d.n_base < 10 || d.n_recent < 5) return d;
  d.base_min = quantile(base, 0.5f);
  d.recent_min = quantile(recent, 0.5f);
  const int iqr = quantile(base, 0.75f) - quantile(base, 0.25f);
  const int moved = std::abs(d.recent_min - d.base_min);
  d.flagged = moved >= 45 && moved > 1.5f * iqr;
  return d;
}

MissPattern missPattern(const std::vector<DoseRecord>& h, int32_t today, int day0_weekday) {
  // Per day and slot (one entry even with several medicines): 1 = seen, 2 = missed.
  uint8_t cell[28][kSlots] = {};
  for (const auto& r : h) {
    if (r.day < today - 28 || r.day >= today || !closed(r)) continue;
    uint8_t& c = cell[r.day - (today - 28)][r.slot];
    c = std::max<uint8_t>(c, r.status == DoseStatus::Missed ? 2 : 1);
  }
  int miss[7][kSlots] = {};
  int seen[7][kSlots] = {};
  for (int i = 0; i < 28; ++i) {
    const int wd = (((today - 28 + i + day0_weekday) % 7) + 7) % 7;
    for (int s = 0; s < kSlots; ++s) {
      if (cell[i][s]) ++seen[wd][s];
      if (cell[i][s] == 2) ++miss[wd][s];
    }
  }
  MissPattern best;
  for (int w = 0; w < 7; ++w)
    for (int s = 0; s < kSlots; ++s)
      if (miss[w][s] >= 3 && miss[w][s] > best.misses) {
        best = MissPattern{true, w, s, miss[w][s], seen[w][s]};
      }
  return best;
}

StorageReport storage(const std::vector<HourSample>& s, float max_c, float max_rh) {
  StorageReport r;
  for (const auto& x : s) {
    ++r.hours;
    if (x.temp_c > max_c) ++r.hours_hot;
    if (x.rh_pct > max_rh) ++r.hours_humid;
    r.peak_c = std::max(r.peak_c, x.temp_c);
  }
  return r;
}

int firstSeenMinute(const std::vector<HourSample>& s, int32_t day) {
  for (const auto& x : s) {
    if (x.hour_index / 24 != day || x.presence_min == 0) continue;
    return (x.hour_index % 24) * 60 + (60 - x.presence_min);  // best estimate inside the hour
  }
  return -1;
}

}  // namespace lyra
