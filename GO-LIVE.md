# Going Live — connecting a real ESP32

Everything needed to switch from demo data to real hardware is already built and
tested. This is a **configure‑and‑flash** checklist, not a coding task. Pick the
path that matches your setup — **Path A (Thinger.io)** is the one from Chapter 3
and the recommended one.

The processing never changes: whichever path you choose, real readings flow
through the exact same Smart Farming Cycle engine the demo uses, so the app,
alerts, reports, and certification log all keep working unchanged.

---

## Path A — ESP32 → Thinger.io → backend  (recommended, matches Chapter 3)

```
ESP32 ──▶ Thinger.io ──(backend polls)──▶ backend engine ──▶ app
```

**1. Thinger.io**
- Create a device and stream data to it using the provided firmware
  [`firmware/esp32_thinger_node.ino`](firmware/esp32_thinger_node.ino)
  (fill in Wi‑Fi + Thinger credentials, flash).
- Create a **Data Bucket** that samples the `sensors` resource every 5 s.
- Create an **Access Token** with read access to that bucket.

**2. Backend `backend/.env`**
```ini
DATA_SOURCE=thinger
THINGER_HOST=https://api.thinger.io        # or your regional/self-hosted host
THINGER_USER=your_thinger_username
THINGER_TOKEN=your_access_token
THINGER_BUCKET=nursery_bucket
# field names already match the firmware; change only if you rename them:
THINGER_FIELD_HUMIDITY=humidity
THINGER_FIELD_TEMPERATURE=temperature
THINGER_FIELD_SOIL=soil
THINGER_FIELD_LIGHT=light
```
Restart the backend → it logs `Data source: thinger` and pulls real data every 5 s.

*(To read a device resource instead of a bucket: leave `THINGER_BUCKET` blank and
set `THINGER_DEVICE` + `THINGER_RESOURCE`.)*

---

## Path B — ESP32 → backend directly (no Thinger.io)

```
ESP32 ──(POST /api/ingest)──▶ backend engine ──▶ app
```

**1. Backend `backend/.env`**
```ini
DATA_SOURCE=ingest
DEVICE_API_KEY=pick-a-shared-secret
```
**2. Flash** [`firmware/esp32_nursery_node.ino`](firmware/esp32_nursery_node.ino)
with your Wi‑Fi, the backend URL (`http://<host>:4000/api/ingest`), the
`DEVICE_KEY` (= `DEVICE_API_KEY` above), and the `DEVICE_ID` (see "device id" below).

---

## App: point it at the backend (both paths)

In [`app/src/api/config.js`](app/src/api/config.js):
```js
export const LOCAL_MODE = false;                     // stop using on-device demo data
const MANUAL_HOST = "https://your-backend-url";      // or http://<LAN-IP>:4000 on same Wi-Fi
```
Then rebuild the APK (warm build ≈ 3 min):
```
cd app/android && ./gradlew assembleRelease
```
Log in with the seeded account (`08030000000` / `password`) — the primary tunnel
now shows real data.

---

## Notes / gotchas
- **Which tunnel shows the data:** the backend feeds its **primary (first) device**,
  owned by the seeded demo account — so log in as that account to view the live
  tunnel. (Multi‑nursery/multi‑user pairing would be the next enhancement.)
- **The device id** (Path B): register/log in, then `GET /api/devices` returns it;
  paste it into the firmware.
- **Cleartext vs HTTPS:** if the backend is plain `http://`, the release app needs
  `usesCleartextTraffic` (already enabled). Deploying the backend behind **HTTPS**
  removes that requirement and works over mobile data anywhere.
- **Real SMS:** set `TWILIO_*` in `backend/.env` (otherwise alerts print to the
  server console). Or let the SIM800L on the node send SMS directly.
- **Thresholds** are editable live from the app's Settings screen and are applied
  by the engine immediately — no reflash needed.
