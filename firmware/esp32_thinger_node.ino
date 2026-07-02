/*
 * Smart Cassava Nursery — ESP32 → Thinger.io node (Project SEN-20-5112)
 * ---------------------------------------------------------------------
 * RECOMMENDED live firmware (Chapter 3.5.3). The ESP32 streams sensor data to
 * Thinger.io; your backend (DATA_SOURCE=thinger) polls Thinger and runs the
 * Smart Farming Cycle, so the app shows real data with no code changes.
 *
 * When your ESP32 arrives you only need to:
 *   1. Install libraries: "ThingerESP32" and "DHT sensor library" (Adafruit).
 *   2. Fill in the CONFIG block below (Wi-Fi + Thinger device credentials).
 *   3. In the Thinger.io console, create a Data Bucket that samples the
 *      "sensors" resource every 5 s  (or enable this sketch's write_bucket line).
 *   4. Flash. Point your backend .env at that bucket (THINGER_BUCKET=...).
 *
 * The JSON field names emitted here (humidity/temperature/soil/light) match the
 * backend's THINGER_FIELD_* defaults, so no mapping changes are needed.
 */

#include <ThingerESP32.h>
#include <DHT.h>

// ---------------- CONFIG (fill these in) ----------------
#define WIFI_SSID     "your-wifi"
#define WIFI_PASSWORD "your-password"
#define THINGER_USERNAME    "your_thinger_username"
#define THINGER_DEVICE_ID   "nursery_a1"
#define THINGER_DEVICE_CREDENTIAL "device_credential_from_thinger"
#define BUCKET_ID     "nursery_bucket"   // create this bucket in the Thinger console
// --------------------------------------------------------

// pins
#define DHT_PIN_1 4
#define DHT_PIN_2 5
#define DHT_PIN_3 18
#define SOIL_PIN_1 34
#define SOIL_PIN_2 35
#define RELAY_PUMP 25
#define RELAY_FAN  26

// thresholds (IITA "Cut, Root, and Grow")
const float HUM_MIN = 85.0, HUM_RELEASE = 88.0;
const float TEMP_MAX = 30.0, TEMP_RELEASE = 28.5;

ThingerESP32 thing(THINGER_USERNAME, THINGER_DEVICE_ID, THINGER_DEVICE_CREDENTIAL);
DHT dht1(DHT_PIN_1, DHT22), dht2(DHT_PIN_2, DHT22), dht3(DHT_PIN_3, DHT22);

float H[3], T[3];
int S[2];
bool pumpOn = false, fanOn = false;
unsigned long lastSample = 0;

int soilPct(int raw) { int p = map(raw, 3200, 1400, 0, 100); return constrain(p, 0, 100); }

void readSensors() {
  H[0] = dht1.readHumidity();  H[1] = dht2.readHumidity();  H[2] = dht3.readHumidity();
  T[0] = dht1.readTemperature(); T[1] = dht2.readTemperature(); T[2] = dht3.readTemperature();
  S[0] = soilPct(analogRead(SOIL_PIN_1)); S[1] = soilPct(analogRead(SOIL_PIN_2));

  int humBreach = (H[0] < HUM_MIN) + (H[1] < HUM_MIN) + (H[2] < HUM_MIN);
  float maxT = max(T[0], max(T[1], T[2]));
  float meanH = (H[0] + H[1] + H[2]) / 3.0;

  if (humBreach >= 2 && !pumpOn) { pumpOn = true; digitalWrite(RELAY_PUMP, LOW); }
  else if (pumpOn && meanH >= HUM_RELEASE) { pumpOn = false; digitalWrite(RELAY_PUMP, HIGH); }
  if (maxT > TEMP_MAX && !fanOn) { fanOn = true; digitalWrite(RELAY_FAN, LOW); }
  else if (fanOn && maxT <= TEMP_RELEASE) { fanOn = false; digitalWrite(RELAY_FAN, HIGH); }
}

void setup() {
  Serial.begin(115200);
  dht1.begin(); dht2.begin(); dht3.begin();
  pinMode(RELAY_PUMP, OUTPUT); pinMode(RELAY_FAN, OUTPUT);
  digitalWrite(RELAY_PUMP, HIGH); digitalWrite(RELAY_FAN, HIGH); // active-low: HIGH = off
  thing.add_wifi(WIFI_SSID, WIFI_PASSWORD);

  // Resource Thinger reads / a bucket samples. Field names match the backend.
  thing["sensors"] >> [](pson & out) {
    out["humidity"]    = (H[0] + H[1] + H[2]) / 3.0;
    out["temperature"] = max(T[0], max(T[1], T[2]));
    out["soil"]        = (S[0] + S[1]) / 2;
    out["light"]       = 850; // add an LDR/BH1750 here if fitted
    out["pump"]        = pumpOn;
    out["fan"]         = fanOn;
  };
}

void loop() {
  thing.handle();
  if (millis() - lastSample >= 5000) { // 5 s cadence
    lastSample = millis();
    readSensors();
    // Option A: let a Thinger Data Bucket sample the "sensors" resource (console).
    // Option B: push straight to the bucket from here (uncomment):
    // thing.write_bucket(BUCKET_ID, "sensors");
  }
}
