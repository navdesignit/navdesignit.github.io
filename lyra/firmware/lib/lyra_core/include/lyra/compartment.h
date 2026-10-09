// Compartment tracker: one per compartment.
//
// A compartment sits on one load cell and holds several items. The detector
// (in step mode) reports every settled weight change. The tracker decides
// what each step means with one rule:
//
//     the weight that LEFT says WHICH item,
//     the weight that CAME BACK says HOW MUCH was used.
//
//   step down ≈ a container's weight   → that item was lifted (now "in hand")
//   step up after a lift               → it came back; the difference is what
//                                        was used (pills, a stick, a pouch, or
//                                        nothing measurable for eye drops)
//   step down ≈ n units of one item    → units taken straight from the
//                                        compartment (a stick from its box, a
//                                        pouch torn off the roll, a pill
//                                        popped from a blister)
//   anything it can't pin to one item  → ask "which one?" on the screen
//
// Items due now are 10× more likely than items that aren't, so a step that
// fits both is resolved toward what the person is supposed to take.
#pragma once
#include "lyra/dose_engine.h"
#include "lyra/types.h"

namespace lyra {

struct TrackerResult {
  enum class Kind : uint8_t {
    None,
    Lifted,    // an item (med, or one of `candidates`) is in the person's hand
    ToEngine,  // event for one medicine: pass to DoseEngine::onMedEvent
    Ask,       // can't tell which: DoseEngine::askWhich(candidates, delta)
    LeftOff,   // an item has been out of the compartment for too long
    Unknown,   // weight appeared that matches nothing (new item?)
  };
  Kind kind = Kind::None;
  int8_t med = -1;
  uint16_t candidates = 0;
  float delta_g = 0;
  // Lifted, but it may also be units of a due item (a stick weighs like a
  // bottle of eye drops): the screen stays neutral until it resolves.
  bool provisional = false;
  BayEvent event;
};

class CompartmentTracker {
 public:
  static constexpr float kCv = 0.04f;          // unit-to-unit spread
  static constexpr float kDuePrior = 10.0f;    // due items vs not-due items
  static constexpr float kSure = 0.90f;        // decide alone at ≥ 90 %
  static constexpr int kLeftOffMin = 10;
  // A step that fits both "container lifted" and "units taken" (an 11 g
  // eye-drop bottle vs a 12 g ginseng stick) waits this long: if nothing
  // comes back, it was units.
  static constexpr int kNoReturnMin = 3;
  // A unit lighter than this can't identify WHICH item it came from when
  // something else is due in the same compartment (it can still be counted).
  static constexpr float kMinIdentifyUnitG = 0.20f;
  static constexpr int kForgetMin = 60;          // an item out this long is "away": stop tracking it
  static constexpr float kMinContainerG = 2.0f;  // lighter items are never "lifted containers"

  explicit CompartmentTracker(int compartment = 0) : comp_(compartment) {}
  void setSigma(float sigma_g) { sigma_ = sigma_g; }  // 1σ of a settled before/after pair

  TrackerResult onStep(DoseEngine& eng, const BayEvent& step, int32_t now_min);
  // Once a minute: resolves "no return means units" and warns about items
  // left out.
  TrackerResult tick(DoseEngine& eng, int32_t now_min);
  int inHand() const { return n_held_; }

  // Tolerance for recognising a container by its weight.
  static float containerTol(float container_g) { return container_g * 0.02f > 0.5f ? container_g * 0.02f : 0.5f; }

 private:
  struct Held {
    int8_t med = -1;         // -1: ambiguous, see cands
    uint16_t cands = 0;
    float g = 0;             // weight that left
    int32_t since = 0;
    bool warned = false;
    int8_t alt_med = -1;     // could also be units of this item (see kNoReturnMin)
  };

  struct UnitScore {
    float post[kMaxMeds] = {};
    int best_n[kMaxMeds] = {};
    float total = 0;
    uint16_t due_unknown = 0;   // due items whose unit weight is still unknown
    int n_due_unknown = 0;
    int best = -1;
    float p = 0;                // posterior of `best`
  };
  UnitScore scoreUnits(const DoseEngine& eng, float d, int32_t now) const;
  TrackerResult unitsOut(DoseEngine& eng, float d, int32_t now);
  TrackerResult unitsFor(DoseEngine& eng, int m, float d, float p, int n);
  TrackerResult returned(DoseEngine& eng, float w, int32_t now);
  BayEvent usedEvent(const DoseEngine& eng, int m, float used, int32_t now) const;
  float unitSigma(float unit, int n) const;

  int comp_;
  float sigma_ = 0.03f;
  Held held_[3];
  int n_held_ = 0;
};

}  // namespace lyra
