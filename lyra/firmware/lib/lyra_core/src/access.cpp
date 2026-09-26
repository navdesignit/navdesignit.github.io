#include "lyra/access.h"

#include <algorithm>
#include <cmath>
#include <cstdlib>

namespace lyra {

// ------------------------------------------------------------------ detector

float AccessDetector::threshold() const {
  const float settled = cfg_.noise_g / std::sqrt(static_cast<float>(kWin));
  const float pair = std::sqrt(2 * settled * settled + 2 * cfg_.place_g * cfg_.place_g);
  return std::fmax(0.05f, 4 * pair);
}

bool AccessDetector::push(float g, uint32_t t, bool lid_open) {
  buf_[head_] = g;
  head_ = (head_ + 1) % kWin;
  if (n_ < kWin) ++n_;
  const uint32_t dt = prev_ms_ ? t - prev_ms_ : 0;
  prev_ms_ = t;
  if (n_ < kWin) return false;

  float lo = buf_[0], hi = buf_[0], sum = 0;
  for (float v : buf_) {
    lo = std::fmin(lo, v);
    hi = std::fmax(hi, v);
    sum += v;
  }
  const float mean = sum / kWin;
  const bool settled = hi - lo < std::fmax(0.06f, 6 * cfg_.noise_g);
  if (settled) level_ = mean;
  // A hand in the compartment presses or lifts by grams; noise is milligrams.
  // Measured sample by sample against the last settled level, so a knock
  // counts only for the tenths of a second it lasts.
  const bool hand = std::fabs(g - level_) > std::fmax(0.2f, 8 * cfg_.noise_g) || (cfg_.has_lid && lid_open);

  switch (state_) {
    case State::Starting:
      if (settled) {
        ref_ = level_;
        state_ = State::Idle;
      }
      return false;

    case State::Idle:
      if (!hand && !(settled && std::fabs(level_ - ref_) > threshold())) {
        if (settled) ref_ += (level_ - ref_) * 0.05f;  // follow slow drift
        return false;
      }
      state_ = State::Active;
      start_ms_ = t;
      last_busy_ms_ = t;
      busy_ms_ = 0;
      return false;

    case State::Active: {
      if (hand) busy_ms_ += dt;
      // Only a real disturbance restarts the quiet timer: hand pressure, or a
      // wobble of 0.3 g+ (an item being put down). A noise blip that briefly
      // widens the window by a few milligrams does not.
      if (hand || hi - lo > std::fmax(0.3f, 15 * cfg_.noise_g)) last_busy_ms_ = t;
      if (!settled || t - last_busy_ms_ < cfg_.quiet_ms) return false;
      // Settled and quiet: the interaction is over.
      state_ = State::Idle;
      const float net = ref_ - level_;
      ref_ = level_;
      const bool changed = std::fabs(net) > threshold();
      if (!changed && busy_ms_ < cfg_.min_touch_ms) return false;  // a knock
      last_ = Access{comp_, start_ms_, last_busy_ms_, net, net > threshold()};
      return true;
    }
  }
  return false;
}

// ------------------------------------------------------------------ engine

AccessEngine::Day* AccessEngine::dayRec(int32_t day) {
  for (auto& d : days_)
    if (d.day == day) return &d;
  return nullptr;
}

const AccessEngine::Cell& AccessEngine::cell(int32_t day, int slot, int comp) const {
  static const Cell none;
  for (const auto& d : days_)
    if (d.day == day) return d.c[slot][comp];
  return none;
}

int AccessEngine::lateLimit(int slot, int comp) const {
  // "Skip it if it's almost time for the next one": never past half the gap
  // to the next dose time that needs the same compartment.
  int gap = 0;
  for (int k = slot + 1; k < kSlots && !gap; ++k)
    if (cfg_.need[k] & (1u << comp)) gap = cfg_.slot_min[k] - cfg_.slot_min[slot];
  for (int k = 0; k <= slot && !gap; ++k)
    if (cfg_.need[k] & (1u << comp)) gap = kMinPerDay - cfg_.slot_min[slot] + cfg_.slot_min[k];
  return std::min<int>(cfg_.default_late_min, gap / 2);
}

bool AccessEngine::open(int32_t day, int slot, int comp, int32_t now) const {
  const int32_t d = due(day, slot);
  return now >= d - cfg_.early_min && now <= d + lateLimit(slot, comp);
}

void AccessEngine::beginDay(int32_t day) {
  if (day == today_) return;
  today_ = day;
  if (!dayRec(day)) {
    Day d{};
    d.day = day;
    for (int k = 0; k < kSlots; ++k)
      for (int c = 0; c < kCompartments; ++c)
        if (cfg_.need[k] & (1u << c)) d.c[k][c].mark = Mark::Upcoming;
    days_.push_back(d);
    if (days_.size() > 400) days_.erase(days_.begin());
  }
  for (int k = 0; k < kSlots; ++k) last_level_[k] = 0, voices_[k] = 0;
}

AccessEngine::Output AccessEngine::onAccess(const Access& a, int32_t now) {
  Output out;
  const int c = a.comp;
  out.comp = static_cast<int8_t>(c);
  out.at = now;
  out.took = a.took;

  // Weight came in soon after an access: the bottle or tube went back.
  if (a.net_g < -threshold_g && now - last_access_[c] <= cfg_.return_merge_min) {
    // Did it come back lighter? That, not the lift, says whether something was taken.
    const bool took = last_net_[c] + a.net_g > threshold_g;
    if (last_slot_[c] >= 0)
      if (Day* d = dayRec(last_day_[c])) d->c[last_slot_[c]][c].took = took;
    out.took = took;
    out.notice = NoticeKind::Returned;
    log_.push_back({now, static_cast<uint8_t>(c), false, a.net_g, -1, out.notice});
    return out;
  }
  last_access_[c] = now;
  last_net_[c] = a.net_g;
  last_slot_[c] = -1;

  // Which dose time does this count for? The open one that needs this
  // compartment and isn't done yet, nearest to its due time (today or the
  // late end of yesterday's bedtime).
  Cell* best = nullptr;
  int best_slot = -1;
  int32_t best_day = 0;
  int32_t best_dist = 1 << 30;
  for (int32_t day : {today_ - 1, today_}) {
    Day* d = dayRec(day);
    if (!d) continue;
    for (int k = 0; k < kSlots; ++k) {
      Cell& x = d->c[k][c];
      if (!(cfg_.need[k] & (1u << c)) || x.mark == Mark::Done || x.mark == Mark::Missed) continue;
      if (!open(day, k, c, now)) continue;
      const int32_t dist = std::abs(now - due(day, k));
      if (dist < best_dist) best = &x, best_slot = k, best_day = day, best_dist = dist;
    }
  }
  if (best) {
    last_day_[c] = best_day;
    last_slot_[c] = static_cast<int8_t>(best_slot);
    best->mark = Mark::Done;
    best->at = now;
    best->took = a.took;
    out.notice = NoticeKind::Opened;
    out.slot = static_cast<int8_t>(best_slot);
    const Day* d = dayRec(today_);
    for (int cc = 0; cc < kCompartments; ++cc)
      if (d && (cfg_.need[best_slot] & (1u << cc)) && d->c[best_slot][cc].mark != Mark::Done) out.remaining |= 1u << cc;
    log_.push_back({now, static_cast<uint8_t>(c), a.took, a.net_g, out.slot, out.notice});
    return out;
  }

  // Nothing open for this compartment. Opened again in a dose time that is
  // already done? Otherwise say when it is next needed.
  for (int32_t day : {today_, today_ - 1}) {
    const Day* d = dayRec(day);
    if (!d) continue;
    for (int k = kSlots - 1; k >= 0; --k) {
      const Cell& x = d->c[k][c];
      if (x.mark == Mark::Done && now - x.at <= 12 * 60 && open(day, k, c, now)) {
        out.notice = NoticeKind::OpenedAgain;
        out.slot = static_cast<int8_t>(k);
        out.at = x.at;
        log_.push_back({now, static_cast<uint8_t>(c), a.took, a.net_g, -1, out.notice});
        return out;
      }
    }
  }
  out.notice = NoticeKind::NotScheduled;
  for (int i = 1; i <= 2 * kSlots; ++i) {  // next dose time needing this compartment
    const int k = (i - 1) % kSlots;
    const int32_t day = today_ + (i - 1) / kSlots;
    const int32_t when = due(day, k);
    if ((cfg_.need[k] & (1u << c)) && when > now) {
      out.slot = static_cast<int8_t>(k);
      out.at = when;
      break;
    }
  }
  log_.push_back({now, static_cast<uint8_t>(c), a.took, a.net_g, -1, out.notice});
  return out;
}

AccessEngine::Output AccessEngine::tick(int32_t now, bool present) {
  Output out;
  if (dayOf(now) != today_) beginDay(dayOf(now));

  int group = -1;
  int32_t group_due = 0;
  for (int32_t day : {today_ - 1, today_}) {
    Day* d = dayRec(day);
    if (!d) continue;
    for (int k = 0; k < kSlots; ++k) {
      bool missed_here = false, loud = false;
      for (int c = 0; c < kCompartments; ++c) {
        Cell& x = d->c[k][c];
        if (x.mark != Mark::Upcoming && x.mark != Mark::Due) continue;
        const int32_t du = due(day, k);
        if (now >= du && x.mark == Mark::Upcoming) x.mark = Mark::Due;
        if (x.mark == Mark::Due && present) x.seen_home = true;
        if (now > du + lateLimit(k, c)) {
          x.mark = Mark::Missed;
          x.why = x.seen_home ? MissReason::Home : MissReason::Away;
          missed_here = true;
          if (!(cfg_.quiet_comps & (1u << c))) {
            loud = true;
            out.comp = static_cast<int8_t>(c);
            out.why = x.why;
          }
          continue;
        }
        if (x.mark == Mark::Due && (group < 0 || du < group_due)) group = k, group_due = du;
      }
      if (missed_here && loud) {  // one notice and one family message per dose time
        out.notice = NoticeKind::Missed;
        out.slot = static_cast<int8_t>(k);
        out.notify_family = true;
      }
    }
  }

  if (group >= 0) {
    out.due_slot = static_cast<int8_t>(group);
    bool loud = false;
    for (int32_t day : {today_ - 1, today_}) {
      Day* d = dayRec(day);
      if (!d || due(day, group) != group_due) continue;
      for (int c = 0; c < kCompartments; ++c) {
        const Mark m = d->c[group][c].mark;
        if (m == Mark::Due) {
          out.glow_mask |= 1u << c;
          if (!(cfg_.quiet_comps & (1u << c))) loud = true;
        }
      }
    }
    const int32_t waited = now - group_due;
    uint8_t level = 1;
    if (present) level = waited >= cfg_.voice_after_min ? 3 : waited >= cfg_.chime_after_min ? 2 : 1;
    if (!loud) level = std::min<uint8_t>(level, 2);  // supplements only: glow + one chime
    out.level = level;
    const bool welcome_back = present && !was_present_ && waited >= cfg_.chime_after_min;
    if (level > last_level_[group] && level >= 2) {
      out.sound = level == 3 ? Sound::Voice : Sound::Chime;
      last_voice_[group] = now;
    } else if (welcome_back) {
      out.sound = loud ? Sound::Voice : Sound::Chime;
      last_voice_[group] = now;
    } else if (level == 3 && voices_[group] < 3 && now - last_voice_[group] >= 10) {
      out.sound = Sound::Voice;
      last_voice_[group] = now;
      ++voices_[group];
    }
    last_level_[group] = static_cast<int8_t>(std::max<int>(last_level_[group], level));
  }
  was_present_ = present;
  return out;
}

}  // namespace lyra
