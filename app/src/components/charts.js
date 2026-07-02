import React from "react";
import { View, Text } from "react-native";
import Svg, { Path, Line, Rect, Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";
import { C } from "../theme/tokens.js";

/*
 * Lightweight SVG chart primitives that replace the web build's `recharts`
 * dependency. They take the same time-series shape the backend returns
 * ({ t, temp, hum, soil } / { d, l }) and render inside a fixed-height box.
 */

const H = 150;
const PAD = { l: 34, r: 10, t: 12, b: 22 };

// Minimum y-axis span per metric so a steady reading (e.g. humidity 88.9–89.1%)
// renders as a calm flat line instead of exaggerated noise.
const MIN_SPAN = { temp: 6, hum: 12, soil: 12 };

function scaleFor(values, width, minSpan = 0) {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2; // widen symmetrically around the data
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const span = hi - lo || 1;
  const innerW = width - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const x = (i, n) => PAD.l + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
  const y = (v) => PAD.t + innerH - ((v - lo) / span) * innerH;
  return { x, y, min: lo, max: hi };
}

// Min/max domain labels down the left edge, so the line's shape has a scale.
function YLabels({ min, max }) {
  return (
    <>
      <SvgText x={4} y={PAD.t + 4} fontSize={9} fill={C.inkSoft}>{Math.round(max)}</SvgText>
      <SvgText x={4} y={H - PAD.b} fontSize={9} fill={C.inkSoft}>{Math.round(min)}</SvgText>
    </>
  );
}

function Grid({ width }) {
  const lines = [0.25, 0.5, 0.75];
  const innerH = H - PAD.t - PAD.b;
  return (
    <>
      {lines.map((f, i) => (
        <Line
          key={i}
          x1={PAD.l}
          x2={width - PAD.r}
          y1={PAD.t + innerH * f}
          y2={PAD.t + innerH * f}
          stroke={C.line}
          strokeDasharray="3 3"
        />
      ))}
    </>
  );
}

// Shared chart frame handles measuring its own width.
function Frame({ children }) {
  const [w, setW] = React.useState(0);
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ width: "100%", height: H }}>
      {w > 0 ? children(w) : null}
    </View>
  );
}

export function LineChartMini({ data, dataKey, color }) {
  return (
    <Frame>
      {(w) => {
        const vals = data.map((d) => d[dataKey]);
        const { x, y, min, max } = scaleFor(vals, w, MIN_SPAN[dataKey] || 0);
        const path = vals.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i, vals.length)} ${y(v)}`).join(" ");
        return (
          <Svg width={w} height={H}>
            <Grid width={w} />
            <YLabels min={min} max={max} />
            <Path d={path} fill="none" stroke={color} strokeWidth={2.6} />
          </Svg>
        );
      }}
    </Frame>
  );
}

export function AreaChartMini({ data, dataKey, color }) {
  return (
    <Frame>
      {(w) => {
        const vals = data.map((d) => d[dataKey]);
        const { x, y, min, max } = scaleFor(vals, w, MIN_SPAN[dataKey] || 0);
        const line = vals.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i, vals.length)} ${y(v)}`).join(" ");
        const area = `${line} L ${x(vals.length - 1, vals.length)} ${H - PAD.b} L ${x(0, vals.length)} ${H - PAD.b} Z`;
        return (
          <Svg width={w} height={H}>
            <Defs>
              <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <Stop offset="100%" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Grid width={w} />
            <YLabels min={min} max={max} />
            <Path d={area} fill="url(#areaFill)" />
            <Path d={line} fill="none" stroke={color} strokeWidth={2.5} />
          </Svg>
        );
      }}
    </Frame>
  );
}

export function BarChartMini({ data, dataKey = "l", color = C.blue }) {
  return (
    <Frame>
      {(w) => {
        const vals = data.map((d) => d[dataKey]);
        const max = Math.max(...vals, 1);
        const innerW = w - PAD.l - PAD.r;
        const innerH = H - PAD.t - PAD.b;
        const bw = (innerW / data.length) * 0.55;
        return (
          <Svg width={w} height={H}>
            <Grid width={w} />
            {data.map((d, i) => {
              const cx = PAD.l + (i + 0.5) * (innerW / data.length);
              const h = (d[dataKey] / max) * innerH;
              return <Rect key={i} x={cx - bw / 2} y={PAD.t + innerH - h} width={bw} height={h} rx={6} fill={color} />;
            })}
          </Svg>
        );
      }}
    </Frame>
  );
}

// X-axis labels rendered as plain text below a chart.
export function AxisLabels({ data, keyName = "t", every = 2 }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: PAD.l, marginTop: 2 }}>
      {data.map((d, i) => (
        <Text key={i} style={{ fontSize: 9, color: C.inkSoft }}>
          {i % every === 0 ? d[keyName] : ""}
        </Text>
      ))}
    </View>
  );
}
