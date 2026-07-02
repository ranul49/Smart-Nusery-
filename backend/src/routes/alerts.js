import { Router } from "express";
import { db } from "../lib/store.js";
import { requireAuth } from "../lib/auth.js";
import { resolveDevice } from "../lib/devices.js";

const router = Router();
router.use(requireAuth);

const ICONS = {
  Critical: "AlertTriangle",
  Warning: "Thermometer",
  Resolved: "CheckCircle2",
  Info: "Activity",
};

// Event log + tally counts for the Alerts screen.
router.get("/", (req, res) => {
  const device = resolveDevice(req, res);
  if (!device) return;
  const all = db.alerts
    .find((a) => a.deviceId === device.id)
    .sort((a, b) => new Date(b.ts) - new Date(a.ts));

  const limited = all.slice(0, Number(req.query.limit || 30)).map((a) => ({
    ...a,
    icon: ICONS[a.level] || "Activity",
    time: new Date(a.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  }));

  const counts = { Critical: 0, Warning: 0, Resolved: 0 };
  for (const a of all) if (counts[a.level] != null) counts[a.level]++;

  res.json({ alerts: limited, counts });
});

// Two-way acknowledgement — records farmer response latency (Chapter 3.7.1).
router.post("/:id/ack", (req, res) => {
  const alert = db.alerts.findOne((a) => a.id === req.params.id);
  if (!alert) return res.status(404).json({ error: "Alert not found" });
  const device = db.devices.findOne((d) => d.id === alert.deviceId && d.ownerId === req.user.id);
  if (!device) return res.status(403).json({ error: "Not your alert" });

  const now = new Date().toISOString();
  const latencyMs = new Date(now) - new Date(alert.ts);
  db.alerts.update((a) => a.id === alert.id, {
    acknowledged: true,
    acknowledgedAt: now,
    responseLatencyMs: latencyMs,
  });
  res.json({ ok: true, responseLatencyMs: latencyMs });
});

export default router;
