import { Platform } from "react-native";

/*
 * LOCAL_MODE — run the whole thing ON the phone with no server and no network.
 *
 *   true  -> the app generates and processes its own nursery data on-device
 *            (see src/api/local.js). No backend, no LAN, no internet needed.
 *            This is the default so the standalone APK "just works" anywhere.
 *   false -> the app talks to the real Node backend over the network using the
 *            host settings below (LAN IP for a physical phone, etc.).
 */
export const LOCAL_MODE = true;

/*
 * Backend location (only used when LOCAL_MODE is false).
 * Change ONE of these to match where the backend is running:
 *
 *  - Android emulator  -> http://10.0.2.2:4000   (10.0.2.2 = host's localhost)
 *  - iOS simulator     -> http://localhost:4000
 *  - Physical phone    -> http://<your-computer-LAN-IP>:4000  (e.g. 192.168.x.x)
 *
 * The emulator/simulator defaults are picked automatically below; override
 * MANUAL_HOST when testing on a real device on the same Wi-Fi as the backend.
 */
const MANUAL_HOST = "http://192.168.1.175:4000"; // physical-device testing (this PC's LAN IP)

const AUTO_HOST = Platform.select({
  android: "http://10.0.2.2:4000",
  ios: "http://localhost:4000",
  default: "http://localhost:4000",
});

export const API_BASE = MANUAL_HOST || AUTO_HOST;
export const WS_BASE = API_BASE.replace(/^http/, "ws");
