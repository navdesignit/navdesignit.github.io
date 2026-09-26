#include "ui/screens.h"

#include <Fonts/FreeSans12pt7b.h>
#include <Fonts/FreeSansBold12pt7b.h>
#include <Fonts/FreeSansBold18pt7b.h>
#include <Fonts/FreeSansBold24pt7b.h>
#include <GxEPD2_BW.h>

#include "hal/board.h"

// English build. Other languages ship as pre-rendered phrase bitmaps (shaped
// on the build machine with HarfBuzz, so Devanagari, Arabic, Thai, CJK render
// correctly); the layout code below stays the same.
namespace ui {

using namespace lyra;

namespace {

GxEPD2_BW<GxEPD2_420_GDEY042T81, GxEPD2_420_GDEY042T81::HEIGHT> epd(
    GxEPD2_420_GDEY042T81(board::kEpdCs, board::kEpdDc, board::kEpdRst, board::kEpdBusy));

constexpr int W = 400, H = 300;
constexpr uint16_t INK = GxEPD_BLACK, PAPER = GxEPD_WHITE;

const char* const kSlotName[kSlots] = {"Morning", "Midday", "Evening", "Night"};
const char* const kWeekday[7] = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"};

void text(int x, int y, const char* s, const GFXfont* f) {
  epd.setFont(f);
  epd.setTextColor(INK);
  epd.setCursor(x, y);
  epd.print(s);
}

void textRight(int xr, int y, const char* s, const GFXfont* f) {
  int16_t bx, by;
  uint16_t bw, bh;
  epd.setFont(f);
  epd.getTextBounds(s, 0, y, &bx, &by, &bw, &bh);
  text(xr - bw - bx, y, s, f);
}

void hhmm(char* out, size_t n, int32_t local_min) {
  const int m = minuteOfDay(local_min);
  snprintf(out, n, "%02d:%02d", m / 60, m % 60);
}

// Time-of-day pictograms, drawn (no font needed), size ~ 2r.
void pictogram(int slot, int cx, int cy, int r) {
  switch (slot) {
    case 0:  // sunrise: half sun on the horizon, rays up
      epd.fillCircle(cx, cy + r / 3, r / 2, INK);
      epd.fillRect(cx - r, cy + r / 3, 2 * r, r, PAPER);
      epd.drawFastHLine(cx - r, cy + r / 3, 2 * r, INK);
      for (int a = 20; a <= 160; a += 35) {
        const float t = a * DEG_TO_RAD;
        epd.drawLine(cx + cosf(t) * r * 0.65f, cy + r / 3 - sinf(t) * r * 0.65f, cx + cosf(t) * r * 0.95f,
                     cy + r / 3 - sinf(t) * r * 0.95f, INK);
      }
      break;
    case 1:  // full sun
      epd.fillCircle(cx, cy, r / 2, INK);
      for (int a = 0; a < 360; a += 45) {
        const float t = a * DEG_TO_RAD;
        epd.drawLine(cx + cosf(t) * r * 0.65f, cy + sinf(t) * r * 0.65f, cx + cosf(t) * r, cy + sinf(t) * r, INK);
      }
      break;
    case 2:  // sunset: half sun sinking, rays down-flat
      epd.fillCircle(cx, cy + r / 2, r / 2, INK);
      epd.fillRect(cx - r, cy + r / 2, 2 * r, r, PAPER);
      epd.drawFastHLine(cx - r, cy + r / 2, 2 * r, INK);
      epd.drawFastHLine(cx - r * 3 / 4, cy + r * 3 / 4, r * 3 / 2, INK);
      break;
    default:  // moon
      epd.fillCircle(cx, cy, r * 3 / 5, INK);
      epd.fillCircle(cx + r / 3, cy - r / 5, r * 3 / 5, PAPER);
      break;
  }
}

// State in shape: filled tick = taken, ring = to take, cross = missed.
void stateMark(DoseStatus s, int cx, int cy, int r) {
  switch (s) {
    case DoseStatus::Taken:
    case DoseStatus::TakenLate:
      epd.fillCircle(cx, cy, r, INK);
      for (int w = -1; w <= 1; ++w) {
        epd.drawLine(cx - r / 2, cy + w, cx - r / 8, cy + r / 3 + w, PAPER);
        epd.drawLine(cx - r / 8, cy + r / 3 + w, cx + r / 2, cy - r / 3 + w, PAPER);
      }
      break;
    case DoseStatus::Missed:
      epd.drawCircle(cx, cy, r, INK);
      for (int w = -1; w <= 1; ++w) {
        epd.drawLine(cx - r / 2 + w, cy - r / 2, cx + r / 2 + w, cy + r / 2, INK);
        epd.drawLine(cx + r / 2 + w, cy - r / 2, cx - r / 2 + w, cy + r / 2, INK);
      }
      break;
    case DoseStatus::Partial:  // half-filled ring
      epd.fillCircle(cx, cy, r, INK);
      epd.fillRect(cx - r, cy - r, 2 * r + 1, r, PAPER);
      epd.drawCircle(cx, cy, r, INK);
      break;
    default:  // still to take
      epd.drawCircle(cx, cy, r, INK);
      epd.drawCircle(cx, cy, r - 1, INK);
      epd.drawCircle(cx, cy, r - 2, INK);
      break;
  }
}

// Summarise one slot of one day across all medicines.
struct SlotSummary {
  bool planned = false;
  DoseStatus status = DoseStatus::Upcoming;
  int32_t taken_min = -1;
  int pills = 0;
};

SlotSummary summarise(const DoseEngine& e, int32_t day, int slot) {
  SlotSummary s;
  bool all_taken = true, any_missed = false, any_taken = false, any_due = false;
  for (const auto& r : e.history()) {
    if (r.day != day || r.slot != slot) continue;
    s.planned = true;
    s.pills += r.planned;
    const bool taken = r.status == DoseStatus::Taken || r.status == DoseStatus::TakenLate;
    all_taken &= taken;
    any_taken |= taken || r.status == DoseStatus::Partial;
    any_missed |= r.status == DoseStatus::Missed;
    any_due |= r.status == DoseStatus::Due || r.status == DoseStatus::Open;
    if (r.taken_min >= 0 && (s.taken_min < 0 || r.taken_min > s.taken_min)) s.taken_min = r.taken_min;
  }
  if (!s.planned) return s;
  if (all_taken) s.status = DoseStatus::Taken;
  else if (any_missed && !any_taken) s.status = DoseStatus::Missed;
  else if (any_taken) s.status = DoseStatus::Partial;
  else if (any_due) s.status = DoseStatus::Due;
  return s;
}

void header(const Context& c) {
  char t[8];
  hhmm(t, sizeof t, c.now_min);
  text(16, 30, c.date_label, &FreeSansBold12pt7b);
  textRight(W - 16, 30, t, &FreeSansBold12pt7b);
  if (!c.online) text(170, 28, "offline", &FreeSans12pt7b);
  epd.drawFastHLine(16, 42, W - 32, INK);
}

// ---- pages -------------------------------------------------------------------

void pageToday(const Context& c) {
  header(c);
  const DoseEngine& e = *c.engine;
  const int32_t day = dayOf(c.now_min);
  int rows = 0;
  SlotSummary sum[kSlots];
  for (int k = 0; k < kSlots; ++k) {
    sum[k] = summarise(e, day, k);
    rows += sum[k].planned;
  }
  if (!rows) {
    text(16, 160, "No medicines set up", &FreeSansBold18pt7b);
    return;
  }
  const int row_h = (H - 50) / rows;
  int y = 50;
  for (int k = 0; k < kSlots; ++k) {
    if (!sum[k].planned) continue;
    const int cy = y + row_h / 2;
    if (k == c.active_slot) {  // the slot due now gets a heavy frame
      epd.fillRoundRect(8, y + 3, W - 16, row_h - 6, 10, INK);
      epd.fillRoundRect(11, y + 6, W - 22, row_h - 12, 8, PAPER);
    }
    pictogram(k, 44, cy, 20);
    char due[8];
    hhmm(due, sizeof due, e.config().slot_min[k]);
    text(80, cy - 2, kSlotName[k], &FreeSansBold18pt7b);
    text(82, cy + 22, due, &FreeSans12pt7b);
    stateMark(sum[k].status, W - 40, cy, 18);
    char right[16] = "";
    if (sum[k].taken_min >= 0) hhmm(right, sizeof right, sum[k].taken_min);
    else if (sum[k].status == DoseStatus::Missed) snprintf(right, sizeof right, "missed");
    else snprintf(right, sizeof right, "%d pill%s", sum[k].pills, sum[k].pills == 1 ? "" : "s");
    textRight(W - 70, cy + 8, right, &FreeSansBold12pt7b);
    y += row_h;
  }
}

void pageDue(const Context& c) {
  header(c);
  const DoseEngine& e = *c.engine;
  const int slot = c.active_slot < 0 ? 0 : c.active_slot;
  pictogram(slot, 50, 90, 32);
  text(100, 88, kSlotName[slot], &FreeSansBold24pt7b);
  int pills = 0;
  const int32_t day = dayOf(c.now_min);
  for (const auto& r : e.history())
    if (r.day == day && r.slot == slot && r.status != DoseStatus::Taken && r.status != DoseStatus::TakenLate)
      pills += r.planned - r.taken;
  char line[32];
  snprintf(line, sizeof line, "Take %d pill%s", pills, pills == 1 ? "" : "s");
  text(100, 128, line, &FreeSansBold18pt7b);

  int y = 172;
  for (const auto& r : e.history()) {
    if (r.day != day || r.slot != slot || r.status == DoseStatus::Taken || r.status == DoseStatus::TakenLate) continue;
    const Medicine& m = e.med(r.med);
    // Bay number in a circle: matches the number moulded next to each cup.
    epd.fillCircle(32, y - 8, 14, INK);
    char b[4];
    snprintf(b, sizeof b, "%d", m.bay + 1);
    epd.setTextColor(PAPER);
    epd.setFont(&FreeSansBold12pt7b);
    epd.setCursor(25, y);
    epd.print(b);
    snprintf(line, sizeof line, "%s  x%d", m.name, r.planned - r.taken);
    text(58, y, line, &FreeSans12pt7b);
    y += 34;
    if (y > H - 10) break;
  }
}

void pageNotice(const Context& c) {
  header(c);
  const EngineOutput& o = c.notice;
  const DoseEngine& e = *c.engine;
  const char* name = o.notice_med >= 0 ? e.med(o.notice_med).name : "";
  char a[48] = "", b[48] = "", t[8] = "";
  if (o.notice_min >= 0) hhmm(t, sizeof t, o.notice_min);
  DoseStatus mark = DoseStatus::Upcoming;
  switch (o.notice) {
    case Notice::DoseTaken:
      mark = DoseStatus::Taken;
      snprintf(a, sizeof a, "Done");
      snprintf(b, sizeof b, "%s  %s", name, t);
      break;
    case Notice::AlreadyTaken:
      mark = DoseStatus::Missed;
      snprintf(a, sizeof a, "Already taken");
      snprintf(b, sizeof b, "%s at %s today. Put it back.", name, t);
      break;
    case Notice::TooEarly:
      snprintf(a, sizeof a, "Not yet");
      snprintf(b, sizeof b, "%s from %s. Put it back.", name, t);
      break;
    case Notice::ExtraPills:
      mark = DoseStatus::Missed;
      snprintf(a, sizeof a, "%d extra pill%s", o.notice_pills, o.notice_pills == 1 ? "" : "s");
      snprintf(b, sizeof b, "%s: put %d back", name, o.notice_pills);
      break;
    case Notice::PartialDose:
      mark = DoseStatus::Partial;
      snprintf(a, sizeof a, "%d more", o.notice_pills);
      snprintf(b, sizeof b, "%s: take %d more", name, o.notice_pills);
      break;
    case Notice::ConfirmDose:
      if (o.notice_med >= 0 && e.med(o.notice_med).form == Form::Pouch && o.notice_slot >= 0) {
        // Pharmacy pouches have the time printed on them: let the label decide.
        snprintf(a, sizeof a, "Check the pouch");
        snprintf(b, sizeof b, "It says %s? Press = Yes", kSlotName[o.notice_slot]);
      } else {
        snprintf(a, sizeof a, "Did you take it?");
        snprintf(b, sizeof b, "%s. Press = Yes", name);
      }
      break;
    case Notice::WrongPouch: {
      mark = DoseStatus::Missed;
      snprintf(a, sizeof a, "%s pouch", o.notice_slot >= 0 ? kSlotName[o.notice_slot] : "Other");
      const int now_slot = c.active_slot >= 0 ? c.active_slot : 0;
      snprintf(b, sizeof b, "Put it back. Take the %s one.", kSlotName[now_slot]);
      break;
    }
    case Notice::PutBackThanks:
      mark = DoseStatus::Taken;
      snprintf(a, sizeof a, "Thank you");
      snprintf(b, sizeof b, "%s is back in the box", name);
      break;
    case Notice::Refilled:
      mark = DoseStatus::Taken;
      snprintf(a, sizeof a, "Refilled");
      snprintf(b, sizeof b, "%s: %d added", name, o.notice_pills);
      break;
    case Notice::LowStock: {
      const int days = (o.notice_min - c.now_min) / kMinPerDay;
      snprintf(a, sizeof a, "%d days left", days);
      snprintf(b, sizeof b, "%s. Family told.", name);
      break;
    }
    case Notice::LeftOff:
      snprintf(a, sizeof a, "Put it back");
      snprintf(b, sizeof b, "%s on its light", name);
      break;
    case Notice::NewContainer:
      snprintf(a, sizeof a, "New box?");
      snprintf(b, sizeof b, "%s. Press = Yes", name);
      break;
    case Notice::DoseMissed:
      mark = DoseStatus::Missed;
      snprintf(a, sizeof a, "Missed");
      snprintf(b, sizeof b, "%s %s. Skip it.", name, t);
      break;
    default:
      return;
  }
  stateMark(mark, W / 2, 105, 38);
  epd.setFont(&FreeSansBold24pt7b);
  int16_t bx, by;
  uint16_t bw, bh;
  epd.getTextBounds(a, 0, 0, &bx, &by, &bw, &bh);
  text((W - bw) / 2 - bx, 200, a, &FreeSansBold24pt7b);
  epd.setFont(&FreeSans12pt7b);
  epd.getTextBounds(b, 0, 0, &bx, &by, &bw, &bh);
  text((W - bw) / 2 - bx, 240, b, &FreeSans12pt7b);
  if (o.notice == Notice::DoseTaken && c.family_note) {
    snprintf(b, sizeof b, "\"%s\" - %s", c.family_note, c.family_from ? c.family_from : "");
    epd.getTextBounds(b, 0, 0, &bx, &by, &bw, &bh);
    text((W - bw) / 2 - bx, 280, b, &FreeSans12pt7b);
  }
}

void pageWeek(const Context& c) {
  header(c);
  const DoseEngine& e = *c.engine;
  const int32_t today = dayOf(c.now_min);
  const int x0 = 70, cw = (W - x0 - 10) / 7, y0 = 80, rh = 50;
  for (int d = 0; d < 7; ++d) {
    const int32_t day = today - 6 + d;
    const int wd = ((day + c.day0_weekday) % 7 + 7) % 7;
    text(x0 + d * cw + 6, 68, kWeekday[wd], &FreeSans12pt7b);
    for (int k = 0; k < kSlots; ++k) {
      SlotSummary s = summarise(e, day, k);
      if (!s.planned) continue;
      stateMark(day == today && s.status == DoseStatus::Upcoming ? DoseStatus::Upcoming : s.status, x0 + d * cw + cw / 2,
                y0 + k * rh + 20, 12);
    }
  }
  for (int k = 0; k < kSlots; ++k) pictogram(k, 36, y0 + k * rh + 20, 16);
}

void pageMedicines(const Context& c) {
  header(c);
  const DoseEngine& e = *c.engine;
  int y = 78;
  for (int i = 0; i < kMaxMeds; ++i) {
    const Medicine& m = e.med(i);
    if (!m.active) continue;
    text(16, y, m.name, &FreeSansBold12pt7b);
    char r[32];
    const float d = e.daysLeft(i);
    if (d < 0) snprintf(r, sizeof r, "count unknown");
    else snprintf(r, sizeof r, "%.0f left - %d days", m.stock_pills, static_cast<int>(d));
    textRight(W - 16, y, r, &FreeSans12pt7b);
    y += 40;
  }
}

void pageMessages(const Context& c) {
  header(c);
  if (!c.family_note) {
    text(16, 160, "No messages", &FreeSansBold18pt7b);
    return;
  }
  text(16, 120, c.family_note, &FreeSansBold18pt7b);
  if (c.family_from) text(16, 170, c.family_from, &FreeSans12pt7b);
}

uint8_t partials_since_full = 0;

}  // namespace

void begin() {
  epd.init(115200, true, 2, false);
  epd.setRotation(0);
}

void show(Page page, const Context& ctx, bool partial) {
  if (partial && ++partials_since_full >= 10) partial = false;  // clear ghosting
  if (!partial) partials_since_full = 0;
  if (partial) epd.setPartialWindow(0, 0, W, H);
  else epd.setFullWindow();
  epd.firstPage();
  do {
    epd.fillScreen(PAPER);
    switch (page) {
      case Page::Today: pageToday(ctx); break;
      case Page::DueNow: pageDue(ctx); break;
      case Page::Notice: pageNotice(ctx); break;
      case Page::Week: pageWeek(ctx); break;
      case Page::Medicines: pageMedicines(ctx); break;
      case Page::Messages: pageMessages(ctx); break;
    }
  } while (epd.nextPage());
  epd.hibernate();  // zero power: the image stays
}

}  // namespace ui
