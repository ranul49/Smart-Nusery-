import { db, id } from "./store.js";
import { bus, EVENTS } from "./bus.js";
import { formatAlertSms, sendSms } from "./sms.js";
import { DEFAULT_THRESHOLDS } from "../config.js";

/*
 * The Smart Farming Cycle rule engine (Chapter 3.6).
 *
 *   Observation  -> Diagnostics -> Decision-Making -> Action
 *
 * A reading arrives from either a real ESP32 node (POST /api/ingest) or the
 * built-in simulator. Both paths call `processReading`, so the diagnostic and
 * actuation logic is identical regardless of source. All threshold comparison
 * happens here at the "edge/fog" tier — no cloud round-trip is needed to decide
 * whether to actuate.
 */

const EWMA_ALPHA = 0.3; // Chapter 3.6.1 exponentially-weighted moving average
const PUMP_FLOW_LPH = 240; // 12V mini-pump max flow, for water-use accounting

// In-memory smoothing + actuator state, keyed by device id.
const state = new Map();

function getState(deviceId) {
  if (!state.has(deviceId)) {
    state.set(deviceId, {
      ewmaHum: null,
      ewmaTemp: null,
      ewmaSoil: null,
      pumpOn: false,
      fanOn: false,
      pumpSince: null,
      lastStatus: "NOMINAL",
    });
  }
  return state.get(deviceId);
}

function ewma(prev, next) {
  return prev == null ? next : EWMA_ALPHA * next + (1 - EWMA_ALPHA) * prev;
}

function round(n, d = 1) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export function getThresholds(deviceId) {
  const row = db.settings.findOne((s) => s.deviceId === deviceId);
  return row ? { ...DEFAULT_THRESHOLDS, ...row.thresholds } : { ...DEFAULT_THRESHOLDS };
}

function raiseAlert(device, alert) {
  const row = {
    id: id("alert"),
    deviceId: device.id,
    ts: alert.ts,
    level: alert.level,
    variable: alert.variable,
    title: alert.title,
    sub: alert.sub,
    value: alert.value ?? null,
    unit: alert.unit ?? "",
    threshold: alert.threshold ?? null,
    action: alert.action ?? "",
    acknowledged: false,
    acknowledgedAt: null,
    smsSent: false,
  };
  db.alerts.insert(row);
  bus.emit(EVENTS.ALERT, row);

  // Multi-channel alerting: dispatch SMS for actionable (non-info) events.
  if (alert.level === "Critical" || alert.level === "Warning") {
    const user = db.users.findOne((u) => u.id === device.ownerId);
    const to = user?.smsNumber || user?.phone;
    if (to) {
      const body = formatAlertSms({
        tunnel: device.tunnel,
        variable: alert.variable,
        value: alert.value,
        unit: alert.unit ?? "",
        threshold: alert.threshold,
        action: alert.action,
        time: new Date(alert.ts).toLocaleTimeString("en-GB"),
      });
      sendSms(to, body).then((r) => db.alerts.update((a) => a.id === row.id, { smsSent: true, smsChannel: r.channel }));
    }
  }
  return row;
}

function logActuator(device, actuator, on, trigger, value, unit, threshold, ts, deviceTs) {
  const event = {
    id: id("act"),
    deviceId: device.id,
    ts,
    deviceTs, // DS1307 hardware timestamp — dual-source time verification
    actuator, // "pump" | "fan"
    state: on ? "ON" : "OFF",
    trigger,
    value,
    unit,
    threshold,
  };
  db.appendEvent(event);
  bus.emit(EVENTS.ACTUATOR, event);
  return event;
}

/*
 * Core entry point. `sample` carries raw per-sensor arrays exactly as an ESP32
 * would report them:
 *   { humidity: [h1,h2,h3], temperature: [t1,t2,t3], soil: [s1,s2], light,
 *     deviceTs }
 */
export function processReading(device, sample) {
  const th = getThresholds(device.id);
  const st = getState(device.id);
  const ts = new Date().toISOString();
  const deviceTs = sample.deviceTs || ts;

  // --- Stage 1: Observation (aggregate the raw sensor arrays) ---
  const hums = sample.humidity;
  const temps = sample.temperature;
  const soils = sample.soil;
  const meanHum = hums.reduce((a, b) => a + b, 0) / hums.length;
  const maxTemp = Math.max(...temps);
  const meanTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
  const meanSoil = soils.reduce((a, b) => a + b, 0) / soils.length;

  // EWMA smoothing (suppresses condensation/self-heating spikes)
  st.ewmaHum = ewma(st.ewmaHum, meanHum);
  st.ewmaTemp = ewma(st.ewmaTemp, maxTemp);
  st.ewmaSoil = ewma(st.ewmaSoil, meanSoil);

  const hum = round(st.ewmaHum);
  const temp = round(st.ewmaTemp);
  const soil = round(st.ewmaSoil, 0);
  const light = sample.light != null ? Math.round(sample.light) : null;

  // --- Stage 2: Diagnostics (quorum-based status codes) ---
  // Quorum: 2-of-3 with a full DHT22 array; if a source (e.g. Thinger.io) sends
  // a single aggregated value, require that one (or all) to be below threshold.
  const humBreachCount = hums.filter((h) => h < th.humidityMin).length;
  const quorum = hums.length >= 3 ? 2 : hums.length;
  const humidityBreach = humBreachCount >= quorum;
  const tempBreach = maxTemp > th.tempMax;
  const soilBreach = soil < th.soilMin;

  // APPROACH = within a small margin of breaching (not the whole healthy band).
  const humApproach = !humidityBreach && hum <= th.humidityMin + 2.5;
  const tempApproach = !tempBreach && temp >= th.tempMax - 1.5;

  let status = "NOMINAL";
  if (humidityBreach || tempBreach || soilBreach) status = "BREACH";
  else if (humApproach || tempApproach) status = "APPROACH";

  // --- Stage 3 & 4: Decision-Making + Action (with hysteresis) ---
  // Misting pump — humidity control
  if (humidityBreach && !st.pumpOn) {
    st.pumpOn = true;
    st.pumpSince = Date.now();
    logActuator(device, "pump", true, "humidity", hum, "%", th.humidityMin, ts, deviceTs);
    raiseAlert(device, {
      ts, level: "Critical", variable: "Humidity",
      title: `Humidity dropped below ${th.humidityMin}%`,
      sub: "Misting pump activated automatically",
      value: hum, unit: "%", threshold: th.humidityMin, action: "Pump activated",
    });
  } else if (st.pumpOn && hum >= th.humidityRelease) {
    st.pumpOn = false;
    logActuator(device, "pump", false, "humidity", hum, "%", th.humidityRelease, ts, deviceTs);
    raiseAlert(device, {
      ts, level: "Resolved", variable: "Humidity",
      title: "Humidity restored", sub: "Misting pump turned off",
      value: hum, unit: "%", threshold: th.humidityRelease, action: "Pump off",
    });
  }

  // Cooling fan — temperature control
  if (tempBreach && !st.fanOn) {
    st.fanOn = true;
    logActuator(device, "fan", true, "temperature", round(maxTemp), "°C", th.tempMax, ts, deviceTs);
    raiseAlert(device, {
      ts, level: "Warning", variable: "Temperature",
      title: `Temperature reached ${round(maxTemp)}°C`,
      sub: "Cooling fan activated", value: round(maxTemp), unit: "°C",
      threshold: th.tempMax, action: "Cooling fan activated",
    });
  } else if (st.fanOn && temp <= th.tempRelease) {
    st.fanOn = false;
    logActuator(device, "fan", false, "temperature", temp, "°C", th.tempRelease, ts, deviceTs);
    raiseAlert(device, {
      ts, level: "Resolved", variable: "Temperature",
      title: "Temperature normalised", sub: "Cooling fan turned off",
      value: temp, unit: "°C", threshold: th.tempRelease, action: "Fan off",
    });
  }

  // Anticipatory APPROACH warning (3–5 min heads-up, no actuation)
  if (status === "APPROACH" && st.lastStatus !== "APPROACH") {
    const near = humApproach ? "Humidity" : "Temperature";
    raiseAlert(device, {
      ts, level: "Warning", variable: near,
      title: `${near} approaching threshold`,
      sub: "Anticipatory warning — no actuation yet",
      value: humApproach ? hum : temp, unit: humApproach ? "%" : "°C",
      threshold: humApproach ? th.humidityMin : th.tempMax, action: "Monitoring",
    });
  }
  st.lastStatus = status;

  // Water-use accounting: integrate pump runtime at rated flow.
  let waterDeltaL = 0;
  if (st.pumpOn && st.pumpSince) {
    const now = Date.now();
    waterDeltaL = (PUMP_FLOW_LPH / 3600) * ((now - (st._lastTick || st.pumpSince)) / 1000);
    st._lastTick = now;
  } else {
    st._lastTick = Date.now();
  }

  // --- Persist the reading to the time-series bucket ---
  const reading = {
    id: id("r"),
    deviceId: device.id,
    ts,
    deviceTs,
    temp, // EWMA-smoothed max temp (°C)
    meanTemp: round(meanTemp),
    humidity: hum,
    soil,
    light,
    status,
    pumpOn: st.pumpOn,
    fanOn: st.fanOn,
    waterDeltaL: round(waterDeltaL, 4),
    raw: { humidity: hums.map((h) => round(h)), temperature: temps.map((t) => round(t)), soil: soils.map((s) => round(s, 0)) },
  };
  db.appendReading(reading);

  // Keep the device's live status fresh.
  db.devices.update((d) => d.id === device.id, {
    status: "online",
    lastSeen: ts,
    pumpOn: st.pumpOn,
    fanOn: st.fanOn,
  });

  bus.emit(EVENTS.READING, reading);
  return reading;
}
