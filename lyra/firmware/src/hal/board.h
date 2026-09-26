// Lyra EVT board: ESP32-S3-WROOM-1 N16R8 (16 MB flash, 8 MB PSRAM).
#pragma once
#include <cstdint>

namespace board {

// 4.2" e-paper, 400x300, SSD1683 (GDEY042T81): fast partial refresh.
constexpr int kEpdCs = 10, kEpdDc = 9, kEpdRst = 8, kEpdBusy = 7;
constexpr int kEpdSck = 12, kEpdMosi = 11;

// Four HX711 load-cell ADCs, shared clock, one data line per compartment.
// Cells sized for what each compartment holds:
//   1 sachets 500 g · 2 blisters 300 g · 3 sticks/tubes/drops 1 kg · 4 bottles 1 kg
constexpr int kScaleSck = 4;
constexpr int kScaleDout[4] = {5, 6, 15, 16};
constexpr float kCellNoiseG[4] = {0.02f, 0.015f, 0.04f, 0.04f};   // per-sample 1σ, EVT to confirm
constexpr float kPlaceG[4] = {0.02f, 0.02f, 0.03f, 0.03f};        // put-down repeatability

// Compartment light: 8 warm LEDs under each translucent compartment floor.
constexpr int kLedData = 38;
constexpr int kLedsPerBay = 8;

// Rotary encoder with push (the only control).
constexpr int kEncA = 1, kEncB = 2, kEncSw = 42;

// 24 GHz presence radar (HLK-LD2410C), UART1.
constexpr int kRadarRx = 44, kRadarTx = 43;

// I2C: SHT40 (temperature/humidity), PCF8563 RTC with backup cap.
constexpr int kSda = 39, kScl = 40;

// I2S speaker amp (MAX98357A) for chime and voice prompts.
constexpr int kI2sBclk = 13, kI2sLrc = 14, kI2sDout = 21;

// Power: USB-C 5 V in, 2000 mAh Li-ion backup, fuel gauge on I2C.
constexpr int kUsbSense = 3;

}  // namespace board
