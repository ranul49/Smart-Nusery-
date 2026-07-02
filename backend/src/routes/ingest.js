import { Router } from "express";
import { db } from "../lib/store.js";
import { requireDeviceKey } from "../lib/auth.js";
import { processReading } from "../lib/engine.js";

const router = Router();

/*
 * Field-node ingestion endpoint. A real ESP32 posts here every 5 s with the
 * raw per-sensor arrays and its DS1307 timestamp; it authenticates with the
 * shared device key (header `x-device-key`). This is the same code path the
 * simulator uses, so hardware and simulated nodes are indistinguishable to the
 * rest of the system.
 *
 * Example body:
 * {
 *   "deviceId": "dev_xxx",
 *   "deviceTs": "2026-07-01T11:42:03Z",
 *   "humidity": [84, 83, 86],
 *   "temperature": [29.1, 30.2, 29.8],
 *   "soil": [71, 68],
 *   "light": 850
 * }
 */
router.post("/", requireDeviceKey, (req, res) => {
  const { deviceId, humidity, temperature, soil } = req.body || {};
  const device = db.devices.findOne((d) => d.id === deviceId);
  if (!device) return res.status(404).json({ error: "Unknown device" });
  if (!Array.isArray(humidity) || !Array.isArray(temperature) || !Array.isArray(soil)) {
    return res.status(400).json({ error: "humidity, temperature and soil must be arrays" });
  }
  const reading = processReading(device, {
    humidity,
    temperature,
    soil,
    light: req.body.light,
    deviceTs: req.body.deviceTs,
  });
  res.status(201).json({ ok: true, reading });
});

export default router;
