#include <LittleFS.h>
#include <driver/i2s.h>

#include "hal/io.h"

namespace hal {

namespace {
constexpr i2s_port_t kPort = I2S_NUM_0;

void playWav(const char* path, uint8_t volume) {
  File f = LittleFS.open(path, "r");
  if (!f) return;
  f.seek(44);  // canonical 44-byte header, 16 kHz / 16-bit / mono
  int16_t buf[256];
  size_t written;
  while (f.available()) {
    const size_t n = f.read(reinterpret_cast<uint8_t*>(buf), sizeof buf) / 2;
    for (size_t i = 0; i < n; ++i) buf[i] = static_cast<int16_t>(buf[i] * volume / 100);
    i2s_write(kPort, buf, n * 2, &written, portMAX_DELAY);
  }
  i2s_zero_dma_buffer(kPort);
}
}  // namespace

void Speaker::begin() {
  i2s_config_t cfg = {};
  cfg.mode = static_cast<i2s_mode_t>(I2S_MODE_MASTER | I2S_MODE_TX);
  cfg.sample_rate = 16000;
  cfg.bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT;
  cfg.channel_format = I2S_CHANNEL_FMT_ONLY_LEFT;
  cfg.communication_format = I2S_COMM_FORMAT_STAND_I2S;
  cfg.dma_buf_count = 4;
  cfg.dma_buf_len = 256;
  i2s_driver_install(kPort, &cfg, 0, nullptr);
  i2s_pin_config_t pins = {};
  pins.bck_io_num = board::kI2sBclk;
  pins.ws_io_num = board::kI2sLrc;
  pins.data_out_num = board::kI2sDout;
  pins.data_in_num = I2S_PIN_NO_CHANGE;
  i2s_set_pin(kPort, &pins);
}

void Speaker::chime() { playWav("/voice/chime.wav", volume_); }

void Speaker::say(const char* prompt_id) {
  char path[64];
  snprintf(path, sizeof path, "/voice/%s/%s.wav", lang_, prompt_id);
  playWav(path, volume_);
}

}  // namespace hal
