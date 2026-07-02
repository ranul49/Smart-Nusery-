import { Router } from "express";
import { db } from "../lib/store.js";
import { requireAuth } from "../lib/auth.js";
import { resolveDevice } from "../lib/devices.js";
import { getThresholds } from "../lib/engine.js";

const router = Router();
router.use(requireAuth);

function deviceReadings(deviceId) {
  return db.readings.find((r) => r.deviceId === deviceId);
}

// Latest reading + derived dashboard summary (the status hero + env cards).
router.get("/latest", (req, res) => {
  const device = resolveDevice(req, res);
  if (!device) return;
  const rows = deviceReadings(device.id);
  const latest = rows[rows.length - 1] || null;
  const th = getThresholds(device.id);

  // Health score = share of recent samples within the microclimate spec.
  const recent = rows.slice(-720); // ~1 hour at 5 s
  const compliant = recent.filter((r) => r.status === "NOMINAL").length;
  const health = recent.length ? Math.round((compliant / recent.length) * 100) : 100;

  res.json({
    device,
    thresholds: th,
    latest,
    summary: {
      health,
      seedlings: device.seedlings,
      uptime: device.status === "online" ? 99.4 : 0,
      status: latest?.status || "NOMINAL",
      environment: latest
        ? [
            { key: "temp", label: "Temperature", value: latest.temp, unit: "°C", status: labelTemp(latest.temp, th) },
            { key: "humidity", label: "Humidity", value: latest.humidity, unit: "%", status: labelHum(latest.humidity, th) },
            { key: "soil", label: "Soil Moisture", value: latest.soil, unit: "%", status: labelSoil(latest.soil, th) },
            { key: "light", label: "Light", value: latest.light ?? 0, unit: " Lux", status: "Bright" },
          ]
        : [],
    },
  });
});

// Down-sampled time series for the analytics / live charts.
router.get("/trend", (req, res) => {
  const device = resolveDevice(req, res);
  if (!device) return;
  const window = req.query.window || "1h";
  const points = Number(req.query.points || 24);
  const now = Date.now();
  const spanMs = { "1h": 3600e3, "24h": 24 * 3600e3, "7d": 7 * 24 * 3600e3 }[window] || 3600e3;

  const rows = deviceReadings(device.id).filter((r) => now - new Date(r.ts).getTime() <= spanMs);
  const series = downsample(rows, points).map((r) => ({
    t: new Date(r.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    ts: r.ts,
    temp: r.temp,
    hum: r.humidity,
    soil: r.soil,
  }));
  res.json({ window, series });
});

function downsample(rows, target) {
  if (rows.length <= target) return rows;
  const step = rows.length / target;
  const out = [];
  for (let i = 0; i < target; i++) out.push(rows[Math.floor(i * step)]);
  out.push(rows[rows.length - 1]);
  return out;
}

function labelTemp(v, th) {
  if (v > th.tempMax) return "High";
  if (v >= 24 && v <= th.tempMax) return "Optimal";
  return "Low";
}
function labelHum(v, th) {
  if (v >= 90) return "Excellent";
  if (v >= th.humidityMin) return "Good";
  return "Low";
}
function labelSoil(v, th) {
  if (v >= th.soilMin + 10) return "Good";
  if (v >= th.soilMin) return "Fair";
  return "Dry";
}

export default router;
