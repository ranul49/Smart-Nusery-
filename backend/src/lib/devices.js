import { db } from "./store.js";

// Resolve the device a request is about, defaulting to the user's first node.
// Guarantees the caller owns the device.
export function resolveDevice(req, res) {
  const requested = req.query.deviceId || req.body?.deviceId;
  const owned = db.devices.find((d) => d.ownerId === req.user.id);
  if (owned.length === 0) {
    res.status(404).json({ error: "No device registered for this account" });
    return null;
  }
  const device = requested ? owned.find((d) => d.id === requested) : owned[0];
  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return null;
  }
  return device;
}
