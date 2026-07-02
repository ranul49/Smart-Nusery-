import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Bell, MessageSquare, CheckCircle2, AlertTriangle, Thermometer, Activity } from "lucide-react-native";
import { C } from "../theme/tokens.js";
import { Card, Pill, PageTitle, OutlineButton, Screen, Notice } from "../components/ui.js";
import { api } from "../api/client.js";

const ICONS = { AlertTriangle, CheckCircle2, Thermometer, Activity };
const STYLE = {
  Critical: { c: C.red, bg: C.redSoft },
  Warning: { c: C.amber, bg: C.amberSoft },
  Resolved: { c: C.green, bg: C.greenSoft },
  Info: { c: C.blue, bg: C.blueSoft },
};

export function Alerts({ onOpenSms }) {
  const [alerts, setAlerts] = useState([]);
  const [counts, setCounts] = useState({ Critical: 0, Warning: 0, Resolved: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    const load = () =>
      api
        .alerts(30)
        .then((d) => {
          setAlerts(d.alerts);
          setCounts(d.counts);
          setError("");
        })
        .catch((e) => setError(e.message));
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, []);

  return (
    <Screen>
      <PageTitle title="Alerts" sub="Automated event log" icon={<Bell size={24} color={C.amber} />} bg={C.amberSoft} />

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <Tally n={counts.Critical} label="Critical" c={C.red} bg={C.redSoft} />
        <Tally n={counts.Warning} label="Warning" c={C.amber} bg={C.amberSoft} />
        <Tally n={counts.Resolved} label="Resolved" c={C.green} bg={C.greenSoft} />
      </View>

      {error ? <Notice text={error} /> : null}
      {!error && alerts.length === 0 ? <Notice text="No alerts yet — nursery is stable." /> : null}

      {alerts.map((a) => {
        const s = STYLE[a.level] || STYLE.Info;
        const I = ICONS[a.icon] || Activity;
        return (
          <Card key={a.id} style={{ marginBottom: 10, flexDirection: "row", gap: 13, alignItems: "flex-start", borderLeftWidth: 4, borderLeftColor: s.c }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: s.bg, alignItems: "center", justifyContent: "center" }}>
              <I size={20} color={s.c} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Pill text={a.level} color={s.c} bg={s.bg} />
                <Text style={{ fontSize: 11, color: C.inkSoft }}>{a.time}</Text>
              </View>
              <Text style={{ fontSize: 14.5, fontWeight: "700", color: C.ink, marginTop: 8 }}>{a.title}</Text>
              <Text style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 2 }}>{a.sub}</Text>
            </View>
          </Card>
        );
      })}

      <OutlineButton label="Preview farmer SMS alert" icon={<MessageSquare size={18} color={C.green} />} onPress={onOpenSms} style={{ marginTop: 8 }} />
    </Screen>
  );
}

function Tally({ n, label, c, bg }) {
  return (
    <Card style={{ flex: 1, padding: 12, alignItems: "center", backgroundColor: bg, borderWidth: 0 }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: c }}>{n}</Text>
      <Text style={{ fontSize: 11.5, color: c, fontWeight: "600" }}>{label}</Text>
    </Card>
  );
}
