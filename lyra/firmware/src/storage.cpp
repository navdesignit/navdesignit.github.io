#include "storage.h"

#include <LittleFS.h>
#include <esp_rom_crc.h>

namespace storage {

namespace {
constexpr uint32_t kMagic = 0x4C595241;  // "LYRA"
constexpr uint16_t kVersion = 1;
constexpr int kKeepDays = 400;
constexpr size_t kMaxHours = kKeepDays * 24;

struct Header {
  uint32_t magic = kMagic;
  uint16_t version = kVersion;
  uint16_t meds = lyra::kMaxMeds;
  int32_t day0 = 0;
  uint32_t records = 0;
  uint32_t crc = 0;
};

uint32_t crcOf(const void* p, size_t n, uint32_t crc = 0) { return esp_rom_crc32_le(crc, static_cast<const uint8_t*>(p), n); }
}  // namespace

bool begin() { return LittleFS.begin(true); }

bool saveState(const lyra::DoseEngine& e, int32_t day0) {
  const auto& h = e.history();
  const int32_t newest = h.empty() ? 0 : h.back().day;
  size_t first = 0;
  while (first < h.size() && h[first].day < newest - kKeepDays) ++first;

  Header hd;
  hd.day0 = day0;
  hd.records = static_cast<uint32_t>(h.size() - first);
  lyra::Medicine meds[lyra::kMaxMeds];
  for (int i = 0; i < lyra::kMaxMeds; ++i) meds[i] = e.med(i);
  const lyra::ScheduleConfig cfg = e.config();
  uint32_t crc = crcOf(meds, sizeof meds);
  crc = crcOf(&cfg, sizeof cfg, crc);
  crc = crcOf(h.data() + first, hd.records * sizeof(lyra::DoseRecord), crc);
  hd.crc = crc;

  // Write to a temp file and rename, so a power cut never corrupts the state.
  File f = LittleFS.open("/state.tmp", "w");
  if (!f) return false;
  f.write(reinterpret_cast<const uint8_t*>(&hd), sizeof hd);
  f.write(reinterpret_cast<const uint8_t*>(meds), sizeof meds);
  f.write(reinterpret_cast<const uint8_t*>(&cfg), sizeof cfg);
  f.write(reinterpret_cast<const uint8_t*>(h.data() + first), hd.records * sizeof(lyra::DoseRecord));
  f.close();
  LittleFS.remove("/state.bin");
  return LittleFS.rename("/state.tmp", "/state.bin");
}

bool loadState(lyra::DoseEngine& e, int32_t& day0) {
  File f = LittleFS.open("/state.bin", "r");
  if (!f) return false;
  Header hd;
  if (f.read(reinterpret_cast<uint8_t*>(&hd), sizeof hd) != sizeof hd || hd.magic != kMagic || hd.version != kVersion) return false;
  lyra::Medicine meds[lyra::kMaxMeds];
  lyra::ScheduleConfig cfg;
  std::vector<lyra::DoseRecord> h(hd.records);
  f.read(reinterpret_cast<uint8_t*>(meds), sizeof meds);
  f.read(reinterpret_cast<uint8_t*>(&cfg), sizeof cfg);
  f.read(reinterpret_cast<uint8_t*>(h.data()), hd.records * sizeof(lyra::DoseRecord));
  uint32_t crc = crcOf(meds, sizeof meds);
  crc = crcOf(&cfg, sizeof cfg, crc);
  crc = crcOf(h.data(), h.size() * sizeof(lyra::DoseRecord), crc);
  if (crc != hd.crc) return false;
  for (int i = 0; i < lyra::kMaxMeds; ++i) e.med(i) = meds[i];
  e.config() = cfg;
  e.history() = std::move(h);
  day0 = hd.day0;
  return true;
}

void appendHour(const lyra::HourSample& s) {
  File f = LittleFS.open("/hours.bin", "a");
  if (!f) return;
  if (f.size() >= kMaxHours * sizeof s) {  // simple ring: start a new file, keep the old as .1
    f.close();
    LittleFS.remove("/hours.1");
    LittleFS.rename("/hours.bin", "/hours.1");
    f = LittleFS.open("/hours.bin", "a");
  }
  f.write(reinterpret_cast<const uint8_t*>(&s), sizeof s);
}

std::vector<lyra::HourSample> loadHours(int32_t from) {
  std::vector<lyra::HourSample> out;
  for (const char* name : {"/hours.1", "/hours.bin"}) {
    File f = LittleFS.open(name, "r");
    if (!f) continue;
    lyra::HourSample s;
    while (f.read(reinterpret_cast<uint8_t*>(&s), sizeof s) == sizeof s)
      if (s.hour_index >= from) out.push_back(s);
  }
  return out;
}

}  // namespace storage
