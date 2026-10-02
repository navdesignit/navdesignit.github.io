#include "cloud.h"

#include <Preferences.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

namespace cloud {

namespace {
WiFiClientSecure tls;
PubSubClient mqtt(tls);
char id[24] = "lyra";
char topic_out[48], topic_in[48];
std::function<void(const char*, const char*)> note_cb;
char note_text[96], note_from[24];
uint32_t last_try_ms = 0;

// Outbox: alerts raised while offline are kept (newest 16) and sent on reconnect.
constexpr int kOutbox = 16;
String outbox[kOutbox];
int out_head = 0, out_count = 0;

void send(const char* msg) {
  if (mqtt.connected() && mqtt.publish(topic_out, msg)) return;
  outbox[(out_head + out_count) % kOutbox] = msg;
  if (out_count < kOutbox) ++out_count;
  else out_head = (out_head + 1) % kOutbox;  // full: drop the oldest
}

void flush() {
  while (out_count && mqtt.connected() && mqtt.publish(topic_out, outbox[out_head].c_str())) {
    outbox[out_head] = String();
    out_head = (out_head + 1) % kOutbox;
    --out_count;
  }
}

const char* noticeName(lyra::Notice n) {
  switch (n) {
    case lyra::Notice::DoseMissed: return "dose_missed";
    case lyra::Notice::ExtraPills: return "extra_pills";
    case lyra::Notice::AlreadyTaken: return "double_dose_attempt";
    case lyra::Notice::LowStock: return "low_stock";
    case lyra::Notice::LeftOff: return "container_not_returned";
    default: return "event";
  }
}

void onMessage(char* topic, byte* payload, unsigned int len) {
  (void)topic;
  // Payload: "<from>\n<text>" (the cloud has already validated and shortened it).
  const unsigned int n = len < sizeof note_text - 1 ? len : sizeof note_text - 1;
  char buf[sizeof note_text];
  memcpy(buf, payload, n);
  buf[n] = 0;
  char* nl = strchr(buf, '\n');
  if (!nl) return;
  *nl = 0;
  strlcpy(note_from, buf, sizeof note_from);
  strlcpy(note_text, nl + 1, sizeof note_text);
  if (note_cb) note_cb(note_text, note_from);
}

void connect() {
  Preferences p;
  p.begin("lyra", true);
  const String ssid = p.getString("wifi_ssid", ""), pass = p.getString("wifi_pass", "");
  const String host = p.getString("mqtt_host", ""), ca = p.getString("mqtt_ca", "");
  p.end();
  if (ssid.isEmpty() || host.isEmpty()) return;  // not provisioned yet: Lyra works fully offline
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(ssid.c_str(), pass.c_str());
    return;
  }
  static String ca_keep;  // WiFiClientSecure keeps the pointer
  ca_keep = ca;
  tls.setCACert(ca_keep.c_str());
  mqtt.setServer(host.c_str(), 8883);
  mqtt.setCallback(onMessage);
  if (mqtt.connect(id)) mqtt.subscribe(topic_in, 1);
}
}  // namespace

void begin(const char* device_id) {
  strlcpy(id, device_id, sizeof id);
  snprintf(topic_out, sizeof topic_out, "lyra/%s/out", id);
  snprintf(topic_in, sizeof topic_in, "lyra/%s/note", id);
  WiFi.mode(WIFI_STA);
  connect();
}

void loop() {
  if (!mqtt.connected() && millis() - last_try_ms > 30000) {
    last_try_ms = millis();
    connect();
  }
  mqtt.loop();
  flush();
}

bool online() { return mqtt.connected(); }

void alert(const lyra::DoseEngine& e, const lyra::EngineOutput& o, int32_t now_min, bool person_home) {
  char msg[256];
  const char* med = o.notice_med >= 0 ? e.med(o.notice_med).name : "";
  snprintf(msg, sizeof msg,
           "{\"type\":\"%s\",\"med\":\"%s\",\"t\":%ld,\"at\":%ld,\"pills\":%d,\"home\":%s,\"days_left\":%.1f}",
           noticeName(o.notice), med, static_cast<long>(now_min), static_cast<long>(o.notice_min), o.notice_pills,
           person_home ? "true" : "false", o.notice_med >= 0 ? e.daysLeft(o.notice_med) : -1.0f);
  send(msg);
}

void noActivity(int32_t now_min) {
  char msg[64];
  snprintf(msg, sizeof msg, "{\"type\":\"no_activity\",\"t\":%ld}", static_cast<long>(now_min));
  send(msg);
}

void weekly(const lyra::Adherence& a, const lyra::Drift* drifts, const lyra::MissPattern& mp, const lyra::StorageReport& st) {
  char msg[384];
  int n = snprintf(msg, sizeof msg,
                   "{\"type\":\"weekly\",\"planned\":%d,\"taken\":%d,\"on_time\":%d,\"correct_days\":%d,\"days\":%d,"
                   "\"missed_away\":%d,\"missed_home\":%d,\"hot_hours\":%d,\"peak_c\":%.1f",
                   a.planned, a.taken, a.on_time, a.correct_days, a.days, a.missed_away, a.missed_forgot, st.hours_hot, st.peak_c);
  if (mp.flagged) n += snprintf(msg + n, sizeof msg - n, ",\"miss_pattern\":[%d,%d,%d,%d]", mp.weekday, mp.slot, mp.misses, mp.occurrences);
  for (int s = 0; s < lyra::kSlots; ++s)
    if (drifts[s].flagged)
      n += snprintf(msg + n, sizeof msg - n, ",\"drift_%d\":[%d,%d]", s, drifts[s].base_min, drifts[s].recent_min);
  snprintf(msg + n, sizeof msg - n, "}");
  send(msg);
}

void onFamilyNote(std::function<void(const char*, const char*)> cb) { note_cb = std::move(cb); }

}  // namespace cloud
