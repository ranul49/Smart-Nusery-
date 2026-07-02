import React from "react";
import { View, Text } from "react-native";
import Svg, { Path } from "react-native-svg";
import { C } from "../theme/tokens.js";

/* 270° circular gauge — RN/SVG port of the web Gauge270 component. */
export function Gauge270({ value, min, max, unit, label, color, size = 132 }) {
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const start = 135;
  const sweep = 270;
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));

  const polar = (deg) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const arc = (a0, a1) => {
    const [x0, y0] = polar(a0);
    const [x1, y1] = polar(a1);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
  };

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Path d={arc(start, start + sweep)} fill="none" stroke={C.line} strokeWidth={11} strokeLinecap="round" />
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
