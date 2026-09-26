// Lyra OS — shared data types.
// Portable C++17, no Arduino dependency: the same core runs on the ESP32-S3
// and on a desktop host for tests and the web simulator.
#pragma once
#include <cstdint>

namespace lyra {

// One frame from the 60 GHz radar, delivered at kRadarHz.
struct RadarFrame {
  uint32_t t_ms = 0;
  bool present = false;     // a person is in the sensing cone
  float distance_m = 0;     // range to the chest
  float breath_mm = 0;      // chest displacement (raw, un-filtered)
  float heart_bpm = 0;      // radar heart-rate estimate, 0 if unknown
  float motion = 0;         // body micro-motion energy, 0..1
};

// Room conditions, sampled every few seconds.
struct EnvSample {
  float co2_ppm = 0;
  float temp_c = 0;
  float rh_pct = 0;
  float noise_dba = 0;      // level only; audio is never stored
  float lux = 0;
};

constexpr float kRadarHz = 20.0f;

// One detected breath (inhale start to inhale start).
struct Breath {
  uint32_t t_ms = 0;        // time the breath completed
  float interval_s = 0;     // breath period
  float depth_mm = 0;       // peak-to-trough chest excursion
};

// Everything Lyra learns from one sitting. This is what gets stored,
// drawn on the summary screen and fed into the insight engine.
struct SessionResult {
  uint32_t start_epoch = 0;   // unix seconds
  uint8_t hour = 0;           // local hour the session started
  uint16_t duration_s = 0;

  float baseline_bpm = 0;     // breathing rate while settling in
  float end_bpm = 0;          // breathing rate over the last 2 minutes
  int16_t arrival_s = -1;     // seconds until breath settled, -1 = never
  float resonance = 0;        // breath-heart coherence, 0..1
  float stillness = 0;        // share of time without body motion, 0..1
  float regularity = 0;       // breath rhythm steadiness, 0..1
  uint8_t depth = 0;          // Depth score, 0..100
  int16_t afterglow_min = -1; // minutes calm persisted afterwards, -1 = not measured

  EnvSample env;              // room during the session (median)

  static constexpr int kTraceLen = 48;
  float rate_trace[kTraceLen] = {};  // breaths/min across the session
  static constexpr int kWaveLen = 64;
  int8_t wave[kWaveLen] = {};        // breath waveform fingerprint for the Ink Ring
};

}  // namespace lyra
