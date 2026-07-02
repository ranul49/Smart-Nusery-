import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT || 4000),
  host: process.env.HOST || "0.0.0.0",

  jwtSecret: process.env.JWT_SECRET || "dev-insecure-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "30d",

  deviceApiKey: process.env.DEVICE_API_KEY || "esp32-nursery-shared-key",

  simulatorEnabled: (process.env.SIMULATOR_ENABLED || "true") !== "false",
  sampleIntervalSec: Number(process.env.SAMPLE_INTERVAL_SEC || 5),

  // Where live data comes from: "simulator" (self-generated), "thinger" (poll
  // Thinger.io, which the ESP32 streams to), or "ingest" (wait for ESP32 to
  // POST directly to /api/ingest). Defaults to simulator unless overridden.
  dataSource: process.env.DATA_SOURCE || (process.env.SIMULATOR_ENABLED === "false" ? "ingest" : "simulator"),

  // Thinger.io connector — used when DATA_SOURCE=thinger.
  thinger: {
    host: process.env.THINGER_HOST || "https://api.thinger.io", // regional? e.g. https://backend.thinger.io
    user: process.env.THINGER_USER || "",
    token: process.env.THINGER_TOKEN || "", // access token with read scope
    device: process.env.THINGER_DEVICE || "", // read a device resource…
    resource: process.env.THINGER_RESOURCE || "", // …this resource name
    bucket: process.env.THINGER_BUCKET || "", // …OR read the latest bucket record
    pollSec: Number(process.env.THINGER_POLL_SEC || 5),
    // Which fields in the Thinger payload hold each sensor value.
    fields: {
      humidity: process.env.THINGER_FIELD_HUMIDITY || "humidity",
      temperature: process.env.THINGER_FIELD_TEMPERATURE || "temperature",
      soil: process.env.THINGER_FIELD_SOIL || "soil",
      light: process.env.THINGER_FIELD_LIGHT || "light",
    },
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    fromNumber: process.env.TWILIO_FROM_NUMBER || "",
  },

  dataDir: path.resolve(__dirname, "..", "data"),
};

/*
 * Biological thresholds from the IITA "Cut, Root, and Grow" protocol
 * (Chapter 3, Sections 3.4.4 and 3.6.2). These are the factory defaults;
 * each device stores its own editable copy in the settings table.
 */
export const DEFAULT_THRESHOLDS = {
  humidityMin: 85, // % RH — misting pump activates below this
  humidityRelease: 88, // % RH — pump deactivates above this (3% hysteresis)
  tempMax: 30, // °C — cooling fan activates above this
  tempRelease: 28.5, // °C — fan deactivates below this (1.5 °C hysteresis)
  soilMin: 60, // % volumetric water content — alert below this
  approachBandPct: 5, // % of threshold that counts as an APPROACH warning
};
