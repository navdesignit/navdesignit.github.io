// Bay detector: one per weighing bay.
//
// Input : load-cell grams at ~10 Hz (tared so an empty bay reads ~0 g).
// Output: discrete events — Lifted, Removed(n pills), Added(n), NoChange,
//         Swapped, Placed, Emptied, LeftOff.
//
// The detector only trusts *settled* weights. It compares the settled weight
// before and after an interaction, so hand pressure, knocks and a container
// being carried around never count as a dose.
//
//   Empty ──placed──► Stable ──weight≈0──► Lifted ──settled──► Stable (+event)
//                       │                     │
//                       └─touch──► Moving ────┘ (direct pick from open organiser)
#pragma once
#include "lyra/types.h"

namespace lyra {

// Posterior probability that a weight change `delta` is exactly n units,
// against every other count 0..n+3 (flat prior). `sigma` is the 1σ error of
// a settled before/after pair; `cv` the unit-to-unit spread.
float countPosterior(float delta, int n, float unit_g, float sigma, float cv);

class BayDetector {
 public:
  struct Config {
    float empty_g = 3.0f;          // below this the bay is empty / container lifted
    float noise_g = 0.02f;         // initial per-sample load-cell noise (1σ); learned online
    // Repeatability of one put-down (1σ): eccentric-load error of the cell
    // plus friction in the bay cup. 20 mg is the design target for a 500 g
    // single-point cell under a self-centring cup; measure it in EVT.
    float place_g = 0.02f;
    float pill_cv = 0.04f;         // pill-to-pill weight spread (4 % typical for tablets)
    uint32_t left_off_ms = 10 * 60 * 1000;
    uint32_t emptied_ms = 60 * 60 * 1000;
    // Step mode (compartments holding several items): report every settled
    // change as Removed (lighter) or Added (heavier) with its delta and leave
    // the meaning (bottle lifted, pill taken, tube returned) to the
    // CompartmentTracker. No lift/empty/swap interpretation here.
    bool steps = false;
  };

  BayDetector() = default;
  explicit BayDetector(const Config& c) : cfg_(c), noise_(c.noise_g) {}

  // Smallest weight change accepted as real (4σ of a settled before/after pair).
  float threshold() const;
  float diffSigma() const;  // 1σ of a settled before/after difference

  void setPillWeight(float g) { pill_g_ = g; }
  float pillWeight() const { return pill_g_; }
  float noise() const { return noise_; }
  float settledWeight() const { return ref_g_; }
  bool hasContainer() const { return state_ == State::Stable || state_ == State::Moving; }
  bool isLifted() const { return state_ == State::Lifted; }

  // Feed one sample. Returns an event (kind None most of the time).
  BayEvent push(float grams, uint32_t t_ms);

  // Classify a settled before/after pair. Public for tests.
  BayEvent classify(float before, float after, uint32_t t_ms) const;

  // Posterior probability (0..1) that exactly n pills were removed, given
  // the measured change, load-cell noise, placement error and pill spread.
  float countConfidence(float delta, int n) const;

 private:
  enum class State : uint8_t { Empty, Stable, Moving, Lifted };
  static constexpr int kWin = 10;  // 1 s at 10 Hz

  Config cfg_;
  State state_ = State::Empty;
  float buf_[kWin] = {};
  int n_ = 0, head_ = 0;
  float ref_g_ = 0;        // last settled weight with container on
  float noise_ = 0.02f;    // running estimate of 1σ per-sample noise
  float pill_g_ = 0;
  uint32_t lift_ms_ = 0;
  bool left_off_sent_ = false;
};

}  // namespace lyra
