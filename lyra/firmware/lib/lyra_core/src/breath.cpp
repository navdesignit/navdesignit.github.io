#include "lyra/breath.h"

#include <cmath>

namespace lyra {

namespace {
constexpr float kPi = 3.14159265358979f;
}

void Biquad::lowpass(float fc, float fs, float q) {
  const float w = 2 * kPi * fc / fs, c = std::cos(w), a = std::sin(w) / (2 * q);
  const float a0 = 1 + a;
  b0_ = (1 - c) / 2 / a0;
  b1_ = (1 - c) / a0;
  b2_ = b0_;
  a1_ = -2 * c / a0;
  a2_ = (1 - a) / a0;
}

void Biquad::highpass(float fc, float fs, float q) {
  const float w = 2 * kPi * fc / fs, c = std::cos(w), a = std::sin(w) / (2 * q);
  const float a0 = 1 + a;
  b0_ = (1 + c) / 2 / a0;
  b1_ = -(1 + c) / a0;
  b2_ = b0_;
  a1_ = -2 * c / a0;
  a2_ = (1 - a) / a0;
}

float Biquad::step(float x) {
  const float y = b0_ * x + b1_ * x1_ + b2_ * x2_ - a1_ * y1_ - a2_ * y2_;
  x2_ = x1_; x1_ = x;
  y2_ = y1_; y1_ = y;
  return y;
}

void BreathEngine::reset(float fs) {
  fs_ = fs;
  hp_.highpass(0.08f, fs);
  lp_.lowpass(0.8f, fs);
  hp_.reset();
  lp_.reset();
  y_ = 0;
  amp_ = 0.5f;
  phase_ = 0;
  have_start_ = false;
  cycle_max_ = cycle_min_ = 0;
  warmup_ = 0;
  last_ = Breath{};
}

bool BreathEngine::push(float breath_mm, uint32_t t_ms) {
  y_ = lp_.step(hp_.step(breath_mm));

  // Let the filters settle for 4 s before detecting anything.
  if (warmup_ < static_cast<uint32_t>(4 * fs_)) {
    ++warmup_;
    return false;
  }

  // Running amplitude: slow EMA of |y|. The detection threshold follows it,
  // so shallow meditative breathing is tracked as well as normal breathing.
  amp_ += (std::fabs(y_) - amp_) * (1.0f / (6.0f * fs_));
  const float thr = 0.3f * amp_;

  cycle_max_ = std::fmax(cycle_max_, y_);
  cycle_min_ = std::fmin(cycle_min_, y_);

  bool completed = false;
  if (phase_ <= 0 && y_ > thr) {
    // Inhale start: one full breath cycle has elapsed since the previous one.
    if (have_start_) {
      const float interval = (t_ms - inhale_start_ms_) / 1000.0f;
      const float depth = cycle_max_ - cycle_min_;
      // Reject implausible cycles (coughs, movement artefacts, apnoea gaps).
      if (interval >= 1.5f && interval <= 20.0f && depth > 0.05f) {
        last_ = Breath{t_ms, interval, depth};
        completed = true;
      }
    }
    inhale_start_ms_ = t_ms;
    have_start_ = true;
    cycle_max_ = cycle_min_ = y_;
    phase_ = 1;
  } else if (phase_ >= 0 && y_ < -thr) {
    phase_ = -1;
  }
  return completed;
}

}  // namespace lyra
