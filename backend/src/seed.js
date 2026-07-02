import bcrypt from "bcryptjs";
import { db, id } from "./lib/store.js";
import { DEFAULT_THRESHOLDS } from "./config.js";

/*
 * Seeds a demo account with ~2 hours of backfilled environmental history so the
 * dashboard, analytics, reports and certification export are populated the
 * moment the app first logs in. Idempotent: re-running resets the demo data.
 *
 * Demo credentials:  phone 08030000000   password: password
 */

const DEMO_PHONE = "08030000000";

function reset() {
  for (const col of [db.users, db.devices, db.settings, db.readings, db.actuatorEvents, db.alerts]) {
    col.rows.length = 0;
    col.flush();
  }
}

async function seed() {
  reset();

  const user = db.users.insert({
    id: id("user"),
    phone: DEMO_PHONE,
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

  // Backfill ~2 hours at a 5 s cadence.
  const th = DEFAULT_THRESHOLDS;
  const N = 1440;
  const now = Date.now();
  let hum = 89, temp = 27.5, soil = 74, pumpOn = false, fanOn = false;

  for (let i = N; i > 0; i--) {
    const ts = new Date(now - i * 5000).toISOString();

    // Mean-reverting microclimate: sits healthily near setpoint, with the pump
    // giving an extra push and occasional stress events causing real breaches.
    hum += (88.5 - hum) * 0.06 + (pumpOn ? 0.7 : 0) + (Math.random() - 0.5) * 0.5;
    if (Math.random() < 0.012) hum -= 3.5; // gust / door-open desiccation event
    hum = Math.max(80, Math.min(95, hum));

    temp += (27.2 - temp) * 0.06 - (fanOn ? 0.5 : 0) + (Math.random() - 0.5) * 0.4;
    if (Math.random() < 0.01) temp += 3.6; // solar-radiation heat spike
    temp = Math.max(24.5, Math.min(33, temp));

    soil += (73 - soil) * 0.05 + (pumpOn ? 0.3 : 0) + (Math.random() - 0.5) * 0.5;
    soil = Math.max(62, Math.min(80, soil));

    // Actuation with hysteresis + alert/event logging.
    if (hum < th.humidityMin && !pumpOn) {
      pumpOn = true;
      db.appendEvent({ id: id("act"), deviceId: device.id, ts, deviceTs: ts, actuator: "pump", state: "ON", trigger: "humidity", value: +hum.toFixed(1), unit: "%", threshold: th.humidityMin });
      db.alerts.insert({ id: id("alert"), deviceId: device.id, ts, level: "Critical", variable: "Humidity", title: `Humidity dropped below ${th.humidityMin}%`, sub: "Misting pump activated automatically", value: +hum.toFixed(1), unit: "%", threshold: th.humidityMin, action: "Pump activated", acknowledged: false, smsSent: true });
    } else if (pumpOn && hum >= th.humidityRelease) {
      pumpOn = false;
      db.appendEvent({ id: id("act"), deviceId: device.id, ts, deviceTs: ts, actuator: "pump", state: "OFF", trigger: "humidity", value: +hum.toFixed(1), unit: "%", threshold: th.humidityRelease });
      db.alerts.insert({ id: id("alert"), deviceId: device.id, ts, level: "Resolved", variable: "Humidity", title: "Humidity restored", sub: "Misting pump turned off", value: +hum.toFixed(1), unit: "%", threshold: th.humidityRelease, action: "Pump off", acknowledged: false, smsSent: false });
    }
    if (temp > th.tempMax && !fanOn) {
      fanOn = true;
      db.appendEvent({ id: id("act"), deviceId: device.id, ts, deviceTs: ts, actuator: "fan", state: "ON", trigger: "temperature", value: +temp.toFixed(1), unit: "°C", threshold: th.tempMax });
      db.alerts.insert({ id: id("alert"), deviceId: device.id, ts, level: "Warning", variable: "Temperature", title: `Temperature reached ${temp.toFixed(1)}°C`, sub: "Cooling fan activated", value: +temp.toFixed(1), unit: "°C", threshold: th.tempMax, action: "Cooling fan activated", acknowledged: false, smsSent: true });
    } else if (fanOn && temp <= th.tempRelease) {
      fanOn = false;
      db.appendEvent({ id: id("act"), deviceId: device.id, ts, deviceTs: ts, actuator: "fan", state: "OFF", trigger: "temperature", value: +temp.toFixed(1), unit: "°C", threshold: th.tempRelease });
    }

    const status = hum < th.humidityMin || temp > th.tempMax ? "BREACH" : "NOMINAL";
    db.readings.append(
      {
        id: id("r"),
        deviceId: device.id,
        ts,
        deviceTs: ts,
        temp: +temp.toFixed(1),
        meanTemp: +temp.toFixed(1),
        humidity: +hum.toFixed(0),
        soil: +soil.toFixed(0),
        light: Math.round(600 + Math.random() * 400),
        status,
        pumpOn,
        fanOn,
        waterDeltaL: pumpOn ? +((240 / 3600) * 5).toFixed(4) : 0,
        raw: {},
      },
      20000
    );
  }

  db.flushAll();
  console.log("Seeded demo account:");
  console.log("  phone   : 08030000000");
  console.log("  password: password");
  console.log(`  device  : ${device.name} (${device.tunnel})`);
  console.log(`  readings: ${db.readings.rows.length}, alerts: ${db.alerts.rows.length}, events: ${db.actuatorEvents.rows.length}`);
}

seed();
