import { Router } from "express";
import { db } from "../lib/store.js";
import { requireAuth, publicUser } from "../lib/auth.js";
import { resolveDevice } from "../lib/devices.js";
import { getThresholds } from "../lib/engine.js";
import { DEFAULT_THRESHOLDS } from "../config.js";

const router = Router();
router.use(requireAuth);

// Fetch automation thresholds + system settings (Settings screen).
router.get("/", (req, res) => {
  const device = resolveDevice(req, res);
  if (!device) return;
  res.json({
    thresholds: getThresholds(device.id),
    system: {
      smsNumber: req.user.smsNumber || req.user.phone,
      language: req.user.language || "English",
      cloudConnection: device.status === "online" ? "Connected" : "Offline",
      firmware: device.firmware,
    },
  });
});

// Update editable automation thresholds. OTA-style: no hardware retrieval needed.
router.put("/thresholds", (req, res) => {
  const device = resolveDevice(req, res);
  if (!device) return;
  const allowed = ["humidityMin", "humidityRelease", "tempMax", "tempRelease", "soilMin"];
  const patch = {};
  for (const key of allowed) {
    if (req.body[key] != null && Number.isFinite(Number(req.body[key]))) {
      patch[key] = Number(req.body[key]);
    }
  }
  const current = getThresholds(device.id);
  const next = { ...DEFAULT_THRESHOLDS, ...current, ...patch };
  const existing = db.settings.findOne((s) => s.deviceId === device.id);
  if (existing) db.settings.update((s) => s.deviceId === device.id, { thresholds: next });
  else db.settings.insert({ deviceId: device.id, thresholds: next });
  res.json({ thresholds: next });
});

// Update user-level system settings (SMS number, language).
router.put("/system", (req, res) => {
  const patch = {};
  if (req.body.smsNumber) patch.smsNumber = String(req.body.smsNumber);
  if (req.body.language) patch.language = String(req.body.language);
  db.users.update((u) => u.id === req.user.id, patch);
  const user = db.users.findOne((u) => u.id === req.user.id);
  res.json({ user: publicUser(user) });
});

export default router;
