import { Router } from "express";
import { db } from "../lib/store.js";
import { requireAuth } from "../lib/auth.js";
import { resolveDevice } from "../lib/devices.js";
import { getThresholds } from "../lib/engine.js";
import { formatAlertSms } from "../lib/sms.js";

const router = Router();
router.use(requireAuth);

// Renders the "farmer SMS alert" preview exactly as it would be delivered.
router.get("/sms-preview", (req, res) => {
  const device = resolveDevice(req, res);
  if (!device) return;
  const th = getThresholds(device.id);
  // Use the most recent humidity breach if one exists, else a representative one.
  const breach = db.alerts
    .find((a) => a.deviceId === device.id && a.level === "Critical")
    .sort((a, b) => new Date(b.ts) - new Date(a.ts))[0];

  const value = breach?.value ?? 81;
  const time = breach ? new Date(breach.ts) : new Date();
  const fields = [
    { k: "Tunnel", v: device.tunnel.replace("Tunnel ", "") },
    { k: "Humidity", v: `${value}%` },
    { k: "Threshold", v: `${th.humidityMin}%` },
    { k: "Action", v: "Pump activated" },
    { k: "Time", v: time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) },
  ];
  res.json({
    fields,
    raw: formatAlertSms({
      tunnel: device.tunnel,
      variable: "Humidity",
      value,
      unit: "%",
      threshold: th.humidityMin,
      action: "Pump activated",
      time: time.toLocaleTimeString("en-GB"),
    }),
    channel: "SIM800L",
  });
});

// Static system-architecture description backing the SystemView screen.
router.get("/architecture", (_req, res) => {
  res.json({
    flow: "Sensors → ESP32 → Cloud → App → Farmer",
    components: [
      { label: "Rooting tunnel", role: "Perception" },
      { label: "ESP32 controller", role: "Perception/Compute" },
      { label: "Relay module", role: "Perception" },
      { label: "Water pump", role: "Actuation" },
      { label: "Cooling fan", role: "Actuation" },
      { label: "SIM800L GSM", role: "Network" },
      { label: "Cloud database", role: "Application" },
      { label: "React Native app", role: "End-User" },
    ],
    pipeline: ["Sense", "Process", "Sync", "Notify", "Act"],
  });
});

export default router;
