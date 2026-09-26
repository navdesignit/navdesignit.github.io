#include "lyra/dose_engine.h"

#include <algorithm>
#include <cmath>
#include <cstdlib>

namespace lyra {

namespace {
bool isOpen(DoseStatus s) {
  return s == DoseStatus::Upcoming || s == DoseStatus::Open || s == DoseStatus::Due ||
         s == DoseStatus::Partial;
}
}  // namespace

int DoseEngine::medAtBay(int bay) const {
  for (int i = 0; i < kMaxMeds; ++i)
    if (meds_[i].active && meds_[i].bay == bay) return i;
  return -1;
}

float DoseEngine::dailyUse(int m) const {
  float s = 0;
  for (int k = 0; k < kSlots; ++k) s += meds_[m].per_slot[k];
  return s;
}

float DoseEngine::daysLeft(int m) const {
  const float use = dailyUse(m);
  if (use <= 0 || meds_[m].stock_pills < 0) return -1;
  return meds_[m].stock_pills / use;
}

int DoseEngine::lateLimit(int m, int slot) const {
  const Medicine& md = meds_[m];
  const int base = md.late_limit_min ? md.late_limit_min : cfg_.default_late_min;
  // "Skip it if it is almost time for the next dose": never extend past half
  // the gap to the next dose of the same medicine.
  int gap = 0;
  for (int k = slot + 1; k < kSlots && !gap; ++k)
    if (md.per_slot[k]) gap = cfg_.slot_min[k] - cfg_.slot_min[slot];
  for (int k = 0; k <= slot && !gap; ++k)
    if (md.per_slot[k]) gap = kMinPerDay - cfg_.slot_min[slot] + cfg_.slot_min[k];
  return std::min(base, gap / 2);
}

void DoseEngine::beginDay(int32_t day) {
  if (day == today_) return;
  today_ = day;
  for (int k = 0; k < kSlots; ++k) {
    last_level_[k] = 0;
    voice_repeats_[k] = 0;
  }
  for (int m = 0; m < kMaxMeds; ++m) {
    if (!meds_[m].active) continue;
    for (int k = 0; k < kSlots; ++k) {
      if (!meds_[m].per_slot[k]) continue;
      DoseRecord r;
      r.day = day;
      r.med = static_cast<uint8_t>(m);
      r.slot = static_cast<uint8_t>(k);
      r.planned = meds_[m].per_slot[k];
      r.due_min = dueMin(day, k);
      hist_.push_back(r);
    }
  }
}

void DoseEngine::closeExpired(int32_t now, EngineOutput& out) {
  for (auto& r : hist_) {
    if (!isOpen(r.status)) continue;
    if (now <= r.due_min + lateLimit(r.med, r.slot)) continue;
    if (r.status == DoseStatus::Partial) continue;  // stays partial: some pills were taken
    r.status = DoseStatus::Missed;
    // r.miss was set to Forgot while the person was seen during the window.
    if (r.miss != MissReason::Forgot) r.miss = MissReason::Away;
    if (meds_[r.med].supplement) continue;  // logged, but no screen notice or alert
    out.notice = Notice::DoseMissed;
    out.notice_med = static_cast<int8_t>(r.med);
    out.notice_min = r.due_min;
    out.notify_caregiver = true;
  }
}

EngineOutput DoseEngine::tick(int32_t now, bool present) {
  EngineOutput out;
  if (dayOf(now) != today_) beginDay(dayOf(now));

  closeExpired(now, out);

  // Advance statuses and find the most overdue slot group.
  int32_t group_due = -1;
  int group_slot = -1;
  for (auto& r : hist_) {
    if (!isOpen(r.status)) continue;
    if (r.status == DoseStatus::Upcoming && now >= r.due_min - cfg_.early_min) r.status = DoseStatus::Open;
    if (r.status == DoseStatus::Open && now >= r.due_min) r.status = DoseStatus::Due;
    if (r.status == DoseStatus::Upcoming || r.status == DoseStatus::Open) continue;
    if (now < remindMin(r)) continue;
    if (present) r.miss = MissReason::Forgot;  // provisional: person was here while it was due
    if (group_due < 0 || r.due_min < group_due) {
      group_due = r.due_min;
      group_slot = r.slot;
    }
  }

  if (group_slot >= 0) {
    out.active_slot = static_cast<int8_t>(group_slot);
    int32_t remind_at = group_due + shift_[group_slot];
    const int32_t waited = now - remind_at;
    uint8_t level = 1;
    if (present) {
      if (waited >= cfg_.voice_after_min) level = 3;
      else if (waited >= cfg_.chime_after_min) level = 2;
    }
    bool group_has_medicine = false;
    for (const auto& r : hist_)
      if (r.due_min == group_due && isOpen(r.status) && !meds_[r.med].supplement) group_has_medicine = true;
    if (!group_has_medicine) level = std::min<uint8_t>(level, 2);  // only supplements left: glow + one chime
    for (auto& r : hist_) {
      if (r.due_min != group_due || !isOpen(r.status)) continue;
      out.glow_mask |= static_cast<uint8_t>(1u << meds_[r.med].bay);
      r.reminded_level = std::max<int16_t>(r.reminded_level, level);
    }
    out.level = level;

    const bool welcome_back = present && !was_present_ && waited >= cfg_.chime_after_min;
    if (level > last_level_[group_slot] && level >= 2) {
      out.sound = level == 3 ? Sound::Voice : Sound::Chime;
      last_voice_min_[group_slot] = now;
    } else if (welcome_back) {
      out.sound = Sound::Voice;
      last_voice_min_[group_slot] = now;
    } else if (level == 3 && voice_repeats_[group_slot] < 3 && now - last_voice_min_[group_slot] >= 10) {
      out.sound = Sound::Voice;
      last_voice_min_[group_slot] = now;
      ++voice_repeats_[group_slot];
    }
    last_level_[group_slot] = static_cast<int8_t>(level);
  }
  was_present_ = present;

  // Extra pills not put back in time → tell the caregiver.
  if (extra_med_ >= 0 && now - extra_min_ > kPutBackWindowMin) {
    out.notify_caregiver = true;
    if (out.notice == Notice::None) {
      out.notice = Notice::ExtraPills;
      out.notice_med = extra_med_;
      out.notice_pills = extra_pills_;
    }
    extra_med_ = -1;
  }

  // Low stock, once per container.
  for (int m = 0; m < kMaxMeds && out.notice == Notice::None; ++m) {
    if (!meds_[m].active || low_stock_sent_[m]) continue;
    const float d = daysLeft(m);
    if (d >= 0 && d <= kLowStockDays) {
      low_stock_sent_[m] = true;
      out.notice = Notice::LowStock;
      out.notice_med = static_cast<int8_t>(m);
      out.notice_min = now + static_cast<int32_t>(d * kMinPerDay);  // run-out time
      out.notify_caregiver = true;
    }
  }
  return out;
}

void DoseEngine::learnPillWeight(int m, float delta, int planned) {
  if (planned <= 0 || delta <= 0) return;
  learn_[m][learn_next_[m]] = delta / planned;
  learn_next_[m] = static_cast<uint8_t>((learn_next_[m] + 1) % 5);
  if (learn_n_[m] < 5) ++learn_n_[m];
  const int n = learn_n_[m];
  if (n < 3) return;
  float v[5] = {};
  for (int i = 0; i < n; ++i) v[i] = learn_[m][i];
  std::sort(v, v + n);
  const float med = v[n / 2];
  // Lock in when three readings agree within 15 %, or when five readings have
  // a consistent middle (outliers from a sloppy put-down are ignored).
  const bool tight = (v[n - 1] - v[0]) / med < 0.15f;
  const bool middle = n == 5 && (v[3] - v[1]) / med < 0.25f;
  if (tight || middle) meds_[m].pill_g = med;
}

DoseRecord* DoseEngine::openDoseFor(int m, int32_t now) {
  DoseRecord* best = nullptr;
  for (auto& r : hist_) {
    if (r.med != m || !isOpen(r.status)) continue;
    if (now < r.due_min - cfg_.early_min || now > r.due_min + lateLimit(m, r.slot)) continue;
    if (!best || std::abs(now - r.due_min) < std::abs(now - best->due_min)) best = &r;
  }
  return best;
}

void DoseEngine::markTaken(DoseRecord& r, int count, int32_t now, EngineOutput& out) {
  Medicine& md = meds_[r.med];
  r.taken = static_cast<uint8_t>(r.taken + count);
  if (r.taken_min < 0) r.taken_min = now;
  if (md.stock_pills >= 0) md.stock_pills = std::max(0.0f, md.stock_pills - count);
  out.notice_med = static_cast<int8_t>(r.med);
  if (r.taken >= r.planned) {
    r.status = std::abs(now - r.due_min) <= cfg_.on_time_min ? DoseStatus::Taken : DoseStatus::TakenLate;
    r.miss = MissReason::None;
    out.notice = Notice::DoseTaken;
    out.notice_min = now;
    out.notice_pills = static_cast<int8_t>(r.taken);
  } else {
    r.status = DoseStatus::Partial;
    out.notice = Notice::PartialDose;
    out.notice_pills = static_cast<int8_t>(r.planned - r.taken);
  }
}

EngineOutput DoseEngine::confirmDose(int32_t now) {
  EngineOutput out;
  if (confirm_med_ < 0 || now - confirm_min_ > kConfirmWindowMin) return out;
  const int m = confirm_med_;
  confirm_med_ = -1;
  if (extra_med_ == m) extra_med_ = -1;  // "yes, it's the right one": nothing to put back
  DoseRecord* r = openDoseFor(m, now);
  if (!r) return out;
  const int count = r->planned - r->taken;
  r->source = DoseSource::UserConfirmed;
  r->confidence = 0;
  markTaken(*r, count, now, out);
  return out;
}

float DoseEngine::detectorUnitG(int m) const {
  const Medicine& md = meds_[m];
  if (md.form != Form::Pouch) return md.pill_g;
  float sum = 0;
  int n = 0;
  for (int k = 0; k < kSlots; ++k)
    if (md.per_slot[k] && md.slot_unit_g[k] > 0) sum += md.slot_unit_g[k], ++n;
  return n ? sum / n : 0;
}

void DoseEngine::extraDose(int m, int count, float grams, int32_t now, EngineOutput& out) {
  // Nothing open for this medicine: say why ("already taken at 8:02" /
  // "not yet, from 18:00") and give 10 minutes to put it back.
  Medicine& md = meds_[m];
  if (md.stock_pills >= 0) md.stock_pills = std::max(0.0f, md.stock_pills - count);
  extra_med_ = static_cast<int8_t>(m);
  extra_pills_ = static_cast<int8_t>(count);
  extra_g_ = grams;
  extra_min_ = now;
  out.notice_med = static_cast<int8_t>(m);
  out.notice_pills = static_cast<int8_t>(count);

  const DoseRecord* last = nullptr;
  for (const auto& r : hist_)
    if (r.med == m && r.taken_min >= 0 && now - r.taken_min <= 12 * 60 && (!last || r.taken_min > last->taken_min)) last = &r;
  if (last) {
    out.notice = Notice::AlreadyTaken;
    out.notice_min = last->taken_min;
    return;
  }
  const DoseRecord* next = nullptr;
  for (const auto& r : hist_)
    if (r.med == m && isOpen(r.status) && r.due_min > now && (!next || r.due_min < next->due_min)) next = &r;
  out.notice = Notice::TooEarly;
  out.notice_min = next ? next->due_min - cfg_.early_min : -1;
}

EngineOutput DoseEngine::onPouchRemoved(int m, const BayEvent& e, int32_t now) {
  // A pouch holds every pill for one dose time, so the pouch is the unit.
  // Pouches for different times weigh differently (different pills inside):
  // match the weight that left against each slot's pouch.
  EngineOutput out;
  out.notice_med = static_cast<int8_t>(m);
  Medicine& md = meds_[m];
  const float d = e.delta_g;
  if (d < kPouchMinG) {  // lighter than any pouch: something else (a pill dropped back?)
    if (openDoseFor(m, now)) {
      confirm_med_ = static_cast<int8_t>(m);
      confirm_min_ = now;
      out.notice = Notice::ConfirmDose;
    } else {
      out.notice_med = -1;
    }
    return out;
  }
  DoseRecord* open = openDoseFor(m, now);
  const auto near = [&](float a, float b) { return std::fabs(a - b) <= kPouchTolG; };

  if (!open) {
    extraDose(m, std::max(1, static_cast<int>(std::lround(d / std::max(0.5f, detectorUnitG(m))))), d, now, out);
    return out;
  }
  const float w = md.slot_unit_g[open->slot];

  if (w <= 0) {
    // Still learning this slot's pouch: accept one plausible pouch and learn it.
    if (d > kPouchMaxG) {
      confirm_med_ = static_cast<int8_t>(m);
      confirm_min_ = now;
      out.notice = Notice::ConfirmDose;
      return out;
    }
    uint8_t& n = pouch_n_[m][open->slot];
    pouch_learn_[m][open->slot][n] = d;
    if (++n == 3) {
      float v[3] = {pouch_learn_[m][open->slot][0], pouch_learn_[m][open->slot][1], pouch_learn_[m][open->slot][2]};
      std::sort(v, v + 3);
      md.slot_unit_g[open->slot] = v[1];
    }
    open->source = DoseSource::Learning;
    open->confidence = 0;
    markTaken(*open, open->planned - open->taken, now, out);
    return out;
  }

  // Nearest known pouch.
  int best_k = -1;
  float best_err = 1e9f;
  for (int k = 0; k < kSlots; ++k) {
    const float wk = md.slot_unit_g[k];
    if (!md.per_slot[k] || wk <= 0) continue;
    const float err = std::fabs(d - wk);
    if (err < best_err) best_err = err, best_k = k;
  }
  if (best_k == open->slot && near(d, w)) {
    md.slot_unit_g[open->slot] += (d - w) * 0.1f;  // keep refining this time's pouch weight
    open->source = DoseSource::Weighed;
    open->confidence = 99;
    markTaken(*open, open->planned - open->taken, now, out);
    return out;
  }
  // Another time's pouch: matches it, and is at least two tolerances away
  // from the right one. The screen still lets her press if the printed time
  // is right (the weight is evidence, the label decides).
  if (best_k >= 0 && best_k != open->slot && best_err <= kPouchTolG && std::fabs(d - w) >= 2 * kPouchTolG) {
    confirm_med_ = static_cast<int8_t>(m);
    confirm_min_ = now;
    out.notice = Notice::WrongPouch;
    out.notice_slot = static_cast<int8_t>(best_k);
    extra_med_ = static_cast<int8_t>(m);
    extra_pills_ = 1;
    extra_g_ = d;
    extra_min_ = now;
    return out;
  }
  // Two pouches: this time's plus another (sum tolerance is √2 wider), or
  // anything clearly heavier than one pouch.
  for (int k = 0; k < kSlots; ++k) {
    const float wk = md.slot_unit_g[k];
    if (!md.per_slot[k] || wk <= 0) continue;
    if (std::fabs(d - (w + wk)) <= 1.5f * kPouchTolG || (k == kSlots - 1 && d > w + 0.6f * detectorUnitG(m))) {
      const float other = std::fabs(d - (w + wk)) <= 1.5f * kPouchTolG ? wk : d - w;
      open->source = DoseSource::Weighed;
      open->confidence = 90;
      markTaken(*open, open->planned - open->taken, now, out);
      out.notice = Notice::ExtraPills;
      out.notice_pills = 1;
      extra_med_ = static_cast<int8_t>(m);
      extra_pills_ = 1;
      extra_g_ = other;
      extra_min_ = now;
      return out;
    }
  }
  // Doesn't match clearly: ask, and the screen asks to check the time
  // printed on the pouch. Until "yes", it counts as a pouch to put back.
  confirm_med_ = static_cast<int8_t>(m);
  confirm_min_ = now;
  extra_med_ = static_cast<int8_t>(m);
  extra_pills_ = 1;
  extra_g_ = d;
  extra_min_ = now;
  out.notice = Notice::ConfirmDose;
  out.notice_slot = static_cast<int8_t>(open->slot);
  return out;
}

EngineOutput DoseEngine::onBayEvent(int bay, const BayEvent& e, int32_t now) {
  EngineOutput out;
  const int m = medAtBay(bay);
  if (m < 0) {
    if (e.kind == BayEventKind::Removed) out.notice = Notice::UnknownBay;
    return out;
  }
  Medicine& md = meds_[m];
  out.notice_med = static_cast<int8_t>(m);

  switch (e.kind) {
    case BayEventKind::Removed: break;  // handled below
    case BayEventKind::NoChange:
      // Opened but nothing measurable left the container. During a dose
      // window that usually means a light pill: ask once instead of guessing.
      if (openDoseFor(m, now)) {
        confirm_med_ = static_cast<int8_t>(m);
        confirm_min_ = now;
        out.notice = Notice::ConfirmDose;
        return out;
      }
      out.notice_med = -1;
      return out;
    case BayEventKind::Added: {
      const bool same_back = md.form == Form::Pouch ? std::fabs(-e.delta_g - extra_g_) <= kPouchTolG : e.pills == extra_pills_;
      if (extra_med_ == m && now - extra_min_ <= kPutBackWindowMin && same_back) {
        // Extra pills went back in: undo them on the dose record.
        for (auto it = hist_.rbegin(); it != hist_.rend(); ++it) {
          if (it->med == m && it->taken > it->planned) {
            it->taken = it->planned;
            break;
          }
        }
        if (md.stock_pills >= 0) md.stock_pills += e.pills;
        extra_med_ = -1;
        out.notice = Notice::PutBackThanks;
        return out;
      }
      if (md.form == Form::Pouch && e.delta_g < -2 * detectorUnitG(m)) {
        // Pharmacy strips aren't topped up: a lot more weight = a new strip.
        low_stock_sent_[m] = false;
        out.notice = Notice::NewContainer;
        return out;
      }
      if (md.stock_pills >= 0 && e.pills > 0) md.stock_pills += e.pills;
      low_stock_sent_[m] = false;
      out.notice = Notice::Refilled;
      out.notice_pills = e.pills;
      return out;
    }
    case BayEventKind::Swapped:
    case BayEventKind::Placed:
      low_stock_sent_[m] = false;
      // Unknown container on this bay: the screen asks "New box of <name>?"
      // and the pill count (knob, or the pack barcode).
      out.notice = Notice::NewContainer;
      return out;
    case BayEventKind::LeftOff:
      out.notice = Notice::LeftOff;
      return out;
    default:
      out.notice_med = -1;
      return out;
  }

  // ---- units removed ---------------------------------------------------------
  if (md.form == Form::Pouch) return onPouchRemoved(m, e, now);

  const bool weight_known = md.pill_g > 0 && e.pills > 0;
  DoseRecord* best = openDoseFor(m, now);

  if (best) {
    const int remaining = best->planned - best->taken;
    // Pills under 150 mg cannot be counted reliably by weight (see the
    // Monte-Carlo table in test/host): the scale only proves the container
    // was opened, so always ask. Heavier pills: ask only when unsure.
    if ((md.pill_g > 0 && md.pill_g < kMinCountablePillG) || (weight_known && e.confidence < cfg_.silent_confidence)) {
      confirm_med_ = static_cast<int8_t>(m);
      confirm_min_ = now;
      out.notice = Notice::ConfirmDose;
      return out;
    }
    if (!weight_known) {
      // Still learning this pill: assume the planned amount was taken.
      learnPillWeight(m, e.delta_g, remaining);
      best->source = DoseSource::Learning;
      best->confidence = 0;
      markTaken(*best, remaining, now, out);
      return out;
    }
    // Keep refining a learned pill weight on clean doses. Only for heavy
    // pills: for light ones the confident readings are a biased (heavy) subset.
    if (!md.calibrated && md.pill_g >= kRefinePillG && e.pills == remaining && e.confidence >= 90)
      md.pill_g += (e.delta_g / e.pills - md.pill_g) * 0.1f;
    best->source = DoseSource::Weighed;
    best->confidence = e.confidence;
    markTaken(*best, e.pills, now, out);
    if (best->taken > best->planned && e.confidence >= 80) {
      out.notice = Notice::ExtraPills;
      out.notice_pills = static_cast<int8_t>(best->taken - best->planned);
      extra_med_ = static_cast<int8_t>(m);
      extra_pills_ = out.notice_pills;
      extra_min_ = now;
    }
    return out;
  }

  // No open dose: an extra dose.
  extraDose(m, weight_known ? e.pills : 1, e.delta_g, now, out);  // unknown weight: "at least one"
  return out;
}

}  // namespace lyra
