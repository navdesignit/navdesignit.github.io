// Sensor HAL: scales, presence radar, room climate.
#pragma once
#include <Arduino.h>
#include <HX711.h>
#include <SensirionI2cSht4x.h>
#include <Wire.h>
#include <ld2410.h>

#include "hal/board.h"
#include "lyra/types.h"

namespace hal {

class Scales {
 public:
  void begin() {
    for (int i = 0; i < lyra::kBays; ++i) {
      cell_[i].begin(board::kScaleDout[i], board::kScaleSck);
      cell_[i].set_gain(128);
    }
  }
  // Factory calibration (stored in NVS): counts per gram and empty offset.
  void setCalibration(int bay, float counts_per_g, long offset) {
    cell_[bay].set_scale(counts_per_g);
    cell_[bay].set_offset(offset);
  }
  // Non-blocking: returns true and fills `grams` when a new conversion is ready.
  bool read(int bay, float& grams) {
    if (!cell_[bay].is_ready()) return false;
    grams = cell_[bay].get_units(1);
    return true;
  }

 private:
  HX711 cell_[lyra::kBays];
};

class Presence {
 public:
  void begin() {
    Serial1.begin(256000, SERIAL_8N1, board::kRadarRx, board::kRadarTx);
    radar_.begin(Serial1);
  }
  // Someone within ~4 m, moving or still (breathing counts as "still").
  bool present() {
    radar_.read();
    return radar_.presenceDetected() &&
           (radar_.stationaryTargetDistance() < 400 || radar_.movingTargetDistance() < 400);
  }

 private:
  ld2410 radar_;
};

class Climate {
 public:
  void begin() {
    Wire.begin(board::kSda, board::kScl);
    sht_.begin(Wire, SHT40_I2C_ADDR_44);
  }
  bool read(float& temp_c, float& rh) { return sht_.measureHighPrecision(temp_c, rh) == 0; }

 private:
  SensirionI2cSht4x sht_;
};

}  // namespace hal
