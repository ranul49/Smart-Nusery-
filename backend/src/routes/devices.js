import { Router } from "express";
import { db } from "../lib/store.js";
import { requireAuth } from "../lib/auth.js";
import { resolveDevice } from "../lib/devices.js";

const router = Router();
router.use(requireAuth);

// List every node the signed-in user owns.
router.get("/", (req, res) => {
  const devices = db.devices.find((d) => d.ownerId === req.user.id);
  res.json({ devices });
});

// Device status rows for the dashboard "Device Status" card.
router.get("/status", (req, res) => {
  const device = resolveDevice(req, res);
  if (!device) return;
  const online = device.status === "online";
  res.json({
    device,
    rows: [
      { key: "pump", label: "Misting Pump", state: device.pumpOn ? "ON" : "OFF", on: device.pumpOn },
      { key: "fan", label: "Cooling Fan", state: device.fanOn ? "ON" : "OFF", on: device.fanOn },
      { key: "wifi", label: "WiFi", state: online ? "Connected" : "Offline", on: online },
      { key: "cloud", label: "Cloud Sync", state: online ? "Connected" : "Offline", on: online },
      { key: "sms", label: "SMS Gateway", state: "Ready", on: true },
    ],
  });
});

router.get("/:id", (req, res) => {
  const device = db.devices.findOne((d) => d.id === req.params.id && d.ownerId === req.user.id);
  if (!device) return res.status(404).json({ error: "Device not found" });
  res.json({ device });
});

export default router;
