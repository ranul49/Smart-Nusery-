/*
 * Smart Cassava Nursery — ESP32 field-node firmware, OFFLINE ACCESS-POINT mode
 * ------------------------------------------------------------------------------
 * For sites with no WiFi router and no internet access at all. Instead of
 * joining an existing network, the ESP32 BROADCASTS its own WiFi network. A
 * laptop running the backend joins that network (with a fixed/static IP), and
 * the phone running the nursery app joins the same network and points at the
 * laptop's IP instead of a cloud URL. No internet is required anywhere.
 *
 *   ESP32 (this sketch, AP)  <--WiFi-->  laptop (runs backend, static IP)
 *                            <--WiFi-->  phone (runs the app)
 *
 * Setup:
 *   1. Flash this sketch (edit AP_SSID / AP_PASS / DEVICE_ID / DEVICE_KEY below).
 *   2. On the laptop, join the "AP_SSID" WiFi network, then set that WiFi
 *      adapter's IPv4 address to STATIC 192.168.4.2 (gateway 192.168.4.1,
 *      subnet 255.255.255.0) — this must match BACKEND_URL below.
 *   3. On the laptop, in backend/.env set SIMULATOR_ENABLED=false (so it
 *      waits for this real node instead of generating fake data) and run
 *      `npm start` from the backend/ folder.
 *   4. On the phone, join the same "AP_SSID" WiFi network, then run a build
 *      of the app with app/src/api/config.js's MANUAL_HOST set to
 *      "http://192.168.4.2:4000" (the laptop's static IP) instead of the
 *      live Render URL, and LOCAL_MODE left false.
 *
 * Libraries: WiFi.h, HTTPClient.h, DHT.h (Adafruit).
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

// ---- Access Point configuration (network the laptop + phone will join) ----
const char* AP_SSID = "SmartNursery-Node";   // shown in WiFi lists on laptop/phone
const char* AP_PASS = "nursery1234";         // WPA2 password, must be >= 8 characters
IPAddress AP_IP(192, 168, 4, 1);
IPAddress AP_GATEWAY(192, 168, 4, 1);
IPAddress AP_SUBNET(255, 255, 255, 0);

// ---- Backend location: the laptop's STATIC IP on this AP's network ----
const char* BACKEND_URL = "http://192.168.4.2:4000/api/ingest";
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

  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(AP_IP, AP_GATEWAY, AP_SUBNET);
  WiFi.softAP(AP_SSID, AP_PASS);
  Serial.println("\nAccess Point started.");
  Serial.print("Network name: "); Serial.println(AP_SSID);
  Serial.print("ESP32 AP IP:  "); Serial.println(WiFi.softAPIP());
  Serial.println("Join this network from the laptop (backend) and phone (app).");
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

  // Upload the raw sample to whichever laptop has joined the AP and taken
  // the expected static IP. softAPgetStationNum() skips the POST attempt
  // (and its multi-second timeout) when nothing has joined yet.
  if (WiFi.softAPgetStationNum() > 0) {
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
  } else {
    Serial.println("Waiting for laptop to join the AP...");
  }

  delay(5000); // 5 s sampling cadence
}
