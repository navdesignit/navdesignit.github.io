// Session recorder + analysis.
//
// During a sitting the recorder keeps:
//   - every breath (interval, depth)
//   - a 1 Hz series of filtered breath displacement, heart rate and motion
// At the end, analyze() turns that into a SessionResult: Arrival, Resonance,
// Stillness, Regularity and the Depth score.
#pragma once
#include <vector>

#include "lyra/breath.h"
#include "lyra/types.h"

namespace lyra {

class SessionRecorder {
 public:
  void begin(uint32_t t_ms, uint32_t epoch, uint8_t hour);
  // Radar frames at kRadarHz. Returns true when a breath completed.
  bool push(const RadarFrame& f);
  void pushEnv(const EnvSample& e);

  // Baseline = breathing rate while settling in (the calibration phase).
  void markBaselineEnd();

  // Live values for the in-session screen.
  float liveBpm() const;               // median rate over the last 5 breaths
  uint32_t elapsed_s() const { return (now_ms_ - t0_ms_) / 1000; }
  const std::vector<Breath>& breaths() const { return breaths_; }

  SessionResult analyze() const;

 private:
  BreathEngine engine_;
  uint32_t t0_ms_ = 0, now_ms_ = 0, epoch_ = 0;
  uint8_t hour_ = 0;
  size_t baseline_breaths_ = 0;
  uint32_t baseline_end_ms_ = 0;

  std::vector<Breath> breaths_;
  std::vector<float> sec_breath_, sec_hr_, sec_motion_;  // 1 Hz series
  std::vector<EnvSample> env_;

  // 1 Hz accumulators
  float acc_b_ = 0, acc_hr_ = 0, acc_m_ = 0;
  int acc_n_ = 0, acc_hr_n_ = 0;
};

// ---- pieces of the analysis, exposed for tests and the simulator ----

float median(std::vector<float> v);

// Seconds from session start until breathing "arrives": slower than the
// baseline and steady, held for the following kHold breaths. -1 if never.
int arrivalSeconds(const std::vector<Breath>& breaths, uint32_t t0_ms,
                   float baseline_bpm, size_t skip_breaths);

// Breath-heart coherence: how strongly heart rate rises and falls with each
// breath (respiratory sinus arrhythmia), measured contactlessly. 0..1.
float resonance(const std::vector<float>& breath_1hz, const std::vector<float>& hr_1hz);

// 1 - coefficient of variation of breath intervals, clamped to 0..1.
float regularity(const std::vector<Breath>& breaths, size_t from);

uint8_t depthScore(float baseline_bpm, float end_bpm, float regularity,
                   float resonance, float stillness);

}  // namespace lyra
