#include "lyra/bay_detector.h"

#include <cmath>

namespace lyra {

float BayDetector::diffSigma() const {
  // A settled weight is the mean of kWin samples; a before/after pair adds
  // two of those plus two placements (each put-down lands slightly differently).
  const float settled = noise_ / std::sqrt(static_cast<float>(kWin));
  return std::sqrt(2 * settled * settled + 2 * cfg_.place_g * cfg_.place_g);
}

float BayDetector::threshold() const { return std::fmax(0.05f, 4.0f * diffSigma()); }

float countPosterior(float delta, int n, float unit_g, float sigma_meas, float cv) {
  if (unit_g <= 0 || n <= 0) return 0;
  // Each hypothesis k predicts k·unit ± (measurement ⊕ spread of k units).
  float num = 0, den = 0;
  for (int k = 0; k <= n + 3; ++k) {
    const float spread = cv * unit_g * std::sqrt(static_cast<float>(k));
    const float sigma = std::sqrt(sigma_meas * sigma_meas + spread * spread);
    const float z = (delta - k * unit_g) / sigma;
    const float like = std::exp(-0.5f * z * z) / sigma;
    den += like;
    if (k == n) num = like;
  }
  return den > 0 ? num / den : 0;
}

float BayDetector::countConfidence(float delta, int n) const {
  return countPosterior(delta, n, pill_g_, diffSigma(), cfg_.pill_cv);
}

BayEvent BayDetector::classify(float before, float after, uint32_t t_ms) const {
  BayEvent e;
  e.t_ms = t_ms;
  e.before_g = before;
  e.after_g = after;
  e.delta_g = before - after;
  const float d = e.delta_g;

  if (std::fabs(d) < threshold()) {
    e.kind = BayEventKind::NoChange;
    e.confidence = 100;
    return e;
  }

  if (cfg_.steps) {
    e.kind = d > 0 ? BayEventKind::Removed : BayEventKind::Added;
    return e;
  }

  if (d > 0) {
    // Lighter. A dose is at most ~10 units; anything bigger is a different
    // (lighter) container. Unit weight unknown: accept up to a fifth of what
    // was on the bay (a 12 g stick from a 400 g box, a pill from a bottle).
    const bool plausible = pill_g_ > 0 ? d / pill_g_ <= 10.5f : d < std::fmax(5.0f, 0.2f * before);
    if (!plausible) {
      e.kind = BayEventKind::Swapped;
      return e;
    }
    e.kind = BayEventKind::Removed;
  } else {
    e.kind = BayEventKind::Added;
  }

  if (pill_g_ > 0) {
    const float a = std::fabs(d);
    int n = static_cast<int>(std::lround(a / pill_g_));
    if (n == 0) n = 1;  // above noise threshold but under half a pill: a fragment or a halved tablet
    if (n > 127) n = 127;
    e.pills = static_cast<int8_t>(n);
    e.confidence = static_cast<uint8_t>(std::lround(100 * countConfidence(a, n)));
  }
  return e;
}

BayEvent BayDetector::push(float g, uint32_t t) {
  BayEvent none;
  none.t_ms = t;

  buf_[head_] = g;
  head_ = (head_ + 1) % kWin;
  if (n_ < kWin) ++n_;

  // --- nothing (or almost nothing) on the bay -------------------------------
  if (!cfg_.steps && g < cfg_.empty_g) {
    if (state_ == State::Stable || state_ == State::Moving) {
      state_ = State::Lifted;
      lift_ms_ = t;
      left_off_sent_ = false;
      BayEvent e = none;
      e.kind = BayEventKind::Lifted;
      e.before_g = ref_g_;
      return e;
    }
    if (state_ == State::Lifted) {
      if (t - lift_ms_ >= cfg_.emptied_ms) {
        state_ = State::Empty;
        BayEvent e = none;
        e.kind = BayEventKind::Emptied;
        e.before_g = ref_g_;
        return e;
      }
      if (!left_off_sent_ && t - lift_ms_ >= cfg_.left_off_ms) {
        left_off_sent_ = true;
        BayEvent e = none;
        e.kind = BayEventKind::LeftOff;
        e.before_g = ref_g_;
        return e;
      }
    }
    return none;
  }

  // --- something on the bay: wait for a settled window ----------------------
  if (n_ < kWin) return none;
  float lo = buf_[0], hi = buf_[0], sum = 0;
  for (int i = 0; i < kWin; ++i) {
    lo = std::fmin(lo, buf_[i]);
    hi = std::fmax(hi, buf_[i]);
    sum += buf_[i];
  }
  const float mean = sum / kWin;
  const float range = hi - lo;
  // For ~10 Gaussian samples the range is ≈3σ; allow 6σ (min 60 mg).
  const bool settled = range < std::fmax(0.06f, 6.0f * noise_);

  if (!settled) {
    if (state_ == State::Stable && std::fabs(g - ref_g_) > threshold()) state_ = State::Moving;
    return none;
  }

  // Learn noise from quiet windows (range/3 ≈ σ for n=10).
  if (state_ == State::Stable) noise_ += (range / 3.0f - noise_) * 0.02f;

  switch (state_) {
    case State::Empty: {
      state_ = State::Stable;
      ref_g_ = mean;
      if (cfg_.steps) return none;  // first reading of the compartment: just the baseline
      BayEvent e = none;
      e.kind = BayEventKind::Placed;
      e.after_g = mean;
      return e;
    }
    case State::Lifted:
    case State::Moving: {
      const float before = ref_g_;
      state_ = State::Stable;
      ref_g_ = mean;
      return classify(before, mean, t);
    }
    case State::Stable: {
      if (std::fabs(mean - ref_g_) > threshold()) {
        // Changed without an unsettled phase we caught (slow pick): classify.
        const float before = ref_g_;
        ref_g_ = mean;
        return classify(before, mean, t);
      }
      // Follow slow temperature/creep drift.
      ref_g_ += (mean - ref_g_) * 0.05f;
      return none;
    }
  }
  return none;
}

}  // namespace lyra
