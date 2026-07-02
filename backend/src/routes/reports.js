import { Router } from "express";
import { db } from "../lib/store.js";
import { requireAuth } from "../lib/auth.js";
import { resolveDevice } from "../lib/devices.js";
import { getThresholds } from "../lib/engine.js";

const router = Router();
router.use(requireAuth);

// Growth-cycle summary metrics (Reports screen) computed from the raw log.
router.get("/summary", (req, res) => {
  const device = resolveDevice(req, res);
  if (!device) return;
  const th = getThresholds(device.id);
  const readings = db.readings.find((r) => r.deviceId === device.id);
  const alerts = db.alerts.find((a) => a.deviceId === device.id);
  const events = db.actuatorEvents.find((e) => e.deviceId === device.id);

  const n = readings.length || 1;
  const compliant = readings.filter((r) => r.humidity > th.humidityMin && r.temp < th.tempMax).length;
  const compliance = Math.round((compliant / n) * 100);
  const water = readings.reduce((s, r) => s + (r.waterDeltaL || 0), 0);
  const pumpActivations = events.filter((e) => e.actuator === "pump" && e.state === "ON").length;
  const avg = (key) => readings.reduce((s, r) => s + r[key], 0) / n;
  const daysMonitored = readings.length
    ? Math.max(1, Math.ceil((Date.now() - new Date(readings[0].ts)) / 86400e3))
    : 0;

  // "Today's statistics" for the dashboard: water used, actuator runtimes,
  // health score — computed over the last 24 h from the event/reading logs.
  const dayAgo = Date.now() - 86400e3;
  const recent = readings.filter((r) => new Date(r.ts).getTime() >= dayAgo);
  const waterToday = recent.reduce((s, r) => s + (r.waterDeltaL || 0), 0);
  const runtimeMin = (actuator) => {
    const evs = events
      .filter((e) => e.actuator === actuator && new Date(e.ts).getTime() >= dayAgo)
      .sort((a, b) => new Date(a.ts) - new Date(b.ts));
    let ms = 0;
    let onAt = null;
    for (const e of evs) {
      if (e.state === "ON") onAt = new Date(e.ts);
      else if (e.state === "OFF" && onAt) {
        ms += new Date(e.ts) - onAt;
        onAt = null;
      }
    }
    if (onAt) ms += Date.now() - onAt; // still running
    return Math.round(ms / 60000);
  };
  const compliantRecent = recent.filter((r) => r.status === "NOMINAL").length;
  const healthToday = recent.length ? Math.round((compliantRecent / recent.length) * 100) : 100;

  res.json({
    device,
    cycle: { number: 4, daysMonitored },
    today: {
      waterUsed: `${waterToday.toFixed(0)} L`,
      pumpRuntime: `${runtimeMin("pump")} min`,
      fanRuntime: `${runtimeMin("fan")} min`,
      healthScore: `${healthToday}%`,
    },
    metrics: [
      { key: "compliance", label: "Compliance percentage", value: `${compliance}%` },
      { key: "alerts", label: "Total alerts", value: String(alerts.length) },
      { key: "water", label: "Total water consumption", value: `${water.toFixed(0)} L` },
      { key: "pump", label: "Total pump activations", value: String(pumpActivations) },
      { key: "avgHum", label: "Average humidity", value: `${avg("humidity").toFixed(1)}%` },
      { key: "avgTemp", label: "Average temperature", value: `${avg("temp").toFixed(1)}°C` },
      { key: "avgSoil", label: "Average soil moisture", value: `${avg("soil").toFixed(0)}%` },
    ],
    compliance,
  });
});

// Water consumption for the last 7 days (Analytics bar chart).
router.get("/water", (req, res) => {
  const device = resolveDevice(req, res);
  if (!device) return;
  const readings = db.readings.find((r) => r.deviceId === device.id);
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  const buckets = new Array(7).fill(0);
  const now = new Date();

  for (const r of readings) {
    const daysAgo = Math.floor((now - new Date(r.ts)) / 86400e3);
    if (daysAgo >= 0 && daysAgo < 7) {
      const idx = 6 - daysAgo;
      buckets[idx] += r.waterDeltaL || 0;
    }
  }
  const series = buckets.map((l, i) => ({ d: labels[i], l: Math.round(l) }));
  res.json({ series });
});

export default router;
