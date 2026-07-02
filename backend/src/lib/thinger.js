import { config } from "../config.js";
import { db } from "./store.js";
import { processReading } from "./engine.js";

/*
 * Thinger.io data source (Chapter 3.5.3 — Thinger.io is the project's cloud
 * platform). The ESP32 streams sensor data to Thinger.io; this poller reads the
 * latest values back over Thinger's REST API and feeds them into the SAME
 * `processReading` pipeline the simulator/ingest paths use. So diagnostics,
 * actuation, alerts, reports and the certification log all work identically —
 * only the origin of the numbers changes.
 *
 * Two read modes (set via .env):
 *   - Device resource:  GET /v3/users/{user}/devices/{device}/resources/{res}
 *   - Data bucket:      GET /v3/users/{user}/buckets/{bucket}/data?items=1&sort=desc
 */

let handle = null;

// Pull a value out of the Thinger payload by field name; accept scalar or array.
function toSensorArray(payload, field, fallbackCount = 1) {
  const v = payload?.[field];
  if (Array.isArray(v)) return v.map(Number).filter((n) => Number.isFinite(n));
  if (Number.isFinite(Number(v))) return new Array(fallbackCount).fill(Number(v));
  return [];
}

async function fetchLatest() {
  const t = config.thinger;
  const headers = { Authorization: `Bearer ${t.token}` };
  let url;
  if (t.bucket) {
    url = `${t.host}/v3/users/${t.user}/buckets/${t.bucket}/data?items=1&sort=desc`;
  } else if (t.device && t.resource) {
    url = `${t.host}/v3/users/${t.user}/devices/${t.device}/resources/${t.resource}`;
  } else {
    throw new Error("Thinger config incomplete: set THINGER_BUCKET, or THINGER_DEVICE + THINGER_RESOURCE");
  }

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Thinger ${res.status}: ${await res.text()}`);
  const data = await res.json();

  // Bucket → [{ ts, val:{...} }] (val holds the sensor object); resource → the
  // resource state object directly (sometimes wrapped in { out: {...} }).
  if (t.bucket) {
    const row = Array.isArray(data) ? data[0] : data?.[0];
    return { payload: row?.val ?? row ?? {}, ts: row?.ts ? new Date(row.ts).toISOString() : undefined };
  }
  return { payload: data?.out ?? data ?? {}, ts: undefined };
}

async function poll() {
  try {
    const { payload, ts } = await fetchLatest();
    const f = config.thinger.fields;
    const sample = {
      humidity: toSensorArray(payload, f.humidity, 3),
      temperature: toSensorArray(payload, f.temperature, 3),
      soil: toSensorArray(payload, f.soil, 2),
      light: Number(payload?.[f.light]) || undefined,
      deviceTs: ts, // Thinger's timestamp doubles as the device timestamp
    };
    if (!sample.humidity.length || !sample.temperature.length || !sample.soil.length) {
      console.warn("[thinger] payload missing expected fields:", Object.keys(payload || {}));
      return;
    }
    // Feed the first registered device (the one the app reads). One Thinger
    // device maps to one local device row.
    const device = db.devices.find()[0];
    if (!device) return;
    processReading(device, sample);
  } catch (err) {
    console.error("[thinger] poll failed:", err.message);
  }
}

export function startThinger() {
  if (handle) return;
  const t = config.thinger;
  if (!t.user || !t.token || (!t.bucket && !(t.device && t.resource))) {
    console.error("[thinger] not started — missing THINGER_USER / THINGER_TOKEN / source. Check .env");
    return;
  }
  console.log(`[thinger] polling ${t.bucket ? `bucket ${t.bucket}` : `${t.device}/${t.resource}`} every ${t.pollSec}s`);
  poll();
  handle = setInterval(poll, t.pollSec * 1000);
}

export function stopThinger() {
  if (handle) clearInterval(handle);
  handle = null;
}
