import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, ActivityIndicator } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import {
  Home, BarChart3, Bell, FileText, Settings as Cog, Bluetooth, Cpu,
  AlertTriangle, X, ChevronRight,
} from "lucide-react-native";
import { C } from "./src/theme/tokens.js";
import { api, loadToken, getToken } from "./src/api/client.js";
import { useLive } from "./src/api/useLive.js";

import { Splash } from "./src/screens/Splash.js";
import { Login } from "./src/screens/Login.js";
import { Dashboard } from "./src/screens/Dashboard.js";
import { Live } from "./src/screens/Live.js";
import { Analytics } from "./src/screens/Analytics.js";
import { Alerts } from "./src/screens/Alerts.js";
import { Reports } from "./src/screens/Reports.js";
import { SettingsScreen } from "./src/screens/Settings.js";
import { SystemView } from "./src/screens/SystemView.js";
import { SmsView } from "./src/screens/SmsView.js";

const NAV = [
  { key: "dash", Icon: Home, label: "Home" },
  { key: "analytics", Icon: BarChart3, label: "Analytics" },
  { key: "alerts", Icon: Bell, label: "Alerts" },
  { key: "reports", Icon: FileText, label: "Reports" },
  { key: "settings", Icon: Cog, label: "Settings" },
];

export default function App() {
  const [phase, setPhase] = useState("splash"); // splash | login | app
  const [user, setUser] = useState(null);

  // Try to restore a previous session while the splash shows.
  useEffect(() => {
    (async () => {
      await loadToken();
      if (getToken()) {
        try {
          const u = await api.me();
          setUser(u);
        } catch {
          /* token invalid — fall through to login */
        }
      }
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: C.surface }}>
        {phase === "splash" && (
          <Splash onDone={() => setPhase(getToken() && user ? "app" : "login")} />
        )}
        {phase === "login" && (
          <Login
            onAuthed={(u) => {
              setUser(u);
              setPhase("app");
            }}
          />
        )}
        {phase === "app" && (
          <MainApp
            user={user}
            onUserChange={setUser}
            onLogout={async () => {
              await api.logout();
              setUser(null);
              setPhase("login");
            }}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

function MainApp({ user, onUserChange }) {
  const [tab, setTab] = useState("dash");
  const [overlay, setOverlay] = useState(null); // live | system | sms
  const [scan, setScan] = useState(false);
  const [toast, setToast] = useState(null);
  const { reading, alert } = useLive();

  // Surface a critical alert as a floating toast, auto-dismissing after 5s.
  useEffect(() => {
    if (alert && alert.level === "Critical") {
      setToast(alert);
      const t = setTimeout(() => setToast(null), 5200);
      return () => clearTimeout(t);
    }
  }, [alert]);

  let body;
  if (overlay === "live") body = <Live onBack={() => setOverlay(null)} live={reading} />;
  else if (overlay === "system") body = <SystemView onBack={() => setOverlay(null)} />;
  else if (overlay === "sms") body = <SmsView onBack={() => setOverlay(null)} />;
  else if (tab === "dash") body = <Dashboard user={user} live={reading} onOpenLive={() => setOverlay("live")} onOpenSystem={() => setOverlay("system")} />;
  else if (tab === "analytics") body = <Analytics />;
  else if (tab === "alerts") body = <Alerts onOpenSms={() => setOverlay("sms")} />;
  else if (tab === "reports") body = <Reports />;
  else body = <SettingsScreen user={user} onUserChange={onUserChange} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.surface }} edges={["top", "bottom"]}>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>{body}</View>

        {/* Critical alert toast */}
        {toast && !overlay && (
          <View style={{ position: "absolute", top: 12, left: 14, right: 14 }}>
            <View style={{ backgroundColor: "#fff", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.redSoft, borderLeftWidth: 5, borderLeftColor: C.red, flexDirection: "row", gap: 12, shadowColor: C.red, shadowOpacity: 0.28, shadowRadius: 20, shadowOffset: { width: 0, height: 14 }, elevation: 8 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.redSoft, alignItems: "center", justifyContent: "center" }}>
                <AlertTriangle size={22} color={C.red} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: C.red, letterSpacing: 0.3 }}>⚠ CRITICAL ALERT</Text>
                <Text style={{ fontSize: 13, color: C.ink, marginTop: 3 }}>{toast.title}</Text>
                <Text style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 2 }}>Farmer notified via SMS</Text>
              </View>
              <Pressable onPress={() => setToast(null)}>
                <X size={16} color={C.inkSoft} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Scan Device FAB */}
        {!overlay && (
          <Pressable onPress={() => setScan(true)} style={{ position: "absolute", right: 18, bottom: 18, height: 54, borderRadius: 27, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" }}>
            <LinearGradient colors={[C.green, C.greenDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, borderRadius: 27 }} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <Bluetooth size={20} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Scan Device</Text>
            </View>
          </Pressable>
        )}

        {/* Bottom navigation */}
        {!overlay && (
          <View style={{ flexDirection: "row", justifyContent: "space-around", backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 9, paddingBottom: 10 }}>
            {NAV.map((n) => {
              const active = tab === n.key;
              return (
                <Pressable key={n.key} onPress={() => setTab(n.key)} style={{ alignItems: "center", gap: 3, flex: 1 }}>
                  <n.Icon size={22} color={active ? C.green : "#A6AEA1"} strokeWidth={active ? 2.4 : 2} />
                  <Text style={{ fontSize: 10, fontWeight: active ? "700" : "500", color: active ? C.green : "#A6AEA1" }}>{n.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Scan modal */}
      <Modal visible={scan} transparent animationType="slide" onRequestClose={() => setScan(false)}>
        <Pressable onPress={() => setScan(false)} style={{ flex: 1, backgroundColor: "rgba(22,36,28,0.5)", justifyContent: "flex-end" }}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 24 }}>
            <View style={{ width: 40, height: 4, backgroundColor: C.line, borderRadius: 4, alignSelf: "center", marginBottom: 18 }} />
            <View style={{ alignItems: "center" }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: C.greenSoft, alignItems: "center", justifyContent: "center" }}>
                <Bluetooth size={32} color={C.green} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: "800", color: C.ink, marginTop: 18 }}>Scanning for devices…</Text>
              <Text style={{ fontSize: 13, color: C.inkSoft, marginTop: 4, textAlign: "center" }}>
                Make sure your ESP32 controller is powered on and nearby.
              </Text>
              <ActivityIndicator color={C.green} style={{ marginTop: 14 }} />
            </View>
            <Pressable onPress={() => setScan(false)} style={{ marginTop: 20, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: C.greenLight, borderRadius: 20, padding: 16 }}>
              <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: C.greenSoft, alignItems: "center", justifyContent: "center" }}>
                <Cpu size={20} color={C.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: C.ink }}>ESP32-NURSERY-A1</Text>
                <Text style={{ fontSize: 11.5, color: C.green }}>Tunnel A · signal strong</Text>
              </View>
              <ChevronRight size={18} color={C.inkSoft} />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
