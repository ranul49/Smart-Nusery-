import React, { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Settings as Cog, Moon, Bell, Globe } from "lucide-react-native";
import { C } from "../theme/tokens.js";
import { Card, SectionLabel, PageTitle, Screen, Notice } from "../components/ui.js";
import { api } from "../api/client.js";

export function SettingsScreen({ user, onUserChange }) {
  const [thresholds, setThresholds] = useState(null);
  const [system, setSystem] = useState(null);
  const [dark, setDark] = useState(false);
  const [notif, setNotif] = useState(true);
  const [lang, setLang] = useState(user?.language || "English");

  useEffect(() => {
    api.settings().then((d) => {
      setThresholds(d.thresholds);
      setSystem(d.system);
      setLang(d.system.language);
    }).catch(() => {});
  }, []);

  // Persist a threshold change to the backend (OTA-style update).
  const commit = (key, value) => {
    setThresholds((t) => ({ ...t, [key]: value }));
    api.updateThresholds({ [key]: value }).catch(() => {});
  };

  const changeLang = (l) => {
    setLang(l);
    api.updateSystem({ language: l }).then((r) => onUserChange?.(r.user)).catch(() => {});
  };

  if (!thresholds) return <Screen><Notice text="Loading settings…" /></Screen>;

  return (
    <Screen>
      <PageTitle title="Settings" sub="Thresholds & system" icon={<Cog size={24} color={C.inkSoft} />} bg="#EFF1ED" />

      <SectionLabel>Automation thresholds</SectionLabel>
      <Card style={{ padding: 4 }}>
        <Stepper label="Humidity threshold" value={thresholds.humidityMin} unit="%" min={70} max={95} onChange={(v) => commit("humidityMin", v)} />
        <Stepper label="Maximum temperature" value={thresholds.tempMax} unit="°C" min={25} max={40} onChange={(v) => commit("tempMax", v)} />
        <Stepper label="Minimum soil moisture" value={thresholds.soilMin} unit="%" min={40} max={80} onChange={(v) => commit("soilMin", v)} last />
      </Card>

      <SectionLabel>System</SectionLabel>
      <Card style={{ padding: 4 }}>
        <Row label="SMS number" value={system?.smsNumber} />
        <View style={{ paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.line }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Globe size={16} color={C.inkSoft} />
            <Text style={{ fontSize: 13.5, color: C.ink }}>Language</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {["English", "Yoruba", "Hausa"].map((l) => (
              <Pressable key={l} onPress={() => changeLang(l)} style={{ flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: lang === l ? C.green : C.bg, alignItems: "center" }}>
                <Text style={{ fontSize: 12.5, fontWeight: "600", color: lang === l ? "#fff" : C.inkSoft }}>{l}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Row label="Cloud connection" value={system?.cloudConnection} valueColor={system?.cloudConnection === "Connected" ? C.green : C.red} />
        <Row label="Firmware version" value={system?.firmware} />
        <Toggle icon={Moon} label="Dark mode" on={dark} set={setDark} />
        <Toggle icon={Bell} label="Notifications" on={notif} set={setNotif} last />
      </Card>

      <Text style={{ textAlign: "center", fontSize: 11, color: C.inkSoft, marginTop: 18 }}>
        Smart Cassava Nursery · SEN-20-5112
      </Text>
    </Screen>
  );
}

function Stepper({ label, value, unit, min, max, onChange, last }) {
  return (
    <View style={{ paddingVertical: 13, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.line }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 13.5, color: C.ink, fontWeight: "500" }}>{label}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <StepBtn text="−" onPress={() => onChange(Math.max(min, value - 1))} />
          <Text style={{ fontSize: 15, fontWeight: "800", color: C.green, minWidth: 46, textAlign: "center" }}>{value}{unit}</Text>
          <StepBtn text="+" onPress={() => onChange(Math.min(max, value + 1))} />
        </View>
      </View>
    </View>
  );
}
function StepBtn({ text, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: C.greenSoft, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 18, fontWeight: "800", color: C.green }}>{text}</Text>
    </Pressable>
  );
}
function Row({ label, value, valueColor }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.line }}>
      <Text style={{ fontSize: 13.5, color: C.ink }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: "600", color: valueColor || C.inkSoft }}>{value}</Text>
    </View>
  );
}
function Toggle({ icon: I, label, on, set, last }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.line }}>
      <I size={17} color={C.inkSoft} />
      <Text style={{ flex: 1, marginLeft: 10, fontSize: 13.5, color: C.ink }}>{label}</Text>
      <Pressable onPress={() => set(!on)} style={{ width: 44, height: 26, borderRadius: 20, backgroundColor: on ? C.green : "#CDD3CA", justifyContent: "center" }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", position: "absolute", left: on ? 21 : 3 }} />
      </Pressable>
    </View>
  );
}
