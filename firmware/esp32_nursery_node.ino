/*
 * Smart Cassava Nursery — ESP32 field-node reference firmware (Project SEN-20-5112)
 * ---------------------------------------------------------------------------------
 * This sketch shows how a REAL Perception-layer node (Chapter 3.4) feeds the
 * backend's Application layer. It reads 3x DHT22 + 2x capacitive soil probes,
 * performs the same edge diagnostics the backend uses, drives the relay module,
 * and POSTs the raw per-sensor arrays to the /api/ingest endpoint every 5 s.
 *
 * The backend re-runs the Smart Farming Cycle on the received sample, so the
 * cloud record and the on-device actuation stay consistent. On a node with a
 * SIM800L the direct SMS path (AT+CMGS) would run in parallel with this upload.
 *
 * Libraries: WiFi.h, HTTPClient.h, DHT.h (Adafruit).
 * Replace WIFI_SSID / WIFI_PASS / BACKEND_URL / DEVICE_ID / DEVICE_KEY.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

// ---- configuration ----
const char* WIFI_SSID  = "your-wifi";
const char* WIFI_PASS  = "your-password";
const char* BACKEND_URL = "http://192.168.1.20:4000/api/ingest"; // your server LAN IP
const char* DEVICE_ID  = "dev_xxxxxxxx";  // from POST /api/auth/register response
const char* DEVICE_KEY = "esp32-nursery-shared-key"; // matches backend DEVICE_API_KEY

// ---- pins ----
#define DHT_PIN_1 4
#define DHT_PIN_2 5
#define DHT_PIN_3 18
#define SOIL_PIN_1 34   // ADC1
#define SOIL_PIN_2 35   // ADC1
#define RELAY_PUMP 25
#define RELAY_FAN  26

// ---- thresholds (IITA "Cut, Root, and Grow") ----
const float HUM_MIN = 85.0, HUM_RELEASE = 88.0;
const float TEMP_MAX = 30.0, TEMP_RELEASE = 28.5;

DHT dht1(DHT_PIN_1, DHT22), dht2(DHT_PIN_2, DHT22), dht3(DHT_PIN_3, DHT22);
bool pumpOn = false, fanOn = false;

void setup() {
  Serial.begin(115200);
  dht1.begin(); dht2.begin(); dht3.begin();
  pinMode(RELAY_PUMP, OUTPUT); pinMode(RELAY_FAN, OUTPUT);
  digitalWrite(RELAY_PUMP, HIGH); digitalWrite(RELAY_FAN, HIGH); // active-low: HIGH = off
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nWiFi connected");
}

// Map a capacitive-probe ADC reading to an approximate % volumetric water content.
int soilPct(int raw) {
  const int DRY = 3200, WET = 1400; // calibrate per substrate
  int pct = map(raw, DRY, WET, 0, 100);
  return constrain(pct, 0, 100);
}

void loop() {
  float h[3] = { dht1.readHumidity(), dht2.readHumidity(), dht3.readHumidity() };
  float t[3] = { dht1.readTemperature(), dht2.readTemperature(), dht3.readTemperature() };
  int s[2]   = { soilPct(analogRead(SOIL_PIN_1)), soilPct(analogRead(SOIL_PIN_2)) };

  // Edge diagnostics: 2-of-3 humidity quorum, max temperature.
  int humBreach = (h[0] < HUM_MIN) + (h[1] < HUM_MIN) + (h[2] < HUM_MIN);
  float maxT = max(t[0], max(t[1], t[2]));
  float meanH = (h[0] + h[1] + h[2]) / 3.0;

  // Closed-loop actuation with hysteresis (active-low relays).
  if (humBreach >= 2 && !pumpOn) { pumpOn = true; digitalWrite(RELAY_PUMP, LOW); }
  else if (pumpOn && meanH >= HUM_RELEASE) { pumpOn = false; digitalWrite(RELAY_PUMP, HIGH); }
  if (maxT > TEMP_MAX && !fanOn) { fanOn = true; digitalWrite(RELAY_FAN, LOW); }
  else if (fanOn && maxT <= TEMP_RELEASE) { fanOn = false; digitalWrite(RELAY_FAN, HIGH); }

  // Upload the raw sample to the cloud application layer.
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(BACKEND_URL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-key", DEVICE_KEY);
    String body = String("{\"deviceId\":\"") + DEVICE_ID + "\"," +
      "\"humidity\":[" + h[0] + "," + h[1] + "," + h[2] + "]," +
      "\"temperature\":[" + t[0] + "," + t[1] + "," + t[2] + "]," +
      "\"soil\":[" + s[0] + "," + s[1] + "]}";
    int code = http.POST(body);
    Serial.printf("ingest -> %d\n", code);
    http.end();
  }

  delay(5000); // 5 s sampling cadence
}
