import bcrypt from "bcryptjs";
import { db, id } from "./store.js";
import { DEFAULT_THRESHOLDS } from "../config.js";

/*
 * Idempotent boot seed. A freshly deployed cloud instance starts with an empty
 * data store, so this guarantees the demo account + primary device exist on
 * first boot (otherwise there'd be nothing to log into). It is NON-destructive:
 * if any users already exist it does nothing, so live data is never wiped.
 *
 * The rich ~2h history backfill still lives in `npm run seed` for local dev.
 */
export async function ensureDemo() {
  if (db.users.find().length > 0) return;

  const user = db.users.insert({
    id: id("user"),
    phone: "08030000000",
    name: "Farmer Adeyemi",
    smsNumber: "+2348030000000",
    language: "English",
    passwordHash: await bcrypt.hash("password", 10),
    createdAt: new Date().toISOString(),
  });

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

  db.settings.insert({ id: id("set"), deviceId: device.id, thresholds: { ...DEFAULT_THRESHOLDS } });
  console.log("[seed] provisioned demo account (08030000000) + primary device on empty store");
}
