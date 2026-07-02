import React from "react";
import { View, Text } from "react-native";
import Svg, { Path } from "react-native-svg";
import { C } from "../theme/tokens.js";

/*
 * 270° circular gauge — RN/SVG port of the web Gauge270 component.
 * Optional zoneMin/zoneMax draw a faint green "optimal range" band just outside
 * the track, so each gauge is self-explanatory (green = where good lives).
 */
export function Gauge270({ value, min, max, unit, label, color, size = 132, zoneMin, zoneMax }) {
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const start = 135;
  const sweep = 270;
  const clamp01 = (n) => Math.max(0, Math.min(1, n));
  const pct = clamp01((value - min) / (max - min));
  const ang = (v) => start + sweep * clamp01((v - min) / (max - min));

  const polar = (deg, rr = r) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  };
  const arc = (a0, a1, rr = r) => {
    const [x0, y0] = polar(a0, rr);
    const [x1, y1] = polar(a1, rr);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M ${x0} ${y0} A ${rr} ${rr} 0 ${large} 1 ${x1} ${y1}`;
  };

  const hasZone = zoneMin != null && zoneMax != null && ang(zoneMax) > ang(zoneMin);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Path d={arc(start, start + sweep)} fill="none" stroke={C.line} strokeWidth={11} strokeLinecap="round" />
        {hasZone && (
          <Path d={arc(ang(zoneMin), ang(zoneMax), r + 9)} fill="none" stroke={C.greenLight} strokeOpacity={0.5} strokeWidth={3} strokeLinecap="round" />
        )}
        <Path d={arc(start, start + sweep * pct)} fill="none" stroke={color} strokeWidth={11} strokeLinecap="round" />
      </Svg>
      <View style={{ position: "absolute", width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 26, fontWeight: "800", color: C.ink }}>
          {value}
          <Text style={{ fontSize: 13, fontWeight: "600", color: C.inkSoft }}>{unit}</Text>
        </Text>
        <Text style={{ fontSize: 11, color: C.inkSoft, marginTop: 4, fontWeight: "600" }}>{label}</Text>
      </View>
    </View>
  );
}
