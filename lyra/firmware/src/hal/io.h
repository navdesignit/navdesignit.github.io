// User I/O HAL: knob, bay lights, speaker.
#pragma once
#include <Adafruit_NeoPixel.h>
#include <Arduino.h>
#include <ESP32Encoder.h>

#include "hal/board.h"
#include "lyra/types.h"

namespace hal {

enum class KnobEvent : uint8_t { None, Left, Right, Press, LongPress };

class Knob {
 public:
  void begin() {
    ESP32Encoder::useInternalWeakPullResistors = puType::up;
    enc_.attachHalfQuad(board::kEncA, board::kEncB);
    pinMode(board::kEncSw, INPUT_PULLUP);
  }
  KnobEvent poll() {
    const int64_t c = enc_.getCount() / 2;  // one detent = 2 counts
    if (c != last_) {
      const bool right = c > last_;
      last_ = c;
      return right ? KnobEvent::Right : KnobEvent::Left;
    }
    const bool down = digitalRead(board::kEncSw) == LOW;
    const uint32_t now = millis();
    if (down && !down_) down_ms_ = now;
    KnobEvent e = KnobEvent::None;
    if (!down && down_) e = now - down_ms_ >= 1500 ? KnobEvent::LongPress : KnobEvent::Press;
    down_ = down;
    return e;
  }

 private:
  ESP32Encoder enc_;
  int64_t last_ = 0;
  bool down_ = false;
  uint32_t down_ms_ = 0;
};

// Warm light under each bay cup. The due bay "breathes" slowly so the eye
// finds it without reading.
class BayLights {
 public:
  void begin() {
    px_.begin();
    px_.setBrightness(90);
    px_.show();
  }
  void render(uint8_t glow_mask, uint8_t lifted_mask, uint32_t now_ms) {
    const float phase = (sinf(now_ms * 2 * PI / 4000.0f) + 1) / 2;  // 4 s breathing
    for (int b = 0; b < lyra::kBays; ++b) {
      uint32_t c = 0;
      if (lifted_mask & (1u << b)) c = px_.Color(255, 170, 60);  // steady: "this one is in your hand"
      else if (glow_mask & (1u << b)) {
        const uint8_t v = static_cast<uint8_t>(40 + 215 * phase);
        c = px_.Color(v, v * 2 / 3, v / 4);
      }
      for (int i = 0; i < board::kLedsPerBay; ++i) px_.setPixelColor(b * board::kLedsPerBay + i, c);
    }
    px_.show();
  }

 private:
  Adafruit_NeoPixel px_{lyra::kBays * board::kLedsPerBay, board::kLedData, NEO_GRB + NEO_KHZ800};
};

// Plays short prompts stored in LittleFS: /voice/<lang>/<id>.wav (16 kHz mono).
// Every screen can also be read aloud (long press), for low vision and for
// people who don't read the screen's language well.
class Speaker {
 public:
  void begin();
  void chime();
  void say(const char* prompt_id);  // e.g. "evening_dose", "already_taken"
  void setLanguage(const char* lang) { lang_ = lang; }
  void setVolume(uint8_t v) { volume_ = v; }

 private:
  const char* lang_ = "en";
  uint8_t volume_ = 70;
};

}  // namespace hal
