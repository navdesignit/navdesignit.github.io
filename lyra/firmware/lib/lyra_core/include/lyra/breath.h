// Breath engine: turns raw radar chest displacement into individual breaths.
//
//   raw mm ──► high-pass 0.08 Hz ──► low-pass 0.8 Hz ──► hysteresis detector ──► Breath
//             (removes posture drift)  (removes heartbeat)  (adaptive threshold)
#pragma once
#include "lyra/types.h"

namespace lyra {

// RBJ biquad, direct form I.
class Biquad {
 public:
  void lowpass(float fc, float fs, float q = 0.7071f);
  void highpass(float fc, float fs, float q = 0.7071f);
  float step(float x);
  void reset() { x1_ = x2_ = y1_ = y2_ = 0; }

 private:
  float b0_ = 1, b1_ = 0, b2_ = 0, a1_ = 0, a2_ = 0;
  float x1_ = 0, x2_ = 0, y1_ = 0, y2_ = 0;
};

class BreathEngine {
 public:
  explicit BreathEngine(float fs = kRadarHz) { reset(fs); }
  void reset(float fs = kRadarHz);

  // Feed one radar sample. Returns true when a breath has just completed;
  // read it with last().
  bool push(float breath_mm, uint32_t t_ms);

  const Breath& last() const { return last_; }
  float filtered() const { return y_; }      // band-passed displacement, mm
  float amplitude() const { return amp_; }   // running breath amplitude, mm

 private:
  Biquad hp_, lp_;
  float fs_ = kRadarHz;
  float y_ = 0;
  float amp_ = 0.5f;
  int phase_ = 0;              // -1 exhale, +1 inhale, 0 unknown
  uint32_t inhale_start_ms_ = 0;
  bool have_start_ = false;
  float cycle_max_ = 0, cycle_min_ = 0;
  uint32_t warmup_ = 0;
  Breath last_;
};

}  // namespace lyra
