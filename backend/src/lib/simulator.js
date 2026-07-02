import { db } from "./store.js";
import { config } from "../config.js";
import { processReading } from "./engine.js";

/*
 * Virtual ESP32 field node.
 *
 * In the absence of physical hardware this generates realistic raw sensor
 * arrays and feeds them through the SAME `processReading` path a real node's
 * POST /api/ingest would use. It models a closed loop: when the misting pump is
 * running (device.pumpOn), humidity climbs back up; when it is off, humidity
 * drifts down toward the tunnel's passive equilibrium — occasionally dipping
 * below the 85% threshold to exercise the full actuation + alert + SMS pipeline.
 */

const sim = new Map();

function baseline(deviceId) {
  if (!sim.has(deviceId)) {
    sim.set(deviceId, { hum: 89, temp: 27.5, soil: 74, light: 850, phase: Math.random() * 6.28 });
  }
  return sim.get(deviceId);
}

function jitter(mag) {
  return (Math.random() - 0.5) * mag;
}

function tick() {
  const devices = db.devices.find();
  for (const device of devices) {
    const s = baseline(device.id);
    s.phase += 0.15;

    // Mean-reverting microclimate. The tunnel sits near its healthy setpoint;
    // the pump/fan give an extra push, and occasional stress events (gusts,
    // solar spikes) cause genuine threshold breaches that drive the cycle.
    s.hum += (88.5 - s.hum) * 0.05 + (device.pumpOn ? 0.9 : 0) + Math.sin(s.phase) * 0.3 + jitter(0.5);
    if (Math.random() < 0.02) s.hum -= 3.4; // gust / door-open desiccation event
    s.hum = Math.max(78, Math.min(96, s.hum));

    s.temp += (27.2 - s.temp) * 0.05 - (device.fanOn ? 0.7 : 0) + Math.sin(s.phase / 2) * 0.25 + jitter(0.4);
    if (Math.random() < 0.018) s.temp += 3.4; // solar-radiation heat spike
    s.temp = Math.max(24, Math.min(33, s.temp));

    s.soil += (73 - s.soil) * 0.05 + (device.pumpOn ? 0.4 : 0) + jitter(0.5);
    s.soil = Math.max(60, Math.min(82, s.soil));

    s.light = Math.max(200, Math.min(1100, s.light + jitter(80)));

    // Build 3 DHT22 + 2 capacitive-probe readings with per-sensor spread.
    const humidity = [s.hum + jitter(1.5), s.hum + jitter(1.5), s.hum + jitter(1.5)].map((v) => +v.toFixed(1));
    const temperature = [s.temp + jitter(0.6), s.temp + jitter(0.6), s.temp + jitter(0.6)].map((v) => +v.toFixed(1));
    const soil = [s.soil + jitter(1.5), s.soil + jitter(1.5)].map((v) => Math.round(v));

    processReading(device, {
      humidity,
      temperature,
      soil,
      light: Math.round(s.light),
      deviceTs: new Date().toISOString(),
    });
  }
}

let handle = null;

export function startSimulator() {
  if (!config.simulatorEnabled || handle) return;
  handle = setInterval(tick, config.sampleIntervalSec * 1000);
  console.log(`[simulator] running — ${config.sampleIntervalSec}s cadence (Smart Farming Cycle)`);
}

export function stopSimulator() {
  if (handle) clearInterval(handle);
  handle = null;
}
