// On-device storage (LittleFS, 16 MB flash).
//
//   /state.bin   medicines + schedule + dose history (last 400 days), CRC32
//   /hours.bin   hourly climate + presence samples, ring of 400 days
//
// Everything Lyra needs to work lives here: no cloud needed to remind, count
// or show results. The cloud only relays messages to family.
#pragma once
#include <vector>

#include "lyra/dose_engine.h"

namespace storage {

bool begin();
bool saveState(const lyra::DoseEngine& e, int32_t day0_epoch_day);
bool loadState(lyra::DoseEngine& e, int32_t& day0_epoch_day);
void appendHour(const lyra::HourSample& s);
std::vector<lyra::HourSample> loadHours(int32_t from_hour_index);

}  // namespace storage
