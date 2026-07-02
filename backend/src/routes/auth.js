import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, id } from "../lib/store.js";
import { signToken, requireAuth, publicUser } from "../lib/auth.js";
import { DEFAULT_THRESHOLDS } from "../config.js";

const router = Router();

// Normalise a Nigerian phone number to a comparable form.
function normalisePhone(phone) {
  return String(phone || "").replace(/[\s-]/g, "");
}

router.post("/register", async (req, res) => {
  const { phone, password, name } = req.body || {};
  if (!phone || !password) {
    return res.status(400).json({ error: "Phone number and password are required" });
  }
  const key = normalisePhone(phone);
  if (db.users.findOne((u) => normalisePhone(u.phone) === key)) {
    return res.status(409).json({ error: "An account with this phone number already exists" });
  }
  const user = db.users.insert({
    id: id("user"),
    phone: key,
    name: name || "Farmer",
    smsNumber: key,
    language: "English",
    passwordHash: await bcrypt.hash(password, 10),
    createdAt: new Date().toISOString(),
  });

  // Give every new account a default tunnel node so the app has data on login.
  provisionDefaultDevice(user);

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post("/login", async (req, res) => {
  const { phone, password } = req.body || {};
  const key = normalisePhone(phone);
  const user = db.users.findOne((u) => normalisePhone(u.phone) === key);
  if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) {
    return res.status(401).json({ error: "Incorrect phone number or password" });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export function provisionDefaultDevice(user) {
  const existing = db.devices.findOne((d) => d.ownerId === user.id);
  if (existing) return existing;
  const device = db.devices.insert({
    id: id("dev"),
    ownerId: user.id,
    name: "ESP32-NURSERY-A1",
    tunnel: "Tunnel A",
    firmware: "v2.4.1",
    seedlings: 450,
    status: "online",
    lastSeen: new Date().toISOString(),
    pumpOn: false,
    fanOn: false,
    createdAt: new Date().toISOString(),
  });
  db.settings.insert({
    id: id("set"),
    deviceId: device.id,
    thresholds: { ...DEFAULT_THRESHOLDS },
  });
  return device;
}

export default router;
