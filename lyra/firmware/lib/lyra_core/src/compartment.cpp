#include "lyra/compartment.h"

#include <cmath>

#include "lyra/bay_detector.h"

namespace lyra {

namespace {
float gaussLike(float x, float mu, float sigma) {
  const float z = (x - mu) / sigma;
  return std::exp(-0.5f * z * z) / sigma;
}
}  // namespace

float CompartmentTracker::unitSigma(float unit, int n) const {
  const float spread = kCv * unit * std::sqrt(static_cast<float>(n));
  return std::sqrt(sigma_ * sigma_ + spread * spread);
}

BayEvent CompartmentTracker::usedEvent(const DoseEngine& eng, int m, float used, int32_t now) const {
  // Turn "this much came out of item m" into a detector-style event.
  (void)now;
  const Medicine& md = eng.med(m);
  BayEvent e;
  e.delta_g = used;
  const float thr = std::fmax(0.05f, 4 * sigma_);
  if (used < thr) {
    e.kind = BayEventKind::NoChange;
    e.confidence = 100;
    return e;
  }
  e.kind = BayEventKind::Removed;
  const float unit = eng.detectorUnitG(m);
  if (md.form == Form::Pouch || md.form == Form::Topical || unit <= 0) return e;  // engine matches pouches / learns units
  int n = static_cast<int>(std::lround(used / unit));
  if (n < 1) n = 1;
  e.pills = static_cast<int8_t>(n);
  e.confidence = static_cast<uint8_t>(std::lround(100 * countPosterior(used, n, unit, sigma_, kCv)));
  return e;
}

TrackerResult CompartmentTracker::onStep(DoseEngine& eng, const BayEvent& step, int32_t now) {
  const float d = step.delta_g;  // + weight left, - weight came back
  if (step.kind == BayEventKind::NoChange) {
    // Hands were in the compartment but nothing measurable left: a light
    // tablet popped from its card, or just a touch. During a dose window,
    // ask about what is due here; otherwise ignore.
    TrackerResult r;
    uint16_t due = 0;
    int n_due = 0, only = -1;
    for (int m = 0; m < kMaxMeds; ++m) {
      const Medicine& md = eng.med(m);
      if (!md.active || md.bay != comp_ || md.form == Form::Topical || !eng.hasOpenDose(m, now)) continue;
      due |= 1u << m;
      ++n_due;
      only = m;
    }
    if (n_due == 0 || n_held_ > 0) return r;
    if (n_due == 1) {  // the engine asks "did you take it?"
      r.kind = TrackerResult::Kind::ToEngine;
      r.med = static_cast<int8_t>(only);
      r.event = step;
      return r;
    }
    r.kind = TrackerResult::Kind::Ask;
    r.candidates = due;
    return r;
  }
  if (d < 0) return returned(eng, -d, now);

  // 1. A whole container lifted?
  int best = -1, count = 0;
  uint16_t cands = 0;
  float best_err = 1e9f;
  for (int m = 0; m < kMaxMeds; ++m) {
    const Medicine& md = eng.med(m);
    if (!md.active || md.bay != comp_ || md.container_g < kMinContainerG) continue;
    const float err = std::fabs(d - md.container_g);
    if (err <= containerTol(md.container_g)) {
      ++count;
      cands |= 1u << m;
      if (err < best_err) best_err = err, best = m;
    }
  }
  if (count == 0 || n_held_ >= 3) return unitsOut(eng, d, now);

  // 2. It could also be units of a due item (a stick weighs like a bottle of drops).
  const UnitScore u = scoreUnits(eng, d, now);
  Held& h = held_[n_held_++];
  h = Held{};
  h.g = d;
  h.since = now;
  if (count == 1) h.med = static_cast<int8_t>(best);
  else h.cands = cands;  // look-alike containers: decide when it comes back
  if (u.best >= 0 && u.p >= kSure && eng.hasOpenDose(u.best, now)) h.alt_med = static_cast<int8_t>(u.best);
  TrackerResult r;
  r.kind = TrackerResult::Kind::Lifted;
  r.med = h.med;
  r.candidates = cands;
  r.delta_g = d;
  r.provisional = h.alt_med >= 0;
  return r;
}

CompartmentTracker::UnitScore CompartmentTracker::scoreUnits(const DoseEngine& eng, float d, int32_t now) const {
  // Posterior over (item, count). Pouches: one or two pouches of any time
  // (the engine then checks it is the right time). Topical items never lose
  // countable units.
  UnitScore u;
  float best_like[kMaxMeds] = {};
  for (int m = 0; m < kMaxMeds; ++m) {
    const Medicine& md = eng.med(m);
    if (!md.active || md.bay != comp_ || md.form == Form::Topical) continue;
    const bool due = eng.hasOpenDose(m, now);
    const float prior = due ? kDuePrior : 1.0f;
    if (md.form == Form::Pouch) {
      bool any = false;
      for (int k = 0; k < kSlots; ++k) {
        const float w = md.slot_unit_g[k];
        if (!md.per_slot[k] || w <= 0) continue;
        any = true;
        for (int n = 1; n <= 2; ++n) {
          const float sg = std::sqrt(sigma_ * sigma_ + n * 0.05f * 0.05f);  // pouch-to-pouch ≈ 50 mg
          if (std::fabs(d - n * w) > 4 * sg) continue;
          const float like = prior * gaussLike(d, n * w, sg);
          u.post[m] += like;
          if (like > best_like[m]) best_like[m] = like, u.best_n[m] = n;
        }
      }
      // The time due now hasn't had its pouch weighed yet: this may well be it.
      const int slot = eng.openSlot(m, now);
      const bool due_slot_unknown = slot >= 0 && md.slot_unit_g[slot] <= 0;
      if ((!any || due_slot_unknown) && due && d >= DoseEngine::kPouchMinG && d <= DoseEngine::kPouchMaxG)
        u.due_unknown |= 1u << m, ++u.n_due_unknown;
    } else {
      const float unit = eng.detectorUnitG(m);
      if (unit <= 0) {
        if (due) u.due_unknown |= 1u << m, ++u.n_due_unknown;
        continue;
      }
      // People take the planned count far more often than any other.
      const int planned = eng.remainingDue(m, now);
      for (int n = 1; n <= 4; ++n) {
        const float sg = unitSigma(unit, n);
        if (std::fabs(d - n * unit) > 4 * sg) continue;
        const int expect = planned > 0 ? planned : 1;  // an extra dose is usually one unit
        const float count_prior = n == expect ? 1.0f : 0.1f;
        const float like = prior * count_prior * gaussLike(d, n * unit, sg);
        u.post[m] += like;
        if (like > best_like[m]) best_like[m] = like, u.best_n[m] = n;
      }
    }
    u.total += u.post[m];
  }
  for (int m = 0; m < kMaxMeds; ++m)
    if (u.post[m] > 0 && (u.best < 0 || u.post[m] > u.post[u.best])) u.best = m;
  if (u.best >= 0) u.p = u.post[u.best] / u.total;
  return u;
}

TrackerResult CompartmentTracker::unitsFor(DoseEngine& eng, int m, float d, float p, int n) {
  TrackerResult r;
  r.kind = TrackerResult::Kind::ToEngine;
  r.med = static_cast<int8_t>(m);
  r.delta_g = d;
  r.event.kind = BayEventKind::Removed;
  r.event.delta_g = d;
  const Medicine& md = eng.med(m);
  const float unit = eng.detectorUnitG(m);
  if (md.form != Form::Pouch && unit > 0 && n > 0) {
    r.event.pills = static_cast<int8_t>(n);
    // Count confidence within the item × confidence it is this item.
    r.event.confidence = static_cast<uint8_t>(std::lround(100 * p * countPosterior(d, n, unit, sigma_, kCv)));
  }
  eng.med(m).container_g -= d;
  return r;
}

TrackerResult CompartmentTracker::unitsOut(DoseEngine& eng, float d, int32_t now) {
  const UnitScore u = scoreUnits(eng, d, now);
  TrackerResult r;
  r.delta_g = d;
  // A due pouch time still learning its weight takes precedence: the engine
  // learns it (and still catches a pouch that matches another known time).
  for (int m = 0; m < kMaxMeds; ++m)
    if ((u.due_unknown & (1u << m)) && eng.med(m).form == Form::Pouch) return unitsFor(eng, m, d, 1.0f, 0);
  if (u.best < 0) {
    // Nothing known fits. One due item still learning its unit weight gets
    // it; otherwise ask.
    if (u.n_due_unknown == 1)
      for (int m = 0; m < kMaxMeds; ++m)
        if (u.due_unknown & (1u << m)) return unitsFor(eng, m, d, 1.0f, 0);
    r.kind = TrackerResult::Kind::Ask;
    for (int m = 0; m < kMaxMeds; ++m)
      if (eng.med(m).active && eng.med(m).bay == comp_ && eng.hasOpenDose(m, now)) r.candidates |= 1u << m;
    if (!r.candidates)
      for (int m = 0; m < kMaxMeds; ++m)
        if (eng.med(m).active && eng.med(m).bay == comp_) r.candidates |= 1u << m;
    return r;
  }
  // A light tablet (< 150 mg) can't carry an identification on its own weight
  // when something else is due here too: ask "which one?", never "did you
  // take <light pill>?".
  bool other_due = false;
  for (int m = 0; m < kMaxMeds; ++m)
    if (m != u.best && eng.med(m).active && eng.med(m).bay == comp_ && eng.hasOpenDose(m, now)) other_due = true;
  const bool light = eng.med(u.best).form == Form::Pill && eng.detectorUnitG(u.best) < kMinIdentifyUnitG;
  // An item due here whose unit weight is still unknown could explain any
  // step: then no identification is silent.
  const bool unknown_due = u.n_due_unknown > 0 && !(u.due_unknown & (1u << u.best));
  if (u.p >= kSure && !(light && other_due) && !unknown_due) return unitsFor(eng, u.best, d, u.p, u.best_n[u.best]);
  r.kind = TrackerResult::Kind::Ask;
  for (int m = 0; m < kMaxMeds; ++m) {
    const Medicine& md = eng.med(m);
    // Likely items, plus everything due in this compartment (the list is
    // shown most-likely first; the person can always pick the true one).
    if (u.post[m] / u.total >= 0.05f || (md.active && md.bay == comp_ && eng.hasOpenDose(m, now))) r.candidates |= 1u << m;
  }
  return r;
}

TrackerResult CompartmentTracker::returned(DoseEngine& eng, float w, int32_t now) {
  TrackerResult r;
  r.delta_g = -w;
  // Which held item came back? The one whose lifted weight is just above what
  // returned (it can only have lost weight while in the hand).
  // Last in, first out: people put back what they picked up most recently.
  int hi = -1;
  for (int i = n_held_ - 1; i >= 0 && hi < 0; --i) {
    const float used = held_[i].g - w;
    if (used < -containerTol(held_[i].g) || used > 0.5f * held_[i].g) continue;
    hi = i;
  }
  if (hi < 0) {
    // Nothing was in hand: units put back (an extra pill returned), or a new item.
    for (int m = 0; m < kMaxMeds; ++m) {
      const Medicine& md = eng.med(m);
      if (!md.active || md.bay != comp_ || md.form == Form::Topical || md.form == Form::Pouch) continue;
      const float unit = eng.detectorUnitG(m);
      if (unit <= 0) continue;
      const int n = static_cast<int>(std::lround(w / unit));
      if (n >= 1 && n <= 4 && countPosterior(w, n, unit, sigma_, kCv) >= kSure) {
        r.kind = TrackerResult::Kind::ToEngine;
        r.med = static_cast<int8_t>(m);
        r.event.kind = BayEventKind::Added;
        r.event.delta_g = -w;
        r.event.pills = static_cast<int8_t>(n);
        eng.med(m).container_g += w;
        return r;
      }
    }
    // A pouch put back, or something new: the engine's put-back window or a
    // "new item?" question handles it.
    for (int m = 0; m < kMaxMeds; ++m) {
      const Medicine& md = eng.med(m);
      if (md.active && md.bay == comp_ && md.form == Form::Pouch && w <= DoseEngine::kPouchMaxG) {
        r.kind = TrackerResult::Kind::ToEngine;
        r.med = static_cast<int8_t>(m);
        r.event.kind = BayEventKind::Added;
        r.event.delta_g = -w;
        eng.med(m).container_g += w;
        return r;
      }
    }
    r.kind = TrackerResult::Kind::Unknown;
    return r;
  }

  const Held h = held_[hi];
  for (int i = hi; i + 1 < n_held_; ++i) held_[i] = held_[i + 1];
  --n_held_;
  const float used = h.g - w;

  int m = h.med;
  if (m < 0) {
    // Look-alike containers: let the amount used decide (an aspirin card
    // loses 0.13 g, a stomach-tablet card 0.45 g), preferring due items.
    float post[kMaxMeds] = {};
    float total = 0;
    for (int c = 0; c < kMaxMeds; ++c) {
      if (!(h.cands & (1u << c))) continue;
      const float prior = eng.hasOpenDose(c, now) ? kDuePrior : 1.0f;
      const float unit = eng.detectorUnitG(c);
      float like = 0;
      if (eng.med(c).form == Form::Topical || unit <= 0) {
        like = gaussLike(used, 0, std::fmax(sigma_, 0.1f));
      } else {
        for (int n = 0; n <= 4; ++n) like += gaussLike(used, n * unit, unitSigma(unit, n > 0 ? n : 1));
      }
      post[c] = prior * like;
      total += post[c];
    }
    int best = -1;
    for (int c = 0; c < kMaxMeds; ++c)
      if (post[c] > 0 && (best < 0 || post[c] > post[best])) best = c;
    if (best < 0 || post[best] / total < kSure) {
      r.kind = TrackerResult::Kind::Ask;
      r.candidates = h.cands;
      r.delta_g = used;
      for (int c = 0; c < kMaxMeds; ++c)
        if (h.cands & (1u << c)) eng.med(c).container_g = std::fabs(eng.med(c).container_g - h.g) < containerTol(h.g) ? w : eng.med(c).container_g;
      return r;
    }
    m = best;
  }
  eng.med(m).container_g = w;
  r.kind = TrackerResult::Kind::ToEngine;
  r.med = static_cast<int8_t>(m);
  r.event = usedEvent(eng, m, used, now);
  return r;
}

TrackerResult CompartmentTracker::tick(DoseEngine& eng, int32_t now) {
  TrackerResult r;
  for (int i = 0; i < n_held_; ++i) {
    Held& h = held_[i];
    if (now - h.since >= kForgetMin) {  // warned long ago; it will be recognised when it comes back
      for (int j = i; j + 1 < n_held_; ++j) held_[j] = held_[j + 1];
      --n_held_;
      --i;
      continue;
    }
    if (h.alt_med >= 0 && now - h.since >= kNoReturnMin) {
      // Nothing came back: it was units of the alternative item after all.
      const Held gone = h;
      for (int j = i; j + 1 < n_held_; ++j) held_[j] = held_[j + 1];
      --n_held_;
      const UnitScore u = scoreUnits(eng, gone.g, now);
      const int m = gone.alt_med;
      return unitsFor(eng, m, gone.g, u.total > 0 ? u.post[m] / u.total : 1.0f, u.best_n[m]);
    }
    if (!h.warned && now - h.since >= kLeftOffMin) {
      h.warned = true;
      r.kind = TrackerResult::Kind::LeftOff;
      r.med = h.med;
      r.candidates = h.cands;
      return r;
    }
  }
  return r;
}

}  // namespace lyra
