# Smart Cassava Seedling Nursery — IoT Monitoring System

**Project SEN-20-5112** — an IoT-driven smart framework for cassava seedling
nurseries (the "Cut, Root, and Grow" protocol). This repository contains the
software that implements the **Application** and **End-User** layers of the
five-layer architecture described in **Chapter 3**:

- **`backend/`** — Node.js + Express cloud application layer (REST + WebSocket,
  Smart Farming Cycle rule engine, SMS alerting, immutable certification logs).
- **`app/`** — React Native (Expo) mobile client. It is the provided
  `SmartCassavaNursery` UI, ported to React Native and wired to the backend.
- **`firmware/`** — reference ESP32 sketch showing how a real Perception-layer
  node feeds the backend (`/api/ingest`).

```
   DHT22 x3 + soil probes            REST + WebSocket
   ┌─────────────┐   /api/ingest   ┌──────────────┐   /api/*   ┌──────────────┐
   │   ESP32     │ ───────────────▶│   Backend    │◀──────────▶│ React Native │
   │  (or sim)   │  raw samples    │ (this repo)  │  live data │     app      │
   └─────────────┘                 └──────┬───────┘            └──────────────┘
     relay: pump/fan                       │ Twilio / SIM800L
                                           ▼
                                     Farmer SMS alert
```

## Run it (two terminals)

**1 — Backend**

```bash
cd backend
npm install
npm run seed      # demo account + 2h of history
npm start         # http://localhost:4000  (built-in ESP32 simulator runs too)
```

**2 — Mobile app**

```bash
cd app
npm install
npm start         # Expo — press "a" for Android emulator, "i" for iOS simulator
```

Set the backend location in [`app/src/api/config.js`](app/src/api/config.js):
- Android emulator → `http://10.0.2.2:4000` (default)
- iOS simulator → `http://localhost:4000`
- Physical phone → `http://<your-computer-LAN-IP>:4000`

Log in with the pre-filled demo account (**`08030000000` / `password`**). The
dashboard, live gauges, analytics, alerts, reports and certification export all
read live data from the backend; the critical-alert toast is pushed over the
WebSocket when the engine trips a humidity breach.

## What the backend does (Chapter 3 → code)

The backend runs the four-stage **Smart Farming Cycle** on every sample —
whether it comes from a real ESP32 (`POST /api/ingest`) or the built-in
simulator — so hardware and simulated nodes behave identically:

1. **Observation** — aggregate 3× DHT22 + 2× soil probe arrays, EWMA-smooth them.
2. **Diagnostics** — 2-of-3 humidity quorum, max-temperature check → NOMINAL /
   APPROACH / BREACH status codes.
3. **Decision** — prioritised rule engine with hysteresis (85→88 % RH,
   30→28.5 °C).
4. **Action** — toggle pump/fan relays, log a dual-timestamped actuator event,
   raise an alert, and dispatch the farmer SMS.

Every reading and actuator event is stored with **both** a server ISO-8601
timestamp and the device timestamp — the dual-timestamp tamper-evidence that
backs the decentralised seed-certification export (`/api/certification/export`).

See [`backend/README.md`](backend/README.md) for the full API reference.

## Integrating the provided UI

The uploaded `SmartCassavaNursery.jsx` was a web React mockup with hard-coded
demo data. It has been ported screen-for-screen to React Native under
[`app/src/screens/`](app/src/screens) and every screen now pulls live data from
the backend instead of constants:

| Screen | Backend source |
|---|---|
| Dashboard | `/api/readings/latest`, `/api/devices/status`, `/api/reports/summary` |
| Live Monitoring | WebSocket `reading` + `/api/readings/trend` |
| Analytics | `/api/readings/trend`, `/api/reports/water` |
| Alerts | `/api/alerts` (+ WebSocket critical toast) |
| Reports | `/api/reports/summary`, `/api/certification/export` |
| Settings | `/api/settings` (thresholds are saved back to the device) |
| System / SMS preview | `/api/architecture`, `/api/sms-preview` |

Design tokens, gauges, and layout match the original UI; `recharts` was replaced
with small `react-native-svg` charts and `lucide-react` with `lucide-react-native`.
