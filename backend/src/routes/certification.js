import { Router } from "express";
import { db } from "../lib/store.js";
import { requireAuth } from "../lib/auth.js";
import { resolveDevice } from "../lib/devices.js";
import { getThresholds } from "../lib/engine.js";

const router = Router();
router.use(requireAuth);

/*
 * Immutable environmental log export for decentralised "light-touch" seed
 * certification (Chapter 3.7.2). Every row carries BOTH the server-side ISO 8601
 * timestamp and the device DS1307 hardware timestamp — the dual-timestamp
 * architecture that makes post-hoc backdating detectable as a discontinuity.
 * Exposed as CSV or JSON so a certification body can audit a batch without
 * dashboard credentials.
 */
router.get("/export", (req, res) => {
  const device = resolveDevice(req, res);
  if (!device) return;
  const format = (req.query.format || "json").toLowerCase();
  const readings = db.readings.find((r) => r.deviceId === device.id);

  if (format === "csv") {
    const header = "server_ts,device_ts,tunnel,temp_c,humidity_pct,soil_pct,light_lux,status,pump,fan\n";
    const body = readings
      .map((r) =>
        [r.ts, r.deviceTs, device.tunnel, r.temp, r.humidity, r.soil, r.light ?? "", r.status, r.pumpOn ? 1 : 0, r.fanOn ? 1 : 0].join(",")
      )
      .join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="certification-${device.tunnel}.csv"`);
    return res.send(header + body);
  }

  res.json({
    device: { id: device.id, tunnel: device.tunnel, firmware: device.firmware },
    thresholds: getThresholds(device.id),
    generatedAt: new Date().toISOString(),
    recordCount: readings.length,
    readings: readings.map((r) => ({
      serverTs: r.ts,
      deviceTs: r.deviceTs,
      temp: r.temp,
      humidity: r.humidity,
      soil: r.soil,
      light: r.light,
      status: r.status,
      pump: r.pumpOn,
      fan: r.fanOn,
    })),
  });
});

export default router;
