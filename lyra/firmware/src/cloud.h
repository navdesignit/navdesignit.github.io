// Cloud link: the only way Lyra talks to the outside world.
//
// Lyra never needs the person to use a phone. The cloud relays:
//   out: caregiver alerts (missed dose, extra pills, low stock, no activity),
//        the weekly family summary and the monthly doctor report
//        → delivered as WhatsApp / SMS / e-mail, no app to install
//   in : short notes from family ("Great job, Mum!"), schedule changes made by
//        the caregiver or pharmacist on a web page, firmware updates
//
// Transport: MQTT over TLS on Wi-Fi; LTE-M/NB-IoT modem variant for homes
// without Wi-Fi. Messages are small JSON documents; no raw sensor data
// leaves the device.
#pragma once
#include <functional>

#include "lyra/dose_engine.h"
#include "lyra/insights.h"

namespace cloud {

void begin(const char* device_id);
void loop();
bool online();

// Caregiver alert for one engine output (called when notify_caregiver is set).
void alert(const lyra::DoseEngine& e, const lyra::EngineOutput& o, int32_t now_min, bool person_home);

// Nobody has been seen near Lyra by the family's chosen time.
void noActivity(int32_t now_min);

// Weekly summary (early Sunday) with the insight results.
void weekly(const lyra::Adherence& a, const lyra::Drift* drifts, const lyra::MissPattern& mp, const lyra::StorageReport& st);

// Incoming family note. Text is pre-rendered by the cloud for scripts the
// device font can't shape.
void onFamilyNote(std::function<void(const char* text, const char* from)> cb);

}  // namespace cloud
