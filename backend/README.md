# Smart Cassava Nursery — Backend (Application Layer)

Node.js + Express backend that implements the **Application** and **cloud** tiers
of the five-layer IoT architecture in Chapter 3 of Project **SEN-20-5112**. It is
the "Thinger.io-equivalent" cloud platform: it ingests sensor samples, runs the
Smart Farming Cycle rule engine, stores timestamped Data Buckets, dispatches SMS
alerts, and serves the React Native app over REST + WebSocket.

## Quick start

```bash
cd backend
npm install
cp .env.example .env      # (already copied on first setup)
npm run seed              # creates demo account + ~2h of history
npm start                 # http://localhost:4000
```

Demo login → **phone `08030000000`, password `password`**.

With `SIMULATOR_ENABLED=true` (default) a virtual ESP32 node generates a fresh
reading every 5 s and drives the full actuation/alert/SMS pipeline, so the app
shows live data with no hardware. SMS messages are printed to the console unless
Twilio credentials are set in `.env`.

## How it maps to Chapter 3

| Chapter 3 concept | Where it lives |
|---|---|
| Smart Farming Cycle (Observe→Diagnose→Decide→Act) | `src/lib/engine.js` |
| EWMA smoothing (α = 0.3) | `src/lib/engine.js` |
| 2-of-3 humidity quorum, NOMINAL/APPROACH/BREACH | `src/lib/engine.js` |
| Hysteresis (85→88 % RH, 30→28.5 °C) | `src/lib/engine.js` |
| Dual-timestamp certification log | `src/lib/engine.js`, `routes/certification.js` |
| Multi-channel SMS alerting (Twilio-ready) | `src/lib/sms.js` |
| Thinger.io Data Buckets (persistent, timestamped) | `src/lib/store.js` |
| ESP32 ingestion (`/api/ingest`) | `routes/ingest.js` |
| Editable OTA thresholds | `routes/settings.js` |

## REST API

All `/api/*` routes except `auth`, `health`, and `ingest` require
`Authorization: Bearer <token>`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create account `{ phone, password, name }` → `{ token, user }` |
| POST | `/api/auth/login` | `{ phone, password }` → `{ token, user }` |
| GET | `/api/auth/me` | Current user |
| GET | `/api/devices` | List owned nodes |
| GET | `/api/devices/status` | Pump/fan/wifi/cloud/SMS status rows |
| GET | `/api/readings/latest` | Latest reading + dashboard summary |
| GET | `/api/readings/trend?window=1h\|24h\|7d&points=N` | Down-sampled time series |
| GET | `/api/alerts?limit=N` | Event log + Critical/Warning/Resolved counts |
| POST | `/api/alerts/:id/ack` | Acknowledge (records farmer response latency) |
| GET | `/api/reports/summary` | Cycle metrics + today's statistics |
| GET | `/api/reports/water` | 7-day water-consumption series |
| GET | `/api/settings` | Thresholds + system settings |
| PUT | `/api/settings/thresholds` | Update automation thresholds |
| PUT | `/api/settings/system` | Update SMS number / language |
| GET | `/api/certification/export?format=csv\|json` | Immutable audit log export |
| GET | `/api/sms-preview` | Formatted farmer SMS preview |
| GET | `/api/architecture` | System-architecture description |
| POST | `/api/ingest` | **ESP32 → cloud** sensor upload (header `x-device-key`) |

WebSocket: `ws://host:4000/ws?token=<JWT>` streams `reading`, `alert`, and
`actuator` messages for the caller's devices.

## Data storage

Buckets are JSON files under `data/` (gitignored). Time-series buckets are capped
(readings ≈ 28 h, events ≈ 5 000) so files stay bounded. Swap `src/lib/store.js`
for a real database (Postgres/Mongo/Thinger.io) without touching route logic.
