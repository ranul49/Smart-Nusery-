import { EventEmitter } from "node:events";

/*
 * In-process event bus. The Smart Farming Cycle (ingest / simulator) publishes
 * "reading", "alert", and "actuator" events here; the WebSocket layer subscribes
 * and pushes them to connected app clients so the dashboard, live-monitoring
 * gauges, and the critical-alert toast update in real time.
 */
export const bus = new EventEmitter();
bus.setMaxListeners(0);

export const EVENTS = {
  READING: "reading",
  ALERT: "alert",
  ACTUATOR: "actuator",
  DEVICE: "device",
};
