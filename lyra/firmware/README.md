# Lyra OS

Firmware for **Lyra**, a medication station: six weighing bays, a 4.2″ e-ink screen, one knob and no app.
The design spec (problem, screens, logic, data, results and confidence) is in [`../index.html`](../index.html).

## Layout

| Path | What | Status |
|---|---|---|
| `lib/lyra_core/` | Hardware-free core: `BayDetector`, `DoseEngine`, `Insights` | Built and tested on PC |
| `test/host/sim.cpp` | Detector tests, Monte-Carlo dose-outcome table, five-week household simulation | Passes (61 seeds tried) |
| `src/` | ESP32-S3 device layer: drivers, e-ink screens, LittleFS storage, MQTT link, main loop | Written, not yet compiled |

## Run the tests

```sh
make -C test/host run            # one run
LYRA_SEED=7 ./test/host/sim      # another random household
LYRA_DEBUG=1 ./test/host/sim     # print every bay event and dose record
```

## Build for the device

```sh
pio run -e lyra                  # ESP32-S3-WROOM-1 N16R8
pio run -e lyra -t upload
```

## Numbers the logic depends on

These are modelled in the simulator and must be measured on EVT hardware:

- load-cell noise: 20 mg per sample (1σ)
- put-down repeatability: 20 mg per placement (1σ). At 30 mg the silently countable pill weight rises from 150 mg to 250 mg.
- pill-to-pill spread: 4 %

When the measured values are known, set them in `BayDetector::Config` and in `test/host/sim.cpp`, then re-run the tests.
