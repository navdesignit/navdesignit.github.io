// Lyra OS — main application (ESP32-S3, Arduino on FreeRTOS).
//
//   sensorTask (core 1, 10 Hz) : 6 scales → BayDetector → event queue
//                                radar presence, bay lights (20 Hz)
//   loop()     (core 1)        : events → DoseEngine → screen / speaker / cloud
//                                once a minute: engine.tick()
//                                once an hour : climate + presence sample
//                                03:00 nightly: insights, reminder shifts, save
//
// The core logic (lib/lyra_core) is hardware-free and tested on the PC with
// test/host/sim.cpp.
#include <Arduino.h>
#include <Preferences.h>
#include <atomic>
#include <ctime>

#include "cloud.h"
#include "hal/io.h"
#include "hal/sensors.h"
#include "lyra/bay_detector.h"
#include "lyra/dose_engine.h"
#include "lyra/insights.h"
#include "storage.h"
#include "ui/screens.h"

using namespace lyra;

namespace {

hal::Scales scales;
hal::Presence presence;
hal::Climate climate;
hal::Knob knob;
hal::BayLights lights;
hal::Speaker speaker;

DoseEngine engine;
BayDetector detector[kBays];

struct BayMsg {
  uint8_t bay;
  BayEvent event;
};
QueueHandle_t bay_queue;

std::atomic<bool> person_present{false};
std::atomic<uint8_t> glow_mask{0};
std::atomic<uint8_t> lifted_mask{0};

int32_t day0 = 0;  // epoch day of local day 0
ui::Page page = ui::Page::Today;
ui::Context ctx;
uint32_t notice_until_ms = 0;
char date_label[24];
char family_note[96], family_from[24];
bool have_note = false;
uint8_t presence_minutes = 0;
int no_activity_min = 10 * 60;  // family's chosen "should be up by" time
bool seen_today = false, no_activity_sent = false;
int32_t activity_day = -1;
float temp_sum = 0, rh_sum = 0;
int climate_n = 0;

// ---- time ------------------------------------------------------------------

int32_t localEpochMinutes() {
  const time_t t = time(nullptr);
  struct tm lt;
  localtime_r(&t, &lt);
  // Minutes since the local-time epoch (DST handled by the TZ rules).
  return static_cast<int32_t>((t + lt.tm_gmtoff) / 60);
}

int32_t nowLocalMin() { return localEpochMinutes() - day0 * kMinPerDay; }

void updateDateLabel() {
  const time_t t = time(nullptr);
  struct tm lt;
  localtime_r(&t, &lt);
  strftime(date_label, sizeof date_label, "%a %d %b", &lt);
}

// ---- sensing task ------------------------------------------------------------

void sensorTask(void*) {
  uint32_t last_radar = 0;
  for (;;) {
    const uint32_t now = millis();
    uint8_t lifted = 0;
    for (int b = 0; b < kBays; ++b) {
      float g;
      if (scales.read(b, g)) {
        const BayEvent e = detector[b].push(g, now);
        if (e.kind != BayEventKind::None) {
          BayMsg m{static_cast<uint8_t>(b), e};
          xQueueSend(bay_queue, &m, 0);
        }
      }
      if (detector[b].isLifted()) lifted |= 1u << b;
    }
    lifted_mask = lifted;
    if (now - last_radar >= 200) {
      last_radar = now;
      person_present = presence.present();
    }
    lights.render(glow_mask, lifted_mask, now);
    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

// ---- output handling ------------------------------------------------------------

const char* voicePrompt(int slot) {
  static const char* const kPrompt[kSlots] = {"morning_dose", "midday_dose", "evening_dose", "night_dose"};
  return slot >= 0 ? kPrompt[slot] : "dose";
}

void render(bool partial) {
  ctx.engine = &engine;
  ctx.now_min = nowLocalMin();
  ctx.date_label = date_label;
  ctx.online = cloud::online();
  ctx.family_note = have_note ? family_note : nullptr;
  ctx.family_from = have_note ? family_from : nullptr;
  ui::show(page, ctx, partial);
}

void handle(const EngineOutput& o, bool from_tick) {
  if (from_tick) {
    const bool changed = o.active_slot != ctx.active_slot;
    ctx.active_slot = o.active_slot;
    glow_mask = o.glow_mask;
    if (changed && millis() > notice_until_ms) {
      page = o.active_slot >= 0 ? ui::Page::DueNow : ui::Page::Today;
      render(false);
    }
  }
  if (o.sound == Sound::Chime) speaker.chime();
  if (o.sound == Sound::Voice) {
    speaker.chime();
    speaker.say(voicePrompt(o.active_slot));
  }
  if (o.notice != Notice::None) {
    ctx.notice = o;
    page = ui::Page::Notice;
    notice_until_ms = millis() + (o.notice == Notice::ConfirmDose || o.notice == Notice::NewContainer ? 5 * 60000 : 60000);
    render(false);
    // Safety notices are also spoken: people often don't look at the screen.
    if (o.notice == Notice::AlreadyTaken) speaker.say("already_taken");
    if (o.notice == Notice::ExtraPills) speaker.say("extra_pills");
    if (o.notice == Notice::TooEarly) speaker.say("too_early");
    if (o.notice == Notice::ConfirmDose) speaker.say("did_you_take");
  }
  if (o.notify_caregiver) cloud::alert(engine, o, nowLocalMin(), person_present);
}

void onKnob(hal::KnobEvent k) {
  static const ui::Page kCycle[] = {ui::Page::Today, ui::Page::Week, ui::Page::Medicines, ui::Page::Messages};
  static int idx = 0;
  switch (k) {
    case hal::KnobEvent::Right:
    case hal::KnobEvent::Left:
      idx = (idx + (k == hal::KnobEvent::Right ? 1 : 3)) % 4;
      page = kCycle[idx];
      notice_until_ms = 0;
      render(false);
      break;
    case hal::KnobEvent::Press:
      if (page == ui::Page::Notice && ctx.notice.notice == Notice::ConfirmDose) {
        handle(engine.confirmDose(nowLocalMin()), false);
      } else if (page == ui::Page::Notice && ctx.notice.notice == Notice::NewContainer) {
        // Confirmed: same medicine, new box. Count comes from the pack
        // barcode / setup page; the engine keeps counting from there.
        page = ui::Page::Today;
        render(false);
      } else {
        page = ctx.active_slot >= 0 ? ui::Page::DueNow : ui::Page::Today;
        idx = 0;
        render(false);
      }
      break;
    case hal::KnobEvent::LongPress:
      speaker.say(page == ui::Page::DueNow ? voicePrompt(ctx.active_slot) : "read_today");  // read the screen aloud
      break;
    default:
      break;
  }
}

void nightly(int32_t now) {
  const int32_t today = dayOf(now);
  for (int s = 0; s < kSlots; ++s) engine.setSlotShift(s, suggestedShift(rhythm(engine.history(), s, today - 14, today - 1)));
  storage::saveState(engine, day0);

  struct tm lt;
  const time_t t = time(nullptr);
  localtime_r(&t, &lt);
  if (lt.tm_wday == 0) {  // Sunday: weekly family summary
    const Adherence a = adherence(engine.history(), today - 7, today - 1);
    Drift d[kSlots];
    for (int s = 0; s < kSlots; ++s) d[s] = drift(engine.history(), s, today);
    const int day0_wd = ((day0 + 3) % 7 + 7) % 7;  // 1970-01-01 was a Thursday
    const MissPattern mp = missPattern(engine.history(), today, day0_wd);
    const StorageReport st = storageReport(storage::loadHours((today - 7) * 24));
    cloud::weekly(a, d, mp, st);
  }
}

}  // namespace

void setup() {
  Serial.begin(115200);
  storage::begin();

  Preferences p;
  p.begin("lyra", true);
  const String tz = p.getString("tz", "UTC0");  // POSIX TZ, set during setup
  const String dev = p.getString("id", "lyra-dev");
  no_activity_min = p.getInt("noact_min", 10 * 60);
  p.end();
  configTzTime(tz.c_str(), "pool.ntp.org", "time.google.com");

  if (!storage::loadState(engine, day0)) day0 = localEpochMinutes() / kMinPerDay;
  ctx.day0_weekday = ((day0 + 3) % 7 + 7) % 7;
  for (int i = 0; i < kMaxMeds; ++i)
    if (engine.med(i).active) detector[engine.med(i).bay].setPillWeight(engine.med(i).pill_g);

  scales.begin();
  presence.begin();
  climate.begin();
  knob.begin();
  lights.begin();
  speaker.begin();
  ui::begin();
  cloud::begin(dev.c_str());
  cloud::onFamilyNote([](const char* text, const char* from) {
    strlcpy(family_note, text, sizeof family_note);
    strlcpy(family_from, from, sizeof family_from);
    have_note = true;
  });

  bay_queue = xQueueCreate(16, sizeof(BayMsg));
  xTaskCreatePinnedToCore(sensorTask, "sense", 4096, nullptr, 3, nullptr, 1);

  updateDateLabel();
  engine.beginDay(dayOf(nowLocalMin()));
  render(false);
}

void loop() {
  static int32_t last_min = -1;
  static int32_t last_hour = -1;

  // Bay events first: they are what the person just did.
  BayMsg m;
  while (xQueueReceive(bay_queue, &m, 0) == pdTRUE) {
    const int32_t now = nowLocalMin();
    handle(engine.onBayEvent(m.bay, m.event, now), false);
    const int med = engine.medAtBay(m.bay);
    if (med >= 0) detector[m.bay].setPillWeight(engine.med(med).pill_g);  // pill weight may have just been learned
  }

  const hal::KnobEvent k = knob.poll();
  if (k != hal::KnobEvent::None) onKnob(k);

  const int32_t now = nowLocalMin();
  if (now != last_min) {
    last_min = now;
    if (person_present) ++presence_minutes;

    // Living-alone check: nobody seen near Lyra by the chosen time.
    if (dayOf(now) != activity_day) {
      activity_day = dayOf(now);
      seen_today = no_activity_sent = false;
    }
    if (person_present) seen_today = true;
    if (!seen_today && !no_activity_sent && minuteOfDay(now) >= no_activity_min) {
      no_activity_sent = true;
      cloud::noActivity(now);
    }
    float tc, rh;
    if (climate.read(tc, rh)) {
      temp_sum += tc;
      rh_sum += rh;
      ++climate_n;
    }
    handle(engine.tick(now, person_present), true);
    if (millis() > notice_until_ms && page == ui::Page::Notice) {
      page = ctx.active_slot >= 0 ? ui::Page::DueNow : ui::Page::Today;
      render(false);
    } else if (page == ui::Page::Today || page == ui::Page::DueNow) {
      render(true);  // clock tick: fast partial refresh
    }

    const int32_t hour = now / 60;
    if (hour != last_hour) {
      if (last_hour >= 0 && climate_n) {
        HourSample s;
        s.hour_index = last_hour;
        s.temp_c = temp_sum / climate_n;
        s.rh_pct = rh_sum / climate_n;
        s.presence_min = presence_minutes > 60 ? 60 : presence_minutes;
        storage::appendHour(s);
      }
      last_hour = hour;
      presence_minutes = 0;
      temp_sum = rh_sum = 0;
      climate_n = 0;
      updateDateLabel();
      if (minuteOfDay(now) / 60 == 3) nightly(now);
    }
  }

  cloud::loop();
  delay(20);
}
