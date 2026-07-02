import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

/*
 * Lightweight JSON-file persistence layer.
 *
 * The project's Application layer (Chapter 3.5.3) is modelled on Thinger.io
 * "Data Buckets": persistent, indexed, timestamped storage for every sensor
 * reading and actuator event. Rather than pull in a native database driver
 * (which complicates cross-platform setup for a field project), each logical
 * bucket is a JSON file that is loaded into memory on boot and flushed back to
 * disk on change. Time-series buckets are capped so the files stay bounded.
 */

const MAX_READINGS = 20000; // ~28 hours at a 5 s cadence, per device
const MAX_EVENTS = 5000;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

class Collection {
  constructor(name) {
    this.name = name;
    this.file = path.join(config.dataDir, `${name}.json`);
    this.rows = [];
    this._saveTimer = null;
    this._load();
  }

  _load() {
    ensureDir(config.dataDir);
    if (fs.existsSync(this.file)) {
      try {
        this.rows = JSON.parse(fs.readFileSync(this.file, "utf-8"));
      } catch {
        this.rows = [];
      }
    }
  }

  // Debounced write so a burst of ingest calls doesn't hammer the disk.
  _scheduleSave() {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this.flush();
    }, 400);
  }

  flush() {
    ensureDir(config.dataDir);
    fs.writeFileSync(this.file, JSON.stringify(this.rows));
  }

  insert(row) {
    this.rows.push(row);
    this._scheduleSave();
    return row;
  }

  // Append to a capped time-series bucket (keeps only the newest `cap` rows).
  append(row, cap) {
    this.rows.push(row);
    if (cap && this.rows.length > cap) {
      this.rows.splice(0, this.rows.length - cap);
    }
    this._scheduleSave();
    return row;
  }

  update(predicate, patch) {
    let n = 0;
    for (const row of this.rows) {
      if (predicate(row)) {
        Object.assign(row, patch);
        n++;
      }
    }
    if (n) this._scheduleSave();
    return n;
  }

  find(predicate) {
    return predicate ? this.rows.filter(predicate) : this.rows.slice();
  }

  findOne(predicate) {
    return this.rows.find(predicate);
  }
}

export const db = {
  users: new Collection("users"),
  devices: new Collection("devices"),
  settings: new Collection("settings"),
  readings: new Collection("readings"),
  actuatorEvents: new Collection("actuator_events"),
  alerts: new Collection("alerts"),

  appendReading(row) {
    return this.readings.append(row, MAX_READINGS);
  },
  appendEvent(row) {
    return this.actuatorEvents.append(row, MAX_EVENTS);
  },
  flushAll() {
    for (const key of Object.keys(this)) {
      if (this[key] instanceof Collection) this[key].flush();
    }
  },
};

let counter = Date.now();
export function id(prefix = "id") {
  counter += 1;
  return `${prefix}_${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
